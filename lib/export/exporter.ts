import { CurrencyCode, DateFormatOption, NumberFormatOption } from '@/types';
import { format } from 'date-fns';

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: 'CA$',
  AUD: 'A$',
};

export function formatCurrency(
  amount: number,
  currency: CurrencyCode = 'USD',
  locale: NumberFormatOption = 'en-US',
  compact: boolean = false
): string {
  const symbol = CURRENCY_SYMBOLS[currency] || '$';
  if (compact && Math.abs(amount) >= 1_000_000) {
    return `${symbol}${(amount / 1_000_000).toFixed(2)}M`;
  }
  if (compact && Math.abs(amount) >= 10_000) {
    return `${symbol}${(amount / 1_000).toFixed(1)}K`;
  }
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${symbol}${amount.toLocaleString()}`;
  }
}

export function formatNumber(
  value: number,
  locale: NumberFormatOption = 'en-US'
): string {
  try {
    return new Intl.NumberFormat(locale).format(value);
  } catch {
    return String(value);
  }
}

export function formatDateDisplay(
  isoDate: string | null | undefined,
  dateFormat: DateFormatOption = 'MMM d, yyyy'
): string {
  if (!isoDate) return '—';
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return '—';
    return format(d, dateFormat);
  } catch {
    return isoDate.slice(0, 10);
  }
}

export function convertRowsToCsv(headers: string[], rows: Array<Array<string | number>>): string {
  const escapeCell = (cell: string | number): string => {
    const str = String(cell ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(',')),
  ];

  return lines.join('\n');
}

export function triggerBrowserDownload(
  content: string,
  filename: string,
  mimeType: string = 'text/csv;charset=utf-8;'
): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
