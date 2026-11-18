# AURELIX Analytics — Executive Business Intelligence Dashboard

**Project 001** in a portfolio of 20 premium web applications. **AURELIX Analytics** is an executive financial and operational intelligence dashboard built with **Next.js App Router**, **React 19**, **TypeScript**, **Tailwind CSS v4**, **Recharts**, **Zustand**, **React Hook Form**, and **Zod**.

---

## 1. Architecture Overview

```
/
├── app/
│   ├── page.tsx                      # Executive Landing & Role Preview Entry
│   ├── layout.tsx                    # Root Typography & Hydration Initializer
│   ├── globals.css                   # Dual-Theme Semantic Tokens & Print Rules
│   └── dashboard/
│       ├── layout.tsx                # AppShell Wrapper (Sidebar, Topbar, ⌘K)
│       ├── page.tsx                  # PAGE 01: Executive Overview
│       ├── analytics/page.tsx        # PAGE 02: Deep Analytics & Funnel
│       ├── revenue/page.tsx          # PAGE 03: Revenue Intelligence & Reconciliation
│       ├── customers/page.tsx        # PAGE 04: Customer Directory & Cohort LTV
│       ├── orders/page.tsx           # PAGE 05: Commercial Order Management
│       ├── products/page.tsx         # PAGE 06: Product Catalog & SKU Velocity
│       ├── reports/page.tsx          # PAGE 07: Configurable Reporting Center
│       ├── activity/page.tsx         # PAGE 08: Activity & Operational Audit Feed
│       ├── team/page.tsx             # PAGE 09: Demo Team & Role Governance
│       ├── settings/page.tsx         # PAGE 10: Comprehensive Settings & JSON Backups
│       └── help/page.tsx             # PAGE 11: Architecture & Formula Documentation
├── components/
│   ├── charts/AnalyticsCharts.tsx    # Recharts Area, Bar, Line, Donut & Horizontal Bars
│   ├── feedback/                     # AppInitializer & ToastContainer
│   ├── layout/                       # AppShell & CommandPalette (⌘K)
│   └── ui/                           # Primitives, Overlays, Drawers, DateRangePicker
├── lib/
│   ├── calculations/analytics.ts     # Centralized Financial & Cohort Calculation Engine
│   ├── demo-data/seed.ts             # Mulberry32 Deterministic Seed Generator
│   ├── export/exporter.ts            # RFC-4180 CSV & JSON Download Utilities
│   ├── storage/repository.ts         # Versioned LocalStorage Adapter & Recovery
│   └── validation/schemas.ts         # Zod Schemas for Forms & Backup Validation
├── stores/useAppStore.ts             # Zustand Store Synchronized with LocalStorage
├── types/index.ts                    # Strict Domain TypeScript Interfaces
└── tests/aurelix.test.tsx            # 25 Automated Vitest Suite Tests
```

---

## 2. Installation & Local Development

```bash
# 1. Install dependencies
npm install

# 2. Start the development server on port 3000
npm run dev

# 3. Run the 25-test automated Vitest suite
npx vitest run

# 4. Run ESLint and Production Build verification
npm run lint
npm run build
```

---

## 3. Centralized Analytics Calculation Rules

All pages derive their numbers from `/lib/calculations/analytics.ts`:

