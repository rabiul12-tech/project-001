'use client';

import React from 'react';
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

const CHART_PALETTE = ['#2563EB', '#059669', '#D97706', '#7C3AED', '#0891B2', '#64748B'];

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
  const formatVal = (v: number) => {
    if (metric === 'orders') return v.toLocaleString();
    return formatCurrency(v, currency, numberFormat, true);
  };

  return (
    <div className="w-full h-[300px]" role="img" aria-label="Revenue and orders trend chart">
      <ResponsiveContainer width="100%" height="100%">
        {mode === 'bar' ? (
          <BarChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#64748B' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatVal}
              tick={{ fontSize: 11, fill: '#64748B' }}
              axisLine={false}
              tickLine={false}
              width={68}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                const point = payload[0].payload as TimeSeriesPoint;
                return (
                  <div className="p-3 rounded-xl bg-white dark:bg-[#141C2D] border border-slate-200 dark:border-[#273247] shadow-xl text-xs space-y-1.5">
                    <div className="font-bold text-slate-900 dark:text-slate-100">{label}</div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-500">Net Revenue:</span>
                      <span className="font-mono tabular-nums font-semibold text-blue-600 dark:text-blue-400">
                        {formatCurrency(point.netRevenue, currency, numberFormat)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-500">Gross Revenue:</span>
                      <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {formatCurrency(point.grossRevenue, currency, numberFormat)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-500">Orders:</span>
                      <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                        {point.orders}
                      </span>
                    </div>
                  </div>
                );
              }}
            />
            <Bar dataKey={metric} fill="#2563EB" radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : mode === 'line' ? (
          <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#64748B' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatVal}
              tick={{ fontSize: 11, fill: '#64748B' }}
              axisLine={false}
              tickLine={false}
              width={68}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                const point = payload[0].payload as TimeSeriesPoint;
                return (
                  <div className="p-3 rounded-xl bg-white dark:bg-[#141C2D] border border-slate-200 dark:border-[#273247] shadow-xl text-xs space-y-1.5">
                    <div className="font-bold text-slate-900 dark:text-slate-100">{label}</div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-500">Net Revenue:</span>
                      <span className="font-mono tabular-nums font-semibold text-blue-600 dark:text-blue-400">
                        {formatCurrency(point.netRevenue, currency, numberFormat)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-500">Average Order:</span>
                      <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {formatCurrency(point.aov, currency, numberFormat)}
                      </span>
                    </div>
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey={metric}
              stroke="#2563EB"
              strokeWidth={2.2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        ) : (
          <AreaChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="aurelixNetRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563EB" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="aurelixGrossRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#059669" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#64748B' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatVal}
              tick={{ fontSize: 11, fill: '#64748B' }}
              axisLine={false}
              tickLine={false}
              width={68}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                const point = payload[0].payload as TimeSeriesPoint;
                return (
                  <div className="p-3 rounded-xl bg-white dark:bg-[#141C2D] border border-slate-200 dark:border-[#273247] shadow-xl text-xs space-y-1.5">
                    <div className="font-bold text-slate-900 dark:text-slate-100">{label}</div>
                    <div className="flex items-center justify-between gap-5">
                      <span className="text-slate-500">Net Revenue:</span>
                      <span className="font-mono tabular-nums font-semibold text-blue-600 dark:text-blue-400">
                        {formatCurrency(point.netRevenue, currency, numberFormat)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-5">
                      <span className="text-slate-500">Gross Revenue:</span>
                      <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(point.grossRevenue, currency, numberFormat)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-5">
                      <span className="text-slate-500">Refunds:</span>
                      <span className="font-mono tabular-nums text-amber-600 dark:text-amber-400">
                        {formatCurrency(point.refunds, currency, numberFormat)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-5 border-t border-slate-100 dark:border-slate-800 pt-1">
                      <span className="text-slate-500">Orders · AOV:</span>
                      <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
                        {point.orders} · {formatCurrency(point.aov, currency, numberFormat, true)}
                      </span>
                    </div>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="grossRevenue"
              stroke="#059669"
              strokeWidth={1.5}
              fillOpacity={1}
              fill="url(#aurelixGrossRev)"
            />
            <Area
              type="monotone"
              dataKey={metric}
              stroke="#2563EB"
              strokeWidth={2.2}
              fillOpacity={1}
              fill="url(#aurelixNetRev)"
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export function OrdersAndCustomerGrowthChart({ data }: { data: TimeSeriesPoint[] }) {
  return (
    <div className="w-full h-[260px]" role="img" aria-label="Orders and new customer growth chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#64748B' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#64748B' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload || !payload.length) return null;
              const point = payload[0].payload as TimeSeriesPoint;
              return (
                <div className="p-3 rounded-xl bg-white dark:bg-[#141C2D] border border-slate-200 dark:border-[#273247] shadow-xl text-xs space-y-1">
                  <div className="font-bold text-slate-900 dark:text-slate-100">{label}</div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500">Order Volume:</span>
                    <span className="font-mono tabular-nums font-semibold text-blue-600 dark:text-blue-400">
                      {point.orders}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500">New Customers:</span>
                    <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                      +{point.newCustomers}
                    </span>
                  </div>
                </div>
              );
            }}
          />
          <Bar dataKey="orders" name="Orders" fill="#2563EB" radius={[4, 4, 0, 0]} />
          <Bar dataKey="newCustomers" name="New Customers" fill="#059669" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
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
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4">
      <div className="h-[210px] w-full" role="img" aria-label="Sales by channel distribution">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="netRevenue"
              nameKey="channel"
              innerRadius={54}
              outerRadius={82}
              paddingAngle={3}
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
                  <div className="p-2.5 rounded-xl bg-white dark:bg-[#141C2D] border border-slate-200 dark:border-[#273247] shadow-lg text-xs">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {item.channel}
                    </div>
                    <div className="font-mono tabular-nums text-slate-600 dark:text-slate-300 mt-0.5">
                      {formatCurrency(item.netRevenue, currency, numberFormat)} ({item.sharePercent}%)
                    </div>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2.5">
        {data.map((item, idx) => (
          <div key={item.channel} className="flex items-center justify-between text-xs gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-xs shrink-0"
                style={{ backgroundColor: CHART_PALETTE[idx % CHART_PALETTE.length] }}
              />
              <span className="text-slate-700 dark:text-slate-300 truncate">{item.channel}</span>
            </div>
            <div className="font-mono tabular-nums text-right shrink-0">
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {item.sharePercent}%
              </span>
              <span className="text-slate-400 ml-1.5">
                ({formatCurrency(item.netRevenue, currency, numberFormat, true)})
              </span>
            </div>
          </div>
        ))}
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
    <div className="space-y-3.5">
      {data.map((item, idx) => (
        <div key={item.category} className="space-y-1.5">
          <div className="flex items-center justify-between text-xs gap-2">
            <span className="font-medium text-slate-800 dark:text-slate-200">{item.category}</span>
            <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
              {formatCurrency(item.grossRevenue, currency, numberFormat)} · {item.unitsSold} units (
              {item.sharePercent}%)
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-[#0F1625] overflow-hidden">
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
