import { Request, Response } from 'express';
import Logger from '../services/loggerService';
import BotService from '../services/botService';
import ProfileCacheService from '../services/profileCacheService';
import ReadStateService from '../services/readStateService';
import ContactStoreService from '../services/contactStoreService';
import ChatStateService from '../services/chatStateService';
import { normalizeRawJid, toStableKey, isGroupJid, extractPhoneNumber } from '../utils/jidUtils';
import { BotOrchestrator } from '../../agents/BotOrchestrator';
import { getErrorMessage } from '../utils/errorUtils';

const profileCacheService = ProfileCacheService.getInstance();
const readStateService = ReadStateService.getInstance();
const contactStoreService = ContactStoreService.getInstance();
const chatStateService = ChatStateService.getInstance();

const getLastMessageText = (message: any): string => {
    if (!message?.message) return '';
    const msg = message.message;
    return msg.conversation ||
        msg.extendedTextMessage?.text ||
        msg.imageMessage?.caption ||
        msg.videoMessage?.caption ||
        (msg.imageMessage ? 'ðŸ“· Foto' : '') ||
        (msg.videoMessage ? 'ðŸŽ¥ Video' : '') ||
        (msg.audioMessage ? 'ðŸŽ¤ Audio' : '') ||
        (msg.stickerMessage ? 'ðŸŽ¨ Sticker' : '') ||
        (msg.documentMessage ? 'ðŸ“„ Documento' : '') ||
        (msg.locationMessage ? 'ðŸ“ UbicaciÃ³n' : '') ||
        '';
};

