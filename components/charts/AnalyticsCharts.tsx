'use client';

import React, { useId, useMemo, useSyncExternalStore } from 'react';
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
  type TooltipContentProps,
} from 'recharts';
import {
  CategoryPerformanceItem,
  ChannelBreakdownItem,
  TimeSeriesPoint,
} from '@/lib/calculations/analytics';
import { CurrencyCode, NumberFormatOption } from '@/types';
import { formatCurrency, formatNumber } from '@/lib/export/exporter';

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

const AXIS_TICK = { fontSize: 12, fill: 'var(--text-secondary)' };
const GRID_STROKE = 'color-mix(in srgb, var(--chart-grid) 60%, var(--border))';
const CHART_MARGIN = { top: 12, right: 12, left: 0, bottom: 0 };
const CURSOR_LINE = { stroke: 'var(--border)', strokeWidth: 1 };
const CURSOR_BAND = { fill: 'var(--surface-hover)', opacity: 0.65 };
const PRIMARY_SERIES = 'var(--chart-1)';
const SECONDARY_SERIES = 'var(--chart-2)';

type RevenueMetric = 'netRevenue' | 'grossRevenue' | 'orders' | 'aov';
type TooltipMetric = RevenueMetric | 'refunds';
const METRIC_LABELS: Record<TooltipMetric, string> = {
  netRevenue: 'Net revenue',
  grossRevenue: 'Gross revenue',
  orders: 'Orders',
  aov: 'Average order value',
  refunds: 'Refunds',
};

type SeriesMark = 'square' | 'line' | 'dashed' | 'striped';
type SeriesItem = { label: string; color: string; mark?: SeriesMark };

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

const SWATCH_CLASS: Record<SeriesMark, string> = {
  square: 'size-2.5 rounded-sm',
  line: 'h-0 w-4 border-t-2',
  dashed: 'h-0 w-4 border-t-2 border-dashed',
  striped: 'size-2.5 rounded-sm',
};

function SeriesSwatch({ color, mark = 'square' }: { color: string; mark?: SeriesMark }) {
  return (
    <span
      aria-hidden="true"
      className={`${SWATCH_CLASS[mark]} shrink-0`}
      style={{
        borderColor: color,
        backgroundColor: mark === 'square' || mark === 'striped' ? color : undefined,
        backgroundImage: mark === 'striped'
          ? 'repeating-linear-gradient(135deg, transparent 0 3px, var(--surface-raised) 3px 4px)'
          : undefined,
      }}
    />
  );
}

