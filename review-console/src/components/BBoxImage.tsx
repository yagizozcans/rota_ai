import { useRef, useState, useEffect } from 'react'

interface BBoxImageProps {
  src: string
  bbox: [number, number, number, number] | null // [x, y, w, h] in the ORIGINAL image's pixels
  label?: string
}

/**
 * Renders a frame image with the AI's bounding box drawn on top.
 * The backend reports bbox in the original image's pixel space (docs/00-overview §4.2);
 * we scale it to the image's on-screen displayed size.
 *
 * Uses ResizeObserver rather than relying solely on onLoad: a cached image can
 * fire `load` before the flex/grid parent has finished layout, leaving
 * clientWidth/Height read as 0 at that instant (a real bug hit during manual
 * testing — the overlay rendered with width:0/height:0). ResizeObserver
 * recomputes whenever the image's actual rendered size settles or changes.
 */
export function BBoxImage({ src, bbox, label }: BBoxImageProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [geom, setGeom] = useState<{ x: number; y: number; offsetX: number; offsetY: number } | null>(
    null,
  )

  useEffect(() => {
    const img = imgRef.current
    if (!img) return
    setGeom(null) // reset while the new src loads to avoid showing a stale box

    function recompute() {
      if (!img || !img.naturalWidth || !img.clientWidth || !img.clientHeight) return
      // img is centered (object-contain in a flex box) inside a possibly larger
      // container, so its rendered top-left can sit away from (0,0) of the
      // relative parent. offsetLeft/offsetTop capture exactly that gap — without
      // it, the overlay drifts whenever the image doesn't fill the container on
      // one axis (this was the bug: box position ignored the centering offset).
      setGeom({
        x: img.clientWidth / img.naturalWidth,
        y: img.clientHeight / img.naturalHeight,
        offsetX: img.offsetLeft,
        offsetY: img.offsetTop,
      })
    }

    if (img.complete) recompute()
    img.addEventListener('load', recompute)
    const ro = new ResizeObserver(recompute)
    ro.observe(img)

    return () => {
      img.removeEventListener('load', recompute)
      ro.disconnect()
    }
  }, [src])

  return (
    <div className="relative flex items-center justify-center w-full h-full bg-black/40 rounded-xl overflow-hidden">
      <img
        ref={imgRef}
        src={src}
        alt="frame"
        className="max-w-full max-h-full object-contain select-none"
        draggable={false}
      />
      {bbox && geom && (
        <div
          className="absolute border-2 border-amber-400 rounded-sm shadow-[0_0_0_1px_rgba(0,0,0,0.6)] pointer-events-none"
          style={{
            left: geom.offsetX + bbox[0] * geom.x,
            top: geom.offsetY + bbox[1] * geom.y,
            width: bbox[2] * geom.x,
            height: bbox[3] * geom.y,
          }}
        >
          {label && (
            <span className="absolute -top-6 left-0 bg-amber-400 text-black text-xs font-medium px-1.5 py-0.5 rounded whitespace-nowrap">
              {label}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
