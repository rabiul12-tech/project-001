'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  UserPlus,
  Shield,
  Check,
  Minus,
  Trash2,
  Edit3,
  SlidersHorizontal,
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import {
  teamMemberFormSchema,
  TeamMemberFormValues,
} from '@/lib/validation/schemas';
import { PageHeader, StatusBadge, UserAvatar } from '@/components/ui/primitives';
import { ConfirmDialog, ModalDialog } from '@/components/ui/overlays';
import { TeamMember, TeamRole } from '@/types';
import { formatDateDisplay } from '@/lib/export/exporter';

const ROLE_DESCRIPTIONS: Array<{
  role: TeamRole;
  summary: string;
  scope: string;
}> = [
  {
    role: 'Owner',
    summary: 'Full executive governance, workspace configuration, backup restore, and billing ledger control.',
    scope: 'Unrestricted CRUD + System Reset',
  },
  {
    role: 'Admin',
    summary: 'Full operational management across customers, orders, products, reports, and team directory.',
    scope: 'Full Operational CRUD',
  },
  {
    role: 'Analyst',
    summary: 'Financial reconciliation, custom report creation, CSV exports, and order status auditing.',
    scope: 'Analytics, Reports & Order Updates',
  },
  {
    role: 'Viewer',
    summary: 'Read-only board observer access to executive dashboards, analytics, and exported statements.',
    scope: 'Read-Only + CSV Export',
  },
];

const PERMISSION_MATRIX = [
  { capability: 'View Executive Overview & Deep Analytics', Owner: true, Admin: true, Analyst: true, Viewer: true },
  { capability: 'Export CSV Reports & Print Statements', Owner: true, Admin: true, Analyst: true, Viewer: true },
  { capability: 'Create & Edit Report Templates', Owner: true, Admin: true, Analyst: true, Viewer: false },
  { capability: 'Create & Edit Customers / Products / Orders', Owner: true, Admin: true, Analyst: false, Viewer: false },
  { capability: 'Issue Simulated Order Refunds', Owner: true, Admin: true, Analyst: true, Viewer: false },
  { capability: 'Manage Demo Team Roster & Roles', Owner: true, Admin: true, Analyst: false, Viewer: false },
  { capability: 'Import / Export Full JSON Backup & Reset Seed', Owner: true, Admin: false, Analyst: false, Viewer: false },
];

