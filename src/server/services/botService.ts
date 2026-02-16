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
import { MessageProcessor } from '../utils/messageProcessor';
import { WhatsAppRateLimiter } from '../utils/whatsappRateLimiter';
import { getErrorMessage } from '../utils/errorUtils';

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

    // Message Processor for thread-safe message handling
    private messageProcessor: MessageProcessor;

    // Rate limiter for WhatsApp message sending
    private rateLimiter: WhatsAppRateLimiter;

    // Store interval references for proper shutdown
    private trackerCleanupInterval: ReturnType<typeof setInterval> | null = null;

    private constructor() {
        this.messageProcessor = new MessageProcessor();
        this.metrics = MetricsService.getInstance();
        this.contactStore = ContactStoreService.getInstance();
        this.chatState = ChatStateService.getInstance();
        this.identityService = IdentityService.getInstance();
        this.triggerService = TriggerService.getInstance();
        this.rateLimiter = WhatsAppRateLimiter.getInstance();
        // Clean up old tracking data periodically (store reference for shutdown)
        this.trackerCleanupInterval = setInterval(() => this.cleanupTrackers(), 60000);
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
        if (!isValidJid(jid)) {
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

        // Note: MessageProcessor now handles concurrent processing
        // This check is no longer needed here

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

        // Initialize AI via BotOrchestrator (singleton constructor handles env bootstrapping)
        const orchestrator = BotOrchestrator.getInstance();
        if (!process.env.GEMINI_API_KEY) {
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

            // Get connection health for monitoring
            if (this.bot && typeof this.bot.getConnectionHealth === 'function') {
                const health = this.bot.getConnectionHealth();
                console.log('[BotService] Connection health:', health);
                this.io?.emit('connection:health', health);
            }

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

        this.bot.on('max_reconnect_reached', (data: any) => {
            this.connectionStatus = 'disconnected';
            this.io?.emit('connection:status', this.connectionStatus);
            this.io?.emit('session:max_reconnect', {
                ...data,
                message: 'Max reconnection attempts reached. Use the reconnect button to try again.',
                timestamp: Date.now()
            });
            this.metrics.connectionStatus('disconnected');
            this.metrics.error('max_reconnect', `Attempts: ${data.attempts}, status: ${data.lastStatusCode}`);
        });

        this.bot.on('auth_failure', (error: any) => {
            this.connectionStatus = 'disconnected';

            // Enhanced error handling for MAC/corruption errors
            const errorMessage = String(error).toLowerCase();
            const isCorruptionError = errorMessage.includes('bad mac') ||
                errorMessage.includes('corrupt') ||
                errorMessage.includes('mac verification') ||
                errorMessage.includes('libsignal');

            if (isCorruptionError) {
                console.error('[BotService] Session corruption detected in auth_failure:', error);
                // Emit specific event for corruption
                this.io?.emit('session:corruption', {
                    error: String(error),
                    type: 'mac_error',
                    timestamp: Date.now()
                });
            }

            this.io?.emit('auth_failure', {
                error: String(error),
                isCorruptionError,
                timestamp: Date.now()
            });
            this.io?.emit('connection:status', this.connectionStatus);

            // Record connection failure metric
            this.metrics.connectionStatus('disconnected');
            this.metrics.error('auth', String(error));

            if (isCorruptionError) {
                this.metrics.error('session_corruption', String(error));
            }
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

            // Use MessageProcessor for thread-safe message processing
            try {
                const processResult = await this.messageProcessor.processMessage(chatJid, {
                    id: message.key?.id || `msg-${Date.now()}`,
                    messageText,
                    isFromMe,
                    rawRemoteJid,
                    context: {
                        senderDisplayName,
                        pushName,
                        messageTimestamp
                    },
                    botService: this // Pass botService instance for internal logic
                });

                if (processResult?.skipped) {
                    console.log(`[BotService] Message skipped via MessageProcessor: ${processResult.reason}`);
                    return;
                }

                console.log(`[BotService] Message processed successfully via MessageProcessor`);
            } catch (error: unknown) {
                console.error(`[BotService] MessageProcessor error for ${chatJid}:`, getErrorMessage(error) || error);
                this.metrics.error('message_processing', getErrorMessage(error) || String(error), chatJid);
                await this.sendPresenceUpdate(chatJid, 'paused').catch(() => { });
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

        } catch (error: unknown) {
            console.error('Error refreshing contacts:', getErrorMessage(error));
            return [];
        }
    }

    async fetchMessagesFromWA(jid: string, count: number, beforeMessageId?: string): Promise<any[]> {
        if (!this.bot) {
            console.log('Bot not initialized');
            return [];
        }

        try {
            console.log(`Attempting to fetch ${count} messages for ${jid}${beforeMessageId ? ` before ${beforeMessageId}` : ''}`);

            // 1. Try to use Baileys fetchMessageHistory with pagination support
            const messages = await this.bot.fetchMessageHistory(jid, count, beforeMessageId);
            console.log(`fetchMessageHistory returned ${messages.length} messages for ${jid}`);

            // 2. If no messages, try enhanced sync methods
            if (messages.length === 0) {
                console.log(`No messages from fetchMessageHistory, trying enhanced sync for ${jid}`);

                const syncMessages = await this.enhancedMessageSync(jid, count);
                if (syncMessages.length > 0) {
                    console.log(`Enhanced sync fetched ${syncMessages.length} messages for ${jid}`);
                    return syncMessages;
                }
            }

            // 3. Process and normalize messages
            const processedMessages = this.processMessagesHistory(messages, jid);
            console.log(`Processed ${processedMessages.length} messages for ${jid}`);

            return processedMessages;
        } catch (error: unknown) {
            console.error(`Failed to fetch messages for ${jid}:`, getErrorMessage(error));

            // Fallback to store with enhanced processing
            try {
                const storeMessages = this.bot.getMessagesFromStore(jid, count);
                const processedStoreMessages = this.processMessagesHistory(storeMessages, jid);
                console.log(`Error fallback processed ${processedStoreMessages.length} messages for ${jid}`);
                return processedStoreMessages;
            } catch (storeError) {
                console.error(`Store fallback also failed for ${jid}:`, storeError);
                return [];
            }
        }
    }

    /**
     * Enhanced message synchronization using multiple Baileys approaches
     */
    private async enhancedMessageSync(jid: string, count: number): Promise<any[]> {
        const socket = this.getSocket();
        if (!socket) return [];

        try {
            // Method 1: Try chatModify to trigger history sync
            try {
                const canonicalJid = `${jid.split('@')[0]}@s.whatsapp.net`;
                // Generate a random ID for the message key to avoid "Incomplete key" error
                const randomId = Math.random().toString(36).substring(2, 12).toUpperCase();
                await socket.chatModify(
                    { lastMessages: [{ key: { remoteJid: canonicalJid, fromMe: true, id: randomId }, messageTimestamp: Math.floor(Date.now() / 1000) }], clear: false },
                    canonicalJid
                );
                console.log(`ChatModify sent for ${canonicalJid} with ID ${randomId}`);

                // Wait for sync to complete
                await new Promise(resolve => setTimeout(resolve, 3000));

                // Try fetching again after sync
                if (!this.bot) throw new Error('Bot not available');
                const retryMessages = await this.bot.fetchMessageHistory(jid, count);
                if (retryMessages.length > 0) {
                    return retryMessages;
                }
            } catch (chatModifyError: any) {
                console.warn(`ChatModify failed for ${jid}:`, chatModifyError.message);
            }

            // Method 2: Try presence update to trigger sync
            try {
                await socket.sendPresenceUpdate('available', jid);
                console.log(`Presence update sent for ${jid}`);

                await new Promise(resolve => setTimeout(resolve, 2000));

                if (!this.bot) throw new Error('Bot not available');
                const presenceMessages = await this.bot.fetchMessageHistory(jid, count);
                if (presenceMessages.length > 0) {
                    return presenceMessages;
                }
            } catch (presenceError: any) {
                console.warn(`Presence update failed for ${jid}:`, presenceError.message);
            }

            // Method 3: Try to load messages directly if available
            try {
                if (socket.loadMessages) {
                    const loadedMessages = await socket.loadMessages(jid, count);
                    if (loadedMessages && loadedMessages.length > 0) {
                        console.log(`Loaded ${loadedMessages.length} messages using loadMessages`);
                        return loadedMessages;
                    }
                }
            } catch (loadError) {
                console.warn(`loadMessages failed for ${jid}:`, loadError.message);
            }

            return [];
        } catch (error: unknown) {
            console.error(`Enhanced sync failed for ${jid}:`, getErrorMessage(error));
            return [];
        }
    }

    /**
     * Process and normalize message history for consistent frontend consumption
     */
    private processMessagesHistory(messages: any[], jid: string): any[] {
        if (!Array.isArray(messages)) return [];

        return messages
            .filter(msg => msg && msg.key && msg.message) // Filter valid messages
            .map(msg => {
                // Extract message content using the same logic as the message handler
                const messageText = this.extractMessageText(msg.message);
                const messageType = this.extractMessageType(msg.message);

                return {
                    id: msg.key?.id,
                    from: msg.key?.remoteJid || jid,
                    fromMe: msg.key?.fromMe || false,
                    body: messageText,
                    type: messageType,
                    timestamp: msg.messageTimestamp || Date.now(),
                    pushName: msg.pushName,
                    // Enhanced metadata for different message types
                    mediaUrl: this.extractMediaUrl(msg.message),
                    fileName: this.extractFileName(msg.message),
                    fileSize: this.extractFileSize(msg.message),
                    duration: this.extractDuration(msg.message),
                    location: this.extractLocation(msg.message),
                    contactInfo: this.extractContactInfo(msg.message),
                    // Group message metadata
                    participant: msg.key?.participant,
                    // Message status and ack
                    status: msg.status || 0,
                    ack: msg.ack || 0,
                    // Raw message for advanced processing
                    raw: msg
                };
            })
            .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)); // Sort by timestamp ascending
    }

    /**
     * Extract message text content
     */
    private extractMessageText(message: any): string {
        if (!message) return '';

        return message.conversation ||
            message.extendedTextMessage?.text ||
            message.imageMessage?.caption ||
            message.videoMessage?.caption ||
            message.documentMessage?.caption ||
            message.locationMessage?.name ||
            message.contactMessage?.vcard?.name ||
            message.buttonsResponseMessage?.selectedDisplayText ||
            message.listResponseMessage?.title ||
            '';
    }

    /**
     * Extract message type
     */
    private extractMessageType(message: any): string {
        if (!message) return 'unknown';

        if (message.conversation || message.extendedTextMessage) return 'text';
        if (message.imageMessage) return 'image';
        if (message.videoMessage) return 'video';
        if (message.audioMessage) return 'audio';
        if (message.stickerMessage) return 'sticker';
        if (message.documentMessage) return 'document';
        if (message.locationMessage) return 'location';
        if (message.contactMessage) return 'contact';
        if (message.buttonsResponseMessage) return 'button_response';
        if (message.listResponseMessage) return 'list_response';
        if (message.pollMessage) return 'poll';

        return 'unknown';
    }

    /**
     * Extract media URL for media messages
     */
    private extractMediaUrl(message: any): string | null {
        if (!message) return null;

        const mediaMessage = message.imageMessage ||
            message.videoMessage ||
            message.documentMessage ||
            message.stickerMessage ||
            message.audioMessage;

        return mediaMessage?.url || null;
    }

    /**
     * Extract filename for document messages
     */
    private extractFileName(message: any): string | null {
        if (!message?.documentMessage) return null;
        return message.documentMessage.fileName || null;
    }

    /**
     * Extract file size for media messages
     */
    private extractFileSize(message: any): number | null {
        if (!message) return null;

        const mediaMessage = message.imageMessage ||
            message.videoMessage ||
            message.documentMessage ||
            message.audioMessage;

        return mediaMessage?.fileLength || null;
    }

    /**
     * Extract duration for audio messages
     */
    private extractDuration(message: any): number | null {
        if (!message?.audioMessage) return null;
        return message.audioMessage.seconds || null;
    }

    /**
     * Extract location data
     */
    private extractLocation(message: any): { lat: number; lng: number; name?: string } | null {
        if (!message?.locationMessage) return null;

        return {
            lat: message.locationMessage.degreesLatitude,
            lng: message.locationMessage.degreesLongitude,
            name: message.locationMessage.name
        };
    }

    /**
     * Extract contact information
     */
    private extractContactInfo(message: any): { name: string; vcard: string } | null {
        if (!message?.contactMessage) return null;

        return {
            name: message.contactMessage.displayName,
            vcard: message.contactMessage.vcard
        };
    }

    async getProfilePictureUrl(jid: string): Promise<string | null> {
        if (!this.bot) return null;
        return this.bot.getProfilePictureUrl(jid);
    }

    // ==========================================
    // Rate-Limited Message Sending
    // ==========================================

    /**
     * Enforce rate limiting before sending a message.
     * Waits for a slot or throws if daily limit exceeded.
     */
    private async enforceRateLimit(jid: string, messageType: 'text' | 'media' = 'text'): Promise<void> {
        const result = await this.rateLimiter.waitForSendSlot(jid, messageType);

        if (!result.allowed) {
            const errorMsg = `Rate limit: ${result.reason} for ${jid} (waited ${result.waitedMs}ms)`;
            console.warn(`[BotService] ${errorMsg}`);
            this.metrics.error('rate_limit', errorMsg, jid);
            throw new Error(errorMsg);
        }

        if (result.waitedMs > 0) {
            console.log(`[BotService] Rate limiter: waited ${result.waitedMs}ms before sending to ${jid}`);
        }
    }

    /**
     * Record a successfully sent message in the rate limiter.
     */
    private recordSentMessage(jid: string, messageType: 'text' | 'media' = 'text'): void {
        this.rateLimiter.recordSentMessage(jid, messageType);
    }

    // Message sending methods (all rate-limited)
    async sendText(number: string, message: string): Promise<any> {
        if (!this.bot) throw new Error('Bot not initialized');
        await this.enforceRateLimit(number, 'text');
        const result = await this.bot.sendText(number, message);
        this.recordSentMessage(number, 'text');
        return result;
    }

    async sendMedia(number: string, mediaUrl: string, caption: string = ''): Promise<any> {
        if (!this.bot) throw new Error('Bot not initialized');
        await this.enforceRateLimit(number, 'media');
        const result = await this.bot.sendMedia(number, mediaUrl, caption);
        this.recordSentMessage(number, 'media');
        return result;
    }

    async sendImage(number: string, filePath: string, caption: string = ''): Promise<any> {
        if (!this.bot) throw new Error('Bot not initialized');
        await this.enforceRateLimit(number, 'media');
        const result = await this.bot.sendImage(number, filePath, caption);
        this.recordSentMessage(number, 'media');
        return result;
    }

    async sendVideo(number: string, filePath: string, caption: string = ''): Promise<any> {
        if (!this.bot) throw new Error('Bot not initialized');
        await this.enforceRateLimit(number, 'media');
        const result = await this.bot.sendVideo(number, filePath, caption);
        this.recordSentMessage(number, 'media');
        return result;
    }

    async sendAudio(number: string, audioUrl: string): Promise<any> {
        if (!this.bot) throw new Error('Bot not initialized');
        await this.enforceRateLimit(number, 'media');
        const result = await this.bot.sendAudio(number, audioUrl);
        this.recordSentMessage(number, 'media');
        return result;
    }

    async sendFile(number: string, filePath: string): Promise<any> {
        if (!this.bot) throw new Error('Bot not initialized');
        await this.enforceRateLimit(number, 'media');
        const result = await this.bot.sendFile(number, filePath);
        this.recordSentMessage(number, 'media');
        return result;
    }

    async sendPoll(number: string, text: string, options: string[]): Promise<any> {
        if (!this.bot) throw new Error('Bot not initialized');
        await this.enforceRateLimit(number, 'text');
        const result = await this.bot.sendPoll(number, text, { options });
        this.recordSentMessage(number, 'text');
        return result;
    }

    async sendLocation(remoteJid: string, latitude: string, longitude: string): Promise<any> {
        if (!this.bot) throw new Error('Bot not initialized');
        await this.enforceRateLimit(remoteJid, 'text');
        const result = await this.bot.sendLocation(remoteJid, latitude, longitude);
        this.recordSentMessage(remoteJid, 'text');
        return result;
    }

    async sendContact(remoteJid: string, contactNumber: string, displayName: string): Promise<any> {
        if (!this.bot) throw new Error('Bot not initialized');
        await this.enforceRateLimit(remoteJid, 'text');
        const result = await this.bot.sendContact(remoteJid, contactNumber, displayName);
        this.recordSentMessage(remoteJid, 'text');
        return result;
    }

    async sendSticker(remoteJid: string, url: string, stickerOptions: any = {}): Promise<any> {
        if (!this.bot) throw new Error('Bot not initialized');
        await this.enforceRateLimit(remoteJid, 'media');
        const result = await this.bot.sendSticker(remoteJid, url, stickerOptions);
        this.recordSentMessage(remoteJid, 'media');
        return result;
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
        } catch (error: unknown) {
            console.error(`Failed to get group metadata for ${groupJid}:`, getErrorMessage(error));
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
        } catch (error: unknown) {
            console.error('Failed to create group:', getErrorMessage(error));
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
        } catch (error: unknown) {
            console.error('Failed to update group subject:', getErrorMessage(error));
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
        } catch (error: unknown) {
            console.error('Failed to update group description:', getErrorMessage(error));
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
        } catch (error: unknown) {
            console.error('Failed to add participants:', getErrorMessage(error));
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
        } catch (error: unknown) {
            console.error('Failed to remove participants:', getErrorMessage(error));
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
        } catch (error: unknown) {
            console.error('Failed to promote participants:', getErrorMessage(error));
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
        } catch (error: unknown) {
            console.error('Failed to demote participants:', getErrorMessage(error));
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
        } catch (error: unknown) {
            console.error('Failed to leave group:', getErrorMessage(error));
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
        } catch (error: unknown) {
            console.error('Failed to get invite code:', getErrorMessage(error));
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
        } catch (error: unknown) {
            console.error('Failed to revoke invite code:', getErrorMessage(error));
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
        } catch (error: unknown) {
            console.error('Failed to join group:', getErrorMessage(error));
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
        } catch (error: unknown) {
            console.error('Failed to update group settings:', getErrorMessage(error));
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

    /**
     * Get connection health information
     */
    getConnectionHealth(): any {
        if (this.bot && typeof this.bot.getConnectionHealth === 'function') {
            return this.bot.getConnectionHealth();
        }
        return {
            isReady: !!this.bot && this.connectionStatus === 'connected',
            connectionStatus: this.connectionStatus,
            hasBot: !!this.bot,
            error: null
        };
    }

    /**
     * Force session reset for corruption recovery
     */
    async forceSessionReset(): Promise<void> {
        if (this.bot && typeof this.bot.forceSessionReset === 'function') {
            await this.bot.forceSessionReset();
            this.io?.emit('session:reset', { timestamp: Date.now() });
        }
    }

    /**
     * Gracefully disconnect WhatsApp without clearing session.
     * Session files are preserved — reconnecting won't require a new QR scan.
     */
    async disconnect(): Promise<void> {
        if (!this.bot) throw new Error('Bot not initialized');
        this.connectionStatus = 'disconnected';
        this.currentQR = null;
        await this.bot.gracefulDisconnect();
        this.io?.emit('connection:status', this.connectionStatus);
        this.io?.emit('session:disconnected', { intentional: true, timestamp: Date.now() });
        this.metrics.connectionStatus('disconnected');
    }

    /**
     * Manually reconnect WhatsApp after a disconnect or after max attempts were reached.
     */
    async reconnect(): Promise<void> {
        if (!this.bot) throw new Error('Bot not initialized');
        this.connectionStatus = 'connecting';
        this.io?.emit('connection:status', this.connectionStatus);
        await this.bot.reconnect();
    }

    /**
     * Get rate limiter statistics for monitoring
     */
    getRateLimiterStats() {
        return this.rateLimiter.getStats();
    }

    /**
     * Shutdown: clean up all intervals and services to prevent memory leaks
     */
    shutdown(): void {
        if (this.trackerCleanupInterval) {
            clearInterval(this.trackerCleanupInterval);
            this.trackerCleanupInterval = null;
        }
        this.rateLimiter.shutdown();
        console.log('[BotService] Shutdown complete — intervals cleared');
    }
}

export default BotService;
