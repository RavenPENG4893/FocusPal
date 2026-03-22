<script setup lang="ts">
// FocusPal - Desktop Companion
// Day 6: System awareness layer - verify Rust sidecar commands
import { ref, onMounted, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'

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

const stats = ref<SystemStats | null>(null)
const battery = ref<BatteryStatus | null>(null)
const input = ref<InputActivity | null>(null)
const showDebug = ref(false)

let statsTimer: number
let batteryTimer: number
let inputTimer: number

async function pollStats() {
  try {
    stats.value = await invoke<SystemStats>('get_system_stats')
  } catch (e) {
    console.error('get_system_stats error:', e)
  }
}

async function pollBattery() {
  try {
    battery.value = await invoke<BatteryStatus>('get_battery_status')
  } catch (e) {
    console.error('get_battery_status error:', e)
  }
}

async function pollInput() {
  try {
    input.value = await invoke<InputActivity>('get_input_activity')
  } catch (e) {
    console.error('get_input_activity error:', e)
  }
}

onMounted(() => {
  pollStats()
  pollBattery()
  pollInput()
  statsTimer = window.setInterval(pollStats, 5000)
  batteryTimer = window.setInterval(pollBattery, 30000)
  inputTimer = window.setInterval(pollInput, 1000)
})

onUnmounted(() => {
  clearInterval(statsTimer)
  clearInterval(batteryTimer)
  clearInterval(inputTimer)
})
</script>

<template>
  <div class="companion-window">
    <div class="character-placeholder">
      <div class="pixel-box" @click.right.prevent="showDebug = !showDebug">🐣</div>
      <div class="label">FocusPal</div>
    </div>

    <!-- Debug overlay: right-click character to toggle -->
    <div v-if="showDebug" class="debug-panel">
      <div class="debug-title">System Monitor</div>
      <div v-if="stats">
        CPU: {{ stats.cpu_percent.toFixed(1) }}%<br/>
        RAM: {{ stats.memory_used_percent.toFixed(1) }}%<br/>
        Total: {{ stats.memory_total_gb.toFixed(1) }}GB
      </div>
      <div v-if="battery">
        Battery: {{ battery.charge_percent.toFixed(0) }}%
        {{ battery.is_charging ? '⚡' : '🔋' }}<br/>
        <span v-if="battery.time_to_empty_min">
          ~{{ battery.time_to_empty_min.toFixed(0) }}min left
        </span>
      </div>
      <div v-if="input">
        Keys/s: {{ input.key_count }}
        Clicks/s: {{ input.mouse_clicks }}
      </div>
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

.character-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.pixel-box {
  width: 96px;
  height: 96px;
  background: rgba(30, 60, 114, 0.85);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  cursor: grab;
  transition: transform 0.2s;
}

.pixel-box:hover {
  transform: scale(1.05);
}

.pixel-box:active {
  cursor: grabbing;
}

.label {
  color: rgba(255, 255, 255, 0.9);
  font-size: 12px;
  font-weight: 600;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
  letter-spacing: 1px;
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
  margin-top: 4px;
  max-width: 180px;
}

.debug-title {
  color: #0ff;
  font-weight: bold;
  margin-bottom: 4px;
  border-bottom: 1px solid rgba(255,255,255,0.2);
  padding-bottom: 3px;
}
</style>
