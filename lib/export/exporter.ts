import { CurrencyCode, DateFormatOption, NumberFormatOption } from '@/types';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
  try {
    // Compact form for chart axes and sublabels: $0, $950, $80K, $1.2M.
    if (compact) {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        notation: 'compact',
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
      }).format(amount);
    }
    // Full form always carries two decimals: $2,387.00.
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${symbol}${amount.toFixed(2)}`;
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
    const year = d.getUTCFullYear();
    const monthIndex = d.getUTCMonth();
    const day = d.getUTCDate();
    const mm = String(monthIndex + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');

    if (dateFormat === 'yyyy-MM-dd') return `${year}-${mm}-${dd}`;
    if (dateFormat === 'dd/MM/yyyy') return `${dd}/${mm}/${year}`;
    return `${MONTHS_SHORT[monthIndex]} ${day}, ${year}`;
  } catch {
    return isoDate.slice(0, 10);
  }
}

export function formatTimestampUtc(
  isoDate: string | null | undefined,
  dateFormat: DateFormatOption = 'MMM d, yyyy'
): string {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '—';
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  return `${formatDateDisplay(isoDate, dateFormat)} · ${hh}:${min} UTC`;
}

export function getUtcDayKey(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  const ms = Date.parse(isoDate);
  if (!Number.isFinite(ms)) return '';
  return new Date(ms).toISOString().slice(0, 10);
}

export function convertRowsToCsv(headers: string[], rows: Array<Array<string | number>>): string {
  const escapeCell = (cell: string | number): string => {
    const raw = cell ?? '';
    let str = String(raw);
    // Guard string cells against spreadsheet formula injection (=, +, -, @, tab, CR).
    if (typeof raw === 'string' && /^[=+\-@\t\r]/.test(str)) {
      str = `'${str}`;
    }
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
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
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
