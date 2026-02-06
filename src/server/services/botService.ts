import { Server as SocketServer } from 'socket.io';
import { BaileysClass } from '../../baileys';
import { BotOrchestrator } from '../../agents/BotOrchestrator';
import { IntelligentBotService } from './intelligentBotService';
import MetricsService from './metricsService';
import ContactStoreService from './contactStoreService';
import ChatStateService from './chatStateService';
import TriggerService from './triggerService';
import { normalizeRawJid, toStableKey, debugJid, isValidJid, isGroupJid } from '../utils/jidUtils';
import { IdentityService, SenderResolution } from './identityService';
import { ContactsRepository } from '../persistence/ContactsRepository';
import { StudentsRepository } from '../persistence/StudentsRepository';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

// Anti-loop: Track recent sent messages to prevent loops
interface SentMessageTracker {
    lastSentAt: number;
    messageHash: string;
}

// Rate limiting constants
const MIN_MESSAGE_INTERVAL_MS = 2000; // Minimum 2 seconds between messages to same chat
const MAX_MESSAGE_LENGTH = 4096; // WhatsApp message limit
const ANTI_LOOP_WINDOW_MS = 5000; // Window to detect loops

export interface BotServiceOptions {
    name?: string;
    usePairingCode?: boolean;
    phoneNumber?: string;
    debug?: boolean;
}

class BotService {
    private static instance: BotService;
    private bot: BaileysClass | null = null;
    private io: SocketServer | null = null;
    private connectionStatus: ConnectionStatus = 'disconnected';
    private currentQR: string | null = null;

    // Anti-loop and rate limiting
    private sentMessages: Map<string, SentMessageTracker> = new Map();
    private lastMessageTime: Map<string, number> = new Map();
    private processingMessages: Set<string> = new Set(); // Prevent concurrent processing

    // Metrics
    private metrics: MetricsService;
    
    // Contact store for display names
    private contactStore: ContactStoreService;
    
    // Chat state for unread tracking
    private chatState: ChatStateService;
    
    // Identity resolution service
    private identityService: IdentityService;

    // Trigger service for keyword activation
    private triggerService: TriggerService;

    private constructor() {
        this.metrics = MetricsService.getInstance();
        this.contactStore = ContactStoreService.getInstance();
        this.chatState = ChatStateService.getInstance();
        this.identityService = IdentityService.getInstance();
        this.triggerService = TriggerService.getInstance();
        // Clean up old tracking data periodically
        setInterval(() => this.cleanupTrackers(), 60000);
    }

    /**
     * Clean up old message trackers to prevent memory leaks
     */
    private cleanupTrackers(): void {
        const now = Date.now();
        const maxAge = 5 * 60 * 1000; // 5 minutes

        for (const [key, tracker] of this.sentMessages.entries()) {
            if (now - tracker.lastSentAt > maxAge) {
                this.sentMessages.delete(key);
            }
        }

        for (const [key, time] of this.lastMessageTime.entries()) {
            if (now - time > maxAge) {
                this.lastMessageTime.delete(key);
            }
        }
    }

    /**
     * Validate JID format
     */
    private isValidJid(jid: string): boolean {
        if (!jid || typeof jid !== 'string') return false;
        // WhatsApp JID format: number@s.whatsapp.net or number@g.us (groups)
        return /^\d+@(s\.whatsapp\.net|g\.us)$/.test(jid);
    }

    /**
     * Sanitize message text
     */
    private sanitizeMessage(text: string): string {
        if (!text || typeof text !== 'string') return '';
        // Trim and limit length
        return text.trim().slice(0, MAX_MESSAGE_LENGTH);
    }

    /**
     * Generate hash for message deduplication
     */
    private hashMessage(jid: string, text: string): string {
        return `${jid}:${text.slice(0, 100)}`;
    }

