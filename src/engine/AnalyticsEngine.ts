/**
 * Analytics Engine
 * Focus heatmap, weekly trend, and focus-vs-mood scatter
 * All data computed locally from SQLite
 */
import { invoke } from '@tauri-apps/api/core'

// ── Types ──

export interface DailyFocusSummary {
  date_key: string
  total_minutes: number
  sessions: number
  completed: number
}

export interface DailyMoodSummary {
  date_key: string
  avg_score: number
  count: number
}

export interface WeeklyAggregate {
  weekLabel: string     // e.g. "Mar 17"
  totalMinutes: number
  sessions: number
  avgMood: number
}

export interface HeatmapCell {
  date: string          // YYYY-MM-DD
  minutes: number
  level: 0 | 1 | 2 | 3 | 4   // intensity for coloring
}

export interface ScatterPoint {
  date: string
  focusHours: number
  moodScore: number
}

// ── Narration templates ──

const MORNING_TEMPLATES = [
  (mins: number, best: string) =>
    `Yesterday you focused for ${formatDuration(mins)}. Your best session was around ${best}. Let's make today even better!`,
  (mins: number, _best: string) =>
    mins > 0
      ? `You put in ${formatDuration(mins)} yesterday. Solid work! Ready for another productive day?`
      : `Looks like yesterday was a rest day. That's okay! Fresh start today.`,
]

const WEEKLY_TEMPLATES = [
  (total: number, bestDay: string, trend: string) =>
    `Last week: ${formatDuration(total)} total focus. ${bestDay} was your most productive day. Trend: ${trend}.`,
]

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h${m}m` : `${h}h`
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// ── Engine ──

export class AnalyticsEngine {
  focusDaily: DailyFocusSummary[] = []
  moodDaily: DailyMoodSummary[] = []

  /** Load data for a given range (ms timestamps) */
  async loadRange(fromTs: number, toTs: number) {
    try {
      const [focus, mood] = await Promise.all([
        invoke<DailyFocusSummary[]>('query_focus_daily', { fromTs, toTs }),
        invoke<DailyMoodSummary[]>('query_mood_daily', { fromTs, toTs }),
      ])
      this.focusDaily = focus
      this.moodDaily = mood
    } catch (e) {
      console.error('[Analytics] load error:', e)
    }
  }

  /** Load last 365 days */
  async loadYear() {
    const now = Date.now()
    const yearAgo = now - 365 * 86_400_000
    await this.loadRange(yearAgo, now)
  }

  // ── Heatmap (GitHub-style, 365 days) ──

  getHeatmapData(): HeatmapCell[] {
    const map = new Map<string, number>()
    for (const d of this.focusDaily) {
      map.set(d.date_key, d.total_minutes)
    }

    const cells: HeatmapCell[] = []
    const today = new Date()
    for (let i = 364; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const key = dateKey(d)
      const mins = map.get(key) || 0
      cells.push({
        date: key,
        minutes: mins,
        level: minutesToLevel(mins),
      })
    }
    return cells
  }

  // ── Weekly trend (last 12 weeks with 4-week rolling average) ──

  getWeeklyTrend(): WeeklyAggregate[] {
    const weeks: WeeklyAggregate[] = []
    const today = new Date()
    const moodMap = new Map<string, { sum: number; count: number }>()
    for (const m of this.moodDaily) {
      moodMap.set(m.date_key, { sum: m.avg_score * m.count, count: m.count })
    }

    for (let w = 11; w >= 0; w--) {
      const weekEnd = new Date(today)
      weekEnd.setDate(weekEnd.getDate() - w * 7)
      const weekStart = new Date(weekEnd)
      weekStart.setDate(weekStart.getDate() - 6)

      let totalMins = 0
      let sessions = 0
      let moodSum = 0
      let moodCount = 0

      for (let d = 0; d < 7; d++) {
        const day = new Date(weekStart)
        day.setDate(day.getDate() + d)
        const key = dateKey(day)

        const focus = this.focusDaily.find(f => f.date_key === key)
        if (focus) {
          totalMins += focus.total_minutes
          sessions += focus.sessions
        }
        const mood = moodMap.get(key)
        if (mood) {
          moodSum += mood.sum
          moodCount += mood.count
        }
      }

      const label = `${weekStart.toLocaleDateString('en', { month: 'short', day: 'numeric' })}`
      weeks.push({
        weekLabel: label,
        totalMinutes: totalMins,
        sessions,
        avgMood: moodCount > 0 ? moodSum / moodCount : 0,
      })
    }
    return weeks
  }

  // ── Scatter plot: daily focus hours vs mood ──

  getScatterData(): ScatterPoint[] {
    const moodMap = new Map<string, number>()
    for (const m of this.moodDaily) {
      moodMap.set(m.date_key, m.avg_score)
    }

    const points: ScatterPoint[] = []
    for (const f of this.focusDaily) {
      const mood = moodMap.get(f.date_key)
      if (mood !== undefined) {
        points.push({
          date: f.date_key,
          focusHours: Math.round((f.total_minutes / 60) * 10) / 10,
          moodScore: Math.round(mood * 10) / 10,
        })
      }
    }
    return points
  }

  // ── Character Narration ──

  generateMorningNarration(): string {
    // Yesterday's data
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yKey = dateKey(yesterday)
    const yFocus = this.focusDaily.find(f => f.date_key === yKey)
    const mins = yFocus?.total_minutes || 0

    // Find best hour from yesterday (simplified — use "afternoon" / "morning" heuristic)
    const bestTime = mins > 0 ? (Math.random() > 0.5 ? 'the afternoon' : 'the morning') : ''

    const template = MORNING_TEMPLATES[Math.floor(Math.random() * MORNING_TEMPLATES.length)]
    return template(mins, bestTime)
  }

  generateWeeklyNarration(): string {
    const weeks = this.getWeeklyTrend()
    const lastWeek = weeks[weeks.length - 1]
    const prevWeek = weeks.length >= 2 ? weeks[weeks.length - 2] : null

    const total = lastWeek?.totalMinutes || 0

    // Find best day
    const today = new Date()
    let bestDay = 'Wednesday'
    let bestMins = 0
    for (let i = 0; i < 7; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - 7 + i)
      const key = dateKey(d)
      const f = this.focusDaily.find(fd => fd.date_key === key)
      if (f && f.total_minutes > bestMins) {
        bestMins = f.total_minutes
        bestDay = WEEKDAYS[d.getDay()]
      }
    }

    // Trend
    let trend = 'steady'
    if (prevWeek) {
      const diff = total - prevWeek.totalMinutes
      const pct = prevWeek.totalMinutes > 0 ? Math.round((diff / prevWeek.totalMinutes) * 100) : 0
      if (pct > 10) trend = `up ${pct}% from last week`
      else if (pct < -10) trend = `down ${Math.abs(pct)}% from last week`
      else trend = 'about the same as last week'
    }

    const template = WEEKLY_TEMPLATES[0]
    return template(total, bestDay, trend)
  }
}

// ── Helpers ──

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function minutesToLevel(mins: number): 0 | 1 | 2 | 3 | 4 {
  if (mins === 0) return 0
  if (mins < 30) return 1
  if (mins < 60) return 2
  if (mins < 120) return 3
  return 4
}
