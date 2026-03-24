<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import CompanionCanvas from './components/CompanionCanvas.vue'
import RadialMenu from './components/RadialMenu.vue'
import CelestialArc from './components/CelestialArc.vue'
import ChatBubble from './components/ChatBubble.vue'
import FocusTimer from './components/FocusTimer.vue'
import MoodCheckIn from './components/MoodCheckIn.vue'
import MoodDashboard from './components/MoodDashboard.vue'
import GrowthPanel from './components/GrowthPanel.vue'
import ReminderPopup from './components/ReminderPopup.vue'
import WhiteNoisePanel from './components/WhiteNoisePanel.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import type { AnimationState } from './engine/AnimationStateMachine'
import { MumbleBubbleSystem } from './engine/MumbleBubble'
import { getTimePeriod, type TimePeriod } from './engine/TimeOfDay'
import { initLLM, type LLMStatus } from './engine/LLMService'
import { checkLevelUp, getTotalXP, recordMilestone } from './engine/GrowthSystem'
import { ReminderEngine, type ReminderType, type ReminderResponse } from './engine/ReminderEngine'
import { WhiteNoiseEngine, type SoundType } from './engine/WhiteNoise'
import { AutonomousLife } from './engine/AutonomousLife'
import { chat, type ChatMessage } from './engine/LLMService'
import { loadSkinSetting, getActiveSkin, type SkinDef } from './engine/SkinSystem'

// ── System data types ──

interface SystemStats {
  cpu_percent: number
  memory_used_percent: number
  memory_total_gb: number
}

interface BatteryStatus {
  charge_percent: number
  is_charging: boolean
  time_to_empty_min: number | null
}

interface InputActivity {
  key_count: number
  mouse_clicks: number
}

// ── State ──
// Initial values from localStorage (fallback), will be migrated to SQLite on mount
const isHatched = ref(localStorage.getItem('hatched') === 'true')
const isNaming = ref(false)
const nameInput = ref('')
const currentState = ref<AnimationState>(isHatched.value ? 'idle' : 'hatching')
const stats = ref<SystemStats | null>(null)
const battery = ref<BatteryStatus | null>(null)
const input = ref<InputActivity | null>(null)
const showDebug = ref(false)
const companionName = ref(localStorage.getItem('companion_name') || 'FocusPal')

// SQLite config helpers
async function configGet(key: string): Promise<string | null> {
  try {
    return await invoke<string | null>('config_get', { key })
  } catch { return null }
}
async function configSet(key: string, value: string) {
  try {
    await invoke('config_set', { key, value })
  } catch (e) { console.error('[Config] set error:', e) }
}

// Migrate localStorage → SQLite on first run, then always use SQLite
async function migrateToSqlite() {
  // hatched
  const dbHatched = await configGet('hatched')
  if (dbHatched === null && localStorage.getItem('hatched')) {
    await configSet('hatched', localStorage.getItem('hatched')!)
  } else if (dbHatched !== null) {
    isHatched.value = dbHatched === 'true'
    currentState.value = isHatched.value ? 'idle' : 'hatching'
  }

  // companion_name
  const dbName = await configGet('companion_name')
  if (dbName === null && localStorage.getItem('companion_name')) {
    await configSet('companion_name', localStorage.getItem('companion_name')!)
  } else if (dbName) {
    companionName.value = dbName
  }

  // llm settings
  const dbLlmMode = await configGet('llm_mode')
  if (dbLlmMode === null && localStorage.getItem('focuspal_llm_settings')) {
    try {
      const old = JSON.parse(localStorage.getItem('focuspal_llm_settings')!)
      await configSet('llm_mode', old.mode || 'cloud')
      await configSet('llm_api_key', old.apiKey || '')
    } catch {}
  }

  // last_day (for morning greeting)
  const dbLastDay = await configGet('last_day')
  if (dbLastDay === null && localStorage.getItem('focuspal_last_day')) {
    await configSet('last_day', localStorage.getItem('focuspal_last_day')!)
  }
}

// Radial menu
const showRadialMenu = ref(false)

// System metrics → visual state
const clutterLevel = ref(0)
let cpuHighCount = 0 // consecutive high CPU polls
let prevCharging = false
let prevChargePercent = -1
let sipTimer = 0
let stateBeforeSip: AnimationState | null = null

