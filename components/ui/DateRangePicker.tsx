'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
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

export function DateRangePicker({
  popoverAlign = 'right',
}: {
  popoverAlign?: 'left' | 'right' | 'responsive';
}) {
  const datePreset = useAppStore((s) => s.datePreset);
  const customStartDate = useAppStore((s) => s.customStartDate);
  const customEndDate = useAppStore((s) => s.customEndDate);
  const setDatePreset = useAppStore((s) => s.setDatePreset);

  const [showCustomPopover, setShowCustomPopover] = useState(false);
  const [startDraft, setStartInput] = useState<string | null>(null);
  const [endDraft, setEndInput] = useState<string | null>(null);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const customTriggerRef = useRef<HTMLButtonElement>(null);
  const formId = useId();

  const startInput = startDraft ?? customStartDate;
  const endInput = endDraft ?? customEndDate;

  useEffect(() => {
    if (!showCustomPopover) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowCustomPopover(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [showCustomPopover]);

  const closeCustomPopover = () => {
    setShowCustomPopover(false);
    customTriggerRef.current?.focus({ preventScroll: true });
  };

  const handlePresetClick = (preset: DateRangePreset) => {
    setRangeError(null);
    if (preset === 'custom') {
      setStartInput(null);
      setEndInput(null);
      setShowCustomPopover((v) => !v);
    } else {
      setShowCustomPopover(false);
      setDatePreset(preset);
    }
  };

  const applyCustomRange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startInput || !endInput) {
      setRangeError('Select both start and end dates.');
      return;
    }
    if (startInput > endInput) {
      setRangeError('Start date cannot be after end date.');
      return;
    }
    setRangeError(null);
    setDatePreset('custom', startInput, endInput);
    closeCustomPopover();
  };

  const alignClass =
    popoverAlign === 'left'
      ? 'left-0'
      : popoverAlign === 'responsive'
        ? 'left-0 sm:left-auto sm:right-0'
        : 'right-0';

  return (
    <div
      ref={containerRef}
      className="relative flex min-w-0 items-center"
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) {
          setShowCustomPopover(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && showCustomPopover) {
          event.preventDefault();
          event.stopPropagation();
          closeCustomPopover();
        }
      }}
    >
      <div
        role="group"
        aria-label="Date range filter"
        className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-surface-sunken border border-line"
      >
        <Calendar className="ml-2 mr-1 hidden size-3.5 shrink-0 text-ink-muted sm:block" aria-hidden="true" />
        {PRESET_OPTIONS.map((opt) => {
          const active = datePreset === opt.value;
          return (
            <button
              key={opt.value}
              ref={opt.value === 'custom' ? customTriggerRef : undefined}
              type="button"
              aria-pressed={active}
              aria-controls={opt.value === 'custom' && showCustomPopover ? formId : undefined}
              aria-expanded={opt.value === 'custom' ? showCustomPopover : undefined}
              onClick={() => handlePresetClick(opt.value)}
              className={`min-h-9 shrink-0 whitespace-nowrap rounded-md px-2.5 text-caption font-medium transition-colors sm:min-h-8 ${
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
          id={formId}
          onSubmit={applyCustomRange}
          noValidate
          className={`absolute ${alignClass} top-full mt-2 z-40 w-[min(18rem,calc(100vw-2rem))] p-4 rounded-xl bg-surface-raised border border-line shadow-xl space-y-3`}
        >
          <div className="text-sm font-semibold text-ink">
            Custom Date Window
          </div>
          {rangeError && (
            <div role="alert" className="text-caption text-danger bg-danger/10 border border-danger/20 rounded-lg px-2.5 py-1.5">
              {rangeError}
            </div>
          )}
          <div className="space-y-2">
            <label className="block text-xs text-ink-muted">
              Start Date
              <input
                type="date"
                name="startDate"
                value={startInput}
                max={endInput}
                onChange={(e) => {
                  setStartInput(e.target.value);
                  setRangeError(null);
                }}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line text-xs tabular-nums text-ink"
              />
            </label>
            <label className="block text-xs text-ink-muted">
              End Date
              <input
                type="date"
                name="endDate"
                value={endInput}
                min={startInput}
                onChange={(e) => {
                  setEndInput(e.target.value);
                  setRangeError(null);
                }}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-sunken border border-line text-xs tabular-nums text-ink"
              />
            </label>
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={closeCustomPopover}
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
