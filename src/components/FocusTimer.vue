<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'start'): void
  (e: 'complete', xp: number, minutes: number): void
  (e: 'abort', xp: number, minutes: number): void
  (e: 'idle'): void
}>()

type TimerPhase = 'select' | 'focus' | 'paused' | 'break' | 'done'

const phase = ref<TimerPhase>('select')
const presets = [
  { label: '25 min', focus: 25, breakTime: 5 },
  { label: '50 min', focus: 50, breakTime: 15 },
]
const customMin = ref(30)

// Timer state
const totalSeconds = ref(0)
const remainingSeconds = ref(0)
const breakTotalSeconds = ref(0)
const breakRemaining = ref(0)
let timerInterval = 0
let idleCheckInterval = 0
let lastActivityTime = Date.now()

// Stats
const focusedMinutes = ref(0)  // actual minutes focused (for XP)
const earnedXP = ref(0)

// Stats from SQLite
interface FocusStats {
  today_minutes: number
  today_sessions: number
  week_minutes: number
  week_sessions: number
  streak: number
}

const todayStats = ref<FocusStats>({
  today_minutes: 0, today_sessions: 0,
  week_minutes: 0, week_sessions: 0, streak: 0,
})

async function refreshStats() {
  try {
    todayStats.value = await invoke<FocusStats>('get_focus_stats')
  } catch (e) {
    console.error('[Focus] stats error:', e)
  }
}

async function saveFocusSession(durationMin: number, actualMin: number, xp: number, completed: boolean) {
  try {
    await invoke('insert_focus_session', {
      durationMin, actualMin, xp, completed,
    })
    await refreshStats()
  } catch (e) {
    console.error('[Focus] save error:', e)
  }
}

onMounted(() => { refreshStats() })

// Computed
const progress = computed(() => {
  if (phase.value === 'break') {
    return breakTotalSeconds.value > 0 ? 1 - breakRemaining.value / breakTotalSeconds.value : 0
  }
  return totalSeconds.value > 0 ? 1 - remainingSeconds.value / totalSeconds.value : 0
})

const displayTime = computed(() => {
  const s = phase.value === 'break' ? breakRemaining.value : remainingSeconds.value
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
})

const progressColor = computed(() => {
  if (phase.value === 'break') return '#6BCB77'
  if (progress.value > 0.8) return '#FFD93D' // last 20%
  return '#4A90D9'
})

const phaseLabel = computed(() => {
  switch (phase.value) {
    case 'focus': return 'Focusing...'
    case 'paused': return 'Paused'
    case 'break': return 'Break Time'
    case 'done': return 'Well Done!'
    default: return ''
  }
})

// XP calculation
function calcXP(minutes: number, aborted: boolean): number {
  const stats = todayStats.value
  const hasStreak = stats.streak >= 3

  if (aborted) {
    return Math.floor(minutes / 5) * 1
  }

  const total = totalSeconds.value / 60
  if (total === 25) return hasStreak ? 13 : 10
  if (total === 50) return hasStreak ? 33 : 25
  const base = Math.floor(minutes / 5) * 2
  const bonus = hasStreak ? Math.floor(minutes / 5) : 0
  return base + bonus
}

// Actions
function startFocus(minutes: number, breakMin: number) {
  totalSeconds.value = minutes * 60
  remainingSeconds.value = minutes * 60
  breakTotalSeconds.value = breakMin * 60
  phase.value = 'focus'
  focusedMinutes.value = 0
  lastActivityTime = Date.now()
  emit('start')
  startTicking()
  startIdleCheck()
}

function startTicking() {
  clearInterval(timerInterval)
  timerInterval = window.setInterval(() => {
    if (phase.value === 'focus') {
      remainingSeconds.value--
      focusedMinutes.value = Math.floor((totalSeconds.value - remainingSeconds.value) / 60)

      if (remainingSeconds.value <= 0) {
        onFocusComplete()
      }
    } else if (phase.value === 'break') {
      breakRemaining.value--
      if (breakRemaining.value <= 0) {
        onBreakComplete()
      }
    }
  }, 1000)
}