// LLM & Chat
const llmStatus = ref<LLMStatus>('stopped')
const showChat = ref(false)
const showFocus = ref(false)
const focusTimerRef = ref<InstanceType<typeof FocusTimer> | null>(null)
const isFocusing = ref(false)

// Growth system
const showGrowthPanel = ref(false)

// Reminder system
const reminderEngine = new ReminderEngine()
const activeReminder = ref<ReminderType | null>(null)

const REMINDER_ANIM_MAP: Record<ReminderType, AnimationState> = {
  water: 'drinking',
  stretch: 'stretching',
  eyes: 'eyerest',
}

reminderEngine.onReminder((type) => {
  // Don't show if another panel is open or not hatched
  if (!isHatched.value || showChat.value || showFocus.value || showMoodDashboard.value || showGrowthPanel.value) return
  if (activeReminder.value) return // already showing a reminder
  activeReminder.value = type
  currentState.value = REMINDER_ANIM_MAP[type]
})

function onReminderRespond(type: ReminderType, response: ReminderResponse) {
  activeReminder.value = null
  currentState.value = 'idle'
  reminderEngine.respond(type, response)
}

// White noise system
const noiseEngine = new WhiteNoiseEngine()
const showNoisePanel = ref(false)
const activeSounds = ref<SoundType[]>([])

function onSoundsChanged(types: SoundType[]) {
  activeSounds.value = types
}

// Settings & Skin system
const showSettings = ref(false)

function onSkinChanged(skinId: string) {
  const skin = getActiveSkin()
  mumbleSystem.setSkinMumbles(skin.mumbles)
}

function onNameChanged(name: string) {
  companionName.value = name
}

// Autonomous life system
const autonomousLife = new AutonomousLife()
let awayCheckTimer = 0

autonomousLife.onActivity((state) => {
  // Only change state if we're actually away (don't override user-triggered states)
  if (autonomousLife.isAway) {
    currentState.value = state
  }
})

async function onReturnFromAway() {
  const summary = autonomousLife.getReturnSummary()
  if (!summary) {
    currentState.value = 'happy'
    mumbleText.value = 'Welcome back!'
    mumbleVisible.value = true
    setTimeout(() => { mumbleVisible.value = false }, 4000)
    return
  }

  currentState.value = 'happy'

  // Try to generate a personalized greeting via LLM
  if (llmStatus.value === 'ready') {
    try {
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `You are a cute desktop companion named ${companionName.value}. The user just came back after being away. Generate a short, warm greeting (1-2 sentences, casual and cute). Mention what you did while they were away. Keep it under 60 characters.`,
        },
        { role: 'user', content: summary },
      ]
      const res = await chat(messages, { max_tokens: 80, temperature: 0.8 })
      mumbleText.value = res.content.trim()
    } catch {
      mumbleText.value = summary
    }
  } else {
    mumbleText.value = summary
  }
  mumbleVisible.value = true
  setTimeout(() => { mumbleVisible.value = false }, 6000)
}

// Mood system
const showMoodCheckIn = ref(false)
const showMoodDashboard = ref(false)
let moodTimer = 0
const MOOD_INTERVAL = 3 * 60 * 60 * 1000 // 3 hours
let lastMoodTime = 0 // cached from SQLite

async function refreshLastMoodTime() {
  try {
    lastMoodTime = await invoke<number>('get_last_mood_time')
  } catch { lastMoodTime = 0 }
}

async function getRecentMoodAvg(): Promise<number> {
  try {
    const stats = await invoke<{ avg_7d: number }>('get_mood_stats')
    return stats.avg_7d
  } catch { return 3 }
}

async function isLowMoodStreak(): Promise<boolean> {
  try {
    const now = Date.now()
    const records = await invoke<{ score: number }[]>('query_moods', {
      fromTs: now - 86400000, toTs: now,
    })
    const last3 = records.slice(-3)
    return last3.length >= 3 && last3.every(m => m.score <= 2)
  } catch { return false }
}

function shouldShowMoodCheckIn(): boolean {
  if (lastMoodTime === 0) return true
  return Date.now() - lastMoodTime > MOOD_INTERVAL
}

function scheduleMoodCheckIn() {
  clearInterval(moodTimer)
  moodTimer = window.setInterval(() => {
    if (!isHatched.value || isFocusing.value || showChat.value || showFocus.value) return
    if (shouldShowMoodCheckIn()) {
      showMoodCheckIn.value = true
    }
  }, 60000) // check every minute
}

