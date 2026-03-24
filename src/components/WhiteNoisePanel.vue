<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { WhiteNoiseEngine, type SoundType } from '../engine/WhiteNoise'

const props = defineProps<{
  engine: WhiteNoiseEngine
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'sounds-changed', active: SoundType[]): void
}>()

const channels = ref(props.engine.getChannels())
const masterVol = ref(props.engine.masterVolume)

function refresh() {
  channels.value = props.engine.getChannels()
}

function toggleSound(type: SoundType) {
  props.engine.toggle(type)
  refresh()
  emit('sounds-changed', props.engine.getActiveSoundTypes())
}

function setVolume(type: SoundType, e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value)
  props.engine.setVolume(type, val)
  refresh()
}

function setMasterVolume(e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value)
  masterVol.value = val
  props.engine.masterVolume = val
}

function stopAll() {
  props.engine.stopAll()
  refresh()
  emit('sounds-changed', [])
}

const anyActive = computed(() => channels.value.some(c => c.active))
</script>

<template>
  <div class="noise-panel">
    <div class="noise-header">
      <span class="noise-title">Ambient Sounds</span>
      <button class="noise-close" @click="emit('close')">✕</button>
    </div>

    <!-- Master volume -->
    <div class="master-row">
      <span class="master-label">🔊 Master</span>
      <input
        type="range" min="0" max="1" step="0.05"
        :value="masterVol"
        class="vol-slider master-slider"
        @input="setMasterVolume"
      />
      <button v-if="anyActive" class="stop-all-btn" @click="stopAll">Stop All</button>
    </div>

    <!-- Sound channels -->
    <div class="channel-list">
      <div
        v-for="ch in channels"
        :key="ch.type"
        class="channel-row"
        :class="{ active: ch.active }"
      >
        <button class="ch-toggle" :class="{ on: ch.active }" @click="toggleSound(ch.type)">
          <span class="ch-icon">{{ ch.icon }}</span>
          <span class="ch-label">{{ ch.label }}</span>
        </button>
        <input
          v-if="ch.active"
          type="range" min="0" max="1" step="0.05"
          :value="ch.volume"
          class="vol-slider ch-slider"
          @input="setVolume(ch.type, $event)"
        />
      </div>
    </div>

    <div class="noise-hint">
      Mix multiple sounds together!
    </div>
  </div>
</template>

<style scoped>
.noise-panel {
  position: absolute;
  bottom: 0; left: 0; right: 0; top: 0;
  background: rgba(15, 20, 40, 0.95);
  border-radius: 12px;
  display: flex; flex-direction: column;
  z-index: 30; overflow: hidden;
}

.noise-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 10px;
  background: rgba(74, 144, 217, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.noise-title { color: rgba(255,255,255,0.9); font-size: 11px; font-weight: 600; }
.noise-close { background: none; border: none; color: rgba(255,255,255,0.6); font-size: 13px; cursor: pointer; padding: 0 4px; }
.noise-close:hover { color: #fff; }

.master-row {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 10px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.master-label { color: rgba(255,255,255,0.5); font-size: 9px; min-width: 48px; }
.master-slider { flex: 1; }
.stop-all-btn {
  font-size: 8px; padding: 2px 6px; border-radius: 4px;
  background: rgba(255, 80, 80, 0.2); border: 1px solid rgba(255, 80, 80, 0.3);
  color: rgba(255, 120, 120, 0.9); cursor: pointer;
}
.stop-all-btn:hover { background: rgba(255, 80, 80, 0.35); }

.channel-list {
  flex: 1; overflow-y: auto; padding: 6px 8px;
  display: flex; flex-direction: column; gap: 4px;
}

.channel-row {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 6px; border-radius: 8px;
  transition: background 0.15s;
}
.channel-row.active {
  background: rgba(255,255,255,0.04);
}

.ch-toggle {
  display: flex; align-items: center; gap: 5px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  padding: 5px 8px;
  cursor: pointer;
  transition: all 0.15s;
  min-width: 72px;
}
.ch-toggle.on {
  background: rgba(74, 144, 217, 0.25);
  border-color: rgba(74, 144, 217, 0.4);
}
.ch-toggle:hover { background: rgba(255,255,255,0.1); }
.ch-icon { font-size: 13px; }
.ch-label { font-size: 9px; color: rgba(255,255,255,0.7); }
.ch-toggle.on .ch-label { color: #fff; }

.ch-slider { flex: 1; }

/* Volume slider styling */
.vol-slider {
  -webkit-appearance: none;
  appearance: none;
  height: 3px;
  border-radius: 2px;
  background: rgba(255,255,255,0.15);
  outline: none;
}
.vol-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 10px; height: 10px;
  border-radius: 50%;
  background: #4A90D9;
  cursor: pointer;
}

.noise-hint {
  text-align: center;
  padding: 6px;
  font-size: 8px;
  color: rgba(255,255,255,0.2);
}

.channel-list::-webkit-scrollbar { width: 3px; }
.channel-list::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.15); border-radius: 3px;
}
</style>
