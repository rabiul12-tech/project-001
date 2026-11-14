'use client';

import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import { DateRangePreset } from '@/types';
import { useAppStore } from '@/stores/useAppStore';

const PRESET_OPTIONS: Array<{ value: DateRangePreset; label: string }> = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: '6m', label: '6M' },
  { value: '12m', label: '12M' },
  { value: 'custom', label: 'Custom' },
];

export function DateRangePicker() {
  const datePreset = useAppStore((s) => s.datePreset);
  const customStartDate = useAppStore((s) => s.customStartDate);
  const customEndDate = useAppStore((s) => s.customEndDate);
  const setDatePreset = useAppStore((s) => s.setDatePreset);

  const [showCustomPopover, setShowCustomPopover] = useState(false);
  const [startDraft, setStartInput] = useState<string | null>(null);
  const [endDraft, setEndInput] = useState<string | null>(null);
  const startInput = startDraft ?? customStartDate;
  const endInput = endDraft ?? customEndDate;

  const handlePresetClick = (preset: DateRangePreset) => {
    if (preset === 'custom') {
      setShowCustomPopover((v) => !v);
      setDatePreset('custom', startInput, endInput);
    } else {
      setShowCustomPopover(false);
      setDatePreset(preset);
    }
  };

  const applyCustomRange = (e: React.FormEvent) => {
    e.preventDefault();
    if (startInput && endInput && startInput <= endInput) {
      setDatePreset('custom', startInput, endInput);
      setShowCustomPopover(false);
    }
  };

  return (
    <div className="relative flex items-center">
      <div
        role="group"
        aria-label="Date range filter"
        className="flex items-center gap-1 p-1 rounded-lg bg-surface-sunken border border-line"
      >
        <Calendar className="w-3.5 h-3.5 text-ink-muted ml-2 mr-1 hidden sm:block shrink-0" />
        {PRESET_OPTIONS.map((opt) => {
          const active = datePreset === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => handlePresetClick(opt.value)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-surface-raised text-ink shadow-xs ring-1 ring-line'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {showCustomPopover && (
        <form
          onSubmit={applyCustomRange}
          className="absolute right-0 top-full mt-2 z-40 w-72 p-4 rounded-xl bg-surface-raised border border-line shadow-xl space-y-3"
        >
          <div className="text-xs font-semibold text-ink">
            Custom Date Window
          </div>
          <div className="space-y-2">
            <label className="block text-xs text-ink-muted">
              Start Date
              <input
                type="date"
                value={startInput}
                max={endInput}
                onChange={(e) => setStartInput(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line text-xs tabular-nums text-ink"
              />
            </label>
            <label className="block text-xs text-ink-muted">
              End Date
              <input
                type="date"
                value={endInput}
                min={startInput}
                onChange={(e) => setEndInput(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line text-xs tabular-nums text-ink"
              />
            </label>
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowCustomPopover(false)}
              className="px-3 py-2 text-xs rounded-lg text-ink-muted hover:bg-surface-hover"
            >
              Close
            </button>
            <button
              type="submit"
              className="px-3 py-2 text-xs font-medium rounded-lg bg-accent-strong hover:bg-accent-strong-hover text-white"
            >
              Apply Window
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
