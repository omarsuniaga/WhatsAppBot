import { proto } from '@whiskeysockets/baileys';
import { existsSync, readFileSync, writeFileSync, renameSync, unlinkSync, statSync } from 'fs';

// Maximum messages stored per chat to prevent unbounded memory growth
const MAX_MESSAGES_PER_CHAT = 500;

export default function makeInMemoryStore({ logger }: { logger?: any }) {
    const chats = new Map<string, any>();
    const messages = new Map<string, any>();
    const contacts = new Map<string, any>();
    const state = { connection: 'close' };

    /**
     * Trim message array to MAX_MESSAGES_PER_CHAT, keeping the most recent ones.
     */
    function trimMessages(list: { array: any[] }): void {
        if (list.array.length > MAX_MESSAGES_PER_CHAT) {
            // Keep the last MAX_MESSAGES_PER_CHAT messages (most recent)
            const excess = list.array.length - MAX_MESSAGES_PER_CHAT;
            list.array.splice(0, excess);
        }
    }

    function loadMessage(jid: string, id: string) {
        if (messages.has(jid)) {
            const msgs = messages.get(jid);
            return msgs.array?.find((m: any) => m.key.id === id);
        }
        return null;
    }

    function bind(ev: any) {
        ev.on('connection.update', (update: any) => {
            Object.assign(state, update);
        });

        ev.on('messaging-history.set', ({ chats: newChats, contacts: newContacts, messages: newMessages, isLatest }: any) => {
            if (isLatest) {
                chats.clear();
                contacts.clear();
                messages.clear();
            }

            for (const chat of newChats) {
                chats.set(chat.id, { ...chats.get(chat.id), ...chat });
            }

            for (const contact of newContacts) {
                contacts.set(contact.id, { ...contacts.get(contact.id), ...contact });
            }

            for (const msg of newMessages) {
                const jid = msg.key.remoteJid;
                if (!messages.has(jid)) {
                    messages.set(jid, { array: [] });
                }
                const list = messages.get(jid);
                if (!list.array.some((m: any) => m.key.id === msg.key.id)) {
                    list.array.push(msg);
                }
                // LRU eviction: trim to MAX_MESSAGES_PER_CHAT
                trimMessages(list);
            }
            logger?.info({
                chats: newChats.length,
                contacts: newContacts.length,
                messages: newMessages.length
            }, 'messaging-history.set handled');
        });

        ev.on('chats.set', ({ chats: newChats, isLatest }: any) => {
            if (isLatest) {
                chats.clear();
            }
            const chatsAdded = isLatest ? newChats : newChats.reverse();
            for (const chat of chatsAdded) {
                chats.set(chat.id, { ...chats.get(chat.id), ...chat });
            }
        });

        ev.on('chats.upsert', (newChats: any[]) => {
            for (const chat of newChats) {
                chats.set(chat.id, { ...chats.get(chat.id), ...chat });
            }
        });

        ev.on('chats.update', (updates: any[]) => {
            for (const update of updates) {
                if (chats.has(update.id)) {
                    chats.set(update.id, { ...chats.get(update.id), ...update });
                }
            }
        });

        ev.on('chats.delete', (deletions: string[]) => {
            for (const id of deletions) {
                chats.delete(id);
            }
        });

        ev.on('contacts.set', ({ contacts: newContacts }: any) => {
            for (const contact of newContacts) {
                contacts.set(contact.id, { ...contacts.get(contact.id), ...contact });
            }
        });

        ev.on('contacts.upsert', (newContacts: any[]) => {
            for (const contact of newContacts) {
                contacts.set(contact.id, { ...contacts.get(contact.id), ...contact });
            }
        });

        ev.on('contacts.update', (updates: any[]) => {
            for (const update of updates) {
                if (contacts.has(update.id)) {
                    contacts.set(update.id, { ...contacts.get(update.id), ...update });
                }
            }
        });

        ev.on('messages.upsert', ({ messages: newMessages, type }: any) => {
            if (type === 'append' || type === 'notify') {
                for (const msg of newMessages) {
                    const jid = msg.key.remoteJid;
                    if (!messages.has(jid)) {
                        messages.set(jid, { array: [] });
                    }
                    const list = messages.get(jid);
                    // Check duplicate
                    if (!list.array.some((m: any) => m.key.id === msg.key.id)) {
                        list.array.push(msg);
                    }
                    // LRU eviction: trim to MAX_MESSAGES_PER_CHAT
                    trimMessages(list);
                }
            }
        });

        // Handle read receipts
        ev.on('messages.update', (updates: any[]) => {
            for (const { key, update } of updates) {
                const jid = key.remoteJid;
                if (messages.has(jid)) {
                    const list = messages.get(jid);
                    const msg = list.array.find((m: any) => m.key.id === key.id);
                    if (msg) {
                        Object.assign(msg, update);
                    }
                }
            }
        });
    }

    function readFromFile(path: string) {
        if (existsSync(path)) {
            // Size check: warn if file is very large
            try {
                const stats = statSync(path);
                const sizeMB = stats.size / (1024 * 1024);
                if (sizeMB > 50) {
                    logger?.warn({ path, sizeMB: sizeMB.toFixed(1) }, 'Store file very large, loading may be slow');
                }
                if (sizeMB > 200) {
                    logger?.error({ path, sizeMB: sizeMB.toFixed(1) }, 'Store file exceeds 200MB, skipping load to prevent OOM');
                    return;
                }
            } catch (statErr: any) {
                logger?.warn({ path, error: statErr.message }, 'Could not stat store file');
            }

            logger?.info({ path }, 'reading from file');
            const jsonStr = readFileSync(path, { encoding: 'utf-8' });
            const json = JSON.parse(jsonStr);
            if (json.chats) {
                for (const chat of json.chats) {
                    chats.set(chat.id, chat);
                }
            }
            if (json.contacts) {
                for (const contact of json.contacts) {
                    contacts.set(contact.id, contact);
                }
            }
            if (json.messages) {
                for (const jid in json.messages) {
                    const msgArray = json.messages[jid];
                    // Apply LRU limit when loading from file
                    const trimmedArray = Array.isArray(msgArray) && msgArray.length > MAX_MESSAGES_PER_CHAT
                        ? msgArray.slice(-MAX_MESSAGES_PER_CHAT)
                        : msgArray;
                    messages.set(jid, { array: trimmedArray });
                }
            }
        }
    }

    function writeToFile(path: string) {
        const json: any = { chats: [], contacts: [], messages: {} };
        for (const [id, chat] of chats) {
            json.chats.push(chat);
        }
        for (const [id, contact] of contacts) {
            json.contacts.push(contact);
        }
        for (const [jid, msgs] of messages) {
            json.messages[jid] = msgs.array;
        }
        // Atomic write: write to temp file, then rename
        const tmpPath = `${path}.tmp.${process.pid}`;
        try {
            writeFileSync(tmpPath, JSON.stringify(json), 'utf-8');
            renameSync(tmpPath, path);
        } catch (err) {
            try { unlinkSync(tmpPath); } catch (_) { /* ignore */ }
            throw err;
        }
    }

    return {
        chats,
        contacts,
        messages, // Expose Map directly
        state,
        bind,
        loadMessage,
        readFromFile,
        writeToFile,
    };
}
