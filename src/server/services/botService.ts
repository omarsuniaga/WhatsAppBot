import { Server as SocketServer } from 'socket.io';
import { BaileysClass } from '../../baileys';
import { BotOrchestrator } from '../../agents/BotOrchestrator';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

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

    private constructor() {}

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
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey) {
            const orchestrator = BotOrchestrator.getInstance();
            orchestrator.initGemini(apiKey);
            console.log('AI Agents initialized via BotOrchestrator');
        } else {
            console.warn('GEMINI_API_KEY not found. AI features will be disabled.');
        }

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

        this.bot.on('ready', () => {
            this.connectionStatus = 'connected';
            this.currentQR = null;
            this.io?.emit('connection:status', this.connectionStatus);
            this.io?.emit('ready');
        });

        this.bot.on('auth_failure', (error: any) => {
            this.connectionStatus = 'disconnected';
            this.io?.emit('auth_failure', { error: String(error) });
            this.io?.emit('connection:status', this.connectionStatus);
        });

        this.bot.on('message', async (message: any) => {
            this.io?.emit('message:new', message);

            // Use BotOrchestrator for intelligent responses
            const chatJid = message.from;
            const isFromMe = message.key?.fromMe;
            const messageText = message.body;

            if (messageText && !isFromMe) {
                try {
                    const orchestrator = BotOrchestrator.getInstance();
                    const response = await orchestrator.processMessage(chatJid, messageText, isFromMe);

                    if (response) {
                        // Show typing indicator
                        await this.sendPresenceUpdate(chatJid, 'composing');

                        // Add a small delay to simulate typing
                        const config = orchestrator.getConfig();
                        if (config.settings.typingIndicator) {
                            await new Promise(resolve => setTimeout(resolve, config.settings.typingDelayMs));
                        }

                        // Send the response
                        await this.sendText(chatJid, response.response);

                        // Emit bot response event for frontend
                        this.io?.emit('bot:response', {
                            jid: chatJid,
                            response: response.response,
                            source: response.source,
                            confidence: response.confidence
                        });

                        await this.sendPresenceUpdate(chatJid, 'paused');
                    }
                } catch (error) {
                    console.error('Error in Bot Orchestrator:', error);
                    await this.sendPresenceUpdate(chatJid, 'paused');
                }
            }
        });

        this.bot.on('require_action', (action: any) => {
            this.io?.emit('require_action', action);
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

    async fetchMessagesFromWA(jid: string, count: number): Promise<any[]> {
        if (!this.bot) {
            console.log('Bot not initialized');
            return [];
        }
        
        try {
            // Use BaileysClass method to fetch message history
            return await this.bot.fetchMessageHistory(jid, count);
        } catch (error: any) {
            console.error(`Failed to fetch messages for ${jid}:`, error.message);
            return this.bot.getMessagesFromStore(jid, count);
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
}

export default BotService;
