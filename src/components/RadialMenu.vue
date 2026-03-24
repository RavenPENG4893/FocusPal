<script setup lang="ts">
const emit = defineEmits<{
  (e: 'select', item: string): void
  (e: 'close'): void
}>()

const items = [
  { id: 'focus', icon: '⏱', label: 'Focus' },
  { id: 'chat', icon: '💬', label: 'Chat' },
  { id: 'mood', icon: '😊', label: 'Mood' },
  { id: 'growth', icon: '⭐', label: 'Growth' },
  { id: 'journal', icon: '📖', label: 'Journal' },
  { id: 'analytics', icon: '📊', label: 'Stats' },
  { id: 'collectibles', icon: '🏆', label: 'Collect' },
  { id: 'sound', icon: '🎵', label: 'Sound' },
  { id: 'clipboard', icon: '🎒', label: 'Backpack' },
  { id: 'fishing', icon: '🎣', label: 'Fishing' },
  { id: 'settings', icon: '⚙️', label: 'Settings' },
]

// Position items in a circle
function getStyle(index: number) {
  const total = items.length
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2 // start from top
  const radius = 88
  const x = Math.cos(angle) * radius
  const y = Math.sin(angle) * radius
  return {
    transform: `translate(${x}px, ${y}px)`,
    animationDelay: `${index * 40}ms`,
  }
}

function onItemClick(id: string) {
  emit('select', id)
}

function onBackdropClick() {
  emit('close')
}
</script>

<template>
  <div class="radial-backdrop" @click.self="onBackdropClick">
    <div class="radial-center">
      <button
        v-for="(item, i) in items"
        :key="item.id"
        class="radial-item"
        :style="getStyle(i)"
        :title="item.label"
        @click.stop="onItemClick(item.id)"
      >
        <span class="radial-icon">{{ item.icon }}</span>
        <span class="radial-label">{{ item.label }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.radial-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
}

.radial-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -60%);
}

.radial-item {
  position: absolute;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: rgba(30, 60, 114, 0.9);
  border: 2px solid rgba(255, 255, 255, 0.3);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  animation: radial-pop 0.2s ease-out both;
  transform-origin: center;
  margin-left: -19px;
  margin-top: -19px;
  transition: background 0.15s, transform 0.15s;
}

.radial-item:hover {
  background: rgba(74, 144, 217, 0.95);
  scale: 1.15;
  border-color: rgba(255, 255, 255, 0.6);
}

.radial-icon {
  font-size: 16px;
  line-height: 1;
}

.radial-label {
  font-size: 7px;
  color: rgba(255, 255, 255, 0.9);
  margin-top: 1px;
  white-space: nowrap;
}

@keyframes radial-pop {
  from {
    opacity: 0;
    scale: 0.3;
  }
  to {
    opacity: 1;
    scale: 1;
  }
}
</style>
