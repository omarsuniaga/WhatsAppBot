import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { EventEmitter } from 'events';
import { DecisionAgent } from './DecisionAgent';
import { QASearchAgent, QASearchResult, BusinessContext, QAItem } from './QASearchAgent';
import { GeminiAgent } from './GeminiAgent';
import { AIResponse } from './types';
import PendingAlertService, { GeminiAnalysis, ConversationMessage as AlertConversation } from '../server/services/pendingAlertService';
import BotAssignmentService from '../server/services/botAssignmentService';
import LearningService from '../server/services/learningService';
import MetricsService from '../server/services/metricsService';
import ConversationContextService, { DetectedIntent } from '../modules/conversation-context/application/ConversationContextService';
import GuidedFlowService, { FlowEvaluationResult } from '../modules/guided-flows/application/GuidedFlowService';
import AppointmentService from '../modules/appointments/application/AppointmentService';

export interface BotConfig {
    version: number;
    enabled: boolean;
    geminiApiKey: string | null;
    activeChats: string[];
    settings: {
        minConfidenceForQA: number;
        useGeminiFallback: boolean;
        typingIndicator: boolean;
        typingDelayMs: number;
        maxHistoryMessages: number;
    };
    stats: {
        totalQueries: number;
        qaMatches: number;
        geminiResponses: number;
        noMatches: number;
        lastUpdated: string | null;
    };
}

export interface BotResponse {
    source: 'qa' | 'gemini' | 'fallback' | 'escalated';
    response: string;
    confidence?: number;
    matchedItem?: QASearchResult;
    escalated?: boolean;
    alertId?: string;
}

export interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

const CONFIG_PATH = join(process.cwd(), 'data', 'bot-config.json');

// Input validation constants
const MAX_MESSAGE_LENGTH = 4096;
const MAX_CUSTOMER_NAME_LENGTH = 100;

export class BotOrchestrator extends EventEmitter {
    private static instance: BotOrchestrator;
    private config: BotConfig;
    private decisionAgent: DecisionAgent;
    private qaAgent: QASearchAgent;
    private geminiAgent: GeminiAgent | null = null;
    private conversationHistory: Map<string, ConversationMessage[]> = new Map();

    // New services
    private alertService: PendingAlertService;
    private assignmentService: BotAssignmentService;
    private learningService: LearningService;
    private metrics: MetricsService;
    private contextService: ConversationContextService;
    private guidedFlowService: GuidedFlowService;
    private appointmentService: AppointmentService;

    private constructor() {
        super();
        this.config = this.loadConfig();
        this.decisionAgent = new DecisionAgent();
        this.qaAgent = new QASearchAgent();

        // Initialize new services
        this.alertService = PendingAlertService.getInstance();
        this.assignmentService = BotAssignmentService.getInstance();
        this.learningService = LearningService.getInstance();
        this.metrics = MetricsService.getInstance();
        this.contextService = ConversationContextService.getInstance();
        this.guidedFlowService = GuidedFlowService.getInstance();
        this.appointmentService = AppointmentService.getInstance();

        // Initialize Gemini if API key is available
        if (this.config.geminiApiKey) {
            this.initGemini(this.config.geminiApiKey);
        }

        // Forward alert events
        this.alertService.on('alert:new', (alert) => this.emit('alert:new', alert));
        this.alertService.on('alert:responded', (alert) => this.emit('alert:responded', alert));
        this.alertService.on('alert:dismissed', (alert) => this.emit('alert:dismissed', alert));
    }

    static getInstance(): BotOrchestrator {
        if (!BotOrchestrator.instance) {
            BotOrchestrator.instance = new BotOrchestrator();
        }
        return BotOrchestrator.instance;
    }

    private loadConfig(): BotConfig {
        try {
            if (existsSync(CONFIG_PATH)) {
                return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
            }
        } catch (error) {
            console.error('[BotOrchestrator] Error loading config:', error);
        }

        // Return default config
        return {
            version: 1,
            enabled: true,
            geminiApiKey: null,
            activeChats: [],
            settings: {
                minConfidenceForQA: 0.7,
                useGeminiFallback: true,
                typingIndicator: true,
                typingDelayMs: 1500,
                maxHistoryMessages: 10
            },
            stats: {
                totalQueries: 0,
                qaMatches: 0,
                geminiResponses: 0,
                noMatches: 0,
                lastUpdated: null
            }
        };
    }