// Time of day
const timePeriod = ref<TimePeriod>(getTimePeriod())
let timeCheckTimer: number = 0

// Mumble bubble
const mumbleSystem = new MumbleBubbleSystem()
const mumbleText = ref('')
const mumbleVisible = ref(false)
let mumbleTimer: number = 0
let mumbleHideTimer: number = 0

// Gradual transition timers
let workingTimeout: number = 0
let curiousTimeout: number = 0
let sleepyTimeout: number = 0
const WORKING_IDLE_MS = 3000
const CURIOUS_MS = 30 * 1000
const SLEEPY_MS = 3 * 60 * 1000

// ── Hatching ceremony ──

function onEggClick() {
  if (!isHatched.value && currentState.value !== 'hatching') {
    currentState.value = 'hatching'
  }
}

function onHatchComplete(newState: AnimationState) {
  // When hatching animation finishes, it transitions to 'happy'
  if (!isHatched.value && newState === 'happy') {
    isNaming.value = true
  }
}

async function confirmName() {
  const name = nameInput.value.trim() || 'FocusPal'
  companionName.value = name
  // Save to both localStorage (fallback) and SQLite
  localStorage.setItem('companion_name', name)
  localStorage.setItem('hatched', 'true')
  await configSet('companion_name', name)
  await configSet('hatched', 'true')
  isHatched.value = true
  isNaming.value = false
  currentState.value = 'happy'
  startMumbleLoop()
  resetIdleTimer()
  // Record hatching milestone
  recordMilestone('hatched', `${name} was born!`)
}

// ── Mumble bubble ──

function showMumble() {
  if (isNaming.value || !isHatched.value) return

  const opts = {
    cpuHigh: (stats.value?.cpu_percent ?? 0) > 80,
    batteryLow: (battery.value?.charge_percent ?? 100) < 20,
    isCharging: battery.value?.is_charging ?? false,
  }
  mumbleText.value = mumbleSystem.pickMessage(opts)
  mumbleVisible.value = true

  clearTimeout(mumbleHideTimer)
  mumbleHideTimer = window.setTimeout(() => {
    mumbleVisible.value = false
  }, 8000)
}

function startMumbleLoop() {
  // Random interval: 15-30 minutes
  function scheduleNext() {
    const delay = (15 + Math.random() * 15) * 60 * 1000
    mumbleTimer = window.setTimeout(() => {
      showMumble()
      scheduleNext()
    }, delay)
  }
  // Show first mumble after 30 seconds
  mumbleTimer = window.setTimeout(() => {
    showMumble()
    scheduleNext()
  }, 30000)
}

// ── System polling ──

let statsTimer: number
let batteryTimer: number
let inputTimer: number

async function pollStats() {
  try {
    stats.value = await invoke<SystemStats>('get_system_stats')
    if (!isHatched.value || !stats.value) return

    const cpu = stats.value.cpu_percent
    const mem = stats.value.memory_used_percent

    // Memory → desk clutter level + interactive animation states
    if (mem > 90) {
      clutterLevel.value = 3
    } else if (mem > 75) {
      clutterLevel.value = 2
    } else if (mem > 60) {
      clutterLevel.value = 1
    } else {
      clutterLevel.value = 0
    }

    // CPU → animation states (only override if not in a user-triggered state)
    const s = currentState.value
    const userStates = ['chatting', 'caring', 'hatching', 'happy', 'cleaning',
      'charging', 'unplugged', 'fullbattery', 'lowbattery', 'sipping',
      'drinking', 'stretching', 'eyerest',
      'reading', 'tidying', 'daydreaming', 'napping', 'slacking', 'gaming', 'dancing', 'doodling']
    if (userStates.includes(s)) return

    // Memory → interactive character animations (lower priority than CPU)
    const memStates = ['crumpling', 'rummaging']

    if (cpu > 90) {
      cpuHighCount++
      if (cpuHighCount >= 3) {
        currentState.value = 'overloaded'
      } else {
        currentState.value = 'sweating'
      }
    } else if (cpu > 70) {
      cpuHighCount = Math.max(cpuHighCount - 1, 0)
      currentState.value = 'sweating'
    } else {
      // CPU back to normal
      if (cpuHighCount > 0) cpuHighCount = Math.max(cpuHighCount - 1, 0)
      if (s === 'sweating' || s === 'overloaded') {
        currentState.value = 'cleaning'
      } else if (!memStates.includes(s) || clutterLevel.value < 2) {
        if (mem > 90) {
          currentState.value = 'rummaging'
        } else if (mem > 75) {
          currentState.value = 'crumpling'
        } else if (memStates.includes(s)) {
          currentState.value = 'idle'
        }
      }
    }
  } catch {}
}

