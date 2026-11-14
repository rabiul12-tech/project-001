'use client';

import React, { useMemo, useState } from 'react';
import {
  Search,
  Download,
  Info,
  Eye,
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import {
  convertRowsToCsv,
  formatDateDisplay,
  triggerBrowserDownload,
} from '@/lib/export/exporter';
import { PageHeader, UserAvatar } from '@/components/ui/primitives';
import { DetailDrawer, EmptyState, Pagination } from '@/components/ui/overlays';
import { ActivityCategory, ActivityEvent } from '@/types';

export default function ActivityFeedPage() {
  const activities = useAppStore((s) => s.activities);
  const settings = useAppStore((s) => s.settings);
  const addToast = useAppStore((s) => s.addToast);

  const [categoryFilter, setCategoryFilter] = useState<ActivityCategory | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [selectedEvent, setSelectedEvent] = useState<ActivityEvent | null>(null);

  const filteredActivities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activities.filter((act) => {
      if (categoryFilter !== 'All' && act.category !== categoryFilter) return false;
      if (startDateFilter && act.timestamp.slice(0, 10) < startDateFilter) return false;
      if (endDateFilter && act.timestamp.slice(0, 10) > endDateFilter) return false;
      if (q) {
        return (
          act.action.toLowerCase().includes(q) ||
          act.description.toLowerCase().includes(q) ||
          act.actorName.toLowerCase().includes(q) ||
          act.targetName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [activities, categoryFilter, searchQuery, startDateFilter, endDateFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredActivities.length / pageSize));
  const paginatedActivities = useMemo(
    () => filteredActivities.slice((page - 1) * pageSize, page * pageSize),
    [filteredActivities, page, pageSize]
  );

  const handleExportActivityLog = () => {
    const headers = [
      'Event ID',
      'Timestamp',
      'Actor Name',
      'Actor Role',
      'Category',
      'Action',
      'Target',
      'Description',
    ];
    const rows = filteredActivities.map((a) => [
      a.id,
      a.timestamp,
      a.actorName,
      a.actorRole,
      a.category,
      a.action,
      a.targetName,
      a.description,
    ]);
    triggerBrowserDownload(convertRowsToCsv(headers, rows), 'aurelix-activity-log.csv');
    addToast('Activity log exported', `Downloaded ${rows.length} events.`, 'success');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity & Operational Audit Feed"
        subtitle="Chronological timeline of order updates, customer changes, catalog edits, report generations, and workspace settings."
        meta={`${activities.length} Recorded Events`}
        actions={
          <button
            type="button"
            onClick={handleExportActivityLog}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-accent-strong hover:bg-accent-strong-hover text-white transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Activity CSV</span>
          </button>
        }
      />

      {/* Transparency Notice */}
      <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-2.5 text-xs text-ink-secondary">
        <Info className="w-4 h-4 text-accent mt-0.5 shrink-0" />
        <span>
          <strong>Client-Side Demo Activity Log:</strong> Events below are persisted locally in your browser&apos;s LocalStorage to demonstrate operational traceability. This is a frontend demonstration log, not a tamper-proof server security audit log.
        </span>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-xl bg-surface-raised border border-line flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {(['All', 'Order', 'Customer', 'Product', 'Report', 'Settings', 'Team'] as const).map(
            (cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setCategoryFilter(cat);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  categoryFilter === cat
                    ? 'bg-accent-strong text-white'
                    : 'bg-surface-sunken text-ink-muted hover:text-ink'
                }`}
              >
                {cat}
              </button>
            )
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search actor, action, target..."
              className="pl-8 pr-3 py-1.5 w-56 rounded-lg bg-surface-sunken border border-line"
            />
          </div>

          <input
            type="date"
            aria-label="Filter start date"
            value={startDateFilter}
            onChange={(e) => {
              setStartDateFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-surface-sunken border border-line tabular-nums"
          />
          <input
            type="date"
            aria-label="Filter end date"
            value={endDateFilter}
            onChange={(e) => {
              setEndDateFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-surface-sunken border border-line tabular-nums"
          />
        </div>
      </div>

      {/* Activity Timeline List */}
      {filteredActivities.length === 0 ? (
        <EmptyState
          title="No activity records match your filter"
          description="Try clearing the category or date range filter."
          actionLabel="Clear Filters"
          onAction={() => {
            setCategoryFilter('All');
            setSearchQuery('');
            setStartDateFilter('');
            setEndDateFilter('');
          }}
        />
      ) : (
        <div className="rounded-xl bg-surface-raised border border-line overflow-hidden">
          <div className="divide-y divide-line-subtle">
            {paginatedActivities.map((act) => (
              <div
                key={act.id}
                onClick={() => setSelectedEvent(act)}
                className="p-4 sm:px-6 hover:bg-surface-hover/50 cursor-pointer transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3.5">
                  <UserAvatar name={act.actorName} size="md" />
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-bold text-ink">
                        {act.action}
                      </span>
                      <span className="text-ink-muted">·</span>
                      <span className="tabular-nums text-accent font-medium">
                        {act.targetName}
                      </span>
                      <span className="text-ink-muted">·</span>
                      <span className="text-ink-muted">{act.category}</span>
                    </div>
                    <p className="text-xs text-ink-secondary leading-relaxed">
                      {act.description}
                    </p>
                    <div className="text-xs text-ink-muted">
                      Actor: <span className="text-ink-secondary font-medium">{act.actorName}</span> ({act.actorRole})
                    </div>
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                  <span className="text-xs tabular-nums text-ink-muted">
                    {formatDateDisplay(act.timestamp, settings.dateFormat)}{' '}
                    {act.timestamp.slice(11, 16)} UTC
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEvent(act);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-surface-sunken text-ink-secondary hover:bg-blue-600 hover:text-white transition-colors"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Details</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={filteredActivities.length}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Activity Detail Drawer */}
      <DetailDrawer
        open={Boolean(selectedEvent)}
        onClose={() => setSelectedEvent(null)}
        title={selectedEvent?.action || 'Activity Event Details'}
        subtitle={selectedEvent ? `Event ID: ${selectedEvent.id}` : undefined}
      >
        {selectedEvent && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-xl bg-surface-sunken border border-line space-y-2.5">
              <div className="flex justify-between">
                <span className="text-ink-muted">Timestamp (ISO):</span>
                <span className="tabular-nums">{selectedEvent.timestamp}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Actor:</span>
                <span className="font-semibold">
                  {selectedEvent.actorName} ({selectedEvent.actorRole})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Domain Category:</span>
                <span className="tabular-nums">{selectedEvent.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Target Entity:</span>
                <span className="tabular-nums text-accent">
                  {selectedEvent.targetName}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface-sunken border border-line space-y-1.5">
              <div className="font-semibold text-ink">
                Event Summary
              </div>
              <p className="text-ink-secondary leading-relaxed">
                {selectedEvent.description}
              </p>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
