'use client';

import React, { useSyncExternalStore } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  CategoryPerformanceItem,
  ChannelBreakdownItem,
  TimeSeriesPoint,
} from '@/lib/calculations/analytics';
import { CurrencyCode, NumberFormatOption } from '@/types';
import { formatCurrency } from '@/lib/export/exporter';

// Categorical series colors come from the --chart-* tokens (globals.css),
// assigned in fixed order so a channel keeps its color across themes.
const CHART_PALETTE = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
];

const AXIS_TICK = { fontSize: 12, fill: 'var(--text-muted)' };
const GRID_STROKE = 'var(--chart-grid)';
const CHART_MARGIN = { top: 8, right: 8, left: 0, bottom: 0 };

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(callback: () => void) {
  const mql = window.matchMedia(REDUCED_MOTION_QUERY);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

/** True when the OS asks for reduced motion; chart animations are skipped. */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false
  );
}

function SeriesSwatch({ color, dashed = false }: { color: string; dashed?: boolean }) {
  return dashed ? (
    <span
      aria-hidden="true"
      className="w-3 h-0 border-t-2 border-dashed shrink-0"
      style={{ borderColor: color }}
    />
  ) : (
    <span
      aria-hidden="true"
      className="w-2 h-2 rounded-xs shrink-0"
      style={{ backgroundColor: color }}
    />
  );
}

