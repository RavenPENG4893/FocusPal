/**
 * Collectible & Achievement System
 * 77 items across 6 categories + achievement tracking
 */
import { invoke } from '@tauri-apps/api/core'

// ── Types ──

export interface CollectibleDef {
  key: string
  name: string
  category: CollectibleCategory
  icon: string        // pixel emoji representation
  description: string
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary'
}

export interface DiscoveredCollectible {
  id: number
  category: string
  item_key: string
  name: string
  discovered_at: number
}

export interface AchievementDef {
  key: string
  name: string
  criteria: string
  icon: string
}

export interface UnlockedAchievement {
  id: number
  ach_key: string
  name: string
  criteria: string
  unlocked_at: number
}

export type CollectibleCategory =
  | 'companion_discoveries'
  | 'focus_milestones'
  | 'mood_journey'
  | 'social_couple'
  | 'system_awareness'
  | 'scene_milestones'

// ── Full Collectible Catalog (77 items) ──

export const COLLECTIBLE_CATALOG: CollectibleDef[] = [
  // ── Companion Discoveries (30) ── rare events during autonomous life
  { key: 'disc_cool_rock', name: 'Cool Rock', category: 'companion_discoveries', icon: '🪨', description: 'A peculiar rock found while exploring', rarity: 'common' },
  { key: 'disc_tiny_painting', name: 'Tiny Painting', category: 'companion_discoveries', icon: '🖼', description: 'A miniature masterpiece', rarity: 'common' },
  { key: 'disc_pressed_flower', name: 'Pressed Flower', category: 'companion_discoveries', icon: '🌸', description: 'A perfectly preserved petal', rarity: 'common' },
  { key: 'disc_origami_crane', name: 'Origami Crane', category: 'companion_discoveries', icon: '🦢', description: 'Folded with tiny hands', rarity: 'common' },
  { key: 'disc_mystery_seed', name: 'Mystery Seed', category: 'companion_discoveries', icon: '🌱', description: 'What will it grow into?', rarity: 'uncommon' },
  { key: 'disc_glass_marble', name: 'Glass Marble', category: 'companion_discoveries', icon: '🔮', description: 'Catches the light beautifully', rarity: 'common' },
  { key: 'disc_feather', name: 'Rainbow Feather', category: 'companion_discoveries', icon: '🪶', description: 'Shimmers in many colors', rarity: 'uncommon' },
  { key: 'disc_old_coin', name: 'Old Coin', category: 'companion_discoveries', icon: '🪙', description: 'From a forgotten age', rarity: 'uncommon' },
  { key: 'disc_seashell', name: 'Tiny Seashell', category: 'companion_discoveries', icon: '🐚', description: 'You can hear the ocean', rarity: 'common' },
  { key: 'disc_star_chart', name: 'Star Chart', category: 'companion_discoveries', icon: '🗺', description: 'A map of the pixel sky', rarity: 'uncommon' },
  { key: 'disc_music_box', name: 'Music Box', category: 'companion_discoveries', icon: '🎵', description: 'Plays a gentle melody', rarity: 'rare' },
  { key: 'disc_snow_globe', name: 'Snow Globe', category: 'companion_discoveries', icon: '🔮', description: 'A tiny winter world inside', rarity: 'rare' },
  { key: 'disc_lucky_clover', name: 'Lucky Clover', category: 'companion_discoveries', icon: '🍀', description: 'Four leaves of fortune', rarity: 'uncommon' },
  { key: 'disc_crystal', name: 'Crystal Shard', category: 'companion_discoveries', icon: '💎', description: 'Glows faintly in the dark', rarity: 'rare' },
  { key: 'disc_compass', name: 'Tiny Compass', category: 'companion_discoveries', icon: '🧭', description: 'Always points to focus', rarity: 'uncommon' },
  { key: 'disc_love_letter', name: 'Sealed Letter', category: 'companion_discoveries', icon: '💌', description: 'Written in pixel ink', rarity: 'uncommon' },
  { key: 'disc_telescope', name: 'Mini Telescope', category: 'companion_discoveries', icon: '🔭', description: 'For stargazing on the desk', rarity: 'rare' },
  { key: 'disc_golden_acorn', name: 'Golden Acorn', category: 'companion_discoveries', icon: '🌰', description: 'A squirrel\u2019s treasure', rarity: 'rare' },
  { key: 'disc_butterfly', name: 'Pixel Butterfly', category: 'companion_discoveries', icon: '🦋', description: 'Landed on the desk briefly', rarity: 'uncommon' },
  { key: 'disc_paper_airplane', name: 'Paper Airplane', category: 'companion_discoveries', icon: '✈', description: 'Flies in tiny circles', rarity: 'common' },
  { key: 'disc_pocket_watch', name: 'Pocket Watch', category: 'companion_discoveries', icon: '⏱', description: 'Time flows differently here', rarity: 'rare' },
  { key: 'disc_dreamcatcher', name: 'Dreamcatcher', category: 'companion_discoveries', icon: '🕸', description: 'Catches good dreams only', rarity: 'uncommon' },
  { key: 'disc_tiny_bell', name: 'Tiny Bell', category: 'companion_discoveries', icon: '🔔', description: 'Rings when focus is near', rarity: 'common' },
  { key: 'disc_rainbow_thread', name: 'Rainbow Thread', category: 'companion_discoveries', icon: '🧵', description: 'Weaves connections', rarity: 'uncommon' },
  { key: 'disc_ancient_scroll', name: 'Ancient Scroll', category: 'companion_discoveries', icon: '📜', description: 'Written in emoji language', rarity: 'rare' },
  { key: 'disc_magic_eraser', name: 'Magic Eraser', category: 'companion_discoveries', icon: '🧹', description: 'Erases worries', rarity: 'uncommon' },
  { key: 'disc_starlight_jar', name: 'Starlight Jar', category: 'companion_discoveries', icon: '🫙', description: 'Bottled constellation', rarity: 'legendary' },
  { key: 'disc_enchanted_pen', name: 'Enchanted Pen', category: 'companion_discoveries', icon: '🖊', description: 'Writes stories by itself', rarity: 'legendary' },
  { key: 'disc_infinity_hourglass', name: 'Infinity Hourglass', category: 'companion_discoveries', icon: '⏳', description: 'Sand never runs out', rarity: 'legendary' },
  { key: 'disc_phoenix_feather', name: 'Phoenix Feather', category: 'companion_discoveries', icon: '🔥', description: 'Warm to the touch, never burns', rarity: 'legendary' },

  // ── Focus Milestones (15) ── cumulative focus hours
  { key: 'focus_10h', name: 'First Steps', category: 'focus_milestones', icon: '🥉', description: '10 hours of focus', rarity: 'common' },
  { key: 'focus_25h', name: 'Getting Started', category: 'focus_milestones', icon: '📘', description: '25 hours of focus', rarity: 'common' },
  { key: 'focus_50h', name: 'Bronze Timer', category: 'focus_milestones', icon: '🏅', description: '50 hours of focus', rarity: 'common' },
  { key: 'focus_100h', name: 'Silver Timer', category: 'focus_milestones', icon: '🥈', description: '100 hours of focus', rarity: 'uncommon' },
  { key: 'focus_150h', name: 'Steady Worker', category: 'focus_milestones', icon: '💪', description: '150 hours of focus', rarity: 'uncommon' },
  { key: 'focus_200h', name: 'Dedicated Mind', category: 'focus_milestones', icon: '🧠', description: '200 hours of focus', rarity: 'uncommon' },
  { key: 'focus_250h', name: 'Gold Timer', category: 'focus_milestones', icon: '🥇', description: '250 hours of focus', rarity: 'rare' },
  { key: 'focus_300h', name: 'Focus Master', category: 'focus_milestones', icon: '🏆', description: '300 hours of focus', rarity: 'rare' },
  { key: 'focus_400h', name: 'Unstoppable', category: 'focus_milestones', icon: '🚀', description: '400 hours of focus', rarity: 'rare' },
  { key: 'focus_500h', name: 'Diamond Timer', category: 'focus_milestones', icon: '💎', description: '500 hours of focus', rarity: 'rare' },
  { key: 'focus_750h', name: 'Time Weaver', category: 'focus_milestones', icon: '⏰', description: '750 hours of focus', rarity: 'legendary' },
  { key: 'focus_1000h', name: 'Millennium Focus', category: 'focus_milestones', icon: '👑', description: '1000 hours of focus', rarity: 'legendary' },
  { key: 'focus_streak_7', name: '7-Day Streak', category: 'focus_milestones', icon: '🔥', description: 'Focused 7 days in a row', rarity: 'uncommon' },
  { key: 'focus_streak_30', name: '30-Day Streak', category: 'focus_milestones', icon: '🌟', description: 'Focused 30 days in a row', rarity: 'rare' },
  { key: 'focus_streak_100', name: '100-Day Streak', category: 'focus_milestones', icon: '⭐', description: 'Focused 100 days in a row', rarity: 'legendary' },

  // ── Mood Journey (10) ── mood tracking milestones
  { key: 'mood_first', name: 'First Check-in', category: 'mood_journey', icon: '😊', description: 'Recorded your first mood', rarity: 'common' },
  { key: 'mood_7day', name: 'Mood Explorer', category: 'mood_journey', icon: '🗓', description: '7 consecutive days of mood logging', rarity: 'common' },
  { key: 'mood_30day', name: 'Emotional Cartographer', category: 'mood_journey', icon: '🗺', description: '30 days of mood logging', rarity: 'uncommon' },
  { key: 'mood_100', name: 'Centurion', category: 'mood_journey', icon: '💯', description: '100 mood check-ins total', rarity: 'uncommon' },
  { key: 'mood_perfect_week', name: 'Great Week', category: 'mood_journey', icon: '🌈', description: 'Average mood 4+ for 7 days', rarity: 'uncommon' },
  { key: 'mood_resilience', name: 'Emotional Resilience', category: 'mood_journey', icon: '💖', description: 'Recovered from low mood to high', rarity: 'rare' },
  { key: 'mood_consistency', name: 'Consistency Champion', category: 'mood_journey', icon: '🎯', description: '60 consecutive days of logging', rarity: 'rare' },
  { key: 'mood_all_scores', name: 'Full Spectrum', category: 'mood_journey', icon: '🌈', description: 'Used all 5 mood scores', rarity: 'common' },
  { key: 'mood_night_owl', name: 'Night Owl', category: 'mood_journey', icon: '🦉', description: 'Logged mood after midnight', rarity: 'uncommon' },
  { key: 'mood_year', name: 'Annual Reflection', category: 'mood_journey', icon: '📖', description: '365 days of mood data', rarity: 'legendary' },

  // ── Social / Couple (10) ──
  { key: 'couple_linked', name: 'Connected Hearts', category: 'social_couple', icon: '💕', description: 'Linked with a partner', rarity: 'common' },
  { key: 'couple_first_cheer', name: 'First Cheer', category: 'social_couple', icon: '📣', description: 'Sent your first encouragement', rarity: 'common' },
  { key: 'couple_10_cheers', name: 'Cheer Captain', category: 'social_couple', icon: '🎉', description: 'Sent 10 cheers', rarity: 'uncommon' },
  { key: 'couple_shared_100xp', name: 'Power Couple', category: 'social_couple', icon: '⚡', description: '100 shared XP earned', rarity: 'uncommon' },
  { key: 'couple_shared_500xp', name: 'Dynamic Duo', category: 'social_couple', icon: '🦸', description: '500 shared XP earned', rarity: 'rare' },
  { key: 'couple_7day_cofocus', name: 'Synchronized Souls', category: 'social_couple', icon: '🔗', description: 'Both focused 7 days in a row', rarity: 'rare' },
  { key: 'couple_level_5', name: 'Growing Together', category: 'social_couple', icon: '🌱', description: 'Reached shared level 5', rarity: 'uncommon' },
  { key: 'couple_level_10', name: 'Soul Bond', category: 'social_couple', icon: '💫', description: 'Reached shared level 10', rarity: 'rare' },
  { key: 'couple_milestone', name: 'Milestone Memory', category: 'social_couple', icon: '📸', description: 'Celebrated a shared countdown event', rarity: 'uncommon' },
  { key: 'couple_50_cheers', name: 'Cheerleader', category: 'social_couple', icon: '🏆', description: '50 total cheers exchanged', rarity: 'legendary' },

  // ── System Awareness (7) ──
  { key: 'sys_cpu_spike', name: 'System Whisperer', category: 'system_awareness', icon: '🌡', description: 'Witnessed first CPU spike', rarity: 'common' },
  { key: 'sys_battery_save', name: 'Battery Guardian', category: 'system_awareness', icon: '🔋', description: 'Companion saved you from low battery', rarity: 'common' },
  { key: 'sys_clipboard_50', name: 'Clipboard Master', category: 'system_awareness', icon: '📋', description: '50 clipboard catches', rarity: 'uncommon' },
  { key: 'sys_trophy_fish', name: 'Legendary Angler', category: 'system_awareness', icon: '🐟', description: 'Caught a trophy fish (>50MB/s)', rarity: 'rare' },
  { key: 'sys_window_dodge_100', name: 'Dodge Master', category: 'system_awareness', icon: '🏃', description: 'Companion dodged 100 windows', rarity: 'uncommon' },
  { key: 'sys_dark_mode', name: 'Dark Side', category: 'system_awareness', icon: '🌙', description: 'Switched to dark mode for the first time', rarity: 'common' },
  { key: 'sys_all_scenes', name: 'Scene Collector', category: 'system_awareness', icon: '🎬', description: 'Triggered all 8 scene types', rarity: 'rare' },

  // ── Scene Milestones (5) ──
  { key: 'scene_code_100h', name: 'Code Warrior', category: 'scene_milestones', icon: '⌨', description: '100 hours in coding scene', rarity: 'rare' },
  { key: 'scene_write_50h', name: 'Prose Master', category: 'scene_milestones', icon: '✍', description: '50 hours in writing scene', rarity: 'rare' },
  { key: 'scene_build_10', name: 'Build Champion', category: 'scene_milestones', icon: '🏗', description: '10 compile celebrations', rarity: 'uncommon' },
  { key: 'scene_recover_5', name: 'Focus Reclaimer', category: 'scene_milestones', icon: '🎯', description: 'Recovered from distraction 5 times', rarity: 'uncommon' },
  { key: 'scene_design_25h', name: 'Pixel Perfectionist', category: 'scene_milestones', icon: '🎨', description: '25 hours in design scene', rarity: 'rare' },
]

