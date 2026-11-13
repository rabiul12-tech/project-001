'use client';

import React, { useState } from 'react';
import {
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  CheckCircle2,
  Clock,
  RotateCcw,
  XCircle,
  AlertTriangle,
  Archive,
  Sparkles,
  Layers,
  ShieldCheck,
  Database,
  Cpu,
  Terminal,
  Briefcase,
} from 'lucide-react';
import { ProductCategory } from '@/types';

export function TrendIndicator({
  value,
  suffix = '%',
  invertSemantics = false,
  comparisonLabel = 'vs prior period',
}: {
  value: number;
  suffix?: string;
  invertSemantics?: boolean;
  comparisonLabel?: string;
}) {
  const isZero = Math.abs(value) < 0.05;
  const isPositive = value > 0;
  const isGood = invertSemantics ? !isPositive : isPositive;

  if (isZero) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
        <Minus className="w-3.5 h-3.5" />
        <span>0.0{suffix}</span>
        {comparisonLabel && (
          <span className="font-sans text-slate-400 dark:text-slate-500 ml-0.5">
            · {comparisonLabel}
          </span>
        )}
      </span>
    );
  }

  const colorClass = isGood
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-600 dark:text-red-400';

  const Icon = isPositive ? ArrowUpRight : ArrowDownRight;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-mono tabular-nums font-medium ${colorClass}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>
        {isPositive ? '+' : ''}
        {value.toFixed(1)}
        {suffix}
      </span>
      {comparisonLabel && (
        <span className="font-sans font-normal text-slate-500 dark:text-slate-400 ml-0.5">
          · {comparisonLabel}
        </span>
      )}
    </span>
  );
}

export function StatusBadge({
  status,
}: {
  status:
    | 'Paid'
    | 'Pending'
    | 'Refunded'
    | 'Failed'
    | 'Fulfilled'
    | 'Processing'
    | 'Scheduled'
    | 'Canceled'
    | 'Active'
    | 'At Risk'
    | 'Churned'
    | 'Onboarding'
    | 'Low Stock'
    | 'Archived'
    | 'Invited';
}) {
  const config: Record<
    string,
    { icon: React.ComponentType<{ className?: string }>; textClass: string; bgClass: string }
  > = {
    Paid: {
      icon: CheckCircle2,
      textClass: 'text-emerald-700 dark:text-emerald-300',
      bgClass: 'bg-emerald-500/10 border-emerald-500/20',
    },
    Fulfilled: {
      icon: CheckCircle2,
      textClass: 'text-emerald-700 dark:text-emerald-300',
      bgClass: 'bg-emerald-500/10 border-emerald-500/20',
    },
    Active: {
      icon: CheckCircle2,
      textClass: 'text-emerald-700 dark:text-emerald-300',
      bgClass: 'bg-emerald-500/10 border-emerald-500/20',
    },
    Pending: {
      icon: Clock,
      textClass: 'text-amber-700 dark:text-amber-300',
      bgClass: 'bg-amber-500/10 border-amber-500/20',
    },
    Processing: {
      icon: Clock,
      textClass: 'text-blue-700 dark:text-blue-300',
      bgClass: 'bg-blue-500/10 border-blue-500/20',
    },
    Scheduled: {
      icon: Clock,
      textClass: 'text-slate-700 dark:text-slate-300',
      bgClass: 'bg-slate-500/10 border-slate-500/20',
    },
    Onboarding: {
      icon: Sparkles,
      textClass: 'text-blue-700 dark:text-blue-300',
      bgClass: 'bg-blue-500/10 border-blue-500/20',
    },
    Invited: {
      icon: Clock,
      textClass: 'text-blue-700 dark:text-blue-300',
      bgClass: 'bg-blue-500/10 border-blue-500/20',
    },
    'At Risk': {
      icon: AlertTriangle,
      textClass: 'text-amber-700 dark:text-amber-300',
      bgClass: 'bg-amber-500/10 border-amber-500/20',
    },
    'Low Stock': {
      icon: AlertTriangle,
      textClass: 'text-amber-700 dark:text-amber-300',
      bgClass: 'bg-amber-500/10 border-amber-500/20',
    },
    Refunded: {
      icon: RotateCcw,
      textClass: 'text-amber-700 dark:text-amber-300',
      bgClass: 'bg-amber-500/10 border-amber-500/20',
    },
    Failed: {
      icon: XCircle,
      textClass: 'text-red-700 dark:text-red-300',
      bgClass: 'bg-red-500/10 border-red-500/20',
    },
    Canceled: {
      icon: XCircle,
      textClass: 'text-red-700 dark:text-red-300',
      bgClass: 'bg-red-500/10 border-red-500/20',
    },
    Churned: {
      icon: XCircle,
      textClass: 'text-red-700 dark:text-red-300',
      bgClass: 'bg-red-500/10 border-red-500/20',
    },
    Archived: {
      icon: Archive,
      textClass: 'text-slate-600 dark:text-slate-400',
      bgClass: 'bg-slate-500/10 border-slate-500/20',
    },
  };

  const item = config[status] || config.Scheduled;
  const Icon = item.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border whitespace-nowrap shrink-0 ${item.bgClass} ${item.textClass}`}
    >
      <Icon className="w-3 h-3 shrink-0" />
      <span>{status}</span>
    </span>
  );
}

export function KPIStatCard({
  label,
  value,
  delta,
  invertDelta = false,
  secondaryMeta,
  onClick,
}: {
  label: string;
  value: string;
  delta?: number;
  invertDelta?: boolean;
  secondaryMeta?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`p-5 rounded-xl bg-white dark:bg-[#141C2D] border border-slate-200 dark:border-[#273247] flex flex-col justify-between gap-3 transition-colors ${
        onClick ? 'cursor-pointer hover:border-blue-500/50 dark:hover:border-blue-400/50' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
        {secondaryMeta && (
          <span className="text-xs font-mono tabular-nums text-slate-400 dark:text-slate-500">
            {secondaryMeta}
          </span>
        )}
      </div>
      <div className="text-2xl sm:text-[28px] font-bold font-mono tabular-nums tracking-tight text-slate-900 dark:text-slate-50">
        {value}
      </div>
      {delta !== undefined && (
        <div className="pt-1 border-t border-slate-100 dark:border-slate-800/70">
          <TrendIndicator value={delta} invertSemantics={invertDelta} />
        </div>
      )}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  meta,
  actions,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-[#273247]">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>Aurelix Intelligence</span>
          {meta && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{meta}</span>
            </>
          )}
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5 shrink-0">{actions}</div>}
    </div>
  );
}

