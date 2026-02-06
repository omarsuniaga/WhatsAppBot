import { proto } from '@whiskeysockets/baileys';
import { existsSync, readFileSync, writeFileSync } from 'fs';

export default function makeInMemoryStore({ logger }: { logger?: any }) {
    const chats = new Map<string, any>();
    const messages = new Map<string, any>();
    const contacts = new Map<string, any>();
    const state = { connection: 'close' };

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
                    messages.set(jid, { array: json.messages[jid] });
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
        writeFileSync(path, JSON.stringify(json, null, 2));
    }

    return {
        chats,
        contacts,
        messages: Object.fromEntries(messages), // Expose mostly as object for compatibility
        state,
        bind,
        loadMessage,
        readFromFile,
        writeToFile,
    };
}
