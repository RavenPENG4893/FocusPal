/**
 * Journal / Diary System
 * Markdown journaling with auto-context, AI prompts, and search
 */
import { invoke } from '@tauri-apps/api/core'

// ── Types ──

export interface JournalEntry {
  id: number
  date_key: string       // YYYY-MM-DD
  content_md: string
  mood_score: number
  focus_hours: number
  companion_level: number
  is_ai_generated: boolean
  timestamp: number
}

export interface DayContext {
  moodScore: number
  focusHours: number
  companionLevel: number
}

// ── Writing Prompts ──

const WRITING_PROMPTS_EN = [
  'What made you smile today?',
  'What did you accomplish?',
  'What are you grateful for?',
  'What challenged you today?',
  'What would you tell your future self?',
  'Describe one thing you learned.',
  'How did you take care of yourself today?',
  'What are you looking forward to?',
  'What was the highlight of your day?',
  'Write about someone who inspired you today.',
]

const WRITING_PROMPTS_CN = [
  '今天什么事让你开心了？',
  '今天完成了什么？',
  '今天感恩什么？',
  '今天有什么挑战？',
  '想对未来的自己说什么？',
  '今天学到了什么？',
  '今天怎么照顾自己的？',
  '你在期待什么？',
  '今天的高光时刻是什么？',
  '今天谁启发了你？',
]

// ── Engine ──

export class JournalEngine {
  private _promptsUsed = 0
  private _maxPromptsPerSession = 3
  private _lastPromptIndex = -1

  /** Get today's date key */
  static todayKey(): string {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  /** Format a Date to date key */
  static dateKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  /** Parse date key to Date */
  static parseKey(key: string): Date {
    const [y, m, d] = key.split('-').map(Number)
    return new Date(y, m - 1, d)
  }

  /** Save or update a journal entry */
  async save(dateKey: string, content: string, context: DayContext): Promise<void> {
    try {
      await invoke('upsert_journal_entry', {
        dateKey,
        contentMd: content,
        moodScore: context.moodScore,
        focusHours: context.focusHours,
        companionLevel: context.companionLevel,
        isAiGenerated: false,
      })
    } catch (e) {
      console.error('[Journal] save error:', e)
    }
  }

  /** Load a journal entry for a date */
  async load(dateKey: string): Promise<JournalEntry | null> {
    try {
      return await invoke<JournalEntry | null>('get_journal_entry', { dateKey })
    } catch (e) {
      console.error('[Journal] load error:', e)
      return null
    }
  }

  /** Get all dates that have entries */
  async getDates(): Promise<string[]> {
    try {
      return await invoke<string[]>('query_journal_dates')
    } catch (e) {
      console.error('[Journal] getDates error:', e)
      return []
    }
  }

  /** Search entries */
  async search(query: string): Promise<JournalEntry[]> {
    if (!query.trim()) return []
    try {
      return await invoke<JournalEntry[]>('search_journal', { query: query.trim() })
    } catch (e) {
      console.error('[Journal] search error:', e)
      return []
    }
  }

  /** Export all entries as single markdown */
  async exportAll(): Promise<string> {
    try {
      return await invoke<string>('export_journal')
    } catch (e) {
      console.error('[Journal] export error:', e)
      return ''
    }
  }

  /** Get a random writing prompt (max 3 per session) */
  getPrompt(useChinese = false): string | null {
    if (this._promptsUsed >= this._maxPromptsPerSession) return null
    const pool = useChinese ? WRITING_PROMPTS_CN : WRITING_PROMPTS_EN
    let idx: number
    do {
      idx = Math.floor(Math.random() * pool.length)
    } while (idx === this._lastPromptIndex && pool.length > 1)
    this._lastPromptIndex = idx
    this._promptsUsed++
    return pool[idx]
  }

  /** Reset prompt counter (e.g. on new session/day) */
  resetPrompts() {
    this._promptsUsed = 0
    this._lastPromptIndex = -1
  }

  /** Get context for today from existing data */
  async getTodayContext(): Promise<DayContext> {
    try {
      const now = Date.now()
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const fromTs = todayStart.getTime()

      // Get mood average
      const moods = await invoke<Array<{ score: number }>>('query_moods', { fromTs, toTs: now })
      const moodScore = moods.length > 0
        ? moods.reduce((s, m) => s + m.score, 0) / moods.length
        : 0

      // Get focus hours
      const focusStats = await invoke<{ today_minutes: number }>('get_focus_stats')
      const focusHours = Math.round((focusStats.today_minutes / 60) * 10) / 10

      // Get level
      const totalXP = await invoke<number>('get_total_xp')
      const companionLevel = Math.min(20, Math.floor(totalXP / 50) + 1) // simplified

      return { moodScore, focusHours, companionLevel }
    } catch {
      return { moodScore: 0, focusHours: 0, companionLevel: 1 }
    }
  }
}
