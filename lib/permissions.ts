import { TeamRole } from '@/types';

export type PermissionAction =
  | 'view_analytics'
  | 'export_csv'
  | 'manage_reports'
  | 'mutate_customers'
  | 'mutate_products'
  | 'mutate_orders'
  | 'issue_refund'
  | 'manage_team'
  | 'manage_settings'
  | 'manage_backups_and_reset';

const ROLE_CAPABILITIES: Record<TeamRole, Record<PermissionAction, boolean>> = {
  Owner: {
    view_analytics: true,
    export_csv: true,
    manage_reports: true,
    mutate_customers: true,
    mutate_products: true,
    mutate_orders: true,
    issue_refund: true,
    manage_team: true,
    manage_settings: true,
    manage_backups_and_reset: true,
  },
  Admin: {
    view_analytics: true,
    export_csv: true,
    manage_reports: true,
    mutate_customers: true,
    mutate_products: true,
    mutate_orders: true,
    issue_refund: true,
    manage_team: true,
    manage_settings: true,
    manage_backups_and_reset: false,
  },
  Analyst: {
    view_analytics: true,
    export_csv: true,
    manage_reports: true,
    mutate_customers: false,
    mutate_products: false,
    mutate_orders: false,
    issue_refund: true,
    manage_team: false,
    manage_settings: false,
    manage_backups_and_reset: false,
  },
  Viewer: {
    view_analytics: true,
    export_csv: true,
    manage_reports: false,
    mutate_customers: false,
    mutate_products: false,
    mutate_orders: false,
    issue_refund: false,
    manage_team: false,
    manage_settings: false,
    manage_backups_and_reset: false,
  },
};

export interface PermissionMatrixRow {
  capability: string;
  action: PermissionAction;
  Owner: boolean;
  Admin: boolean;
  Analyst: boolean;
  Viewer: boolean;
}

export const PERMISSION_MATRIX: PermissionMatrixRow[] = [
  {
    capability: 'View Executive Overview & Deep Analytics',
    action: 'view_analytics',
    Owner: true,
    Admin: true,
    Analyst: true,
    Viewer: true,
  },
  {
    capability: 'Export CSV Reports & Print Statements',
    action: 'export_csv',
    Owner: true,
    Admin: true,
    Analyst: true,
    Viewer: true,
  },
  {
    capability: 'Create & Edit Report Templates',
    action: 'manage_reports',
    Owner: true,
    Admin: true,
    Analyst: true,
    Viewer: false,
  },
  {
    capability: 'Create & Edit Customers / Products / Orders',
    action: 'mutate_customers',
    Owner: true,
    Admin: true,
    Analyst: false,
    Viewer: false,
  },
  {
    capability: 'Issue Simulated Order Refunds',
    action: 'issue_refund',
    Owner: true,
    Admin: true,
    Analyst: true,
    Viewer: false,
  },
  {
    capability: 'Manage Demo Team Roster & Workspace Settings',
    action: 'manage_team',
    Owner: true,
    Admin: true,
    Analyst: false,
    Viewer: false,
  },
  {
    capability: 'Import / Export Full JSON Backup & Reset Seed',
    action: 'manage_backups_and_reset',
    Owner: true,
    Admin: false,
    Analyst: false,
    Viewer: false,
  },
];

export function canPerformAction(role: TeamRole, action: PermissionAction): boolean {
  return Boolean(ROLE_CAPABILITIES[role]?.[action]);
}

const ACTION_LABELS: Record<PermissionAction, string> = {
  view_analytics: 'view analytics',
  export_csv: 'export CSV reports',
  manage_reports: 'create or modify report templates',
  mutate_customers: 'create, edit, or delete customer records',
  mutate_products: 'create, edit, or archive catalog SKUs',
  mutate_orders: 'create or modify commercial orders',
  issue_refund: 'issue simulated order refunds',
  manage_team: 'modify team members or role assignments',
  manage_settings: 'modify workspace configuration settings',
  manage_backups_and_reset: 'export/import JSON backups or reset seed data',
};

export function getPermissionDeniedMessage(role: TeamRole, action: PermissionAction): string {
  const required =
    action === 'manage_backups_and_reset'
      ? 'Owner'
      : action === 'manage_reports' || action === 'issue_refund'
      ? 'Owner, Admin, or Analyst'
      : 'Owner or Admin';
  return `Blocked by simulated Role Preview (${role}): requires ${required} role to ${ACTION_LABELS[action]}. Switch Role Preview in the sidebar or Team page.`;
}