    /**
     * Check if we should skip this message (anti-loop)
     */
    private shouldSkipMessage(jid: string, messageText: string, isFromMe: boolean): { skip: boolean; reason?: string } {
        // Always skip own messages
        if (isFromMe) {
            return { skip: true, reason: 'own_message' };
        }

        // Skip empty messages
        if (!messageText || messageText.trim().length === 0) {
            return { skip: true, reason: 'empty_message' };
        }

        // Skip invalid JIDs
        if (!this.isValidJid(jid)) {
            console.warn(`[BotService] Invalid JID format: ${jid}`);
            return { skip: true, reason: 'invalid_jid' };
        }

        // Check if we recently sent this exact message (loop detection)
        const messageHash = this.hashMessage(jid, messageText);
        const tracker = this.sentMessages.get(jid);
        if (tracker && tracker.messageHash === messageHash) {
            const timeSinceSent = Date.now() - tracker.lastSentAt;
            if (timeSinceSent < ANTI_LOOP_WINDOW_MS) {
                console.warn(`[BotService] Loop detected for ${jid}, skipping`);
                return { skip: true, reason: 'loop_detected' };
            }
        }

        // Check if already processing this chat
        if (this.processingMessages.has(jid)) {
            console.log(`[BotService] Already processing message for ${jid}, queuing`);
            return { skip: true, reason: 'already_processing' };
        }

        return { skip: false };
    }

