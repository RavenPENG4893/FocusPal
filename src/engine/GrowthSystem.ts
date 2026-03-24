// Growth & Level System
// XP from focus sessions → levels → unlocks

import { invoke } from '@tauri-apps/api/core'

export interface LevelInfo {
  level: number
  currentXP: number
  xpForNext: number     // XP needed for next level
  cumulativeXP: number  // total XP at this level threshold
  totalXP: number       // actual total XP earned
  progress: number      // 0-1 progress to next level
}

export interface Unlock {
  level: number
  description: string
  type: 'animation' | 'decoration' | 'skin' | 'feature'
}

// Level thresholds: [level, cumulative XP required, unlock description, type]
const LEVEL_TABLE: [number, number, string, Unlock['type']][] = [
  [1,  0,     'Base character + idle/working', 'animation'],
  [2,  50,    'Happy animation + new mumbles', 'animation'],
  [3,  150,   'Sleepy animation + coffee cup', 'decoration'],
  [4,  300,   'Curious animation', 'animation'],
  [5,  550,   'Stressed animation + desk plant', 'decoration'],
  [6,  850,   'Caring animation', 'animation'],
  [7,  1100,  'Resting animation + bookshelf', 'decoration'],
  [8,  1400,  'Dancing animation', 'animation'],
  [9,  1850,  'Desk monitor upgrade', 'decoration'],
  [10, 2400,  'Celebration animation + window', 'decoration'],
  [12, 3600,  'Special mumble pool', 'feature'],
  [15, 5400,  'Graduate Student skin', 'skin'],
  [20, 10200, 'Golden border + achievement badge', 'feature'],
]

export function calcLevel(totalXP: number): LevelInfo {
  let level = 1
  let cumXP = 0

  for (let i = 0; i < LEVEL_TABLE.length; i++) {
    const [lvl, threshold] = LEVEL_TABLE[i]
    if (totalXP >= threshold) {
      level = lvl
      cumXP = threshold
    } else {
      break
    }
  }

  // Find next level threshold
  const nextEntry = LEVEL_TABLE.find(([, t]) => t > totalXP)
  const xpForNext = nextEntry ? nextEntry[1] - cumXP : 0
  const xpIntoLevel = totalXP - cumXP
  const progress = xpForNext > 0 ? Math.min(xpIntoLevel / xpForNext, 1) : 1

  return {
    level,
    currentXP: xpIntoLevel,
    xpForNext,
    cumulativeXP: cumXP,
    totalXP,
    progress,
  }
}

export function getUnlocks(level: number): Unlock[] {
  return LEVEL_TABLE
    .filter(([lvl]) => lvl <= level)
    .map(([lvl, , desc, type]) => ({ level: lvl, description: desc, type }))
}

export function getNextUnlock(level: number): Unlock | null {
  const next = LEVEL_TABLE.find(([lvl]) => lvl > level)
  if (!next) return null
  return { level: next[0], description: next[2], type: next[3] }
}

// Check if a level-up happened and record milestones
export async function checkLevelUp(prevXP: number, newXP: number): Promise<number | null> {
  const prevLevel = calcLevel(prevXP).level
  const newLevel = calcLevel(newXP).level

  if (newLevel > prevLevel) {
    // Record milestone in growth album
    const unlock = LEVEL_TABLE.find(([lvl]) => lvl === newLevel)
    const caption = unlock ? unlock[2] : `Reached level ${newLevel}`
    try {
      await invoke('insert_album_entry', {
        event: `level_up_${newLevel}`,
        caption: `Level ${newLevel}: ${caption}`,
      })
    } catch (e) {
      console.error('[Growth] album insert error:', e)
    }
    return newLevel
  }
  return null
}

export async function getTotalXP(): Promise<number> {
  try {
    return await invoke<number>('get_total_xp')
  } catch {
    return 0
  }
}

export async function recordMilestone(event: string, caption: string) {
  try {
    await invoke('insert_album_entry', { event, caption })
  } catch (e) {
    console.error('[Growth] milestone error:', e)
  }
}
