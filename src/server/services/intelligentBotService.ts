/**
 * Intelligent Bot Service
 * Integración de respuestas automáticas, escalación y difusión
 */

import { AutoResponseService } from './autoResponseService';
import { EscalationService } from './escalationService';
import { BroadcastService } from './broadcastService';
import { KnowledgeBaseService } from './knowledgeBaseService';
import BotService from './botService';

export class IntelligentBotService {
    private static instance: IntelligentBotService;
    private autoResponseService: AutoResponseService;
    private escalationService: EscalationService;
    private broadcastService: BroadcastService;
    private knowledgeBaseService: KnowledgeBaseService;
    private botService: BotService;
    private initialized: boolean = false;

    private constructor() {
        this.autoResponseService = AutoResponseService.getInstance();
        this.escalationService = EscalationService.getInstance();
        this.broadcastService = BroadcastService.getInstance();
        this.knowledgeBaseService = KnowledgeBaseService.getInstance();
        this.botService = BotService.getInstance();
    }

    public static getInstance(): IntelligentBotService {
        if (!IntelligentBotService.instance) {
            IntelligentBotService.instance = new IntelligentBotService();
        }
        return IntelligentBotService.instance;
    }

    /**
     * Initialize all services and connect them
     */
    public async initialize(): Promise<void> {
        if (this.initialized) return;

        console.log('🤖 Initializing Intelligent Bot Services...');

        // Connect services with message sending capability
        const sendMessage = async (jid: string, message: string): Promise<void> => {
            try {
                await this.botService.sendText(jid, message);
            } catch (error) {
                console.error(`Failed to send message to ${jid}:`, error);
                throw error;
            }
        };

        const sendMessageWithMedia = async (jid: string, message: string, mediaUrl?: string): Promise<boolean> => {
            try {
                if (mediaUrl) {
                    await this.botService.sendMedia(jid, mediaUrl, message);
                } else {
                    await this.botService.sendText(jid, message);
                }
                return true;
            } catch (error) {
                console.error(`Failed to send message to ${jid}:`, error);
                return false;
            }
        };

        // Connect escalation service
        this.escalationService.setSendMessageCallback(sendMessage);

        // Connect broadcast service
        this.broadcastService.setSendMessageCallback(sendMessageWithMedia);

        // Connect auto-response with escalation
        this.autoResponseService.setEscalationService(this.escalationService);

        this.initialized = true;
        console.log('✅ Intelligent Bot Services initialized');
    }

    /**
     * Process incoming message with intelligent response system
     */
    public async processIncomingMessage(
        chatJid: string,
        senderName: string,
        messageBody: string,
        isGroup: boolean = false
    ): Promise<{
        handled: boolean;
        response?: string;
        source?: 'auto' | 'escalated' | 'quick';
        confidence?: number;
    }> {
        // Check if this is an admin responding to a ticket
        const admins = this.escalationService.getAdmins();
        const isAdmin = admins.some(a => a.jid === chatJid);

        if (isAdmin) {
            const result = await this.escalationService.handleAdminMessage(chatJid, messageBody);
            if (result.handled) {
                return {
                    handled: true,
                    response: result.response,
                    source: 'auto'
                };
            }
        }

        // Check for quick responses (greetings, thanks, etc.)
        const quickResponse = this.autoResponseService.getQuickResponse(messageBody);
        if (quickResponse) {
            return {
                handled: true,
                response: quickResponse,
                source: 'quick',
                confidence: 1.0
            };
        }

        // Process with AI auto-response system
        const aiResult = await this.autoResponseService.processMessage(
            chatJid,
            senderName,
            messageBody,
            isGroup
        );

        if (aiResult.shouldRespond && aiResult.response) {
            return {
                handled: true,
                response: aiResult.response,
                source: aiResult.escalated ? 'escalated' : 'auto',
                confidence: aiResult.confidence
            };
        }

        return { handled: false };
    }

    /**
     * Check if there's a pending ticket for a chat
     */
    public hasPendingTicket(chatJid: string): boolean {
        const ticket = this.escalationService.getTicketByChat(chatJid);
        return ticket !== null;
    }

    /**
     * Get services for direct access
     */
    public getAutoResponseService(): AutoResponseService {
        return this.autoResponseService;
    }

    public getEscalationService(): EscalationService {
        return this.escalationService;
    }

    public getBroadcastService(): BroadcastService {
        return this.broadcastService;
    }

    public getKnowledgeBaseService(): KnowledgeBaseService {
        return this.knowledgeBaseService;
    }

    /**
     * Get dashboard stats
     */
    public getDashboardStats(): {
        knowledge: any;
        escalation: any;
        broadcast: any;
    } {
        return {
            knowledge: this.knowledgeBaseService.getStats(),
            escalation: this.escalationService.getStats(),
            broadcast: this.broadcastService.getStats()
        };
    }
}

export default IntelligentBotService;