export const getChats = async (req: Request, res: Response): Promise<void> => {
    try {
        const botService = BotService.getInstance();
        const store = botService.getStore();

        // âœ… OPTIMIZATION: Add pagination support
        const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
        const offset = parseInt(req.query.offset as string) || 0;

        if (!store) {
            res.status(503).json({
                success: false,
                error: 'Bot not initialized or store not available'
            });
            return;
        }

        const chats: any[] = [];
        const seenJids = new Set<string>();

        // âœ… OPTIMIZATION: Removed pre-populate message scan
        // This was O(n*20) complexity - scanning 20 messages per chat
        // Was causing 400-800ms delay in API response
        // Display names are resolved later in Method 2 & 3 anyway

        // âœ… OPTIMIZATION: Removed synchronous refreshContacts()
        // This was blocking the request
        // Contacts are refreshed in the background by BotService

        // Pre-load all contacts from store for better name resolution
        const allStoreContacts = store.contacts || {};
        let contactsArray: any[] = [];
        if (allStoreContacts instanceof Map) {
            contactsArray = Array.from(allStoreContacts.values());
        } else if (Array.isArray(allStoreContacts)) {
            contactsArray = allStoreContacts;
        } else if (typeof allStoreContacts === 'object') {
            contactsArray = Object.values(allStoreContacts);
        }

        // Create a mapping of phone numbers to contact info for quick lookup
        const contactMap = new Map();
        for (const contact of contactsArray) {
            if (contact && contact.id) {
                const phoneNumber = contact.id.split('@')[0];
                contactMap.set(phoneNumber, contact);
            }
        }

        // Method 1: Get from chats store
        const chatsMap = store.chats;
        if (chatsMap) {
            let allChats: any[] = [];
            if (typeof chatsMap.all === 'function') allChats = chatsMap.all();
            else if (chatsMap instanceof Map) allChats = Array.from(chatsMap.values());
            else if (typeof chatsMap.toJSON === 'function') allChats = Object.values(chatsMap.toJSON());
            else if (typeof chatsMap === 'object') allChats = Object.values(chatsMap);

            for (const chat of allChats) {
                if (!chat || !chat.id || seenJids.has(chat.id)) continue;
                seenJids.add(chat.id);

                const phoneNumber = chat.id?.split('@')[0];
                const isGroup = chat.id?.includes('@g.us');

                // Enhanced name resolution for contacts
                let displayName = 'Unknown';

                if (isGroup) {
                    // For groups, use subject or name
                    displayName = chat.subject || chat.name || `Group ${phoneNumber}`;
                } else {
                    // For individual contacts, try multiple sources in order of priority

                    // 1. Try to get from contact map (store.contacts)
                    const contactFromMap = contactMap.get(phoneNumber);
                    if (contactFromMap) {
                        displayName = contactFromMap.name ||
                            contactFromMap.pushName ||
                            contactFromMap.verifiedName ||
                            contactFromMap.formattedName ||
                            contactFromMap.notify ||
                            `+${phoneNumber}`;
                    }

                    // 2. Try direct chat properties
                    if (displayName === 'Unknown') {
                        displayName = chat.name ||
                            chat.pushName ||
                            chat.verifiedName ||
                            chat.formattedName ||
                            chat.notify ||
                            `+${phoneNumber}`;
                    }

                    // 3. Try to get from last message pushName
                    const messages = store.messages?.get?.(chat.id);
                    if (displayName === 'Unknown' && messages?.array?.length > 0) {
                        const lastMessage = messages.array[messages.array.length - 1];
                        if (lastMessage?.pushName) {
                            displayName = lastMessage.pushName;
                        }
                    }
                }

                // Get group metadata if it's a group
                let groupMetadata: any = null;
                let memberCount = 0;

                if (isGroup) {
                    try {
                        // âœ… OPTIMIZATION: Add timeout to group metadata fetch
                        // Prevents slow groups from blocking the entire API response
                        const metadataPromise = botService.getGroupMetadata(chat.id);
                        const timeoutPromise = new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('Timeout')), 2000)
                        );

                        groupMetadata = await Promise.race([
                            metadataPromise,
                            timeoutPromise
                        ]);
                        memberCount = groupMetadata?.participants?.length || 0;

                        // Update display name with metadata if available
                        if (groupMetadata?.subject) {
                            displayName = groupMetadata.subject;
                        }
                    } catch (error) {
                        // Group metadata might not be available or timed out
                        Logger.warn(`Could not get metadata for group ${chat.id}:`, (error as any).message);
                    }
                }

                // DO NOT calculate unreadCount from message history!
                // ChatStateService is the SINGLE SOURCE OF TRUTH for unread counts.
                // Calculating from history causes inflated counts (e.g., 86 instead of 3).

                chats.push({
                    jid: chat.id,
                    name: displayName,
                    unreadCount: 0, // Placeholder - will be set from ChatStateService later
                    lastMessageTime: chat.conversationTimestamp,
                    isGroup,
                    memberCount,
                    groupDesc: groupMetadata?.desc,
                    groupOwner: groupMetadata?.owner,
                    groupCreation: groupMetadata?.creation
                });
            }
        }

        // Method 2: Get from messages store
        const messagesStore = store.messages;
        if (messagesStore) {
            const existingPhones = new Set(chats.map(c => c.jid.split('@')[0]));
            const messageJids = messagesStore instanceof Map
                ? Array.from(messagesStore.keys())
                : Object.keys(messagesStore);

            for (const jid of messageJids) {
                if (jid === 'status@broadcast') continue;

                const phoneNumber = jid.split('@')[0];
                if (existingPhones.has(phoneNumber)) continue;
                existingPhones.add(phoneNumber);

                const messages = messagesStore instanceof Map ? messagesStore.get(jid) : messagesStore[jid];
                const msgArray = messages?.array || messages;
                const lastMsg = Array.isArray(msgArray) ? msgArray[msgArray.length - 1] : null;

                // Normalize JID to @s.whatsapp.net format
                const normalizedJid = jid.includes('@lid')
                    ? `${phoneNumber}@s.whatsapp.net`
                    : jid;

                const isGroup = jid.includes('@g.us');
                let displayName = 'Unknown';

                // Calculate unread count (Status: 0=pending, 1=sent, 2=delivered, 3=read, 4=error)
                const unreadCount = Array.isArray(msgArray)
                    ? msgArray.filter((msg: any) =>
                        msg.key?.fromMe === false &&
                        msg.message &&
                        msg.status !== 3 // 3 = read
                    ).length
                    : 0;

                // Enhanced name resolution for messages-based contacts
                if (isGroup) {
                    displayName = lastMsg?.pushName || `Group ${phoneNumber}`;
                } else {
                    // Try multiple sources for individual contacts

                    // 1. Try contact map first
                    const contactFromMap = contactMap.get(phoneNumber);
                    if (contactFromMap) {
                        displayName = contactFromMap.name ||
                            contactFromMap.pushName ||
                            contactFromMap.verifiedName ||
                            contactFromMap.formattedName ||
                            contactFromMap.notify ||
                            `+${phoneNumber}`;
                    }

                    // 2. Try direct contact from store
                    const contact = store.contacts instanceof Map ? store.contacts.get(normalizedJid) : store.contacts?.[normalizedJid];
                    if (displayName === 'Unknown' && contact) {
                        displayName = contact.name || contact.pushName || contact.notify ||
                            contact.verifiedName || contact.formattedName ||
                            `+${phoneNumber}`;
                    }

                    // 3. Try from last message
                    if (displayName === 'Unknown') {
                        displayName = lastMsg?.pushName || `+${phoneNumber}`;
                    }
                }

                Logger.info(`Messages-based contact ${normalizedJid}: Display name resolved to "${displayName}", unread: ${unreadCount}`);

                chats.push({
                    jid: normalizedJid,
                    name: displayName,
                    unreadCount,
                    lastMessageTime: lastMsg?.messageTimestamp,
                    isGroup: jid.includes('@g.us'),
                    botActive: botService.isBotActive(normalizedJid)
                });
            }
        }

        // Method 3: Get from session files
        const sessionContacts = await botService.getContactsFromSession();
        for (const contact of sessionContacts) {
            if (seenJids.has(contact.jid)) continue;
            seenJids.add(contact.jid);
            chats.push({
                jid: contact.jid,
                name: contact.name,
                unreadCount: 0,
                lastMessageTime: null,
                isGroup: contact.isGroup,
            });
        }

        let finalChats = chats.filter(c => c.jid !== 'status@broadcast');

        // Use cached profile pictures
        const jids = finalChats.map(chat => chat.jid);
        const profilePicMap = await profileCacheService.getMultipleProfilePics(jids);

        let chatIndex = 0;
        finalChats = finalChats.map(chat => {
            // CRITICAL: Normalize JID and get stable key
            const normalizedJid = normalizeRawJid(chat.jid);
            const stableKey = toStableKey(chat.jid) || `unknown-${chatIndex}`; // Never null
            const phoneNum = extractPhoneNumber(chat.jid);

            // Debug: Log JID normalization for first few chats
            if (chatIndex < 3) {
                Logger.info(`[ChatController] JID: raw="${chat.jid}" normalized="${normalizedJid}" stableKey="${stableKey}"`);
            }

            // Find messages using multiple possible JID formats
            const possibleJids = [chat.jid];
            if (normalizedJid && normalizedJid !== chat.jid) possibleJids.push(normalizedJid);
            if (phoneNum) {
                possibleJids.push(`${phoneNum}@lid`, `${phoneNum}@s.whatsapp.net`, `${phoneNum}@c.us`);
            }

            let lastMsg: any = null;
            for (const tryJid of possibleJids) {
                const msgs = store.messages instanceof Map ? store.messages.get(tryJid) : store.messages[tryJid];
                if (msgs?.array?.length > 0) {
                    lastMsg = msgs.array.slice(-1)[0];
                    break;
                }
            }

            // Get last message sender info for groups
            let lastMessageSender: { jid: string; name: string } | null = null;
            if (chat.isGroup && lastMsg && !(lastMsg as any).key?.fromMe) {
                const msgKey = (lastMsg as any).key;
                const senderJid = msgKey?.participant || '';
                lastMessageSender = {
                    jid: senderJid,
                    name: contactStoreService.getDisplayNameWithFallback(senderJid, (lastMsg as any).pushName)
                };
            }

            // Get displayName from ContactStore using stableKey
            // This is the SINGLE SOURCE OF TRUTH for stable names.
            const chatNameIsReal = chat.name &&
                chat.name !== 'Unknown' &&
                !/^\+?\d+$/.test(chat.name);

            const displayName = contactStoreService.getDisplayNameWithFallback(
                chat.jid,
                chatNameIsReal ? chat.name : undefined
            );

            // Get unreadCount from ChatStateService (NOT from message history!)
            // This prevents inflated counts from recalculating full history
            const unreadCount = chatStateService.getUnreadCount(chat.jid);

            // Debug log for first few chats
            if (chatIndex < 3) {
                Logger.info(`[ChatController] Chat stableKey=${stableKey}: displayName="${displayName}", unread=${unreadCount}`);
            }
            chatIndex++;

            return {
                ...chat,
                jid: normalizedJid || chat.jid, // Use normalized JID
                stableKey: stableKey, // ALWAYS include stable key (never null)
                name: chat.name,
                displayName,
                unreadCount, // From ChatStateService, NOT message history
                profilePicUrl: profilePicMap.get(chat.jid) || null,
                botActive: botService.isBotActive(normalizedJid || chat.jid),
                lastMessage: lastMsg ? getLastMessageText(lastMsg) : '',
                lastMessageSender,
            };
        });

        finalChats.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));

        // Apply read state override - this is the SINGLE SOURCE OF TRUTH
        // Prevents unread badges from reappearing after sync
        const finalChatsWithReadState = finalChats.map(chat => {
            const { override, unreadCount } = readStateService.shouldOverrideUnreadCount(
                chat.jid,
                chat.unreadCount,
                chat.lastMessageTime
            );

            if (override) {
                return { ...chat, unreadCount };
            }
            return chat;
        });

        // CRITICAL DEBUG: Log first 3 chats to verify stableKey and displayName are set
        if (finalChatsWithReadState.length > 0) {
            Logger.info('[ChatController] === API RESPONSE SAMPLE ===');
            finalChatsWithReadState.slice(0, 3).forEach((c, i) => {
                Logger.info(`[ChatController] Chat ${i}: jid="${c.jid}" stableKey="${c.stableKey}" displayName="${c.displayName}" unread=${c.unreadCount}`);
            });
            Logger.info('[ChatController] === END SAMPLE ===');
        }

        // âœ… OPTIMIZATION: Apply pagination to response
        const totalChats = finalChatsWithReadState.length;
        const paginatedChats = limit > 0
            ? finalChatsWithReadState.slice(offset, offset + limit)
            : finalChatsWithReadState;

        res.json({
            success: true,
            data: paginatedChats,
            pagination: {
                limit,
                offset,
                total: totalChats,
                hasMore: (offset + limit) < totalChats,
                nextOffset: Math.min(offset + limit, totalChats)
            }
        });
    } catch (error: unknown) {
        Logger.error('Error getting chats:', error);
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

// TEMPORARY DEBUG: Diagnostic endpoint with visual HTML interface
export const diagnoseChatLoadVisual = async (req: Request, res: Response): Promise<void> => {
    try {
        const botService = BotService.getInstance();
        const store = botService.getStore();

        if (!store) {
            res.send(`
                <h1>âŒ Error: Store not available</h1>
                <p>El bot no estÃ¡ inicializado. Intenta reconectar.</p>
            `);
            return;
        }

        // Collect diagnostic data
        const chatsMap = store.chats;
        let allChats: any[] = [];
        let conversionMethod = 'unknown';

        if (!chatsMap) {
            conversionMethod = 'null/undefined';
        } else if (typeof chatsMap.all === 'function') {
            allChats = chatsMap.all();
            conversionMethod = '.all() method';
        } else if (chatsMap instanceof Map) {
            allChats = Array.from(chatsMap.values());
            conversionMethod = 'Map.values()';
        } else if (typeof chatsMap.toJSON === 'function') {
            allChats = Object.values(chatsMap.toJSON());
            conversionMethod = '.toJSON()';
        } else if (typeof chatsMap === 'object') {
            allChats = Object.values(chatsMap);
            conversionMethod = 'Object.values()';
        }

        const messagesCount = store.messages instanceof Map ? store.messages.size : Object.keys(store.messages || {}).length;
        const contactsCount = store.contacts instanceof Map ? store.contacts.size : Object.keys(store.contacts || {}).length;

        // Full flow count
        const chats: any[] = [];
        const seenJids = new Set<string>();

        // Method 1
        for (const chat of allChats) {
            if (!chat || !chat.id || seenJids.has(chat.id)) continue;
            seenJids.add(chat.id);
            chats.push(chat);
        }

        const method1Count = chats.length;

        // Method 2
        const messagesStore = store.messages;
        const method2Only: any[] = [];
        if (messagesStore) {
            const existingPhones = new Set(chats.map(c => c.id.split('@')[0]));
            const messageJids = messagesStore instanceof Map ? Array.from(messagesStore.keys()) : Object.keys(messagesStore);

            for (const jid of messageJids) {
                if (jid === 'status@broadcast') continue;
                const phoneNumber = jid.split('@')[0];
                if (existingPhones.has(phoneNumber)) continue;
                method2Only.push({ jid, source: 'messages' });
            }
        }

        const totalChats = method1Count + method2Only.length;

        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>ChatBot Diagnostics</title>
    <style>
        body { font-family: mono; background: #1e1e1e; color: #fff; padding: 20px; }
        .container { max-width: 900px; margin: 0 auto; }
        .section { margin: 20px 0; padding: 15px; background: #2d2d2d; border-left: 4px solid #0066cc; }
        .success { border-left-color: #00cc66; }
        .warning { border-left-color: #ffaa00; }
        .error { border-left-color: #cc0000; }
        .metric { display: inline-block; margin: 10px 20px 10px 0; }
        .metric-val { font-size: 24px; font-weight: bold; color: #0099ff; }
        .metric-label { font-size: 12px; color: #aaa; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        td, th { border: 1px solid #444; padding: 8px; text-align: left; }
        th { background: #333; }
        tr:nth-child(even) { background: #252525; }
        .badge-good { background: #00cc66; color: black; padding: 2px 8px; border-radius: 3px; font-size: 12px; }
        .badge-warn { background: #ffaa00; color: black; padding: 2px 8px; border-radius: 3px; font-size: 12px; }
        .badge-bad { background: #cc0000; color: white; padding: 2px 8px; border-radius: 3px; font-size: 12px; }
        h2 { margin-top: 0; color: #00ccff; }
        .recommendation { background: #1a3a2e; padding: 10px; margin-top: 10px; border-radius: 4px; font-size: 13px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>ðŸ” WhatsApp Bot - Chat Diagnostics</h1>
        <p>Timestamp: ${new Date().toISOString()}</p>

        <div class="section success">
            <h2>ðŸ“Š Store Inventory</h2>
            <div class="metric">
                <div class="metric-val">${allChats.length}</div>
                <div class="metric-label">Chats in store.chats</div>
            </div>
            <div class="metric">
                <div class="metric-val">${messagesCount}</div>
                <div class="metric-label">JIDs in store.messages</div>
            </div>
            <div class="metric">
                <div class="metric-val">${contactsCount}</div>
                <div class="metric-label">Contacts in store.contacts</div>
            </div>
        </div>

        <div class="section ${totalChats > 1 ? 'success' : 'warning'}">
            <h2>âœ… Total Chats Available</h2>
            <div class="metric">
                <div class="metric-val" style="color: ${totalChats > 1 ? '#00cc66' : '#ffaa00'}">${totalChats}</div>
                <div class="metric-label">Chats from Method 1 + Method 2</div>
            </div>
            <table>
                <tr>
                    <th>Source</th>
                    <th>Count</th>
                    <th>Status</th>
                </tr>
                <tr>
                    <td>store.chats (${conversionMethod})</td>
                    <td>${method1Count}</td>
                    <td><span class="badge-${method1Count > 0 ? 'good' : 'bad'}">${method1Count > 0 ? 'Found' : 'EMPTY'}</span></td>
                </tr>
                <tr>
                    <td>store.messages (fallback)</td>
                    <td>${method2Only.length}</td>
                    <td><span class="badge-${method2Only.length > 0 ? 'warn' : 'good'}">${method2Only.length > 0 ? 'Supplementary' : 'Not needed'}</span></td>
                </tr>
            </table>

            ${totalChats === 0 ? `
                <div class="recommendation" style="background: #3a1a1a; border-left: 3px solid #cc0000;">
                    <strong>âŒ CRITICAL:</strong> No chats found in Baileys store!
                    <br>â€¢ Check if WhatsApp is connected
                    <br>â€¢ Verify Baileys session is loaded
                    <br>â€¢ Try reconnecting the bot
                </div>
            ` : totalChats === 1 ? `
                <div class="recommendation" style="background: #3a2a1a;">
                    <strong>âš ï¸ WARNING:</strong> Only 1 chat found. This may be correct if the user has only 1 conversation.
                </div>
            ` : `
                <div class="recommendation">
                    <strong>âœ… OK:</strong> ${totalChats} chats available. 
                    <br>If frontend still shows only 1, the problem is in frontend filtering.
                </div>
            `}
        </div>

        <div class="section">
            <h2>ðŸ”§ Store Structure</h2>
            <table>
                <tr><th>Component</th><th>Type</th><th>Status</th></tr>
                <tr>
                    <td>store.chats</td>
                    <td>${chatsMap instanceof Map ? 'Map' : chatsMap instanceof Array ? 'Array' : typeof chatsMap}</td>
                    <td><span class="badge-${chatsMap ? 'good' : 'bad'}">${chatsMap ? 'Present' : 'Missing'}</span></td>
                </tr>
                <tr>
                    <td>store.messages</td>
                    <td>Object</td>
                    <td><span class="badge-${messagesStore ? 'good' : 'bad'}">${messagesStore ? 'Present' : 'Missing'}</span></td>
                </tr>
                <tr>
                    <td>store.contacts</td>
                    <td>Object</td>
                    <td><span class="badge-${store.contacts ? 'good' : 'bad'}">${store.contacts ? 'Present' : 'Missing'}</span></td>
                </tr>
            </table>
        </div>

        <div class="section">
            <h2>ðŸ“ Sample Chats (First 5)</h2>
            <table>
                <tr><th>Source</th><th>JID/Phone</th><th>Name</th><th>Type</th></tr>
                ${allChats.slice(0, 5).map((c: any) => `
                    <tr>
                        <td>store.chats</td>
                        <td>${c.id || 'N/A'}</td>
                        <td>${c.name || c.subject || 'Unknown'}</td>
                        <td>${c.id?.includes('@g.us') ? 'ðŸ‘¥ Group' : 'ðŸ‘¤ Contact'}</td>
                    </tr>
                `).join('')}
                ${method2Only.slice(0, 5).map((c: any) => `
                    <tr>
                        <td>store.messages</td>
                        <td>${c.jid}</td>
                        <td>N/A</td>
                        <td>Unknown</td>
                    </tr>
                `).join('')}
            </table>
        </div>

        <div class="section">
            <h2>ðŸŽ¯ Diagnosis</h2>
            ${totalChats === 0 ? `
                <p><strong>Problem:</strong> BACKEND - No chats in Baileys store</p>
                <p><strong>Next Steps:</strong></p>
                <ol>
                    <li>Check WhatsApp connection status</li>
                    <li>Verify Baileys session file exists</li>
                    <li>Try: Settings â†’ Reconectar</li>
                    <li>Contact support if issue persists</li>
                </ol>
            ` : totalChats === 1 ? `
                <p><strong>Finding:</strong> Only 1 chat in store</p>
                <p><strong>Next Steps:</strong></p>
                <ol>
                    <li>This may be normal if user has only 1 WhatsApp conversation</li>
                    <li>Send/receive a message to create more chats</li>
                    <li>Check WhatsApp on phone for list of chats</li>
                </ol>
            ` : `
                <p><strong>Problem:</strong> FRONTEND - Backend has ${totalChats} chats but UI shows only 1</p>
                <p><strong>Next Steps:</strong></p>
                <ol>
                    <li>Open DevTools (F12) â†’ Console tab</li>
                    <li>Look for "[ChatList]" logs</li>
                    <li>Check if "No leÃ­dos" filter is active</li>
                    <li>Try clicking "Todos" to reset filters</li>
                    <li>If still broken, check: "Filtering pipeline final: X" in console</li>
                </ol>
            `}
        </div>

        <div class="section">
            <p style="font-size: 12px; color: #666;">
                <strong>API Endpoints for debugging:</strong>
                <br>â€¢ JSON data: <code><a href="/api/chats/diagnostics/chat-load" style="color: #0099ff;">/api/chats/diagnostics/chat-load</a></code>
                <br>â€¢ This visual: <code><a href="/api/chats/diagnostics/visual" style="color: #0099ff;">/api/chats/diagnostics/visual</a></code>
            </p>
        </div>
    </div>
</body>
</html>
        `;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
    } catch (error: unknown) {
        res.send(`
            <h1>âŒ Diagnostic Error</h1>
            <pre>${getErrorMessage(error)}\n${error instanceof Error ? error.stack : ''}</pre>
        `);
    }
};

export const diagnoseChatLoad = async (req: Request, res: Response): Promise<void> => {
    try {
        const botService = BotService.getInstance();
        const store = botService.getStore();

        if (!store) {
            res.json({
                error: 'Store not available'
            });
            return;
        }

        const diagnosis = {
            timestamp: new Date().toISOString(),

            // 1. Diagnose store.chats
            chatsStore: {
                exists: !!store.chats,
                type: store.chats ? typeof store.chats : 'undefined',
                isMap: store.chats instanceof Map,
                isArray: Array.isArray(store.chats),
                isObject: store.chats && typeof store.chats === 'object',
                hasAllMethod: store.chats && typeof store.chats.all === 'function',
                hasToJsonMethod: store.chats && typeof store.chats.toJSON === 'function',
                keys: store.chats ? Object.keys(store.chats).slice(0, 10) : [],
                size: store.chats?.size || Object.keys(store.chats || {}).length,
            },

            // 2. Try conversion (same logic as getChats)
            chatConversion: (() => {
                try {
                    const chatsMap = store.chats;
                    let allChats: any[] = [];
                    let conversionMethod = 'unknown';

                    if (!chatsMap) {
                        conversionMethod = 'null/undefined';
                    } else if (typeof chatsMap.all === 'function') {
                        allChats = chatsMap.all();
                        conversionMethod = '.all() method';
                    } else if (chatsMap instanceof Map) {
                        allChats = Array.from(chatsMap.values());
                        conversionMethod = 'Map.values()';
                    } else if (typeof chatsMap.toJSON === 'function') {
                        allChats = Object.values(chatsMap.toJSON());
                        conversionMethod = '.toJSON()';
                    } else if (typeof chatsMap === 'object') {
                        allChats = Object.values(chatsMap);
                        conversionMethod = 'Object.values()';
                    }

                    return {
                        success: true,
                        conversionMethod,
                        chatsArrayLength: allChats.length,
                        topChats: allChats.slice(0, 5).map((c: any) => ({
                            id: c?.id,
                            name: c?.name,
                            subject: c?.subject,
                            timestamp: c?.conversationTimestamp
                        }))
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: (error as any).message
                    };
                }
            })(),

            // 3. Diagnose store.messages
            messagesCount: store.messages instanceof Map ? store.messages.size : Object.keys(store.messages || {}).length,
            messagesKeys: store.messages instanceof Map ? Array.from(store.messages.keys()).slice(0, 5) : Object.keys(store.messages || {}).slice(0, 5),

            // 4. Diagnose store.contacts
            contactsCount: store.contacts instanceof Map ? store.contacts.size : Object.keys(store.contacts || {}).length,
            contactsKeys: store.contacts instanceof Map ? Array.from(store.contacts.keys()).slice(0, 5) : Object.keys(store.contacts || {}).slice(0, 5),

            // 5. Full flow test
            fullFlow: (() => {
                try {
                    const chats: any[] = [];
                    const seenJids = new Set<string>();

                    // Method 1: Get from chats store
                    const chatsMap = store.chats;
                    if (chatsMap) {
                        let allChats: any[] = [];
                        if (typeof chatsMap.all === 'function') allChats = chatsMap.all();
                        else if (chatsMap instanceof Map) allChats = Array.from(chatsMap.values());
                        else if (typeof chatsMap.toJSON === 'function') allChats = Object.values(chatsMap.toJSON());
                        else if (typeof chatsMap === 'object') allChats = Object.values(chatsMap);

                        for (const chat of allChats) {
                            if (!chat || !chat.id || seenJids.has(chat.id)) continue;
                            seenJids.add(chat.id);
                            chats.push({ source: 'chatsStore', id: chat.id, name: chat.name });
                        }
                    }

                    // Method 2: Get from messages store
                    const messagesStore = store.messages;
                    if (messagesStore) {
                        const existingPhones = new Set(chats.map(c => c.id.split('@')[0]));
                        const messageJids = messagesStore instanceof Map ? Array.from(messagesStore.keys()) : Object.keys(messagesStore);

                        for (const jid of messageJids) {
                            if (jid === 'status@broadcast') continue;
                            const phoneNumber = jid.split('@')[0];
                            if (existingPhones.has(phoneNumber)) continue;
                            existingPhones.add(phoneNumber);
                            chats.push({ source: 'messagesStore', id: jid });
                        }
                    }

                    return {
                        success: true,
                        method1Count: chats.filter((c: any) => c.source === 'chatsStore').length,
                        method2Count: chats.filter((c: any) => c.source === 'messagesStore').length,
                        totalChats: chats.length,
                        sampleChats: chats.slice(0, 5),
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: (error as any).message,
                    };
                }
            })(),
        };

        res.json(diagnosis);
    } catch (error: unknown) {
        res.json({
            error: getErrorMessage(error)
        });
    }
};

export const getChatMessages = async (req: Request, res: Response): Promise<void> => {
    try {
        const { jid } = req.params;
        const limit = Math.min(parseInt(req.query.limit as string) || 50, 100); // Max 100 messages
        const beforeMessageId = req.query.before as string; // For pagination

        if (!jid) {
            res.status(400).json({
                success: false,
                error: 'jid parameter is required'
            });
            return;
        }

        Logger.info(`Fetching messages for JID: ${jid}, limit: ${limit} `);

        const botService = BotService.getInstance();
        const store = botService.getStore();
        const isGroup = jid.includes('@g.us');

        if (!store) {
            Logger.info('Store not available');
            res.status(503).json({
                success: false,
                error: 'Bot not initialized or store not available'
            });
            return;
        }

        // Try to fetch messages from WA with enhanced history support
        try {
            Logger.info(`Attempting to fetch enhanced message history from WA for ${jid}${beforeMessageId ? ` before ${beforeMessageId}` : ''}`);
            const fetchedMessages = await botService.fetchMessagesFromWA(jid, limit, beforeMessageId);
            Logger.info(`Fetched ${fetchedMessages.length} enhanced messages from WA for ${jid}`);

            // If we got messages from WA, return them directly (they're already processed)
            if (fetchedMessages.length > 0) {
                Logger.info(`Returning ${fetchedMessages.length} messages from WA for ${jid}`);
                res.json({
                    success: true,
                    data: fetchedMessages,
                    isGroup,
                    totalFound: fetchedMessages.length,
                    hasMore: fetchedMessages.length === limit, // Indicate if there might be more messages
                    source: 'whatsapp_api'
                });
                return;
            }
        } catch (fetchError: any) {
            Logger.warn(`Failed to fetch enhanced messages from WA for ${jid}: `, fetchError.message);
        }

        const messagesStore = store.messages;
        let messages: any[] = [];

        // Try multiple JID formats to find messages with better logging
        const phoneNumber = jid.split('@')[0];
        const possibleJids = [
            jid,
            `${phoneNumber}@s.whatsapp.net`,
            `${phoneNumber}@lid`,
            `${phoneNumber}@c.us`
        ];

        Logger.info(`Trying JID formats for ${jid}: `, possibleJids);

        for (const tryJid of possibleJids) {
            const chatMessages = messagesStore instanceof Map ? messagesStore.get(tryJid) : messagesStore[tryJid];
            if (chatMessages) {
                const msgArray = chatMessages.array || chatMessages;

                if (Array.isArray(msgArray) && msgArray.length > 0) {
                    Logger.info(`Found ${msgArray.length} messages for JID ${tryJid}`);

                    // Collect unique sender JIDs for group chats
                    const senderJids = new Set<string>();
                    if (isGroup) {
                        msgArray.forEach((msg: any) => {
                            const senderJid = msg.key?.participant;
                            if (senderJid && !msg.key?.fromMe) {
                                senderJids.add(senderJid);
                            }
                        });
                    }

                    // Fetch profile pics for all senders in groups
                    let senderProfilePics = new Map<string, string | null>();
                    if (isGroup && senderJids.size > 0) {
                        try {
                            senderProfilePics = await profileCacheService.getMultipleProfilePics(
                                Array.from(senderJids)
                            );
                        } catch (profileError) {
                            Logger.warn('Failed to fetch profile pictures:', profileError);
                        }
                    }

                    // Process and filter messages
                    const processedMessages = msgArray
                        .filter((msg: any) => msg.key && msg.message) // Filter out invalid messages
                        .slice(-limit)
                        .map((msg: any) => {
                            const senderJid = msg.key?.participant || msg.key?.remoteJid;
                            const fromMe = msg.key?.fromMe || false;

                            const baseMessage = {
                                id: msg.key?.id,
                                from: msg.key?.remoteJid,
                                fromMe,
                                body: getMessageBody(msg.message),
                                type: getMessageType(msg.message),
                                timestamp: msg.messageTimestamp,
                                pushName: msg.pushName,
                                status: getMessageStatus(msg),
                                ack: getMessageAck(msg),
                                messageTimestamp: msg.messageTimestamp,
                                remoteJid: msg.key?.remoteJid
                            };

                            // Add sender info for group messages
                            if (isGroup && !fromMe) {
                                return {
                                    ...baseMessage,
                                    senderJid,
                                    senderName: msg.pushName || senderJid?.split('@')[0],
                                    senderProfilePic: senderProfilePics.get(senderJid) || null
                                };
                            }

                            return baseMessage;
                        });

                    if (processedMessages.length > 0) {
                        messages = processedMessages;
                        Logger.info(`Successfully processed ${messages.length} messages for ${jid}`);
                        break;
                    }
                }
            }
        }

        // If still no messages, try one more approach - check if we can get them directly from the store
        if (messages.length === 0) {
            Logger.info(`No messages found for ${jid}, trying direct store access`);
            try {
                // Try to get from store directly using BaileysClass method
                const bot = botService.getBot();
                if (bot && typeof bot.getMessagesFromStore === 'function') {
                    const directMessages = bot.getMessagesFromStore(jid, limit);
                    if (directMessages && directMessages.length > 0) {
                        Logger.info(`Found ${directMessages.length} messages via direct store access`);
                        messages = directMessages.map((msg: any) => ({
                            id: msg.key?.id || Math.random().toString(36),
                            from: msg.key?.remoteJid || jid,
                            fromMe: msg.key?.fromMe || false,
                            body: getMessageBody(msg.message),
                            type: getMessageType(msg.message),
                            timestamp: msg.messageTimestamp || Date.now(),
                            pushName: msg.pushName
                        }));
                    }
                }
            } catch (directError) {
                Logger.warn('Direct store access failed:', directError);
            }
        }

        Logger.info(`Final result: ${messages.length} messages for ${jid}`);

        res.json({
            success: true,
            data: messages,
            isGroup,
            totalFound: messages.length
        });
    } catch (error: unknown) {
        Logger.error('Error getting chat messages:', error);
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

export const toggleBot = async (req: Request, res: Response): Promise<void> => {
    try {
        const { jid } = req.params;
        const { active } = req.body;

        if (!jid) {
            res.status(400).json({
                success: false,
                error: 'jid parameter is required'
            });
            return;
        }

        const botService = BotService.getInstance();
        botService.toggleBot(jid, !!active);

        res.json({
            success: true,
            data: {
                jid,
                botActive: !!active
            }
        });
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

function getMessageType(message: any): string {
    if (!message) return 'unknown';
    if (message.conversation || message.extendedTextMessage) return 'text';
    if (message.imageMessage) return 'image';
    if (message.videoMessage) return 'video';
    if (message.audioMessage) return 'audio';
    if (message.documentMessage) return 'document';
    if (message.locationMessage) return 'location';
    if (message.contactMessage) return 'contact';
    if (message.stickerMessage) return 'sticker';
    if (message.pollCreationMessage) return 'poll';
    return 'unknown';
}

function getMessageBody(message: any): string {
    if (!message) return '';

    return message.conversation ||
        message.extendedTextMessage?.text ||
        message.imageMessage?.caption ||
        message.videoMessage?.caption ||
        message.documentMessage?.caption ||
        message.locationMessage?.name ||
        message.contactMessage?.displayName ||
        (message.imageMessage ? 'ðŸ“· Foto' : '') ||
        (message.videoMessage ? 'ðŸŽ¥ Video' : '') ||
        (message.audioMessage ? 'ðŸŽ¤ Audio' : '') ||
        (message.stickerMessage ? 'ðŸŽ¨ Sticker' : '') ||
        (message.documentMessage ? 'ðŸ“„ Documento' : '') ||
        (message.locationMessage ? 'ðŸ“ UbicaciÃ³n' : '') ||
        (message.pollCreationMessage ? 'ðŸ“Š Encuesta' : '') ||
        '';
}

function getMessageStatus(msg: any): 'pending' | 'sent' | 'delivered' | 'read' | 'error' {
    // WhatsApp message status determination
    if (!msg) return 'pending';

    const key = msg.key;
    if (!key) return 'pending';

    // Check message status from various sources
    if (msg.status) {
        switch (msg.status) {
            case 0: return 'pending';
            case 1: return 'sent';
            case 2: return 'delivered';
            case 3: return 'read';
            case 4: return 'error';
            default: return 'pending';
        }
    }

    // Check message receipt status
    if (msg.receipt) {
        const receipt = msg.receipt;
        if (receipt.read) return 'read';
        if (receipt.delivery) return 'delivered';
        if (receipt.sent) return 'sent';
    }

    // For sent messages, default to sent if no status info
    if (key.fromMe) return 'sent';

    // For received messages, consider them delivered
    return 'delivered';
}

function getMessageAck(msg: any): number {
    // WhatsApp ack values: 0=pending, 1=sent, 2=received, 3=read, 4=failed
    return msg?.status || msg?.ack || 0;
}

/**
 * Get complete chat history with pagination support
 * This endpoint specifically fetches historical messages from WhatsApp
 * beyond what's available in the real-time store
 */
export const getChatHistory = async (req: Request, res: Response): Promise<void> => {
    try {
        const { jid } = req.params;
        const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
        const beforeMessageId = req.query.before as string;
        const includeMedia = req.query.includeMedia === 'true';

        if (!jid) {
            res.status(400).json({
                success: false,
                error: 'jid parameter is required'
            });
            return;
        }

        Logger.info(`Fetching chat history for JID: ${jid}, limit: ${limit}, before: ${beforeMessageId || 'none'}, includeMedia: ${includeMedia}`);

        const botService = BotService.getInstance();
        const isGroup = jid.includes('@g.us');

        // Validate bot is ready
        if (!botService.getBot()) {
            res.status(503).json({
                success: false,
                error: 'Bot not initialized or not connected to WhatsApp'
            });
            return;
        }

        // Fetch enhanced history from WhatsApp
        try {
            const historyMessages = await botService.fetchMessagesFromWA(jid, limit, beforeMessageId);

            Logger.info(`Fetched ${historyMessages.length} historical messages from WhatsApp for ${jid}`);

            // Process messages for frontend consumption
            const processedMessages = historyMessages.map(msg => ({
                id: msg.id,
                from: msg.from,
                fromMe: msg.fromMe,
                body: msg.body,
                type: msg.type,
                timestamp: msg.timestamp,
                pushName: msg.pushName,
                // Media information (only if requested)
                ...(includeMedia && {
                    mediaUrl: msg.mediaUrl,
                    fileName: msg.fileName,
                    fileSize: msg.fileSize,
                    duration: msg.duration
                }),
                // Location information
                location: msg.location,
                // Contact information
                contactInfo: msg.contactInfo,
                // Group message metadata
                participant: msg.participant,
                // Message status
                status: msg.status,
                ack: msg.ack,
                // Enhanced metadata
                isMedia: ['image', 'video', 'audio', 'document', 'sticker'].includes(msg.type),
                hasCaption: !!msg.body && ['image', 'video', 'document'].includes(msg.type)
            }));

            res.json({
                success: true,
                data: processedMessages,
                isGroup,
                totalFound: processedMessages.length,
                hasMore: processedMessages.length === limit,
                source: 'whatsapp_history',
                pagination: {
                    limit,
                    beforeMessageId,
                    canLoadMore: processedMessages.length === limit
                }
            });

        } catch (fetchError: any) {
            Logger.error(`Failed to fetch chat history for ${jid}:`, fetchError);

            res.status(500).json({
                success: false,
                error: `Failed to fetch chat history: ${fetchError.message}`
            });
        }

    } catch (error: unknown) {
        Logger.error('Error in getChatHistory:', error);
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};

/**
 * Mark messages as read for a chat
 */
export const markAsRead = async (req: Request, res: Response): Promise<void> => {
    try {
        const { jid } = req.params;
        const { messageIds, timestamp } = req.body;

        if (!jid) {
            res.status(400).json({
                success: false,
                error: 'JID is required'
            });
            return;
        }

        // Normalize the JID for consistent handling
        const normalizedJid = normalizeRawJid(jid);
        const stableKey = toStableKey(jid);
        Logger.info(`[markAsRead] raw = "${jid}" normalized = "${normalizedJid}" stableKey = "${stableKey}"`);

        const botService = BotService.getInstance();

        // 1. Persist read state in ChatStateService (SINGLE SOURCE OF TRUTH for unread counts)
        chatStateService.markAsRead(jid);

        // 2. Also update ReadStateService for timestamp tracking
        const readTimestamp = timestamp || Math.floor(Date.now() / 1000);
        readStateService.markAsRead(jid, readTimestamp);

        // 2. Try to sync with WhatsApp (best effort, don't fail if this fails)
        let waSuccess = false;
        try {
            waSuccess = await botService.markMessagesAsRead(jid, messageIds);
        } catch (waError) {
            Logger.warn(`[markAsRead] WhatsApp sync failed for ${jid}: `, waError);
            // Continue - local state is the source of truth
        }

        // 3. Emit event to update all connected clients
        const io = (req as any).io;
        if (io) {
            io.emit('chat:read', {
                jid: normalizedJid || jid,
                stableKey: stableKey || jid,
                unreadCount: 0,
                lastReadTimestamp: readTimestamp
            });
        }

        res.json({
            success: true,
            data: {
                jid,
                marked: true,
                lastReadTimestamp: readTimestamp,
                whatsappSynced: waSuccess
            }
        });
    } catch (error: unknown) {
        Logger.error('Error marking messages as read:', error);
        res.status(500).json({
            success: false,
            error: getErrorMessage(error) || 'Failed to mark messages as read'
        });
    }
};

/**
 * Get the read state for a specific chat
 */
export const getReadState = async (req: Request, res: Response): Promise<void> => {
    try {
        const { jid } = req.params;

        if (!jid) {
            res.status(400).json({
                success: false,
                error: 'JID is required'
            });
            return;
        }

        const readState = readStateService.getReadState(jid);

        res.json({
            success: true,
            data: readState
        });
    } catch (error: unknown) {
        Logger.error('Error getting read state:', error);
        res.status(500).json({
            success: false,
            error: getErrorMessage(error)
        });
    }
};