async function pollBattery() {
  try {
    battery.value = await invoke<BatteryStatus>('get_battery_status')
    if (!isHatched.value || !battery.value) return

    const charge = battery.value.charge_percent
    const charging = battery.value.is_charging
    const s = currentState.value

    // First poll: just record baseline, don't trigger animations
    if (prevChargePercent < 0) {
      prevCharging = charging
      prevChargePercent = charge
      return
    }

    // Don't override user-triggered or CPU-driven states
    const protectedStates = ['chatting', 'caring', 'hatching', 'happy', 'cleaning',
      'sweating', 'overloaded', 'working', 'fullbattery', 'charging']
    if (protectedStates.includes(s) && s !== 'lowbattery') {
      prevCharging = charging
      prevChargePercent = charge
      return
    }

    // Just plugged in → charging animation
    if (charging && !prevCharging) {
      currentState.value = 'charging'
      prevCharging = charging
      prevChargePercent = charge
      return
    }

    // Just unplugged → startled shrug, then lowbattery or idle
    if (!charging && prevCharging) {
      currentState.value = 'unplugged'
      prevCharging = charging
      prevChargePercent = charge
      return
    }

    // Hit 100% while charging → celebration
    if (charge >= 99.5 && charging && prevChargePercent < 99.5) {
      currentState.value = 'fullbattery'
      prevCharging = charging
      prevChargePercent = charge
      return
    }

    // Low battery → drowsy
    if (!charging && charge < 20 && s !== 'lowbattery') {
      currentState.value = 'lowbattery'
    }

    // Battery recovered above 20% → exit lowbattery
    if (s === 'lowbattery' && charge >= 20) {
      currentState.value = 'idle'
    }

    prevCharging = charging
    prevChargePercent = charge
  } catch {}
}

async function pollInput() {
  if (!isHatched.value) return
  try {
    input.value = await invoke<InputActivity>('get_input_activity')
    if (input.value) {
      const hasInput = input.value.key_count > 0 || input.value.mouse_clicks > 0

      if (hasInput) {
        resetIdleTimer()
        // Report activity to focus timer for auto-pause detection
        focusTimerRef.value?.reportActivity()
        // Report to autonomous life (handles return-from-away)
        const wasAway = autonomousLife.isAway
        autonomousLife.reportInput()
        if (wasAway) {
          onReturnFromAway()
        }
      }

      if (input.value.key_count > 0) {
        if (currentState.value === 'sleepy') {
          currentState.value = 'wakeup'
        } else if (currentState.value === 'idle' || currentState.value === 'curious') {
          currentState.value = 'working'
        }
        clearTimeout(workingTimeout)
        // Don't auto-leave working during focus session
        if (!isFocusing.value) {
          workingTimeout = window.setTimeout(() => {
            if (currentState.value === 'working' && !isFocusing.value) {
              currentState.value = 'idle'
            }
          }, WORKING_IDLE_MS)
        }
      }

      if (input.value.mouse_clicks > 5 && !isFocusing.value) {
        currentState.value = 'stressed'
      }
    }
  } catch {}
}

function resetIdleTimer() {
  clearTimeout(curiousTimeout)
  clearTimeout(sleepyTimeout)

  curiousTimeout = window.setTimeout(() => {
    if (currentState.value === 'idle') {
      currentState.value = 'curious'
    }
  }, CURIOUS_MS)

  sleepyTimeout = window.setTimeout(() => {
    const s = currentState.value
    if (s === 'idle' || s === 'curious') {
      currentState.value = 'sleepy'
    }
  }, SLEEPY_MS)
}

// ── Lifecycle ──

