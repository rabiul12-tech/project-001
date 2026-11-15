'use client';

import React, { useRef, useState } from 'react';
import {
  Download,
  Upload,
  RotateCcw,
  Save,
  Sun,
  Moon,
  Database,
  Info,
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { triggerBrowserDownload } from '@/lib/export/exporter';
import { workspaceSettingsSchema } from '@/lib/validation/schemas';
import { canPerformAction, getPermissionDeniedMessage } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/primitives';
import { ConfirmDialog } from '@/components/ui/overlays';
import {
  CurrencyCode,
  DateFormatOption,
  NumberFormatOption,
  WorkspaceSettings,
} from '@/types';

interface SettingsPreferencesFormProps {
  settings: WorkspaceSettings;
  canManageSettings: boolean;
  onSavePreferences: (next: WorkspaceSettings) => boolean;
  onSetTheme: (theme: 'light' | 'dark') => void;
  onSetSidebarCollapsed: (collapsed: boolean) => void;
  onDenied: () => void;
}

export default function SettingsPage() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const setTheme = useAppStore((s) => s.setTheme);
  const setSidebarCollapsed = useAppStore((s) => s.setSidebarCollapsed);
  const getExportSnapshot = useAppStore((s) => s.getExportSnapshot);
  const importBackupJson = useAppStore((s) => s.importBackupJson);
  const resetDemoData = useAppStore((s) => s.resetDemoData);
  const addToast = useAppStore((s) => s.addToast);

  const canManageSettings = canPerformAction(settings.activeRolePreview, 'manage_settings');
  const canManageBackups = canPerformAction(settings.activeRolePreview, 'manage_backups_and_reset');

  const [importError, setImportError] = useState<string | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const formSyncKey = [
    settings.personalName,
    settings.personalEmail,
    settings.personalTitle,
    settings.workspaceName,
    settings.companyDomain,
    settings.companyLogoText,
    settings.currency,
    settings.language,
    settings.dateFormat,
    settings.numberFormat,
    settings.notifications.highValueOrders,
    settings.notifications.refundAlerts,
    settings.notifications.lowInventoryWarnings,
    settings.notifications.weeklyDigest,
  ].join('|');

  const handleSavePreferences = (next: WorkspaceSettings) => {
    const parsed = workspaceSettingsSchema.safeParse(next);
    if (!parsed.success) {
      addToast('Validation failed', parsed.error.issues[0]?.message || 'Check your input fields.', 'error');
      return false;
    }
    updateSettings(parsed.data);
    return true;
  };

  const handleExportBackup = () => {
    if (!canManageBackups) {
      addToast(
        'Permission restricted',
        getPermissionDeniedMessage(settings.activeRolePreview, 'manage_backups_and_reset'),
        'warning'
      );
      return;
    }
    const snapshot = getExportSnapshot();
    triggerBrowserDownload(
      JSON.stringify(snapshot, null, 2),
      `aurelix-workspace-backup-${new Date().toISOString().slice(0, 10)}.json`,
      'application/json'
    );
    addToast('JSON backup exported', 'Full workspace state saved to your device.', 'success');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    if (!canManageBackups) {
      setImportError(getPermissionDeniedMessage(settings.activeRolePreview, 'manage_backups_and_reset'));
      e.target.value = '';
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      setImportError('Backup file exceeds the 15 MB maximum limit.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result || '');
      const res = importBackupJson(content);
      if (!res.ok) {
        setImportError(res.error || 'Backup file validation failed.');
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      setImportError('Could not read the selected JSON file.');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workspace & System Settings"
        subtitle="Configure executive profile, display currency, regional number formatting, theme preferences, and LocalStorage backups."
        meta={`Schema v1 · Domain: ${settings.companyDomain}`}
      />

      <SettingsPreferencesForm
        key={formSyncKey}
        settings={settings}
        canManageSettings={canManageSettings}
        onSavePreferences={handleSavePreferences}
        onSetTheme={setTheme}
        onSetSidebarCollapsed={setSidebarCollapsed}
        onDenied={() =>
          addToast(
            'Permission restricted',
            getPermissionDeniedMessage(settings.activeRolePreview, 'manage_settings'),
            'warning'
          )
        }
      />

      {/* Data Management: Export Backup, Import Backup, Reset Demo Data */}
      <div className="p-6 rounded-xl bg-surface-raised border border-line space-y-4">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-accent" />
          <h2 className="text-heading text-ink">
            LocalStorage Data Management, JSON Backup & Reset
          </h2>
        </div>
        <p className="text-sm text-ink-secondary max-w-3xl leading-relaxed">
          Export your entire workspace state (customers, products, orders, reports, activity logs, and settings) as a portable JSON file, restore from a validated backup, or reset to the clean deterministic seed dataset.
        </p>

        {importError && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-danger">
            {importError}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            disabled={!canManageBackups}
            title={!canManageBackups ? getPermissionDeniedMessage(settings.activeRolePreview, 'manage_backups_and_reset') : undefined}
            onClick={handleExportBackup}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-surface-hover text-white hover:bg-blue-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Full Backup (JSON)</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            type="button"
            disabled={!canManageBackups}
            title={!canManageBackups ? getPermissionDeniedMessage(settings.activeRolePreview, 'manage_backups_and_reset') : undefined}
            onClick={() => {
              if (!canManageBackups) {
                addToast(
                  'Permission restricted',
                  getPermissionDeniedMessage(settings.activeRolePreview, 'manage_backups_and_reset'),
                  'warning'
                );
                return;
              }
              fileInputRef.current?.click();
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-surface-sunken border border-line text-ink-secondary hover:bg-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Backup (JSON)</span>
          </button>

          <button
            type="button"
            disabled={!canManageBackups}
            title={!canManageBackups ? getPermissionDeniedMessage(settings.activeRolePreview, 'manage_backups_and_reset') : undefined}
            onClick={() => {
              if (!canManageBackups) {
                addToast(
                  'Permission restricted',
                  getPermissionDeniedMessage(settings.activeRolePreview, 'manage_backups_and_reset'),
                  'warning'
                );
                return;
              }
              setConfirmResetOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-red-600/10 text-danger hover:bg-red-600/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo Dataset</span>
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmResetOpen}
        onClose={() => setConfirmResetOpen(false)}
        onConfirm={resetDemoData}
        title="Reset Workspace to Default Demo Data?"
        description="This will overwrite any custom customers, orders, products, or settings stored in your browser's LocalStorage and restore the original deterministic seed dataset (250 customers, 80 products, 1,200 orders)."
        confirmLabel="Restore Default Seed"
      />
    </div>
  );
}

function SettingsPreferencesForm({
  settings,
  canManageSettings,
  onSavePreferences,
  onSetTheme,
  onSetSidebarCollapsed,
  onDenied,
}: SettingsPreferencesFormProps) {
  const [personalName, setPersonalName] = useState(settings.personalName);
  const [personalEmail, setPersonalEmail] = useState(settings.personalEmail);
  const [personalTitle, setPersonalTitle] = useState(settings.personalTitle);
  const [workspaceName, setWorkspaceName] = useState(settings.workspaceName);
  const [companyDomain, setCompanyDomain] = useState(settings.companyDomain);
  const [companyLogoText, setCompanyLogoText] = useState(settings.companyLogoText);

  const [currency, setCurrency] = useState<CurrencyCode>(settings.currency);
  const [language, setLanguage] = useState(settings.language);
  const [dateFormat, setDateFormat] = useState<DateFormatOption>(settings.dateFormat);
  const [numberFormat, setNumberFormat] = useState<NumberFormatOption>(settings.numberFormat);

  const [highValueOrders, setHighValueOrders] = useState(settings.notifications.highValueOrders);
  const [refundAlerts, setRefundAlerts] = useState(settings.notifications.refundAlerts);
  const [lowInventoryWarnings, setLowInventoryWarnings] = useState(
    settings.notifications.lowInventoryWarnings
  );
  const [weeklyDigest, setWeeklyDigest] = useState(settings.notifications.weeklyDigest);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageSettings) {
      onDenied();
      return;
    }
    const candidate: WorkspaceSettings = {
      ...settings,
      personalName: personalName.trim(),
      personalEmail: personalEmail.trim(),
      personalTitle: personalTitle.trim(),
      workspaceName: workspaceName.trim(),
      companyDomain: companyDomain.trim(),
      companyLogoText: companyLogoText.trim().slice(0, 4).toUpperCase() || 'AX',
      currency,
      language,
      dateFormat,
      numberFormat,
      notifications: {
        highValueOrders,
        refundAlerts,
        lowInventoryWarnings,
        weeklyDigest,
      },
    };
    const parsed = workspaceSettingsSchema.safeParse(candidate);
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message || 'Check your input fields.');
      return;
    }
    setValidationError(null);
    onSavePreferences(parsed.data);
  };

  return (
      <form onSubmit={handleSaveSettings} className="space-y-6 text-xs">
        {validationError && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-danger">
            {validationError}
          </div>
        )}
        {/* Personal Profile & Workspace Identity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-6 rounded-xl bg-surface-raised border border-line space-y-4">
            <div>
              <h2 className="text-heading text-ink">
                Personal Executive Profile
              </h2>
              <p className="text-xs text-ink-muted mt-1">
                Used for report attributions and activity audit logs
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-medium text-ink-secondary mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={personalName}
                  onChange={(e) => setPersonalName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line"
                />
              </div>

              <div>
                <label className="block font-medium text-ink-secondary mb-1">
                  Corporate Email
                </label>
                <input
                  type="email"
                  value={personalEmail}
                  onChange={(e) => setPersonalEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line"
                />
              </div>

              <div>
                <label className="block font-medium text-ink-secondary mb-1">
                  Executive Title
                </label>
                <input
                  type="text"
                  value={personalTitle}
                  onChange={(e) => setPersonalTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line"
                />
              </div>
            </div>
          </div>

          <div className="p-6 rounded-xl bg-surface-raised border border-line space-y-4">
            <div>
              <h2 className="text-heading text-ink">
                Workspace & Brand Identity
              </h2>
              <p className="text-xs text-ink-muted mt-1">
                Configure organization name, domain, and sidebar monogram
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-medium text-ink-secondary mb-1">
                  Workspace Name
                </label>
                <input
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-ink-secondary mb-1">
                    Company Domain
                  </label>
                  <input
                    type="text"
                    value={companyDomain}
                    onChange={(e) => setCompanyDomain(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line tabular-nums"
                  />
                </div>

                <div>
                  <label className="block font-medium text-ink-secondary mb-1">
                    Company Logo Monogram
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={companyLogoText}
                    onChange={(e) => setCompanyLogoText(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line tabular-nums uppercase"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Regional Formatting & Display Currency */}
        <div className="p-6 rounded-xl bg-surface-raised border border-line space-y-4">
          <div>
            <h2 className="text-heading text-ink">
              Currency, Date & Number Formatting
            </h2>
            <p className="text-ink-muted">
              Configure display localization across all KPIs, charts, and exported reports
            </p>
          </div>

          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-3 text-ink-secondary">
            <Info className="w-4 h-4 text-accent mt-1 shrink-0" />
            <span>
              <strong>Display Currency Notice:</strong> Changing the display currency updates currency symbols and formatting across the workspace for the demo dataset. It does not silently convert underlying ledger amounts using invented foreign exchange rates.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block font-medium text-ink-secondary mb-1">
                Display Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line tabular-nums"
              >
                <option value="USD">USD ($) — US Dollar</option>
                <option value="EUR">EUR (€) — Euro</option>
                <option value="GBP">GBP (£) — British Pound</option>
                <option value="CAD">CAD (CA$) — Canadian Dollar</option>
                <option value="AUD">AUD (A$) — Australian Dollar</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-ink-secondary mb-1">
                Language Display
              </label>
              <select
                value={language}
                onChange={(e) =>
                  setLanguage(
                    e.target.value as 'English (US)' | 'English (UK)' | 'Deutsch' | 'Français'
                  )
                }
                className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line"
              >
                <option value="English (US)">English (US)</option>
                <option value="English (UK)">English (UK)</option>
                <option value="Deutsch">Deutsch</option>
                <option value="Français">Français</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-ink-secondary mb-1">
                Date Format
              </label>
              <select
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value as DateFormatOption)}
                className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line tabular-nums"
              >
                <option value="MMM d, yyyy">Nov 13, 2026 (MMM d, yyyy)</option>
                <option value="dd/MM/yyyy">13/11/2026 (dd/MM/yyyy)</option>
                <option value="yyyy-MM-dd">2026-11-13 (ISO 8601)</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-ink-secondary mb-1">
                Number Formatting Locale
              </label>
              <select
                value={numberFormat}
                onChange={(e) => setNumberFormat(e.target.value as NumberFormatOption)}
                className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line tabular-nums"
              >
                <option value="en-US">1,234,567.89 (en-US)</option>
                <option value="en-GB">1,234,567.89 (en-GB)</option>
                <option value="de-DE">1.234.567,89 (de-DE)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Theme, Sidebar & Notification Preferences */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-6 rounded-xl bg-surface-raised border border-line space-y-4">
            <div>
              <h2 className="text-heading text-ink">
                Interface Theme & Sidebar Behavior
              </h2>
              <p className="text-ink-muted">
                Immediate visual updates with persistent LocalStorage state
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onSetTheme('light')}
                className={`p-4 rounded-xl border flex items-center gap-3 transition-colors ${
                  settings.theme === 'light'
                    ? 'border-accent bg-surface-raised ring-1 ring-accent text-accent font-semibold'
                    : 'border-line text-ink-secondary'
                }`}
              >
                <Sun className="w-4 h-4" />
                <span>Light Mode</span>
              </button>

              <button
                type="button"
                onClick={() => onSetTheme('dark')}
                className={`p-4 rounded-xl border flex items-center gap-3 transition-colors ${
                  settings.theme === 'dark'
                    ? 'border-blue-400 bg-blue-400/10 text-blue-400 font-semibold'
                    : 'border-line text-ink-secondary'
                }`}
              >
                <Moon className="w-4 h-4" />
                <span>Dark Mode</span>
              </button>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <div>
                <div className="font-semibold text-ink">
                  Compact Icon-Only Sidebar
                </div>
                <div className="text-ink-muted">
                  Collapse desktop navigation to 72px width
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.sidebarCollapsed}
                onChange={(e) => onSetSidebarCollapsed(e.target.checked)}
                className="w-4 h-4 rounded"
              />
            </div>
          </div>

          <div className="p-6 rounded-xl bg-surface-raised border border-line space-y-4">
            <div>
              <h2 className="text-heading text-ink">
                Notification Preferences
              </h2>
              <p className="text-ink-muted">
                Configure which operational events trigger workspace alerts
              </p>
            </div>

            <div className="space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <span>High-Value Order Settlements (≥ $5,000)</span>
                <input
                  type="checkbox"
                  checked={highValueOrders}
                  onChange={(e) => setHighValueOrders(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span>Simulated Refund & Credit Memo Alerts</span>
                <input
                  type="checkbox"
                  checked={refundAlerts}
                  onChange={(e) => setRefundAlerts(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span>Low Inventory Threshold Warnings (≤ 14 units)</span>
                <input
                  type="checkbox"
                  checked={lowInventoryWarnings}
                  onChange={(e) => setLowInventoryWarnings(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span>Weekly Executive KPI Digest</span>
                <input
                  type="checkbox"
                  checked={weeklyDigest}
                  onChange={(e) => setWeeklyDigest(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!canManageSettings}
            title={!canManageSettings ? getPermissionDeniedMessage(settings.activeRolePreview, 'manage_settings') : undefined}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent-strong hover:bg-accent-strong-hover text-white font-semibold shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            <span>Save All Workspace Preferences</span>
          </button>
        </div>
      </form>
  );
}