function ChartTooltip({
  title,
  rows,
}: {
  title: React.ReactNode;
  rows: Array<{ label: string; value: React.ReactNode; color?: string; mark?: SeriesMark }>;
}) {
  return (
    <div
      role="status"
      className="w-max max-w-[min(16rem,calc(100cqw_-_0.5rem))] rounded-lg border border-line bg-surface-raised px-3 py-2.5 text-[0.8125rem]/5 shadow-xl"
    >
      <p className="mb-2 border-b border-line-subtle pb-1.5 font-semibold tabular-nums text-ink">{title}</p>
      <dl className="space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3">
            <dt className="flex items-center gap-2 text-ink-secondary">
              {row.color && <SeriesSwatch color={row.color} mark={row.mark} />}
              {row.label}
            </dt>
            <dd className="whitespace-nowrap text-right font-semibold tabular-nums text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ChartLegend({ items }: { items: SeriesItem[] }) {
  return (
    <ul aria-label="Chart legend" className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.8125rem]/5 text-ink-secondary">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2">
          <SeriesSwatch color={item.color} mark={item.mark} />
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

function TrendFigure({
  name,
  summary,
  legend,
  children,
}: {
  name: string;
  summary: React.ReactNode;
  legend: SeriesItem[];
  children: React.ReactElement;
}) {
  const summaryId = useId();

  return (
    <figure aria-label={name} aria-describedby={summaryId} className="@container min-w-0 space-y-3">
      <ChartLegend items={legend} />
      <div className="h-60 w-full min-w-0 @sm:h-[300px]">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          {children}
        </ResponsiveContainer>
      </div>
      <figcaption id={summaryId} className="border-t border-line-subtle pt-3 text-[0.8125rem]/5 text-ink-secondary">
        {summary}
      </figcaption>
    </figure>
  );
}

function peakPoint(data: TimeSeriesPoint[], key: RevenueMetric | 'newCustomers') {
  return data.reduce<TimeSeriesPoint | undefined>(
    (peak, point) => !peak || point[key] > peak[key] ? point : peak,
    undefined,
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
  metric?: RevenueMetric;
}) {
  const animate = !usePrefersReducedMotion();
  const gradientId = useId();
  const compareGross = mode === 'area' && metric === 'netRevenue';
  const { peak, grossPeak } = useMemo(() => ({
    peak: peakPoint(data, metric),
    grossPeak: compareGross ? peakPoint(data, 'grossRevenue') : undefined,
  }), [data, metric, compareGross]);
  const name = compareGross ? 'Net and gross revenue by period' : `${METRIC_LABELS[metric]} by period`;
  const formatMetric = (key: TooltipMetric, value: number, compact = false) =>
    key === 'orders' ? formatNumber(value, numberFormat) : formatCurrency(value, currency, numberFormat, compact);

  const legend: SeriesItem[] = [
    { label: METRIC_LABELS[metric], color: PRIMARY_SERIES, mark: mode === 'bar' ? 'square' : 'line' },
  ];
  if (compareGross) {
    legend.push({ label: METRIC_LABELS.grossRevenue, color: SECONDARY_SERIES, mark: 'dashed' });
  }

  const tooltipExtras: Record<typeof mode, TooltipMetric[]> = {
    bar: ['netRevenue', 'grossRevenue', 'orders'],
    line: ['netRevenue', 'aov'],
    area: ['netRevenue', 'grossRevenue', 'refunds', 'orders', 'aov'],
  };
  const tooltipMetrics = [metric, ...tooltipExtras[mode].filter((key) => key !== metric)];
  const renderTooltip = ({ active, payload, label }: Pick<TooltipContentProps<number, string>, 'active' | 'payload' | 'label'>) => {
    if (!active || !payload.length) return null;
    const point = payload[0].payload as TimeSeriesPoint;

    return (
      <ChartTooltip
        title={label ?? point.label}
        rows={tooltipMetrics.map((key) => {
          const plottedSeries = legend.find((item) => item.label === METRIC_LABELS[key]);
          return { ...plottedSeries, label: METRIC_LABELS[key], value: formatMetric(key, point[key]) };
        })}
      />
    );
  };

  const xAxis = (
    <XAxis
      dataKey="label"
      tick={AXIS_TICK}
      axisLine={{ stroke: 'var(--border)' }}
      tickLine={false}
      tickMargin={8}
      minTickGap={16}
      interval="preserveStartEnd"
    />
  );
  const yAxis = (
    <YAxis
      tickFormatter={(value: number) => formatMetric(metric, value, true)}
      tick={AXIS_TICK}
      axisLine={false}
      tickLine={false}
      tickMargin={8}
      tickCount={5}
      width="auto"
      allowDecimals={metric !== 'orders'}
    />
  );
  const grid = <CartesianGrid stroke={GRID_STROKE} vertical={false} />;
  const cursor = mode === 'bar' ? CURSOR_BAND : CURSOR_LINE;
  const tooltip = <Tooltip cursor={cursor} content={renderTooltip} />;
  const summary = peak ? (
    <>
      <span className="font-medium text-ink">Peak {METRIC_LABELS[metric].toLowerCase()}</span>{' '}
      <span className="font-semibold text-ink tabular-nums">{formatMetric(metric, peak[metric])}</span>
      {` (${peak.label})`}
      {grossPeak && (
        <>
          {' · '}<span className="font-medium text-ink">Peak gross revenue</span>{' '}
          <span className="font-semibold text-ink tabular-nums">{formatMetric('grossRevenue', grossPeak.grossRevenue)}</span>
          {` (${grossPeak.label})`}
        </>
      )}
    </>
  ) : 'No data for this reporting window.';

  return (
    <TrendFigure name={name} legend={legend} summary={summary}>
      {mode === 'bar' ? (
        <BarChart data={data} margin={CHART_MARGIN} title={name}>
          {grid}
          {xAxis}
          {yAxis}
          {tooltip}
          <Bar
            dataKey={metric}
            name={METRIC_LABELS[metric]}
            fill={PRIMARY_SERIES}
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
            isAnimationActive={animate}
          />
        </BarChart>
      ) : mode === 'line' ? (
        <LineChart data={data} margin={CHART_MARGIN} title={name}>
          {grid}
          {xAxis}
          {yAxis}
          {tooltip}
          <Line
            type="monotone"
            dataKey={metric}
            name={METRIC_LABELS[metric]}
            stroke={PRIMARY_SERIES}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, stroke: 'var(--surface-raised)', strokeWidth: 2 }}
            isAnimationActive={animate}
          />
        </LineChart>
      ) : (
        <AreaChart data={data} margin={CHART_MARGIN} title={name}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: PRIMARY_SERIES, stopOpacity: 0.22 }} />
              <stop offset="100%" style={{ stopColor: PRIMARY_SERIES, stopOpacity: 0.04 }} />
            </linearGradient>
          </defs>
          {grid}
          {xAxis}
          {yAxis}
          {tooltip}
          <Area
            type="monotone"
            dataKey={metric}
            name={METRIC_LABELS[metric]}
            stroke={PRIMARY_SERIES}
            strokeWidth={2}
            fillOpacity={1}
            fill={`url(#${gradientId})`}
            activeDot={{ r: 4, stroke: 'var(--surface-raised)', strokeWidth: 2 }}
            isAnimationActive={animate}
          />
          {compareGross && (
            <Area
              type="monotone"
              dataKey="grossRevenue"
              name={METRIC_LABELS.grossRevenue}
              stroke={SECONDARY_SERIES}
              strokeWidth={2}
              strokeDasharray="5 4"
              fill="none"
              activeDot={{ r: 3, stroke: 'var(--surface-raised)', strokeWidth: 2 }}
              isAnimationActive={animate}
            />
          )}
        </AreaChart>
      )}
    </TrendFigure>
  );
}

