export type CustomerSegment = 'Enterprise' | 'Mid-Market' | 'SMB' | 'Startup';
export type CustomerStatus = 'Active' | 'At Risk' | 'Churned' | 'Onboarding';

export interface Customer {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  segment: CustomerSegment;
  status: CustomerStatus;
  country: string;
  createdAt: string; // ISO date string
  notes?: string;
}

export type ProductCategory =
  | 'Enterprise Software'
  | 'Cloud Infrastructure'
  | 'Data Intelligence'
  | 'Security & Compliance'
  | 'API & Integrations'
  | 'Advisory Retainer';

export type ProductStatus = 'Active' | 'Low Stock' | 'Archived';

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: ProductCategory;
  unitPrice: number;
  costPrice: number;
  stockLevel: number;
  status: ProductStatus;
  description: string;
  imageCode: string; // Deterministic visual identifier for SVG product artwork
  createdAt: string;
  updatedAt: string;
}

export type PaymentStatus = 'Paid' | 'Pending' | 'Refunded' | 'Failed';
export type FulfillmentStatus = 'Fulfilled' | 'Processing' | 'Scheduled' | 'Canceled';
export type SalesChannel = 'Direct Enterprise' | 'Self-Serve Web' | 'Partner Channel' | 'Marketplace';

export interface OrderLineItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  category?: ProductCategory | null; // Older backups may lack a recorded category.
  quantity: number;
  unitPrice: number; // Locked historical price at time of order
  subtotal: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerCompany: string;
  orderDate: string; // ISO date string
  lineItems: OrderLineItem[];
  subtotal: number;
  discountAmount: number;
  taxRate: number; // e.g. 0.085 for 8.5%
  taxAmount: number;
  totalAmount: number;
  refundedAmount: number;
  stockDebits?: Array<{ productId: string; quantity: number }>;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  salesChannel: SalesChannel;
  notes?: string;
}

export type TeamRole = 'Owner' | 'Admin' | 'Analyst' | 'Viewer';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  title: string;
  department: string;
  avatarUrl: string;
  status: 'Active' | 'Invited';
  joinedAt: string;
  lastActiveAt: string;
}

export type ActivityCategory =
  | 'Order'
  | 'Customer'
  | 'Product'
  | 'Report'
  | 'Settings'
  | 'Team'
  | 'System';

export interface ActivityEvent {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: TeamRole;
  category: ActivityCategory;
  action: string;
  targetId?: string;
  targetName: string;
  description: string;
  metadata?: Record<string, string | number>;
}

export type ReportType = 'Sales Summary' | 'Revenue Ledger' | 'Customer Cohort' | 'Product Velocity';

export interface SavedReportConfig {
  id: string;
  name: string;
  type: ReportType;
  dateRangePreset: DateRangePreset;
  customStartDate?: string;
  customEndDate?: string;
  channelFilter: SalesChannel | 'All';
  categoryFilter: ProductCategory | 'All';
  paymentStatusFilter: PaymentStatus | 'All';
  createdAt: string;
  lastGeneratedAt: string;
  createdBy: string;
}

export interface GeneratedReportRecord {
  id: string;
  reportName: string;
  type: ReportType;
  generatedAt: string;
  generatedBy: string;
  rowCount: number;
  totalRevenueReported: number;
  format: 'CSV' | 'JSON' | 'Print';
}

export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD';
export type DateFormatOption = 'MMM d, yyyy' | 'dd/MM/yyyy' | 'yyyy-MM-dd';
export type NumberFormatOption = 'en-US' | 'de-DE' | 'en-GB';
export type ThemeMode = 'light' | 'dark';

export interface WorkspaceSettings {
  personalName: string;
  personalEmail: string;
  personalTitle: string;
  workspaceName: string;
  companyDomain: string;
  companyLogoText: string;
  currency: CurrencyCode;
  language: 'English (US)' | 'English (UK)' | 'Deutsch' | 'Français';
  dateFormat: DateFormatOption;
  numberFormat: NumberFormatOption;
  theme: ThemeMode;
  sidebarCollapsed: boolean;
  activeRolePreview: TeamRole;
  notifications: {
    highValueOrders: boolean;
    refundAlerts: boolean;
    lowInventoryWarnings: boolean;
    weeklyDigest: boolean;
  };
}

export interface DailySessionMetric {
  date: string; // YYYY-MM-DD
  sessions: number;
  uniqueVisitors: number;
  demoRequests: number;
  cartInitiated: number;
}

export type DateRangePreset = '7d' | '30d' | '90d' | '6m' | '12m' | 'all' | 'custom';

export interface DateRangeFilter {
  preset: DateRangePreset;
  startDate: string; // ISO string
  endDate: string; // ISO string
}

export interface AurelixStorageSchema {
  schemaVersion: number;
  seededAt: string;
  lastUpdatedAt: string;
  customers: Customer[];
  products: Product[];
  orders: Order[];
  team: TeamMember[];
  activities: ActivityEvent[];
  savedReports: SavedReportConfig[];
  reportHistory: GeneratedReportRecord[];
  dailySessions: DailySessionMetric[];
  settings: WorkspaceSettings;
}

export interface ToastNotification {
  id: string;
  title: string;
  description?: string;
  variant: 'default' | 'success' | 'warning' | 'error';
  createdAt: number;
}
