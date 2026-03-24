// Screen Light Adaptation: detects OS dark/light mode and adapts character visuals
// Combines with time-of-day for 4 distinct visual combos

import { getTimePeriod, type TimePeriod } from './TimeOfDay'

export type LightCombo = 'dark_night' | 'dark_day' | 'light_night' | 'light_day'

let _isDark = false
const _listeners: ((dark: boolean) => void)[] = []

/** Initialize dark mode detection via matchMedia */
export function initScreenLight() {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  _isDark = mq.matches

  mq.addEventListener('change', (e) => {
    _isDark = e.matches
    console.log(`[ScreenLight] Dark mode: ${_isDark}`)
    for (const cb of _listeners) cb(_isDark)
  })

  console.log(`[ScreenLight] Initial dark mode: ${_isDark}`)
}

export function isDarkMode(): boolean {
  return _isDark
}

export function onDarkModeChange(cb: (dark: boolean) => void) {
  _listeners.push(cb)
}

/** Get the current light combo based on dark mode + time of day */
export function getLightCombo(timePeriod?: TimePeriod): LightCombo {
  const tp = timePeriod ?? getTimePeriod()
  const isNight = tp === 'evening' || tp === 'night' || tp === 'late_night' || tp === 'dusk'

  if (_isDark && isNight) return 'dark_night'
  if (_isDark && !isNight) return 'dark_day'
  if (!_isDark && isNight) return 'light_night'
  return 'light_day'
}

/** Get a comment when dark mode combo is unusual */
export function getLightComment(combo: LightCombo): string | null {
  switch (combo) {
    case 'dark_day':
      return '白天用暗色模式？我尊重这个审美~'
    case 'light_night':
      return '这么晚了还用亮色模式，眼睛不累吗？'
    default:
      return null
  }
}