- **Eligible Realized Orders**: An order must be `Paid` or `Refunded` and its fulfillment must be other than `Canceled`. Cancellation takes precedence over payment status for every realized total. Ledger rows retain the original invoice amounts and recorded refunds.
- **Gross Revenue**: Sum of `subtotal` (before discounts and tax) across eligible orders.
- **Net Realized Revenue**: `Sum(totalAmount - refundedAmount)` across eligible orders. Refunded revenue is never double-counted.
- **Average Order Value (AOV)**: `Net Realized Revenue / Eligible Order Count` with zero-denominator protection.
- **Historical Price Locking**: Every `OrderLineItem` stores the unit price locked at order creation. Updating a product's catalog price in `/dashboard/products` does not mutate historical order totals.
- **Product Velocity**. Historical rows group realized sales by recorded SKU and order-line category. Average recorded unit price uses the original gross line amounts and quantities. Available stock is current catalog metadata. Legacy lines without a recorded category appear as **Unclassified** in the All Categories report.
- **Product Velocity CSV**. The column order is `SKU`, `Product Name`, `Recorded Category`, `Average Recorded Unit Price`, `Units Sold in Window`, `Order Appearances`, `Gross Line-Item Revenue`, and `Current Available Stock`. Header-based integrations from older releases should map `Category` to `Recorded Category` and `Available Stock` to `Current Available Stock`. The `Average Recorded Unit Price` column represents historical line amounts per unit. Use the Products catalog for current pricing.
- **Orders and reports**. The Orders workspace spans all time. The shared date picker scopes Overview, Analytics, and Revenue. Reports use their own date range. Analytics counts fulfilled orders with Paid or Refunded payment as completed. A new nonzero metric after a zero prior period is labeled **New**.
- **Print and CSV scope**. Print Statement prints up to 25 preview rows. The displayed preview total and Print history entry use those same rows. CSV download and its history entry include all matching rows.
- **Conversion Rate**: Calculated from non-canceled orders divided by unique visitors in `/lib/demo-data/seed.ts` daily session telemetry.
- **Payment and Fulfillment**. Pending payments can become Paid or Failed. A Paid order can record one simulated refund of any amount from one cent through the invoice total. Refunded and Failed payments are final. Scheduled and Processing fulfillment can transition between each other or to Fulfilled. Fulfilled orders can be canceled. Canceled fulfillment is final, and failed payments cannot progress in fulfillment. Canceling an unpaid Pending order records it as Failed. Canceling a Paid or Refunded order retains its payment status and refund history.
- **Inventory**. New orders record the units actually deducted from stock. Cancellation or payment failure releases recorded units for orders that are still Scheduled or Processing. Fulfilled orders require a separate return before units become available again. Legacy and seeded orders without recorded debits leave inventory as recorded.
- **Archived SKUs**. New orders require available catalog products. Archiving a SKU keeps its historical order lines reportable.
- **Backup Validation**. Imports reject inconsistent line-item subtotals, invoice totals, discounts, tax, or refund amounts before any write. Historical seed tax is accepted when it matches the original calculation, including its one-cent rounding difference on ties. Persisted timestamps remain as recorded. Only a new workspace or explicit demo reset generates a date-relative dataset.
- **Cross-tab persistence**. The workspace applies saved collections from storage events, including empty arrays. Browser writes use an exclusive Web Lock where available and compare the loaded snapshot before saving. Each coordinated write publishes its revision so a tab can wait for its LocalStorage view to catch up. On conflict, the workspace loads the latest valid state and asks the user to review and retry.
- Without Web Locks, the workspace still checks the exact persisted snapshot for visible conflicts. Simultaneous writes can race in that mode. Use one editing tab when Web Locks are unavailable.

---

## 4. Portfolio Demonstration vs Production Deployment

This application is an architectural **Portfolio Demonstration** engineered to showcase senior-level frontend systems design, financial data modeling, complex state synchronization, and executive UI craft without requiring external SaaS databases or paid credentials.

### Key Distinctions & Honest Limitations

1. **Client-Side LocalStorage Persistence**:
   - All records are persisted in the user's browser under `aurelix_analytics_v1_store`.
   - Browser LocalStorage has an approximate ~5MB quota per origin.
   - Clearing site data or switching browsers starts a fresh deterministic seed unless you export and import a JSON backup via `/dashboard/settings`.
2. **Simulated Role Preview vs. Backend RBAC**:
   - Switching between `Owner`, `Admin`, `Analyst`, and `Viewer` previews how multi-role interfaces and audit attributions behave on the client.
   - In a production multi-tenant deployment, authentication and RBAC must be enforced server-side via signed session tokens and row-level security policies.
3. **Simulated Refunds & Settlements**:
   - Creating orders or issuing refunds updates the financial ledger and charts in real time in LocalStorage; no real payment gateway transactions are executed.
4. **Data Privacy**:
   - Never store real passwords, secret API keys, or sensitive personal financial records in LocalStorage.