    /**
     * Wait for rate limit before sending message
     */
    private async waitForRateLimit(jid: string): Promise<void> {
        const lastTime = this.lastMessageTime.get(jid);
        if (lastTime) {
            const elapsed = Date.now() - lastTime;
            if (elapsed < MIN_MESSAGE_INTERVAL_MS) {
                const waitTime = MIN_MESSAGE_INTERVAL_MS - elapsed;
                console.log(`[BotService] Rate limiting: waiting ${waitTime}ms for ${jid}`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
        this.lastMessageTime.set(jid, Date.now());
    }

    static getInstance(): BotService {
        if (!BotService.instance) {
            BotService.instance = new BotService();
        }
        return BotService.instance;
    }

    setSocketServer(io: SocketServer): void {
        this.io = io;
    }

    async initialize(options: BotServiceOptions = {}): Promise<void> {
        if (this.bot) {
            console.log('Bot already initialized');
            return;
        }

        this.connectionStatus = 'connecting';
        this.bot = new BaileysClass({
            name: options.name || 'web-bot',
            usePairingCode: options.usePairingCode || false,
            phoneNumber: options.phoneNumber,
            debug: options.debug || false,
        });

        // Initialize AI via BotOrchestrator (handles all agents internally)
        const orchestrator = BotOrchestrator.getInstance();
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey) {
            orchestrator.initGemini(apiKey);
            console.log('AI Agents initialized via BotOrchestrator');
        } else {
            console.warn('GEMINI_API_KEY not found. AI features will be disabled.');
        }

        // Forward orchestrator events to Socket.IO
        orchestrator.on('alert:new', (alert) => {
            console.log('[BotService] New alert created:', alert.id);
            this.io?.emit('alert:new', alert);
        });

        orchestrator.on('alert:responded', (alert) => {
            console.log('[BotService] Alert responded:', alert.id);
            this.io?.emit('alert:responded', alert);
        });

        orchestrator.on('alert:dismissed', (alert) => {
            console.log('[BotService] Alert dismissed:', alert.id);
            this.io?.emit('alert:dismissed', alert);
        });

        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        if (!this.bot) return;

        this.bot.on('qr', (qr: string) => {
            this.currentQR = qr;
            this.connectionStatus = 'connecting';
            this.io?.emit('qr', qr);
            this.io?.emit('connection:status', this.connectionStatus);
        });

        this.bot.on('pairing_code', (code: string) => {
            this.io?.emit('pairing_code', code);
        });

        this.bot.on('ready', async () => {
            this.connectionStatus = 'connected';
            this.currentQR = null;
            this.io?.emit('connection:status', this.connectionStatus);
            this.io?.emit('ready');

            // Record connection metric
            this.metrics.connectionStatus('connected');

            // Initialize Intelligent Bot Services
            try {
                const intelligentBot = IntelligentBotService.getInstance();
                await intelligentBot.initialize();
                console.log('✅ Intelligent Bot Services ready');
            } catch (error) {
                console.error('❌ Failed to initialize Intelligent Bot Services:', error);
            }
        });

        this.bot.on('auth_failure', (error: any) => {
            this.connectionStatus = 'disconnected';
            this.io?.emit('auth_failure', { error: String(error) });
            this.io?.emit('connection:status', this.connectionStatus);

            // Record connection failure metric
            this.metrics.connectionStatus('disconnected');
            this.metrics.error('auth', String(error));
        });

        this.bot.on('message', async (message: any) => {
            // Extract raw JIDs from message
            const rawRemoteJid = message.key?.remoteJid || message.from;
            const rawFromJid = message.from || rawRemoteJid;
            const isFromMe = message.key?.fromMe === true;
            const rawMessageText = message.body;
            const messageTimestamp = message.messageTimestamp || Math.floor(Date.now() / 1000);
            const pushName = message.pushName;
            
            // CRITICAL: Normalize JIDs using centralized jidUtils
            // This prevents bugs like "@lidid" and ensures consistent lookups
            const normalizedJid = normalizeRawJid(rawRemoteJid);
            const stableKey = toStableKey(rawRemoteJid);
            
            // Debug: Log JID normalization to catch issues
            if (!isValidJid(rawRemoteJid)) {
                console.error(`[BotService] INVALID JID DETECTED: "${rawRemoteJid}"`);
            }
            debugJid('message', rawRemoteJid);
            
            // Use normalized JID for all operations
            const chatJid = normalizedJid || rawFromJid;
            
            // Store pushName for contact display names (existing ContactStoreService)
            if (pushName && !isFromMe && stableKey) {
                console.log(`[BotService] Storing pushName="${pushName}" for stableKey=${stableKey}`);
                this.contactStore.setDisplayName(rawRemoteJid, pushName, 'pushName');
                this.chatState.setDisplayName(rawRemoteJid, pushName);
            }
            
            // ==========================================
            // IDENTITY RESOLUTION: Link message to Contact & Students
            // ==========================================
            let identityResolution: SenderResolution | null = null;
            let studentNames: string[] = [];
            
            // Only resolve identity for non-group, inbound messages
            if (!isFromMe && !isGroupJid(rawRemoteJid) && normalizedJid) {
                try {
                    identityResolution = await this.identityService.resolveSender(normalizedJid);
                    
                    if (identityResolution.isKnown && identityResolution.contactId) {
                        console.log(`[BotService] Identity resolved: contactId=${identityResolution.contactId}, studentIds=[${identityResolution.studentIds.join(',')}]`);
                        
                        // Update ContactsRepo displayName if pushName exists and is different/empty
                        if (pushName && identityResolution.contact) {
                            const currentDisplayName = identityResolution.contact.displayName;
                            if (!currentDisplayName || currentDisplayName !== pushName) {
                                try {
                                    const contactsRepo = ContactsRepository.getInstance();
                                    await contactsRepo.update(identityResolution.contactId, {
                                        displayName: pushName
                                    });
                                    console.log(`[BotService] Updated ContactsRepo displayName for ${identityResolution.contactId}: "${currentDisplayName}" -> "${pushName}"`);
                                } catch (updateErr: any) {
                                    console.warn(`[BotService] Failed to update contact displayName:`, updateErr.message);
                                }
                            }
                        }
                        
                        // Fetch student names for enriched events
                        if (identityResolution.studentIds.length > 0) {
                            try {
                                const studentsRepo = StudentsRepository.getInstance();
                                for (const studentId of identityResolution.studentIds) {
                                    const student = await studentsRepo.findById(studentId);
                                    if (student) {
                                        studentNames.push(`${student.firstName} ${student.lastName}`);
                                    }
                                }
                                if (studentNames.length > 0) {
                                    console.log(`[BotService] Resolved students: [${studentNames.join(', ')}]`);
                                }
                            } catch (studentErr: any) {
                                console.warn(`[BotService] Failed to fetch student names:`, studentErr.message);
                            }
                        }
                    } else {
                        console.log(`[BotService] Unknown sender: phone=${identityResolution.phone}`);
                    }
                } catch (identityErr: any) {
                    console.warn(`[BotService] Identity resolution failed:`, identityErr.message);
                }
            }
            
            // Track unread count for inbound messages
            if (!isFromMe && stableKey) {
                this.chatState.onInboundMessage(rawRemoteJid, messageTimestamp, false);
            }
            
            // Get display name for frontend (includes fallback logic)
            const senderDisplayName = this.contactStore.getDisplayNameWithFallback(
                rawRemoteJid,
                pushName || message.name || message.verifiedBizName
            );

            // Emit raw message to frontend with resolved display name, normalized JID, and identity
            this.io?.emit('message:new', {
                ...message,
                jid: normalizedJid, // Use normalized JID
                stableKey,          // Include stable key for frontend
                senderDisplayName,
                // Identity enrichment
                contactId: identityResolution?.contactId || null,
                studentIds: identityResolution?.studentIds || [],
                studentNames
            });

            // Emit chat:updated event for real-time chat list updates
            // This ensures frontend can update chat list immediately
            if (!isFromMe && stableKey) {
                const unreadCount = this.chatState.getUnreadCount(rawRemoteJid);
                this.io?.emit('chat:updated', {
                    jid: normalizedJid || rawRemoteJid,
                    stableKey,
                    displayName: senderDisplayName,
                    unreadCount,
                    lastMessageTime: messageTimestamp,
                    lastMessage: rawMessageText || '',
                    // Identity enrichment
                    contactId: identityResolution?.contactId || null,
                    studentIds: identityResolution?.studentIds || [],
                    studentNames
                });
            }

            // Validate and sanitize message
            const messageText = this.sanitizeMessage(rawMessageText);

            // Anti-loop and validation checks (use normalized JID)
            const skipCheck = this.shouldSkipMessage(chatJid, messageText, isFromMe);
            if (skipCheck.skip) {
                if (skipCheck.reason !== 'own_message') {
                    console.log(`[BotService] Skipping message: ${skipCheck.reason}`);
                }
                return;
            }

            // Mark as processing to prevent concurrent handling
            this.processingMessages.add(chatJid);

            // Record message received metric
            const isGroup = isGroupJid(rawRemoteJid);
            this.metrics.messageReceived(chatJid, messageText.length, isGroup);

            // Check if message should activate the bot based on triggers
            const triggerCheck = this.triggerService.shouldActivateBot(messageText, chatJid);
            if (!triggerCheck.activate) {
                console.log(`[BotService] Message skipped - listener disabled or no trigger matched`);
                this.processingMessages.delete(chatJid);
                return;
            }

            // Log matched triggers if any
            if (triggerCheck.triggers.length > 0) {
                console.log(`[BotService] Triggers matched: ${triggerCheck.triggers.map(t => t.keyword).join(', ')}`);
                // Emit trigger event to frontend
                this.io?.emit('trigger:matched', {
                    jid: chatJid,
                    message: messageText,
                    triggers: triggerCheck.triggers.map(t => ({ id: t.id, keyword: t.keyword, category: t.category }))
                });
            }

            try {
                // Use resolved display name for bot responses
                const customerName = senderDisplayName || 'Cliente';

                const orchestrator = BotOrchestrator.getInstance();
                const response = await orchestrator.processMessage(chatJid, messageText, isFromMe, customerName);

                if (response && response.response) {
                    // Show typing indicator
                    await this.sendPresenceUpdate(chatJid, 'composing').catch(() => {});

                    // Add a small delay to simulate typing
                    const config = orchestrator.getConfig();
                    if (config.settings.typingIndicator) {
                        await new Promise(resolve => setTimeout(resolve, config.settings.typingDelayMs));
                    }

                    // Rate limit check before sending
                    await this.waitForRateLimit(chatJid);

                    // Send the response
                    await this.sendText(chatJid, response.response);

                    // Track sent message for anti-loop
                    this.sentMessages.set(chatJid, {
                        lastSentAt: Date.now(),
                        messageHash: this.hashMessage(chatJid, response.response)
                    });

                    // Emit bot response event for frontend
                    this.io?.emit('bot:response', {
                        jid: chatJid,
                        response: response.response,
                        source: response.source,
                        confidence: response.confidence
                    });

                    await this.sendPresenceUpdate(chatJid, 'paused').catch(() => {});

                    console.log(`[BotService] Response sent to ${chatJid} (source: ${response.source})`);
                }
            } catch (error: any) {
                console.error(`[BotService] Error processing message from ${chatJid}:`, error.message || error);
                this.metrics.error('message_processing', error.message || String(error), chatJid);
                await this.sendPresenceUpdate(chatJid, 'paused').catch(() => {});
            } finally {
                // Always remove from processing set
                this.processingMessages.delete(chatJid);
            }
        });

        this.bot.on('require_action', (action: any) => {
            this.io?.emit('require_action', action);
        });

        this.bot.on('history_sync', (payload: any) => {
            const chatsCount = payload.chats?.length || 0;
            const contactsCount = payload.contacts?.length || 0;
            const messagesCount = payload.messages?.length || 0;
            console.log(`[BotService] History Sync: ${chatsCount} chats, ${contactsCount} contacts, ${messagesCount} messages`);
            
            this.io?.emit('sync:history', {
                chatsCount,
                contactsCount,
                messagesCount,
                isLatest: payload.isLatest
            });
        });

        this.bot.on('chats_upsert', (chats: any[]) => {
            console.log(`[BotService] Chats upsert: ${chats?.length || 0} chats`);
            this.io?.emit('sync:chats', chats);
        });
    }

    // AI Control Methods
    async updateGeminiApiKey(apiKey: string): Promise<void> {
        const orchestrator = BotOrchestrator.getInstance();
        orchestrator.initGemini(apiKey);
        console.log('Gemini API Key updated via BotOrchestrator');
    }

    toggleBot(jid: string, active: boolean): void {
        const orchestrator = BotOrchestrator.getInstance();
        orchestrator.toggleChat(jid, active);
    }

    isBotActive(jid: string): boolean {
        // Use BotOrchestrator as primary source
        const orchestrator = BotOrchestrator.getInstance();
        return orchestrator.isChatActive(jid);
    }

    getBot(): BaileysClass | null {
        return this.bot;
    }

    getConnectionStatus(): ConnectionStatus {
        return this.connectionStatus;
    }

    getCurrentQR(): string | null {
        return this.currentQR;
    }

    getStore(): any {
        return this.bot?.store || null;
    }

    getSocket(): any {
        return (this.bot as any)?.vendor || null;
    }

    async getContactsFromSession(): Promise<any[]> {
        const contacts: any[] = [];
        const seenJids = new Set<string>();
        const fs = require('fs');
        const sessionDir = './web-bot_sessions';
        
        try {
            if (!fs.existsSync(sessionDir)) return contacts;
            
            const files = fs.readdirSync(sessionDir);
            const sessionFiles = files.filter((f: string) => f.startsWith('session-') && f.endsWith('.json'));
            
            for (const file of sessionFiles) {
                // Extract phone number from filename like "session-18093195369.0.json"
                const match = file.match(/session-(\d+)\./);
                if (match) {
                    const phoneNumber = match[1];
                    const jid = `${phoneNumber}@s.whatsapp.net`;
                    
                    // Avoid duplicates
                    if (seenJids.has(jid)) continue;
                    seenJids.add(jid);
                    
                    contacts.push({
                        jid,
                        name: phoneNumber,
                        isGroup: false
                    });
                }
            }
        } catch (error) {
            console.error('Error reading session contacts:', error);
        }
        
        return contacts;
    }

    /**
     * Force refresh and sync contacts from WhatsApp
     */
    async refreshContacts(): Promise<any[]> {
        if (!this.bot) {
            console.log('Bot not initialized for contact refresh');
            return [];
        }

        const store = this.getStore();
        if (!store) {
            console.log('Store not available for contact refresh');
            return [];
        }

        try {
            console.log('Forcing contact sync...');
            
            // Try to trigger contact sync
            const socket = this.getSocket();
            if (socket) {
                // Send a presence update which might trigger contact sync
                await socket.sendPresenceUpdate('available');
                
                // Wait a bit for contacts to sync
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            // Get all contacts from store with enhanced name resolution
            const allStoreContacts = store.contacts || {};
            const contactsArray = Array.isArray(allStoreContacts) ? allStoreContacts : Object.values(allStoreContacts);

            const enhancedContacts = contactsArray
                .filter((contact: any) => contact && contact.id && !contact.id?.includes('@g.us'))
                .map((contact: any) => {
                    const phoneNumber = contact.id?.split('@')[0];
                    return {
                        jid: contact.id,
                        name: contact.name || 
                              contact.pushName || 
                              contact.verifiedName || 
                              contact.formattedName || 
                              contact.notify || 
                              `+${phoneNumber}`,
                        pushName: contact.pushName,
                        verifiedName: contact.verifiedName,
                        isBusiness: contact.isBusiness || false,
                        profilePicUrl: null // Will be filled separately
                    };
                });

            console.log(`Refreshed ${enhancedContacts.length} contacts from WhatsApp`);
            return enhancedContacts;

        } catch (error: any) {
            console.error('Error refreshing contacts:', error.message);
            return [];
        }
    }

    async fetchMessagesFromWA(jid: string, count: number): Promise<any[]> {
        if (!this.bot) {
            console.log('Bot not initialized');
            return [];
        }
        
        try {
            console.log(`Attempting to fetch ${count} messages for ${jid}`);
            // Use BaileysClass method to fetch message history
            const messages = await this.bot.fetchMessageHistory(jid, count);
            console.log(`fetchMessageHistory returned ${messages.length} messages for ${jid}`);
            
            // If no messages, try some additional approaches
            if (messages.length === 0) {
                console.log(`No messages from fetchMessageHistory, trying alternative methods for ${jid}`);
                
                // Try to trigger sync by checking if we can access the socket directly
                const socket = this.getSocket();
                if (socket) {
                    try {
                        // Try to send a presence update to trigger sync
                        await socket.sendPresenceUpdate('available', jid);
                        console.log(`Sent presence update to trigger sync for ${jid}`);
                        
                        // Wait a moment and try again
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        const retryMessages = await this.bot.fetchMessageHistory(jid, count);
                        if (retryMessages.length > 0) {
                            console.log(`Retry fetched ${retryMessages.length} messages for ${jid}`);
                            return retryMessages;
                        }
                    } catch (presenceError) {
                        console.warn(`Presence update failed for ${jid}:`, presenceError);
                    }
                }
                
                // Final fallback to store
                const storeMessages = this.bot.getMessagesFromStore(jid, count);
                console.log(`Fallback store returned ${storeMessages.length} messages for ${jid}`);
                return storeMessages;
            }
            
            return messages;
        } catch (error: any) {
            console.error(`Failed to fetch messages for ${jid}:`, error.message);
            // Fallback to store
            try {
                const storeMessages = this.bot.getMessagesFromStore(jid, count);
                console.log(`Error fallback store returned ${storeMessages.length} messages for ${jid}`);
                return storeMessages;
            } catch (storeError) {
                console.error(`Store fallback also failed for ${jid}:`, storeError);
                return [];
            }
        }
    }

    async getProfilePictureUrl(jid: string): Promise<string | null> {
        if (!this.bot) return null;
        return this.bot.getProfilePictureUrl(jid);
    }

    // Message sending methods
    async sendText(number: string, message: string): Promise<any> {
        if (!this.bot) throw new Error('Bot not initialized');
        return this.bot.sendText(number, message);
    }

    async sendMedia(number: string, mediaUrl: string, caption: string = ''): Promise<any> {
        if (!this.bot) throw new Error('Bot not initialized');
        return this.bot.sendMedia(number, mediaUrl, caption);
    }

    async sendImage(number: string, filePath: string, caption: string = ''): Promise<any> {
        if (!this.bot) throw new Error('Bot not initialized');
        return this.bot.sendImage(number, filePath, caption);
    }

    async sendVideo(number: string, filePath: string, caption: string = ''): Promise<any> {
        if (!this.bot) throw new Error('Bot not initialized');
        return this.bot.sendVideo(number, filePath, caption);
    }

    async sendAudio(number: string, audioUrl: string): Promise<any> {
        if (!this.bot) throw new Error('Bot not initialized');
        return this.bot.sendAudio(number, audioUrl);
    }

    async sendFile(number: string, filePath: string): Promise<any> {
        if (!this.bot) throw new Error('Bot not initialized');
        return this.bot.sendFile(number, filePath);
    }

    async sendPoll(number: string, text: string, options: string[]): Promise<any> {
        if (!this.bot) throw new Error('Bot not initialized');
        return this.bot.sendPoll(number, text, { options });
    }

    async sendLocation(remoteJid: string, latitude: string, longitude: string): Promise<any> {
        if (!this.bot) throw new Error('Bot not initialized');
        return this.bot.sendLocation(remoteJid, latitude, longitude);
    }

    async sendContact(remoteJid: string, contactNumber: string, displayName: string): Promise<any> {
        if (!this.bot) throw new Error('Bot not initialized');
        return this.bot.sendContact(remoteJid, contactNumber, displayName);
    }

    async sendSticker(remoteJid: string, url: string, stickerOptions: any = {}): Promise<any> {
        if (!this.bot) throw new Error('Bot not initialized');
        return this.bot.sendSticker(remoteJid, url, stickerOptions);
    }

    async sendPresenceUpdate(remoteJid: string, presence: string): Promise<void> {
        if (!this.bot) throw new Error('Bot not initialized');
        return this.bot.sendPresenceUpdate(remoteJid, presence);
    }

    // ==========================================
    // Read Receipt Methods
    // ==========================================

    /**
     * Mark messages as read and send read receipts to WhatsApp
     */
    async markMessagesAsRead(jid: string, messageIds?: string[]): Promise<boolean> {
        if (!this.bot) throw new Error('Bot not initialized');
        
        // Convert message IDs to keys if provided
        let messageKeys: any[] | undefined;
        if (messageIds && messageIds.length > 0) {
            messageKeys = messageIds.map(id => ({
                remoteJid: jid,
                id: id,
                fromMe: false
            }));
        }
        
        return this.bot.markMessagesAsRead(jid, messageKeys);
    }

    /**
     * Get unread count for a chat
     */
    getUnreadCount(jid: string): number {
        if (!this.bot) return 0;
        return this.bot.getUnreadCount(jid);
    }

    // ==========================================
    // WhatsApp Group Methods
    // ==========================================

    /**
     * Get all WhatsApp groups the user is part of
     */
    async getWhatsAppGroups(): Promise<any[]> {
        if (!this.bot) throw new Error('Bot not initialized');
        const store = this.getStore();
        if (!store?.chats) return [];

        const groups: any[] = [];
        for (const [jid, chat] of Object.entries(store.chats) as any) {
            if (jid.endsWith('@g.us')) {
                groups.push({
                    id: jid,
                    name: (chat as any).name || (chat as any).subject || jid,
                    ...chat
                });
            }
        }
        return groups;
    }

    /**
     * Get metadata for a specific WhatsApp group
     */
    async getGroupMetadata(groupJid: string): Promise<any> {
        if (!this.bot) throw new Error('Bot not initialized');
        const socket = this.getSocket();
        if (!socket) throw new Error('Socket not available');

        try {
            return await socket.groupMetadata(groupJid);
        } catch (error: any) {
            console.error(`Failed to get group metadata for ${groupJid}:`, error.message);
            throw error;
        }
    }

    /**
     * Create a new WhatsApp group
     */
    async createWhatsAppGroup(name: string, participants: string[]): Promise<any> {
        if (!this.bot) throw new Error('Bot not initialized');
        const socket = this.getSocket();
        if (!socket) throw new Error('Socket not available');

        try {
            return await socket.groupCreate(name, participants);
        } catch (error: any) {
            console.error('Failed to create group:', error.message);
            throw error;
        }
    }

    /**
     * Update WhatsApp group subject (name)
     */
    async updateGroupSubject(groupJid: string, subject: string): Promise<void> {
        if (!this.bot) throw new Error('Bot not initialized');
        const socket = this.getSocket();
        if (!socket) throw new Error('Socket not available');

        try {
            await socket.groupUpdateSubject(groupJid, subject);
        } catch (error: any) {
            console.error('Failed to update group subject:', error.message);
            throw error;
        }
    }

    /**
     * Update WhatsApp group description
     */
    async updateGroupDescription(groupJid: string, description: string): Promise<void> {
        if (!this.bot) throw new Error('Bot not initialized');
        const socket = this.getSocket();
        if (!socket) throw new Error('Socket not available');

        try {
            await socket.groupUpdateDescription(groupJid, description);
        } catch (error: any) {
            console.error('Failed to update group description:', error.message);
            throw error;
        }
    }

    /**
     * Add participants to a WhatsApp group
     */
    async addGroupParticipants(groupJid: string, participants: string[]): Promise<any> {
        if (!this.bot) throw new Error('Bot not initialized');
        const socket = this.getSocket();
        if (!socket) throw new Error('Socket not available');

        try {
            return await socket.groupParticipantsUpdate(groupJid, participants, 'add');
        } catch (error: any) {
            console.error('Failed to add participants:', error.message);
            throw error;
        }
    }

    /**
     * Remove participants from a WhatsApp group
     */
    async removeGroupParticipants(groupJid: string, participants: string[]): Promise<any> {
        if (!this.bot) throw new Error('Bot not initialized');
        const socket = this.getSocket();
        if (!socket) throw new Error('Socket not available');

        try {
            return await socket.groupParticipantsUpdate(groupJid, participants, 'remove');
        } catch (error: any) {
            console.error('Failed to remove participants:', error.message);
            throw error;
        }
    }

    /**
     * Promote participants to admin in a WhatsApp group
     */
    async promoteGroupParticipants(groupJid: string, participants: string[]): Promise<any> {
        if (!this.bot) throw new Error('Bot not initialized');
        const socket = this.getSocket();
        if (!socket) throw new Error('Socket not available');

        try {
            return await socket.groupParticipantsUpdate(groupJid, participants, 'promote');
        } catch (error: any) {
            console.error('Failed to promote participants:', error.message);
            throw error;
        }
    }

    /**
     * Demote admins to regular participants in a WhatsApp group
     */
    async demoteGroupParticipants(groupJid: string, participants: string[]): Promise<any> {
        if (!this.bot) throw new Error('Bot not initialized');
        const socket = this.getSocket();
        if (!socket) throw new Error('Socket not available');

        try {
            return await socket.groupParticipantsUpdate(groupJid, participants, 'demote');
        } catch (error: any) {
            console.error('Failed to demote participants:', error.message);
            throw error;
        }
    }

    /**
     * Leave a WhatsApp group
     */
    async leaveGroup(groupJid: string): Promise<void> {
        if (!this.bot) throw new Error('Bot not initialized');
        const socket = this.getSocket();
        if (!socket) throw new Error('Socket not available');

        try {
            await socket.groupLeave(groupJid);
        } catch (error: any) {
            console.error('Failed to leave group:', error.message);
            throw error;
        }
    }

    /**
     * Get group invite code
     */
    async getGroupInviteCode(groupJid: string): Promise<string> {
        if (!this.bot) throw new Error('Bot not initialized');
        const socket = this.getSocket();
        if (!socket) throw new Error('Socket not available');

        try {
            return await socket.groupInviteCode(groupJid);
        } catch (error: any) {
            console.error('Failed to get invite code:', error.message);
            throw error;
        }
    }

    /**
     * Revoke group invite code
     */
    async revokeGroupInviteCode(groupJid: string): Promise<string> {
        if (!this.bot) throw new Error('Bot not initialized');
        const socket = this.getSocket();
        if (!socket) throw new Error('Socket not available');

        try {
            return await socket.groupRevokeInvite(groupJid);
        } catch (error: any) {
            console.error('Failed to revoke invite code:', error.message);
            throw error;
        }
    }

    /**
     * Join a group via invite code
     */
    async joinGroupViaInvite(inviteCode: string): Promise<string> {
        if (!this.bot) throw new Error('Bot not initialized');
        const socket = this.getSocket();
        if (!socket) throw new Error('Socket not available');

        try {
            return await socket.groupAcceptInvite(inviteCode);
        } catch (error: any) {
            console.error('Failed to join group:', error.message);
            throw error;
        }
    }

    /**
     * Update group settings (who can send messages, edit info)
     */
    async updateGroupSettings(groupJid: string, setting: 'announcement' | 'not_announcement' | 'locked' | 'unlocked'): Promise<void> {
        if (!this.bot) throw new Error('Bot not initialized');
        const socket = this.getSocket();
        if (!socket) throw new Error('Socket not available');

        try {
            await socket.groupSettingUpdate(groupJid, setting);
        } catch (error: any) {
            console.error('Failed to update group settings:', error.message);
            throw error;
        }
    }

    /**
     * Get the ChatStateService instance for external use.
     */
    getChatStateService(): ChatStateService {
        return this.chatState;
    }

    /**
     * Get the ContactStoreService instance for external use.
     */
    getContactStoreService(): ContactStoreService {
        return this.contactStore;
    }

    /**
     * Mark a chat as read using ChatStateService.
     * This is the preferred method for marking chats as read.
     */
    markChatAsRead(jid: string): void {
        this.chatState.markAsRead(jid);
    }
}

export default BotService;
