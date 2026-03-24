<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'
import {
  chatStream, type ChatMessage, type LLMMode,
  getMode, setMode, getApiKey, setApiKey, initLLM, type LLMStatus,
} from '../engine/LLMService'
import { SentimentTracker } from '../engine/SentimentEngine'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'thinking', val: boolean): void
  (e: 'llmStatus', status: LLMStatus): void
  (e: 'sentimentHint', anim: string): void
}>()

const sentimentTracker = new SentimentTracker()

export interface SystemContext {
  cpu: number
  memory: number
  battery: number
  isCharging: boolean
  currentState: string
  timePeriod: string
}

const props = defineProps<{
  companionName: string
  llmReady: boolean
  systemContext?: SystemContext
  patternContext?: string
}>()

const userInput = ref('')
const messages = ref<{ role: 'user' | 'assistant'; text: string }[]>([])
const isThinking = ref(false)
const chatBody = ref<HTMLElement | null>(null)

// Mode toggle
const currentMode = ref<LLMMode>(getMode())
const apiKey = ref(getApiKey())
const showSettings = ref(false)

function buildSystemPrompt(): string {
  const ctx = props.systemContext
  const now = new Date()
  const timeStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`

  let prompt = `/no_think
你是FocusPal的伙伴角色，名叫${props.companionName}。你温柔、有点俏皮、真心关心用户。
你能感知用户的电脑状态（CPU、电量、时间等）。
规则：
- 回复简短自然，控制在50字以内，像朋友聊天
- 偶尔用emoji但不要太多
- 不要说教，不要列清单
- 不要说"作为AI"或"作为语言模型"
- 关心用户但给空间，不要过度热情
当前状态：
- 时间：${timeStr}`

  if (ctx) {
    prompt += `\n- CPU：${ctx.cpu.toFixed(0)}%`
    if (ctx.battery >= 0) {
      prompt += `\n- 电量：${ctx.battery.toFixed(0)}%（${ctx.isCharging ? '充电中' : '未充电'}）`
    }
    prompt += `\n- 今日专注：${ctx.currentState}`
    prompt += `\n- 时段：${ctx.timePeriod}`
  }

  if (props.patternContext) {
    prompt += `\n${props.patternContext}`
  }

  // Sentiment context injection
  const sentimentAddition = sentimentTracker.buildPromptAddition()
  if (sentimentAddition) {
    prompt += sentimentAddition
  }

  return prompt
}

async function toggleMode() {
  const newMode: LLMMode = currentMode.value === 'local' ? 'cloud' : 'local'
  currentMode.value = newMode
  setMode(newMode)
  // Re-init LLM with new mode
  await initLLM((s) => emit('llmStatus', s))
}

function saveKey() {
  setApiKey(apiKey.value.trim())
  showSettings.value = false
  if (currentMode.value === 'cloud') {
    initLLM((s) => emit('llmStatus', s))
  }
}

async function send() {
  const text = userInput.value.trim()
  if (!text || isThinking.value) return

  userInput.value = ''
  messages.value.push({ role: 'user', text })
  scrollToBottom()

  // Track sentiment and emit animation hint
  sentimentTracker.record(text)
  const animHint = sentimentTracker.getAnimationHint()
  if (animHint) emit('sentimentHint', animHint)

  if (!props.llmReady) {
    messages.value.push({ role: 'assistant', text: 'AI is still loading, wait a moment~' })
    return
  }

  isThinking.value = true
  emit('thinking', true)

  const assistantIdx = messages.value.length
  messages.value.push({ role: 'assistant', text: '' })

  try {
    const history: ChatMessage[] = [
      { role: 'system', content: buildSystemPrompt() },
      ...messages.value.slice(0, assistantIdx).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.text,
      })),
    ]

    await chatStream(history, (token) => {
      messages.value[assistantIdx].text += token
      scrollToBottom()
    }, { temperature: 0.8, max_tokens: 512 })

    if (!messages.value[assistantIdx].text) {
      messages.value[assistantIdx].text = '...'
    }
  } catch (e) {
    messages.value[assistantIdx].text = '...zZz (something went wrong)'
    console.error('[Chat] error:', e)
  } finally {
    isThinking.value = false
    emit('thinking', false)
    scrollToBottom()
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (chatBody.value) {
      chatBody.value.scrollTop = chatBody.value.scrollHeight
    }
  })
}

function close() {
  emit('close')
}
</script>

<template>
  <div class="chat-panel">
    <div class="chat-header">
      <span class="chat-title">Chat with {{ companionName }}</span>
      <div class="header-actions">
        <button
          class="mode-toggle"
          :title="currentMode === 'cloud' ? 'Cloud mode (click for local)' : 'Local mode (click for cloud)'"
          @click="toggleMode"
        >
          {{ currentMode === 'cloud' ? '☁' : '💻' }}
        </button>
        <button class="settings-btn" title="API settings" @click="showSettings = !showSettings">⚙</button>
        <button class="chat-close" @click="close">✕</button>
      </div>
    </div>

    <!-- Settings panel -->
    <div v-if="showSettings" class="settings-panel">
      <div class="settings-row">
        <span class="settings-label">Mode:</span>
        <span class="settings-value">{{ currentMode === 'cloud' ? 'Cloud (DeepSeek)' : 'Local (Qwen)' }}</span>
      </div>
      <div class="settings-row">
        <span class="settings-label">API Key:</span>
        <input
          v-model="apiKey"
          class="settings-input"
          type="password"
          placeholder="sk-..."
          @keyup.enter="saveKey"
        />
        <button class="settings-save" @click="saveKey">Save</button>
      </div>
    </div>

    <div ref="chatBody" class="chat-body">
      <div v-if="messages.length === 0" class="chat-empty">
        Say hi to {{ companionName }}!
        <div class="chat-mode-hint">{{ currentMode === 'cloud' ? '☁ Cloud' : '💻 Local' }}</div>
      </div>
      <div
        v-for="(msg, i) in messages"
        :key="i"
        class="chat-msg"
        :class="msg.role"
      >
        {{ msg.text }}
      </div>
    </div>

    <div class="chat-input-row">
      <input
        v-model="userInput"
        class="chat-input"
        placeholder="Type something..."
        maxlength="200"
        :disabled="isThinking"
        autofocus
        @keyup.enter="send"
      />
      <button class="chat-send" :disabled="isThinking || !userInput.trim()" @click="send">
        ➤
      </button>
    </div>
  </div>
</template>

<style scoped>
.chat-panel {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  top: 0;
  background: rgba(15, 20, 40, 0.95);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  z-index: 30;
  overflow: hidden;
  user-select: text;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: rgba(74, 144, 217, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.chat-title {
  color: rgba(255, 255, 255, 0.9);
  font-size: 11px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.mode-toggle, .settings-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  cursor: pointer;
  padding: 0 3px;
}

.mode-toggle:hover, .settings-btn:hover {
  color: #fff;
}

.chat-close {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  cursor: pointer;
  padding: 0 4px;
}

.chat-close:hover {
  color: #fff;
}

/* Settings panel */
.settings-panel {
  padding: 6px 10px;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.settings-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
}

.settings-label {
  color: rgba(255, 255, 255, 0.5);
  min-width: 45px;
}

.settings-value {
  color: rgba(255, 255, 255, 0.8);
}

.settings-input {
  flex: 1;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  color: #fff;
  font-size: 10px;
  padding: 3px 6px;
  outline: none;
}

.settings-save {
  background: rgba(74, 144, 217, 0.5);
  border: none;
  border-radius: 4px;
  color: #fff;
  font-size: 10px;
  padding: 3px 8px;
  cursor: pointer;
}

.settings-save:hover {
  background: rgba(74, 144, 217, 0.7);
}

.chat-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.chat-body::-webkit-scrollbar {
  width: 3px;
}

.chat-body::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.chat-empty {
  color: rgba(255, 255, 255, 0.4);
  font-size: 11px;
  text-align: center;
  margin-top: 40px;
}

.chat-mode-hint {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.25);
  margin-top: 6px;
}

.chat-msg {
  font-size: 11px;
  padding: 5px 8px;
  border-radius: 8px;
  max-width: 85%;
  word-wrap: break-word;
  line-height: 1.4;
}

.chat-msg.user {
  background: rgba(74, 144, 217, 0.5);
  color: #fff;
  align-self: flex-end;
  border-bottom-right-radius: 3px;
}

.chat-msg.assistant {
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.9);
  align-self: flex-start;
  border-bottom-left-radius: 3px;
}

.chat-msg.thinking {
  color: rgba(255, 255, 255, 0.5);
}

.dot-anim {
  animation: dot-pulse 1s infinite;
}

@keyframes dot-pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

.chat-input-row {
  display: flex;
  gap: 4px;
  padding: 6px 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.chat-input {
  flex: 1;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  color: #fff;
  font-size: 11px;
  padding: 5px 8px;
  outline: none;
}

.chat-input:focus {
  border-color: rgba(74, 144, 217, 0.5);
}

.chat-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.chat-send {
  background: rgba(74, 144, 217, 0.6);
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 12px;
  padding: 4px 8px;
  cursor: pointer;
}

.chat-send:hover:not(:disabled) {
  background: rgba(74, 144, 217, 0.8);
}

.chat-send:disabled {
  opacity: 0.4;
  cursor: default;
}
</style>
