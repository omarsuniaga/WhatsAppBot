import { Request, Response } from 'express';
import BotService from '../services/botService';
import ProfileCacheService from '../services/profileCacheService';

const profileCacheService = ProfileCacheService.getInstance();

const getLastMessageText = (message: any): string => {
    if (!message?.message) return '';
    const msg = message.message;
    return msg.conversation ||
           msg.extendedTextMessage?.text ||
           msg.imageMessage?.caption ||
           msg.videoMessage?.caption ||
           (msg.imageMessage ? '📷 Foto' : '') ||
           (msg.videoMessage ? '🎥 Video' : '') ||
           (msg.audioMessage ? '🎤 Audio' : '') ||
           (msg.stickerMessage ? '🎨 Sticker' : '') ||
           (msg.documentMessage ? '📄 Documento' : '') ||
           (msg.locationMessage ? '📍 Ubicación' : '') ||
           '';
};

export const getChats = async (req: Request, res: Response): Promise<void> => {
    try {
        const botService = BotService.getInstance();
        const store = botService.getStore();

        if (!store) {
            res.status(503).json({
                success: false,
                error: 'Bot not initialized or store not available'
            });
            return;
        }

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
                chats.push({
                    jid: chat.id,
                    name: chat.name || chat.subject || chat.id?.split('@')[0] || 'Unknown',
                    unreadCount: chat.unreadCount || 0,
                    lastMessageTime: chat.conversationTimestamp,
                    isGroup: chat.id?.includes('@g.us') || false,
                });
            }
        }

        // Method 2: Get from messages store
        const messagesStore = store.messages;
        if (messagesStore) {
            const existingPhones = new Set(chats.map(c => c.jid.split('@')[0]));
            const messageJids = Object.keys(messagesStore);

            for (const jid of messageJids) {
                if (jid === 'status@broadcast') continue;

                const phoneNumber = jid.split('@')[0];
                if (existingPhones.has(phoneNumber)) continue;
                existingPhones.add(phoneNumber);

                const messages = messagesStore[jid];
                const msgArray = messages?.array || messages;
                const lastMsg = Array.isArray(msgArray) ? msgArray[msgArray.length - 1] : null;

                // Normalize JID to @s.whatsapp.net format
                const normalizedJid = jid.includes('@lid')
                    ? `${phoneNumber}@s.whatsapp.net`
                    : jid;

                chats.push({
                    jid: normalizedJid,
                    name: lastMsg?.pushName || phoneNumber || 'Unknown',
                    unreadCount: 0,
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

        finalChats = finalChats.map(chat => {
            const phoneNumber = chat.jid.split('@')[0];
            const possibleJids = [chat.jid, `${phoneNumber}@lid`, `${phoneNumber}@s.whatsapp.net`];
            let lastMsg: any = null;
            for (const tryJid of possibleJids) {
                const msgs = store.messages[tryJid];
                if (msgs?.array?.length > 0) {
                    lastMsg = msgs.array.slice(-1)[0];
                    break;
                }
            }

            // Get last message sender info for groups
            let lastMessageSender: { jid: string; name: string } | null = null;
            if (chat.isGroup && lastMsg && !(lastMsg as any).key?.fromMe) {
                const msgKey = (lastMsg as any).key;
                lastMessageSender = {
                    jid: msgKey?.participant || '',
                    name: (lastMsg as any).pushName || msgKey?.participant?.split('@')[0] || ''
                };
            }

            return {
                ...chat,
                profilePicUrl: profilePicMap.get(chat.jid) || null,
                botActive: botService.isBotActive(chat.jid),
                lastMessage: lastMsg ? getLastMessageText(lastMsg) : '',
                lastMessageSender,
            };
        });

        finalChats.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));

        res.json({
            success: true,
            data: finalChats
        });
    } catch (error: any) {
        console.error('Error getting chats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

export const getChatMessages = async (req: Request, res: Response): Promise<void> => {
    try {
        const { jid } = req.params;
        const limit = parseInt(req.query.limit as string) || 50;

        if (!jid) {
            res.status(400).json({
                success: false,
                error: 'jid parameter is required'
            });
            return;
        }

        const botService = BotService.getInstance();
        const store = botService.getStore();
        const isGroup = jid.includes('@g.us');

        if (!store) {
            res.status(503).json({
                success: false,
                error: 'Bot not initialized or store not available'
            });
            return;
        }

        // Try to fetch messages from WA
        await botService.fetchMessagesFromWA(jid, limit);

        const messagesStore = store.messages;
        let messages: any[] = [];

        // Try multiple JID formats to find messages
        const phoneNumber = jid.split('@')[0];
        const possibleJids = [
            jid,
            `${phoneNumber}@s.whatsapp.net`,
            `${phoneNumber}@lid`,
            `${phoneNumber}@c.us`
        ];

        for (const tryJid of possibleJids) {
            if (messagesStore && messagesStore[tryJid]) {
                const chatMessages = messagesStore[tryJid];
                const msgArray = chatMessages.array || chatMessages;

                if (Array.isArray(msgArray) && msgArray.length > 0) {
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
                        senderProfilePics = await profileCacheService.getMultipleProfilePics(
                            Array.from(senderJids)
                        );
                    }

                    messages = msgArray.slice(-limit).map((msg: any) => {
                        const senderJid = msg.key?.participant || msg.key?.remoteJid;
                        const fromMe = msg.key?.fromMe || false;

                        const baseMessage = {
                            id: msg.key?.id,
                            from: msg.key?.remoteJid,
                            fromMe,
                            body: msg.message?.conversation ||
                                  msg.message?.extendedTextMessage?.text ||
                                  msg.message?.imageMessage?.caption ||
                                  msg.message?.videoMessage?.caption ||
                                  '',
                            type: getMessageType(msg.message),
                            timestamp: msg.messageTimestamp,
                            pushName: msg.pushName
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
                    break;
                }
            }
        }

        res.json({
            success: true,
            data: messages,
            isGroup
        });
    } catch (error: any) {
        console.error('Error getting chat messages:', error);
        res.status(500).json({
            success: false,
            error: error.message
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
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
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
