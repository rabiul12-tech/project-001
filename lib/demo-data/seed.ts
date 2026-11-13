import {
  AurelixStorageSchema,
  Customer,
  CustomerSegment,
  CustomerStatus,
  Product,
  ProductCategory,
  ProductStatus,
  Order,
  OrderLineItem,
  PaymentStatus,
  FulfillmentStatus,
  SalesChannel,
  TeamMember,
  ActivityEvent,
  SavedReportConfig,
  GeneratedReportRecord,
  DailySessionMetric,
  WorkspaceSettings,
} from '@/types';

export const CURRENT_SCHEMA_VERSION = 1;
export const REFERENCE_NOW_ISO = '2026-11-13T10:00:00.000Z';

// Mulberry32 deterministic PRNG
function createRng(seed: number) {
  let a = seed;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_NAMES = [
  'Evelyn', 'Marcus', 'Clara', 'Julian', 'Soren', 'Elena', 'Arthur', 'Nadia',
  'Victor', 'camille', 'Henrik', 'Mireille', 'Sebastian', 'Tessa', 'Damian', 'Lydia',
  'Gideon', 'Astrid', 'Dominic', 'Freya', 'Alistair', 'Celeste', 'Rafael', 'Vera',
  'Malcolm', 'Iris', 'Leander', 'Sylvia', 'Kieran', 'Beatrice', 'Lucas', 'Naomi',
  'theodore', 'Margot', 'Adrian', 'genevieve', 'Xavier', 'helena', 'Roman', 'vivian',
];

const LAST_NAMES = [
  'Vance', 'Sterling', 'Rostova', 'Lindqvist', 'Mercer', 'Kowalski', 'Thorne', 'Alvarez',
  'Chen', 'Moreau', 'Falk', 'Kessler', 'Okafor', 'Delacroix', 'Sato', 'Ashford',
  'castellano', 'Varga', 'Bergstrom', 'Sinclair', 'Nakamura', 'brennan', 'Solis', 'Richter',
  'Cavanaugh', 'Dubois', 'Harrington', 'Novak', 'Montague', 'Takahashi', 'Garrison', 'Kline',
];

const COMPANY_PREFIXES = [
  'Vanguard', 'Aether', 'Meridian', 'Kestrel', 'Solstice', 'Helios', 'Stratos', 'Vertex',
  'Northstar', 'Pinnacle', 'Obsidian', 'Cobalt', 'Axiom', 'Nexus', 'Valkyrie', 'Chronos',
  'Hyperion', 'Borealis', 'Covalent', 'Equinox', 'Monolith', 'Paladin', 'Valence', 'Zephyr',
  'Lumina', 'Bastion', 'Citadel', 'polaris', 'Vector', 'Arclight', 'Sovereign', 'Alabaster',
];

const COMPANY_SUFFIXES = [
  'Dynamics', 'Systems', 'Capital', 'Holdings', 'Technologies', 'Biometrics', 'Logistics',
  'Robotics', 'Ventures', 'Analytics', 'Cloud', 'Security', 'Networks', 'Group', 'Labs',
  'Financial', 'Health', 'Aerospace', 'Materials', 'Energy',
];

const COUNTRIES = [
  'United States', 'United Kingdom', 'Germany', 'Canada', 'Switzerland',
  'Netherlands', 'Singapore', 'Sweden', 'France', 'Japan', 'Australia',
];

const SEGMENTS: CustomerSegment[] = ['Enterprise', 'Mid-Market', 'SMB', 'Startup'];
const CUSTOMER_STATUSES: CustomerStatus[] = ['Active', 'Active', 'Active', 'Active', 'Onboarding', 'At Risk', 'Churned'];

const PRODUCT_CATALOG_TEMPLATES: Array<{
  category: ProductCategory;
  prefix: string;
  baseNames: string[];
  minPrice: number;
  maxPrice: number;
}> = [
  {
    category: 'Enterprise Software',
    prefix: 'ENT',
    baseNames: [
      'Aurelix Core Ledger Suite',
      'Executive Boardroom Portal',
      'Global Treasury Consolidation',
      'Multi-Entity Tax Engine',
      'Enterprise Revenue Recognition',
      'Strategic Forecasting Workbench',
      'Procurement Governance Module',
      'Automated Audit Trail Archive',
      'Scenario Modeling Matrix',
      'Liquidity Command Center',
      'Capital Allocation Planner',
      'Contract Lifecycle Ledger',
      'Vendor Risk Ledger Pro',
      'M&A Diligence Workspace',
    ],
    minPrice: 1200,
    maxPrice: 6800,
  },
  {
    category: 'Cloud Infrastructure',
    prefix: 'CLD',
    baseNames: [
      'Dedicated Analytics Compute Node',
      'High-Availability Data Lake Cluster',
      'Multi-Region Failover Vault',
      'Isolated VPC Telemetry Mesh',
      'Zero-Latency Edge Aggregator',
      'Cold Archive Storage Tier 10TB',
      'Elastic Query Accelerator',
      'Private Cloud Kubernetes Bridge',
      'Sovereign EU Residency Node',
      'Real-Time Stream Processor',
      'Encrypted Backup Snapshot Engine',
      'Distributed Cache Fabric',
      'Dedicated GPU Inference Cluster',
      'Managed Kafka Pipeline Node',
    ],
    minPrice: 650,
    maxPrice: 4200,
  },
  {
    category: 'Data Intelligence',
    prefix: 'DAT',
    baseNames: [
      'Predictive Churn Attribution Pack',
      'Cohort Retention Analyzer',
      'Customer LTV Scoring Engine',
      'Cross-Channel Funnel Attribution',
      'Anomaly Detection Telemetry',
      'Market Benchmark Feed Subscription',
      'Executive KPI Digest Automation',
      'Unit Economics Decomposition',
      'Pricing Elasticity Simulator',
      'Net Dollar Retention Tracker',
      'Pipeline Velocity Inspector',
      'Territory Quota Optimizer',
      'Product Adoption Heatmap',
      'Supply Chain Margin Connector',
    ],
    minPrice: 480,
    maxPrice: 3600,
  },
  {
    category: 'Security & Compliance',
    prefix: 'SEC',
    baseNames: [
      'SOC2 Type II Continuous Monitor',
      'Zero-Trust RBAC Policy Engine',
      'GDPR & CCPA Data Masking Suite',
      'Hardware Key SSO Enforcer',
      'Immutable Ledger Cryptographic Seal',
      'Automated Penetration Telemetry',
      'Insider Threat Anomaly Sentinel',
      'Field-Level Encryption Gateway',
      'Compliance Evidence Collector',
      'ISO 27001 Governance Pack',
      'API Rate-Limit & WAF Shield',
      'Session Forensics Recorder',
      'Vendor Security Questionnaire Hub',
    ],
    minPrice: 550,
    maxPrice: 3900,
  },
  {
    category: 'API & Integrations',
    prefix: 'API',
    baseNames: [
      'ERP Bi-Directional Sync Connector',
      'Stripe & Adyen Reconciliation Webhook',
      'Salesforce Enterprise Pipeline Bridge',
      'Snowflake Zero-Copy Warehouse Link',
      'NetSuite General Ledger Adapter',
      'High-Throughput GraphQL Gateway',
      'Custom Webhook Event Bus',
      'SAP S/4HANA Live Extractor',
      'HubSpot Revenue Attribution Sync',
      'Slack & Teams Executive Alert Bot',
      'BigQuery Scheduled Federation',
      'Workday Headcount Cost Importer',
      'Plaid Treasury Banking Feed',
    ],
    minPrice: 320,
    maxPrice: 2400,
  },
  {
    category: 'Advisory Retainer',
    prefix: 'ADV',
    baseNames: [
      'Fractional CFO Architecture Review',
      'Custom Data Warehouse Migration',
      'Executive KPI Workshop & Onboarding',
      'Dedicated Solutions Architect 40h',
      'Annual Security & Audit Readiness',
      'Custom BI Connector Engineering',
      'Board Deck Financial Modeling',
      'Quarterly Revenue Operations Audit',
      'Enterprise SLA 24/7 Priority Support',
      'Data Governance Policy Design',
      'Multi-Currency Tax Structuring',
      'Executive Team Training Intensive',
    ],
    minPrice: 1800,
    maxPrice: 8500,
  },
];

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function generateDeterministicSeedData(): AurelixStorageSchema {
  const rng = createRng(20261113);
  const baseDateMs = new Date(REFERENCE_NOW_ISO).getTime();
  const oneDayMs = 86400 * 1000;

  // 1. Generate 250 Customers
  const customers: Customer[] = [];
  for (let i = 1; i <= 250; i++) {
    const first = capitalize(FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)]);
    const last = capitalize(LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)]);
    const compPrefix = capitalize(COMPANY_PREFIXES[Math.floor(rng() * COMPANY_PREFIXES.length)]);
    const compSuffix = COMPANY_SUFFIXES[Math.floor(rng() * COMPANY_SUFFIXES.length)];
    const company = `${compPrefix} ${compSuffix}${i % 7 === 0 ? ' Intl' : ''}`;
    const domain = `${compPrefix.toLowerCase()}${compSuffix.toLowerCase().slice(0, 4)}.io`;
    const email = `${first.toLowerCase()}.${last.toLowerCase()}${i}@${domain}`;
    const daysAgo = Math.floor(rng() * 400) + 5;
    const createdAt = new Date(baseDateMs - daysAgo * oneDayMs).toISOString();

    const segmentRoll = rng();
    const segment: CustomerSegment =
      segmentRoll < 0.28
        ? 'Enterprise'
        : segmentRoll < 0.62
        ? 'Mid-Market'
        : segmentRoll < 0.85
        ? 'SMB'
        : 'Startup';

    const status = CUSTOMER_STATUSES[Math.floor(rng() * CUSTOMER_STATUSES.length)];
    const country = COUNTRIES[Math.floor(rng() * COUNTRIES.length)];
    const phone = `+1 (${200 + (i % 700)}) ${300 + ((i * 7) % 600)}-${1000 + ((i * 31) % 8999)}`;

    customers.push({
      id: `cust_${String(i).padStart(4, '0')}`,
      name: `${first} ${last}`,
      company,
      email,
      phone,
      segment,
      status,
      country,
      createdAt,
      notes:
        segment === 'Enterprise'
          ? 'Multi-year master services agreement with quarterly executive business reviews.'
          : 'Standard commercial subscription tier.',
    });
  }

  // 2. Generate 80 Products
  const products: Product[] = [];
  let prodIndex = 1;
  for (const group of PRODUCT_CATALOG_TEMPLATES) {
    for (const baseName of group.baseNames) {
      if (prodIndex > 80) break;
      const priceStep = Math.round((group.minPrice + rng() * (group.maxPrice - group.minPrice)) / 50) * 50;
      const costPrice = Math.round(priceStep * (0.22 + rng() * 0.18));
      const stockRoll = rng();
      const stockLevel =
        stockRoll < 0.08 ? 0 : stockRoll < 0.22 ? Math.floor(rng() * 12) + 2 : Math.floor(rng() * 240) + 25;

      const status: ProductStatus =
        stockLevel === 0 ? 'Archived' : stockLevel <= 14 ? 'Low Stock' : 'Active';

      const createdDaysAgo = 380 - (prodIndex * 3);
      const createdAt = new Date(baseDateMs - createdDaysAgo * oneDayMs).toISOString();

      products.push({
        id: `prod_${String(prodIndex).padStart(3, '0')}`,
        sku: `${group.prefix}-${String(1000 + prodIndex * 7)}`,
        name: baseName,
        category: group.category,
        unitPrice: priceStep,
        costPrice,
        stockLevel,
        status,
        description: `Enterprise-grade ${group.category.toLowerCase()} module engineered for high-throughput financial accuracy and real-time operational visibility.`,
        imageCode: `${group.prefix}-${(prodIndex % 6) + 1}`,
        createdAt,
        updatedAt: createdAt,
      });
      prodIndex++;
    }
  }

  // 3. Generate 1,200 Orders across the last 365 days
  const orders: Order[] = [];
  const channels: SalesChannel[] = [
    'Direct Enterprise',
    'Self-Serve Web',
    'Partner Channel',
    'Marketplace',
  ];

  for (let i = 1; i <= 1200; i++) {
    // Slightly weight more recent months to reflect realistic SaaS growth
    const recencyCurve = Math.pow(rng(), 1.18);
    const daysAgo = Math.floor(recencyCurve * 364);
    const hoursOffset = Math.floor(rng() * 23);
    const minsOffset = Math.floor(rng() * 59);
    const orderDateMs = baseDateMs - daysAgo * oneDayMs - hoursOffset * 3600000 - minsOffset * 60000;
    const orderDate = new Date(orderDateMs).toISOString();

    const customer = customers[Math.floor(rng() * customers.length)];
    const lineCount = rng() < 0.65 ? 1 : rng() < 0.9 ? 2 : 3;
    const usedProductIds = new Set<string>();
    const lineItems: OrderLineItem[] = [];

    for (let l = 0; l < lineCount; l++) {
      const prod = products[Math.floor(rng() * products.length)];
      if (usedProductIds.has(prod.id)) continue;
      usedProductIds.add(prod.id);

      const quantity = prod.unitPrice > 3500 ? 1 : Math.floor(rng() * 3) + 1;
      // Historical price locking: slight historical variance on older orders
      const historicalMultiplier = daysAgo > 240 ? 0.95 : 1;
      const lockedPrice = Math.round(prod.unitPrice * historicalMultiplier);
      const subtotal = lockedPrice * quantity;

      lineItems.push({
        id: `li_${i}_${l + 1}`,
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        category: prod.category,
        quantity,
        unitPrice: lockedPrice,
        subtotal,
      });
    }

    const subtotal = lineItems.reduce((acc, item) => acc + item.subtotal, 0);
    const discountRoll = rng();
    const discountAmount =
      discountRoll < 0.72 ? 0 : Math.round(subtotal * (discountRoll < 0.9 ? 0.05 : 0.1));
    const taxableBase = Math.max(0, subtotal - discountAmount);
    const taxRate = 0.085;
    const taxAmount = Math.round(taxableBase * taxRate * 100) / 100;
    const totalAmount = Math.round((taxableBase + taxAmount) * 100) / 100;

    // Status distribution
    const statusRoll = rng();
    let paymentStatus: PaymentStatus = 'Paid';
    let fulfillmentStatus: FulfillmentStatus = 'Fulfilled';
    let refundedAmount = 0;

    if (statusRoll < 0.78) {
      paymentStatus = 'Paid';
      fulfillmentStatus = daysAgo < 3 && rng() < 0.4 ? 'Processing' : 'Fulfilled';
    } else if (statusRoll < 0.88) {
      paymentStatus = 'Pending';
      fulfillmentStatus = rng() < 0.5 ? 'Processing' : 'Scheduled';
    } else if (statusRoll < 0.95) {
      paymentStatus = 'Refunded';
      fulfillmentStatus = 'Fulfilled';
      refundedAmount = rng() < 0.75 ? totalAmount : Math.round(totalAmount * 0.5 * 100) / 100;
    } else {
      paymentStatus = 'Failed';
      fulfillmentStatus = 'Canceled';
    }

    const channelRoll = rng();
    const salesChannel: SalesChannel =
      channelRoll < 0.44
        ? 'Direct Enterprise'
        : channelRoll < 0.74
        ? 'Self-Serve Web'
        : channelRoll < 0.9
        ? 'Partner Channel'
        : 'Marketplace';

    orders.push({
      id: `ord_${String(i).padStart(5, '0')}`,
      orderNumber: `AUR-${20260000 + i}`,
      customerId: customer.id,
      customerName: customer.name,
      customerEmail: customer.email,
      customerCompany: customer.company,
      orderDate,
      lineItems,
      subtotal,
      discountAmount,
      taxRate,
      taxAmount,
      totalAmount,
      refundedAmount,
      paymentStatus,
      fulfillmentStatus,
      salesChannel,
      notes:
        paymentStatus === 'Refunded'
          ? 'Simulated credit memo issued following contract scope adjustment.'
          : undefined,
    });
  }

  // Sort orders newest first
  orders.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());

  // 4. Generate 365 days of Daily Session Metrics for conversion funnel & rate
  const dailySessions: DailySessionMetric[] = [];
  for (let d = 364; d >= 0; d--) {
    const dayDate = new Date(baseDateMs - d * oneDayMs);
    const dateStr = dayDate.toISOString().slice(0, 10);
    const growthFactor = 1 + ((364 - d) / 364) * 0.35;
    const isWeekend = dayDate.getUTCDay() === 0 || dayDate.getUTCDay() === 6;
    const baseVisitors = isWeekend ? 140 : 260;
    const uniqueVisitors = Math.round(baseVisitors * growthFactor * (0.88 + rng() * 0.24));
    const sessions = Math.round(uniqueVisitors * (1.28 + rng() * 0.18));
    const demoRequests = Math.round(uniqueVisitors * (0.14 + rng() * 0.04));
    const cartInitiated = Math.round(demoRequests * (0.52 + rng() * 0.12));

    dailySessions.push({
      date: dateStr,
      sessions,
      uniqueVisitors,
      demoRequests,
      cartInitiated,
    });
  }

  // 5. Generate 6 Demo Team Members
  const team: TeamMember[] = [
    {
      id: 'team_01',
      name: 'Claire Vance',
      email: 'claire.vance@aurelix.io',
      role: 'Owner',
      title: 'Chief Executive Officer',
      department: 'Executive Leadership',
      avatarUrl: '/images/avatar_claire_vance_1794569123724.jpg',
      status: 'Active',
      joinedAt: '2025-01-10T09:00:00.000Z',
      lastActiveAt: '2026-11-13T09:54:00.000Z',
    },
    {
      id: 'team_02',
      name: 'Marcus Sterling',
      email: 'marcus.sterling@aurelix.io',
      role: 'Admin',
      title: 'VP of Finance & Treasury',
      department: 'Finance & Operations',
      avatarUrl: '/images/avatar_marcus_sterling_1794569124389.jpg',
      status: 'Active',
      joinedAt: '2025-02-01T09:00:00.000Z',
      lastActiveAt: '2026-11-13T09:40:00.000Z',
    },
    {
      id: 'team_03',
      name: 'Elena Rostova',
      email: 'elena.rostova@aurelix.io',
      role: 'Analyst',
      title: 'Director of Revenue Intelligence',
      department: 'Data & Analytics',
      avatarUrl: '/images/avatar_elena_rostova_1794569124921.jpg',
      status: 'Active',
      joinedAt: '2025-03-15T09:00:00.000Z',
      lastActiveAt: '2026-11-13T08:15:00.000Z',
    },
    {
      id: 'team_04',
      name: 'Julian Lindqvist',
      email: 'julian.lindqvist@aurelix.io',
      role: 'Admin',
      title: 'Head of Enterprise Sales',
      department: 'Global Revenue',
      avatarUrl: '',
      status: 'Active',
      joinedAt: '2025-04-20T09:00:00.000Z',
      lastActiveAt: '2026-11-12T18:30:00.000Z',
    },
    {
      id: 'team_05',
      name: 'Nadia Okafor',
      email: 'nadia.okafor@aurelix.io',
      role: 'Analyst',
      title: 'Senior FP&A Strategist',
      department: 'Finance & Operations',
      avatarUrl: '',
      status: 'Active',
      joinedAt: '2025-06-11T09:00:00.000Z',
      lastActiveAt: '2026-11-13T07:45:00.000Z',
    },
    {
      id: 'team_06',
      name: 'Henrik Falk',
      email: 'henrik.falk@aurelix.io',
      role: 'Viewer',
      title: 'External Board Observer',
      department: 'Advisory Board',
      avatarUrl: '',
      status: 'Active',
      joinedAt: '2025-09-01T09:00:00.000Z',
      lastActiveAt: '2026-11-10T15:20:00.000Z',
    },
  ];

  // 6. Seed realistic Activity Events
  const recentOrders = orders.slice(0, 12);
  const activities: ActivityEvent[] = [
    {
      id: 'act_001',
      timestamp: new Date(baseDateMs - 18 * 60000).toISOString(),
      actorName: 'Claire Vance',
      actorRole: 'Owner',
      category: 'Order',
      action: 'Order Verified',
      targetId: recentOrders[0]?.id,
      targetName: recentOrders[0]?.orderNumber || 'AUR-20261200',
      description: `Confirmed enterprise settlement for ${recentOrders[0]?.customerCompany} ($${recentOrders[0]?.totalAmount.toLocaleString()}).`,
    },
    {
      id: 'act_002',
      timestamp: new Date(baseDateMs - 95 * 60000).toISOString(),
      actorName: 'Elena Rostova',
      actorRole: 'Analyst',
      category: 'Report',
      action: 'Report Exported',
      targetName: 'Q4 Executive Revenue Ledger',
      description: 'Generated and downloaded CSV reconciliation for Direct Enterprise channel.',
    },
    {
      id: 'act_003',
      timestamp: new Date(baseDateMs - 3.5 * 3600000).toISOString(),
      actorName: 'Marcus Sterling',
      actorRole: 'Admin',
      category: 'Product',
      action: 'Pricing Audited',
      targetId: products[0]?.id,
      targetName: products[0]?.name || 'Aurelix Core Ledger Suite',
      description: `Verified unit price schedule ($${products[0]?.unitPrice.toLocaleString()}) and inventory allocation.`,
    },
    {
      id: 'act_004',
      timestamp: new Date(baseDateMs - 7 * 3600000).toISOString(),
      actorName: 'Julian Lindqvist',
      actorRole: 'Admin',
      category: 'Customer',
      action: 'Customer Onboarded',
      targetId: customers[0]?.id,
      targetName: customers[0]?.company || 'Vanguard Dynamics',
      description: `Completed enterprise onboarding review for ${customers[0]?.name} (${customers[0]?.segment}).`,
    },
    {
      id: 'act_005',
      timestamp: new Date(baseDateMs - 16 * 3600000).toISOString(),
      actorName: 'Nadia Okafor',
      actorRole: 'Analyst',
      category: 'Order',
      action: 'Refund Processed',
      targetId: orders.find((o) => o.paymentStatus === 'Refunded')?.id,
      targetName: orders.find((o) => o.paymentStatus === 'Refunded')?.orderNumber || 'AUR-20261180',
      description: 'Issued simulated credit adjustment following annual seat consolidation.',
    },
    {
      id: 'act_006',
      timestamp: new Date(baseDateMs - 28 * 3600000).toISOString(),
      actorName: 'Claire Vance',
      actorRole: 'Owner',
      category: 'Settings',
      action: 'Workspace Policy Updated',
      targetName: 'Fiscal Reporting Preferences',
      description: 'Configured high-value transaction alerts and weekly executive digest preferences.',
    },
    {
      id: 'act_007',
      timestamp: new Date(baseDateMs - 42 * 3600000).toISOString(),
      actorName: 'Marcus Sterling',
      actorRole: 'Admin',
      category: 'Team',
      action: 'Role Verified',
      targetId: 'team_06',
      targetName: 'Henrik Falk',
      description: 'Confirmed read-only Observer permissions for Q4 board preparation.',
    },
  ];

  // 7. Seed Saved Report Configurations & History
  const savedReports: SavedReportConfig[] = [
    {
      id: 'rep_cfg_01',
      name: 'Executive Monthly Revenue Ledger',
      type: 'Revenue Ledger',
      dateRangePreset: '30d',
      channelFilter: 'All',
      categoryFilter: 'All',
      paymentStatusFilter: 'Paid',
      createdAt: '2026-09-01T10:00:00.000Z',
      lastGeneratedAt: '2026-11-12T16:30:00.000Z',
      createdBy: 'Marcus Sterling',
    },
    {
      id: 'rep_cfg_02',
      name: 'Direct Enterprise Sales Performance',
      type: 'Sales Summary',
      dateRangePreset: '90d',
      channelFilter: 'Direct Enterprise',
      categoryFilter: 'All',
      paymentStatusFilter: 'All',
      createdAt: '2026-09-15T14:20:00.000Z',
      lastGeneratedAt: '2026-11-11T11:15:00.000Z',
      createdBy: 'Elena Rostova',
    },
    {
      id: 'rep_cfg_03',
      name: 'Enterprise Cohort Retention & LTV',
      type: 'Customer Cohort',
      dateRangePreset: '12m',
      channelFilter: 'All',
      categoryFilter: 'Enterprise Software',
      paymentStatusFilter: 'Paid',
      createdAt: '2026-10-04T09:00:00.000Z',
      lastGeneratedAt: '2026-11-10T17:45:00.000Z',
      createdBy: 'Claire Vance',
    },
    {
      id: 'rep_cfg_04',
      name: 'Cloud & Data SKU Velocity Audit',
      type: 'Product Velocity',
      dateRangePreset: '6m',
      channelFilter: 'All',
      categoryFilter: 'Cloud Infrastructure',
      paymentStatusFilter: 'Paid',
      createdAt: '2026-10-19T12:00:00.000Z',
      lastGeneratedAt: '2026-11-09T10:05:00.000Z',
      createdBy: 'Nadia Okafor',
    },
  ];

  const reportHistory: GeneratedReportRecord[] = [
    {
      id: 'rep_hist_01',
      reportName: 'Executive Monthly Revenue Ledger',
      type: 'Revenue Ledger',
      generatedAt: '2026-11-12T16:30:00.000Z',
      generatedBy: 'Marcus Sterling',
      rowCount: 118,
      totalRevenueReported: 384250,
      format: 'CSV',
    },
    {
      id: 'rep_hist_02',
      reportName: 'Direct Enterprise Sales Performance',
      type: 'Sales Summary',
      generatedAt: '2026-11-11T11:15:00.000Z',
      generatedBy: 'Elena Rostova',
      rowCount: 164,
      totalRevenueReported: 592800,
      format: 'CSV',
    },
  ];

  const settings: WorkspaceSettings = {
    personalName: 'Claire Vance',
    personalEmail: 'claire.vance@aurelix.io',
    personalTitle: 'Chief Executive Officer',
    workspaceName: 'Aurelix Global Holdings',
    companyDomain: 'aurelix.io',
    companyLogoText: 'AX',
    currency: 'USD',
    language: 'English (US)',
    dateFormat: 'MMM d, yyyy',
    numberFormat: 'en-US',
    theme: 'dark',
    sidebarCollapsed: false,
    activeRolePreview: 'Owner',
    notifications: {
      highValueOrders: true,
      refundAlerts: true,
      lowInventoryWarnings: true,
      weeklyDigest: true,
    },
  };

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    seededAt: REFERENCE_NOW_ISO,
    lastUpdatedAt: REFERENCE_NOW_ISO,
    customers,
    products,
    orders,
    team,
    activities,
    savedReports,
    reportHistory,
    dailySessions,
    settings,
  };
}
