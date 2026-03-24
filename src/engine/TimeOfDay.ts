// Time-of-day ambient system
// Uses real sunrise/sunset data from API when available

import { getLocation, DEFAULT_COORDS } from './GeoLocation'

export type TimePeriod =
  | 'dawn'
  | 'morning'
  | 'afternoon'
  | 'dusk'
  | 'evening'
  | 'night'
  | 'late_night'

export interface AmbientPalette {
  sky: string
  horizon: string
  deskTint: string
  lampOn: boolean
  stars: boolean
}

const PALETTES: Record<TimePeriod, AmbientPalette> = {
  dawn: {
    sky: '#FF9E7A',
    horizon: '#FFD4A8',
    deskTint: 'rgba(255, 180, 120, 0.15)',
    lampOn: false,
    stars: false,
  },
  morning: {
    sky: '#87CEEB',
    horizon: '#E8F4FD',
    deskTint: 'rgba(255, 255, 240, 0.1)',
    lampOn: false,
    stars: false,
  },
  afternoon: {
    sky: '#6BB3E0',
    horizon: '#FFF5D4',
    deskTint: 'rgba(255, 230, 150, 0.12)',
    lampOn: false,
    stars: false,
  },
  dusk: {
    sky: '#C06070',
    horizon: '#FFB088',
    deskTint: 'rgba(200, 120, 80, 0.15)',
    lampOn: false,
    stars: false,
  },
  evening: {
    sky: '#2C3E6B',
    horizon: '#4A5A8A',
    deskTint: 'rgba(255, 200, 100, 0.2)',
    lampOn: true,
    stars: false,
  },
  night: {
    sky: '#0D1B3E',
    horizon: '#1A2A50',
    deskTint: 'rgba(255, 200, 80, 0.15)',
    lampOn: true,
    stars: true,
  },
  late_night: {
    sky: '#080E24',
    horizon: '#101830',
    deskTint: 'rgba(255, 180, 60, 0.1)',
    lampOn: true,
    stars: true,
  },
}

// ── Sunrise / Sunset data ──

export interface SunTimes {
  sunrise: number  // decimal hours (e.g. 6.25 = 6:15)
  sunset: number   // decimal hours (e.g. 18.5 = 18:30)
  date: string     // YYYY-MM-DD
}

const SUN_CACHE_KEY = 'focuspal_sun'

function getCachedSunTimes(): SunTimes | null {
  try {
    const raw = localStorage.getItem(SUN_CACHE_KEY)
    if (!raw) return null
    const data: SunTimes = JSON.parse(raw)
    // Only valid for today
    const today = new Date().toISOString().slice(0, 10)
    if (data.date !== today) return null
    return data
  } catch {
    return null
  }
}

function cacheSunTimes(times: SunTimes) {
  localStorage.setItem(SUN_CACHE_KEY, JSON.stringify(times))
}

function parseUTCTime(timeStr: string, date: Date): number {
  // API returns "HH:MM:SS AM/PM" in UTC — convert to local decimal hours
  const match = timeStr.match(/(\d+):(\d+):(\d+)\s*(AM|PM)/i)
  if (!match) return -1
  let h = parseInt(match[1])
  const m = parseInt(match[2])
  const s = parseInt(match[3])
  const ampm = match[4].toUpperCase()
  if (ampm === 'PM' && h !== 12) h += 12
  if (ampm === 'AM' && h === 12) h = 0

  // Build UTC Date, then get local hours
  const utc = new Date(Date.UTC(
    date.getFullYear(), date.getMonth(), date.getDate(),
    h, m, s,
  ))
  return utc.getHours() + utc.getMinutes() / 60 + utc.getSeconds() / 3600
}

/** Fetch today's sunrise/sunset from API */
async function fetchSunTimes(lat: number, lon: number): Promise<SunTimes> {
  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10)
  const url = `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lon}&date=${dateStr}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Sun API failed: ${res.status}`)
  const json = await res.json()
  if (json.status !== 'OK') throw new Error(`Sun API status: ${json.status}`)

  const sunrise = parseUTCTime(json.results.sunrise, today)
  const sunset = parseUTCTime(json.results.sunset, today)

  return { sunrise, sunset, date: dateStr }
}

/** Fallback: estimate sunrise/sunset by month (northern hemisphere) */
function estimateSunTimes(): SunTimes {
  const month = new Date().getMonth()
  const sunrise = month >= 3 && month <= 8 ? 6 : 7
  const sunset = month >= 3 && month <= 8 ? 19 : 17
  return { sunrise, sunset, date: new Date().toISOString().slice(0, 10) }
}

// Module-level state: loaded sun times
let _sunTimes: SunTimes = getCachedSunTimes() || estimateSunTimes()
let _initDone = false

/** Initialize: fetch real sun times. Call once at app start. */
export async function initSunTimes(): Promise<SunTimes> {
  // Return cache if already fetched today
  const cached = getCachedSunTimes()
  if (cached) {
    _sunTimes = cached
    _initDone = true
    return cached
  }

  try {
    const coords = await getLocation()
    const times = await fetchSunTimes(coords.lat, coords.lon)
    _sunTimes = times
    cacheSunTimes(times)
    _initDone = true
    console.log(`[TimeOfDay] Real sun times: rise=${times.sunrise.toFixed(2)} set=${times.sunset.toFixed(2)} (${coords.source})`)
    return times
  } catch (e) {
    console.warn('[TimeOfDay] API failed, using estimates:', e)
    _sunTimes = estimateSunTimes()
    _initDone = true
    return _sunTimes
  }
}

export function getSunTimes(): SunTimes {
  return _sunTimes
}

// ── Time period (uses real data when available) ──

export function getTimePeriod(): TimePeriod {
  const hour = new Date().getHours()
  const { sunrise, sunset } = _sunTimes
  const riseH = Math.floor(sunrise)
  const setH = Math.floor(sunset)

  if (hour >= riseH - 1 && hour < riseH + 1) return 'dawn'
  if (hour >= riseH + 1 && hour < 12) return 'morning'
  if (hour >= 12 && hour < setH - 1) return 'afternoon'
  if (hour >= setH - 1 && hour < setH + 1) return 'dusk'
  if (hour >= setH + 1 && hour < 22) return 'evening'
  if (hour >= 22 || hour < 2) return 'night'
  return 'late_night'
}

export function getAmbientPalette(): AmbientPalette {
  return PALETTES[getTimePeriod()]
}

// ── Celestial arc position ──

export interface CelestialPosition {
  type: 'sun' | 'moon'
  x: number  // 0 (left edge) → 1 (right edge)
  y: number  // 0 (top of arc) → 1 (horizon)
}

export function getCelestialPosition(date: Date = new Date()): CelestialPosition {
  const hour = date.getHours() + date.getMinutes() / 60
  const { sunrise, sunset } = _sunTimes

  const isDaytime = hour >= sunrise && hour < sunset

  if (isDaytime) {
    // Sun: sunrise=left(0) → sunset=right(1)
    const progress = (hour - sunrise) / (sunset - sunrise)
    const x = progress
    const y = 1 - Math.sin(progress * Math.PI)
    return { type: 'sun', x, y }
  } else {
    // Moon: sunset=left(0) → next sunrise=right(1)
    const nightDuration = 24 - (sunset - sunrise)
    const elapsed = hour >= sunset ? hour - sunset : hour + (24 - sunset)
    const progress = elapsed / nightDuration
    const x = progress
    const y = 1 - Math.sin(progress * Math.PI)
    return { type: 'moon', x, y }
  }
}
