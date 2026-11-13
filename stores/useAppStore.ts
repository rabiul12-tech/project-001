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
  REFERENCE_NOW_ISO,
} from '@/lib/demo-data/seed';
import {
  loadFromLocalStorage,
  resetLocalStorageToSeed,
  saveToLocalStorage,
  validateAndImportBackupJson,
} from '@/lib/storage/repository';
import { calculateOrderTotalsFromItems } from '@/lib/calculations/analytics';
import {
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
  dismissRecoveryAlert: () => void;
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
  addCustomer: (values: CustomerFormValues) => Customer;
  updateCustomer: (id: string, values: CustomerFormValues) => void;
  deleteCustomers: (ids: string[]) => void;

  // Product CRUD
  addProduct: (values: ProductFormValues) => Product;
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
  ) => SavedReportConfig;
  deleteReportConfig: (id: string) => void;
  recordGeneratedReport: (
    record: Omit<GeneratedReportRecord, 'id' | 'generatedAt' | 'generatedBy'>
  ) => void;

  // Team CRUD
  addTeamMember: (values: TeamMemberFormValues) => TeamMember;
  updateTeamMember: (id: string, values: Partial<TeamMemberFormValues>) => void;
  removeTeamMember: (id: string) => void;

  // Settings & Data Management
  updateSettings: (partial: Partial<WorkspaceSettings>) => void;
  resetDemoData: () => void;
  importBackupJson: (rawJson: string) => { ok: boolean; error?: string };
  getExportSnapshot: () => AurelixStorageSchema;
}

const initialSeed = generateDeterministicSeedData();

function buildSnapshotFromState(state: AppStoreState): AurelixStorageSchema {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    seededAt: initialSeed.seededAt,
    lastUpdatedAt: new Date().toISOString(),
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
    timestamp: new Date().toISOString(),
    actorName: state.settings.personalName || 'Claire Vance',
    actorRole: state.settings.activeRolePreview || 'Owner',
    category,
    action,
    targetId,
    targetName,
    description,
  };
}

