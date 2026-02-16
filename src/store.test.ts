/**
 * In-Memory Store Unit Tests
 *
 * Tests the message store including LRU eviction to prevent
 * unbounded memory growth (critical for long-running bot processes).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import makeInMemoryStore from './store';

// ============================================
// Helper to create fake messages
// ============================================

function createMessage(jid: string, id: string, text: string = 'hello') {
    return {
        key: {
            remoteJid: jid,
            id,
            fromMe: false,
        },
        message: { conversation: text },
        messageTimestamp: Date.now(),
    };
}

function createEventEmitter() {
    const handlers: Record<string, Function[]> = {};
    return {
        on(event: string, handler: Function) {
            if (!handlers[event]) handlers[event] = [];
            handlers[event].push(handler);
        },
        emit(event: string, data: any) {
            for (const handler of handlers[event] || []) {
                handler(data);
            }
        },
    };
}

describe('makeInMemoryStore', () => {
    let store: ReturnType<typeof makeInMemoryStore>;
    let ev: ReturnType<typeof createEventEmitter>;

    beforeEach(() => {
        store = makeInMemoryStore({});
        ev = createEventEmitter();
        store.bind(ev);
    });

    // ============================================
    // Basic message storage
    // ============================================

    describe('Message storage', () => {
        it('should store messages from messages.upsert event', () => {
            const jid = '5511999999999@s.whatsapp.net';
            const msg = createMessage(jid, 'msg-001');

            ev.emit('messages.upsert', { messages: [msg], type: 'notify' });

            const loaded = store.loadMessage(jid, 'msg-001');
            expect(loaded).toBeDefined();
            expect(loaded.key.id).toBe('msg-001');
        });

        it('should not duplicate messages with same id', () => {
            const jid = '5511999999999@s.whatsapp.net';
            const msg = createMessage(jid, 'msg-001');

            ev.emit('messages.upsert', { messages: [msg], type: 'notify' });
            ev.emit('messages.upsert', { messages: [msg], type: 'notify' });

            // Internal check — there should be only 1 message
            const allMessages = (store.messages as any) instanceof Map ? (store.messages as any).get(jid)?.array : (store.messages as any)[jid]?.array;
            expect(allMessages || []).toHaveLength(1);
        });

        it('should store messages from messaging-history.set', () => {
            const jid = '5511999999999@s.whatsapp.net';
            const msg = createMessage(jid, 'history-001');

            ev.emit('messaging-history.set', {
                chats: [],
                contacts: [],
                messages: [msg],
                isLatest: false,
            });

            const loaded = store.loadMessage(jid, 'history-001');
            expect(loaded).toBeDefined();
        });

        it('should return null for non-existent message', () => {
            const loaded = store.loadMessage('5511999999999@s.whatsapp.net', 'nonexistent');
            expect(loaded).toBeNull();
        });

        it('should return null for non-existent jid', () => {
            const loaded = store.loadMessage('unknown@s.whatsapp.net', 'msg-001');
            expect(loaded).toBeNull();
        });
    });

    // ============================================
    // LRU Eviction (MAX_MESSAGES_PER_CHAT = 500)
    // ============================================

    describe('LRU Eviction', () => {
        it('should trim messages to 500 per chat on messages.upsert', () => {
            const jid = '5511999999999@s.whatsapp.net';

            // Insert 600 messages
            for (let i = 0; i < 600; i++) {
                const msg = createMessage(jid, `msg-${i.toString().padStart(4, '0')}`);
                ev.emit('messages.upsert', { messages: [msg], type: 'notify' });
            }

            const allMessages = store.messages[jid]?.array || [];
            expect(allMessages.length).toBeLessThanOrEqual(500);
        });

        it('should keep the most recent messages (not oldest)', () => {
            const jid = '5511999999999@s.whatsapp.net';

            // Insert 550 messages
            for (let i = 0; i < 550; i++) {
                const msg = createMessage(jid, `msg-${i.toString().padStart(4, '0')}`);
                ev.emit('messages.upsert', { messages: [msg], type: 'notify' });
            }

            const allMessages = store.messages[jid]?.array || [];

            // First message in store should NOT be msg-0000 (that was evicted)
            // It should be around msg-0050 (keeping the last 500)
            const firstId = allMessages[0]?.key.id;
            expect(firstId).not.toBe('msg-0000');

            // Last message should be msg-0549
            const lastId = allMessages[allMessages.length - 1]?.key.id;
            expect(lastId).toBe('msg-0549');
        });

        it('should trim on messaging-history.set as well', () => {
            const jid = '5511999999999@s.whatsapp.net';

            // Send a batch of 600 messages via history sync
            const messages: any[] = [];
            for (let i = 0; i < 600; i++) {
                messages.push(createMessage(jid, `hist-${i.toString().padStart(4, '0')}`));
            }

            ev.emit('messaging-history.set', {
                chats: [],
                contacts: [],
                messages,
                isLatest: false,
            });

            const allMessages = store.messages[jid]?.array || [];
            expect(allMessages.length).toBeLessThanOrEqual(500);
        });

        it('should not trim when under 500 messages', () => {
            const jid = '5511999999999@s.whatsapp.net';

            // Insert exactly 100 messages
            for (let i = 0; i < 100; i++) {
                const msg = createMessage(jid, `msg-${i}`);
                ev.emit('messages.upsert', { messages: [msg], type: 'notify' });
            }

            const allMessages = store.messages[jid]?.array || [];
            expect(allMessages.length).toBe(100);
        });

        it('should handle multiple chats independently', () => {
            const jid1 = '111@s.whatsapp.net';
            const jid2 = '222@s.whatsapp.net';

            // 600 messages to jid1, 10 to jid2
            for (let i = 0; i < 600; i++) {
                ev.emit('messages.upsert', {
                    messages: [createMessage(jid1, `msg1-${i}`)],
                    type: 'notify',
                });
            }
            for (let i = 0; i < 10; i++) {
                ev.emit('messages.upsert', {
                    messages: [createMessage(jid2, `msg2-${i}`)],
                    type: 'notify',
                });
            }

            expect((store.messages[jid1]?.array || []).length).toBeLessThanOrEqual(500);
            expect((store.messages[jid2]?.array || []).length).toBe(10);
        });
    });

    // ============================================
    // Chat management
    // ============================================

    describe('Chat management', () => {
        it('should store chats from chats.upsert', () => {
            ev.emit('chats.upsert', [{ id: 'chat-1', name: 'Test Chat' }]);
            expect(store.chats.get('chat-1')).toBeDefined();
            expect(store.chats.get('chat-1').name).toBe('Test Chat');
        });

        it('should update chats from chats.update', () => {
            ev.emit('chats.upsert', [{ id: 'chat-1', name: 'Old Name' }]);
            ev.emit('chats.update', [{ id: 'chat-1', name: 'New Name' }]);
            expect(store.chats.get('chat-1').name).toBe('New Name');
        });

        it('should delete chats from chats.delete', () => {
            ev.emit('chats.upsert', [{ id: 'chat-1', name: 'To Delete' }]);
            expect(store.chats.has('chat-1')).toBe(true);

            ev.emit('chats.delete', ['chat-1']);
            expect(store.chats.has('chat-1')).toBe(false);
        });

        it('should clear chats when isLatest is true in chats.set', () => {
            ev.emit('chats.upsert', [{ id: 'old-chat', name: 'Old' }]);
            ev.emit('chats.set', { chats: [{ id: 'new-chat', name: 'New' }], isLatest: true });

            expect(store.chats.has('old-chat')).toBe(false);
            expect(store.chats.has('new-chat')).toBe(true);
        });
    });

    // ============================================
    // Contact management
    // ============================================

    describe('Contact management', () => {
        it('should store contacts from contacts.set', () => {
            ev.emit('contacts.set', {
                contacts: [{ id: 'contact-1', name: 'John Doe' }],
            });
            expect(store.contacts.get('contact-1')).toBeDefined();
        });

        it('should upsert contacts', () => {
            ev.emit('contacts.upsert', [{ id: 'contact-1', name: 'Jane' }]);
            expect(store.contacts.get('contact-1').name).toBe('Jane');
        });

        it('should update existing contacts', () => {
            ev.emit('contacts.upsert', [{ id: 'contact-1', name: 'Original' }]);
            ev.emit('contacts.update', [{ id: 'contact-1', name: 'Updated' }]);
            expect(store.contacts.get('contact-1').name).toBe('Updated');
        });
    });

    // ============================================
    // Message updates (read receipts)
    // ============================================

    describe('Message updates', () => {
        it('should update message status on messages.update', () => {
            const jid = '5511999999999@s.whatsapp.net';
            const msg = createMessage(jid, 'msg-001');
            ev.emit('messages.upsert', { messages: [msg], type: 'notify' });

            ev.emit('messages.update', [
                { key: { remoteJid: jid, id: 'msg-001' }, update: { status: 3 } },
            ]);

            const loaded = store.loadMessage(jid, 'msg-001');
            expect(loaded.status).toBe(3); // 3 = read
        });

        it('should ignore updates for non-existent messages', () => {
            // Should not throw
            ev.emit('messages.update', [
                { key: { remoteJid: 'unknown@s.whatsapp.net', id: 'nope' }, update: { status: 3 } },
            ]);
        });
    });

    // ============================================
    // Connection state
    // ============================================

    describe('Connection state', () => {
        it('should track connection state', () => {
            expect(store.state.connection).toBe('close');

            ev.emit('connection.update', { connection: 'open' });
            expect(store.state.connection).toBe('open');
        });
    });

    // ============================================
    // messaging-history.set with isLatest
    // ============================================

    describe('messaging-history.set isLatest flag', () => {
        it('should clear all data when isLatest is true', () => {
            // Pre-populate
            ev.emit('chats.upsert', [{ id: 'old-chat' }]);
            ev.emit('contacts.upsert', [{ id: 'old-contact' }]);
            ev.emit('messages.upsert', {
                messages: [createMessage('old@s.whatsapp.net', 'old-msg')],
                type: 'notify',
            });

            expect(store.chats.size).toBe(1);
            expect(store.contacts.size).toBe(1);

            // Now emit history with isLatest = true → clears everything
            ev.emit('messaging-history.set', {
                chats: [{ id: 'new-chat' }],
                contacts: [{ id: 'new-contact' }],
                messages: [createMessage('new@s.whatsapp.net', 'new-msg')],
                isLatest: true,
            });

            expect(store.chats.has('old-chat')).toBe(false);
            expect(store.chats.has('new-chat')).toBe(true);
            expect(store.contacts.has('old-contact')).toBe(false);
            expect(store.contacts.has('new-contact')).toBe(true);
        });
    });
});