onMounted(async () => {
  // Migrate localStorage → SQLite
  await migrateToSqlite()
  await refreshLastMoodTime()

  // Load skin setting and apply skin mumbles
  await loadSkinSetting()
  const skin = getActiveSkin()
  mumbleSystem.setSkinMumbles(skin.mumbles)

  pollStats()
  pollBattery()
  pollInput()
  statsTimer = window.setInterval(pollStats, 5000)
  batteryTimer = window.setInterval(pollBattery, 5000)
  inputTimer = window.setInterval(pollInput, 1000)

  if (isHatched.value) {
    resetIdleTimer()
    startMumbleLoop()
  }

  // Sipping: occasionally triggered when memory > 60%
  sipTimer = window.setInterval(() => {
    if (!isHatched.value || clutterLevel.value < 1) return
    const s = currentState.value
    // Don't interrupt important states
    const noInterrupt = ['chatting', 'caring', 'hatching', 'happy', 'cleaning',
      'charging', 'unplugged', 'fullbattery', 'lowbattery', 'sipping',
      'sweating', 'overloaded', 'rummaging', 'crumpling',
      'drinking', 'stretching', 'eyerest',
      'reading', 'tidying', 'daydreaming', 'napping', 'slacking', 'gaming', 'dancing', 'doodling']
    if (noInterrupt.includes(s)) return
    // Save current state and trigger sipping
    stateBeforeSip = s
    currentState.value = 'sipping'
  }, 25000) // every ~25 seconds

  // Update time-of-day every 5 minutes
  timeCheckTimer = window.setInterval(() => {
    timePeriod.value = getTimePeriod()
  }, 5 * 60 * 1000)

  // Start LLM server in background
  if (isHatched.value) {
    initLLM((s) => { llmStatus.value = s })
  }

  // Smart reminders
  if (isHatched.value) {
    await reminderEngine.loadSettings()
    reminderEngine.start()
  }

  // Autonomous life: check for away every 30 seconds
  if (isHatched.value) {
    awayCheckTimer = window.setInterval(() => {
      if (!isFocusing.value) {
        autonomousLife.checkAway()
      }
    }, 30_000)
  }

  // Mood check-in scheduler
  if (isHatched.value) {
    scheduleMoodCheckIn()
    // Show mood check-in on launch if due
    if (shouldShowMoodCheckIn()) {
      setTimeout(() => { showMoodCheckIn.value = true }, 5000)
    }
  }

  // Morning greeting: first launch of the day
  if (isHatched.value) {
    const today = new Date().toISOString().slice(0, 10)
    const lastDay = await configGet('last_day')
    if (lastDay !== today) {
      await configSet('last_day', today)
      const avg = await getRecentMoodAvg()
      const greetings = avg >= 4
        ? ['Good morning! Ready for a great day~', 'Hey! Slept well? Let\'s go!']
        : avg <= 2
        ? ['Morning... hope today is better. I\'m here for you.', 'New day, fresh start. You\'ve got this.']
        : ['Good morning! Let\'s have a nice day.', 'Hey there! Another day together~']
      const msg = greetings[Math.floor(Math.random() * greetings.length)]
      setTimeout(() => {
        mumbleText.value = msg
        mumbleVisible.value = true
        currentState.value = 'caring'
        setTimeout(() => { mumbleVisible.value = false }, 6000)
      }, 3000)
    }
  }
})

onUnmounted(() => {
  clearInterval(statsTimer)
  clearInterval(batteryTimer)
  clearInterval(inputTimer)
  clearTimeout(curiousTimeout)
  clearTimeout(sleepyTimeout)
  clearTimeout(workingTimeout)
  clearTimeout(mumbleTimer)
  clearTimeout(mumbleHideTimer)
  clearInterval(sipTimer)
  clearInterval(moodTimer)
  clearInterval(timeCheckTimer)
  reminderEngine.stop()
  noiseEngine.destroy()
  autonomousLife.stop()
  clearInterval(awayCheckTimer)
})

function onCanvasClick() {
  if (!isHatched.value) {
    onEggClick()
    return
  }
  // Toggle radial menu
  showRadialMenu.value = !showRadialMenu.value
}

function onRadialSelect(item: string) {
  showRadialMenu.value = false
  switch (item) {
    case 'focus':
      showFocus.value = true
      break
    case 'chat':
      showChat.value = true
      currentState.value = 'chatting'
      break
    case 'mood':
      showMoodDashboard.value = true
      break
    case 'growth':
      showGrowthPanel.value = true
      break
    case 'sound':
      showNoisePanel.value = true
      break
    case 'settings':
      showSettings.value = true
      break
  }
}

