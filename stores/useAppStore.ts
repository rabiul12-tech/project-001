'use client';

import { create } from 'zustand';
import {
  ActivityCategory,
  ActivityEvent,
  AurelixStorageSchema,
  Customer,
  DailySessionMetric,
  DateRangePreset,
  FulfillmentStatus,
  GeneratedReportRecord,
  Order,
  OrderLineItem,
  PaymentStatus,
  Product,
  ProductStatus,
  SavedReportConfig,
  TeamMember,
  TeamRole,
  ThemeMode,
  ToastNotification,
  WorkspaceSettings,
} from '@/types';
import {
  CURRENT_SCHEMA_VERSION,
  generateDeterministicSeedData,
} from '@/lib/demo-data/seed';
import { defaultCustomRange, goLive, nowIso as clockNowIso } from '@/lib/clock';
import {
  loadFromLocalStorage,
  saveToLocalStorage,
  sortActivitiesNewestFirst,
  STORAGE_KEYS,
  validateAndImportBackupJson,
} from '@/lib/storage/repository';
import {
  calculateOrderTotalsFromItems,
  fromCents,
  toCents,
} from '@/lib/calculations/analytics';
import {
  canPerformAction,
  getPermissionDeniedMessage,
  PermissionAction,
} from '@/lib/permissions';
import {
  backupStorageSchema,
  CreateOrderFormValues,
  CustomerFormValues,
  ProductFormValues,
  TeamMemberFormValues,
} from '@/lib/validation/schemas';

interface AppStoreState {
  isHydrated: boolean;
  hydrationStatus: 'hydrated' | 'seeded' | 'migrated' | 'corrupt_recovered';
  recoveryAlertMessage: string | null;
  storageQuotaError: string | null;
  seededAt: string;

  customers: Customer[];
  products: Product[];
  orders: Order[];
  team: TeamMember[];
  activities: ActivityEvent[];
  savedReports: SavedReportConfig[];
  reportHistory: GeneratedReportRecord[];
  dailySessions: DailySessionMetric[];
  settings: WorkspaceSettings;

  // Global UI state
  datePreset: DateRangePreset;
  customStartDate: string;
  customEndDate: string;
  commandPaletteOpen: boolean;
  mobileNavOpen: boolean;
  globalSearchQuery: string;
  toasts: ToastNotification[];

  // Actions
  hydrateStore: () => void;
  syncFromExternalStorage: () => void;
  dismissRecoveryAlert: () => void;
  dismissStorageError: () => void;
  setDatePreset: (preset: DateRangePreset, customStart?: string, customEnd?: string) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setMobileNavOpen: (open: boolean) => void;
  setGlobalSearchQuery: (q: string) => void;
  addToast: (
    title: string,
    description?: string,
    variant?: ToastNotification['variant']
  ) => void;
  dismissToast: (id: string) => void;

  // Theme & Layout
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setActiveRolePreview: (role: TeamRole) => void;

  // Customer CRUD
  addCustomer: (values: CustomerFormValues) => Customer | null;
  updateCustomer: (id: string, values: CustomerFormValues) => void;
  deleteCustomers: (ids: string[]) => void;

  // Product CRUD
  addProduct: (values: ProductFormValues) => Product | null;
  updateProduct: (id: string, values: ProductFormValues) => void;
  archiveProducts: (ids: string[]) => void;

  // Order CRUD
  createOrder: (values: CreateOrderFormValues) => Order | null;
  updateOrderStatus: (
    orderId: string,
    paymentStatus: PaymentStatus,
    fulfillmentStatus: FulfillmentStatus
  ) => void;
  cancelOrder: (orderId: string) => void;
  refundOrder: (orderId: string, refundAmount?: number) => void;
  bulkUpdateOrderStatus: (
    orderIds: string[],
    paymentStatus: PaymentStatus,
    fulfillmentStatus: FulfillmentStatus
  ) => void;