function startIdleCheck() {
  clearInterval(idleCheckInterval)
  idleCheckInterval = window.setInterval(() => {
    if (phase.value !== 'focus') return
    // Auto-pause after 5 min no activity
    if (Date.now() - lastActivityTime > 5 * 60 * 1000) {
      pauseTimer()
    }
  }, 30000)
}

// Called from App.vue when input activity detected
function reportActivity() {
  lastActivityTime = Date.now()
  // Auto-resume if was auto-paused
  if (phase.value === 'paused') {
    resumeTimer()
  }
}

function pauseTimer() {
  if (phase.value !== 'focus') return
  phase.value = 'paused'
  clearInterval(timerInterval)
  emit('idle')
}

function resumeTimer() {
  if (phase.value !== 'paused') return
  phase.value = 'focus'
  lastActivityTime = Date.now()
  emit('start')
  startTicking()
}

async function abortTimer() {
  const mins = focusedMinutes.value
  const xp = calcXP(mins, true)
  earnedXP.value = xp
  clearInterval(timerInterval)
  clearInterval(idleCheckInterval)

  await saveFocusSession(Math.round(totalSeconds.value / 60), mins, xp, false)

  phase.value = 'done'
  emit('abort', xp, mins)
}

async function onFocusComplete() {
  clearInterval(timerInterval)
  clearInterval(idleCheckInterval)

  const mins = Math.round(totalSeconds.value / 60)
  const xp = calcXP(mins, false)
  earnedXP.value = xp

  await saveFocusSession(mins, mins, xp, true)

  emit('complete', xp, mins)

  // Start break
  if (breakTotalSeconds.value > 0) {
    breakRemaining.value = breakTotalSeconds.value
    phase.value = 'break'
    startTicking()
  } else {
    phase.value = 'done'
  }
}

function onBreakComplete() {
  clearInterval(timerInterval)
  phase.value = 'done'
}

function close() {
  clearInterval(timerInterval)
  clearInterval(idleCheckInterval)
  emit('close')
}

function reset() {
  phase.value = 'select'
  earnedXP.value = 0
}

// SVG ring parameters
const RING_R = 38
const RING_C = 2 * Math.PI * RING_R

// Expose for parent
defineExpose({ reportActivity })

onUnmounted(() => {
  clearInterval(timerInterval)
  clearInterval(idleCheckInterval)
})
</script>

<template>
  <div class="focus-panel">
    <div class="focus-header">
      <span class="focus-title">Focus Timer</span>
      <button class="focus-close" @click="close">✕</button>
    </div>

    <!-- Preset selection -->
    <div v-if="phase === 'select'" class="focus-select">
      <button
        v-for="p in presets"
        :key="p.focus"
        class="preset-btn"
        @click="startFocus(p.focus, p.breakTime)"
      >
        {{ p.label }}
      </button>
      <div class="custom-row">
        <input
          v-model.number="customMin"
          type="number"
          min="5"
          max="120"
          step="5"
          class="custom-input"
        />
        <span class="custom-unit">min</span>
        <button class="preset-btn custom-start" @click="startFocus(customMin, Math.floor(customMin / 5))">
          Go
        </button>
      </div>

      <!-- Today's stats -->
      <div class="today-stats">
        <div>Today: {{ todayStats.today_minutes }} min / {{ todayStats.today_sessions }} sessions</div>
        <div v-if="todayStats.streak >= 3">Streak: {{ todayStats.streak }} days</div>
      </div>
    </div>

    <!-- Timer ring -->
    <div v-else class="focus-active">
      <div class="ring-container">
        <svg viewBox="0 0 96 96" class="ring-svg">
          <!-- Background ring -->
          <circle
            cx="48" cy="48" :r="RING_R"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            stroke-width="4"
          />
          <!-- Progress ring -->
          <circle
            cx="48" cy="48" :r="RING_R"
            fill="none"
            :stroke="progressColor"
            stroke-width="4"
            stroke-linecap="round"
            :stroke-dasharray="RING_C"
            :stroke-dashoffset="RING_C * (1 - progress)"
            transform="rotate(-90 48 48)"
            class="ring-progress"
          />
        </svg>
        <div class="ring-text">
          <div class="ring-time">{{ displayTime }}</div>
          <div class="ring-phase">{{ phaseLabel }}</div>
        </div>
      </div>

      <!-- XP display on completion -->
      <div v-if="phase === 'done'" class="xp-popup">
        +{{ earnedXP }} XP
      </div>

      <!-- Controls -->
      <div class="focus-controls">
        <template v-if="phase === 'focus'">
          <button class="ctrl-btn" @click="pauseTimer">⏸</button>
          <button class="ctrl-btn abort" @click="abortTimer">✕</button>
        </template>
        <template v-else-if="phase === 'paused'">
          <button class="ctrl-btn" @click="resumeTimer">▶</button>
          <button class="ctrl-btn abort" @click="abortTimer">✕</button>
        </template>
        <template v-else-if="phase === 'break'">
          <button class="ctrl-btn" @click="onBreakComplete">Skip</button>
        </template>
        <template v-else-if="phase === 'done'">
          <button class="ctrl-btn" @click="reset">Again</button>
          <button class="ctrl-btn" @click="close">Done</button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.focus-panel {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  top: 0;
  background: rgba(15, 20, 40, 0.95);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  z-index: 30;
  overflow: hidden;
}