function ChartTooltip({
  title,
  rows,
}: {
  title: React.ReactNode;
  rows: Array<{ label: string; value: React.ReactNode; color?: string; dashed?: boolean }>;
}) {
  return (
    <div className="p-3 rounded-xl bg-surface-raised border border-line shadow-xl text-xs space-y-2 min-w-40">
      <div className="font-semibold text-ink">{title}</div>
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 text-ink-muted">
            {row.color && <SeriesSwatch color={row.color} dashed={row.dashed} />}
            {row.label}
          </span>
          <span className="tabular-nums font-semibold text-ink">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function ChartLegend({
  items,
}: {
  items: Array<{ label: string; color: string; dashed?: boolean }>;
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-ink-secondary">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2">
          <SeriesSwatch color={item.color} dashed={item.dashed} />
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

export function RevenueTrendChart({
  data,
  currency = 'USD',
  numberFormat = 'en-US',
  mode = 'area',
  metric = 'netRevenue',
}: {
  data: TimeSeriesPoint[];
  currency?: CurrencyCode;
  numberFormat?: NumberFormatOption;
  mode?: 'area' | 'bar' | 'line';
  metric?: 'netRevenue' | 'grossRevenue' | 'orders' | 'aov';
}) {
  const animate = !usePrefersReducedMotion();
  const gradientId = React.useId();

  const formatVal = (v: number) => {
    if (metric === 'orders') return v.toLocaleString();
    return formatCurrency(v, currency, numberFormat, true);
  };
  const money = (v: number) => formatCurrency(v, currency, numberFormat);

  const xAxis = (
    <XAxis
      dataKey="label"
      tick={AXIS_TICK}
      axisLine={false}
      tickLine={false}
      tickMargin={8}
      minTickGap={24}
    />
  );
  const yAxis = (
    <YAxis
      tickFormatter={formatVal}
      tick={AXIS_TICK}
      axisLine={false}
      tickLine={false}
      width={56}
    />
  );
  const grid = <CartesianGrid stroke={GRID_STROKE} vertical={false} />;
  const cursorLine = { stroke: 'var(--border)', strokeWidth: 1 };

  return (
    <div className="space-y-3">
      {mode === 'area' && metric === 'netRevenue' && (
        <ChartLegend
          items={[
            { label: 'Net revenue', color: 'var(--chart-1)' },
            { label: 'Gross revenue', color: 'var(--chart-2)', dashed: true },
          ]}
        />
      )}
      <div className="w-full h-[300px]" role="img" aria-label="Revenue and orders trend chart">
        <ResponsiveContainer width="100%" height="100%">
          {mode === 'bar' ? (
            <BarChart data={data} margin={CHART_MARGIN}>
              {grid}
              {xAxis}
              {yAxis}
              <Tooltip
                cursor={{ fill: 'var(--surface-hover)', opacity: 0.6 }}
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  const point = payload[0].payload as TimeSeriesPoint;
                  return (
                    <ChartTooltip
                      title={label}
                      rows={[
                        { label: 'Net revenue', value: money(point.netRevenue) },
                        { label: 'Gross revenue', value: money(point.grossRevenue) },
                        { label: 'Orders', value: point.orders.toLocaleString() },
                      ]}
                    />
                  );
                }}
              />
              <Bar
                dataKey={metric}
                fill="var(--chart-1)"
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
                isAnimationActive={animate}
              />
            </BarChart>
          ) : mode === 'line' ? (
            <LineChart data={data} margin={CHART_MARGIN}>
              {grid}
              {xAxis}
              {yAxis}
              <Tooltip
                cursor={cursorLine}
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  const point = payload[0].payload as TimeSeriesPoint;
                  return (
                    <ChartTooltip
                      title={label}
                      rows={[
                        { label: 'Net revenue', value: money(point.netRevenue) },
                        { label: 'Average order', value: money(point.aov) },
                      ]}
                    />
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey={metric}
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: 'var(--surface-raised)', strokeWidth: 2 }}
                isAnimationActive={animate}
              />
            </LineChart>
          ) : (
            <AreaChart data={data} margin={CHART_MARGIN}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" style={{ stopColor: 'var(--chart-1)', stopOpacity: 0.3 }} />
                  <stop offset="100%" style={{ stopColor: 'var(--chart-1)', stopOpacity: 0.02 }} />
                </linearGradient>
              </defs>
              {grid}
              {xAxis}
              {yAxis}
              <Tooltip
                cursor={cursorLine}
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  const point = payload[0].payload as TimeSeriesPoint;
                  return (
                    <ChartTooltip
                      title={label}
                      rows={[
                        {
                          label: 'Net revenue',
                          value: money(point.netRevenue),
                          color: 'var(--chart-1)',
                        },
                        {
                          label: 'Gross revenue',
                          value: money(point.grossRevenue),
                          color: 'var(--chart-2)',
                          dashed: true,
                        },
                        { label: 'Refunds', value: money(point.refunds) },
                        { label: 'Orders', value: point.orders.toLocaleString() },
                        { label: 'Average order', value: money(point.aov) },
                      ]}
                    />
                  );
                }}
              />
              {/* The selected metric is the filled area; Gross is a thin dashed reference line. */}
              <Area
                type="monotone"
                dataKey={metric}
                stroke="var(--chart-1)"
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#${gradientId})`}
                activeDot={{ r: 4, stroke: 'var(--surface-raised)', strokeWidth: 2 }}
                isAnimationActive={animate}
              />
              {metric === 'netRevenue' && (
                <Area
                  type="monotone"
                  dataKey="grossRevenue"
                  stroke="var(--chart-2)"
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                  fill="none"
                  activeDot={{ r: 3, stroke: 'var(--surface-raised)', strokeWidth: 2 }}
                  isAnimationActive={animate}
                />
              )}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function OrdersAndCustomerGrowthChart({ data }: { data: TimeSeriesPoint[] }) {
  const animate = !usePrefersReducedMotion();

  return (
    <div className="space-y-3">
      <ChartLegend
        items={[
          { label: 'Orders', color: 'var(--chart-1)' },
          { label: 'New customers', color: 'var(--chart-2)' },
        ]}
      />
      <div className="w-full h-[320px]" role="img" aria-label="Orders and new customer growth chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={CHART_MARGIN} barGap={2}>
            <CartesianGrid stroke={GRID_STROKE} vertical={false} />
            <XAxis
              dataKey="label"
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              minTickGap={24}
            />
            <YAxis
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              width={32}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: 'var(--surface-hover)', opacity: 0.6 }}
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                const point = payload[0].payload as TimeSeriesPoint;
                return (
                  <ChartTooltip
                    title={label}
                    rows={[
                      {
                        label: 'Orders',
                        value: point.orders.toLocaleString(),
                        color: 'var(--chart-1)',
                      },
                      {
                        label: 'New customers',
                        value: `+${point.newCustomers}`,
                        color: 'var(--chart-2)',
                      },
                    ]}
                  />
                );
              }}
            />
            <Bar
              dataKey="orders"
              name="Orders"
              fill="var(--chart-1)"
              radius={[4, 4, 0, 0]}
              maxBarSize={16}
              isAnimationActive={animate}
            />
            <Bar
              dataKey="newCustomers"
              name="New Customers"
              fill="var(--chart-2)"
              radius={[4, 4, 0, 0]}
              maxBarSize={16}
              isAnimationActive={animate}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function ChannelDonutChart({
  data,
  currency = 'USD',
  numberFormat = 'en-US',
}: {
  data: ChannelBreakdownItem[];
  currency?: CurrencyCode;
  numberFormat?: NumberFormatOption;
}) {
  const animate = !usePrefersReducedMotion();
  const total = data.reduce((sum, item) => sum + item.netRevenue, 0);

  return (
    <div className="@container">
      <div className="grid grid-cols-1 @md:grid-cols-2 items-center gap-6">
        <div
          className="relative h-[200px] w-full"
          role="img"
          aria-label="Sales by channel distribution"
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="netRevenue"
                nameKey="channel"
                innerRadius={66}
                outerRadius={92}
                paddingAngle={2}
                stroke="var(--surface-raised)"
                strokeWidth={2}
                isAnimationActive={animate}
              >
                {data.map((entry, index) => (
                  <Cell key={entry.channel} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const item = payload[0].payload as ChannelBreakdownItem;
                  return (
                    <ChartTooltip
                      title={item.channel}
                      rows={[
                        {
                          label: 'Net revenue',
                          value: formatCurrency(item.netRevenue, currency, numberFormat),
                        },
                        { label: 'Share', value: `${item.sharePercent}%` },
                      ]}
                    />
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-caption text-ink-muted">Total net</span>
            <span className="text-xl/7 font-bold tabular-nums text-ink">
              {formatCurrency(total, currency, numberFormat, true)}
            </span>
          </div>
        </div>
        <ul className="space-y-3">
          {data.map((item, idx) => (
            <li key={item.channel} className="flex items-center justify-between text-xs gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <SeriesSwatch color={CHART_PALETTE[idx % CHART_PALETTE.length]} />
                <span className="text-ink-secondary truncate" title={item.channel}>
                  {item.channel}
                </span>
              </div>
              <div className="tabular-nums text-right shrink-0">
                <span className="font-semibold text-ink">{item.sharePercent}%</span>
                <span className="text-ink-muted ml-2">
                  {formatCurrency(item.netRevenue, currency, numberFormat, true)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function CategoryHorizontalBars({
  data,
  currency = 'USD',
  numberFormat = 'en-US',
}: {
  data: CategoryPerformanceItem[];
  currency?: CurrencyCode;
  numberFormat?: NumberFormatOption;
}) {
  return (
    <div className="space-y-4">
      {data.map((item, idx) => (
        <div key={item.category} className="space-y-2">
          <div className="flex items-center justify-between text-xs gap-2">
            <span className="font-medium text-ink">{item.category}</span>
            <span className="tabular-nums text-ink-muted text-right">
              {formatCurrency(item.grossRevenue, currency, numberFormat)} · {item.unitsSold} units (
              {item.sharePercent}%)
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-surface-sunken overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.max(4, item.sharePercent)}%`,
                backgroundColor: CHART_PALETTE[idx % CHART_PALETTE.length],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
