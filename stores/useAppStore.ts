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
  type StorageLoadResult,
  type StorageWriteResult,
  validateAndImportBackupJson,
} from '@/lib/storage/repository';
import {
  calculateOrderTotalsFromItems,
  fromCents,
  toCents,
} from '@/lib/calculations/analytics';
import { canRefundOrder, getOrderTransitionError } from '@/lib/orders';
import {
  canPerformAction,
  getPermissionDeniedMessage,
  PermissionAction,
} from '@/lib/permissions';
import {
  backupStorageSchema,
  createOrderFormSchema,
  productFormSchema,
  CreateOrderFormValues,
  CustomerFormValues,
  ProductFormValues,
  TeamMemberFormValues,
  isMinorUnitAmount,
} from '@/lib/validation/schemas';

interface AppStoreState {
  isHydrated: boolean;
  hydrationStatus: StorageLoadResult['status'];
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
  selectDemoPersona: (memberId: string) => boolean;

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
  cancelOrder: (orderId: string) => boolean;
  refundOrder: (orderId: string, refundAmount?: number) => boolean;
  bulkUpdateOrderStatus: (
    orderIds: string[],
    paymentStatus: PaymentStatus,
    fulfillmentStatus: FulfillmentStatus
  ) => boolean;

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
  updateSettings: (partial: Omit<Partial<WorkspaceSettings>, 'notifications'> & {
    notifications?: Partial<WorkspaceSettings['notifications']>;
  }) => StorageWriteResult;
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

function updateStock(product: Product, stockLevel: number): Product {
  return {
    ...product,
    stockLevel,
    status: product.status === 'Archived' ? 'Archived' : stockLevel <= 14 ? 'Low Stock' : 'Active',
  };
}

function applyOrderTransition(
  order: Order,
  products: Product[],
  paymentStatus: PaymentStatus,
  fulfillmentStatus: FulfillmentStatus
): { order: Order; products: Product[] } | { error: string } {
  const error = getOrderTransitionError(order, paymentStatus, fulfillmentStatus);
  if (error) return { error };
  if (order.paymentStatus === paymentStatus && order.fulfillmentStatus === fulfillmentStatus) {
    return { order, products };
  }
  const updated = {
    ...order,
    paymentStatus: fulfillmentStatus === 'Canceled' && paymentStatus === 'Pending'
      ? 'Failed' as const
      : paymentStatus,
    fulfillmentStatus,
  };
  const shouldRelease = (order.fulfillmentStatus === 'Processing' || order.fulfillmentStatus === 'Scheduled') &&
    (updated.fulfillmentStatus === 'Canceled' || updated.paymentStatus === 'Failed');
  if (!shouldRelease || !order.stockDebits?.length) return { order: updated, products };

  const returned = new Map(order.stockDebits.map(({ productId, quantity }) => [productId, quantity]));
  if (products.some((product) => product.stockLevel + (returned.get(product.id) ?? 0) > 100000)) {
    return { error: 'Returning reserved units would exceed the stock limit. Adjust inventory before retrying.' };
  }
  return {
    order: { ...updated, stockDebits: [] },
    products: products.map((product) => {
      const units = returned.get(product.id);
      return units ? updateStock(product, product.stockLevel + units) : product;
    }),
  };
}

export const useAppStore = create<AppStoreState>((set, get) => {
  // Compare the exact loaded bytes, including when two writes share a timestamp.
  let workspaceRevision: string | null | undefined;

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

  const handleWriteFailure = (result: StorageWriteResult) => {
    if (result.conflict) get().syncFromExternalStorage();
    const message = result.error ?? 'Changes could not be saved to LocalStorage.';
    set({ storageQuotaError: message });
    get().addToast('Storage persistence error', message, 'error');
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
    const saveRes = saveToLocalStorage(buildSnapshotFromState(nextState), workspaceRevision);
    if (!saveRes.ok) {
      handleWriteFailure(saveRes);
      return saveRes;
    }
    workspaceRevision = saveRes.revision;
    set({ ...patch, activities: normalizedActivities, storageQuotaError: null });
    return saveRes;
  };

  const changeOrderStatus = (
    orderId: string, paymentStatus: PaymentStatus, fulfillmentStatus: FulfillmentStatus
  ): boolean => {
    if (!guardPermission('mutate_orders')) return false;
    const state = get();
    const target = state.orders.find((order) => order.id === orderId);
    if (!target) return false;

    const changed = applyOrderTransition(target, state.products, paymentStatus, fulfillmentStatus);
    if ('error' in changed) {
      state.addToast('Order update unavailable', changed.error, 'warning');
      return false;
    }
    if (changed.order === target) return true;

    const canceled = changed.order.fulfillmentStatus === 'Canceled';
    const detail = `${changed.order.paymentStatus} / ${changed.order.fulfillmentStatus}`;
    const event = createActivityRecord(
      state, 'Order', canceled ? 'Order Canceled' : 'Order Status Updated',
      target.orderNumber, `Updated ${target.orderNumber} to ${detail}.`, orderId
    );
    if (!commitState({
      orders: state.orders.map((order) => order.id === orderId ? changed.order : order),
      products: changed.products,
      activities: [event, ...state.activities],
    }).ok) return false;

    state.addToast(canceled ? 'Order canceled' : 'Order updated', `${target.orderNumber} updated to ${detail}.`, 'success');
    return true;
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
    workspaceRevision = result.revision ?? null;
    const range = defaultCustomRange();
    set({
      isHydrated: true,
      seededAt: result.data.seededAt,
      customStartDate: range.start,
      customEndDate: range.end,
      hydrationStatus: result.status,
      recoveryAlertMessage: result.errorMessage || null,
      storageQuotaError: result.persistenceError || null,
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
      if (!rawJson || rawJson === workspaceRevision) return;
      const parsed = JSON.parse(rawJson);
      const check = backupStorageSchema.safeParse(parsed);
      if (!check.success) return;
      if (parsed.schemaVersion > CURRENT_SCHEMA_VERSION) return;
      const d = check.data;
      workspaceRevision = rawJson;
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
      });
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
    if (!commitState({
      settings: updatedSettings,
      activities: [event, ...state.activities],
    }).ok) return;
    get().addToast(`Role preview set to ${role}`, 'Interface permissions updated for demo preview.', 'default');
  },

  selectDemoPersona: (memberId) => {
    const state = get();
    const member = state.team.find(({ id }) => id === memberId);
    if (!member) {
      state.addToast('Demo persona unavailable', 'Choose a profile from the current team roster.', 'warning');
      return false;
    }
    const settings: WorkspaceSettings = {
      ...state.settings,
      personalName: member.name,
      personalEmail: member.email,
      personalTitle: member.title,
      activeRolePreview: member.role,
    };
    const event = createActivityRecord(
      state,
      'Team',
      'Demo Persona Selected',
      member.name,
      `Entered the workspace as ${member.name} (${member.role}).`,
      member.id
    );
    return commitState({ settings, activities: [event, ...state.activities] }).ok;
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
    if (!commitState({
      customers: [newCustomer, ...state.customers],
      activities: [event, ...state.activities],
    }).ok) return null;
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
    if (!commitState({
      customers,
      orders,
      activities: [event, ...state.activities],
    }).ok) return;
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
    if (!commitState({
      customers,
      activities: [event, ...state.activities],
    }).ok) return;
    get().addToast('Customer deleted', `${targetLabel} removed from directory.`, 'warning');
  },

  addProduct: (values) => {
    if (!guardPermission('mutate_products')) return null;
    const parsed = productFormSchema.safeParse(values);
    if (!parsed.success) {
      get().addToast('Invalid product', parsed.error.issues[0]?.message, 'error');
      return null;
    }
    const state = get();
    const nowIso = clockNowIso();
    const prefix = values.sku.slice(0, 3).toUpperCase() || 'ENT';
    const newProduct: Product = {
      ...parsed.data,
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
    if (!commitState({
      products: [newProduct, ...state.products],
      activities: [event, ...state.activities],
    }).ok) return null;
    get().addToast('Product created', `${newProduct.name} (${newProduct.sku}) added to catalog.`, 'success');
    return newProduct;
  },

  updateProduct: (id, values) => {
    if (!guardPermission('mutate_products')) return;
    const parsed = productFormSchema.safeParse(values);
    if (!parsed.success) {
      get().addToast('Invalid product', parsed.error.issues[0]?.message, 'error');
      return;
    }
    const state = get();
    const nowIso = clockNowIso();
    // Crucial requirement: updating a product's unitPrice does NOT mutate historical order line items
    const products = state.products.map((p) =>
      p.id === id ? { ...p, ...parsed.data, updatedAt: nowIso } : p
    );
    const event = createActivityRecord(
      state,
      'Product',
      'Product Updated',
      values.name,
      `Updated catalog SKU ${values.sku} (New unit price: $${values.unitPrice.toLocaleString()}). Historical orders retain original price.`,
      id
    );
    if (!commitState({
      products,
      activities: [event, ...state.activities],
    }).ok) return;
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
    if (!commitState({
      products,
      activities: [event, ...state.activities],
    }).ok) return;
    get().addToast('Products archived', `${ids.length} product(s) marked as Archived.`, 'default');
  },

  createOrder: (values) => {
    if (!guardPermission('mutate_orders')) return null;
    const state = get();
    const parsed = createOrderFormSchema.safeParse(values);
    if (!parsed.success || parsed.data.paymentStatus === 'Refunded') {
      state.addToast('Order unavailable', parsed.error?.issues[0].message ??
        'Create a paid order before recording a refund.', 'warning');
      return null;
    }
    const draft = parsed.data;
    const customer = state.customers.find((candidate) => candidate.id === draft.customerId);
    if (!customer) return null;

    const lineItems: OrderLineItem[] = [];
    const quantities = new Map<string, number>();
    for (const item of draft.items) {
      const product = state.products.find((candidate) => candidate.id === item.productId);
      if (!product || product.status === 'Archived') {
        state.addToast(
          'Order unavailable',
          product ? `${product.sku} is archived. Select an available product.` : 'A selected product is no longer in the catalog.',
          'warning'
        );
        return null;
      }
      const unitPrice = fromCents(toCents(product.unitPrice));
      quantities.set(product.id, (quantities.get(product.id) ?? 0) + item.quantity);
      lineItems.push({
        id: `li_${Date.now()}_${lineItems.length}`,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        category: product.category,
        quantity: item.quantity,
        unitPrice,
        subtotal: fromCents(item.quantity * toCents(unitPrice)),
      });
    }

    const taxRate = draft.taxRatePercent / 100;
    const totals = calculateOrderTotalsFromItems(lineItems, draft.discountAmount, taxRate);
    const orderNumber = generateNextOrderNumber(state.orders);
    const stockDebits: NonNullable<Order['stockDebits']> = [];
    const products = draft.paymentStatus !== 'Failed' && draft.fulfillmentStatus !== 'Canceled'
      ? state.products.map((product) => {
          const quantity = Math.min(product.stockLevel, quantities.get(product.id) ?? 0);
          if (!quantity) return product;
          stockDebits.push({ productId: product.id, quantity });
          return updateStock(product, product.stockLevel - quantity);
        })
      : state.products;

    const newOrder: Order = {
      id: `ord_${Date.now()}_${orderNumber}`,
      orderNumber,
      customerId: customer.id,
      customerName: customer.name,
      customerEmail: customer.email,
      customerCompany: customer.company,
      orderDate: clockNowIso(),
      lineItems,
      ...totals,
      taxRate,
      refundedAmount: 0,
      stockDebits,
      paymentStatus: draft.fulfillmentStatus === 'Canceled' && draft.paymentStatus === 'Pending'
        ? 'Failed'
        : draft.paymentStatus,
      fulfillmentStatus: draft.fulfillmentStatus,
      salesChannel: draft.salesChannel,
      notes: draft.notes,
    };

    const event = createActivityRecord(
      state, 'Order', 'Order Created', newOrder.orderNumber,
      `Created order ${newOrder.orderNumber} for ${customer.company} totaling $${newOrder.totalAmount.toLocaleString()}.`,
      newOrder.id
    );
    if (!commitState({
      orders: [newOrder, ...state.orders],
      products,
      activities: [event, ...state.activities],
    }).ok) return null;

    state.addToast('Order created', `${newOrder.orderNumber} ($${newOrder.totalAmount.toLocaleString()}) recorded.`, 'success');
    return newOrder;
  },

  updateOrderStatus: changeOrderStatus,

  cancelOrder: (orderId) => {
    const order = get().orders.find((candidate) => candidate.id === orderId);
    return order ? changeOrderStatus(orderId, order.paymentStatus, 'Canceled') : false;
  },

  refundOrder: (orderId, refundAmount) => {
    if (!guardPermission('issue_refund')) return false;
    const state = get();
    const target = state.orders.find((order) => order.id === orderId);
    if (!target || !canRefundOrder(target)) {
      state.addToast('Refund unavailable', 'Only a paid, non-canceled order with no recorded refund can be refunded.', 'warning');
      return false;
    }

    const amount = refundAmount ?? target.totalAmount;
    if (!isMinorUnitAmount(amount) || amount <= 0 || toCents(amount) > toCents(target.totalAmount)) {
      state.addToast('Invalid refund amount', 'Enter an amount in cents between $0.01 and the order total.', 'warning');
      return false;
    }

    const orders = state.orders.map((order) => order.id === orderId
      ? { ...order, paymentStatus: 'Refunded' as const, refundedAmount: amount }
      : order
    );
    const event = createActivityRecord(
      state, 'Order', 'Simulated Refund Issued', target.orderNumber,
      `Simulated refund of $${amount.toLocaleString()} for ${target.orderNumber} (${target.customerCompany}).`,
      orderId
    );
    if (!commitState({ orders, activities: [event, ...state.activities] }).ok) return false;
    state.addToast('Simulated refund processed', `Refund of $${amount.toLocaleString()} recorded on ${target.orderNumber}.`, 'warning');
    return true;
  },

  bulkUpdateOrderStatus: (orderIds, paymentStatus, fulfillmentStatus) => {
    if (!guardPermission('mutate_orders')) return false;
    const state = get();
    const selected = new Set(orderIds);
    const orders = [...state.orders];
    let products = state.products;
    let updatedCount = 0;
    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      if (!selected.has(order.id)) continue;
      const changed = applyOrderTransition(order, products, paymentStatus, fulfillmentStatus);
      if ('error' in changed) {
        state.addToast('Bulk update unavailable', `${order.orderNumber}: ${changed.error}`, 'warning');
        return false;
      }
      orders[i] = changed.order;
      products = changed.products;
      if (changed.order !== order) updatedCount++;
    }
    if (!updatedCount) return true;
    const event = createActivityRecord(
      state, 'Order', 'Bulk Order Update', `${updatedCount} Orders`,
      `Updated ${updatedCount} orders to ${paymentStatus} / ${fulfillmentStatus}.`
    );
    if (!commitState({ orders, products, activities: [event, ...state.activities] }).ok) return false;
    state.addToast('Bulk update complete', `Updated ${updatedCount} order records.`, 'success');
    return true;
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
    if (!commitState({
      savedReports,
      activities: [event, ...state.activities],
    }).ok) return null;
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
    if (!commitState({
      savedReports,
      activities: [event, ...state.activities],
    }).ok) return;
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
    if (!commitState({
      team,
      activities: [event, ...state.activities],
    }).ok) return null;
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
    if (!commitState({
      team,
      activities: [event, ...state.activities],
    }).ok) return;
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
    if (!commitState({
      team,
      activities: [event, ...state.activities],
    }).ok) return;
    get().addToast('Member removed', `${target.name} removed from demo roster.`, 'warning');
  },

  updateSettings: (partial) => {
    if (!guardPermission('manage_settings')) {
      return { ok: false, error: getPermissionDeniedMessage(get().settings.activeRolePreview, 'manage_settings') };
    }
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
    const result = commitState({
      settings,
      activities: [event, ...state.activities],
    });
    if (result.ok) get().addToast('Settings saved', 'Your workspace preferences have been persisted.', 'success');
    return { ok: result.ok, error: result.error, conflict: result.conflict };
  },

  resetDemoData: () => {
    if (!guardPermission('manage_backups_and_reset')) return;
    const fresh = generateDeterministicSeedData();
    const saveRes = saveToLocalStorage(fresh, workspaceRevision);
    if (!saveRes.ok) {
      handleWriteFailure(saveRes);
      return;
    }
    workspaceRevision = saveRes.revision;
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
      storageQuotaError: null,
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
    const res = validateAndImportBackupJson(rawJson, workspaceRevision);
    if (!res.ok || !res.data) {
      if (res.conflict) get().syncFromExternalStorage();
      get().addToast('Backup import failed', res.error || 'Invalid backup file.', 'error');
      return { ok: false, error: res.error };
    }
    const d = res.data;
    workspaceRevision = res.revision;
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
