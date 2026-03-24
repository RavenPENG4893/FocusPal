<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { JournalEngine, type JournalEntry, type DayContext } from '../engine/JournalSystem'

const emit = defineEmits<{ (e: 'close'): void }>()

const engine = new JournalEngine()
const tab = ref<'write' | 'browse' | 'search'>('write')

// ── Write tab ──
const selectedDate = ref(JournalEngine.todayKey())
const content = ref('')
const context = ref<DayContext>({ moodScore: 0, focusHours: 0, companionLevel: 1 })
const saving = ref(false)
const saved = ref(false)
const prompt = ref<string | null>(null)
let promptTimer: ReturnType<typeof setTimeout> | null = null
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

// ── Browse tab ──
const journalDates = ref<string[]>([])
const browseEntry = ref<JournalEntry | null>(null)

// ── Search tab ──
const searchQuery = ref('')
const searchResults = ref<JournalEntry[]>([])

// ── Calendar mini ──
const calMonth = ref(new Date().getMonth())
const calYear = ref(new Date().getFullYear())

const calDays = computed(() => {
  const first = new Date(calYear.value, calMonth.value, 1)
  const last = new Date(calYear.value, calMonth.value + 1, 0)
  const startDay = first.getDay()
  const totalDays = last.getDate()
  const cells: { day: number; key: string; hasEntry: boolean; isToday: boolean }[] = []

  // Empty cells for alignment
  for (let i = 0; i < startDay; i++) {
    cells.push({ day: 0, key: '', hasEntry: false, isToday: false })
  }

  const today = JournalEngine.todayKey()
  for (let d = 1; d <= totalDays; d++) {
    const dt = new Date(calYear.value, calMonth.value, d)
    const key = JournalEngine.dateKey(dt)
    cells.push({
      day: d,
      key,
      hasEntry: journalDates.value.includes(key),
      isToday: key === today,
    })
  }
  return cells
})

const calLabel = computed(() => {
  return new Date(calYear.value, calMonth.value).toLocaleDateString('en', { month: 'long', year: 'numeric' })
})

function prevMonth() {
  if (calMonth.value === 0) { calMonth.value = 11; calYear.value-- }
  else calMonth.value--
}

function nextMonth() {
  if (calMonth.value === 11) { calMonth.value = 0; calYear.value++ }
  else calMonth.value++
}

async function selectCalDay(key: string) {
  if (!key) return
  selectedDate.value = key
  tab.value = 'write'
  await loadEntry(key)
}

// ── Load / Save ──

async function loadEntry(dateKey: string) {
  const entry = await engine.load(dateKey)
  content.value = entry?.content_md || ''
  context.value = await engine.getTodayContext()
  saved.value = false

  // Start prompt timer if empty
  if (!content.value) {
    startPromptTimer()
  }
}

async function saveEntry() {
  if (saving.value) return
  saving.value = true
  await engine.save(selectedDate.value, content.value, context.value)
  saving.value = false
  saved.value = true

  // Refresh dates list
  journalDates.value = await engine.getDates()
  setTimeout(() => { saved.value = false }, 2000)
}

function onInput() {
  saved.value = false
  // Auto-save after 2 seconds of no typing
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(() => {
    if (content.value.trim()) saveEntry()
  }, 2000)

  // Cancel prompt if user starts typing
  if (promptTimer) {
    clearTimeout(promptTimer)
    prompt.value = null
  }
}

function startPromptTimer() {
  if (promptTimer) clearTimeout(promptTimer)
  promptTimer = setTimeout(() => {
    if (!content.value.trim()) {
      prompt.value = engine.getPrompt()
    }
  }, 30000) // 30 seconds
}

function usePrompt() {
  if (prompt.value) {
    content.value = `**${prompt.value}**\n\n`
    prompt.value = null
  }
}

// ── Search ──

async function doSearch() {
  searchResults.value = await engine.search(searchQuery.value)
}

function viewSearchResult(entry: JournalEntry) {
  selectedDate.value = entry.date_key
  content.value = entry.content_md
  tab.value = 'write'
}

// ── Export ──
async function exportJournal() {
  const md = await engine.exportAll()
  if (!md) return
  // Copy to clipboard
  try {
    await navigator.clipboard.writeText(md)
    alert('Journal exported to clipboard!')
  } catch {
    console.error('[Journal] clipboard write failed')
  }
}

// ── Init ──

onMounted(async () => {
  journalDates.value = await engine.getDates()
  await loadEntry(selectedDate.value)
})

watch(selectedDate, (key) => loadEntry(key))

const moodEmoji = computed(() => {
  const s = Math.round(context.value.moodScore)
  return ['', '😢', '😕', '😐', '😊', '😄'][s] || '—'
})

