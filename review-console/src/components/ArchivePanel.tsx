import { useCallback, useEffect, useState } from 'react'
import { fetchInventory, type InventoryItem } from '../api'

/**
 * Left sidebar: browse already-reviewed items as a folder tree (Onaylanan /
 * Reddedilen / Düzeltilen), listed by filename only — NO images are loaded here,
 * on purpose (this is meant to be a fast, lightweight audit view, unlike the
 * main review panel which renders the photo). Selecting a row shows its raw
 * JSON instead of a picture.
 */

const FOLDERS: { status: string; label: string; icon: string }[] = [
  { status: 'approved', label: 'Onaylanan', icon: '✅' },
  { status: 'rejected', label: 'Reddedilen', icon: '❌' },
  { status: 'corrected', label: 'Düzeltilen', icon: '✏️' },
]

function filenameOf(item: InventoryItem): string {
  if (!item.image_ref) return `${item.item_id.slice(0, 8)}.json`
  const parts = item.image_ref.split('/')
  return parts[parts.length - 1]
}

interface ArchivePanelProps {
  /** Bump this (e.g. after every approve/reject/correct) to trigger a refetch. */
  refreshKey?: number
}

export function ArchivePanel({ refreshKey }: ArchivePanelProps) {
  const [items, setItems] = useState<Record<string, InventoryItem[]>>({})
  const [open, setOpen] = useState<Record<string, boolean>>({ approved: true })
  const [selected, setSelected] = useState<InventoryItem | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const results = await Promise.all(FOLDERS.map((f) => fetchInventory(f.status)))
      const next: Record<string, InventoryItem[]> = {}
      FOLDERS.forEach((f, i) => {
        next[f.status] = results[i]
      })
      setItems(next)
    } catch {
      // Archive is secondary/read-only — a failure here shouldn't block the
      // main review workflow, so we fail quietly rather than surface an error banner.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshKey is a pure
    // "refetch now" trigger from the parent, not data this effect reads itself.
  }, [load, refreshKey])

  return (
    <div className="w-80 shrink-0 flex flex-col gap-3 min-h-0">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 flex flex-col gap-2 flex-1 min-h-0">
        <div className="flex items-center justify-between shrink-0">
          <h2 className="text-sm font-semibold text-neutral-300">Arşiv</h2>
          <button
            onClick={load}
            title="Yenile"
            className="text-neutral-500 hover:text-neutral-300 text-xs transition-colors"
          >
            ⟳
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
          {FOLDERS.map((f) => {
            const list = items[f.status] ?? []
            const isOpen = open[f.status] ?? false
            return (
              <div key={f.status}>
                <button
                  onClick={() => setOpen((o) => ({ ...o, [f.status]: !o[f.status] }))}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-neutral-800 transition-colors text-left"
                >
                  <span className="text-sm text-neutral-300 flex items-center gap-1.5">
                    <span className="text-neutral-500 text-xs w-3 inline-block">
                      {isOpen ? '▾' : '▸'}
                    </span>
                    {f.icon} {f.label}
                  </span>
                  <span className="text-xs text-neutral-500">{list.length}</span>
                </button>

                {isOpen && (
                  <div className="pl-6 space-y-0.5 mt-0.5">
                    {list.length === 0 && (
                      <div className="text-xs text-neutral-600 py-1 px-2">— boş —</div>
                    )}
                    {list.map((it) => (
                      <button
                        key={it.item_id}
                        onClick={() => setSelected(it)}
                        title={filenameOf(it)}
                        className={`w-full text-left px-2 py-1 rounded-md text-xs font-mono truncate transition-colors ${
                          selected?.item_id === it.item_id
                            ? 'bg-amber-400/20 text-amber-300'
                            : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
                        }`}
                      >
                        📄 {filenameOf(it)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {loading && <div className="text-xs text-neutral-600 px-2 py-1">Yükleniyor…</div>}
        </div>
      </div>

      {selected && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 flex flex-col gap-2 max-h-72 shrink-0">
          <div className="flex items-center justify-between shrink-0">
            <h3 className="text-xs font-semibold text-neutral-400 truncate">{filenameOf(selected)}</h3>
            <button
              onClick={() => setSelected(null)}
              className="text-neutral-600 hover:text-neutral-300 text-xs shrink-0 ml-2"
            >
              ✕
            </button>
          </div>
          <pre className="text-[11px] leading-snug font-mono text-neutral-300 overflow-auto whitespace-pre-wrap break-all">
            {JSON.stringify(selected, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
