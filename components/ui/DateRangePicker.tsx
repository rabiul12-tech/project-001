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
  const [startInput, setStartInput] = useState(customStartDate);
  const [endInput, setEndInput] = useState(customEndDate);

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
        className="flex items-center gap-0.5 p-1 rounded-lg bg-slate-100 dark:bg-[#0F1625] border border-slate-200 dark:border-[#273247]"
      >
        <Calendar className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-1 hidden sm:block shrink-0" />
        {PRESET_OPTIONS.map((opt) => {
          const active = datePreset === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => handlePresetClick(opt.value)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-white dark:bg-[#1B2639] text-slate-900 dark:text-slate-50 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
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
          className="absolute right-0 top-full mt-2 z-40 w-72 p-4 rounded-xl bg-white dark:bg-[#141C2D] border border-slate-200 dark:border-[#273247] shadow-xl space-y-3"
        >
          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            Custom Date Window (2025–2026)
          </div>
          <div className="space-y-2">
            <label className="block text-xs text-slate-500 dark:text-slate-400">
              Start Date
              <input
                type="date"
                value={startInput}
                max={endInput}
                onChange={(e) => setStartInput(e.target.value)}
                className="mt-1 w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-[#0F1625] border border-slate-200 dark:border-[#273247] text-xs font-mono text-slate-900 dark:text-slate-100"
              />
            </label>
            <label className="block text-xs text-slate-500 dark:text-slate-400">
              End Date
              <input
                type="date"
                value={endInput}
                min={startInput}
                onChange={(e) => setEndInput(e.target.value)}
                className="mt-1 w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-[#0F1625] border border-slate-200 dark:border-[#273247] text-xs font-mono text-slate-900 dark:text-slate-100"
              />
            </label>
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowCustomPopover(false)}
              className="px-3 py-1.5 text-xs rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1B2639]"
            >
              Close
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
            >
              Apply Window
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