export default function TeamManagementPage() {
  const team = useAppStore((s) => s.team);
  const activities = useAppStore((s) => s.activities);
  const settings = useAppStore((s) => s.settings);
  const addTeamMember = useAppStore((s) => s.addTeamMember);
  const updateTeamMember = useAppStore((s) => s.updateTeamMember);
  const removeTeamMember = useAppStore((s) => s.removeTeamMember);
  const setActiveRolePreview = useAppStore((s) => s.setActiveRolePreview);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TeamMemberFormValues>({
    resolver: zodResolver(teamMemberFormSchema),
    defaultValues: {
      name: '',
      email: '',
      role: 'Analyst',
      title: 'Senior Revenue Analyst',
      department: 'Data & Analytics',
    },
  });

  const openCreateModal = () => {
    setEditingMember(null);
    reset({
      name: '',
      email: '',
      role: 'Analyst',
      title: 'Senior Revenue Analyst',
      department: 'Data & Analytics',
    });
    setModalOpen(true);
  };

  const openEditModal = (m: TeamMember) => {
    setEditingMember(m);
    reset({
      name: m.name,
      email: m.email,
      role: m.role,
      title: m.title,
      department: m.department,
    });
    setModalOpen(true);
  };

  const onSubmitForm = (values: TeamMemberFormValues) => {
    if (editingMember) {
      updateTeamMember(editingMember.id, values);
    } else {
      addTeamMember(values);
    }
    setModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Directory & Simulated Role Governance"
        subtitle="Manage demo team profiles, inspect permission boundaries, and switch the active UI role preview."
        meta={`${team.length} Team Members · Active Preview: ${settings.activeRolePreview}`}
        actions={
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-accent-strong hover:bg-accent-strong-hover text-white transition-colors whitespace-nowrap shrink-0"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Demo Member</span>
          </button>
        }
      />

      {/* Simulated Role Preview Banner */}
      <div className="p-6 rounded-xl bg-surface-raised border border-line flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-accent">
            <SlidersHorizontal className="w-4 h-4" />
            <span>Interactive Role Preview Switcher (Simulated Frontend Demonstration)</span>
          </div>
          <p className="text-xs text-ink-muted max-w-3xl leading-relaxed">
            Because Aurelix Analytics operates entirely client-side without a backend authentication server, roles are simulated to demonstrate how multi-role interfaces and audit attributions adapt. Switching to <strong>Viewer</strong> demonstrates read-only guardrails on customer creation.
          </p>
        </div>

        <div className="flex items-center gap-2 p-1 rounded-xl bg-surface-sunken border border-line shrink-0">
          {(['Owner', 'Admin', 'Analyst', 'Viewer'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setActiveRolePreview(r)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                settings.activeRolePreview === r
                  ? 'bg-accent-strong text-white shadow-xs'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Role Descriptions Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {ROLE_DESCRIPTIONS.map((item) => (
          <div
            key={item.role}
            className="p-6 rounded-xl bg-surface-raised border border-line flex flex-col justify-between gap-3"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-ink">
                  {item.role}
                </span>
                <Shield className="w-4 h-4 text-accent" />
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">
                {item.summary}
              </p>
            </div>
            <div className="pt-2 border-t border-line-subtle text-xs tabular-nums text-ink-muted">
              {item.scope}
            </div>
          </div>
        ))}
      </div>

      {/* Team Member Roster */}
      <div className="rounded-xl bg-surface-raised border border-line overflow-hidden">
        <div className="p-6 border-b border-line">
          <h2 className="text-heading text-ink">
            Workspace Team Roster
          </h2>
          <p className="text-xs text-ink-muted">
            Assign simulated roles or edit profile details
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm table-sticky-first">
            <thead>
              <tr className="border-b border-line bg-surface-sunken/60 text-xs font-semibold text-ink-muted">
                <th className="py-3 px-4">Member</th>
                <th className="py-3 px-4">Title · Department</th>
                <th className="py-3 px-4">Assigned Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Joined</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {team.map((member) => (
                <tr key={member.id} className="hover:bg-surface-hover/50">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={member.name} src={member.avatarUrl} size="md" />
                      <div>
                        <div className="font-semibold text-ink">
                          {member.name}
                        </div>
                        <div className="tabular-nums text-xs text-ink-muted">{member.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="font-medium text-ink-secondary">
                      {member.title}
                    </div>
                    <div className="text-xs text-ink-muted">{member.department}</div>
                  </td>
                  <td className="py-4 px-4">
                    <select
                      aria-label={`Assign role for ${member.name}`}
                      value={member.role}
                      onChange={(e) =>
                        updateTeamMember(member.id, { role: e.target.value as TeamRole })
                      }
                      className="px-3 py-1 rounded-lg bg-surface-sunken border border-line tabular-nums text-xs font-semibold text-accent"
                    >
                      <option value="Owner">Owner</option>
                      <option value="Admin">Admin</option>
                      <option value="Analyst">Analyst</option>
                      <option value="Viewer">Viewer</option>
                    </select>
                  </td>
                  <td className="py-4 px-4">
                    <StatusBadge status={member.status} />
                  </td>
                  <td className="py-4 px-4 tabular-nums text-ink-muted">
                    {formatDateDisplay(member.joinedAt, settings.dateFormat)}
                  </td>
                  <td className="py-4 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(member)}
                        aria-label={`Edit ${member.name}`}
                        className="p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-hover"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      {team.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setRemoveTarget(member)}
                          aria-label={`Remove ${member.name}`}
                          className="p-2 rounded-lg text-ink-muted hover:text-red-600 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Permission Comparison Table & Team Activity Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 p-6 rounded-xl bg-surface-raised border border-line space-y-4">
          <div>
            <h2 className="text-heading text-ink">
              Role Permission Comparison Matrix
            </h2>
            <p className="text-xs text-ink-muted">
              Capabilities mapped across Owner, Admin, Analyst, and Viewer roles
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm table-sticky-first">
              <thead>
                <tr className="border-b border-line text-xs font-semibold text-ink-muted">
                  <th className="py-3 pr-4">Workspace Capability</th>
                  <th className="py-3 px-3 text-center">Owner</th>
                  <th className="py-3 px-3 text-center">Admin</th>
                  <th className="py-3 px-3 text-center">Analyst</th>
                  <th className="py-3 pl-3 text-center">Viewer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {PERMISSION_MATRIX.map((row) => (
                  <tr key={row.capability}>
                    <td className="py-3 pr-4 font-medium text-ink-secondary">
                      {row.capability}
                    </td>
                    {(['Owner', 'Admin', 'Analyst', 'Viewer'] as const).map((r) => (
                      <td key={r} className="py-3 px-3 text-center">
                        {row[r] ? (
                          <Check className="w-4 h-4 text-success mx-auto" />
                        ) : (
                          <Minus className="w-4 h-4 text-ink-muted mx-auto" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-4 p-6 rounded-xl bg-surface-raised border border-line space-y-4">
          <div>
            <h2 className="text-heading text-ink">
              Team Activity Summary
            </h2>
            <p className="text-xs text-ink-muted">
              Recent actions attributed to team members
            </p>
          </div>
          <div className="space-y-3">
            {activities.slice(0, 5).map((act) => (
              <div
                key={act.id}
                className="p-3 rounded-xl bg-surface-sunken border border-line text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink">
                    {act.actorName}
                  </span>
                  <span className="tabular-nums text-xs text-accent">
                    {act.actorRole}
                  </span>
                </div>
                <div className="text-ink-muted">{act.action} · {act.targetName}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add / Edit Team Member Modal */}
      <ModalDialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingMember ? `Edit Profile · ${editingMember.name}` : 'Add Demo Team Member'}
        subtitle="Creates or updates a simulated team member in LocalStorage."
      >
        <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-ink-secondary mb-1">
              Full Name
            </label>
            <input
              type="text"
              {...register('name')}
              placeholder="Soren Bergstrom"
              className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line"
            />
            {errors.name && (
              <p className="text-danger text-xs mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block font-medium text-ink-secondary mb-1">
              Corporate Email
            </label>
            <input
              type="email"
              {...register('email')}
              placeholder="soren.bergstrom@aurelix.io"
              className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line"
            />
            {errors.email && (
              <p className="text-danger text-xs mt-1">{errors.email.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-medium text-ink-secondary mb-1">
                Simulated Role
              </label>
              <select
                {...register('role')}
                className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line"
              >
                <option value="Owner">Owner</option>
                <option value="Admin">Admin</option>
                <option value="Analyst">Analyst</option>
                <option value="Viewer">Viewer</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-ink-secondary mb-1">
                Job Title
              </label>
              <input
                type="text"
                {...register('title')}
                className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line"
              />
              {errors.title && (
                <p className="text-danger text-xs mt-1">{errors.title.message}</p>
              )}
            </div>

            <div>
              <label className="block font-medium text-ink-secondary mb-1">
                Department
              </label>
              <input
                type="text"
                {...register('department')}
                className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line"
              />
              {errors.department && (
                <p className="text-danger text-xs mt-1">{errors.department.message}</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-line"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-accent-strong hover:bg-accent-strong-hover text-white font-semibold"
            >
              {editingMember ? 'Save Profile' : 'Add Member'}
            </button>
          </div>
        </form>
      </ModalDialog>

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (removeTarget) removeTeamMember(removeTarget.id);
        }}
        title={`Remove ${removeTarget?.name}?`}
        description="Removes this demo member from the simulated workspace roster."
        confirmLabel="Remove Member"
      />
    </div>
  );
}
