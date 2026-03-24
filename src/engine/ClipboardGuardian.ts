// Clipboard Guardian / Backpack Engine
// Monitors clipboard changes and maintains a visual backpack history

import { invoke } from '@tauri-apps/api/core'

export interface ClipboardItem {
  id: number
  content_type: string
  content: string
  preview_text: string
  is_pinned: boolean
  timestamp: number
}

interface ClipboardChange {
  changed: boolean
  content_type: string
  text: string
  preview: string
}

export class ClipboardGuardian {
  private _enabled: boolean = true
  private _items: ClipboardItem[] = []
  private _onCatch?: () => void        // fired when new item caught
  private _onCountChange?: (count: number) => void

  get enabled(): boolean { return this._enabled }
  set enabled(v: boolean) { this._enabled = v }

  get items(): ClipboardItem[] { return this._items }
  get count(): number { return this._items.length }
  get pinnedCount(): number { return this._items.filter(i => i.is_pinned).length }

  onCatch(cb: () => void) { this._onCatch = cb }
  onCountChange(cb: (count: number) => void) { this._onCountChange = cb }

  /** Load history from DB on startup */
  async load() {
    try {
      this._items = await invoke<ClipboardItem[]>('query_clipboard_history')
      this._onCountChange?.(this.count)
    } catch (e) {
      console.warn('[Clipboard] load error:', e)
    }
  }

  /** Poll clipboard for changes. Call every 500ms. */
  async poll() {
    if (!this._enabled) return

    try {
      const change = await invoke<ClipboardChange>('poll_clipboard')
      if (!change.changed) return

      // Store in DB
      await invoke('insert_clipboard_item', {
        contentType: change.content_type,
        content: change.text,
        previewText: change.preview,
      })

      // Reload history
      await this.load()

      // Fire catch animation
      this._onCatch?.()

      console.log('[Clipboard] caught:', change.content_type, change.preview.slice(0, 30))
    } catch (e) {
      console.warn('[Clipboard] poll error:', e)
    }
  }

  /** Copy an item back to system clipboard */
  async pasteItem(item: ClipboardItem) {
    try {
      await invoke('set_clipboard_text', { text: item.content })
    } catch (e) {
      console.error('[Clipboard] paste error:', e)
    }
  }

  /** Toggle pin status */
  async togglePin(id: number) {
    try {
      await invoke('toggle_clipboard_pin', { id })
      await this.load()
    } catch (e) {
      console.error('[Clipboard] pin error:', e)
    }
  }

  /** Delete a single item */
  async deleteItem(id: number) {
    try {
      await invoke('delete_clipboard_item', { id })
      await this.load()
    } catch (e) {
      console.error('[Clipboard] delete error:', e)
    }
  }

  /** Clean up expired items (default: 24h) */
  async cleanExpired(maxAgeMs: number = 24 * 60 * 60 * 1000) {
    try {
      await invoke('clear_expired_clipboard', { maxAgeMs })
      await this.load()
    } catch {}
  }

  /** Search items by text content */
  search(query: string): ClipboardItem[] {
    if (!query.trim()) return this._items
    const q = query.toLowerCase()
    return this._items.filter(item =>
      item.content.toLowerCase().includes(q) ||
      item.preview_text.toLowerCase().includes(q)
    )
  }
}
