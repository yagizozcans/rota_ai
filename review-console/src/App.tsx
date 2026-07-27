import { useCallback, useEffect, useState } from 'react'
import {
  fetchQueue,
  fetchTaxonomy,
  submitDecision,
  imageUrl,
  type InventoryItem,
  type ReviewQueueItem,
  type Severity,
} from './api'
import { BBoxImage } from './components/BBoxImage'
import { MapPreview } from './components/MapPreview'
import { CorrectPanel } from './components/CorrectPanel'
import { ArchivePanel } from './components/ArchivePanel'

const STATUS_LABEL: Record<string, string> = {
  approved: '✅ Onaylandı',
  rejected: '❌ Reddedildi',
  corrected: '✏️ Düzeltildi',
}

export default function App() {
  const [queue, setQueue] = useState<ReviewQueueItem[]>([])
  const [index, setIndex] = useState(0)
  const [taxonomy, setTaxonomy] = useState<string[]>([])
  const [approvedToday, setApprovedToday] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [correcting, setCorrecting] = useState(false)
  const [correctClass, setCorrectClass] = useState('')
  const [correctSeverity, setCorrectSeverity] = useState<Severity>('medium')

  // Bumped after every decision so ArchivePanel knows to refetch — it has no
  // other way to learn that an approve/reject/correct just changed its data.
  const [archiveVersion, setArchiveVersion] = useState(0)

  // Archive item currently opened for viewing in the main panel, if any.
  const [archiveSelected, setArchiveSelected] = useState<InventoryItem | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [q, tax] = await Promise.all([fetchQueue(), fetchTaxonomy()])
      setQueue(q)
      setTaxonomy(tax)
      setIndex(0)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Keep index in bounds whenever the queue shrinks (an item was decided).
  useEffect(() => {
    setIndex((i) => Math.min(i, Math.max(queue.length - 1, 0)))
  }, [queue.length])

  const current = queue[index]

  const removeCurrentFromQueue = useCallback((itemId: string) => {
    setQueue((q) => q.filter((it) => it.item_id !== itemId))
  }, [])

  const approve = useCallback(async () => {
    if (!current || busy) return
    setBusy(true)
    try {
      await submitDecision(current.item_id, { decision: 'approved' })
      setApprovedToday((n) => n + 1)
      removeCurrentFromQueue(current.item_id)
      setArchiveVersion((v) => v + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [current, busy, removeCurrentFromQueue])

  const reject = useCallback(async () => {
    if (!current || busy) return
    setBusy(true)
    try {
      await submitDecision(current.item_id, { decision: 'rejected' })
      removeCurrentFromQueue(current.item_id)
      setArchiveVersion((v) => v + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [current, busy, removeCurrentFromQueue])

  const openCorrect = useCallback(() => {
    if (!current) return
    // The AI's suggested class (e.g. Stage-1's generic "traffic_sign") may not be
    // a real taxonomy entry — default to the first real option in that case so
    // the visible dropdown always matches what would actually be submitted.
    setCorrectClass(taxonomy.includes(current.class) ? current.class : taxonomy[0] ?? '')
    setCorrectSeverity('medium')
    setCorrecting(true)
  }, [current, taxonomy])

  const confirmCorrect = useCallback(async () => {
    if (!current || busy) return
    setBusy(true)
    try {
      await submitDecision(current.item_id, {
        decision: 'corrected',
        corrected_class: correctClass,
        severity: correctSeverity,
      })
      setCorrecting(false)
      removeCurrentFromQueue(current.item_id)
      setArchiveVersion((v) => v + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [current, busy, correctClass, correctSeverity, removeCurrentFromQueue])

  const goNext = useCallback(() => setIndex((i) => Math.min(i + 1, queue.length - 1)), [queue.length])
  const goPrev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), [])

  // docs/05-review-console.md §3.2 — A=approve, R=reject, C=correct, arrows=navigate.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return

      if (correcting) {
        if (e.key === 'Escape') setCorrecting(false)
        if (e.key === 'Enter') confirmCorrect()
        return
      }
      if (archiveSelected) {
        if (e.key === 'Escape') setArchiveSelected(null)
        return
      }
      switch (e.key.toLowerCase()) {
        case 'a':
          approve()
          break
        case 'r':
          reject()
          break
        case 'c':
          openCorrect()
          break
        case 'arrowright':
          goNext()
          break
        case 'arrowleft':
          goPrev()
          break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [correcting, archiveSelected, approve, reject, openCorrect, goNext, goPrev, confirmCorrect])

  return (
    <div className="h-screen flex flex-col p-4 gap-4">
      {/* Status bar — docs/05 §5 UX principles */}
      <header className="flex items-center justify-between px-4 py-3 bg-neutral-900 rounded-xl border border-neutral-800">
        <h1 className="text-base font-semibold text-neutral-200">RotaAI — Onay Konsolu</h1>
        <div className="flex items-center gap-4 text-sm text-neutral-400">
          <span>
            Kuyrukta <span className="text-amber-400 font-medium">{queue.length}</span> öğe kaldı
          </span>
          <span>
            Bugün <span className="text-emerald-400 font-medium">{approvedToday}</span> onaylandı
          </span>
          <button
            onClick={load}
            className="bg-neutral-800 hover:bg-neutral-700 rounded-lg px-3 py-1.5 text-xs transition-colors"
          >
            Yenile
          </button>
        </div>
      </header>

      {error && (
        <div className="px-4 py-2 bg-red-950 border border-red-800 text-red-300 rounded-lg text-sm">
          Hata: {error}
        </div>
      )}

      <div className="flex-1 flex gap-4 min-h-0">
        {/* Left sidebar — browse already-reviewed items without loading images (folder-tree) */}
        <ArchivePanel
          refreshKey={archiveVersion}
          selectedId={archiveSelected?.item_id ?? null}
          onSelect={setArchiveSelected}
          onClose={() => setArchiveSelected(null)}
        />

        {archiveSelected ? (
          <div className="flex-1 grid grid-cols-3 gap-4 min-h-0">
            {/* Archived item's image — same framed layout as the review view, read-only */}
            <div className="col-span-2 relative min-h-0">
              <BBoxImage
                src={archiveSelected.image_ref ? imageUrl(archiveSelected.image_ref) : ''}
                bbox={archiveSelected.bbox}
                label={`${archiveSelected.class} ${
                  archiveSelected.confidence != null ? Math.round(archiveSelected.confidence * 100) + '%' : ''
                }`}
              />
              <button
                onClick={() => setArchiveSelected(null)}
                title="Kapat (Esc)"
                className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-black/60 hover:bg-black/80 text-neutral-200 text-sm transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Right column: map + read-only info */}
            <div className="flex flex-col gap-4 min-h-0">
              <div className="h-56 shrink-0">
                <MapPreview lat={archiveSelected.lat} lon={archiveSelected.lon} />
              </div>

              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Durum</span>
                  <span className="text-neutral-200 font-medium">
                    {STATUS_LABEL[archiveSelected.review_status] ?? archiveSelected.review_status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Sınıf</span>
                  <span className="text-neutral-200 font-medium">{archiveSelected.class}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Güven</span>
                  <span className="text-neutral-200">
                    {archiveSelected.confidence != null ? `${Math.round(archiveSelected.confidence * 100)}%` : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Tip</span>
                  <span className="text-neutral-200">{archiveSelected.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Önem</span>
                  <span className="text-neutral-200">{archiveSelected.severity ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Konum</span>
                  <span className="text-neutral-200">
                    {archiveSelected.lat?.toFixed(4)}, {archiveSelected.lon?.toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">İncelenme</span>
                  <span className="text-neutral-200">
                    {archiveSelected.reviewed_at ? new Date(archiveSelected.reviewed_at).toLocaleString() : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center text-neutral-500">Yükleniyor…</div>
        ) : !current ? (
          <div className="flex-1 flex items-center justify-center text-neutral-500 text-lg">
            Kuyruk boş — tüm tespitler incelendi 🎉
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-3 gap-4 min-h-0">
            {/* Image + bbox — takes most of the screen (docs/05 §5: tek ekranda karar) */}
            <div className="col-span-2 relative min-h-0">
              <BBoxImage
                src={current.image_ref ? imageUrl(current.image_ref) : ''}
                bbox={current.bbox}
                label={`${current.class} ${current.confidence != null ? Math.round(current.confidence * 100) + '%' : ''}`}
              />
              {correcting && (
                <CorrectPanel
                  taxonomy={taxonomy}
                  selectedClass={correctClass}
                  severity={correctSeverity}
                  onClassChange={setCorrectClass}
                  onSeverityChange={setCorrectSeverity}
                  onConfirm={confirmCorrect}
                  onCancel={() => setCorrecting(false)}
                />
              )}
            </div>

            {/* Right column: map + info + actions */}
            <div className="flex flex-col gap-4 min-h-0">
              <div className="h-56 shrink-0">
                <MapPreview lat={current.lat} lon={current.lon} />
              </div>

              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Sınıf</span>
                  <span className="text-neutral-200 font-medium">{current.class}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Güven</span>
                  <span className="text-neutral-200">
                    {current.confidence != null ? `${Math.round(current.confidence * 100)}%` : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Tip</span>
                  <span className="text-neutral-200">{current.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Konum</span>
                  <span className="text-neutral-200">
                    {current.lat?.toFixed(4)}, {current.lon?.toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between text-neutral-600 text-xs pt-1">
                  <span>{index + 1} / {queue.length}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={approve}
                  disabled={busy}
                  className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-medium rounded-lg py-2.5 text-sm transition-colors"
                >
                  ✓ Onayla <span className="opacity-60">(A)</span>
                </button>
                <button
                  onClick={reject}
                  disabled={busy}
                  className="bg-red-500 hover:bg-red-400 disabled:opacity-50 text-black font-medium rounded-lg py-2.5 text-sm transition-colors"
                >
                  ✕ Reddet <span className="opacity-60">(R)</span>
                </button>
                <button
                  onClick={openCorrect}
                  disabled={busy}
                  className="bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 rounded-lg py-2.5 text-sm transition-colors"
                >
                  ✎ Düzelt <span className="opacity-60">(C)</span>
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={goPrev}
                    disabled={index === 0}
                    className="flex-1 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 rounded-lg py-2 text-xs transition-colors"
                  >
                    ← Önceki
                  </button>
                  <button
                    onClick={goNext}
                    disabled={index >= queue.length - 1}
                    className="flex-1 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 rounded-lg py-2 text-xs transition-colors"
                  >
                    Sonraki →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