export const CATEGORY_LABELS: Record<CollectibleCategory, string> = {
  companion_discoveries: 'Companion Discoveries',
  focus_milestones: 'Focus Milestones',
  mood_journey: 'Mood Journey',
  social_couple: 'Social & Couple',
  system_awareness: 'System Awareness',
  scene_milestones: 'Scene Milestones',
}

export const CATEGORY_ICONS: Record<CollectibleCategory, string> = {
  companion_discoveries: '🔍',
  focus_milestones: '⏱',
  mood_journey: '💖',
  social_couple: '💕',
  system_awareness: '🖥',
  scene_milestones: '🎬',
}

export const RARITY_COLORS: Record<string, string> = {
  common: 'rgba(180, 180, 180, 0.8)',
  uncommon: 'rgba(80, 200, 80, 0.8)',
  rare: 'rgba(80, 140, 255, 0.8)',
  legendary: 'rgba(255, 185, 50, 0.9)',
}

// ── Engine ──

export class CollectibleEngine {
  discovered: DiscoveredCollectible[] = []
  achievements: UnlockedAchievement[] = []
  private _loaded = false

  async load() {
    try {
      this.discovered = await invoke<DiscoveredCollectible[]>('query_collectibles')
      this.achievements = await invoke<UnlockedAchievement[]>('query_achievements')
      this._loaded = true
    } catch (e) {
      console.error('[Collectibles] load error:', e)
    }
  }

