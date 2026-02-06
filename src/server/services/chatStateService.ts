/**
 * ChatStateService - Server-side chat state management
 * 
 * CRITICAL: This service is the SINGLE SOURCE OF TRUTH for:
 * - unreadCount per chat
 * - lastMessageAt timestamp
 * - lastReadAt timestamp
 * 
 * WHY: Calculating unreadCount from full message history on every refresh
 * causes inflated counts (~86 instead of ~3). This service tracks state
 * incrementally and persists to disk.
 */

import * as fs from 'fs';
import * as path from 'path';
import { toStableKey } from '../utils/jidUtils';

interface ChatState {
    unreadCount: number;
    lastMessageAt: number | null;  // Unix timestamp
    lastReadAt: number | null;     // Unix timestamp
    displayName: string | null;    // From pushName
    updatedAt: string;             // ISO timestamp
}

interface ChatStateStore {
    version: number;
    states: Record<string, ChatState>;
}

class ChatStateService {
    private static instance: ChatStateService;
    private states: Map<string, ChatState> = new Map();
    private dataFile: string;
    private saveTimeout: NodeJS.Timeout | null = null;
    private readonly SAVE_DEBOUNCE_MS = 2000;

    private constructor() {
        this.dataFile = path.join(process.cwd(), 'data', 'chat-state.json');
        this.loadFromDisk();
    }

    static getInstance(): ChatStateService {
        if (!ChatStateService.instance) {
            ChatStateService.instance = new ChatStateService();
        }
        return ChatStateService.instance;
    }

    private loadFromDisk(): void {
        try {
            if (fs.existsSync(this.dataFile)) {
                const data = fs.readFileSync(this.dataFile, 'utf-8');
                const store: ChatStateStore = JSON.parse(data);
                
                this.states = new Map(Object.entries(store.states || {}));
                console.log(`[ChatState] Loaded ${this.states.size} chat states from disk`);
            }
        } catch (error) {
            console.error('[ChatState] Error loading from disk:', error);
            this.states = new Map();
        }
    }

    private scheduleSave(): void {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.saveTimeout = setTimeout(() => this.saveToDisk(), this.SAVE_DEBOUNCE_MS);
    }

    private saveToDisk(): void {
        try {
            const dir = path.dirname(this.dataFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const store: ChatStateStore = {
                version: 1,
                states: Object.fromEntries(this.states)
            };

            fs.writeFileSync(this.dataFile, JSON.stringify(store, null, 2));
        } catch (error) {
            console.error('[ChatState] Error saving to disk:', error);
        }
    }

    /**
     * Get or create chat state for a JID.
     * Always uses stableKey internally.
     */
    getState(rawJid: string): ChatState | null {
        const key = toStableKey(rawJid);
        if (!key) {
            console.warn(`[ChatState] Invalid JID for getState: "${rawJid}"`);
            return null;
        }
        
        return this.states.get(key) || null;
    }

    /**
     * Get unread count for a chat.
     * Returns 0 if chat not found.
     */
    getUnreadCount(rawJid: string): number {
        const state = this.getState(rawJid);
        return state?.unreadCount || 0;
    }

    /**
     * Called when a new INBOUND message arrives.
     * Increments unread count if chat is not currently being viewed.
     * 
     * @param rawJid - JID of the chat
     * @param messageTimestamp - Unix timestamp of the message
     * @param isCurrentlyViewing - True if user has this chat open
     */
    onInboundMessage(rawJid: string, messageTimestamp: number, isCurrentlyViewing: boolean = false): void {
        const key = toStableKey(rawJid);
        if (!key) {
            console.warn(`[ChatState] Invalid JID for onInboundMessage: "${rawJid}"`);
            return;
        }

        const existing = this.states.get(key);
        const now = new Date().toISOString();

        if (existing) {
            existing.lastMessageAt = messageTimestamp;
            existing.updatedAt = now;
            
            // Only increment unread if not currently viewing
            if (!isCurrentlyViewing) {
                existing.unreadCount++;
            }
        } else {
            this.states.set(key, {
                unreadCount: isCurrentlyViewing ? 0 : 1,
                lastMessageAt: messageTimestamp,
                lastReadAt: null,
                displayName: null,
                updatedAt: now
            });
        }

        console.log(`[ChatState] Inbound message: key=${key} unread=${this.states.get(key)?.unreadCount} viewing=${isCurrentlyViewing}`);
        this.scheduleSave();
    }

    /**
     * Called when user marks a chat as read.
     * Resets unread count to 0.
     * 
     * @param rawJid - JID of the chat (can be raw format)
     */
    markAsRead(rawJid: string): void {
        const key = toStableKey(rawJid);
        if (!key) {
            console.warn(`[ChatState] Invalid JID for markAsRead: "${rawJid}"`);
            return;
        }

        const existing = this.states.get(key);
        const now = Math.floor(Date.now() / 1000);
        const nowISO = new Date().toISOString();

        if (existing) {
            existing.unreadCount = 0;
            existing.lastReadAt = now;
            existing.updatedAt = nowISO;
        } else {
            this.states.set(key, {
                unreadCount: 0,
                lastMessageAt: null,
                lastReadAt: now,
                displayName: null,
                updatedAt: nowISO
            });
        }

        console.log(`[ChatState] Marked as read: key=${key}`);
        this.scheduleSave();
    }

    /**
     * Update display name for a chat.
     * Called when we receive a pushName from a message.
     */
    setDisplayName(rawJid: string, displayName: string): void {
        const key = toStableKey(rawJid);
        if (!key) return;

        const existing = this.states.get(key);
        const now = new Date().toISOString();

        if (existing) {
            existing.displayName = displayName;
            existing.updatedAt = now;
        } else {
            this.states.set(key, {
                unreadCount: 0,
                lastMessageAt: null,
                lastReadAt: null,
                displayName,
                updatedAt: now
            });
        }

        this.scheduleSave();
    }

    /**
     * Get display name for a chat.
     */
    getDisplayName(rawJid: string): string | null {
        const state = this.getState(rawJid);
        return state?.displayName || null;
    }

    /**
     * Get all chat states for building chat list.
     * Returns a map of stableKey -> ChatState
     */
    getAllStates(): Map<string, ChatState> {
        return new Map(this.states);
    }

    /**
     * Initialize state for a chat if not exists.
     * Useful when building chat list from Baileys store.
     */
    ensureState(rawJid: string): void {
        const key = toStableKey(rawJid);
        if (!key) return;

        if (!this.states.has(key)) {
            this.states.set(key, {
                unreadCount: 0,
                lastMessageAt: null,
                lastReadAt: null,
                displayName: null,
                updatedAt: new Date().toISOString()
            });
        }
    }

    /**
     * Force save to disk (for shutdown).
     */
    forceSave(): void {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.saveToDisk();
    }

    /**
     * Debug: Get count of tracked chats.
     */
    getCount(): number {
        return this.states.size;
    }
}

export default ChatStateService;