function onRadialClose() {
  showRadialMenu.value = false
}

function onChatClose() {
  showChat.value = false
  currentState.value = isFocusing.value ? 'working' : 'idle'
}

let soundsBeforeFocus: SoundType[] = []

async function onFocusStart() {
  isFocusing.value = true
  currentState.value = 'working'
  reminderEngine.setDND(true) // suppress reminders during focus

  // Auto-play focus sound if configured and nothing playing
  if (activeSounds.value.length === 0) {
    const autoSound = await configGet('focus_auto_sound')
    if (autoSound && autoSound !== 'none') {
      soundsBeforeFocus = []
      noiseEngine.startSound(autoSound as SoundType)
      activeSounds.value = noiseEngine.getActiveSoundTypes()
    }
  } else {
    soundsBeforeFocus = [...activeSounds.value]
  }
}

async function handleXPGain(xp: number) {
  if (xp <= 0) return
  try {
    const totalXP = await getTotalXP()
    const prevXP = totalXP - xp
    const newLevel = await checkLevelUp(prevXP, totalXP)
    if (newLevel) {
      // Level up! Show celebration
      mumbleText.value = `Level ${newLevel}! 🎉`
      mumbleVisible.value = true
      currentState.value = 'happy'
      setTimeout(() => { mumbleVisible.value = false }, 5000)
    }
  } catch (e) {
    console.error('[Growth] level check error:', e)
  }
}

async function onFocusComplete(xp: number, minutes: number) {
  isFocusing.value = false
  reminderEngine.setDND(false)
  currentState.value = 'happy'
  console.log(`[Focus] complete: ${minutes}min, +${xp}XP`)
  // Show XP gain mumble
  mumbleText.value = `+${xp} XP!`
  mumbleVisible.value = true
  setTimeout(() => { mumbleVisible.value = false }, 3000)
  await handleXPGain(xp)
  // Record milestones (first focus + streaks)
  try {
    const focusStats = await invoke<{ week_sessions: number; streak: number }>('get_focus_stats')
    if (focusStats.week_sessions === 1) {
      recordMilestone('first_focus', 'Completed first focus session!')
    }
    if (focusStats.streak === 3) {
      recordMilestone('streak_3', '3-day focus streak!')
    } else if (focusStats.streak === 7) {
      recordMilestone('streak_7', '7-day focus streak!')
    }
  } catch {}
}

async function onFocusAbort(xp: number, minutes: number) {
  isFocusing.value = false
  reminderEngine.setDND(false)
  currentState.value = 'idle'
  console.log(`[Focus] aborted: ${minutes}min, +${xp}XP`)
  if (xp > 0) {
    mumbleText.value = `+${xp} XP`
    mumbleVisible.value = true
    setTimeout(() => { mumbleVisible.value = false }, 3000)
    await handleXPGain(xp)
  }
}

function onFocusIdle() {
  // Auto-paused due to inactivity
  currentState.value = 'curious'
}

async function onMoodSelect(score: number) {
  showMoodCheckIn.value = false

  // Save to SQLite
  try {
    await invoke('insert_mood', { score, tags: '' })
    await refreshLastMoodTime()
  } catch (e) {
    console.error('[Mood] insert error:', e)
  }

  if (score >= 4) {
    currentState.value = 'happy'
  } else if (score <= 2) {
    currentState.value = 'caring'
  }

  // Low mood streak → proactive comfort
  if (await isLowMoodStreak()) {
    setTimeout(() => {
      showChat.value = true
      currentState.value = 'caring'
    }, 2000)
  }
}

function onDashboardMoodRecorded(score: number) {
  if (score >= 4) {
    currentState.value = 'happy'
  } else if (score <= 2) {
    currentState.value = 'caring'
  }
}

function onMoodDismiss() {
  showMoodCheckIn.value = false
}

function onFocusClose() {
  showFocus.value = false
  if (isFocusing.value) {
    isFocusing.value = false
    reminderEngine.setDND(false)
  }
  currentState.value = 'idle'
}

function onChatThinking(val: boolean) {
  // Could add a thinking animation later
}

const systemContext = computed(() => ({
  cpu: stats.value?.cpu_percent ?? 0,
  memory: stats.value?.memory_used_percent ?? 0,
  battery: battery.value?.charge_percent ?? -1,
  isCharging: battery.value?.is_charging ?? false,
  currentState: currentState.value,
  timePeriod: timePeriod.value,
}))

