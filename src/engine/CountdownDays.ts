// Countdown Days / Important Dates (V2 Track C - 4.4)
// Manage countdown events, morning reminders, event-day celebrations

import { invoke } from '@tauri-apps/api/core'

export interface CountdownEvent {
  id: number
  title: string
  emoji: string
  dateTs: number    // target date midnight timestamp
  yearly: boolean
  createdAt: number
}

export interface UpcomingEvent {
  event: CountdownEvent
  daysLeft: number  // 0 = today, negative = past
  isToday: boolean
  effectiveDateTs: number // adjusted for yearly recurrence
}

function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function daysBetween(from: number, to: number): number {
  return Math.round((startOfDay(to) - startOfDay(from)) / 86400000)
}

/** For yearly events, compute the next occurrence (this year or next) */
function nextYearlyOccurrence(dateTs: number, now: number): number {
  const d = new Date(dateTs)
  const thisYear = new Date(now).getFullYear()
  d.setFullYear(thisYear)
  const candidate = startOfDay(d.getTime())
  if (candidate >= startOfDay(now)) return candidate
  d.setFullYear(thisYear + 1)
  return startOfDay(d.getTime())
}

export class CountdownSystem {
  private events: CountdownEvent[] = []

  async load() {
    try {
      const raw = await invoke<{
        id: number
        title: string
        emoji: string
        date_ts: number
        yearly: boolean
        created_at: number
      }[]>('query_countdown_events')

      this.events = raw.map(r => ({
        id: r.id,
        title: r.title,
        emoji: r.emoji,
        dateTs: r.date_ts,
        yearly: r.yearly,
        createdAt: r.created_at,
      }))
    } catch (e) {
      console.error('[Countdown] load error:', e)
    }
  }

  async addEvent(title: string, emoji: string, dateTs: number, yearly: boolean): Promise<number> {
    const id = await invoke<number>('insert_countdown_event', {
      title, emoji, dateTs: startOfDay(dateTs), yearly,
    })
    this.events.push({ id, title, emoji, dateTs: startOfDay(dateTs), yearly, createdAt: Date.now() })
    return id
  }

  async removeEvent(id: number) {
    await invoke('delete_countdown_event', { id })
    this.events = this.events.filter(e => e.id !== id)
  }

  get allEvents(): CountdownEvent[] {
    return this.events
  }

  /** Get upcoming events sorted by proximity */
  getUpcoming(limit = 5): UpcomingEvent[] {
    const now = Date.now()
    const upcoming: UpcomingEvent[] = []

    for (const event of this.events) {
      let effectiveDate: number
      if (event.yearly) {
        effectiveDate = nextYearlyOccurrence(event.dateTs, now)
      } else {
        effectiveDate = startOfDay(event.dateTs)
      }

      const daysLeft = daysBetween(now, effectiveDate)
      // Show past non-yearly events for 1 day, then hide
      if (!event.yearly && daysLeft < -1) continue

      upcoming.push({
        event,
        daysLeft,
        isToday: daysLeft === 0,
        effectiveDateTs: effectiveDate,
      })
    }

    upcoming.sort((a, b) => a.daysLeft - b.daysLeft)
    return upcoming.slice(0, limit)
  }

  /** Get the closest upcoming event for morning greeting */
  getClosestReminder(): string | null {
    const upcoming = this.getUpcoming(1)
    if (upcoming.length === 0) return null

    const u = upcoming[0]
    if (u.isToday) {
      return `${u.event.emoji} 今天是${u.event.title}！`
    }
    if (u.daysLeft > 0 && u.daysLeft <= 30) {
      return `${u.event.emoji} 距离${u.event.title}还有${u.daysLeft}天！`
    }
    return null
  }

  /** Get events that are today (for celebration) */
  getTodayEvents(): UpcomingEvent[] {
    return this.getUpcoming(10).filter(u => u.isToday)
  }
}