const VELOCITY_LEGEND: SeriesItem[] = [
  { label: 'Orders', color: PRIMARY_SERIES },
  { label: 'New customers', color: SECONDARY_SERIES, mark: 'striped' },
];
const VELOCITY_NAME = 'Orders and new customers by period';

export function OrdersAndCustomerGrowthChart({
  data,
  numberFormat = 'en-US',
}: {
  data: TimeSeriesPoint[];
  numberFormat?: NumberFormatOption;
}) {
  const animate = !usePrefersReducedMotion();
  const patternId = useId();
  const peakOrders = useMemo(() => peakPoint(data, 'orders'), [data]);
  const peakCustomers = useMemo(() => peakPoint(data, 'newCustomers'), [data]);
  const summary = peakOrders && peakCustomers ? (
    <>
      <span className="font-medium text-ink">Peak orders</span>{' '}
      <span className="font-semibold text-ink tabular-nums">{formatNumber(peakOrders.orders, numberFormat)}</span>
      { ` (${peakOrders.label}) · ` }
      <span className="font-medium text-ink">Peak new customers</span>{' '}
      <span className="font-semibold text-ink tabular-nums">{formatNumber(peakCustomers.newCustomers, numberFormat)}</span>
      { ` (${peakCustomers.label})` }
    </>
  ) : 'No data for this reporting window.';

  return (
    <TrendFigure name={VELOCITY_NAME} summary={summary} legend={VELOCITY_LEGEND}>
      <BarChart data={data} margin={CHART_MARGIN} barGap={2} title={VELOCITY_NAME}>
        <defs>
          <pattern id={patternId} width={4} height={4} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={4} height={4} fill={SECONDARY_SERIES} />
            <path d="M 0 0 V 4" stroke="var(--surface-raised)" strokeWidth={1.5} />
          </pattern>
        </defs>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis
          dataKey="label"
          tick={AXIS_TICK}
          axisLine={{ stroke: 'var(--border)' }}
          tickLine={false}
          tickMargin={8}
          minTickGap={16}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={(value: number) => formatNumber(value, numberFormat)}
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          tickMargin={8}
          tickCount={5}
          width="auto"
          allowDecimals={false}
        />
        <Tooltip
          cursor={CURSOR_BAND}
          content={({ active, payload, label }) => {
            if (!active || !payload.length) return null;
            const point = payload[0].payload as TimeSeriesPoint;
            return (
              <ChartTooltip
                title={label ?? point.label}
                rows={[
                  { ...VELOCITY_LEGEND[0], value: formatNumber(point.orders, numberFormat) },
                  { ...VELOCITY_LEGEND[1], value: formatNumber(point.newCustomers, numberFormat) },
                ]}
              />
            );
          }}
        />
        <Bar
          dataKey="orders"
          name="Orders"
          fill={PRIMARY_SERIES}
          radius={[4, 4, 0, 0]}
          maxBarSize={16}
          isAnimationActive={animate}
        />
        <Bar
          dataKey="newCustomers"
          name="New customers"
          fill={`url(#${patternId})`}
          radius={[4, 4, 0, 0]}
          maxBarSize={16}
          isAnimationActive={animate}
        />
      </BarChart>
    </TrendFigure>
  );
}

