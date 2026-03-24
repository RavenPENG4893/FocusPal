// GeoLocation: dual-source location detection
// Primary: IP-based geolocation (no permissions needed)
// Secondary: Tauri geolocation plugin (if installed, higher accuracy)

export interface GeoCoords {
  lat: number
  lon: number
  source: 'ip' | 'device'
}

const CACHE_KEY = 'focuspal_geo'
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000 // 24 hours

function getCached(): GeoCoords | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (Date.now() - data.ts > CACHE_MAX_AGE) return null
    return { lat: data.lat, lon: data.lon, source: data.source }
  } catch {
    return null
  }
}

function setCache(coords: GeoCoords) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({
    lat: coords.lat,
    lon: coords.lon,
    source: coords.source,
    ts: Date.now(),
  }))
}

async function fromIP(): Promise<GeoCoords> {
  // Use ipapi.co which supports CORS (ip-api.com does not)
  const res = await fetch('https://ipapi.co/json/')
  if (!res.ok) throw new Error(`IP geo failed: ${res.status}`)
  const data = await res.json()
  return { lat: data.latitude, lon: data.longitude, source: 'ip' }
}

async function fromDevice(): Promise<GeoCoords | null> {
  try {
    const { getCurrentPosition } = await import('@tauri-apps/plugin-geolocation')
    const pos = await getCurrentPosition()
    return { lat: pos.coords.latitude, lon: pos.coords.longitude, source: 'device' }
  } catch {
    return null
  }
}

/**
 * Get coordinates, trying cache → device → IP in order.
 */
export async function getLocation(): Promise<GeoCoords> {
  const cached = getCached()
  if (cached) return cached

  // Try device GPS first (higher accuracy)
  const device = await fromDevice()
  if (device) {
    setCache(device)
    return device
  }

  // Fall back to IP geolocation
  try {
    const ip = await fromIP()
    setCache(ip)
    return ip
  } catch (e) {
    console.warn('[Geo] All sources failed, using default coords:', e)
    return DEFAULT_COORDS
  }
}

// Default fallback coords (Shanghai area) if everything fails
export const DEFAULT_COORDS: GeoCoords = { lat: 31.23, lon: 121.47, source: 'ip' }
