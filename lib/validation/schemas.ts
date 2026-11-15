import { z } from 'zod';

export const customerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2, 'Customer name must be at least 2 characters').max(80),
  company: z.string().min(2, 'Company name must be at least 2 characters').max(100),
  email: z.string().email('Enter a valid corporate email address'),
  phone: z.string().min(7, 'Enter a valid phone number').max(30),
  segment: z.enum(['Enterprise', 'Mid-Market', 'SMB', 'Startup']),
  status: z.enum(['Active', 'At Risk', 'Churned', 'Onboarding']),
  country: z.string().min(2, 'Country is required'),
  createdAt: z.string(),
  notes: z.string().optional(),
});

export const customerFormSchema = customerSchema.omit({
  id: true,
  createdAt: true,
});

export type CustomerFormValues = z.infer<typeof customerFormSchema>;

export const productSchema = z.object({
  id: z.string().min(1),
  sku: z.string().min(3, 'SKU must be at least 3 characters').max(32),
  name: z.string().min(2, 'Product name must be at least 2 characters').max(100),
  category: z.enum([
    'Enterprise Software',
    'Cloud Infrastructure',
    'Data Intelligence',
    'Security & Compliance',
    'API & Integrations',
    'Advisory Retainer',
  ]),
  unitPrice: z.number().positive('Unit price must be greater than 0').max(1000000),
  costPrice: z.number().nonnegative('Cost price cannot be negative').max(1000000),
  stockLevel: z.number().int().nonnegative('Stock level cannot be negative').max(100000),
  status: z.enum(['Active', 'Low Stock', 'Archived']),
  description: z.string().min(5, 'Description must be at least 5 characters').max(400),
  imageCode: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const productFormSchema = productSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  imageCode: true,
});

export type ProductFormValues = z.infer<typeof productFormSchema>;

export const orderLineItemSchema = z.object({
  id: z.string().min(1),
  productId: z.string().min(1, 'Product is required'),
  productName: z.string().min(1),
  sku: z.string().min(1),
  category: z.enum([
    'Enterprise Software',
    'Cloud Infrastructure',
    'Data Intelligence',
    'Security & Compliance',
    'API & Integrations',
    'Advisory Retainer',
  ]),
  quantity: z.coerce.number().int().positive('Quantity must be at least 1').max(10000),
  unitPrice: z.coerce.number().nonnegative(),
  subtotal: z.coerce.number().nonnegative(),
});

export const orderSchema = z
  .object({
    id: z.string().min(1),
    orderNumber: z.string().min(1),
    customerId: z.string().min(1, 'Customer is required'),
    customerName: z.string().min(1),
    customerEmail: z.string().email(),
    customerCompany: z.string().min(1),
    orderDate: z.string().min(1),
    lineItems: z.array(orderLineItemSchema).min(1, 'At least one line item is required'),
    subtotal: z.number().nonnegative(),
    discountAmount: z.number().nonnegative(),
    taxRate: z.number().min(0).max(0.5),
    taxAmount: z.number().nonnegative(),
    totalAmount: z.number().nonnegative(),
    refundedAmount: z.number().nonnegative(),
    paymentStatus: z.enum(['Paid', 'Pending', 'Refunded', 'Failed']),
    fulfillmentStatus: z.enum(['Fulfilled', 'Processing', 'Scheduled', 'Canceled']),
    salesChannel: z.enum([
      'Direct Enterprise',
      'Self-Serve Web',
      'Partner Channel',
      'Marketplace',
    ]),
    notes: z.string().optional(),
  })
  .refine((o) => o.refundedAmount <= Math.round((o.totalAmount + 0.01) * 100) / 100, {
    message: 'Refunded amount cannot exceed order total',
    path: ['refundedAmount'],
  });

export const createOrderFormSchema = z.object({
  customerId: z.string().min(1, 'Please select a customer'),
  salesChannel: z.enum([
    'Direct Enterprise',
    'Self-Serve Web',
    'Partner Channel',
    'Marketplace',
  ]),
  paymentStatus: z.enum(['Paid', 'Pending', 'Refunded', 'Failed']),
  fulfillmentStatus: z.enum(['Fulfilled', 'Processing', 'Scheduled', 'Canceled']),
  discountAmount: z.coerce.number().nonnegative('Discount cannot be negative').default(0),
  taxRatePercent: z.coerce.number().min(0).max(30, 'Tax rate cannot exceed 30%').default(8.5),
  notes: z.string().max(300).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, 'Select a product'),
        quantity: z.coerce.number().int().min(1, 'Min quantity is 1').max(500),
      })
    )
    .min(1, 'Add at least one product line item'),
});

export type CreateOrderFormValues = z.infer<typeof createOrderFormSchema>;

