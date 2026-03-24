<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  CollectibleEngine,
  COLLECTIBLE_CATALOG,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
  RARITY_COLORS,
  type CollectibleCategory,
  type CollectibleDef,
} from '../engine/CollectibleSystem'

const props = defineProps<{ engine: CollectibleEngine }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const selectedCategory = ref<CollectibleCategory | 'all'>('all')

const categories: (CollectibleCategory | 'all')[] = [
  'all',
  'companion_discoveries',
  'focus_milestones',
  'mood_journey',
  'social_couple',
  'system_awareness',
  'scene_milestones',
]

const filteredItems = computed(() => {
  if (selectedCategory.value === 'all') return COLLECTIBLE_CATALOG
  return COLLECTIBLE_CATALOG.filter(c => c.category === selectedCategory.value)
})

const totalDiscovered = computed(() => props.engine.getDiscoveredCount())
const totalItems = computed(() => COLLECTIBLE_CATALOG.length)
const completionPct = computed(() => props.engine.getCompletionPercent())

function isDiscovered(key: string): boolean {
  return props.engine.isDiscovered(key)
}

function getDiscoverDate(key: string): string {
  const d = props.engine.discovered.find(c => c.item_key === key)
  if (!d) return ''
  return new Date(d.discovered_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

function catLabel(cat: CollectibleCategory | 'all'): string {
  if (cat === 'all') return 'All'
  return CATEGORY_LABELS[cat] || cat
}

function catIcon(cat: CollectibleCategory | 'all'): string {
  if (cat === 'all') return '📦'
  return CATEGORY_ICONS[cat] || '?'
}

function catCount(cat: CollectibleCategory | 'all'): string {
  if (cat === 'all') return `${totalDiscovered.value}/${totalItems.value}`
  const found = props.engine.getDiscoveredCount(cat as CollectibleCategory)
  const total = props.engine.getTotalCount(cat as CollectibleCategory)
  return `${found}/${total}`
}

// Selected item detail
const selectedItem = ref<CollectibleDef | null>(null)

function selectItem(item: CollectibleDef) {
  if (isDiscovered(item.key)) {
    selectedItem.value = selectedItem.value?.key === item.key ? null : item
  }
}

onMounted(() => {
  if (!props.engine.loaded) {
    props.engine.load()
  }
})
</script>

<template>
  <div class="collectibles-overlay">
    <div class="collectibles-panel">
      <div class="panel-header">
        <span class="panel-title">Collection Book</span>
        <div class="completion">{{ completionPct }}%</div>
        <button class="close-btn" @click="emit('close')">×</button>
      </div>

      <!-- Progress bar -->
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: completionPct + '%' }" />
      </div>

      <!-- Category tabs -->
      <div class="cat-tabs">
        <button
          v-for="cat in categories"
          :key="cat"
          class="cat-btn"
          :class="{ active: selectedCategory === cat }"
          @click="selectedCategory = cat"
        >
          <span class="cat-icon">{{ catIcon(cat) }}</span>
          <span class="cat-count">{{ catCount(cat) }}</span>
        </button>
      </div>

      <!-- Items grid -->
      <div class="items-grid">
        <div
          v-for="item in filteredItems"
          :key="item.key"
          class="item-cell"
          :class="{
            discovered: isDiscovered(item.key),
            undiscovered: !isDiscovered(item.key),
            selected: selectedItem?.key === item.key,
          }"
          @click="selectItem(item)"
        >
          <div class="item-icon">{{ isDiscovered(item.key) ? item.icon : '?' }}</div>
          <div class="rarity-dot" :style="{ background: isDiscovered(item.key) ? RARITY_COLORS[item.rarity] : 'transparent' }" />
        </div>
      </div>

      <!-- Detail card -->
      <div v-if="selectedItem && isDiscovered(selectedItem.key)" class="detail-card">
        <div class="detail-icon">{{ selectedItem.icon }}</div>
        <div class="detail-info">
          <div class="detail-name">{{ selectedItem.name }}</div>
          <div class="detail-desc">{{ selectedItem.description }}</div>
          <div class="detail-meta">
            <span class="rarity-badge" :style="{ color: RARITY_COLORS[selectedItem.rarity] }">
              {{ selectedItem.rarity }}
            </span>
            <span class="discover-date">{{ getDiscoverDate(selectedItem.key) }}</span>
          </div>
        </div>
      </div>

      <!-- Achievements section -->
      <div class="achievements-section" v-if="props.engine.achievements.length > 0">
        <div class="section-label">Achievements</div>
        <div class="ach-list">
          <div v-for="a in props.engine.achievements" :key="a.id" class="ach-item">
            <span class="ach-icon">🏆</span>
            <span class="ach-name">{{ a.name }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.collectibles-overlay {
  position: absolute;
  top: 0; bottom: 0; left: 0; right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 35;
}

.collectibles-panel {
  width: 380px;
  max-height: 460px;
  background: rgba(15, 20, 40, 0.96);
  border-radius: 14px;
  border: 1px solid rgba(74, 144, 217, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  gap: 8px;
}

.panel-title {
  color: rgba(255,255,255,0.9);
  font-size: 14px;
  font-weight: 700;
  flex: 1;
}

.completion {
  color: rgba(255,210,80,0.9);
  font-size: 13px;
  font-weight: 700;
}

.close-btn {
  background: none;
  border: none;
  color: rgba(255,255,255,0.5);
  font-size: 18px;
  cursor: pointer;
  line-height: 1;
}

/* Progress bar */
.progress-bar {
  height: 3px;
  background: rgba(255,255,255,0.06);
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, rgba(74,144,217,0.8), rgba(255,210,80,0.8));
  border-radius: 2px;
  transition: width 0.5s ease;
}

/* Category tabs */
.cat-tabs {
  display: flex;
  padding: 6px 8px;
  gap: 3px;
  overflow-x: auto;
}

.cat-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 4px 6px;
  border: none;
  background: rgba(255,255,255,0.04);
  border-radius: 6px;
  cursor: pointer;
  min-width: 40px;
  transition: all 0.15s;
}
.cat-btn.active {
  background: rgba(74,144,217,0.2);
}

