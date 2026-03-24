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
import { SceneRecognitionEngine, SCENE_LABELS, type SceneType, type SceneState } from './engine/SceneRecognition'
import { ClipboardGuardian } from './engine/ClipboardGuardian'
import { NetworkFishingEngine, FISHING_ANIM_MAP, type FishingInfo } from './engine/NetworkFishing'
import { WindowAwarenessEngine, type DodgeState } from './engine/WindowAwareness'
import ClipboardPanel from './components/ClipboardPanel.vue'
import OCCreatorPanel from './components/OCCreatorPanel.vue'
import { DesktopArchaeologist } from './engine/DesktopArchaeologist'
import { CollectibleEngine } from './engine/CollectibleSystem'
import { JournalEngine } from './engine/JournalSystem'
import AnalyticsDashboard from './components/AnalyticsDashboard.vue'
import JournalPanel from './components/JournalPanel.vue'
import CollectiblesPanel from './components/CollectiblesPanel.vue'
import { FocusPredictionEngine } from './engine/FocusPrediction'
import { CountdownSystem } from './engine/CountdownDays'
import { initScreenLight, isDarkMode, onDarkModeChange, getLightCombo, getLightComment } from './engine/ScreenLight'
import { CoupleEngine } from './engine/CoupleMode'

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
const showOCCreator = ref(false)

// Track D: Analytics, Journal, Collectibles
const showAnalytics = ref(false)
const showJournal = ref(false)
const showCollectibles = ref(false)
const collectibleEngine = new CollectibleEngine()

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

