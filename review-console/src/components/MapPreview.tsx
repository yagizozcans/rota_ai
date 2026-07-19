import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

interface MapPreviewProps {
  lat: number | null
  lon: number | null
}

const FALLBACK_CENTER: [number, number] = [28.9784, 41.0082] // Istanbul, just for an empty-state view

// demotiles.maplibre.org is a minimal tutorial dataset with almost no real
// street-level coverage — at any real-world coordinate it just renders a flat
// land-color fill. Use raw OSM raster tiles instead: free, no API key, real
// global coverage. OSM's usage policy requires attribution, so that control
// stays enabled (see attributionControl below).
const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
}

/** Small map showing the current item's location (docs/05-review-console.md §3.1). */
export function MapPreview({ lat, lon }: MapPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: lat != null && lon != null ? [lon, lat] : FALLBACK_CENTER,
      zoom: 16,
      attributionControl: { compact: true },
    })
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || lat == null || lon == null) return
    const setPin = () => {
      map.jumpTo({ center: [lon, lat] })
      if (markerRef.current) {
        markerRef.current.setLngLat([lon, lat])
      } else {
        markerRef.current = new maplibregl.Marker({ color: '#f59e0b' }).setLngLat([lon, lat]).addTo(map)
      }
    }
    if (map.loaded()) setPin()
    else map.once('load', setPin)
  }, [lat, lon])

  return <div ref={containerRef} className="w-full h-full rounded-xl overflow-hidden" />
}
