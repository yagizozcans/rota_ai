import { useEffect, useRef } from 'react'
import type { Severity } from '../api'

interface CorrectPanelProps {
  taxonomy: string[]
  selectedClass: string
  severity: Severity
  onClassChange: (cls: string) => void
  onSeverityChange: (sev: Severity) => void
  onConfirm: () => void
  onCancel: () => void
}

/** docs/05-review-console.md §3.2 — correction: pick class from taxonomy + severity. */
export function CorrectPanel({
  taxonomy,
  selectedClass,
  severity,
  onClassChange,
  onSeverityChange,
  onConfirm,
  onCancel,
}: CorrectPanelProps) {
  const selectRef = useRef<HTMLSelectElement>(null)

  useEffect(() => {
    selectRef.current?.focus()
  }, [])

  return (
    <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-20 rounded-xl">
      <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-6 w-80 shadow-2xl">
        <h3 className="text-sm font-semibold text-neutral-300 mb-4">Düzelt</h3>

        <label className="block text-xs text-neutral-400 mb-1">Sınıf</label>
        <select
          ref={selectRef}
          value={selectedClass}
          onChange={(e) => onClassChange(e.target.value)}
          className="w-full bg-neutral-800 border border-neutral-600 rounded-lg px-3 py-2 mb-4 text-sm"
        >
          {taxonomy.map((cls) => (
            <option key={cls} value={cls}>
              {cls}
            </option>
          ))}
        </select>

        <label className="block text-xs text-neutral-400 mb-1">Şiddet</label>
        <select
          value={severity}
          onChange={(e) => onSeverityChange(e.target.value as Severity)}
          className="w-full bg-neutral-800 border border-neutral-600 rounded-lg px-3 py-2 mb-6 text-sm"
        >
          <option value="low">low</option>
          <option value="medium">medium</option>
          <option value="high">high</option>
        </select>

        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            className="flex-1 bg-amber-400 hover:bg-amber-300 text-black font-medium rounded-lg py-2 text-sm transition-colors"
          >
            Onayla (Enter)
          </button>
          <button
            onClick={onCancel}
            className="flex-1 bg-neutral-800 hover:bg-neutral-700 rounded-lg py-2 text-sm transition-colors"
          >
            İptal (Esc)
          </button>
        </div>
      </div>
    </div>
  )
}