autonomousLife.onActivity(async (state) => {
  // Only change state if we're actually away (don't override user-triggered states)
  if (autonomousLife.isAway) {
    currentState.value = state
    // Try random collectible discovery during autonomous activities
    const found = await collectibleEngine.tryRandomDiscovery()
    if (found) {
      const def = (await import('./engine/CollectibleSystem')).COLLECTIBLE_CATALOG.find(c => c.key === found)
      if (def) {
        mumbleText.value = `Found something: ${def.icon} ${def.name}!`
        mumbleVisible.value = true
        setTimeout(() => { mumbleVisible.value = false }, 6000)
      }
    }
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
          content: `/no_think\n你是FocusPal的伙伴角色，名叫${companionName.value}。用户刚回来，生成一句温暖的问候（1-2句，俏皮可爱）。提一下你等他时在做什么。控制在60字以内。`,
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

// Scene Recognition system (V2)
const sceneEngine = new SceneRecognitionEngine()
const currentScene = ref<SceneType>('general')
const sceneLabel = ref('')
let sceneTimer = 0

// Scene → animation mapping (only when not in higher-priority states)
const SCENE_ANIM_MAP: Partial<Record<SceneType, AnimationState>> = {
  coding: 'scene_coding',
  writing: 'scene_writing',
  design: 'scene_design',
  meeting: 'scene_meeting',
  communication: 'chatting',
}

sceneEngine.onSceneChange((state: SceneState) => {
  currentScene.value = state.scene
  sceneLabel.value = SCENE_LABELS[state.scene] || ''
  if (!isHatched.value || isFocusing.value || autonomousLife.isAway) return
  // Don't override higher-priority states
  const noOverride = ['chatting', 'caring', 'happy', 'hatching', 'charging', 'unplugged',
    'fullbattery', 'lowbattery', 'sweating', 'overloaded', 'cleaning',
    'drinking', 'stretching', 'eyerest', 'celebrate', 'comforting',
    'reading', 'tidying', 'daydreaming', 'napping', 'slacking', 'gaming', 'dancing', 'doodling']
  if (noOverride.includes(currentState.value)) return

  const anim = SCENE_ANIM_MAP[state.scene]
  if (anim) {
    currentState.value = anim
  } else if (state.scene === 'general') {
    // Return to idle for general scene
    if (currentState.value.startsWith('scene_')) {
      currentState.value = 'idle'
    }
  }
})

sceneEngine.onDistraction((escalation) => {
  if (!isHatched.value || isFocusing.value || autonomousLife.isAway) return
  if (escalation.level >= 4) {
    currentState.value = 'scene_giveup'
    if (escalation.message) {
      mumbleText.value = escalation.message
      mumbleVisible.value = true
      setTimeout(() => { mumbleVisible.value = false }, 6000)
    }
  } else if (escalation.level >= 2) {
    currentState.value = 'scene_fidget'
    if (escalation.message) {
      mumbleText.value = escalation.message
      mumbleVisible.value = true
      setTimeout(() => { mumbleVisible.value = false }, 5000)
    }
  } else if (escalation.level === 1) {
    currentState.value = 'scene_fidget'
  }
})

sceneEngine.onTitleEvent((event) => {
  if (!isHatched.value || isFocusing.value) return
  if (event === 'build_success') {
    currentState.value = 'celebrate'
    mumbleText.value = 'Build 成功了！🎉'
    mumbleVisible.value = true
    setTimeout(() => { mumbleVisible.value = false }, 4000)
  } else if (event === 'build_error') {
    currentState.value = 'comforting'
    mumbleText.value = '没关系，debug 是日常~'
    mumbleVisible.value = true
    setTimeout(() => { mumbleVisible.value = false }, 4000)
  }
})

// Clipboard Guardian (V2)
const clipboardGuardian = new ClipboardGuardian()
const showClipboard = ref(false)
const clipboardCount = ref(0)
let clipboardTimer = 0

clipboardGuardian.onCatch(() => {
  if (!isHatched.value) return
  // Play catch animation (only if not in an important state)
  const noOverride = ['chatting', 'caring', 'happy', 'hatching', 'charging', 'unplugged',
    'fullbattery', 'lowbattery', 'sweating', 'overloaded', 'cleaning',
    'drinking', 'stretching', 'eyerest', 'celebrate', 'comforting',
    'reading', 'tidying', 'daydreaming', 'napping', 'slacking', 'gaming', 'dancing', 'doodling']
  if (!noOverride.includes(currentState.value)) {
    currentState.value = 'catch_orb'
  }
})

clipboardGuardian.onCountChange((count) => {
  clipboardCount.value = count
})

// Network Fishing (V2)
const fishingEngine = new NetworkFishingEngine()
const isFishing = ref(false)
const fishingSpeedLabel = ref('')
let fishingTimer = 0

fishingEngine.onStateChange((info: FishingInfo) => {
  if (!isFishing.value || !isHatched.value) return
  fishingSpeedLabel.value = info.speedLabel
  const anim = FISHING_ANIM_MAP[info.state]
  if (anim) {
    currentState.value = anim
  }
})

fishingEngine.onTrophy(() => {
  if (!isHatched.value) return
  mumbleText.value = '钓到大鱼了！！🐟🎉'
  mumbleVisible.value = true
  setTimeout(() => { mumbleVisible.value = false }, 5000)
})

fishingEngine.onDisconnect((disconnected) => {
  if (!isHatched.value || !isFishing.value) return
  if (disconnected) {
    mumbleText.value = '网断了...😵'
    mumbleVisible.value = true
    setTimeout(() => { mumbleVisible.value = false }, 4000)
  } else {
    mumbleText.value = '网回来了！继续钓~'
    mumbleVisible.value = true
    setTimeout(() => { mumbleVisible.value = false }, 3000)
  }
})

function toggleFishing() {
  isFishing.value = !isFishing.value
  fishingEngine.enabled = isFishing.value
  if (isFishing.value) {
    fishingEngine.poll() // initial poll
    currentState.value = 'fishing_idle'
  } else {
    currentState.value = 'idle'
    fishingSpeedLabel.value = ''
  }
}

// Window Awareness (V2)
const windowEngine = new WindowAwarenessEngine()
let windowTimer = 0

const DODGE_ANIM_MAP: Record<string, AnimationState> = {
  dodge: 'dodge',
  peek: 'peek',
  squeeze: 'squeeze',
}

windowEngine.onDodgeChange((state: DodgeState) => {
  if (!isHatched.value || isFocusing.value || isFishing.value || autonomousLife.isAway) return
  const anim = DODGE_ANIM_MAP[state]
  if (anim) {
    // Only override non-critical states
    const noOverride = ['chatting', 'caring', 'happy', 'hatching', 'charging', 'unplugged',
      'fullbattery', 'lowbattery', 'sweating', 'overloaded', 'cleaning',
      'drinking', 'stretching', 'eyerest', 'celebrate', 'comforting', 'catch_orb',
      'reading', 'tidying', 'daydreaming', 'napping', 'slacking', 'gaming', 'dancing', 'doodling']
    if (!noOverride.includes(currentState.value)) {
      currentState.value = anim
    }
  } else if (state === 'recover' || state === 'none') {
    if (['dodge', 'peek', 'squeeze'].includes(currentState.value)) {
      currentState.value = 'idle'
    }
  }
})

// ── Focus Prediction (V2 Track B) ──
const focusPrediction = new FocusPredictionEngine()

// ── Countdown Days (V2 Track C) ──
const countdownSystem = new CountdownSystem()

// ── Couple Nurture Mode (V2 Track C) ──
const coupleEngine = new CoupleEngine()
coupleEngine.onPartnerEvents((events) => {
  if (!isHatched.value) return
  for (const ev of events) {
    if (ev.event_type === 'cheer') {
      const msg = (ev.data as any)?.message || 'Partner cheers for you!'
      mumbleText.value = `Partner: ${msg}`
      mumbleVisible.value = true
      currentState.value = 'happy'
      setTimeout(() => { mumbleVisible.value = false }, 5000)
    } else if (ev.event_type === 'focus_complete') {
      const xp = (ev.data as any)?.xp || 0
      mumbleText.value = `Partner completed a focus session! +${xp} XP`
      mumbleVisible.value = true
      currentState.value = 'celebrate'
      setTimeout(() => { mumbleVisible.value = false }, 4000)
    } else if (ev.event_type === 'level_up') {
      const level = (ev.data as any)?.level || '?'
      mumbleText.value = `Partner leveled up to Lv.${level}!`
      mumbleVisible.value = true
      currentState.value = 'celebrate'
      setTimeout(() => { mumbleVisible.value = false }, 5000)
    }
  }
})

// ── Desktop Archaeologist ──
const archaeologist = new DesktopArchaeologist({
  onDeviation(msg) {
    if (!isHatched.value || isFocusing.value || autonomousLife.isAway || mumbleVisible.value) return
    mumbleText.value = msg
    mumbleVisible.value = true
    setTimeout(() => { mumbleVisible.value = false }, 5000)
  },
  onMissing(msg) {
    if (!isHatched.value || isFocusing.value || autonomousLife.isAway || mumbleVisible.value) return
    mumbleText.value = msg
    mumbleVisible.value = true
    setTimeout(() => { mumbleVisible.value = false }, 5000)
  },
  onWeeklySummary(msg) {
    if (!isHatched.value || autonomousLife.isAway) return
    mumbleText.value = msg
    mumbleVisible.value = true
    setTimeout(() => { mumbleVisible.value = false }, 8000)
  },
})
let archaeologistTimer = 0

// ── Screen Light Adaptation ──
const darkMode = ref(false)

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
      'reading', 'tidying', 'daydreaming', 'napping', 'slacking', 'gaming', 'dancing', 'doodling',
      'scene_coding', 'scene_writing', 'scene_design', 'scene_meeting',
      'scene_fidget', 'scene_giveup', 'celebrate', 'comforting', 'catch_orb',
      'fishing_idle', 'fishing_light', 'fishing_moderate', 'fishing_active',
      'fishing_heavy', 'fishing_trophy', 'fishing_disconnect', 'fishing_upload',
      'dodge', 'peek', 'squeeze']
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
          // If scene recognition has a specific state, use it; otherwise generic 'working'
          const sceneAnim = SCENE_ANIM_MAP[currentScene.value]
          currentState.value = sceneAnim || 'working'
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
      'reading', 'tidying', 'daydreaming', 'napping', 'slacking', 'gaming', 'dancing', 'doodling',
      'scene_coding', 'scene_writing', 'scene_design', 'scene_meeting',
      'scene_fidget', 'scene_giveup', 'celebrate', 'comforting', 'catch_orb',
      'fishing_idle', 'fishing_light', 'fishing_moderate', 'fishing_active',
      'fishing_heavy', 'fishing_trophy', 'fishing_disconnect', 'fishing_upload',
      'dodge', 'peek', 'squeeze']
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

  // Scene Recognition: poll active window every 3 seconds
  if (isHatched.value) {
    sceneEngine.poll() // initial poll
    sceneTimer = window.setInterval(() => {
      if (!autonomousLife.isAway) {
        sceneEngine.poll()
      }
    }, 3000)
  }

  // Clipboard Guardian: load history + poll every 500ms
  if (isHatched.value) {
    await clipboardGuardian.load()
    clipboardCount.value = clipboardGuardian.count
    clipboardTimer = window.setInterval(() => clipboardGuardian.poll(), 500)
    // Clean expired items on startup (24h)
    clipboardGuardian.cleanExpired()
  }

  // Network Fishing: poll every 2 seconds (engine handles enabled check)
  if (isHatched.value) {
    fishingTimer = window.setInterval(() => fishingEngine.poll(), 2000)
  }

  // Window Awareness: poll every 500ms
  if (isHatched.value) {
    await windowEngine.init()
    windowTimer = window.setInterval(() => windowEngine.poll(), 500)
  }

  // Focus Prediction: load model + background retrain
  if (isHatched.value) {
    focusPrediction.load().then(() => focusPrediction.maybeRetrain())
  }

  // Couple Mode: load engine
  if (isHatched.value) {
    coupleEngine.load()
  }

  // Collectible engine: load discovered items
  if (isHatched.value) {
    collectibleEngine.load()
  }

  // Desktop Archaeologist: load patterns + check every 10 minutes
  if (isHatched.value) {
    await archaeologist.loadPatterns()
    archaeologistTimer = window.setInterval(() => {
      if (!autonomousLife.isAway && !isFocusing.value) {
        // Feed current scene to archaeologist
        archaeologist.updateCurrent(sceneEngine.state.app_name, sceneEngine.state.scene)
        archaeologist.check()
      }
    }, 10 * 60 * 1000)
  }

  // Screen Light Adaptation: detect dark/light mode
  initScreenLight()
  darkMode.value = isDarkMode()
  onDarkModeChange((dark) => {
    darkMode.value = dark
    // Show comment for unusual combos
    const combo = getLightCombo(timePeriod.value as any)
    const comment = getLightComment(combo)
    if (comment && isHatched.value && !mumbleVisible.value) {
      mumbleText.value = comment
      mumbleVisible.value = true
      setTimeout(() => { mumbleVisible.value = false }, 5000)
    }
  })

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

      // Countdown reminder
      await countdownSystem.load()
      const cdReminder = countdownSystem.getClosestReminder()
      if (cdReminder) {
        setTimeout(() => {
          mumbleText.value = cdReminder
          mumbleVisible.value = true
          setTimeout(() => { mumbleVisible.value = false }, 5000)
        }, 7000) // show 7s after morning greeting
      }

      // Event-day celebration
      const todayEvents = countdownSystem.getTodayEvents()
      if (todayEvents.length > 0) {
        setTimeout(() => {
          currentState.value = 'celebrate'
          mumbleText.value = todayEvents.map(e => `${e.event.emoji} ${e.event.title}`).join(' | ')
          mumbleVisible.value = true
          setTimeout(() => { mumbleVisible.value = false }, 6000)
        }, 13000)
      }

      // Monday weekly summary from archaeologist
      const weeklySummary = archaeologist.checkWeeklySummary()
      if (weeklySummary) {
        setTimeout(() => {
          mumbleText.value = weeklySummary
          mumbleVisible.value = true
          setTimeout(() => { mumbleVisible.value = false }, 8000)
        }, 10000) // show 10s after morning greeting
      }
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
  clearInterval(sceneTimer)
  clearInterval(clipboardTimer)
  clearInterval(fishingTimer)
  clearInterval(windowTimer)
  clearInterval(archaeologistTimer)
  coupleEngine.stopPolling()
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
    case 'clipboard':
      showClipboard.value = true
      break
    case 'fishing':
      toggleFishing()
      break
    case 'journal':
      showJournal.value = true
      break
    case 'analytics':
      showAnalytics.value = true
      break
    case 'collectibles':
      showCollectibles.value = true
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
      coupleEngine.sendLevelUp(newLevel)
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
  coupleEngine.sendFocusComplete(xp)
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
    // Check focus collectible milestones
    const totalXP = await invoke<number>('get_total_xp')
    const totalMinutes = Math.round(totalXP / 2) * 60 // rough estimate from XP
    collectibleEngine.checkFocusMilestones(totalMinutes, focusStats.streak)
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

function onSentimentHint(anim: string) {
  if (anim === 'caring' || anim === 'happy') {
    currentState.value = anim as any
  }
}

function onOCApply(config: any) {
  // OC config applied and saved - show happy reaction
  showOCCreator.value = false
  currentState.value = 'happy'
  mumbleText.value = 'New look! Looking good~'
  mumbleVisible.value = true
  setTimeout(() => { mumbleVisible.value = false }, 4000)
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
    scene_coding: '💻 Coding',
    scene_writing: '📝 Writing',
    scene_design: '🎨 Designing',
    scene_meeting: '🎤 In Meeting',
    scene_fidget: '😬 Distracted...',
    scene_giveup: '📖 Gave up on you~',
    celebrate: '🎆 Celebration!',
    comforting: '🫂 There there...',
    catch_orb: '✨ Caught!',
    fishing_idle: '🎣 Fishing...',
    fishing_light: '🎣 Nibble...',
    fishing_moderate: '🎣 Biting!',
    fishing_active: '🎣 Big one!',
    fishing_heavy: '🎣 HUGE!!',
    fishing_trophy: '🐟 TROPHY FISH!',
    fishing_disconnect: '🔌 No signal...',
    fishing_upload: '🐦 Sending~',
    dodge: '😨 Dodging!',
    peek: '👀 Peeking...',
    squeeze: '😱 Squished!',
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
      :is-dark-mode="darkMode"
      :time-period="timePeriod"
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
      :couple-engine="coupleEngine"
      @close="showSettings = false"
      @skin-changed="onSkinChanged"
      @name-changed="onNameChanged"
      @open-oc-creator="showSettings = false; showOCCreator = true"
    />

    <!-- OC Character Creator -->
    <OCCreatorPanel
      v-if="showOCCreator && isHatched"
      @close="showOCCreator = false"
      @apply="onOCApply"
    />

    <!-- Clipboard backpack panel -->
    <ClipboardPanel
      v-if="showClipboard && isHatched"
      :guardian="clipboardGuardian"
      @close="showClipboard = false"
      @paste="() => {}"
    />

    <!-- Analytics dashboard -->
    <AnalyticsDashboard
      v-if="showAnalytics && isHatched"
      @close="showAnalytics = false"
    />

    <!-- Journal -->
    <JournalPanel
      v-if="showJournal && isHatched"
      @close="showJournal = false"
    />

    <!-- Collectibles -->
    <CollectiblesPanel
      v-if="showCollectibles && isHatched"
      :engine="collectibleEngine"
      @close="showCollectibles = false"
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
      :pattern-context="archaeologist.getPatternContext()"
      @close="onChatClose"
      @thinking="onChatThinking"
      @sentiment-hint="onSentimentHint"
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
    <div v-if="clipboardCount > 0 && !isNaming" class="backpack-indicator" @click="showClipboard = true">
      🎒 {{ clipboardCount }}
    </div>
    <div v-if="isFishing && fishingSpeedLabel && !isNaming" class="fishing-indicator">
      {{ fishingSpeedLabel }}
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
      <div>Scene: {{ currentScene }}</div>
      <div v-if="isFishing">Fish: {{ fishingEngine.info.state }} {{ fishingSpeedLabel }}</div>
      <div v-if="windowEngine.state.dodgeState !== 'none'">Win: {{ windowEngine.state.dodgeState }} ({{ windowEngine.state.overlapPercent.toFixed(0) }}%)</div>
      <div v-if="sceneEngine.state.distractionMinutes > 0">
        Distract: {{ sceneEngine.state.distractionMinutes.toFixed(1) }}min (L{{ sceneEngine.state.escalationLevel }})
      </div>
      <div>Dark: {{ darkMode }} | {{ getLightCombo(timePeriod as any) }}</div>
      <div v-if="archaeologist.dataReady">Arch: {{ archaeologist.totalDays }}d</div>
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
  width: 260px;
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

.backpack-indicator {
  color: rgba(139, 105, 20, 0.85);
  font-size: 8px;
  margin-top: 1px;
  cursor: pointer;
  transition: opacity 0.2s;
}
.backpack-indicator:hover {
  opacity: 1;
  color: rgba(192, 160, 64, 1);
}

.fishing-indicator {
  color: rgba(74, 144, 217, 0.7);
  font-size: 7px;
  margin-top: 1px;
  letter-spacing: 0.3px;
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
