<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { CountdownSystem, type UpcomingEvent } from '../engine/CountdownDays'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const countdown = new CountdownSystem()
const upcoming = ref<UpcomingEvent[]>([])
const showAdd = ref(false)

// Add form
const newTitle = ref('')
const newEmoji = ref('🎂')
const newDate = ref(new Date().toISOString().slice(0, 10))
const newYearly = ref(false)

const EMOJI_OPTIONS = ['🎂', '🎉', '❤️', '📅', '✈️', '🎓', '💍', '🏠', '🎁', '⭐']

onMounted(async () => {
  await countdown.load()
  refreshList()
})

function refreshList() {
  upcoming.value = countdown.getUpcoming(20)
}

async function addEvent() {
  const title = newTitle.value.trim()
  if (!title) return
  const dateTs = new Date(newDate.value).getTime()
  if (isNaN(dateTs)) return

  await countdown.addEvent(title, newEmoji.value, dateTs, newYearly.value)
  refreshList()
  newTitle.value = ''
  newDate.value = new Date().toISOString().slice(0, 10)
  newYearly.value = false
  showAdd.value = false
}

async function removeEvent(id: number) {
  await countdown.removeEvent(id)
  refreshList()
}

function formatDays(days: number): string {
  if (days === 0) return 'Today!'
  if (days === 1) return 'Tomorrow'
  if (days < 0) return `${-days}d ago`
  return `${days}d left`
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
</script>

<template>
  <div class="cd-panel">
    <div class="cd-header">
      <span class="cd-title">Important Dates</span>
      <div class="cd-actions">
        <button class="cd-add-btn" @click="showAdd = !showAdd">{{ showAdd ? '✕' : '+' }}</button>
        <button class="cd-close" @click="emit('close')">✕</button>
      </div>
    </div>

    <!-- Add form -->
    <div v-if="showAdd" class="cd-form">
      <div class="form-row">
        <div class="emoji-picker">
          <button
            v-for="em in EMOJI_OPTIONS" :key="em"
            class="emoji-opt" :class="{ active: newEmoji === em }"
            @click="newEmoji = em"
          >{{ em }}</button>
        </div>
      </div>
      <div class="form-row">
        <input v-model="newTitle" class="form-input" placeholder="Event name" maxlength="20" @keyup.enter="addEvent" />
      </div>
      <div class="form-row">
        <input v-model="newDate" type="date" class="form-input date-input" />
        <label class="yearly-label">
          <input type="checkbox" v-model="newYearly" /> Yearly
        </label>
      </div>
      <button class="form-submit" @click="addEvent">Add</button>
    </div>

    <!-- Event list -->
    <div class="cd-body">
      <div v-if="upcoming.length === 0" class="cd-empty">
        No events yet. Tap + to add one!
      </div>
      <div
        v-for="u in upcoming" :key="u.event.id"
        class="cd-item" :class="{ today: u.isToday }"
      >
        <span class="cd-emoji">{{ u.event.emoji }}</span>
        <div class="cd-info">
          <div class="cd-name">{{ u.event.title }}</div>
          <div class="cd-meta">
            {{ formatDate(u.effectiveDateTs) }}
            <span v-if="u.event.yearly" class="cd-yearly">↻</span>
          </div>
        </div>
        <div class="cd-days" :class="{ today: u.isToday, soon: u.daysLeft > 0 && u.daysLeft <= 7 }">
          {{ formatDays(u.daysLeft) }}
        </div>
        <button class="cd-del" @click="removeEvent(u.event.id)">×</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cd-panel {
  position: absolute;
  bottom: 0; left: 0; right: 0; top: 0;
  background: rgba(15, 20, 40, 0.95);
  border-radius: 12px;
  display: flex; flex-direction: column;
  z-index: 30; overflow: hidden;
}
.cd-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 10px;
  background: rgba(74, 144, 217, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.cd-title { color: rgba(255,255,255,0.9); font-size: 11px; font-weight: 600; }
.cd-actions { display: flex; gap: 4px; }
.cd-add-btn, .cd-close {
  background: none; border: none; color: rgba(255,255,255,0.6);
  font-size: 13px; cursor: pointer; padding: 0 4px;
}
.cd-add-btn:hover, .cd-close:hover { color: #fff; }

/* Form */
.cd-form {
  padding: 6px 10px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  display: flex; flex-direction: column; gap: 4px;
}
.form-row { display: flex; align-items: center; gap: 4px; }
.emoji-picker { display: flex; gap: 2px; flex-wrap: wrap; }
.emoji-opt {
  font-size: 12px; padding: 2px 3px; border-radius: 4px;
  border: 1px solid transparent; background: none; cursor: pointer;
}
.emoji-opt.active { border-color: rgba(74,144,217,0.5); background: rgba(74,144,217,0.15); }
.form-input {
  flex: 1; font-size: 10px; padding: 4px 6px; border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.06);
  color: #fff; outline: none;
}
.form-input:focus { border-color: rgba(74,144,217,0.5); }
.date-input { width: 100px; flex: none; }
.yearly-label { font-size: 8px; color: rgba(255,255,255,0.5); display: flex; align-items: center; gap: 2px; cursor: pointer; }
.yearly-label input { width: 10px; height: 10px; accent-color: #4A90D9; }
.form-submit {
  font-size: 9px; padding: 4px 12px; border-radius: 5px;
  border: none; background: rgba(74,144,217,0.5); color: #fff;
  cursor: pointer; align-self: flex-end;
}
.form-submit:hover { background: rgba(74,144,217,0.7); }

/* Body */
.cd-body {
  flex: 1; overflow-y: auto; padding: 6px 8px;
  display: flex; flex-direction: column; gap: 4px;
}
.cd-body::-webkit-scrollbar { width: 3px; }
.cd-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
.cd-empty { color: rgba(255,255,255,0.3); font-size: 10px; text-align: center; margin-top: 30px; }

.cd-item {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 6px; border-radius: 6px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.04);
  transition: background 0.15s;
}
.cd-item.today {
  background: rgba(255, 215, 0, 0.08);
  border-color: rgba(255, 215, 0, 0.2);
}
.cd-emoji { font-size: 14px; flex-shrink: 0; }
.cd-info { flex: 1; min-width: 0; }
.cd-name { font-size: 10px; color: rgba(255,255,255,0.85); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cd-meta { font-size: 7px; color: rgba(255,255,255,0.3); margin-top: 1px; }
.cd-yearly { color: rgba(74,144,217,0.6); }
.cd-days {
  font-size: 9px; font-weight: 600; color: rgba(255,255,255,0.5);
  flex-shrink: 0; text-align: right;
}
.cd-days.today { color: #FFD93D; }
.cd-days.soon { color: #FFA07A; }
.cd-del {
  background: none; border: none; color: rgba(255,255,255,0.15);
  font-size: 12px; cursor: pointer; padding: 0 2px; flex-shrink: 0;
}
.cd-del:hover { color: rgba(255,100,100,0.7); }
</style>