  get loaded() { return this._loaded }

  isDiscovered(key: string): boolean {
    return this.discovered.some(d => d.item_key === key)
  }

  isAchieved(key: string): boolean {
    return this.achievements.some(a => a.ach_key === key)
  }

  getDiscoveredCount(category?: CollectibleCategory): number {
    if (!category) return this.discovered.length
    return this.discovered.filter(d => d.category === category).length
  }

  getTotalCount(category?: CollectibleCategory): number {
    if (!category) return COLLECTIBLE_CATALOG.length
    return COLLECTIBLE_CATALOG.filter(c => c.category === category).length
  }

  getCompletionPercent(category?: CollectibleCategory): number {
    const total = this.getTotalCount(category)
    if (total === 0) return 0
    return Math.round((this.getDiscoveredCount(category) / total) * 100)
  }

  async discover(key: string): Promise<boolean> {
    const def = COLLECTIBLE_CATALOG.find(c => c.key === key)
    if (!def || this.isDiscovered(key)) return false
    try {
      const isNew = await invoke<boolean>('discover_collectible', {
        category: def.category,
        itemKey: def.key,
        name: def.name,
      })
      if (isNew) {
        await this.load() // refresh
      }
      return isNew
    } catch (e) {
      console.error('[Collectibles] discover error:', e)
      return false
    }
  }

