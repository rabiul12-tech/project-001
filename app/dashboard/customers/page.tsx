'use client';

import React, { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Plus,
  Search,
  Download,
  Trash2,
  Edit3,
  Eye,
  ArrowUpDown,
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import {
  CustomerWithMetrics,
  enrichCustomersWithMetrics,
} from '@/lib/calculations/analytics';
import {
  convertRowsToCsv,
  formatCurrency,
  formatDateDisplay,
  triggerBrowserDownload,
} from '@/lib/export/exporter';
import {
  customerFormSchema,
  CustomerFormValues,
} from '@/lib/validation/schemas';
import {
  KPIStatCard,
  PageHeader,
  StatusBadge,
  UserAvatar,
} from '@/components/ui/primitives';
import {
  ConfirmDialog,
  DetailDrawer,
  EmptyState,
  ModalDialog,
  Pagination,
} from '@/components/ui/overlays';
import { CustomerSegment, CustomerStatus } from '@/types';

function CustomersDirectoryContent() {
  const searchParams = useSearchParams();
  const customers = useAppStore((s) => s.customers);
  const orders = useAppStore((s) => s.orders);
  const settings = useAppStore((s) => s.settings);
  const addCustomer = useAppStore((s) => s.addCustomer);
  const updateCustomer = useAppStore((s) => s.updateCustomer);
  const deleteCustomers = useAppStore((s) => s.deleteCustomers);
  const addToast = useAppStore((s) => s.addToast);

  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '');
  const [segmentFilter, setSegmentFilter] = useState<CustomerSegment | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | 'All'>('All');
  const [sortField, setSortField] = useState<'company' | 'lifetimeSpend' | 'ordersCount' | 'lastOrderDate'>('lifetimeSpend');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drawerCustomer, setDrawerCustomer] = useState<CustomerWithMetrics | null>(null);
  const [modalOpen, setModalOpen] = useState(() => searchParams.get('action') === 'new');
  const [editingCustomer, setEditingCustomer] = useState<CustomerWithMetrics | null>(null);
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[] | null>(null);

  const isViewerRole = settings.activeRolePreview === 'Viewer';

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: '',
      company: '',
      email: '',
      phone: '+1 (415) 555-0192',
      segment: 'Enterprise',
      status: 'Active',
      country: 'United States',
      notes: '',
    },
  });

  const enrichedCustomers = useMemo(
    () => enrichCustomersWithMetrics(customers, orders),
    [customers, orders]
  );

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enrichedCustomers
      .filter((c) => {
        if (segmentFilter !== 'All' && c.segment !== segmentFilter) return false;
        if (statusFilter !== 'All' && c.status !== statusFilter) return false;
        if (q) {
          return (
            c.name.toLowerCase().includes(q) ||
            c.company.toLowerCase().includes(q) ||
            c.email.toLowerCase().includes(q) ||
            c.country.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortField === 'company') {
          diff = a.company.localeCompare(b.company);
        } else if (sortField === 'lifetimeSpend') {
          diff = a.lifetimeSpend - b.lifetimeSpend;
        } else if (sortField === 'ordersCount') {
          diff = a.ordersCount - b.ordersCount;
        } else {
          const da = a.lastOrderDate ? new Date(a.lastOrderDate).getTime() : 0;
          const db = b.lastOrderDate ? new Date(b.lastOrderDate).getTime() : 0;
          diff = da - db;
        }
        return sortAsc ? diff : -diff;
      });
  }, [enrichedCustomers, searchQuery, segmentFilter, statusFilter, sortField, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / pageSize));
  const paginatedCustomers = useMemo(
    () => filteredCustomers.slice((page - 1) * pageSize, page * pageSize),
    [filteredCustomers, page, pageSize]
  );

  const segmentStats = useMemo(() => {
    const totalLtv = enrichedCustomers.reduce((s, c) => s + c.lifetimeSpend, 0);
    const activeCount = enrichedCustomers.filter((c) => c.status === 'Active').length;
    const enterpriseCount = enrichedCustomers.filter((c) => c.segment === 'Enterprise').length;
    const avgLtv = enrichedCustomers.length > 0 ? totalLtv / enrichedCustomers.length : 0;
    return { totalLtv, activeCount, enterpriseCount, avgLtv };
  }, [enrichedCustomers]);

  const openCreateModal = () => {
    if (isViewerRole) {
      addToast('Viewer role active', 'Switch role preview to Owner or Admin to create records.', 'warning');
      return;
    }
    setEditingCustomer(null);
    reset({
      name: '',
      company: '',
      email: '',
      phone: '+1 (415) 555-0192',
      segment: 'Enterprise',
      status: 'Active',
      country: 'United States',
      notes: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (cust: CustomerWithMetrics) => {
    if (isViewerRole) {
      addToast('Viewer role active', 'Switch role preview to Owner or Admin to edit records.', 'warning');
      return;
    }
    setEditingCustomer(cust);
    reset({
      name: cust.name,
      company: cust.company,
      email: cust.email,
      phone: cust.phone,
      segment: cust.segment,
      status: cust.status,
      country: cust.country,
      notes: cust.notes || '',
    });
    setModalOpen(true);
  };

  const onSubmitForm = (values: CustomerFormValues) => {
    if (editingCustomer) {
      updateCustomer(editingCustomer.id, values);
    } else {
      addCustomer(values);
    }
    setModalOpen(false);
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const toggleSelectAllOnPage = () => {
    const pageIds = paginatedCustomers.map((c) => c.id);
    const allSelected = pageIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(selectedIds.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds(Array.from(new Set([...selectedIds, ...pageIds])));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleExportCustomers = (onlySelected = false) => {
    const source = onlySelected
      ? filteredCustomers.filter((c) => selectedIds.includes(c.id))
      : filteredCustomers;
    const headers = [
      'Customer ID',
      'Company',
      'Contact Name',
      'Email',
      'Phone',
      'Segment',
      'Status',
      'Country',
      'Orders Count',
      'Lifetime Spend',
      'Last Order Date',
    ];
    const rows = source.map((c) => [
      c.id,
      c.company,
      c.name,
      c.email,
      c.phone,
      c.segment,
      c.status,
      c.country,
      c.ordersCount,
      c.lifetimeSpend,
      c.lastOrderDate ? c.lastOrderDate.slice(0, 10) : 'None',
    ]);
    triggerBrowserDownload(
      convertRowsToCsv(headers, rows),
      `aurelix-customers-${onlySelected ? 'selected' : 'directory'}.csv`
    );
    addToast('Customers CSV exported', `Downloaded ${rows.length} customer records.`, 'success');
  };

  const drawerCustomerOrders = useMemo(() => {
    if (!drawerCustomer) return [];
    return orders.filter((o) => o.customerId === drawerCustomer.id);
  }, [drawerCustomer, orders]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Directory & Cohort Value"
        subtitle="Manage enterprise accounts, segmentation tiers, lifetime value, and full commercial purchase history."
        meta={`${customers.length} Total Accounts`}
        actions={
          <>
            <button
              type="button"
              onClick={() => handleExportCustomers(false)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-surface-raised border border-line text-ink-secondary hover:bg-surface-hover transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export All CSV</span>
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-accent-strong hover:bg-accent-strong-hover text-white transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Customer</span>
            </button>
          </>
        }
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPIStatCard
          label="Total Customer Accounts"
          value={customers.length.toLocaleString()}
          secondaryMeta={`${segmentStats.activeCount} Active`}
        />
        <KPIStatCard
          label="Enterprise Segment"
          value={segmentStats.enterpriseCount.toLocaleString()}
          secondaryMeta={`${customers.length > 0 ? Math.round((segmentStats.enterpriseCount / customers.length) * 100) : 0}% of portfolio`}
        />
        <KPIStatCard
          label="Cumulative Lifetime Value"
          value={formatCurrency(segmentStats.totalLtv, settings.currency, settings.numberFormat)}
          secondaryMeta="All settled customer spend"
        />
        <KPIStatCard
          label="Average Customer LTV"
          value={formatCurrency(segmentStats.avgLtv, settings.currency, settings.numberFormat)}
          secondaryMeta="Net realized per account"
        />
      </div>

      {/* Filter & Bulk Action Toolbar */}
      <div className="p-4 rounded-xl bg-surface-raised border border-line flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search company, contact, email, country..."
              className="pl-8 pr-3 py-2 w-64 rounded-lg bg-surface-sunken border border-line text-xs text-ink focus:outline-none"
            />
          </div>

          <select
            aria-label="Filter by customer segment"
            value={segmentFilter}
            onChange={(e) => {
              setSegmentFilter(e.target.value as CustomerSegment | 'All');
              setPage(1);
            }}
            className="px-3 py-2 rounded-lg bg-surface-sunken border border-line text-xs text-ink-secondary"
          >
            <option value="All">All Segments</option>
            <option value="Enterprise">Enterprise</option>
            <option value="Mid-Market">Mid-Market</option>
            <option value="SMB">SMB</option>
            <option value="Startup">Startup</option>
          </select>

          <select
            aria-label="Filter by customer status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as CustomerStatus | 'All');
              setPage(1);
            }}
            className="px-3 py-2 rounded-lg bg-surface-sunken border border-line text-xs text-ink-secondary"
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Onboarding">Onboarding</option>
            <option value="At Risk">At Risk</option>
            <option value="Churned">Churned</option>
          </select>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs tabular-nums text-accent font-semibold">
              {selectedIds.length} selected
            </span>
            <button
              type="button"
              onClick={() => handleExportCustomers(true)}
              className="px-3 py-2 rounded-lg text-xs font-medium bg-surface-hover text-ink-secondary hover:bg-slate-200"
            >
              Export Selected
            </button>
            <button
              type="button"
              onClick={() => setDeleteTargetIds(selectedIds)}
              className="px-3 py-2 rounded-lg text-xs font-medium bg-red-600/10 text-danger hover:bg-red-600/20"
            >
              Delete Selected
            </button>
          </div>
        )}
      </div>

      {/* Customer Directory Table */}
      {filteredCustomers.length === 0 ? (
        <EmptyState
          title="No matching customer accounts"
          description="Adjust your search query or segment filters, or create a new customer account."
          actionLabel="Reset Filters"
          onAction={() => {
            setSearchQuery('');
            setSegmentFilter('All');
            setStatusFilter('All');
          }}
        />
      ) : (
        <div className="rounded-xl bg-surface-raised border border-line overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm table-sticky-first">
              <thead>
                <tr className="border-b border-line bg-surface-sunken/60 text-xs font-semibold text-ink-muted">
                  <th className="py-3 px-4 w-9">
                    <input
                      type="checkbox"
                      aria-label="Select all customers on page"
                      checked={
                        paginatedCustomers.length > 0 &&
                        paginatedCustomers.every((c) => selectedIds.includes(c.id))
                      }
                      onChange={toggleSelectAllOnPage}
                      className="rounded border-line"
                    />
                  </th>
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleSort('company')}
                      className="inline-flex items-center gap-1 hover:text-ink"
                    >
                      <span>Customer / Company</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4">Segment · Country</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort('ordersCount')}
                      className="inline-flex items-center gap-1 hover:text-ink"
                    >
                      <span>Orders</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort('lifetimeSpend')}
                      className="inline-flex items-center gap-1 hover:text-ink"
                    >
                      <span>Lifetime Spend</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleSort('lastOrderDate')}
                      className="inline-flex items-center gap-1 hover:text-ink"
                    >
                      <span>Last Order</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {paginatedCustomers.map((cust) => (
                  <tr
                    key={cust.id}
                    onClick={() => setDrawerCustomer(cust)}
                    className="hover:bg-surface-hover/60 cursor-pointer transition-colors"
                  >
                    <td
                      className="py-3 px-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        aria-label={`Select ${cust.company}`}
                        checked={selectedIds.includes(cust.id)}
                        onChange={() => toggleSelectOne(cust.id)}
                        className="rounded border-line"
                      />
                    </td>
                    <td className="py-3 px-4 max-w-[240px]">
                      <div className="flex items-center gap-3">
                        <UserAvatar name={cust.name} size="sm" />
                        <div className="min-w-0">
                          <div className="font-semibold text-ink truncate" title={cust.company}>
                            {cust.company}
                          </div>
                          <div
                            className="text-xs text-ink-muted truncate"
                            title={`${cust.name} · ${cust.email}`}
                          >
                            {cust.name} · {cust.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-ink-secondary whitespace-nowrap">
                      <span className="font-medium">{cust.segment}</span>
                      <span className="text-ink-muted mx-2">·</span>
                      <span className="text-ink-muted">{cust.country}</span>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={cust.status} />
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-ink-secondary">
                      {cust.ordersCount}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-semibold text-ink">
                      {formatCurrency(cust.lifetimeSpend, settings.currency, settings.numberFormat)}
                    </td>
                    <td className="py-3 px-4 tabular-nums text-ink-muted whitespace-nowrap">
                      {formatDateDisplay(cust.lastOrderDate, settings.dateFormat)}
                    </td>
                    <td
                      className="py-3 px-4 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setDrawerCustomer(cust)}
                          aria-label={`View ${cust.company}`}
                          className="p-2 rounded-lg text-ink-muted hover:text-blue-600 hover:bg-surface-hover"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(cust)}
                          aria-label={`Edit ${cust.company}`}
                          className="p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-hover"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTargetIds([cust.id])}
                          aria-label={`Delete ${cust.company}`}
                          className="p-2 rounded-lg text-ink-muted hover:text-red-600 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={filteredCustomers.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(1);
            }}
          />
        </div>
      )}

      {/* Add / Edit Customer Modal */}
      <ModalDialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCustomer ? `Edit Customer · ${editingCustomer.company}` : 'Add New Enterprise Customer'}
        subtitle="All fields are validated with Zod and persisted immediately to LocalStorage."
      >
        <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-ink-secondary mb-1">
                Company Name
              </label>
              <input
                type="text"
                {...register('company')}
                placeholder="Vanguard Systems"
                className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line text-ink"
              />
              {errors.company && (
                <p className="text-danger text-xs mt-1">{errors.company.message}</p>
              )}
            </div>

            <div>
              <label className="block font-medium text-ink-secondary mb-1">
                Primary Contact Name
              </label>
              <input
                type="text"
                {...register('name')}
                placeholder="Evelyn Mercer"
                className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line text-ink"
              />
              {errors.name && (
                <p className="text-danger text-xs mt-1">{errors.name.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-ink-secondary mb-1">
                Corporate Email
              </label>
              <input
                type="email"
                {...register('email')}
                placeholder="evelyn.mercer@vanguard.io"
                className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line text-ink"
              />
              {errors.email && (
                <p className="text-danger text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block font-medium text-ink-secondary mb-1">
                Phone Number
              </label>
              <input
                type="text"
                {...register('phone')}
                className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line text-ink"
              />
              {errors.phone && (
                <p className="text-danger text-xs mt-1">{errors.phone.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-medium text-ink-secondary mb-1">
                Segment Tier
              </label>
              <select
                {...register('segment')}
                className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line text-ink"
              >
                <option value="Enterprise">Enterprise</option>
                <option value="Mid-Market">Mid-Market</option>
                <option value="SMB">SMB</option>
                <option value="Startup">Startup</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-ink-secondary mb-1">
                Account Status
              </label>
              <select
                {...register('status')}
                className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line text-ink"
              >
                <option value="Active">Active</option>
                <option value="Onboarding">Onboarding</option>
                <option value="At Risk">At Risk</option>
                <option value="Churned">Churned</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-ink-secondary mb-1">
                Country
              </label>
              <input
                type="text"
                {...register('country')}
                className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line text-ink"
              />
              {errors.country && (
                <p className="text-danger text-xs mt-1">{errors.country.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block font-medium text-ink-secondary mb-1">
              Executive Account Notes
            </label>
            <textarea
              rows={3}
              {...register('notes')}
              placeholder="Contract renewal schedule, SLA terms, or billing contacts..."
              className="w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line text-ink"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-line text-ink-secondary hover:bg-surface-hover"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-accent-strong hover:bg-accent-strong-hover text-white font-semibold"
            >
              {editingCustomer ? 'Save Changes' : 'Create Customer'}
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* Delete Customer Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTargetIds)}
        onClose={() => setDeleteTargetIds(null)}
        onConfirm={() => {
          if (deleteTargetIds) {
            deleteCustomers(deleteTargetIds);
            setSelectedIds([]);
            if (drawerCustomer && deleteTargetIds.includes(drawerCustomer.id)) {
              setDrawerCustomer(null);
            }
          }
        }}
        title="Delete Customer Account(s)?"
        description={`Are you sure you want to remove ${deleteTargetIds?.length || 1} customer record(s)? Historical orders linked to this customer will preserve their snapshot billing records so financial totals remain intact.`}
        confirmLabel="Delete Customer"
      />

      {/* Customer Detail Drawer */}
      <DetailDrawer
        open={Boolean(drawerCustomer)}
        onClose={() => setDrawerCustomer(null)}
        title={drawerCustomer?.company || 'Customer Profile'}
        subtitle={
          drawerCustomer
            ? `${drawerCustomer.name} · ${drawerCustomer.segment} · ${drawerCustomer.country}`
            : undefined
        }
        footer={
          drawerCustomer && (
            <>
              <button
                type="button"
                onClick={() => {
                  const target = drawerCustomer;
                  setDrawerCustomer(null);
                  openEditModal(target);
                }}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-surface-raised border border-line text-ink-secondary"
              >
                Edit Profile
              </button>
              <button
                type="button"
                onClick={() => setDrawerCustomer(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-accent-strong text-white"
              >
                Done
              </button>
            </>
          )
        }
      >
        {drawerCustomer && (
          <div className="space-y-6 text-xs">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-surface-sunken border border-line">
                <div className="text-ink-muted">Lifetime Spend</div>
                <div className="text-heading tabular-nums text-ink mt-1">
                  {formatCurrency(drawerCustomer.lifetimeSpend, settings.currency, settings.numberFormat)}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-surface-sunken border border-line">
                <div className="text-ink-muted">Total Orders</div>
                <div className="text-heading tabular-nums text-ink mt-1">
                  {drawerCustomer.ordersCount}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-surface-sunken border border-line">
                <div className="text-ink-muted">Average Order</div>
                <div className="text-heading tabular-nums text-ink mt-1">
                  {formatCurrency(drawerCustomer.averageOrderValue, settings.currency, settings.numberFormat)}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface-sunken border border-line space-y-2">
              <div className="flex justify-between">
                <span className="text-ink-muted">Primary Contact:</span>
                <span className="font-medium text-ink">{drawerCustomer.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Email:</span>
                <span className="tabular-nums text-ink-secondary">{drawerCustomer.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Phone:</span>
                <span className="tabular-nums text-ink-secondary">{drawerCustomer.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Status:</span>
                <StatusBadge status={drawerCustomer.status} />
              </div>
              {drawerCustomer.notes && (
                <div className="pt-2 border-t border-line-subtle text-ink-muted">
                  {drawerCustomer.notes}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="font-bold text-ink">
                Customer Purchase History ({drawerCustomerOrders.length} Orders)
              </h3>
              {drawerCustomerOrders.length === 0 ? (
                <p className="text-ink-muted">No orders recorded for this account yet.</p>
              ) : (
                <div className="rounded-xl border border-line overflow-hidden">
                  <table className="w-full text-left border-collapse table-sticky-first">
                    <thead>
                      <tr className="border-b border-line bg-surface-sunken text-xs text-ink-muted">
                        <th className="py-2 px-3">Order #</th>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-subtle">
                      {drawerCustomerOrders.map((ord) => (
                        <tr key={ord.id}>
                          <td className="py-3 px-3 tabular-nums font-semibold text-accent">
                            {ord.orderNumber}
                          </td>
                          <td className="py-3 px-3 tabular-nums text-ink-muted">
                            {formatDateDisplay(ord.orderDate, settings.dateFormat)}
                          </td>
                          <td className="py-3 px-3">
                            <StatusBadge status={ord.paymentStatus} />
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums font-semibold">
                            {formatCurrency(ord.totalAmount, settings.currency, settings.numberFormat)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}

export default function CustomersPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs text-ink-muted">Loading customer directory...</div>}>
      <CustomersDirectoryContent />
    </Suspense>
  );
}
