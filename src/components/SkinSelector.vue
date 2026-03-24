<script setup lang="ts">
import { ref, computed } from 'vue'
import { SKINS, getActiveSkinId, setActiveSkin, type SkinDef } from '../engine/SkinSystem'
import { calcLevel, getTotalXP } from '../engine/GrowthSystem'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'skin-changed', skinId: string): void
}>()

const activeSkinId = ref(getActiveSkinId())
const playerLevel = ref(1)

// Load player level for unlock checks
getTotalXP().then(xp => {
  playerLevel.value = calcLevel(xp).level
})

const skins = computed(() => {
  return SKINS.map(skin => ({
    ...skin,
    unlocked: skin.unlockLevel <= playerLevel.value,
    active: skin.id === activeSkinId.value,
  }))
})

function selectSkin(skin: SkinDef & { unlocked: boolean }) {
  if (!skin.unlocked) return
  setActiveSkin(skin.id)
  activeSkinId.value = skin.id
  emit('skin-changed', skin.id)
}
</script>

<template>
  <div class="skin-panel">
    <div class="skin-header">
      <span class="skin-title">Skins</span>
      <button class="skin-close" @click="emit('close')">✕</button>
    </div>

    <div class="skin-list">
      <div
        v-for="skin in skins"
        :key="skin.id"
        class="skin-card"
        :class="{ active: skin.active, locked: !skin.unlocked }"
        @click="selectSkin(skin)"
      >
        <div class="skin-card-icon">{{ skin.icon }}</div>
        <div class="skin-card-info">
          <div class="skin-card-name">
            {{ skin.name }}
            <span v-if="skin.active" class="skin-active-badge">Active</span>
          </div>
          <div class="skin-card-desc">{{ skin.description }}</div>
          <div v-if="!skin.unlocked" class="skin-lock">
            🔒 Unlock at Lv.{{ skin.unlockLevel }}
          </div>
        </div>
      </div>
    </div>

    <div class="skin-hint">
      Skins change your companion's appearance, desk, and personality!
    </div>
  </div>
</template>

<style scoped>
.skin-panel {
  position: absolute;
  bottom: 0; left: 0; right: 0; top: 0;
  background: rgba(15, 20, 40, 0.95);
  border-radius: 12px;
  display: flex; flex-direction: column;
  z-index: 30; overflow: hidden;
}

.skin-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 10px;
  background: rgba(74, 144, 217, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.skin-title { color: rgba(255,255,255,0.9); font-size: 11px; font-weight: 600; }
.skin-close { background: none; border: none; color: rgba(255,255,255,0.6); font-size: 13px; cursor: pointer; padding: 0 4px; }
.skin-close:hover { color: #fff; }

.skin-list {
  flex: 1; overflow-y: auto; padding: 8px;
  display: flex; flex-direction: column; gap: 6px;
}

.skin-card {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; border-radius: 8px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  cursor: pointer;
  transition: all 0.15s;
}
.skin-card:hover:not(.locked) {
  background: rgba(255,255,255,0.08);
  border-color: rgba(255,255,255,0.12);
}
.skin-card.active {
  background: rgba(74, 144, 217, 0.15);
  border-color: rgba(74, 144, 217, 0.35);
}
.skin-card.locked {
  opacity: 0.5;
  cursor: not-allowed;
}

.skin-card-icon {
  font-size: 22px;
  min-width: 32px;
  text-align: center;
}

.skin-card-info {
  flex: 1;
}

.skin-card-name {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255,255,255,0.9);
  display: flex; align-items: center; gap: 4px;
}

.skin-active-badge {
  font-size: 7px;
  background: rgba(74, 144, 217, 0.4);
  color: #fff;
  padding: 1px 4px;
  border-radius: 3px;
  font-weight: 500;
}

.skin-card-desc {
  font-size: 8px;
  color: rgba(255,255,255,0.45);
  margin-top: 2px;
}

.skin-lock {
  font-size: 8px;
  color: rgba(255, 200, 60, 0.7);
  margin-top: 2px;
}

.skin-hint {
  text-align: center;
  padding: 6px;
  font-size: 8px;
  color: rgba(255,255,255,0.2);
}

.skin-list::-webkit-scrollbar { width: 3px; }
.skin-list::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.15); border-radius: 3px;
}
</style>
