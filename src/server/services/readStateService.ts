/**
 * ReadStateService - Single Source of Truth for Chat Read State
 * 
 * This service persists the read state (lastReadTimestamp) per chat to prevent
 * unread badges from reappearing after sync/refresh.
 * 
 * Key principles:
 * - lastReadTimestamp is the authoritative source for "read" state
 * - Unread count = messages with timestamp > lastReadTimestamp
 * - This state survives refreshes and syncs
 */

import * as fs from 'fs';
import * as path from 'path';
import { writeFileSyncAtomic } from '../utils/atomicWrite';

interface ChatReadState {
    jid: string;
    lastReadTimestamp: number;      // Unix timestamp (seconds) of last read message
    lastReadMessageId?: string;     // Optional: ID of last read message
    updatedAt: string;              // ISO timestamp of when this was updated
}

interface ReadStateStore {
    version: number;
    states: Record<string, ChatReadState>;
}

class ReadStateService {
    private static instance: ReadStateService;
    private states: Map<string, ChatReadState> = new Map();
    private dataDir: string;
    private dataFile: string;
    private saveTimeout: NodeJS.Timeout | null = null;
    private readonly SAVE_DELAY_MS = 1000; // Debounce saves

    private constructor() {
        this.dataDir = path.join(process.cwd(), 'data');
        this.dataFile = path.join(this.dataDir, 'read-states.json');
        this.ensureDataDir();
        this.loadFromDisk();
    }

    static getInstance(): ReadStateService {
        if (!ReadStateService.instance) {
            ReadStateService.instance = new ReadStateService();
        }
        return ReadStateService.instance;
    }

    private ensureDataDir(): void {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
    }

    private loadFromDisk(): void {
        try {
            if (fs.existsSync(this.dataFile)) {
                const data = fs.readFileSync(this.dataFile, 'utf-8');
                const store: ReadStateStore = JSON.parse(data);
                
                for (const [jid, state] of Object.entries(store.states)) {
                    this.states.set(jid, state);
                }
                
                console.log(`[ReadStateService] Loaded ${this.states.size} chat read states`);
            }
        } catch (error) {
            console.error('[ReadStateService] Error loading read states:', error);
        }
    }

    private scheduleSave(): void {
        // Debounce saves to avoid excessive disk writes
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        
        this.saveTimeout = setTimeout(() => {
            this.saveToDisk();
        }, this.SAVE_DELAY_MS);
    }

    private saveToDisk(): void {
        try {
            const store: ReadStateStore = {
                version: 1,
                states: Object.fromEntries(this.states)
            };
            
            writeFileSyncAtomic(this.dataFile, JSON.stringify(store, null, 2));
        } catch (error) {
            console.error('[ReadStateService] Error saving read states:', error);
        }
    }

    /**
     * Mark a chat as read up to a specific timestamp
     * 
     * @param jid - Chat JID
     * @param timestamp - Unix timestamp (seconds) of the last read message
     * @param messageId - Optional message ID
     */
    markAsRead(jid: string, timestamp: number, messageId?: string): void {
        const existing = this.states.get(jid);
        
        // Only update if this timestamp is newer than what we have
        // This prevents older sync data from overwriting newer local state
        if (existing && existing.lastReadTimestamp >= timestamp) {
            return;
        }

        const state: ChatReadState = {
            jid,
            lastReadTimestamp: timestamp,
            lastReadMessageId: messageId,
            updatedAt: new Date().toISOString()
        };

        this.states.set(jid, state);
        this.scheduleSave();
        
        console.log(`[ReadStateService] Marked ${jid} as read up to ${timestamp}`);
    }

    /**
     * Mark a chat as read using the current time
     * Use this when opening a chat or scrolling to bottom
     */
    markAsReadNow(jid: string): number {
        const timestamp = Math.floor(Date.now() / 1000);
        this.markAsRead(jid, timestamp);
        return timestamp;
    }

    /**
     * Get the last read timestamp for a chat
     */
    getLastReadTimestamp(jid: string): number | null {
        return this.states.get(jid)?.lastReadTimestamp || null;
    }

    /**
     * Get the read state for a chat
     */
    getReadState(jid: string): ChatReadState | null {
        return this.states.get(jid) || null;
    }

    /**
     * Calculate unread count based on messages and last read timestamp
     * 
     * @param jid - Chat JID
     * @param messages - Array of messages with timestamp property
     * @returns Unread count
     */
    calculateUnreadCount(jid: string, messages: Array<{ timestamp: number; fromMe: boolean }>): number {
        const lastReadTimestamp = this.getLastReadTimestamp(jid);
        
        // If never read, all non-fromMe messages are unread
        if (!lastReadTimestamp) {
            return messages.filter(m => !m.fromMe).length;
        }

        // Count messages newer than lastReadTimestamp that are not from me
        return messages.filter(m => 
            !m.fromMe && m.timestamp > lastReadTimestamp
        ).length;
    }

    /**
     * Get unread count for a chat given the chat's last message timestamp
     * and total messages from backend
     * 
     * This is used when merging backend data with local state
     */
    shouldOverrideUnreadCount(jid: string, backendUnreadCount: number, lastMessageTimestamp?: number): {
        override: boolean;
        unreadCount: number;
    } {
        const lastReadTimestamp = this.getLastReadTimestamp(jid);
        
        // No local read state, trust backend
        if (!lastReadTimestamp) {
            return { override: false, unreadCount: backendUnreadCount };
        }

        // If we have read state and last message is older than our read timestamp,
        // the chat should have 0 unread
        if (lastMessageTimestamp && lastMessageTimestamp <= lastReadTimestamp) {
            return { override: true, unreadCount: 0 };
        }

        // If backend says 0 but we have a read state, trust our state (keep 0)
        if (backendUnreadCount === 0) {
            return { override: false, unreadCount: 0 };
        }

        // If we have a recent read state (within last minute), prefer 0
        // This handles race conditions where we just marked as read but backend hasn't synced
        const oneMinuteAgo = Math.floor(Date.now() / 1000) - 60;
        if (lastReadTimestamp > oneMinuteAgo) {
            return { override: true, unreadCount: 0 };
        }

        // Otherwise trust backend
        return { override: false, unreadCount: backendUnreadCount };
    }

    /**
     * Get all read states (for debugging/export)
     */
    getAllStates(): Map<string, ChatReadState> {
        return new Map(this.states);
    }

    /**
     * Clear read state for a chat (for testing)
     */
    clearState(jid: string): void {
        this.states.delete(jid);
        this.scheduleSave();
    }

    /**
     * Clear all states (for testing)
     */
    clearAllStates(): void {
        this.states.clear();
        this.scheduleSave();
    }
}

export default ReadStateService;