  // Reports
  saveReportConfig: (
    config: Omit<SavedReportConfig, 'id' | 'createdAt' | 'lastGeneratedAt' | 'createdBy'>
  ) => SavedReportConfig | null;
  deleteReportConfig: (id: string) => void;
  recordGeneratedReport: (
    record: Omit<GeneratedReportRecord, 'id' | 'generatedAt' | 'generatedBy'>
  ) => void;

  // Team CRUD
  addTeamMember: (values: TeamMemberFormValues) => TeamMember | null;
  updateTeamMember: (id: string, values: Partial<TeamMemberFormValues>) => void;
  removeTeamMember: (id: string) => void;

  // Settings & Data Management
  updateSettings: (partial: Partial<WorkspaceSettings>) => void;
  resetDemoData: () => void;
  importBackupJson: (rawJson: string) => { ok: boolean; error?: string };
  getExportSnapshot: () => AurelixStorageSchema;
}

const initialSeed = generateDeterministicSeedData();
const initialRange = defaultCustomRange();

function buildSnapshotFromState(state: AppStoreState): AurelixStorageSchema {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    seededAt: state.seededAt,
    lastUpdatedAt: clockNowIso(),
    customers: state.customers,
    products: state.products,
    orders: state.orders,
    team: state.team,
    activities: state.activities,
    savedReports: state.savedReports,
    reportHistory: state.reportHistory,
    dailySessions: state.dailySessions,
    settings: state.settings,
  };
}

function createActivityRecord(
  state: AppStoreState,
  category: ActivityCategory,
  action: string,
  targetName: string,
  description: string,
  targetId?: string
): ActivityEvent {
  return {
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: clockNowIso(),
    actorName: state.settings.personalName || 'Claire Vance',
    actorRole: state.settings.activeRolePreview || 'Owner',
    category,
    action,
    targetId,
    targetName,
    description,
  };
}

function generateNextOrderNumber(orders: Order[]): string {
  let maxNum = 20260000;
  for (const o of orders) {
    const match = /^AUR-(\d+)$/.exec(o.orderNumber);
    if (match) {
      const n = Number(match[1]);
      if (Number.isFinite(n) && n > maxNum) {
        maxNum = n;
      }
    }
  }
  return `AUR-${maxNum + 1}`;
}

