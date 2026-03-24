<script setup lang="ts">
import { ref, onMounted } from 'vue'

const emit = defineEmits<{
  (e: 'select', score: number): void
  (e: 'dismiss'): void
}>()

const moods = [
  { score: 5, emoji: '😄', label: 'Great' },
  { score: 4, emoji: '🙂', label: 'Good' },
  { score: 3, emoji: '😐', label: 'Neutral' },
  { score: 2, emoji: '😔', label: 'Low' },
  { score: 1, emoji: '😢', label: 'Bad' },
]

const visible = ref(true)
let dismissTimer = 0

onMounted(() => {
  // Auto-dismiss after 30 seconds
  dismissTimer = window.setTimeout(() => {
    visible.value = false
    emit('dismiss')
  }, 30000)
})

function pick(score: number) {
  clearTimeout(dismissTimer)
  emit('select', score)
}
</script>

<template>
  <Transition name="mood-fade">
    <div v-if="visible" class="mood-card">
      <div class="mood-title">How are you feeling?</div>
      <div class="mood-options">
        <button
          v-for="m in moods"
          :key="m.score"
          class="mood-btn"
          :title="m.label"
          @click="pick(m.score)"
        >
          <span class="mood-emoji">{{ m.emoji }}</span>
          <span class="mood-label">{{ m.label }}</span>
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.mood-card {
  position: absolute;
  top: 8px;
  left: 4px;
  right: 4px;
  background: rgba(15, 20, 40, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  padding: 6px 4px;
  z-index: 25;
  text-align: center;
  backdrop-filter: blur(4px);
}

.mood-title {
  color: rgba(255, 255, 255, 0.7);
  font-size: 9px;
  margin-bottom: 6px;
}

.mood-options {
  display: flex;
  justify-content: center;
  gap: 2px;
}

.mood-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 3px 4px;
  cursor: pointer;
  transition: background 0.15s, transform 0.15s;
}

.mood-btn:hover {
  background: rgba(74, 144, 217, 0.3);
  transform: scale(1.1);
}

.mood-emoji {
  font-size: 15px;
  line-height: 1;
}

.mood-label {
  font-size: 7px;
  color: rgba(255, 255, 255, 0.5);
}

.mood-fade-enter-active,
.mood-fade-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}

.mood-fade-enter-from,
.mood-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
