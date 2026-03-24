// Mumble Bubble System
// Random speech bubbles with context-aware weighted selection
// 80+ messages, 8-second display, 15-30 min interval

export type MumbleContext =
  | 'time_morning'
  | 'time_afternoon'
  | 'time_evening'
  | 'time_late'
  | 'idle'
  | 'system_cpu'
  | 'system_battery_low'
  | 'system_charging'
  | 'post_focus'
  | 'playful'
  | 'focus_streak'

interface MumbleMessage {
  text: string
  context: MumbleContext
}

const MESSAGES: MumbleMessage[] = [
  // Time-based: Morning
  { text: 'Good morning! Let\'s conquer today~', context: 'time_morning' },
  { text: 'Rise and shine! ☀️', context: 'time_morning' },
  { text: 'A new day, a new adventure!', context: 'time_morning' },
  { text: 'Coffee first, then world domination.', context: 'time_morning' },
  { text: 'The early bird gets the worm~', context: 'time_morning' },
  { text: 'Stretch! Ready to go!', context: 'time_morning' },
  { text: 'What shall we do today?', context: 'time_morning' },

  // Time-based: Afternoon
  { text: 'Keep going, you\'re doing great!', context: 'time_afternoon' },
  { text: 'Halfway through the day already!', context: 'time_afternoon' },
  { text: 'Don\'t forget to eat lunch~', context: 'time_afternoon' },
  { text: 'Afternoon slump? I believe in you!', context: 'time_afternoon' },
  { text: 'You\'ve been working hard today.', context: 'time_afternoon' },
  { text: 'Maybe a short break?', context: 'time_afternoon' },
  { text: 'The sun is still high, let\'s go!', context: 'time_afternoon' },

  // Time-based: Evening
  { text: 'The sunset is beautiful today~', context: 'time_evening' },
  { text: 'Great work today! Almost done.', context: 'time_evening' },
  { text: 'Evening vibes~ Time to wind down?', context: 'time_evening' },
  { text: 'What a productive day!', context: 'time_evening' },
  { text: 'Dinner time soon?', context: 'time_evening' },
  { text: 'The stars will be out soon~', context: 'time_evening' },

  // Time-based: Late night
  { text: 'Still up? I\'m right here with you.', context: 'time_late' },
  { text: 'It\'s getting late... take care of yourself.', context: 'time_late' },
  { text: 'Night owl mode activated~', context: 'time_late' },
  { text: 'The world is quiet at this hour.', context: 'time_late' },
  { text: 'Don\'t stay up too late, okay?', context: 'time_late' },
  { text: 'Midnight snack time?', context: 'time_late' },
  { text: 'Shh... everyone else is sleeping~', context: 'time_late' },

  // Idle observation
  { text: 'I wonder what clouds are made of...', context: 'idle' },
  { text: 'Did you know octopi have 3 hearts?', context: 'idle' },
  { text: '*hums a tiny tune*', context: 'idle' },
  { text: 'I spy with my little eye...', context: 'idle' },
  { text: 'If I could fly, I\'d visit the moon~', context: 'idle' },
  { text: '*stares at a dust particle*', context: 'idle' },
  { text: 'I just thought of a great joke!', context: 'idle' },
  { text: 'Your desktop wallpaper is nice~', context: 'idle' },
  { text: '*practices a tiny dance*', context: 'idle' },
  { text: 'La la la~ ♪', context: 'idle' },
  { text: 'What if pixels could dream?', context: 'idle' },
  { text: '*counts the icons on your desktop*', context: 'idle' },
  { text: 'I wonder what other apps think of me...', context: 'idle' },
  { text: 'Being a pixel creature is nice~', context: 'idle' },
  { text: '*tries to catch a cursor*', context: 'idle' },

  // System-aware: CPU high
  { text: 'Your computer is working hard too!', context: 'system_cpu' },
  { text: 'CPU is burning up! Everything okay?', context: 'system_cpu' },
  { text: 'So many calculations... *sweats*', context: 'system_cpu' },
  { text: 'The fan is so loud today!', context: 'system_cpu' },
  { text: 'Heavy load! Need help?', context: 'system_cpu' },

  // System-aware: Battery low
  { text: 'Battery getting low, save your work~', context: 'system_battery_low' },
  { text: 'We\'re running out of juice!', context: 'system_battery_low' },
  { text: 'Find a charger, quick!', context: 'system_battery_low' },
  { text: 'I\'m feeling... sleepy... *yawn*', context: 'system_battery_low' },
  { text: 'Low power... must... save... energy...', context: 'system_battery_low' },

  // System-aware: Charging
  { text: 'Ahh, power flowing in~ feels good!', context: 'system_charging' },
  { text: 'Charging up! Full power soon~', context: 'system_charging' },
  { text: 'Plugged in and ready to go!', context: 'system_charging' },

  // Post-focus
  { text: 'Great session! You earned it.', context: 'post_focus' },
  { text: 'Break time! Stretch those arms.', context: 'post_focus' },
  { text: 'Well done! That was solid focus.', context: 'post_focus' },
  { text: 'You did it! Time to relax~', context: 'post_focus' },
  { text: 'Amazing focus! I\'m proud of you!', context: 'post_focus' },

  // Focus streak
  { text: '3-day streak! I\'m so proud of you!', context: 'focus_streak' },
  { text: 'You\'re on fire this week!', context: 'focus_streak' },
  { text: 'Consistency is key~ keep it up!', context: 'focus_streak' },
  { text: 'Streak master! Nothing can stop you!', context: 'focus_streak' },

  // Playful
  { text: 'I learned a new dance, wanna see?', context: 'playful' },
  { text: 'Psst... I hid a surprise somewhere.', context: 'playful' },
  { text: 'Boop! *pokes you*', context: 'playful' },
  { text: 'Tag, you\'re it!', context: 'playful' },
  { text: '*does a backflip* ...almost.', context: 'playful' },
  { text: 'If I had a hat, I\'d tip it to you~', context: 'playful' },
  { text: 'Wanna hear a secret?', context: 'playful' },
  { text: '*pretends to be a plant*', context: 'playful' },
  { text: 'I believe I can fly~ ♪', context: 'playful' },
  { text: '*waves at your cursor*', context: 'playful' },
]

