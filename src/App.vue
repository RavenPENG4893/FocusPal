<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { PhysicalPosition } from '@tauri-apps/api/dpi'
import CompanionCanvas from './components/CompanionCanvas.vue'
import type { AnimationState } from './engine/AnimationStateMachine'

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

const currentState = ref<AnimationState>('idle')
const stats = ref<SystemStats | null>(null)
const battery = ref<BatteryStatus | null>(null)
const input = ref<InputActivity | null>(null)
const showDebug = ref(false)
const companionName = ref(localStorage.getItem('companion_name') || 'FocusPal')

// Idle timer: no input for 3 min → sleepy
let idleTimeout: number = 0
const IDLE_TIMEOUT_MS = 3 * 60 * 1000

// Working → idle timeout
let workingTimeout: number = 0
const WORKING_IDLE_MS = 3000

// ── Drag support (manual position tracking) ──

let isDragging = false
let dragStartX = 0
let dragStartY = 0

function onDragStart(e: MouseEvent) {
  if (e.button !== 0) return
  isDragging = true
  dragStartX = e.screenX
  dragStartY = e.screenY
  e.preventDefault()
}

async function onDragMove(e: MouseEvent) {
  if (!isDragging) return
  const dx = e.screenX - dragStartX
  const dy = e.screenY - dragStartY
  if (dx === 0 && dy === 0) return
  dragStartX = e.screenX
  dragStartY = e.screenY
  try {
    const win = getCurrentWindow()
    const pos = await win.outerPosition()
    await win.setPosition(new PhysicalPosition(pos.x + dx, pos.y + dy))
  } catch {}
}

function onDragEnd() {
  isDragging = false
}

// ── System polling ──

let statsTimer: number
let batteryTimer: number
let inputTimer: number

async function pollStats() {
  try { stats.value = await invoke<SystemStats>('get_system_stats') } catch {}
}

async function pollBattery() {
  try { battery.value = await invoke<BatteryStatus>('get_battery_status') } catch {}
}

async function pollInput() {
  try {
    input.value = await invoke<InputActivity>('get_input_activity')
    if (input.value) {
      const hasInput = input.value.key_count > 0 || input.value.mouse_clicks > 0

      if (hasInput) {
        resetIdleTimer()
      }

      if (input.value.key_count > 0) {
        if (currentState.value === 'idle' || currentState.value === 'sleepy') {
          currentState.value = 'working'
        }
        clearTimeout(workingTimeout)
        workingTimeout = window.setTimeout(() => {
          if (currentState.value === 'working') {
            currentState.value = 'idle'
          }
        }, WORKING_IDLE_MS)
      }

      if (input.value.mouse_clicks > 5) {
        currentState.value = 'stressed'
      }
    }
  } catch {}
}

function resetIdleTimer() {
  clearTimeout(idleTimeout)
  if (currentState.value === 'sleepy') {
    currentState.value = 'idle'
  }
  idleTimeout = window.setTimeout(() => {
    currentState.value = 'sleepy'
  }, IDLE_TIMEOUT_MS)
}

// ── Lifecycle ──

onMounted(() => {
  pollStats()
  pollBattery()
  pollInput()
  statsTimer = window.setInterval(pollStats, 5000)
  batteryTimer = window.setInterval(pollBattery, 30000)
  inputTimer = window.setInterval(pollInput, 1000)
  resetIdleTimer()

  window.addEventListener('mousemove', onDragMove)
  window.addEventListener('mouseup', onDragEnd)
})

onUnmounted(() => {
  clearInterval(statsTimer)
  clearInterval(batteryTimer)
  clearInterval(inputTimer)
  clearTimeout(idleTimeout)
  clearTimeout(workingTimeout)
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', onDragEnd)
})

function onCanvasClick() {
  if (currentState.value === 'idle') {
    currentState.value = 'happy'
  }
}

function onCanvasRightClick() {
  showDebug.value = !showDebug.value
}

const stateLabel = computed(() => {
  const labels: Record<string, string> = {
    idle: '😊 Idle',
    working: '⌨️ Working',
    resting: '🧘 Resting',
    happy: '🎉 Happy',
    sleepy: '😴 Sleepy',
    chatting: '💬 Chatting',
    stressed: '😰 Stressed',
    caring: '🤗 Caring',
  }
  return labels[currentState.value] || currentState.value
})
</script>

<template>
  <div class="companion-window">
    <div class="drag-area" @mousedown="onDragStart"></div>
    <CompanionCanvas
      :state="currentState"
      @click="onCanvasClick"
      @rightclick="onCanvasRightClick"
      @state-change="(s: AnimationState) => currentState = s"
    />
    <div class="name-label" @mousedown="onDragStart">{{ companionName }}</div>
    <div class="state-label">{{ stateLabel }}</div>

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

.drag-area {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 40px;
  cursor: grab;
  z-index: 1;
}

.drag-area:active {
  cursor: grabbing;
}

.name-label {
  color: rgba(255, 255, 255, 0.95);
  font-size: 12px;
  font-weight: 700;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
  letter-spacing: 1px;
  margin-top: 6px;
  cursor: grab;
}

.state-label {
  color: rgba(255, 255, 255, 0.7);
  font-size: 10px;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  margin-top: 2px;
}

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