  async unlock(key: string, name: string, criteria: string): Promise<boolean> {
    if (this.isAchieved(key)) return false
    try {
      const isNew = await invoke<boolean>('unlock_achievement', {
        achKey: key,
        name,
        criteria,
      })
      if (isNew) {
        await this.load()
      }
      return isNew
    } catch (e) {
      console.error('[Collectibles] unlock error:', e)
      return false
    }
  }

  /** Try to discover a random companion item (5% chance per call) */
  async tryRandomDiscovery(): Promise<string | null> {
    if (Math.random() > 0.05) return null
    const undiscovered = COLLECTIBLE_CATALOG
      .filter(c => c.category === 'companion_discoveries' && !this.isDiscovered(c.key))
    if (undiscovered.length === 0) return null
    // Weighted by rarity
    const weights: Record<string, number> = { common: 4, uncommon: 3, rare: 2, legendary: 1 }
    const totalWeight = undiscovered.reduce((s, c) => s + (weights[c.rarity] || 1), 0)
    let r = Math.random() * totalWeight
    for (const item of undiscovered) {
      r -= weights[item.rarity] || 1
      if (r <= 0) {
        const ok = await this.discover(item.key)
        return ok ? item.key : null
      }
    }
    return null
  }

  /** Check focus milestone achievements */
  async checkFocusMilestones(totalMinutes: number, streak: number) {
    const hours = totalMinutes / 60
    const milestones: [number, string][] = [
      [10, 'focus_10h'], [25, 'focus_25h'], [50, 'focus_50h'],
      [100, 'focus_100h'], [150, 'focus_150h'], [200, 'focus_200h'],
      [250, 'focus_250h'], [300, 'focus_300h'], [400, 'focus_400h'],
      [500, 'focus_500h'], [750, 'focus_750h'], [1000, 'focus_1000h'],
    ]
    for (const [h, key] of milestones) {
      if (hours >= h) await this.discover(key)
    }
    if (streak >= 7) await this.discover('focus_streak_7')
    if (streak >= 30) await this.discover('focus_streak_30')
    if (streak >= 100) await this.discover('focus_streak_100')
  }

  /** Check mood milestones */
  async checkMoodMilestones(totalCheckins: number, hasAllScores: boolean) {
    if (totalCheckins >= 1) await this.discover('mood_first')
    if (totalCheckins >= 100) await this.discover('mood_100')
    if (hasAllScores) await this.discover('mood_all_scores')
  }
}