const dateLabel = computed(() => {
  const d = JournalEngine.parseKey(selectedDate.value)
  return d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })
})
</script>

<template>
  <div class="journal-overlay">
    <div class="journal-panel">
      <div class="panel-header">
        <span class="panel-title">Journal</span>
        <div class="header-actions">
          <button class="action-btn" title="Export" @click="exportJournal">📤</button>
          <button class="close-btn" @click="emit('close')">×</button>
        </div>
      </div>

      <div class="tabs">
        <button class="tab-btn" :class="{ active: tab === 'write' }" @click="tab = 'write'">Write</button>
        <button class="tab-btn" :class="{ active: tab === 'browse' }" @click="tab = 'browse'">Browse</button>
        <button class="tab-btn" :class="{ active: tab === 'search' }" @click="tab = 'search'">Search</button>
      </div>

      <div class="panel-body">
        <!-- Write Tab -->
        <div v-if="tab === 'write'" class="write-section">
          <!-- Context card -->
          <div class="context-card">
            <span class="ctx-item">{{ dateLabel }}</span>
            <span class="ctx-item" v-if="context.moodScore">{{ moodEmoji }} Mood</span>
            <span class="ctx-item" v-if="context.focusHours">⏱ {{ context.focusHours }}h</span>
            <span class="ctx-item">Lv.{{ context.companionLevel }}</span>
          </div>

          <!-- AI Writing prompt -->
          <div v-if="prompt" class="prompt-card" @click="usePrompt">
            <span class="prompt-icon">💡</span>
            <span class="prompt-text">{{ prompt }}</span>
            <span class="prompt-hint">(click to use)</span>
          </div>

          <!-- Editor -->
          <textarea
            class="editor"
            v-model="content"
            @input="onInput"
            :placeholder="'Write about your day...'"
            spellcheck="false"
          />

          <div class="editor-footer">
            <span class="save-status" :class="{ visible: saved }">Saved!</span>
            <button class="save-btn" @click="saveEntry" :disabled="saving">
              {{ saving ? 'Saving...' : 'Save' }}
            </button>
          </div>
        </div>

        <!-- Browse Tab (Calendar) -->
        <div v-if="tab === 'browse'" class="browse-section">
          <div class="cal-nav">
            <button class="cal-arrow" @click="prevMonth">&lt;</button>
            <span class="cal-label">{{ calLabel }}</span>
            <button class="cal-arrow" @click="nextMonth">&gt;</button>
          </div>
          <div class="cal-weekdays">
            <span v-for="d in ['Su','Mo','Tu','We','Th','Fr','Sa']" :key="d" class="cal-wd">{{ d }}</span>
          </div>
          <div class="cal-grid">
            <div
              v-for="(cell, i) in calDays"
              :key="i"
              class="cal-cell"
              :class="{
                empty: cell.day === 0,
                'has-entry': cell.hasEntry,
                today: cell.isToday,
                selected: cell.key === selectedDate,
              }"
              @click="selectCalDay(cell.key)"
            >
              <span v-if="cell.day > 0">{{ cell.day }}</span>
              <span v-if="cell.hasEntry" class="entry-dot" />
            </div>
          </div>
          <div class="entries-count">
            {{ journalDates.length }} entries total
          </div>
        </div>

        <!-- Search Tab -->
        <div v-if="tab === 'search'" class="search-section">
          <div class="search-bar">
            <input
              v-model="searchQuery"
              class="search-input"
              placeholder="Search entries..."
              @keyup.enter="doSearch"
            />
            <button class="search-btn" @click="doSearch">🔍</button>
          </div>
          <div class="search-results">
            <div
              v-for="r in searchResults"
              :key="r.id"
              class="search-item"
              @click="viewSearchResult(r)"
            >
              <div class="search-date">{{ r.date_key }}</div>
              <div class="search-preview">{{ r.content_md.slice(0, 80) }}...</div>
            </div>
            <div v-if="searchResults.length === 0 && searchQuery" class="no-results">
              No entries found
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.journal-overlay {
  position: absolute;
  top: 0; bottom: 0; left: 0; right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 35;
}

.journal-panel {
  width: 380px;
  max-height: 450px;
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
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}

.panel-title {
  color: rgba(255,255,255,0.9);
  font-size: 14px;
  font-weight: 700;
}

.header-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

.action-btn {
  background: none;
  border: none;
  font-size: 14px;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s;
}
.action-btn:hover { opacity: 1; }

.close-btn {
  background: none;
  border: none;
  color: rgba(255,255,255,0.5);
  font-size: 18px;
  cursor: pointer;
  line-height: 1;
}