.cat-icon { font-size: 14px; }
.cat-count {
  color: rgba(255,255,255,0.4);
  font-size: 8px;
}

/* Items grid */
.items-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 4px;
  padding: 8px 12px;
  overflow-y: auto;
  flex: 1;
  max-height: 200px;
}

.item-cell {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  transition: all 0.15s;
}

.item-cell.discovered {
  background: rgba(255,255,255,0.06);
}
.item-cell.discovered:hover {
  background: rgba(255,255,255,0.12);
}
.item-cell.undiscovered {
  background: rgba(0,0,0,0.2);
  cursor: default;
}
.item-cell.selected {
  background: rgba(74,144,217,0.2);
  border: 1px solid rgba(74,144,217,0.4);
}

.item-icon {
  font-size: 18px;
  line-height: 1;
}
.item-cell.undiscovered .item-icon {
  opacity: 0.15;
  filter: grayscale(1);
  font-size: 14px;
}

.rarity-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  position: absolute;
  bottom: 2px;
  right: 2px;
}

/* Detail card */
.detail-card {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 10px 14px;
  border-top: 1px solid rgba(255,255,255,0.06);
  background: rgba(255,255,255,0.02);
}

.detail-icon {
  font-size: 28px;
  flex-shrink: 0;
}

.detail-info {
  flex: 1;
  min-width: 0;
}

.detail-name {
  color: rgba(255,255,255,0.9);
  font-size: 12px;
  font-weight: 700;
}

.detail-desc {
  color: rgba(255,255,255,0.5);
  font-size: 10px;
  margin-top: 2px;
}

.detail-meta {
  display: flex;
  gap: 8px;
  margin-top: 4px;
  align-items: center;
}

.rarity-badge {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
}

.discover-date {
  color: rgba(255,255,255,0.3);
  font-size: 9px;
}

/* Achievements */
.achievements-section {
  padding: 8px 14px;
  border-top: 1px solid rgba(255,255,255,0.06);
}

.section-label {
  color: rgba(255,255,255,0.5);
  font-size: 10px;
  font-weight: 600;
  margin-bottom: 6px;
}

.ach-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.ach-item {
  display: flex;
  align-items: center;
  gap: 3px;
  background: rgba(255,210,80,0.08);
  border-radius: 10px;
  padding: 3px 8px;
}

.ach-icon { font-size: 10px; }
.ach-name {
  color: rgba(255,210,80,0.8);
  font-size: 9px;
}
</style>
