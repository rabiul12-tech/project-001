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
      <span className="inline-flex items-center gap-1 text-xs tabular-nums text-ink-muted">
        <Minus className="w-3.5 h-3.5" />
        <span>0.0{suffix}</span>
        {comparisonLabel && (
          <span className="font-normal text-ink-muted">
            · {comparisonLabel}
          </span>
        )}
      </span>
    );
  }

  const colorClass = isGood
    ? 'text-success'
    : 'text-danger';

  const Icon = isPositive ? ArrowUpRight : ArrowDownRight;

  return (
    <span className={`inline-flex items-center gap-1 text-xs tabular-nums font-medium ${colorClass}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>
        {isPositive ? '+' : ''}
        {value.toFixed(1)}
        {suffix}
      </span>
      {comparisonLabel && (
        <span className="font-normal text-ink-muted">
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
      textClass: 'text-success',
      bgClass: 'bg-success/10 border-success/30',
    },
    Fulfilled: {
      icon: CheckCircle2,
      textClass: 'text-success',
      bgClass: 'bg-success/10 border-success/30',
    },
    Active: {
      icon: CheckCircle2,
      textClass: 'text-success',
      bgClass: 'bg-success/10 border-success/30',
    },
    Pending: {
      icon: Clock,
      textClass: 'text-warning',
      bgClass: 'bg-warning/10 border-warning/30',
    },
    Processing: {
      icon: Clock,
      textClass: 'text-accent',
      bgClass: 'bg-accent/10 border-accent/30',
    },
    Scheduled: {
      icon: Clock,
      textClass: 'text-ink-secondary',
      bgClass: 'bg-ink-muted/10 border-ink-muted/30',
    },
    Onboarding: {
      icon: Sparkles,
      textClass: 'text-accent',
      bgClass: 'bg-accent/10 border-accent/30',
    },
    Invited: {
      icon: Clock,
      textClass: 'text-accent',
      bgClass: 'bg-accent/10 border-accent/30',
    },
    'At Risk': {
      icon: AlertTriangle,
      textClass: 'text-warning',
      bgClass: 'bg-warning/10 border-warning/30',
    },
    'Low Stock': {
      icon: AlertTriangle,
      textClass: 'text-warning',
      bgClass: 'bg-warning/10 border-warning/30',
    },
    Refunded: {
      icon: RotateCcw,
      textClass: 'text-warning',
      bgClass: 'bg-warning/10 border-warning/30',
    },
    Failed: {
      icon: XCircle,
      textClass: 'text-danger',
      bgClass: 'bg-danger/10 border-danger/30',
    },
    Canceled: {
      icon: XCircle,
      textClass: 'text-danger',
      bgClass: 'bg-danger/10 border-danger/30',
    },
    Churned: {
      icon: XCircle,
      textClass: 'text-danger',
      bgClass: 'bg-danger/10 border-danger/30',
    },
    Archived: {
      icon: Archive,
      textClass: 'text-ink-muted',
      bgClass: 'bg-ink-muted/10 border-ink-muted/30',
    },
  };

  const item = config[status] || config.Scheduled;
  const Icon = item.icon;

  return (
    <span
      className={`inline-flex items-center gap-2 px-2 py-1 rounded-md text-xs font-medium border whitespace-nowrap shrink-0 ${item.bgClass} ${item.textClass}`}
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
  const interactiveProps = onClick
    ? {
        role: 'button' as const,
        tabIndex: 0,
        onClick,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        },
      }
    : {};

  return (
    <div
      {...interactiveProps}
      className={`card @container flex flex-col justify-between gap-3 transition-colors ${
        onClick ? 'cursor-pointer hover:border-accent' : ''
      }`}
    >
      <span className="text-caption text-ink-secondary truncate" title={label}>
        {label}
      </span>
      <div>
        <div className="text-kpi text-ink truncate" title={value}>
          {value}
        </div>
        {secondaryMeta && (
          <div className="mt-1 text-caption tabular-nums text-ink-muted truncate">
            {secondaryMeta}
          </div>
        )}
      </div>
      {delta !== undefined && (
        <div className="pt-3 border-t border-line-subtle">
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
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-line-subtle">
      <div className="space-y-2 min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-caption text-ink-muted">
          <span>Aurelix Intelligence</span>
          {meta && (
            <>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{meta}</span>
            </>
          )}
        </div>
        <h1 className="text-2xl/8 md:text-title font-semibold text-ink">{title}</h1>
        {subtitle && <p className="text-sm text-ink-secondary max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3 shrink-0">{actions}</div>}
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
      <div className={`relative rounded-lg overflow-hidden shrink-0 border border-line-subtle ${sizeClass}`}>
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
      className={`rounded-lg bg-blue-600/15 dark:bg-blue-400/15 border border-blue-600/25 dark:border-blue-400/25 text-accent font-semibold tabular-nums flex items-center justify-center shrink-0 ${sizeClass}`}
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
    'Enterprise Software': 'bg-blue-600/10 text-accent border-blue-500/20',
    'Cloud Infrastructure': 'bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    'Data Intelligence': 'bg-emerald-600/10 text-success border-emerald-500/20',
    'Security & Compliance': 'bg-amber-600/10 text-warning border-amber-500/20',
    'API & Integrations': 'bg-cyan-600/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    'Advisory Retainer': 'bg-slate-600/10 text-ink-secondary border-slate-500/20',
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