.tabs {
  display: flex;
  padding: 6px 10px 0;
  gap: 2px;
}

.tab-btn {
  flex: 1;
  padding: 5px 4px;
  border: none;
  background: rgba(255,255,255,0.05);
  color: rgba(255,255,255,0.5);
  font-size: 10px;
  cursor: pointer;
  border-radius: 6px 6px 0 0;
  transition: all 0.2s;
}
.tab-btn.active {
  background: rgba(74,144,217,0.2);
  color: rgba(255,255,255,0.9);
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 10px 14px;
}

/* Write section */
.write-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.context-card {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.ctx-item {
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.6);
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 10px;
}

.prompt-card {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255,210,80,0.1);
  border: 1px solid rgba(255,210,80,0.2);
  border-radius: 8px;
  padding: 8px 10px;
  cursor: pointer;
  transition: background 0.2s;
}
.prompt-card:hover {
  background: rgba(255,210,80,0.18);
}

.prompt-icon { font-size: 14px; }
.prompt-text {
  color: rgba(255,255,255,0.8);
  font-size: 11px;
  flex: 1;
}
.prompt-hint {
  color: rgba(255,255,255,0.3);
  font-size: 8px;
}

.editor {
  width: 100%;
  min-height: 180px;
  background: rgba(0,0,0,0.25);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  color: rgba(255,255,255,0.85);
  font-size: 12px;
  line-height: 1.7;
  padding: 10px;
  resize: vertical;
  font-family: 'Segoe UI', system-ui, sans-serif;
  outline: none;
  box-sizing: border-box;
}
.editor:focus {
  border-color: rgba(74,144,217,0.4);
}
.editor::placeholder {
  color: rgba(255,255,255,0.2);
}

.editor-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.save-status {
  color: rgba(80,200,80,0.8);
  font-size: 10px;
  opacity: 0;
  transition: opacity 0.3s;
}
.save-status.visible { opacity: 1; }

.save-btn {
  background: rgba(74,144,217,0.3);
  color: rgba(255,255,255,0.8);
  border: none;
  border-radius: 6px;
  padding: 5px 16px;
  font-size: 11px;
  cursor: pointer;
}
.save-btn:hover { background: rgba(74,144,217,0.5); }
.save-btn:disabled { opacity: 0.4; cursor: default; }

/* Browse / Calendar */
.browse-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cal-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cal-arrow {
  background: none;
  border: none;
  color: rgba(255,255,255,0.5);
  font-size: 14px;
  cursor: pointer;
  padding: 4px 10px;
}

.cal-label {
  color: rgba(255,255,255,0.8);
  font-size: 12px;
  font-weight: 600;
}

.cal-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.cal-wd {
  text-align: center;
  color: rgba(255,255,255,0.3);
  font-size: 9px;
}

.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.cal-cell {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 10px;
  color: rgba(255,255,255,0.5);
  cursor: pointer;
  position: relative;
  transition: background 0.15s;
}
.cal-cell:hover:not(.empty) { background: rgba(255,255,255,0.08); }
.cal-cell.empty { cursor: default; }
.cal-cell.today { color: rgba(74,144,217,1); font-weight: 700; }
.cal-cell.selected { background: rgba(74,144,217,0.25); }
.cal-cell.has-entry { color: rgba(255,255,255,0.9); }

.entry-dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: rgba(74,144,217,0.8);
  position: absolute;
  bottom: 2px;
}

.entries-count {
  text-align: center;
  color: rgba(255,255,255,0.3);
  font-size: 9px;
}

/* Search */
.search-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.search-bar {
  display: flex;
  gap: 4px;
}

.search-input {
  flex: 1;
  background: rgba(0,0,0,0.3);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  color: rgba(255,255,255,0.85);
  font-size: 11px;
  padding: 6px 10px;
  outline: none;
}
.search-input:focus { border-color: rgba(74,144,217,0.4); }

.search-btn {
  background: rgba(74,144,217,0.3);
  border: none;
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
  font-size: 12px;
}

.search-results {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 250px;
  overflow-y: auto;
}

.search-item {
  background: rgba(255,255,255,0.04);
  border-radius: 6px;
  padding: 8px 10px;
  cursor: pointer;
  transition: background 0.15s;
}
.search-item:hover { background: rgba(255,255,255,0.08); }

.search-date {
  color: rgba(74,144,217,0.8);
  font-size: 10px;
  font-weight: 600;
}

.search-preview {
  color: rgba(255,255,255,0.5);
  font-size: 10px;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.no-results {
  text-align: center;
  color: rgba(255,255,255,0.3);
  font-size: 11px;
  padding: 20px;
}
</style>