    private saveConfig(): void {
        try {
            this.config.stats.lastUpdated = new Date().toISOString();
            writeFileSync(CONFIG_PATH, JSON.stringify(this.config, null, 2));
        } catch (error) {
            console.error('[BotOrchestrator] Error saving config:', error);
        }
    }

    /**
     * Initialize Gemini agent with API key
     */
    initGemini(apiKey: string): void {
        this.geminiAgent = new GeminiAgent({
            geminiApiKey: apiKey,
            contextFilePath: './knowledge_base.txt'
        });
        this.config.geminiApiKey = apiKey;
        this.saveConfig();
        console.log('[BotOrchestrator] Gemini agent initialized');
    }

    /**
     * Validate and sanitize JID
     */
    private validateJid(jid: string): string | null {
        if (!jid || typeof jid !== 'string') return null;
        const trimmed = jid.trim();
        // Basic WhatsApp JID validation
        if (!/^\d+@(s\.whatsapp\.net|g\.us)$/.test(trimmed)) {
            console.warn(`[BotOrchestrator] Invalid JID: ${jid}`);
            return null;
        }
        return trimmed;
    }

    /**
     * Sanitize message input
     */
    private sanitizeMessage(message: string): string {
        if (!message || typeof message !== 'string') return '';
        return message.trim().slice(0, MAX_MESSAGE_LENGTH);
    }

