// LLM Service: manages local llama-server + cloud API (SiliconFlow/DeepSeek)
// Local: localhost:8384, Cloud: SiliconFlow OpenAI-compatible API

import { invoke } from '@tauri-apps/api/core'

const LOCAL_URL = 'http://127.0.0.1:8384'
const CLOUD_URL = 'https://api.siliconflow.cn/v1'
const CLOUD_MODEL = 'deepseek-ai/DeepSeek-V3'

export type LLMStatus = 'stopped' | 'starting' | 'ready' | 'error'
export type LLMMode = 'local' | 'cloud'

// ── Persistent settings ──

const SETTINGS_KEY = 'focuspal_llm_settings'

interface LLMSettings {
  mode: LLMMode
  apiKey: string
}

function loadSettings(): LLMSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { mode: 'cloud', apiKey: '' }
}

function saveSettings(s: LLMSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  // Also persist to SQLite (fire-and-forget)
  import('@tauri-apps/api/core').then(({ invoke }) => {
    invoke('config_set', { key: 'llm_mode', value: s.mode }).catch(() => {})
    invoke('config_set', { key: 'llm_api_key', value: s.apiKey }).catch(() => {})
  }).catch(() => {})
}

let _settings = loadSettings()

export function getMode(): LLMMode { return _settings.mode }
export function setMode(mode: LLMMode) {
  _settings.mode = mode
  saveSettings(_settings)
}

export function getApiKey(): string { return _settings.apiKey }
export function setApiKey(key: string) {
  _settings.apiKey = key
  saveSettings(_settings)
}

// ── Types ──

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatResponse {
  content: string
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

// ── Local server management ──

export async function startServer(): Promise<string> {
  return invoke<string>('start_llm_server')
}

export async function stopServer(): Promise<string> {
  return invoke<string>('stop_llm_server')
}

export async function getProcessStatus(): Promise<string> {
  return invoke<string>('llm_server_status')
}

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${LOCAL_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return false
    const data = await res.json()
    return data.status === 'ok'
  } catch {
    return false
  }
}

export async function waitForReady(maxAttempts = 30, intervalMs = 2000): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const ok = await healthCheck()
    if (ok) return true
    await new Promise(r => setTimeout(r, intervalMs))
  }
  return false
}

// ── Unified chat (picks local or cloud based on mode) ──

function getEndpoint(): { url: string; headers: Record<string, string>; model: string } {
  if (_settings.mode === 'cloud') {
    return {
      url: `${CLOUD_URL}/chat/completions`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${_settings.apiKey}`,
      },
      model: CLOUD_MODEL,
    }
  }
  return {
    url: `${LOCAL_URL}/v1/chat/completions`,
    headers: { 'Content-Type': 'application/json' },
    model: 'qwen2.5-1.5b-instruct',
  }
}

/** Send a chat completion request (non-streaming) */
export async function chat(
  messages: ChatMessage[],
  options?: { temperature?: number; max_tokens?: number },
): Promise<ChatResponse> {
  const ep = getEndpoint()
  const res = await fetch(ep.url, {
    method: 'POST',
    headers: ep.headers,
    body: JSON.stringify({
      model: ep.model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.max_tokens ?? 256,
      stream: false,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`LLM request failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  const choice = data.choices?.[0]
  if (!choice) throw new Error('No response from LLM')

  return {
    content: choice.message.content,
    usage: data.usage,
  }
}

/** Send a streaming chat request, calls onToken for each chunk */
export async function chatStream(
  messages: ChatMessage[],
  onToken: (token: string) => void,
  options?: { temperature?: number; max_tokens?: number },
): Promise<void> {
  const ep = getEndpoint()
  const res = await fetch(ep.url, {
    method: 'POST',
    headers: ep.headers,
    body: JSON.stringify({
      model: ep.model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.max_tokens ?? 512,
      stream: true,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`LLM request failed (${res.status}): ${text}`)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6)
        if (data === '[DONE]') return

        try {
          const parsed = JSON.parse(data)
          const delta = parsed.choices?.[0]?.delta?.content
          if (delta) onToken(delta)
        } catch {}
      }
    }
  } finally {
    reader.cancel().catch(() => {})
  }
}

// ── Init lifecycle ──

/**
 * Full lifecycle: start local server → wait for ready → return status.
 * For cloud mode, just verify API key exists.
 */
export async function initLLM(
  onStatus?: (status: LLMStatus) => void,
): Promise<boolean> {
  if (_settings.mode === 'cloud') {
    if (_settings.apiKey) {
      onStatus?.('ready')
      console.log('[LLM] cloud mode ready')
      return true
    } else {
      onStatus?.('error')
      console.warn('[LLM] cloud mode but no API key')
      return false
    }
  }

  // Local mode
  onStatus?.('starting')

  try {
    const result = await startServer()
    console.log('[LLM] start:', result)

    if (result === 'already running') {
      const ok = await healthCheck()
      if (ok) {
        onStatus?.('ready')
        return true
      }
    }

    console.log('[LLM] waiting for server...')
    const ready = await waitForReady()
    if (ready) {
      onStatus?.('ready')
      console.log('[LLM] server ready')
      return true
    } else {
      onStatus?.('error')
      console.error('[LLM] server failed to start')
      return false
    }
  } catch (e) {
    onStatus?.('error')
    console.error('[LLM] init error:', e)
    return false
  }
}
