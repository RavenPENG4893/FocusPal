<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import {
  calcLevel, getUnlocks, getNextUnlock, getTotalXP,
  type LevelInfo, type Unlock,
} from '../engine/GrowthSystem'

const emit = defineEmits<{ (e: 'close'): void }>()

interface AlbumEntry {
  id: number
  event: string
  caption: string
  timestamp: number
}

const levelInfo = ref<LevelInfo>({ level: 1, currentXP: 0, xpForNext: 50, cumulativeXP: 0, totalXP: 0, progress: 0 })
const unlocks = ref<Unlock[]>([])
const nextUnlock = ref<Unlock | null>(null)
const album = ref<AlbumEntry[]>([])
const tab = ref<'level' | 'album'>('level')

const EMOJI_MAP: Record<string, string> = {
  animation: '🎭', decoration: '🪴', skin: '👔', feature: '⭐',
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function formatEvent(event: string): string {
  if (event.startsWith('level_up_')) return '🎉 Level Up'
  if (event === 'first_focus') return '🎯 First Focus'
  if (event.startsWith('streak_')) return '🔥 Streak'
  if (event === 'hatched') return '🐣 Hatched'
  return '📌 ' + event
}

async function refresh() {
  const xp = await getTotalXP()
  levelInfo.value = calcLevel(xp)
  unlocks.value = getUnlocks(levelInfo.value.level)
  nextUnlock.value = getNextUnlock(levelInfo.value.level)

  try {
    album.value = await invoke<AlbumEntry[]>('query_album')
  } catch (e) {
    console.error('[Growth] album error:', e)
  }
}

onMounted(() => refresh())
</script>

<template>
  <div class="growth-panel">
    <div class="growth-header">
      <span class="growth-title">Growth</span>
      <button class="growth-close" @click="emit('close')">✕</button>
    </div>

    <!-- Tabs -->
    <div class="growth-tabs">
      <button class="gtab" :class="{ active: tab === 'level' }" @click="tab = 'level'">Level</button>
      <button class="gtab" :class="{ active: tab === 'album' }" @click="tab = 'album'">Album</button>
    </div>

    <!-- Level tab -->
    <div v-if="tab === 'level'" class="level-content">
      <!-- Level ring -->
      <div class="level-ring-wrap">
        <svg viewBox="0 0 80 80" class="level-ring-svg">
          <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="5" />
          <circle
            cx="40" cy="40" r="34" fill="none"
            stroke="#FFD93D" stroke-width="5" stroke-linecap="round"
            :stroke-dasharray="2 * Math.PI * 34"
            :stroke-dashoffset="2 * Math.PI * 34 * (1 - levelInfo.progress)"
            transform="rotate(-90 40 40)"
            class="ring-fill"
          />
        </svg>
        <div class="level-center">
          <div class="level-num">Lv.{{ levelInfo.level }}</div>
          <div class="level-xp">{{ levelInfo.totalXP }} XP</div>
        </div>
      </div>

      <!-- Next unlock -->
      <div v-if="nextUnlock" class="next-unlock">
        <span class="next-label">Next: Lv.{{ nextUnlock.level }}</span>
        <span class="next-desc">{{ EMOJI_MAP[nextUnlock.type] }} {{ nextUnlock.description }}</span>
        <span class="next-xp">{{ levelInfo.xpForNext - levelInfo.currentXP }} XP to go</span>
      </div>
      <div v-else class="next-unlock max-level">
        Max level reached!
      </div>

      <!-- Unlock list -->
      <div class="unlock-list">
        <div class="unlock-title">Unlocked</div>
        <div
          v-for="u in unlocks"
          :key="u.level"
          class="unlock-item"
        >
          <span class="unlock-lv">Lv.{{ u.level }}</span>
          <span class="unlock-emoji">{{ EMOJI_MAP[u.type] }}</span>
          <span class="unlock-desc">{{ u.description }}</span>
        </div>
      </div>
    </div>

    <!-- Album tab -->
    <div v-if="tab === 'album'" class="album-content">
      <div v-if="album.length === 0" class="album-empty">
        No milestones yet. Keep going!
      </div>
      <div
        v-for="entry in album"
        :key="entry.id"
        class="album-entry"
      >
        <div class="album-event">{{ formatEvent(entry.event) }}</div>
        <div class="album-caption">{{ entry.caption }}</div>
        <div class="album-time">{{ formatDate(entry.timestamp) }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.growth-panel {
  position: absolute;
  bottom: 0; left: 0; right: 0; top: 0;
  background: rgba(15, 20, 40, 0.95);
  border-radius: 12px;
  display: flex; flex-direction: column;
  z-index: 30; overflow: hidden;
}

.growth-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 10px;
  background: rgba(74, 144, 217, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.growth-title { color: rgba(255,255,255,0.9); font-size: 11px; font-weight: 600; }
.growth-close { background: none; border: none; color: rgba(255,255,255,0.6); font-size: 13px; cursor: pointer; padding: 0 4px; }
.growth-close:hover { color: #fff; }

.growth-tabs { display: flex; gap: 4px; padding: 4px 8px; }
.gtab {
  flex: 1; font-size: 9px; padding: 3px 0; border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.4);
  cursor: pointer; transition: all 0.15s;
}
.gtab.active {
  background: rgba(74,144,217,0.25); border-color: rgba(74,144,217,0.4); color: #fff;
}

/* Level tab */
.level-content {
  flex: 1; overflow-y: auto; padding: 8px;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
}

.level-ring-wrap { position: relative; width: 80px; height: 80px; }
.level-ring-svg { width: 100%; height: 100%; }
.ring-fill { transition: stroke-dashoffset 0.5s; }
.level-center {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  text-align: center;
}
.level-num { color: #FFD93D; font-size: 16px; font-weight: 700; }
.level-xp { color: rgba(255,255,255,0.4); font-size: 8px; }

.next-unlock {
  text-align: center; display: flex; flex-direction: column; gap: 2px;
  padding: 6px 10px; border-radius: 8px;
  background: rgba(255,215,61,0.08); border: 1px solid rgba(255,215,61,0.15);
  width: 100%;
}
.next-label { color: rgba(255,255,255,0.5); font-size: 8px; }
.next-desc { color: rgba(255,255,255,0.8); font-size: 10px; }
.next-xp { color: #FFD93D; font-size: 9px; font-weight: 600; }
.max-level { color: #FFD93D; font-size: 10px; text-align: center; }

.unlock-list { width: 100%; }
.unlock-title { color: rgba(255,255,255,0.3); font-size: 8px; margin-bottom: 4px; }
.unlock-item {
  display: flex; align-items: center; gap: 4px;
  padding: 3px 0; font-size: 9px; color: rgba(255,255,255,0.6);
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.unlock-lv { color: rgba(255,255,255,0.3); min-width: 28px; font-size: 8px; }
.unlock-emoji { font-size: 10px; }
.unlock-desc { flex: 1; }

/* Album tab */
.album-content {
  flex: 1; overflow-y: auto; padding: 8px;
  display: flex; flex-direction: column; gap: 6px;
}
.album-empty {
  color: rgba(255,255,255,0.3); font-size: 10px; text-align: center; margin-top: 30px;
}
.album-entry {
  padding: 6px 8px; border-radius: 6px;
  background: rgba(255,255,255,0.04);
  border-left: 2px solid rgba(74,144,217,0.5);
}
.album-event { font-size: 10px; color: rgba(255,255,255,0.8); font-weight: 600; }
.album-caption { font-size: 9px; color: rgba(255,255,255,0.5); margin-top: 2px; }
.album-time { font-size: 7px; color: rgba(255,255,255,0.25); margin-top: 2px; }

.album-content::-webkit-scrollbar, .level-content::-webkit-scrollbar { width: 3px; }
.album-content::-webkit-scrollbar-thumb, .level-content::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.15); border-radius: 3px;
}
</style>