.focus-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: rgba(74, 144, 217, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.focus-title {
  color: rgba(255, 255, 255, 0.9);
  font-size: 11px;
  font-weight: 600;
}

.focus-close {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  cursor: pointer;
  padding: 0 4px;
}

.focus-close:hover {
  color: #fff;
}

/* Preset selection */
.focus-select {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
}

.preset-btn {
  background: rgba(74, 144, 217, 0.4);
  border: 1px solid rgba(74, 144, 217, 0.5);
  border-radius: 8px;
  color: #fff;
  font-size: 12px;
  padding: 8px 24px;
  cursor: pointer;
  width: 100%;
  max-width: 140px;
  transition: background 0.15s;
}

.preset-btn:hover {
  background: rgba(74, 144, 217, 0.65);
}

.custom-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
}

.custom-input {
  width: 48px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  color: #fff;
  font-size: 11px;
  padding: 5px 6px;
  text-align: center;
  outline: none;
}

.custom-input:focus {
  border-color: rgba(74, 144, 217, 0.5);
}

.custom-unit {
  color: rgba(255, 255, 255, 0.4);
  font-size: 10px;
}

.custom-start {
  width: auto;
  padding: 5px 12px;
  font-size: 11px;
}

.today-stats {
  color: rgba(255, 255, 255, 0.35);
  font-size: 9px;
  text-align: center;
  margin-top: 8px;
  line-height: 1.5;
}

/* Timer active */
.focus-active {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 12px;
}

.ring-container {
  position: relative;
  width: 96px;
  height: 96px;
}

.ring-svg {
  width: 100%;
  height: 100%;
}

.ring-progress {
  transition: stroke-dashoffset 0.5s linear, stroke 0.3s;
}

.ring-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.ring-time {
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.ring-phase {
  color: rgba(255, 255, 255, 0.5);
  font-size: 8px;
  margin-top: 2px;
}

.xp-popup {
  color: #FFD93D;
  font-size: 14px;
  font-weight: 700;
  animation: xp-bounce 0.5s ease-out;
}

@keyframes xp-bounce {
  0% { transform: scale(0.5); opacity: 0; }
  60% { transform: scale(1.3); }
  100% { transform: scale(1); opacity: 1; }
}

.focus-controls {
  display: flex;
  gap: 8px;
}

.ctrl-btn {
  background: rgba(74, 144, 217, 0.4);
  border: 1px solid rgba(74, 144, 217, 0.4);
  border-radius: 8px;
  color: #fff;
  font-size: 11px;
  padding: 6px 14px;
  cursor: pointer;
  transition: background 0.15s;
}

.ctrl-btn:hover {
  background: rgba(74, 144, 217, 0.65);
}

.ctrl-btn.abort {
  background: rgba(217, 74, 74, 0.4);
  border-color: rgba(217, 74, 74, 0.4);
}

.ctrl-btn.abort:hover {
  background: rgba(217, 74, 74, 0.65);
}
</style>