function onCanvasRightClick() {
  showDebug.value = !showDebug.value
}

function onStateChange(s: AnimationState) {
  // Sipping finished → restore previous state
  if (stateBeforeSip && s === 'idle') {
    currentState.value = stateBeforeSip
    stateBeforeSip = null
    return
  }
  currentState.value = s
  onHatchComplete(s)
}

const stateLabel = computed(() => {
  if (!isHatched.value) return '🥚 Click to hatch!'
  const labels: Record<string, string> = {
    idle: '😊 Idle',
    working: '⌨️ Working',
    resting: '🧘 Resting',
    happy: '🎉 Happy',
    sleepy: '😴 Sleepy',
    chatting: '💬 Chatting',
    stressed: '😰 Stressed',
    caring: '🤗 Caring',
    curious: '🤔 Curious',
    wakeup: '🌅 Waking up',
    hatching: '🐣 Hatching...',
    sweating: '💦 Sweating',
    overloaded: '🏋️ Overloaded',
    cleaning: '🧹 Cleaning up',
    lowbattery: '🪫 Low battery',
    charging: '⚡ Charging',
    unplugged: '🔌 Unplugged',
    fullbattery: '💯 Fully charged!',
    sipping: '☕ Sipping',
    crumpling: '📝 Frustrated',
    rummaging: '🔍 Searching',
    drinking: '💧 Drinking water',
    stretching: '🧘 Stretching',
    eyerest: '👀 Eye rest',
    reading: '📖 Reading',
    tidying: '🧹 Tidying up',
    daydreaming: '💭 Daydreaming',
    napping: '😴 Napping',
    slacking: '📱 Slacking off',
    gaming: '🎮 Gaming',
    dancing: '💃 Dancing!',
    doodling: '🎨 Doodling',
  }
  return labels[currentState.value] || currentState.value
})
</script>

<template>
  <div class="companion-window">
    <!-- Sun / Moon arc -->
    <CelestialArc />

    <!-- Mumble bubble -->
    <div v-if="mumbleVisible && isHatched" class="mumble-bubble">
      {{ mumbleText }}
    </div>

    <CompanionCanvas
      :state="currentState"
      :clutter-level="clutterLevel"
      @click="onCanvasClick"
      @rightclick="onCanvasRightClick"
      @state-change="onStateChange"
    />

    <!-- Radial menu -->
    <RadialMenu
      v-if="showRadialMenu && isHatched"
      @select="onRadialSelect"
      @close="onRadialClose"
    />

    <!-- Smart reminder -->
    <ReminderPopup
      v-if="activeReminder && isHatched"
      :type="activeReminder"
      @respond="onReminderRespond"
    />

    <!-- Mood check-in -->
    <MoodCheckIn
      v-if="showMoodCheckIn && isHatched"
      @select="onMoodSelect"
      @dismiss="onMoodDismiss"
    />

    <!-- Mood dashboard -->
    <MoodDashboard
      v-if="showMoodDashboard && isHatched"
      @close="showMoodDashboard = false"
      @mood-recorded="onDashboardMoodRecorded"
    />

    <!-- Growth panel -->
    <GrowthPanel
      v-if="showGrowthPanel && isHatched"
      @close="showGrowthPanel = false"
    />

    <!-- White noise panel -->
    <WhiteNoisePanel
      v-if="showNoisePanel && isHatched"
      :engine="noiseEngine"
      @close="showNoisePanel = false"
      @sounds-changed="onSoundsChanged"
    />

    <!-- Settings panel -->
    <SettingsPanel
      v-if="showSettings && isHatched"
      @close="showSettings = false"
      @skin-changed="onSkinChanged"
      @name-changed="onNameChanged"
    />

    <!-- Focus timer -->
    <FocusTimer
      v-if="showFocus && isHatched"
      ref="focusTimerRef"
      @start="onFocusStart"
      @complete="onFocusComplete"
      @abort="onFocusAbort"
      @idle="onFocusIdle"
      @close="onFocusClose"
    />

    <!-- Chat panel -->
    <ChatBubble
      v-if="showChat && isHatched"
      :companion-name="companionName"
      :llm-ready="llmStatus === 'ready'"
      :system-context="systemContext"
      @close="onChatClose"
      @thinking="onChatThinking"
      @llm-status="(s: LLMStatus) => { llmStatus = s }"
    />

    <!-- Naming dialog (first launch) -->
    <div v-if="isNaming" class="naming-dialog">
      <div class="naming-title">Give me a name!</div>
      <input
        v-model="nameInput"
        class="naming-input"
        placeholder="FocusPal"
        maxlength="12"
        autofocus
        @keyup.enter="confirmName"
      />
      <button class="naming-btn" @click="confirmName">OK</button>
    </div>

    <div v-if="!isNaming" class="name-label">{{ companionName }}</div>
    <div v-if="!isNaming" class="state-label">{{ stateLabel }}</div>
    <div v-if="activeSounds.length > 0 && !isNaming" class="sound-indicator" @click="showNoisePanel = true">
      🎵 Playing
    </div>

    <div v-if="showDebug" class="debug-panel">
      <div class="debug-title">System Monitor</div>
      <div v-if="stats">
        CPU: {{ stats.cpu_percent.toFixed(1) }}%<br/>
        RAM: {{ stats.memory_used_percent.toFixed(1) }}%<br/>
        Total: {{ stats.memory_total_gb.toFixed(1) }}GB
      </div>
      <div v-if="battery">
        Battery: {{ battery.charge_percent.toFixed(0) }}%
        {{ battery.is_charging ? '⚡' : '🔋' }}
      </div>
      <div v-if="input">
        Keys/s: {{ input.key_count }}
        Clicks/s: {{ input.mouse_clicks }}
      </div>
      <div>State: {{ currentState }}</div>
      <div>Clutter: {{ clutterLevel }}/3</div>
      <div>Time: {{ timePeriod }}</div>
      <div>LLM: {{ llmStatus }}</div>
    </div>
  </div>