export const useAppStore = create<AppStoreState>((set, get) => ({
  isHydrated: false,
  hydrationStatus: 'seeded',
  recoveryAlertMessage: null,
  storageQuotaError: null,

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
  customStartDate: '2026-10-14',
  customEndDate: '2026-11-13',
  commandPaletteOpen: false,
  mobileNavOpen: false,
  globalSearchQuery: '',
  toasts: [],

  hydrateStore: () => {
    const result = loadFromLocalStorage();
    set({
      isHydrated: true,
      hydrationStatus: result.status,
      recoveryAlertMessage: result.errorMessage || null,
      customers: result.data.customers,
      products: result.data.products,
      orders: result.data.orders,
      team: result.data.team,
      activities: result.data.activities,
      savedReports: result.data.savedReports,
      reportHistory: result.data.reportHistory,
      dailySessions: result.data.dailySessions,
      settings: result.data.settings,
    });
  },

  dismissRecoveryAlert: () => set({ recoveryAlertMessage: null }),

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
    set((state) => {
      const updatedSettings = { ...state.settings, theme };
      const nextState = { ...state, settings: updatedSettings };
      saveToLocalStorage(buildSnapshotFromState(nextState));
      return { settings: updatedSettings };
    });
  },

  toggleTheme: () => {
    const current = get().settings.theme;
    get().setTheme(current === 'dark' ? 'light' : 'dark');
  },

  setSidebarCollapsed: (collapsed) => {
    set((state) => {
      const updatedSettings = { ...state.settings, sidebarCollapsed: collapsed };
      const nextState = { ...state, settings: updatedSettings };
      saveToLocalStorage(buildSnapshotFromState(nextState));
      return { settings: updatedSettings };
    });
  },

  setActiveRolePreview: (role) => {
    set((state) => {
      const updatedSettings = { ...state.settings, activeRolePreview: role };
      const event = createActivityRecord(
        state,
        'Team',
        'Role Preview Switched',
        `Role: ${role}`,
        `Switched interactive demo interface preview to ${role} permissions.`
      );
      const nextActivities = [event, ...state.activities];
      const nextState = { ...state, settings: updatedSettings, activities: nextActivities };
      saveToLocalStorage(buildSnapshotFromState(nextState));
      return { settings: updatedSettings, activities: nextActivities };
    });
    get().addToast(`Role preview set to ${role}`, 'Interface permissions updated for demo preview.', 'default');
  },

  addCustomer: (values) => {
    const state = get();
    const newCustomer: Customer = {
      ...values,
      id: `cust_${Date.now()}`,
      createdAt: new Date(REFERENCE_NOW_ISO).toISOString(),
    };
    const event = createActivityRecord(
      state,
      'Customer',
      'Customer Created',
      newCustomer.company,
      `Added ${newCustomer.name} (${newCustomer.company}) in ${newCustomer.segment} segment.`,
      newCustomer.id
    );
    const customers = [newCustomer, ...state.customers];
    const activities = [event, ...state.activities];
    const saveRes = saveToLocalStorage(
      buildSnapshotFromState({ ...state, customers, activities })
    );
    set({
      customers,
      activities,
      storageQuotaError: saveRes.ok ? null : saveRes.error || null,
    });
    get().addToast('Customer added', `${newCustomer.company} has been saved.`, 'success');
    return newCustomer;
  },

  updateCustomer: (id, values) => {
    const state = get();
    const customers = state.customers.map((c) =>
      c.id === id ? { ...c, ...values } : c
    );
    // Also synchronize customer display name/company/email on existing orders if needed while keeping historical integrity
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
    const activities = [event, ...state.activities];
    const saveRes = saveToLocalStorage(
      buildSnapshotFromState({ ...state, customers, orders, activities })
    );
    set({
      customers,
      orders,
      activities,
      storageQuotaError: saveRes.ok ? null : saveRes.error || null,
    });
    get().addToast('Customer updated', `Changes to ${values.company} saved.`, 'success');
  },

  deleteCustomers: (ids) => {
    const state = get();
    const idSet = new Set(ids);
    const removed = state.customers.filter((c) => idSet.has(c.id));
    const customers = state.customers.filter((c) => !idSet.has(c.id));
    // Referenced orders remain intact with their stored snapshot fields
    const targetLabel =
      removed.length === 1 ? removed[0].company : `${removed.length} customer records`;
    const event = createActivityRecord(
      state,
      'Customer',
      'Customer Removed',
      targetLabel,
      `Deleted ${targetLabel}. Historical order ledger snapshots were preserved.`
    );
    const activities = [event, ...state.activities];
    saveToLocalStorage(buildSnapshotFromState({ ...state, customers, activities }));
    set({ customers, activities });
    get().addToast('Customer deleted', `${targetLabel} removed from directory.`, 'warning');
  },

  addProduct: (values) => {
    const state = get();
    const nowIso = new Date().toISOString();
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
    const products = [newProduct, ...state.products];
    const activities = [event, ...state.activities];
    saveToLocalStorage(buildSnapshotFromState({ ...state, products, activities }));
    set({ products, activities });
    get().addToast('Product created', `${newProduct.name} (${newProduct.sku}) added to catalog.`, 'success');
    return newProduct;
  },

  updateProduct: (id, values) => {
    const state = get();
    const nowIso = new Date().toISOString();
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
    const activities = [event, ...state.activities];
    saveToLocalStorage(buildSnapshotFromState({ ...state, products, activities }));
    set({ products, activities });
    get().addToast('Product updated', `${values.name} catalog details saved.`, 'success');
  },

  archiveProducts: (ids) => {
    const state = get();
    const idSet = new Set(ids);
    const products = state.products.map((p) =>
      idSet.has(p.id) ? { ...p, status: 'Archived' as const, updatedAt: new Date().toISOString() } : p
    );
    const event = createActivityRecord(
      state,
      'Product',
      'Products Archived',
      `${ids.length} SKU(s)`,
      `Archived ${ids.length} product catalog item(s).`
    );
    const activities = [event, ...state.activities];
    saveToLocalStorage(buildSnapshotFromState({ ...state, products, activities }));
    set({ products, activities });
    get().addToast('Products archived', `${ids.length} product(s) marked as Archived.`, 'default');
  },

  createOrder: (values) => {
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
        subtotal: Math.round(quantity * unitPrice * 100) / 100,
      });
    }

    if (lineItems.length === 0) return null;

    const taxRate = Number(values.taxRatePercent) / 100;
    const totals = calculateOrderTotalsFromItems(
      lineItems,
      Number(values.discountAmount) || 0,
      taxRate
    );

    const nextNumber = 20260000 + state.orders.length + 1;
    const newOrder: Order = {
      id: `ord_${Date.now()}`,
      orderNumber: `AUR-${nextNumber}`,
      customerId: customer.id,
      customerName: customer.name,
      customerEmail: customer.email,
      customerCompany: customer.company,
      orderDate: new Date(REFERENCE_NOW_ISO).toISOString(),
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

    // Decrement product stock levels safely
    const products = state.products.map((p) => {
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
    });

    const event = createActivityRecord(
      state,
      'Order',
      'Order Created',
      newOrder.orderNumber,
      `Created order ${newOrder.orderNumber} for ${customer.company} totaling $${newOrder.totalAmount.toLocaleString()}.`,
      newOrder.id
    );

    const orders = [newOrder, ...state.orders];
    const activities = [event, ...state.activities];
    saveToLocalStorage(buildSnapshotFromState({ ...state, orders, products, activities }));
    set({ orders, products, activities });
    get().addToast(
      'Order created',
      `${newOrder.orderNumber} ($${newOrder.totalAmount.toLocaleString()}) recorded.`,
      'success'
    );
    return newOrder;
  },

  updateOrderStatus: (orderId, paymentStatus, fulfillmentStatus) => {
    const state = get();
    const target = state.orders.find((o) => o.id === orderId);
    if (!target) return;

    const orders = state.orders.map((o) => {
      if (o.id !== orderId) return o;
      const refundedAmount =
        paymentStatus === 'Refunded'
          ? o.refundedAmount > 0
            ? o.refundedAmount
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
      'Order Status Updated',
      target.orderNumber,
      `Updated ${target.orderNumber} to Payment: ${paymentStatus}, Fulfillment: ${fulfillmentStatus}.`,
      orderId
    );
    const activities = [event, ...state.activities];
    saveToLocalStorage(buildSnapshotFromState({ ...state, orders, activities }));
    set({ orders, activities });
    get().addToast(
      'Order updated',
      `${target.orderNumber} updated to ${paymentStatus} / ${fulfillmentStatus}.`,
      'success'
    );
  },

  cancelOrder: (orderId) => {
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
    const activities = [event, ...state.activities];
    saveToLocalStorage(buildSnapshotFromState({ ...state, orders, activities }));
    set({ orders, activities });
    get().addToast('Order canceled', `${target.orderNumber} has been marked as Canceled.`, 'warning');
  },

  refundOrder: (orderId, refundAmount) => {
    const state = get();
    const target = state.orders.find((o) => o.id === orderId);
    if (!target) return;

    const finalRefund =
      refundAmount !== undefined
        ? Math.min(target.totalAmount, Math.max(0.01, refundAmount))
        : target.totalAmount;

    const orders = state.orders.map((o) =>
      o.id === orderId
        ? {
            ...o,
            paymentStatus: 'Refunded' as const,
            refundedAmount: Math.round(finalRefund * 100) / 100,
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
    const activities = [event, ...state.activities];
    saveToLocalStorage(buildSnapshotFromState({ ...state, orders, activities }));
    set({ orders, activities });
    get().addToast(
      'Simulated refund processed',
      `Refund of $${finalRefund.toLocaleString()} recorded on ${target.orderNumber}.`,
      'warning'
    );
  },

  bulkUpdateOrderStatus: (orderIds, paymentStatus, fulfillmentStatus) => {
    const state = get();
    const idSet = new Set(orderIds);
    const orders = state.orders.map((o) => {
      if (!idSet.has(o.id)) return o;
      return {
        ...o,
        paymentStatus,
        fulfillmentStatus,
        refundedAmount: paymentStatus === 'Refunded' ? o.totalAmount : 0,
      };
    });
    const event = createActivityRecord(
      state,
      'Order',
      'Bulk Order Update',
      `${orderIds.length} Orders`,
      `Updated ${orderIds.length} orders to ${paymentStatus} / ${fulfillmentStatus}.`
    );
    const activities = [event, ...state.activities];
    saveToLocalStorage(buildSnapshotFromState({ ...state, orders, activities }));
    set({ orders, activities });
    get().addToast('Bulk update complete', `Updated ${orderIds.length} order records.`, 'success');
  },

  saveReportConfig: (config) => {
    const state = get();
    const nowIso = new Date().toISOString();
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
    const activities = [event, ...state.activities];
    saveToLocalStorage(buildSnapshotFromState({ ...state, savedReports, activities }));
    set({ savedReports, activities });
    get().addToast('Report configuration saved', `"${newConfig.name}" added to templates.`, 'success');
    return newConfig;
  },

  deleteReportConfig: (id) => {
    const state = get();
    const target = state.savedReports.find((r) => r.id === id);
    const savedReports = state.savedReports.filter((r) => r.id !== id);
    saveToLocalStorage(buildSnapshotFromState({ ...state, savedReports }));
    set({ savedReports });
    get().addToast('Report removed', target ? `"${target.name}" deleted.` : 'Report deleted.', 'default');
  },

  recordGeneratedReport: (record) => {
    const state = get();
    const newRecord: GeneratedReportRecord = {
      ...record,
      id: `rep_hist_${Date.now()}`,
      generatedAt: new Date().toISOString(),
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
    const activities = [event, ...state.activities];
    saveToLocalStorage(buildSnapshotFromState({ ...state, reportHistory, activities }));
    set({ reportHistory, activities });
  },

  addTeamMember: (values) => {
    const state = get();
    const nowIso = new Date().toISOString();
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
    const activities = [event, ...state.activities];
    saveToLocalStorage(buildSnapshotFromState({ ...state, team, activities }));
    set({ team, activities });
    get().addToast('Demo team member added', `${newMember.name} added as ${newMember.role}.`, 'success');
    return newMember;
  },

  updateTeamMember: (id, values) => {
    const state = get();
    const target = state.team.find((m) => m.id === id);
    const team = state.team.map((m) => (m.id === id ? { ...m, ...values } : m));
    const event = createActivityRecord(
      state,
      'Team',
      'Demo Member Updated',
      target?.name || 'Team Member',
      `Updated profile or role assignment for ${target?.name || id}.`,
      id
    );
    const activities = [event, ...state.activities];
    saveToLocalStorage(buildSnapshotFromState({ ...state, team, activities }));
    set({ team, activities });
    get().addToast('Team member updated', 'Demo profile changes saved.', 'success');
  },

  removeTeamMember: (id) => {
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
    const activities = [event, ...state.activities];
    saveToLocalStorage(buildSnapshotFromState({ ...state, team, activities }));
    set({ team, activities });
    get().addToast('Member removed', `${target.name} removed from demo roster.`, 'warning');
  },

  updateSettings: (partial) => {
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
    const activities = [event, ...state.activities];
    saveToLocalStorage(buildSnapshotFromState({ ...state, settings, activities }));
    set({ settings, activities });
    get().addToast('Settings saved', 'Your workspace preferences have been persisted.', 'success');
  },

  resetDemoData: () => {
    const fresh = resetLocalStorageToSeed();
    set({
      customers: fresh.customers,
      products: fresh.products,
      orders: fresh.orders,
      team: fresh.team,
      activities: fresh.activities,
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
    const res = validateAndImportBackupJson(rawJson);
    if (!res.ok || !res.data) {
      get().addToast('Backup import failed', res.error || 'Invalid backup file.', 'error');
      return { ok: false, error: res.error };
    }
    const d = res.data;
    set({
      customers: d.customers,
      products: d.products,
      orders: d.orders,
      team: d.team,
      activities: d.activities,
      savedReports: d.savedReports,
      reportHistory: d.reportHistory,
      dailySessions: d.dailySessions,
      settings: d.settings,
    });
    get().addToast('Backup restored', 'Workspace state imported and validated successfully.', 'success');
    return { ok: true };
  },

  getExportSnapshot: () => {
    return buildSnapshotFromState(get());
  },
}));
