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
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Activity CSV</span>
          </button>
        }
      />

      {/* Transparency Notice */}
      <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
        <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
        <span>
          <strong>Client-Side Demo Activity Log:</strong> Events below are persisted locally in your browser&apos;s LocalStorage to demonstrate operational traceability. This is a frontend demonstration log, not a tamper-proof server security audit log.
        </span>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-xl bg-white dark:bg-[#141C2D] border border-slate-200 dark:border-[#273247] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
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
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-[#0F1625] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            )
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search actor, action, target..."
              className="pl-8 pr-3 py-1.5 w-56 rounded-lg bg-slate-50 dark:bg-[#0F1625] border border-slate-200 dark:border-[#273247]"
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
            className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-[#0F1625] border border-slate-200 dark:border-[#273247] font-mono"
          />
          <input
            type="date"
            aria-label="Filter end date"
            value={endDateFilter}
            onChange={(e) => {
              setEndDateFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-[#0F1625] border border-slate-200 dark:border-[#273247] font-mono"
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
        <div className="rounded-xl bg-white dark:bg-[#141C2D] border border-slate-200 dark:border-[#273247] overflow-hidden">
          <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
            {paginatedActivities.map((act) => (
              <div
                key={act.id}
                onClick={() => setSelectedEvent(act)}
                className="p-4 sm:px-6 hover:bg-slate-50 dark:hover:bg-[#1B2639]/50 cursor-pointer transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3.5">
                  <UserAvatar name={act.actorName} size="md" />
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {act.action}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="font-mono text-blue-600 dark:text-blue-400 font-medium">
                        {act.targetName}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-500">{act.category}</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {act.description}
                    </p>
                    <div className="text-[11px] text-slate-400">
                      Actor: <span className="text-slate-600 dark:text-slate-300 font-medium">{act.actorName}</span> ({act.actorRole})
                    </div>
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                  <span className="text-xs font-mono tabular-nums text-slate-500">
                    {formatDateDisplay(act.timestamp, settings.dateFormat)}{' '}
                    {act.timestamp.slice(11, 16)} UTC
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEvent(act);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-slate-100 dark:bg-[#0F1625] text-slate-700 dark:text-slate-300 hover:bg-blue-600 hover:text-white transition-colors"
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
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0F1625] border border-slate-200 dark:border-[#273247] space-y-2.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Timestamp (ISO):</span>
                <span className="font-mono tabular-nums">{selectedEvent.timestamp}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Actor:</span>
                <span className="font-semibold">
                  {selectedEvent.actorName} ({selectedEvent.actorRole})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Domain Category:</span>
                <span className="font-mono">{selectedEvent.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Target Entity:</span>
                <span className="font-mono text-blue-600 dark:text-blue-400">
                  {selectedEvent.targetName}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0F1625] border border-slate-200 dark:border-[#273247] space-y-1.5">
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                Event Summary
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                {selectedEvent.description}
              </p>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