</template>

<style>
html, body, #app {
  margin: 0;
  padding: 0;
  background: transparent !important;
  overflow: hidden;
  user-select: none;
}

.companion-window {
  width: 200px;
  height: 350px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: transparent;
  position: relative;
}

.name-label {
  color: rgba(255, 255, 255, 0.95);
  font-size: 12px;
  font-weight: 700;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
  letter-spacing: 1px;
  margin-top: 6px;
}

.state-label {
  color: rgba(255, 255, 255, 0.7);
  font-size: 10px;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  margin-top: 2px;
}

.sound-indicator {
  color: rgba(74, 144, 217, 0.8);
  font-size: 8px;
  margin-top: 2px;
  cursor: pointer;
  animation: pulse-sound 2s ease-in-out infinite;
}
@keyframes pulse-sound {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

/* ── Mumble Bubble ── */

.mumble-bubble {
  position: absolute;
  top: 10px;
  background: rgba(255, 255, 255, 0.95);
  color: #333;
  font-size: 11px;
  padding: 6px 10px;
  border-radius: 10px;
  max-width: 160px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  animation: mumble-in 0.3s ease-out;
  z-index: 10;
}

.mumble-bubble::after {
  content: '';
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 6px solid rgba(255, 255, 255, 0.95);
}

@keyframes mumble-in {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ── Naming Dialog ── */

.naming-dialog {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  background: rgba(0, 0, 0, 0.8);
  padding: 10px 14px;
  border-radius: 10px;
}

.naming-title {
  color: #fff;
  font-size: 13px;
  font-weight: 600;
}

.naming-input {
  width: 120px;
  padding: 4px 8px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  text-align: center;
  outline: none;
  background: rgba(255, 255, 255, 0.9);
}

.naming-btn {
  background: #4A90D9;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 4px 20px;
  font-size: 12px;
  cursor: pointer;
  font-weight: 600;
}

.naming-btn:hover {
  background: #3570B0;
}

/* ── Debug Panel ── */

.debug-panel {
  background: rgba(0, 0, 0, 0.85);
  color: #0f0;
  font-family: monospace;
  font-size: 10px;
  padding: 6px 8px;
  border-radius: 6px;
  white-space: nowrap;
  line-height: 1.5;
  margin-top: 6px;
  max-width: 180px;
}

.debug-title {
  color: #0ff;
  font-weight: bold;
  margin-bottom: 3px;
  border-bottom: 1px solid rgba(255,255,255,0.2);
  padding-bottom: 2px;
}
</style>