function getTimeContext(): MumbleContext {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'time_morning'
  if (hour >= 12 && hour < 17) return 'time_afternoon'
  if (hour >= 17 && hour < 21) return 'time_evening'
  return 'time_late'
}

export class MumbleBubbleSystem {
  private recentIndices: Set<number> = new Set()
  private recentSkinIndices: Set<number> = new Set()
  private maxRecent = 20
  private _skinMumbles: string[] = []

  /** Set additional mumbles from the active skin */
  setSkinMumbles(mumbles: string[]) {
    this._skinMumbles = mumbles
    this.recentSkinIndices.clear()
  }

  // Get a context-aware message with weighted random selection
  pickMessage(opts?: {
    cpuHigh?: boolean
    batteryLow?: boolean
    isCharging?: boolean
  }): string {
    // 25% chance to use a skin-specific mumble if available
    if (this._skinMumbles.length > 0 && Math.random() < 0.25) {
      const fresh = this._skinMumbles
        .map((text, idx) => ({ text, idx }))
        .filter(({ idx }) => !this.recentSkinIndices.has(idx))
      const pool = fresh.length > 0 ? fresh : this._skinMumbles.map((text, idx) => ({ text, idx }))
      const pick = pool[Math.floor(Math.random() * pool.length)]
      this.recentSkinIndices.add(pick.idx)
      if (this.recentSkinIndices.size > 5) {
        const first = this.recentSkinIndices.values().next().value
        if (first !== undefined) this.recentSkinIndices.delete(first)
      }
      return pick.text
    }

    // Priority: system-aware messages take precedence
    let contextFilter: MumbleContext | null = null

    if (opts?.cpuHigh) contextFilter = 'system_cpu'
    else if (opts?.batteryLow) contextFilter = 'system_battery_low'
    else if (opts?.isCharging) contextFilter = 'system_charging'

    let candidates: { msg: MumbleMessage; idx: number }[]

    if (contextFilter) {
      candidates = MESSAGES
        .map((msg, idx) => ({ msg, idx }))
        .filter(({ msg }) => msg.context === contextFilter)
    } else {
      // Mix time-based + idle + playful
      const timeCtx = getTimeContext()
      candidates = MESSAGES
        .map((msg, idx) => ({ msg, idx }))
        .filter(({ msg }) =>
          msg.context === timeCtx ||
          msg.context === 'idle' ||
          msg.context === 'playful'
        )
    }

    // Filter out recently shown
    const fresh = candidates.filter(({ idx }) => !this.recentIndices.has(idx))
    const pool = fresh.length > 0 ? fresh : candidates

    // Random pick
    const pick = pool[Math.floor(Math.random() * pool.length)]

    // Track recency
    this.recentIndices.add(pick.idx)
    if (this.recentIndices.size > this.maxRecent) {
      const first = this.recentIndices.values().next().value
      if (first !== undefined) this.recentIndices.delete(first)
    }

    return pick.msg.text
  }
}