export function UserAvatar({
  name,
  src,
  size = 'md',
}: {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [imgError, setImgError] = useState(false);
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const sizeClass =
    size === 'sm'
      ? 'w-7 h-7 text-xs'
      : size === 'lg'
      ? 'w-11 h-11 text-sm'
      : 'w-8 h-8 text-xs';

  if (src && !imgError) {
    return (
      <div className={`relative rounded-lg overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 ${sizeClass}`}>
        <img
          src={src}
          alt={name}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg bg-blue-600/15 dark:bg-blue-400/15 border border-blue-600/25 dark:border-blue-400/25 text-blue-700 dark:text-blue-300 font-semibold font-mono flex items-center justify-center shrink-0 ${sizeClass}`}
      aria-label={name}
    >
      {initials || 'AX'}
    </div>
  );
}

export function ProductArtwork({
  category,
  sku,
  size = 'md',
}: {
  category: ProductCategory;
  sku: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const iconMap: Record<ProductCategory, React.ComponentType<{ className?: string }>> = {
    'Enterprise Software': Layers,
    'Cloud Infrastructure': Cpu,
    'Data Intelligence': Database,
    'Security & Compliance': ShieldCheck,
    'API & Integrations': Terminal,
    'Advisory Retainer': Briefcase,
  };

  const colorMap: Record<ProductCategory, string> = {
    'Enterprise Software': 'bg-blue-600/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    'Cloud Infrastructure': 'bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    'Data Intelligence': 'bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    'Security & Compliance': 'bg-amber-600/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    'API & Integrations': 'bg-cyan-600/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    'Advisory Retainer': 'bg-slate-600/10 text-slate-700 dark:text-slate-300 border-slate-500/20',
  };

  const Icon = iconMap[category] || Layers;
  const boxSize =
    size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-14 h-14' : 'w-10 h-10';
  const iconSize = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5';

  return (
    <div
      className={`${boxSize} rounded-lg border flex flex-col items-center justify-center shrink-0 ${
        colorMap[category] || colorMap['Enterprise Software']
      }`}
      title={`${category} · ${sku}`}
    >
      <Icon className={iconSize} />
    </div>
  );
}