const CHANNEL_COLORS: Record<ChannelBreakdownItem['channel'], string> = {
  'Direct Enterprise': CHART_PALETTE[0],
  'Self-Serve Web': CHART_PALETTE[1],
  'Partner Channel': CHART_PALETTE[2],
  Marketplace: CHART_PALETTE[3],
};

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
  const summaryId = useId();
  const total = useMemo(() => data.reduce((sum, item) => sum + item.netRevenue, 0), [data]);
  const leadingChannel = data[0];
  const money = (value: number, compact = false) => formatCurrency(value, currency, numberFormat, compact);
  const share = (value: number) => `${formatNumber(value, numberFormat)}%`;

  return (
    <figure aria-label="Net revenue by sales channel" aria-describedby={summaryId} className="@container min-w-0">
      <figcaption id={summaryId} className="sr-only">
        {total > 0 && leadingChannel
          ? `${money(total)} in total net revenue. ${leadingChannel.channel} contributed the largest share at ${share(leadingChannel.sharePercent)}.`
          : 'No realized revenue in this reporting window.'}
      </figcaption>
      <div className="grid min-w-0 grid-cols-1 items-center gap-3 @md:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] @md:gap-5">
        <div className="relative h-48 w-full min-w-0 @sm:h-[208px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <PieChart title="Share of net revenue by channel">
              <Pie
                data={data}
                dataKey="netRevenue"
                nameKey="channel"
                innerRadius="66%"
                outerRadius="96%"
                startAngle={90}
                endAngle={-270}
                paddingAngle={2}
                stroke="var(--surface-raised)"
                strokeWidth={2}
                isAnimationActive={animate}
              >
                {data.map((entry) => (
                  <Cell key={entry.channel} fill={CHANNEL_COLORS[entry.channel]} />
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
                          value: money(item.netRevenue),
                          color: CHANNEL_COLORS[item.channel],
                        },
                        { label: 'Share', value: share(item.sharePercent) },
                      ]}
                    />
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-sm text-ink-secondary">Total net</span>
            <span className="text-xl/7 font-semibold tabular-nums text-ink">
              {money(total, true)}
            </span>
          </div>
        </div>
        <table className="w-full border-collapse text-[0.8125rem]/5 tabular-nums">
          <caption className="sr-only">Channel share and net revenue</caption>
          <thead className="text-left text-xs text-ink-muted">
            <tr>
              <th scope="col" className="pb-2 font-medium">Channel</th>
              <th scope="col" className="pb-2 pl-2 text-right font-medium">Share</th>
              <th scope="col" className="pb-2 pl-2 text-right font-medium">Net revenue</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.channel} className="border-t border-line-subtle">
                <th scope="row" className="py-2 text-left font-medium text-ink-secondary">
                  <span className="flex items-center gap-2">
                    <SeriesSwatch color={CHANNEL_COLORS[item.channel]} />
                    <span>{item.channel}</span>
                  </span>
                </th>
                <td className="py-2 pl-2 text-right font-semibold text-ink">{share(item.sharePercent)}</td>
                <td className="py-2 pl-2 text-right text-ink-secondary">
                  <span aria-hidden="true">{money(item.netRevenue, true)}</span>
                  <span className="sr-only">{money(item.netRevenue)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
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
