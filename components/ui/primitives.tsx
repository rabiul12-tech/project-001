'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
  value: number | null;
  suffix?: string;
  invertSemantics?: boolean;
  comparisonLabel?: string;
}) {
  if (value === null) {
    return (
      <span className="text-caption font-medium text-ink-muted">
        New<span className="sr-only">. The prior period was zero.</span>
      </span>
    );
  }

  const isZero = Math.abs(value) < 0.05;
  const isPositive = value > 0;
  const isGood = invertSemantics ? !isPositive : isPositive;

  if (isZero) {
    return (
      <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-caption tabular-nums text-ink-muted">
        <Minus className="size-3.5 shrink-0" aria-hidden="true" />
        <span>0.0{suffix}</span>
        {comparisonLabel && (
          <span className="font-normal text-ink-muted">
            {comparisonLabel}
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
    <span className={`inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-caption tabular-nums font-medium ${colorClass}`}>
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        {isPositive ? '+' : ''}
        {value.toFixed(1)}
        {suffix}
      </span>
      {comparisonLabel && (
        <span className="font-normal text-ink-muted">
          {comparisonLabel}
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
      <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />
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
  href,
}: {
  label: string;
  value: string;
  delta?: number | null;
  invertDelta?: boolean;
  secondaryMeta?: string;
  href?: string;
}) {
  const layout = 'card @container flex min-w-0 flex-col gap-2.5 p-3.5 sm:p-5';
  const content = (
    <>
      <div className="space-y-1.5">
        <div className="text-caption leading-5 text-ink-secondary wrap-break-word @max-[11rem]:min-h-10">
          {label}
        </div>
        <div className="text-kpi text-ink wrap-anywhere">
          {value}
        </div>
        {secondaryMeta && (
          <div className="text-caption tabular-nums text-ink-muted wrap-anywhere">
            {secondaryMeta}
          </div>
        )}
      </div>
      {delta !== undefined && (
        <div className="mt-auto border-t border-line-subtle pt-2.5">
          <TrendIndicator value={delta} invertSemantics={invertDelta} />
        </div>
      )}
    </>
  );

  return href ? (
    <Link href={href} className={`${layout} transition-colors hover:border-accent hover:bg-surface-hover`}>
      {content}
    </Link>
  ) : (
    <div className={layout}>{content}</div>
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
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-ink-muted">
          <span>Aurelix Intelligence</span>
          {meta && (
            <span className="tabular-nums sm:border-l sm:border-line sm:pl-2">{meta}</span>
          )}
        </div>
        <h1 className="text-2xl/8 md:text-title font-semibold text-ink">{title}</h1>
        {subtitle && <p className="max-w-2xl text-sm/6 text-ink-secondary">{subtitle}</p>}
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
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
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
  const pixels = size === 'sm' ? 28 : size === 'lg' ? 44 : 32;

  if (src && src !== failedSrc) {
    return (
      <div className={`relative rounded-lg overflow-hidden shrink-0 border border-line-subtle ${sizeClass}`}>
        <Image
          src={src}
          alt={name}
          width={pixels}
          height={pixels}
          unoptimized={!src.startsWith('/images/avatar_')}
          referrerPolicy="no-referrer"
          onError={() => setFailedSrc(src)}
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