    /**
     * Sanitize customer name
     */
    private sanitizeCustomerName(name: string): string {
        if (!name || typeof name !== 'string') return 'Cliente';
        // Remove potentially dangerous characters and limit length
        return name.trim().replace(/[<>"'&]/g, '').slice(0, MAX_CUSTOMER_NAME_LENGTH) || 'Cliente';
    }

    /**
     * Main method to process incoming messages
     * Now integrates with BotAssignmentService and PendingAlertService
     */
    async processMessage(
        jid: string,
        message: string,
        isFromMe: boolean = false,
        customerName: string = 'Cliente'
    ): Promise<BotResponse | null> {
        // Input validation
        const validJid = this.validateJid(jid);
        if (!validJid) {
            console.error('[BotOrchestrator] Invalid JID provided');
            return null;
        }

        const sanitizedMessage = this.sanitizeMessage(message);
        if (!sanitizedMessage) {
            console.log('[BotOrchestrator] Empty message, skipping');
            return null;
        }

        const sanitizedName = this.sanitizeCustomerName(customerName);

        // Anti-loop: Never respond to own messages
        if (isFromMe) {
            return null;
        }

        // Check if bot is enabled globally
        if (!this.config.enabled) {
            return null;
        }

        // Get assignment for this chat (use validated JID)
        const assignment = this.assignmentService.getAssignment(validJid);
        
        // Check if bot is active for this chat (use assignment or decision agent)
        const isBotActive = assignment?.botConfig.enabled ?? this.decisionAgent.shouldReply(validJid, isFromMe);
        
        if (!isBotActive) {
            return null;
        }

        // Get chat-specific config or use defaults
        const chatConfig = assignment?.botConfig || this.assignmentService.getDefaultConfig();
        const escalateThreshold = chatConfig.escalateThreshold || this.config.settings.minConfidenceForQA;

        // Update stats
        this.config.stats.totalQueries++;
        this.assignmentService.incrementStats(validJid, 'totalMessages');

        // Store message in conversation history
        this.addToHistory(validJid, 'user', sanitizedMessage);

        // Update lightweight conversation context (Fase A: docs/SPEC_CONVERSACION_GUIADA.md)
        const detectedIntent = this.extractIntentWithEntities(sanitizedMessage);
        const conversationContext = this.contextService.recordInboundMessage(validJid, sanitizedName, sanitizedMessage, detectedIntent);

        // Evaluate configurable guided flows (Fase B: docs/SPEC_CONVERSACION_GUIADA.md section 5)
        const relationType = conversationContext?.contactProfile.relationType || 'desconocido';
        const flowResult = this.guidedFlowService.evaluateMessage(validJid, relationType, detectedIntent);
        if (flowResult.event === 'success' && flowResult.flow && flowResult.state) {
            // Fase C: docs/SPEC_CONVERSACION_GUIADA.md section 6 — the flow
            // only ever proposes an appointment; a human confirms it later
            // from the dashboard (AppointmentService.confirm never runs here).
            if (flowResult.onSuccessAction === 'crear_cita_propuesta') {
                const appointment = this.appointmentService.createFromFlowSuccess(
                    validJid,
                    conversationContext?.contactProfile.displayName || sanitizedName,
                    flowResult.state.accumulatedEntities,
                    flowResult.flow.id
                );
                console.log(`[BotOrchestrator] Appointment ${appointment.id} proposed for ${validJid} from flow "${flowResult.flow.id}"`);
            } else {
                console.log(`[BotOrchestrator] Guided flow "${flowResult.flow.id}" succeeded for ${validJid}: ${flowResult.onSuccessAction} (no handler yet)`);
            }
        }

        // Track processing time for metrics
        const startTime = Date.now();

        // Step 1: Search in Q&A knowledge base (with allowed categories filter)
        const qaResult = this.qaAgent.search(sanitizedMessage);

        if (qaResult && qaResult.confidence >= escalateThreshold) {
            // Found a good match in Q&A
            let processedAnswer = this.qaAgent.processAnswer(qaResult.item.answer);
            
            // Apply personality formatting if configured
            processedAnswer = this.formatResponseByPersonality(processedAnswer, chatConfig.personality);

            this.config.stats.qaMatches++;
            this.saveConfig();
            this.assignmentService.incrementStats(validJid, 'autoResponses');

            // Record KB resolution metric
            const responseTimeMs = Date.now() - startTime;
            this.metrics.resolvedByKB(validJid, qaResult.confidence, responseTimeMs);

            this.addToHistory(validJid, 'assistant', processedAnswer);

            return {
                source: 'qa',
                response: processedAnswer,
                confidence: qaResult.confidence,
                matchedItem: qaResult
            };
        }

        // Step 2: Try Gemini if enabled and available
        if (this.config.settings.useGeminiFallback && this.geminiAgent) {
            try {
                const context = this.buildGeminiContext(validJid, sanitizedMessage, flowResult);
                const aiResponse = await this.geminiAgent.generateResponse(sanitizedMessage, context);

                if (aiResponse.text) {
                    let response = aiResponse.text;
                    response = this.formatResponseByPersonality(response, chatConfig.personality);

                    this.config.stats.geminiResponses++;
                    this.saveConfig();
                    this.assignmentService.incrementStats(validJid, 'autoResponses');

                    // Record AI resolution metric
                    const aiResponseTimeMs = Date.now() - startTime;
                    this.metrics.resolvedByAI(validJid, aiResponseTimeMs, qaResult?.confidence);

                    this.addToHistory(validJid, 'assistant', response);

                    return {
                        source: 'gemini',
                        response,
                        confidence: qaResult?.confidence
                    };
                }
            } catch (error) {
                console.error('[BotOrchestrator] Gemini error:', error);
            }
        }

        // Step 3: Cannot answer - Create escalation alert if enabled
        if (chatConfig.autoEscalate && this.alertService.checkRateLimit(validJid)) {
            const geminiAnalysis: GeminiAnalysis = {
                intent: detectedIntent.label,
                suggestedTopics: this.qaAgent.getRelatedItems(sanitizedMessage, 3).map(i => i.questions[0]),
                confidence: qaResult?.confidence || 0,
                reason: 'No se encontró respuesta con suficiente confianza en la base de conocimiento',
                canAnswer: false
            };

            // Get conversation context
            const conversationContext: AlertConversation[] = this.getHistory(validJid)
                .slice(-5)
                .map(msg => ({
                    role: msg.role === 'user' ? 'customer' as const : 'bot' as const,
                    message: msg.content,
                    timestamp: new Date(msg.timestamp).toISOString()
                }));

            // Create alert
            const alert = await this.alertService.createAlert(
                validJid,
                sanitizedName,
                sanitizedMessage,
                geminiAnalysis,
                conversationContext
            );

            this.config.stats.noMatches++;
            this.saveConfig();
            this.assignmentService.incrementStats(validJid, 'escalations');
            this.contextService.markEscalated(validJid);

            // Record escalation metric
            this.metrics.escalatedToHuman(validJid, alert.id, alert.priority, geminiAnalysis.intent);

            // Return escalation message
            const escalationMessage = chatConfig.customFallback || 
                'Un momento, estoy consultando con mi equipo para darte la mejor respuesta.';

            this.addToHistory(validJid, 'assistant', escalationMessage);

            return {
                source: 'escalated',
                response: escalationMessage,
                confidence: qaResult?.confidence || 0,
                escalated: true,
                alertId: alert.id
            };
        }

        // Step 4: Return generic fallback (no escalation)
        const fallbackConfig = this.qaAgent.getFallbackConfig();
        const fallbackMessage = chatConfig.customFallback || 
            fallbackConfig?.noMatch || 
            'Lo siento, no puedo ayudarte con eso en este momento.';

        this.config.stats.noMatches++;
        this.saveConfig();

        // Record fallback metric
        this.metrics.fallbackResponse(validJid, 'no_escalation_configured');

        this.addToHistory(validJid, 'assistant', fallbackMessage);

        return {
            source: 'fallback',
            response: fallbackMessage,
            confidence: qaResult?.confidence || 0
        };
    }

    /**
     * Extract intent from message (simple version)
     */
    private extractIntent(message: string): string {
        const lowerMessage = message.toLowerCase();
        
        const intents: Record<string, string[]> = {
            'consulta_precio': ['precio', 'costo', 'cuanto', 'cuánto', 'vale', 'tarifa'],
            'consulta_horario': ['horario', 'hora', 'abierto', 'cerrado', 'atienden'],
            'consulta_ubicacion': ['direccion', 'dirección', 'donde', 'dónde', 'ubicacion', 'ubicación'],
            'queja': ['queja', 'reclamo', 'problema', 'mal', 'error', 'falla'],
            'soporte': ['ayuda', 'help', 'soporte', 'asistencia', 'no funciona'],
            'pedido': ['pedido', 'orden', 'compra', 'comprar', 'ordenar'],
            'envio': ['envio', 'envío', 'delivery', 'entrega', 'llega']
        };

        for (const [intent, keywords] of Object.entries(intents)) {
            if (keywords.some(kw => lowerMessage.includes(kw))) {
                return intent;
            }
        }

        return 'consulta_general';
    }

    /**
     * Extract intent plus simple entities (date, event type) from a message.
     * Fase A of docs/SPEC_CONVERSACION_GUIADA.md: a lightweight, keyword-based
     * extension of extractIntent() rather than a new Gemini call, so this
     * runs on every inbound message without extra API cost.
     */
    private extractIntentWithEntities(message: string): DetectedIntent {
        const lowerMessage = message.toLowerCase();
        const intent = this.extractIntent(message);
        const entities: Record<string, string> = {};

        // Simple date patterns: dd/mm, dd/mm/yyyy, or "20 de octubre"
        const numericDateMatch = message.match(/\b(\d{1,2})[/\-](\d{1,2})(?:[/\-](\d{2,4}))?\b/);
        const monthNames = 'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre';
        const namedDateMatch = lowerMessage.match(new RegExp(`\\b(\\d{1,2})\\s+de\\s+(${monthNames})\\b`));
        if (numericDateMatch) {
            entities.fecha = numericDateMatch[0];
        } else if (namedDateMatch) {
            entities.fecha = namedDateMatch[0];
        }

        const eventTypes: Record<string, string[]> = {
            boda: ['boda', 'casamiento', 'matrimonio'],
            gala: ['gala', 'cena de gala'],
            corporativo: ['corporativo', 'empresa', 'conferencia', 'convencion', 'convención'],
            clase: ['clase', 'clases', 'leccion', 'lección'],
            evento_institucional: ['comunicado', 'reunion institucional', 'reunión institucional']
        };
        for (const [type, keywords] of Object.entries(eventTypes)) {
            if (keywords.some(kw => lowerMessage.includes(kw))) {
                entities.tipoEvento = type;
                break;
            }
        }

        return {
            label: intent,
            confidence: intent === 'consulta_general' ? 0.3 : 0.6,
            entities
        };
    }

    /**
     * Format response based on personality
     */
    private formatResponseByPersonality(
        response: string, 
        personality: 'professional' | 'friendly' | 'formal'
    ): string {
        // Basic personality adjustments
        switch (personality) {
            case 'friendly':
                // Add friendly touches if not present
                if (!response.includes('!') && !response.includes('😊')) {
                    response = response.replace(/\.$/, '! 😊');
                }
                break;
            case 'formal':
                // Remove emojis and casual expressions
                response = response.replace(/[😊😄👍🎉]/g, '');
                response = response.replace(/!/g, '.');
                break;
            case 'professional':
            default:
                // Keep as is
                break;
        }
        return response;
    }

    /**
     * Build context for Gemini including business info and related Q&A
     */
    private buildGeminiContext(jid: string, query: string, flowResult?: FlowEvaluationResult): string {
        const parts: string[] = [];

        // Add business context
        const business = this.qaAgent.getBusinessContext();
        if (business) {
            parts.push(`Negocio: ${business.name}`);
            parts.push(`Descripcion: ${business.description}`);
            parts.push(`Tono de respuesta: ${business.tone}`);
            parts.push('');
        }

        // Guided flow in progress (Fase B): steer the response towards the
        // configured target topic instead of answering generically.
        if (flowResult && flowResult.flow && (flowResult.event === 'started' || flowResult.event === 'continued')) {
            parts.push(`Estás guiando esta conversación hacia: ${flowResult.flow.label}`);
            parts.push(`Tono a usar: ${flowResult.flow.tone}`);
            if (flowResult.nextGuidingQuestion) {
                parts.push(`Después de responder, intenta preguntar (de forma natural, no textual): ${flowResult.nextGuidingQuestion}`);
            }
            parts.push('');
        }

        // Add related Q&A items for reference
        const relatedItems = this.qaAgent.getRelatedItems(query, 3);
        if (relatedItems.length > 0) {
            parts.push('Informacion relacionada de la base de conocimiento:');
            for (const item of relatedItems) {
                parts.push(`- ${item.questions[0]}: ${item.answer}`);
            }
            parts.push('');
        }

        // Add conversation history
        const history = this.getHistory(jid);
        if (history.length > 0) {
            parts.push('Historial de conversacion reciente:');
            for (const msg of history.slice(-5)) {
                parts.push(`${msg.role === 'user' ? 'Usuario' : 'Asistente'}: ${msg.content}`);
            }
        }

        return parts.join('\n');
    }

    /**
     * Add message to conversation history
     */
    private addToHistory(jid: string, role: 'user' | 'assistant', content: string): void {
        if (!this.conversationHistory.has(jid)) {
            this.conversationHistory.set(jid, []);
        }

        const history = this.conversationHistory.get(jid)!;
        history.push({
            role,
            content,
            timestamp: Date.now()
        });

        // Limit history size
        if (history.length > this.config.settings.maxHistoryMessages) {
            history.shift();
        }

        if (role === 'assistant') {
            this.contextService.recordOutboundMessage(jid, content);
        }
    }

    /**
     * Get conversation history for a chat
     */
    getHistory(jid: string): ConversationMessage[] {
        return this.conversationHistory.get(jid) || [];
    }

    /**
     * Clear conversation history for a chat
     */
    clearHistory(jid: string): void {
        this.conversationHistory.delete(jid);
    }

    /**
     * Test a message without sending response
     */
    async testMessage(message: string): Promise<BotResponse> {
        const qaResult = this.qaAgent.search(message);

        if (qaResult && qaResult.confidence >= this.config.settings.minConfidenceForQA) {
            return {
                source: 'qa',
                response: this.qaAgent.processAnswer(qaResult.item.answer),
                confidence: qaResult.confidence,
                matchedItem: qaResult
            };
        }

        if (this.config.settings.useGeminiFallback && this.geminiAgent) {
            const context = this.buildGeminiContext('test', message);
            const aiResponse = await this.geminiAgent.generateResponse(message, context);

            if (aiResponse.text) {
                return {
                    source: 'gemini',
                    response: aiResponse.text,
                    confidence: qaResult?.confidence
                };
            }
        }

        const fallbackConfig = this.qaAgent.getFallbackConfig();
        return {
            source: 'fallback',
            response: fallbackConfig?.noMatch || 'No match found',
            confidence: qaResult?.confidence || 0
        };
    }

    // ==========================================
    // Configuration Methods
    // ==========================================

    /**
     * Get current configuration
     */
    getConfig(): BotConfig {
        return { ...this.config };
    }

    /**
     * Update configuration
     */
    updateConfig(updates: Partial<BotConfig['settings']>): void {
        Object.assign(this.config.settings, updates);
        this.saveConfig();
    }

    /**
     * Enable/disable the bot globally
     */
    setEnabled(enabled: boolean): void {
        this.config.enabled = enabled;
        this.saveConfig();
    }

    /**
     * Toggle bot for a specific chat
     */
    toggleChat(jid: string, active: boolean): void {
        this.decisionAgent.setBotStatus(jid, active);

        // Also update activeChats in config
        if (active && !this.config.activeChats.includes(jid)) {
            this.config.activeChats.push(jid);
        } else if (!active) {
            this.config.activeChats = this.config.activeChats.filter((c) => c !== jid);
        }

        this.saveConfig();
    }

    /**
     * Check if bot is active for a chat
     */
    isChatActive(jid: string): boolean {
        return this.decisionAgent.isBotActive(jid);
    }

    /**
     * Get statistics
     */
    getStats(): BotConfig['stats'] {
        return { ...this.config.stats };
    }

    /**
     * Reset statistics
     */
    resetStats(): void {
        this.config.stats = {
            totalQueries: 0,
            qaMatches: 0,
            geminiResponses: 0,
            noMatches: 0,
            lastUpdated: new Date().toISOString()
        };
        this.saveConfig();
    }

    /**
     * Get QA agent for knowledge base operations
     */
    getQAAgent(): QASearchAgent {
        return this.qaAgent;
    }

    /**
     * Reload knowledge base
     */
    reloadKnowledgeBase(): void {
        this.qaAgent.loadKnowledgeBase();
    }

    // ==========================================
    // New Service Accessors
    // ==========================================

    /**
     * Get Alert Service for managing pending alerts
     */
    getAlertService(): PendingAlertService {
        return this.alertService;
    }

    /**
     * Get Assignment Service for managing bot assignments
     */
    getAssignmentService(): BotAssignmentService {
        return this.assignmentService;
    }

    /**
     * Get Learning Service for managing learned responses
     */
    getLearningService(): LearningService {
        return this.learningService;
    }

    /**
     * Get Conversation Context Service for per-chat contact profiles
     */
    getContextService(): ConversationContextService {
        return this.contextService;
    }

    /**
     * Get Guided Flow Service for managing configurable target-topic flows
     */
    getGuidedFlowService(): GuidedFlowService {
        return this.guidedFlowService;
    }

    /**
     * Get Appointment Service for managing proposed/confirmed appointments
     */
    getAppointmentService(): AppointmentService {
        return this.appointmentService;
    }

    /**
     * Respond to a pending alert and optionally learn from it
     */
    async respondToAlert(
        alertId: string,
        response: string,
        shouldLearn: boolean = true,
        respondedBy: string = 'admin'
    ): Promise<{ success: boolean; learnedId?: string }> {
        const result = await this.alertService.respondToAlert(alertId, response, respondedBy, shouldLearn);
        
        if (!result) {
            return { success: false };
        }

        const { alert } = result;

        // Learn from the response if enabled
        if (shouldLearn && alert.shouldLearn) {
            try {
                const learned = await this.learningService.learnFromResponse(
                    alertId,
                    alert.originalMessage,
                    response
                );

                // Link alert to learned response
                this.alertService.linkToLearnedFaq(alertId, learned.id);
                this.assignmentService.incrementStats(alert.chatJid, 'learnedResponses');

                return { success: true, learnedId: learned.id };
            } catch (error) {
                console.error('[BotOrchestrator] Learning failed:', error);
            }
        }

        return { success: true };
    }

    /**
     * Get Gemini agent (for learning service)
     */
    getGeminiAgent(): GeminiAgent | null {
        return this.geminiAgent;
    }
}
