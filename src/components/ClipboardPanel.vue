<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { ClipboardGuardian, ClipboardItem } from '../engine/ClipboardGuardian'

const props = defineProps<{
  guardian: ClipboardGuardian
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'paste', item: ClipboardItem): void
}>()

const searchQuery = ref('')
const items = ref<ClipboardItem[]>([])
const copiedId = ref<number | null>(null)

onMounted(() => {
  items.value = props.guardian.items
})

const filtered = computed(() => {
  if (!searchQuery.value.trim()) return items.value
  return props.guardian.search(searchQuery.value)
})

function formatTime(ts: number): string {
  const d = new Date(ts)
  const now = Date.now()
  const diff = now - ts
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return d.toLocaleDateString()
}

async function onPaste(item: ClipboardItem) {
  await props.guardian.pasteItem(item)
  copiedId.value = item.id
  setTimeout(() => { copiedId.value = null }, 1500)
  emit('paste', item)
}

async function onTogglePin(item: ClipboardItem) {
  await props.guardian.togglePin(item.id)
  items.value = props.guardian.items
}

async function onDelete(item: ClipboardItem) {
  await props.guardian.deleteItem(item.id)
  items.value = props.guardian.items
}
</script>

<template>
  <div class="cb-panel">
    <div class="cb-header">
      <span class="cb-title">Clipboard Backpack</span>
      <span class="cb-count">{{ filtered.length }}/50</span>
      <button class="cb-close" @click="emit('close')">✕</button>
    </div>

    <div class="cb-search">
      <input
        v-model="searchQuery"
        placeholder="Search clipboard..."
        class="cb-search-input"
      />
    </div>

    <div class="cb-list">
      <div
        v-for="item in filtered"
        :key="item.id"
        class="cb-item"
        :class="{ pinned: item.is_pinned, copied: copiedId === item.id }"
        @click="onPaste(item)"
      >
        <div class="cb-item-preview">
          {{ item.preview_text || item.content.slice(0, 100) }}
        </div>
        <div class="cb-item-meta">
          <span class="cb-item-time">{{ formatTime(item.timestamp) }}</span>
          <button
            class="cb-item-pin"
            :class="{ active: item.is_pinned }"
            @click.stop="onTogglePin(item)"
            :title="item.is_pinned ? 'Unpin' : 'Pin'"
          >{{ item.is_pinned ? '⭐' : '☆' }}</button>
          <button
            class="cb-item-del"
            @click.stop="onDelete(item)"
            title="Delete"
          >✕</button>
        </div>
        <div v-if="copiedId === item.id" class="cb-copied-badge">Copied!</div>
      </div>

      <div v-if="filtered.length === 0" class="cb-empty">
        {{ searchQuery ? 'No matches found' : 'Clipboard is empty' }}
      </div>
    </div>

    <div class="cb-hint">
      Click an item to copy it back. Pinned items won't expire.
    </div>
  </div>
</template>

<style scoped>
.cb-panel {
  position: absolute;
  bottom: 0; left: 0; right: 0; top: 0;
  background: rgba(15, 20, 40, 0.95);
  border-radius: 12px;
  display: flex; flex-direction: column;
  z-index: 30; overflow: hidden;
}

.cb-header {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 10px;
  background: rgba(136, 221, 255, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.cb-title { color: rgba(255,255,255,0.9); font-size: 11px; font-weight: 600; flex: 1; }
.cb-count { color: rgba(255,255,255,0.4); font-size: 9px; }
.cb-close { background: none; border: none; color: rgba(255,255,255,0.6); font-size: 13px; cursor: pointer; padding: 0 4px; }
.cb-close:hover { color: #fff; }

.cb-search {
  padding: 4px 8px;
}
.cb-search-input {
  width: 100%;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 10px;
  color: rgba(255,255,255,0.8);
  outline: none;
  box-sizing: border-box;
}
.cb-search-input:focus {
  border-color: rgba(136, 221, 255, 0.4);
}
.cb-search-input::placeholder {
  color: rgba(255,255,255,0.25);
}

.cb-list {
  flex: 1; overflow-y: auto; padding: 4px 8px;
  display: flex; flex-direction: column; gap: 4px;
}

.cb-item {
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  cursor: pointer;
  transition: all 0.15s;
  position: relative;
}
.cb-item:hover {
  background: rgba(136, 221, 255, 0.1);
  border-color: rgba(136, 221, 255, 0.25);
}
.cb-item.pinned {
  border-color: rgba(255, 200, 60, 0.3);
}
.cb-item.copied {
  background: rgba(96, 192, 96, 0.15);
  border-color: rgba(96, 192, 96, 0.4);
}

.cb-item-preview {
  font-size: 9px;
  color: rgba(255,255,255,0.75);
  line-height: 1.3;
  max-height: 32px;
  overflow: hidden;
  word-break: break-all;
}

.cb-item-meta {
  display: flex; align-items: center; gap: 4px;
  margin-top: 3px;
}
.cb-item-time {
  font-size: 7px;
  color: rgba(255,255,255,0.3);
  flex: 1;
}
.cb-item-pin, .cb-item-del {
  background: none; border: none;
  font-size: 9px; cursor: pointer;
  padding: 0 2px;
  color: rgba(255,255,255,0.3);
}
.cb-item-pin:hover { color: #FFD93D; }
.cb-item-pin.active { color: #FFD93D; }
.cb-item-del:hover { color: #FF6060; }

.cb-copied-badge {
  position: absolute;
  top: 4px; right: 6px;
  font-size: 7px;
  color: #60C060;
  font-weight: 600;
}

.cb-empty {
  text-align: center;
  padding: 20px;
  color: rgba(255,255,255,0.2);
  font-size: 10px;
}

.cb-hint {
  text-align: center;
  padding: 4px;
  font-size: 7px;
  color: rgba(255,255,255,0.2);
}

.cb-list::-webkit-scrollbar { width: 3px; }
.cb-list::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.15); border-radius: 3px;
}
</style>