export const useAppStore = create<AppStoreState>((set, get) => {
  const guardPermission = (action: PermissionAction): boolean => {
    const role = get().settings.activeRolePreview;
    if (canPerformAction(role, action)) return true;
    get().addToast(
      'Permission denied',
      getPermissionDeniedMessage(role, action),
      'error'
    );
    return false;
  };

  const commitState = (patch: Partial<AppStoreState>) => {
    const prev = get();
    const merged: AppStoreState = { ...prev, ...patch };
    const normalizedActivities = patch.activities
      ? sortActivitiesNewestFirst(patch.activities)
      : prev.activities;
    const nextState: AppStoreState = {
      ...merged,
      activities: normalizedActivities,
    };
    const saveRes = saveToLocalStorage(buildSnapshotFromState(nextState));
    set({
      ...patch,
      ...(patch.activities ? { activities: normalizedActivities } : {}),
      storageQuotaError: saveRes.ok
        ? null
        : saveRes.error || 'Unable to persist workspace updates to LocalStorage.',
    });
    if (!saveRes.ok) {
      get().addToast(
        'Storage persistence error',
        saveRes.error || 'Changes could not be saved to LocalStorage.',
        'error'
      );
    }
  };

  return {
  isHydrated: false,
  hydrationStatus: 'seeded',
  recoveryAlertMessage: null,
  storageQuotaError: null,
  seededAt: initialSeed.seededAt,

  customers: initialSeed.customers,
  products: initialSeed.products,
  orders: initialSeed.orders,
  team: initialSeed.team,
  activities: initialSeed.activities,
  savedReports: initialSeed.savedReports,
  reportHistory: initialSeed.reportHistory,
  dailySessions: initialSeed.dailySessions,
  settings: initialSeed.settings,

  datePreset: '30d',
  customStartDate: initialRange.start,
  customEndDate: initialRange.end,
  commandPaletteOpen: false,
  mobileNavOpen: false,
  globalSearchQuery: '',
  toasts: [],

  hydrateStore: () => {
    // First client-side moment: from here on the clock is the visitor's real time.
    goLive();
    const result = loadFromLocalStorage();
    const range = defaultCustomRange();
    set({
      isHydrated: true,
      seededAt: result.data.seededAt,
      customStartDate: range.start,
      customEndDate: range.end,
      hydrationStatus: result.status,
      recoveryAlertMessage: result.errorMessage || null,
      customers: result.data.customers,
      products: result.data.products,
      orders: result.data.orders,
      team: result.data.team,
      activities: sortActivitiesNewestFirst(result.data.activities),
      savedReports: result.data.savedReports,
      reportHistory: result.data.reportHistory,
      dailySessions: result.data.dailySessions,
      settings: result.data.settings,
    });
  },

  syncFromExternalStorage: () => {
    if (typeof window === 'undefined') return;
    try {
      const rawJson = window.localStorage.getItem(STORAGE_KEYS.MAIN_STORE);
      if (!rawJson) return;
      const parsed = JSON.parse(rawJson);
      const check = backupStorageSchema.safeParse(parsed);
      if (!check.success) return;
      if (parsed.schemaVersion > CURRENT_SCHEMA_VERSION) return;
      const d = check.data;
      set((state) => ({
        seededAt: d.seededAt,
        customers: d.customers,
        products: d.products,
        orders: d.orders,
        team: d.team,
        activities: sortActivitiesNewestFirst(d.activities),
        savedReports: d.savedReports.length > 0 ? d.savedReports : state.savedReports,
        reportHistory: d.reportHistory.length > 0 ? d.reportHistory : state.reportHistory,
        dailySessions: d.dailySessions.length > 0 ? d.dailySessions : state.dailySessions,
        settings: d.settings,
      }));
    } catch {
      // Ignore malformed external storage mutations so current tab state stays safe
    }
  },

  dismissRecoveryAlert: () => set({ recoveryAlertMessage: null }),
  dismissStorageError: () => set({ storageQuotaError: null }),

  setDatePreset: (preset, customStart, customEnd) => {
    set((state) => ({
      datePreset: preset,
      customStartDate: customStart ?? state.customStartDate,
      customEndDate: customEnd ?? state.customEndDate,
    }));
  },

  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
  setGlobalSearchQuery: (q) => set({ globalSearchQuery: q }),

  addToast: (title, description, variant = 'default') => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    set((state) => ({
      toasts: [...state.toasts.slice(-3), { id, title, description, variant, createdAt: Date.now() }],
    }));
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        get().dismissToast(id);
      }, 4200);
    }
  },

  dismissToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  setTheme: (theme) => {
    const state = get();
    const updatedSettings = { ...state.settings, theme };
    commitState({ settings: updatedSettings });
  },

  toggleTheme: () => {
    const current = get().settings.theme;
    get().setTheme(current === 'dark' ? 'light' : 'dark');
  },

  setSidebarCollapsed: (collapsed) => {
    const state = get();
    const updatedSettings = { ...state.settings, sidebarCollapsed: collapsed };
    commitState({ settings: updatedSettings });
  },

  setActiveRolePreview: (role) => {
    const state = get();
    const updatedSettings = { ...state.settings, activeRolePreview: role };
    const event = createActivityRecord(
      state,
      'Team',
      'Role Preview Switched',
      `Role: ${role}`,
      `Switched interactive demo interface preview to ${role} permissions.`
    );
    commitState({
      settings: updatedSettings,
      activities: [event, ...state.activities],
    });
    get().addToast(`Role preview set to ${role}`, 'Interface permissions updated for demo preview.', 'default');
  },

  addCustomer: (values) => {
    if (!guardPermission('mutate_customers')) return null;
    const state = get();
    const newCustomer: Customer = {
      ...values,
      id: `cust_${Date.now()}`,
      createdAt: clockNowIso(),
    };
    const event = createActivityRecord(
      state,
      'Customer',
      'Customer Created',
      newCustomer.company,
      `Added ${newCustomer.name} (${newCustomer.company}) in ${newCustomer.segment} segment.`,
      newCustomer.id
    );
    commitState({
      customers: [newCustomer, ...state.customers],
      activities: [event, ...state.activities],
    });
    get().addToast('Customer added', `${newCustomer.company} has been saved.`, 'success');
    return newCustomer;
  },

  updateCustomer: (id, values) => {
    if (!guardPermission('mutate_customers')) return;
    const state = get();
    const customers = state.customers.map((c) =>
      c.id === id ? { ...c, ...values } : c
    );
    const orders = state.orders.map((o) =>
      o.customerId === id
        ? {
            ...o,
            customerName: values.name,
            customerCompany: values.company,
            customerEmail: values.email,
          }
        : o
    );
    const event = createActivityRecord(
      state,
      'Customer',
      'Customer Updated',
      values.company,
      `Updated profile and segment details for ${values.name} (${values.company}).`,
      id
    );
    commitState({
      customers,
      orders,
      activities: [event, ...state.activities],
    });
    get().addToast('Customer updated', `Changes to ${values.company} saved.`, 'success');
  },

  deleteCustomers: (ids) => {
    if (!guardPermission('mutate_customers')) return;
    const state = get();
    const idSet = new Set(ids);
    const removed = state.customers.filter((c) => idSet.has(c.id));
    if (removed.length === 0) return;
    const customers = state.customers.filter((c) => !idSet.has(c.id));
    const targetLabel =
      removed.length === 1 ? removed[0].company : `${removed.length} customer records`;
    const event = createActivityRecord(
      state,
      'Customer',
      'Customer Removed',
      targetLabel,
      `Deleted ${targetLabel}. Historical order ledger snapshots were preserved.`
    );
    commitState({
      customers,
      activities: [event, ...state.activities],
    });
    get().addToast('Customer deleted', `${targetLabel} removed from directory.`, 'warning');
  },

  addProduct: (values) => {
    if (!guardPermission('mutate_products')) return null;
    const state = get();
    const nowIso = clockNowIso();
    const prefix = values.sku.slice(0, 3).toUpperCase() || 'ENT';
    const newProduct: Product = {
      ...values,
      id: `prod_${Date.now()}`,
      imageCode: `${prefix}-${(state.products.length % 6) + 1}`,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const event = createActivityRecord(
      state,
      'Product',
      'Product Created',
      newProduct.name,
      `Created SKU ${newProduct.sku} at $${newProduct.unitPrice.toLocaleString()} unit price.`,
      newProduct.id
    );
    commitState({
      products: [newProduct, ...state.products],
      activities: [event, ...state.activities],
    });
    get().addToast('Product created', `${newProduct.name} (${newProduct.sku}) added to catalog.`, 'success');
    return newProduct;
  },

  updateProduct: (id, values) => {
    if (!guardPermission('mutate_products')) return;
    const state = get();
    const nowIso = clockNowIso();
    // Crucial requirement: updating a product's unitPrice does NOT mutate historical order line items
    const products = state.products.map((p) =>
      p.id === id ? { ...p, ...values, updatedAt: nowIso } : p
    );
    const event = createActivityRecord(
      state,
      'Product',
      'Product Updated',
      values.name,
      `Updated catalog SKU ${values.sku} (New unit price: $${values.unitPrice.toLocaleString()}). Historical orders retain original price.`,
      id
    );
    commitState({
      products,
      activities: [event, ...state.activities],
    });
    get().addToast('Product updated', `${values.name} catalog details saved.`, 'success');
  },

  archiveProducts: (ids) => {
    if (!guardPermission('mutate_products')) return;
    const state = get();
    const idSet = new Set(ids);
    if (idSet.size === 0) return;
    const products = state.products.map((p) =>
      idSet.has(p.id) ? { ...p, status: 'Archived' as const, updatedAt: clockNowIso() } : p
    );
    const event = createActivityRecord(
      state,
      'Product',
      'Products Archived',
      `${ids.length} SKU(s)`,
      `Archived ${ids.length} product catalog item(s).`
    );
    commitState({
      products,
      activities: [event, ...state.activities],
    });
    get().addToast('Products archived', `${ids.length} product(s) marked as Archived.`, 'default');
  },

  createOrder: (values) => {
    if (!guardPermission('mutate_orders')) return null;
    const state = get();
    const customer = state.customers.find((c) => c.id === values.customerId);
    if (!customer) return null;

    const lineItems: OrderLineItem[] = [];
    for (let idx = 0; idx < values.items.length; idx++) {
      const itemInput = values.items[idx];
      const product = state.products.find((p) => p.id === itemInput.productId);
      if (!product) continue;
      const quantity = Math.max(1, Number(itemInput.quantity));
      const unitPrice = product.unitPrice;
      lineItems.push({
        id: `li_${Date.now()}_${idx}`,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        category: product.category,
        quantity,
        unitPrice,
        subtotal: fromCents(Math.round(quantity * toCents(unitPrice))),
      });
    }

    if (lineItems.length === 0) return null;

    const rawTaxRatePercent = Number.isFinite(Number(values.taxRatePercent))
      ? Number(values.taxRatePercent)
      : 8.5;
    const taxRate = Math.max(0, rawTaxRatePercent) / 100;
    const totals = calculateOrderTotalsFromItems(
      lineItems,
      Number(values.discountAmount) || 0,
      taxRate
    );

    const orderNumber = generateNextOrderNumber(state.orders);
    const newOrder: Order = {
      id: `ord_${Date.now()}`,
      orderNumber,
      customerId: customer.id,
      customerName: customer.name,
      customerEmail: customer.email,
      customerCompany: customer.company,
      orderDate: clockNowIso(),
      lineItems,
      subtotal: totals.subtotal,
      discountAmount: totals.discountAmount,
      taxRate,
      taxAmount: totals.taxAmount,
      totalAmount: totals.totalAmount,
      refundedAmount: values.paymentStatus === 'Refunded' ? totals.totalAmount : 0,
      paymentStatus: values.paymentStatus,
      fulfillmentStatus: values.fulfillmentStatus,
      salesChannel: values.salesChannel,
      notes: values.notes,
    };

    // Decrement product stock levels safely (skip inventory decrement if Canceled/Failed)
    const shouldDecrementStock =
      values.paymentStatus !== 'Failed' && values.fulfillmentStatus !== 'Canceled';
    const products = shouldDecrementStock
      ? state.products.map((p) => {
          const orderedQty = lineItems
            .filter((li) => li.productId === p.id)
            .reduce((acc, li) => acc + li.quantity, 0);
          if (orderedQty === 0) return p;
          const nextStock = Math.max(0, p.stockLevel - orderedQty);
          const nextStatus: ProductStatus =
            p.status === 'Archived'
              ? 'Archived'
              : nextStock === 0
              ? 'Low Stock'
              : nextStock <= 14
              ? 'Low Stock'
              : 'Active';
          return { ...p, stockLevel: nextStock, status: nextStatus };
        })
      : state.products;

    const event = createActivityRecord(
      state,
      'Order',
      'Order Created',
      newOrder.orderNumber,
      `Created order ${newOrder.orderNumber} for ${customer.company} totaling $${newOrder.totalAmount.toLocaleString()}.`,
      newOrder.id
    );

    commitState({
      orders: [newOrder, ...state.orders],
      products,
      activities: [event, ...state.activities],
    });
    get().addToast(
      'Order created',
      `${newOrder.orderNumber} ($${newOrder.totalAmount.toLocaleString()}) recorded.`,
      'success'
    );
    return newOrder;
  },

  updateOrderStatus: (orderId, paymentStatus, fulfillmentStatus) => {
    if (!guardPermission('mutate_orders')) return;
    const state = get();
    const target = state.orders.find((o) => o.id === orderId);
    if (!target) return;

    const orders = state.orders.map((o) => {
      if (o.id !== orderId) return o;
      const effectivePayment =
        fulfillmentStatus === 'Canceled' && paymentStatus === 'Pending'
          ? ('Failed' as const)
          : paymentStatus;
      const refundedAmount =
        effectivePayment === 'Refunded'
          ? o.refundedAmount > 0
            ? Math.min(o.totalAmount, o.refundedAmount)
            : o.totalAmount
          : 0;
      return {
        ...o,
        paymentStatus: effectivePayment,
        fulfillmentStatus,
        refundedAmount,
      };
    });

    const event = createActivityRecord(
      state,
      'Order',
      'Order Status Updated',
      target.orderNumber,
      `Updated ${target.orderNumber} to Payment: ${paymentStatus}, Fulfillment: ${fulfillmentStatus}.`,
      orderId
    );
    commitState({
      orders,
      activities: [event, ...state.activities],
    });
    get().addToast(
      'Order updated',
      `${target.orderNumber} updated to ${paymentStatus} / ${fulfillmentStatus}.`,
      'success'
    );
  },

  cancelOrder: (orderId) => {
    if (!guardPermission('mutate_orders')) return;
    const state = get();
    const target = state.orders.find((o) => o.id === orderId);
    if (!target) return;

    const orders = state.orders.map((o) =>
      o.id === orderId
        ? {
            ...o,
            paymentStatus: 'Failed' as const,
            fulfillmentStatus: 'Canceled' as const,
            refundedAmount: 0,
          }
        : o
    );

    const event = createActivityRecord(
      state,
      'Order',
      'Order Canceled',
      target.orderNumber,
      `Canceled order ${target.orderNumber} for ${target.customerCompany}.`,
      orderId
    );
    commitState({
      orders,
      activities: [event, ...state.activities],
    });
    get().addToast('Order canceled', `${target.orderNumber} has been marked as Canceled.`, 'warning');
  },

  refundOrder: (orderId, refundAmount) => {
    if (!guardPermission('issue_refund')) return;
    const state = get();
    const target = state.orders.find((o) => o.id === orderId);
    if (!target) return;

    if (target.paymentStatus === 'Failed' || target.fulfillmentStatus === 'Canceled') {
      get().addToast(
        'Refund unavailable',
        `Canceled or failed order ${target.orderNumber} has no collected settlement to refund.`,
        'warning'
      );
      return;
    }

    const totalCents = toCents(target.totalAmount);
    const requestedCents =
      refundAmount !== undefined && Number.isFinite(refundAmount)
        ? toCents(refundAmount)
        : totalCents;
    const clampedCents = Math.min(totalCents, Math.max(1, requestedCents));
    const finalRefund = fromCents(clampedCents);

    const orders = state.orders.map((o) =>
      o.id === orderId
        ? {
            ...o,
            paymentStatus: 'Refunded' as const,
            refundedAmount: finalRefund,
          }
        : o
    );

    const event = createActivityRecord(
      state,
      'Order',
      'Simulated Refund Issued',
      target.orderNumber,
      `Simulated refund of $${finalRefund.toLocaleString()} for ${target.orderNumber} (${target.customerCompany}).`,
      orderId
    );
    commitState({
      orders,
      activities: [event, ...state.activities],
    });
    get().addToast(
      'Simulated refund processed',
      `Refund of $${finalRefund.toLocaleString()} recorded on ${target.orderNumber}.`,
      'warning'
    );
  },

  bulkUpdateOrderStatus: (orderIds, paymentStatus, fulfillmentStatus) => {
    if (!guardPermission('mutate_orders')) return;
    const state = get();
    const idSet = new Set(orderIds);
    if (idSet.size === 0) return;
    const orders = state.orders.map((o) => {
      if (!idSet.has(o.id)) return o;
      const refundedAmount =
        paymentStatus === 'Refunded'
          ? o.refundedAmount > 0
            ? Math.min(o.totalAmount, o.refundedAmount)
            : o.totalAmount
          : 0;
      return {
        ...o,
        paymentStatus,
        fulfillmentStatus,
        refundedAmount,
      };
    });
    const event = createActivityRecord(
      state,
      'Order',
      'Bulk Order Update',
      `${orderIds.length} Orders`,
      `Updated ${orderIds.length} orders to ${paymentStatus} / ${fulfillmentStatus}.`
    );
    commitState({
      orders,
      activities: [event, ...state.activities],
    });
    get().addToast('Bulk update complete', `Updated ${orderIds.length} order records.`, 'success');
  },

  saveReportConfig: (config) => {
    if (!guardPermission('manage_reports')) return null;
    const state = get();
    const nowIso = clockNowIso();
    const newConfig: SavedReportConfig = {
      ...config,
      id: `rep_cfg_${Date.now()}`,
      createdAt: nowIso,
      lastGeneratedAt: nowIso,
      createdBy: state.settings.personalName || 'Claire Vance',
    };
    const savedReports = [newConfig, ...state.savedReports];
    const event = createActivityRecord(
      state,
      'Report',
      'Report Template Saved',
      newConfig.name,
      `Saved custom report configuration "${newConfig.name}" (${newConfig.type}).`,
      newConfig.id
    );
    commitState({
      savedReports,
      activities: [event, ...state.activities],
    });
    get().addToast('Report configuration saved', `"${newConfig.name}" added to templates.`, 'success');
    return newConfig;
  },

  deleteReportConfig: (id) => {
    if (!guardPermission('manage_reports')) return;
    const state = get();
    const target = state.savedReports.find((r) => r.id === id);
    if (!target) return;
    const savedReports = state.savedReports.filter((r) => r.id !== id);
    const event = createActivityRecord(
      state,
      'Report',
      'Report Template Deleted',
      target.name,
      `Removed saved report configuration "${target.name}".`,
      id
    );
    commitState({
      savedReports,
      activities: [event, ...state.activities],
    });
    get().addToast('Report removed', `"${target.name}" deleted.`, 'default');
  },

  recordGeneratedReport: (record) => {
    if (!guardPermission('export_csv')) return;
    const state = get();
    const newRecord: GeneratedReportRecord = {
      ...record,
      id: `rep_hist_${Date.now()}`,
      generatedAt: clockNowIso(),
      generatedBy: state.settings.personalName || 'Claire Vance',
    };
    const reportHistory = [newRecord, ...state.reportHistory];
    const event = createActivityRecord(
      state,
      'Report',
      `Report Exported (${record.format})`,
      record.reportName,
      `Generated ${record.format} report "${record.reportName}" with ${record.rowCount} records.`
    );
    commitState({
      reportHistory,
      activities: [event, ...state.activities],
    });
  },

  addTeamMember: (values) => {
    if (!guardPermission('manage_team')) return null;
    const state = get();
    const nowIso = clockNowIso();
    const newMember: TeamMember = {
      ...values,
      id: `team_${Date.now()}`,
      avatarUrl: '',
      status: 'Active',
      joinedAt: nowIso,
      lastActiveAt: nowIso,
    };
    const team = [...state.team, newMember];
    const event = createActivityRecord(
      state,
      'Team',
      'Demo Member Added',
      newMember.name,
      `Added ${newMember.name} (${newMember.title}) with simulated ${newMember.role} role.`,
      newMember.id
    );
    commitState({
      team,
      activities: [event, ...state.activities],
    });
    get().addToast('Demo team member added', `${newMember.name} added as ${newMember.role}.`, 'success');
    return newMember;
  },

  updateTeamMember: (id, values) => {
    if (!guardPermission('manage_team')) return;
    const state = get();
    const target = state.team.find((m) => m.id === id);
    if (!target) return;
    const team = state.team.map((m) => (m.id === id ? { ...m, ...values } : m));
    const event = createActivityRecord(
      state,
      'Team',
      'Demo Member Updated',
      target.name,
      `Updated profile or role assignment for ${target.name}.`,
      id
    );
    commitState({
      team,
      activities: [event, ...state.activities],
    });
    get().addToast('Team member updated', 'Demo profile changes saved.', 'success');
  },

  removeTeamMember: (id) => {
    if (!guardPermission('manage_team')) return;
    const state = get();
    const target = state.team.find((m) => m.id === id);
    if (!target) return;
    const team = state.team.filter((m) => m.id !== id);
    const event = createActivityRecord(
      state,
      'Team',
      'Demo Member Removed',
      target.name,
      `Removed ${target.name} from simulated workspace directory.`
    );
    commitState({
      team,
      activities: [event, ...state.activities],
    });
    get().addToast('Member removed', `${target.name} removed from demo roster.`, 'warning');
  },

  updateSettings: (partial) => {
    if (!guardPermission('manage_settings')) return;
    const state = get();
    const settings: WorkspaceSettings = {
      ...state.settings,
      ...partial,
      notifications: {
        ...state.settings.notifications,
        ...(partial.notifications || {}),
      },
    };
    const event = createActivityRecord(
      state,
      'Settings',
      'Workspace Settings Saved',
      settings.workspaceName,
      'Updated workspace preferences and display formatting configuration.'
    );
    commitState({
      settings,
      activities: [event, ...state.activities],
    });
    get().addToast('Settings saved', 'Your workspace preferences have been persisted.', 'success');
  },

  resetDemoData: () => {
    if (!guardPermission('manage_backups_and_reset')) return;
    const fresh = generateDeterministicSeedData();
    const saveRes = saveToLocalStorage(fresh);
    const range = defaultCustomRange();
    set({
      seededAt: fresh.seededAt,
      customStartDate: range.start,
      customEndDate: range.end,
      customers: fresh.customers,
      products: fresh.products,
      orders: fresh.orders,
      team: fresh.team,
      activities: sortActivitiesNewestFirst(fresh.activities),
      savedReports: fresh.savedReports,
      reportHistory: fresh.reportHistory,
      dailySessions: fresh.dailySessions,
      settings: fresh.settings,
      datePreset: '30d',
      recoveryAlertMessage: null,
      storageQuotaError: saveRes.ok ? null : saveRes.error || null,
    });
    get().addToast(
      'Demo dataset restored',
      'All records have been reset to the deterministic initial seed.',
      'success'
    );
  },

  importBackupJson: (rawJson) => {
    if (!guardPermission('manage_backups_and_reset')) {
      return {
        ok: false,
        error: getPermissionDeniedMessage(
          get().settings.activeRolePreview,
          'manage_backups_and_reset'
        ),
      };
    }
    const res = validateAndImportBackupJson(rawJson);
    if (!res.ok || !res.data) {
      get().addToast('Backup import failed', res.error || 'Invalid backup file.', 'error');
      return { ok: false, error: res.error };
    }
    const d = res.data;
    set({
      seededAt: d.seededAt,
      customers: d.customers,
      products: d.products,
      orders: d.orders,
      team: d.team,
      activities: sortActivitiesNewestFirst(d.activities),
      savedReports: d.savedReports,
      reportHistory: d.reportHistory,
      dailySessions: d.dailySessions,
      settings: d.settings,
      storageQuotaError: null,
    });
    get().addToast('Backup restored', 'Workspace state imported and validated successfully.', 'success');
    return { ok: true };
  },

  getExportSnapshot: () => {
    return buildSnapshotFromState(get());
  },
  };
});
