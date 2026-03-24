<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { ReminderType, ReminderResponse } from '../engine/ReminderEngine'

const props = defineProps<{
  type: ReminderType
}>()

const emit = defineEmits<{
  (e: 'respond', type: ReminderType, response: ReminderResponse): void
}>()

// Auto-dismiss after 30 seconds (treat as "later")
let dismissTimer = 0
onMounted(() => {
  dismissTimer = window.setTimeout(() => {
    emit('respond', props.type, 'later')
  }, 30000)
})
onUnmounted(() => clearTimeout(dismissTimer))

// Eye rest countdown (20-20-20 rule: look 20ft away for 20 seconds)
const eyeCountdown = ref(20)
let countdownTimer = 0
const showCountdown = ref(false)

function startEyeCountdown() {
  showCountdown.value = true
  eyeCountdown.value = 20
  countdownTimer = window.setInterval(() => {
    eyeCountdown.value--
    if (eyeCountdown.value <= 0) {
      clearInterval(countdownTimer)
      emit('respond', props.type, 'ok')
    }
  }, 1000)
}

onUnmounted(() => clearInterval(countdownTimer))

const config = computed(() => {
  switch (props.type) {
    case 'water':
      return {
        icon: '💧',
        title: 'Time to Drink Water!',
        message: 'Stay hydrated~ Have a sip!',
        color: '#60B0E0',
        bgColor: 'rgba(96, 176, 224, 0.15)',
        borderColor: 'rgba(96, 176, 224, 0.3)',
      }
    case 'stretch':
      return {
        icon: '🧘',
        title: 'Stand & Stretch!',
        message: 'Take a moment to stretch your body~',
        color: '#80C080',
        bgColor: 'rgba(128, 192, 128, 0.15)',
        borderColor: 'rgba(128, 192, 128, 0.3)',
      }
    case 'eyes':
      return {
        icon: '👀',
        title: 'Eye Rest (20-20-20)',
        message: 'Look at something 20ft away for 20 seconds',
        color: '#C090E0',
        bgColor: 'rgba(192, 144, 224, 0.15)',
        borderColor: 'rgba(192, 144, 224, 0.3)',
      }
  }
})

function onOk() {
  if (props.type === 'eyes' && !showCountdown.value) {
    startEyeCountdown()
    return
  }
  emit('respond', props.type, 'ok')
}

function onLater() {
  emit('respond', props.type, 'later')
}

function onSkip() {
  emit('respond', props.type, 'skip')
}
</script>

<template>
  <div class="reminder-popup" :style="{ background: config.bgColor, borderColor: config.borderColor }">
    <div class="reminder-icon">{{ config.icon }}</div>
    <div class="reminder-title" :style="{ color: config.color }">{{ config.title }}</div>
    <div class="reminder-msg">{{ config.message }}</div>

    <!-- Eye rest countdown -->
    <div v-if="showCountdown && type === 'eyes'" class="eye-countdown">
      <div class="countdown-ring">
        <svg viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="3" />
          <circle
            cx="20" cy="20" r="16" fill="none"
            :stroke="config.color" stroke-width="3" stroke-linecap="round"
            :stroke-dasharray="2 * Math.PI * 16"
            :stroke-dashoffset="2 * Math.PI * 16 * (eyeCountdown / 20)"
            transform="rotate(-90 20 20)"
            class="countdown-fill"
          />
        </svg>
        <span class="countdown-num">{{ eyeCountdown }}</span>
      </div>
    </div>

    <!-- Buttons -->
    <div v-if="!showCountdown" class="reminder-btns">
      <button class="rbtn rbtn-ok" :style="{ background: config.color }" @click="onOk">
        {{ type === 'eyes' ? 'Start' : 'Done!' }}
      </button>
      <button class="rbtn rbtn-later" @click="onLater">Later</button>
      <button class="rbtn rbtn-skip" @click="onSkip">Skip</button>
    </div>
  </div>
</template>

<style scoped>
.reminder-popup {
  position: absolute;
  top: 8px;
  left: 8px;
  right: 8px;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid;
  z-index: 25;
  animation: reminder-in 0.3s ease-out;
  text-align: center;
}

@keyframes reminder-in {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.reminder-icon {
  font-size: 20px;
  margin-bottom: 4px;
}

.reminder-title {
  font-size: 11px;
  font-weight: 700;
  margin-bottom: 2px;
}

.reminder-msg {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 8px;
}

.reminder-btns {
  display: flex;
  gap: 4px;
  justify-content: center;
}

.rbtn {
  font-size: 9px;
  padding: 4px 10px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-weight: 600;
  transition: opacity 0.15s;
}
.rbtn:hover { opacity: 0.85; }

.rbtn-ok {
  color: #fff;
}
.rbtn-later {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.rbtn-skip {
  background: none;
  color: rgba(255, 255, 255, 0.3);
}

/* Eye countdown */
.eye-countdown {
  display: flex;
  justify-content: center;
  margin: 8px 0;
}

.countdown-ring {
  position: relative;
  width: 50px;
  height: 50px;
}
.countdown-ring svg {
  width: 100%;
  height: 100%;
}
.countdown-fill {
  transition: stroke-dashoffset 1s linear;
}
.countdown-num {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 16px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
}
</style>
