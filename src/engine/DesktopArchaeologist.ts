// Desktop Archaeologist: learns user's app usage patterns from scene_log data
// Detects deviations from routine and generates contextual commentary

import { invoke } from '@tauri-apps/api/core'

interface SceneSummary {
  hour: number
  app_name: string
  scene_type: string
  total_minutes: number
  frequency: number
  distinct_days: number
}

interface HourPattern {
  hour: number
  apps: { app_name: string; scene_type: string; avgMinutes: number; frequency: number }[]
}

export interface ArchaeologistCallbacks {
  onDeviation?: (message: string) => void
  onMissing?: (message: string) => void
  onWeeklySummary?: (message: string) => void
}

export class DesktopArchaeologist {
  private _patterns: Map<number, HourPattern> = new Map()
  private _totalDays: number = 0
  private _dataReady: boolean = false
  private _lastDeviationHour: number = -1
  private _lastMissingHour: number = -1
  private _callbacks: ArchaeologistCallbacks = {}
  private _currentApp: string = ''
  private _currentScene: string = 'general'

  constructor(callbacks: ArchaeologistCallbacks) {
    this._callbacks = callbacks
  }

  get dataReady(): boolean { return this._dataReady }
  get totalDays(): number { return this._totalDays }

  /** Load aggregated patterns from DB. Call on mount + daily refresh. */
  async loadPatterns(): Promise<void> {
    try {
      // Query last 30 days of data
      const fromTs = Date.now() - 30 * 24 * 60 * 60 * 1000
      const tzOffset = new Date().getTimezoneOffset() * -60 // seconds east of UTC

      const rows = await invoke<SceneSummary[]>('query_scene_summary', {
        fromTs,
        tzOffsetSec: tzOffset,
      })

      if (!rows || rows.length === 0) return

      // Find total distinct days across all data
      this._totalDays = Math.max(...rows.map(r => r.distinct_days))

      // Only activate after 14+ days
      if (this._totalDays < 14) {
        this._dataReady = false
        return
      }

      // Group by hour, keep top 3 apps per hour (>50% frequency = "usual")
      const byHour = new Map<number, SceneSummary[]>()
      for (const row of rows) {
        if (!byHour.has(row.hour)) byHour.set(row.hour, [])
        byHour.get(row.hour)!.push(row)
      }

      this._patterns.clear()
      for (const [hour, entries] of byHour) {
        // Sort by frequency desc, take top 3 that appear in >50% of days
        const usual = entries
          .filter(e => e.distinct_days >= this._totalDays * 0.5)
          .sort((a, b) => b.frequency - a.frequency)
          .slice(0, 3)
          .map(e => ({
            app_name: e.app_name,
            scene_type: e.scene_type,
            avgMinutes: e.total_minutes / e.distinct_days,
            frequency: e.frequency,
          }))

        if (usual.length > 0) {
          this._patterns.set(hour, { hour, apps: usual })
        }
      }

      this._dataReady = true
      console.log(`[Archaeologist] Loaded patterns: ${this._patterns.size} hours, ${this._totalDays} days`)
    } catch (e) {
      console.warn('[Archaeologist] Failed to load patterns:', e)
    }
  }

  /** Update current app/scene (called from scene recognition) */
  updateCurrent(appName: string, sceneType: string) {
    this._currentApp = appName
    this._currentScene = sceneType
  }

  /** Check for deviations from routine. Call every ~10 minutes. */
  check() {
    if (!this._dataReady) return

    const hour = new Date().getHours()
    const pattern = this._patterns.get(hour)
    if (!pattern) return

    // Deviation: current app not in usual list for this hour
    if (this._currentApp && hour !== this._lastDeviationHour) {
      const isUsual = pattern.apps.some(a =>
        this._currentApp.toLowerCase().includes(a.app_name.toLowerCase()) ||
        a.app_name.toLowerCase().includes(this._currentApp.toLowerCase())
      )

      if (!isUsual && this._currentScene !== 'general') {
        this._lastDeviationHour = hour
        const usualApp = pattern.apps[0]?.app_name || '其他'
        const messages = [
          `你平时这个点一般在用${usualApp}，今天换口味了？`,
          `咦，这个时间段不常见你用这个app耶~`,
          `今天的安排有点不一样哦，新项目？`,
        ]
        this._callbacks.onDeviation?.(messages[Math.floor(Math.random() * messages.length)])
      }
    }

    // Missing routine: usual app not seen this hour
    if (hour !== this._lastMissingHour && pattern.apps.length > 0) {
      const topApp = pattern.apps[0]
      if (topApp.avgMinutes > 15) { // only comment on significant routines
        const isActive = this._currentApp.toLowerCase().includes(topApp.app_name.toLowerCase()) ||
          topApp.app_name.toLowerCase().includes(this._currentApp.toLowerCase())

        if (!isActive) {
          this._lastMissingHour = hour
          const messages = [
            `今天还没见你打开${topApp.app_name}呢，休息日？`,
            `平时这会儿你都在${topApp.scene_type === 'coding' ? '写代码' : '忙'}啦~`,
          ]
          this._callbacks.onMissing?.(messages[Math.floor(Math.random() * messages.length)])
        }
      }
    }
  }

  /** Generate Monday weekly summary */
  checkWeeklySummary(): string | null {
    if (!this._dataReady) return null

    const now = new Date()
    if (now.getDay() !== 1) return null // Monday only

    // Find peak coding hours and most active scene
    let peakCodingHour = -1
    let peakCodingMin = 0
    let totalCodingMin = 0
    let totalDesignMin = 0
    let totalWritingMin = 0

    for (const [hour, pattern] of this._patterns) {
      for (const app of pattern.apps) {
        if (app.scene_type === 'coding') {
          totalCodingMin += app.avgMinutes
          if (app.avgMinutes > peakCodingMin) {
            peakCodingMin = app.avgMinutes
            peakCodingHour = hour
          }
        }
        if (app.scene_type === 'design') totalDesignMin += app.avgMinutes
        if (app.scene_type === 'writing') totalWritingMin += app.avgMinutes
      }
    }

    const parts: string[] = []
    if (peakCodingHour >= 0) {
      parts.push(`写代码集中在${peakCodingHour}点左右`)
    }
    if (totalDesignMin > 30) {
      parts.push(`设计工作也不少`)
    }
    if (totalWritingMin > 30) {
      parts.push(`写了不少文档`)
    }

    if (parts.length === 0) return null

    return `上周回顾：${parts.join('，')}。新的一周也加油哦！`
  }

  /** Get pattern context string for LLM system prompt injection */
  getPatternContext(): string {
    if (!this._dataReady) return ''

    const hour = new Date().getHours()
    const pattern = this._patterns.get(hour)
    if (!pattern) return ''

    const lines = pattern.apps.map(a =>
      `${a.app_name}(${a.scene_type}, 约${a.avgMinutes.toFixed(0)}分钟/天)`
    )
    return `用户这个时间段通常使用：${lines.join('、')}`
  }
}