export const teamMemberFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().email('Enter a valid corporate email address'),
  role: z.enum(['Owner', 'Admin', 'Analyst', 'Viewer']),
  title: z.string().min(2, 'Job title is required').max(80),
  department: z.string().min(2, 'Department is required').max(60),
});

export type TeamMemberFormValues = z.infer<typeof teamMemberFormSchema>;

export const workspaceSettingsSchema = z.object({
  personalName: z.string().min(2, 'Name is required').max(80),
  personalEmail: z.string().email('Valid email is required'),
  personalTitle: z.string().min(2, 'Role title is required').max(80),
  workspaceName: z.string().min(2, 'Workspace name is required').max(80),
  companyDomain: z.string().min(3, 'Company domain is required').max(100),
  companyLogoText: z.string().min(1, 'Logo monogram is required').max(12),
  currency: z.enum(['USD', 'EUR', 'GBP', 'CAD', 'AUD']),
  language: z.enum(['English (US)', 'English (UK)', 'Deutsch', 'Français']),
  dateFormat: z.enum(['MMM d, yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd']),
  numberFormat: z.enum(['en-US', 'de-DE', 'en-GB']),
  theme: z.enum(['light', 'dark']),
  sidebarCollapsed: z.boolean(),
  activeRolePreview: z.enum(['Owner', 'Admin', 'Analyst', 'Viewer']),
  notifications: z.object({
    highValueOrders: z.boolean(),
    refundAlerts: z.boolean(),
    lowInventoryWarnings: z.boolean(),
    weeklyDigest: z.boolean(),
  }),
});

export const savedReportSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['Sales Summary', 'Revenue Ledger', 'Customer Cohort', 'Product Velocity']),
  dateRangePreset: z.enum(['7d', '30d', '90d', '6m', '12m', 'all', 'custom']),
  customStartDate: z.string().optional(),
  customEndDate: z.string().optional(),
  channelFilter: z.enum([
    'All',
    'Direct Enterprise',
    'Self-Serve Web',
    'Partner Channel',
    'Marketplace',
  ]),
  categoryFilter: z.enum([
    'All',
    'Enterprise Software',
    'Cloud Infrastructure',
    'Data Intelligence',
    'Security & Compliance',
    'API & Integrations',
    'Advisory Retainer',
  ]),
  paymentStatusFilter: z.enum(['All', 'Paid', 'Pending', 'Refunded', 'Failed']),
  createdAt: z.string(),
  lastGeneratedAt: z.string(),
  createdBy: z.string().min(1),
});

export const reportHistorySchema = z.object({
  id: z.string().min(1),
  reportName: z.string().min(1),
  type: z.enum(['Sales Summary', 'Revenue Ledger', 'Customer Cohort', 'Product Velocity']),
  generatedAt: z.string(),
  generatedBy: z.string().min(1),
  rowCount: z.number().int().nonnegative(),
  totalRevenueReported: z.number().nonnegative(),
  format: z.enum(['CSV', 'JSON', 'Print']),
});

export const dailySessionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sessions: z.number().int().nonnegative(),
  uniqueVisitors: z.number().int().nonnegative(),
  demoRequests: z.number().int().nonnegative(),
  cartInitiated: z.number().int().nonnegative(),
});

export const backupStorageSchema = z.object({
  schemaVersion: z.number().int().positive(),
  seededAt: z.string(),
  lastUpdatedAt: z.string(),
  customers: z.array(customerSchema).min(1, 'Backup must include at least one customer'),
  products: z.array(productSchema).min(1, 'Backup must include at least one product'),
  orders: z.array(orderSchema),
  team: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      email: z.string().email(),
      role: z.enum(['Owner', 'Admin', 'Analyst', 'Viewer']),
      title: z.string(),
      department: z.string(),
      avatarUrl: z.string(),
      status: z.enum(['Active', 'Invited']),
      joinedAt: z.string(),
      lastActiveAt: z.string(),
    })
  ),
  activities: z.array(
    z.object({
      id: z.string(),
      timestamp: z.string(),
      actorName: z.string(),
      actorRole: z.enum(['Owner', 'Admin', 'Analyst', 'Viewer']),
      category: z.enum(['Order', 'Customer', 'Product', 'Report', 'Settings', 'Team', 'System']),
      action: z.string(),
      targetId: z.string().optional(),
      targetName: z.string(),
      description: z.string(),
      metadata: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
    })
  ),
  savedReports: z.array(savedReportSchema).optional().default([]),
  reportHistory: z.array(reportHistorySchema).optional().default([]),
  dailySessions: z.array(dailySessionSchema).optional().default([]),
  settings: workspaceSettingsSchema,
});
