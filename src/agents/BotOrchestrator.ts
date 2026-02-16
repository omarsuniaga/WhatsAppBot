import { existsSync, readFileSync } from 'fs';
import { writeFileSyncAtomic } from '../server/utils/atomicWrite';
import { join } from 'path';
import { EventEmitter } from 'events';
import { DecisionAgent } from './DecisionAgent';
import { QASearchAgent, QASearchResult, BusinessContext, QAItem } from './QASearchAgent';
import { GeminiAgent } from './GeminiAgent';
import { GroqAgent } from './GroqAgent';
import { AIResponse } from './types';
import IntentClassifierAgent, { ClassificationResult } from './IntentClassifierAgent';
import PendingAlertService, { GeminiAnalysis, ConversationMessage as AlertConversation } from '../server/services/pendingAlertService';
import BotAssignmentService from '../server/services/botAssignmentService';
import LearningService from '../server/services/learningService';
import MetricsService from '../server/services/metricsService';
import Logger from '../server/services/loggerService';

export interface BotConfig {
    version: number;
    enabled: boolean;
    geminiApiKey: string | null; // Legacy, kept for backward compatibility
    aiConfig: {
        preferredProvider: 'gemini' | 'groq';
        enableFailover: boolean; // If true, try the other provider on failure
        groqApiKey: string | null;
        geminiApiKey: string | null; // Redundant but cleaner grouping
    };
    geminiConfigured?: boolean;
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

export interface MessageContextHints {
    triggerKeywords?: string[];
    triggerCategories?: string[];
    triggerIds?: string[];
}

export interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

const CONFIG_PATH = join(process.cwd(), 'data', 'bot-config.json');
const HISTORY_PATH = join(process.cwd(), 'data', 'conversation-history.json');

// Input validation constants
const MAX_MESSAGE_LENGTH = 4096;
const MAX_CUSTOMER_NAME_LENGTH = 100;

// How often to persist conversation history to disk (ms)
const HISTORY_SAVE_INTERVAL_MS = 30_000;

export class BotOrchestrator extends EventEmitter {
    private static instance: BotOrchestrator;
    private config: BotConfig;
    private decisionAgent: DecisionAgent;
    private qaAgent: QASearchAgent;
    private geminiAgent: GeminiAgent | null = null;
    private groqAgent: GroqAgent | null = null;
    private conversationHistory: Map<string, ConversationMessage[]> = new Map();
    private historyDirty: boolean = false;
    private historySaveInterval: ReturnType<typeof setInterval> | null = null;
    private configDirty: boolean = false;
    private configSaveTimeout: ReturnType<typeof setTimeout> | null = null;

    // New services
    private alertService: PendingAlertService;
    private assignmentService: BotAssignmentService;
    private learningService: LearningService;
    private metrics: MetricsService;
    private intentClassifier: IntentClassifierAgent;

    private constructor() {
        super();
        this.config = this.loadConfig();
        this.decisionAgent = new DecisionAgent();
        this.qaAgent = new QASearchAgent();

        // Restore activeChats from persisted config into DecisionAgent
        if (this.config.activeChats && this.config.activeChats.length > 0) {
            for (const jid of this.config.activeChats) {
                this.decisionAgent.setBotStatus(jid, true);
            }
            Logger.info(`[BotOrchestrator] Restored ${this.config.activeChats.length} active chats to DecisionAgent`);
        }

        // Initialize new services
        this.alertService = PendingAlertService.getInstance();
        this.assignmentService = BotAssignmentService.getInstance();
        this.learningService = LearningService.getInstance();
        this.metrics = MetricsService.getInstance();
        this.intentClassifier = IntentClassifierAgent.getInstance();

        // Load persisted conversation history
        this.loadHistory();

        // Periodically save dirty history to disk
        this.historySaveInterval = setInterval(() => {
            if (this.historyDirty) {
                this.saveHistory();
            }
        }, HISTORY_SAVE_INTERVAL_MS);

        // Initialize providers from environment (runtime-only secrets).
        const envGeminiKey = process.env.GEMINI_API_KEY?.trim();
        if (envGeminiKey) {
            this.initGemini(envGeminiKey);
        }

        const envGroqKey = process.env.GROQ_API_KEY?.trim();
        if (envGroqKey) {
            this.config.aiConfig.groqApiKey = envGroqKey;
            this.initGroq(envGroqKey);
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
        const defaultConfig: BotConfig = {
            version: 1,
            enabled: true,
            geminiApiKey: null,
            aiConfig: {
                preferredProvider: 'groq',
                enableFailover: true,
                groqApiKey: null,
                geminiApiKey: null
            },
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

        try {
            if (existsSync(CONFIG_PATH)) {
                const loaded = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));

                // Merge loaded config with default to ensure new fields (like aiConfig) exist
                // We preserve loaded values but fill gaps with defaults
                const merged = {
                    ...defaultConfig,
                    ...loaded,
                    settings: { ...defaultConfig.settings, ...(loaded.settings || {}) },
                    stats: { ...defaultConfig.stats, ...(loaded.stats || {}) },
                    aiConfig: { ...defaultConfig.aiConfig, ...(loaded.aiConfig || {}) }
                };

                // Security hardening: never load persisted secrets from disk.
                merged.geminiApiKey = null;
                merged.aiConfig.geminiApiKey = null;
                merged.aiConfig.groqApiKey = null;

                return merged;
            }
        } catch (error) {
            Logger.error('[BotOrchestrator] Error loading config:', error);
        }

        return defaultConfig;
    }

    /**
     * Update AI Configuration
     */


    /**
     * Debounced save: marks config as dirty and writes to disk after 5s of inactivity.
     * For immediate saves (e.g., API key changes), call saveConfigNow().
     */
    private saveConfig(): void {
        this.configDirty = true;
        if (this.configSaveTimeout) {
            clearTimeout(this.configSaveTimeout);
        }
        this.configSaveTimeout = setTimeout(() => {
            this.saveConfigNow();
        }, 5000);
    }

    /**
     * Immediately persist config to disk
     */
    private saveConfigNow(): void {
        if (!this.configDirty) return;
        try {
            this.config.stats.lastUpdated = new Date().toISOString();

            // Security hardening: redact secrets before writing config.
            const persistedConfig: BotConfig = {
                ...this.config,
                geminiApiKey: null,
                aiConfig: {
                    ...this.config.aiConfig,
                    groqApiKey: null,
                    geminiApiKey: null
                }
            };

            writeFileSyncAtomic(CONFIG_PATH, JSON.stringify(persistedConfig, null, 2));
            this.configDirty = false;
        } catch (error) {
            Logger.error('[BotOrchestrator] Error saving config:', error);
        }
    }

    /**
     * Load conversation history from disk
     */
    private loadHistory(): void {
        try {
            if (existsSync(HISTORY_PATH)) {
                const raw = JSON.parse(readFileSync(HISTORY_PATH, 'utf-8'));
                if (raw && typeof raw === 'object') {
                    for (const [jid, messages] of Object.entries(raw)) {
                        if (Array.isArray(messages)) {
                            this.conversationHistory.set(jid, messages as ConversationMessage[]);
                        }
                    }
                }
                Logger.info(`[BotOrchestrator] Loaded conversation history for ${this.conversationHistory.size} chats`);
            }
        } catch (error) {
            Logger.error('[BotOrchestrator] Error loading conversation history:', error);
        }
    }

    /**
     * Save conversation history to disk
     */
    private saveHistory(): void {
        try {
            const obj: Record<string, ConversationMessage[]> = {};
            for (const [jid, messages] of this.conversationHistory.entries()) {
                obj[jid] = messages;
            }
            writeFileSyncAtomic(HISTORY_PATH, JSON.stringify(obj, null, 2));
            this.historyDirty = false;
        } catch (error) {
            Logger.error('[BotOrchestrator] Error saving conversation history:', error);
        }
    }

    /**
     * Initialize Gemini agent with API key
     */
    initGemini(apiKey: string): void {
        const normalizedApiKey = apiKey?.trim();
        if (!normalizedApiKey) {
            this.geminiAgent = null;
            this.config.geminiApiKey = null;
            this.config.aiConfig.geminiApiKey = null;
            return;
        }

        // Idempotent init: avoid reinitializing/logging when key is unchanged.
        if (this.geminiAgent && this.config.aiConfig.geminiApiKey === normalizedApiKey) {
            return;
        }

        this.geminiAgent = new GeminiAgent({
            geminiApiKey: normalizedApiKey,
            contextFilePath: './knowledge_base.txt'
        });
        this.config.geminiApiKey = normalizedApiKey;
        this.config.aiConfig.geminiApiKey = normalizedApiKey;
        Logger.info('[BotOrchestrator] Gemini agent initialized in runtime memory');
    }

    /**
     * Initialize Groq agent with API key
     */
    initGroq(apiKey: string): void {
        const normalizedApiKey = apiKey?.trim();
        if (!normalizedApiKey) {
            this.groqAgent = null;
            this.config.aiConfig.groqApiKey = null;
            return;
        }

        if (this.groqAgent && this.config.aiConfig.groqApiKey === normalizedApiKey) {
            return;
        }

        this.groqAgent = new GroqAgent({
            groqApiKey: normalizedApiKey
        });
        this.config.aiConfig.groqApiKey = normalizedApiKey;
        Logger.info('[BotOrchestrator] Groq agent initialized in runtime memory');
    }

    /**
     * Update AI Configuration
     */
    updateAIConfig(updates: Partial<BotConfig['aiConfig']>): void {
        const normalizedUpdates: Partial<BotConfig['aiConfig']> = { ...updates };
        if (normalizedUpdates.groqApiKey !== undefined) {
            normalizedUpdates.groqApiKey = normalizedUpdates.groqApiKey?.trim() || null;
        }
        if (normalizedUpdates.geminiApiKey !== undefined) {
            normalizedUpdates.geminiApiKey = normalizedUpdates.geminiApiKey?.trim() || null;
        }

        this.config.aiConfig = { ...this.config.aiConfig, ...normalizedUpdates };

        // Update Gems
        if (normalizedUpdates.geminiApiKey !== undefined) {
            if (normalizedUpdates.geminiApiKey) {
                this.initGemini(normalizedUpdates.geminiApiKey);
            } else {
                this.geminiAgent = null;
                this.config.geminiApiKey = null;
            }
        }

        // Update Groq
        if (normalizedUpdates.groqApiKey !== undefined) {
            if (normalizedUpdates.groqApiKey) {
                this.initGroq(normalizedUpdates.groqApiKey);
            } else {
                this.groqAgent = null;
            }
        }

        this.saveConfig();
    }

    /**
     * Validate and sanitize JID
     */
    private validateJid(jid: string): string | null {
        if (!jid || typeof jid !== 'string') return null;
        const trimmed = jid.trim();
        // Basic WhatsApp JID validation
        if (!/^\d+@(s\.whatsapp\.net|g\.us)$/.test(trimmed)) {
            Logger.warn(`[BotOrchestrator] Invalid JID: ${jid}`);
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
        customerName: string = 'Cliente',
        contextHints?: MessageContextHints
    ): Promise<BotResponse | null> {
        // Input validation
        const validJid = this.validateJid(jid);
        if (!validJid) {
            Logger.error('[BotOrchestrator] Invalid JID provided');
            return null;
        }

        const sanitizedMessage = this.sanitizeMessage(message);
        if (!sanitizedMessage) {
            Logger.debug('[BotOrchestrator] Empty message, skipping');
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
        const requireHumanApproval = chatConfig.requireHumanApproval === true;

        // Update stats
        this.config.stats.totalQueries++;
        this.assignmentService.incrementStats(validJid, 'totalMessages');

        // Store message in conversation history
        this.addToHistory(validJid, 'user', sanitizedMessage);

        // Track processing time for metrics
        const startTime = Date.now();

        // Step 0: Classify message intent using IntentClassifierAgent
        const conversationHistory = this.getHistory(validJid);
        const classification = await this.intentClassifier.classifyMessage(
            sanitizedMessage,
            conversationHistory.map(m => ({ role: m.role, content: m.content }))
        );
        Logger.debug(`[BotOrchestrator] Intent: ${classification.intent} (${classification.confidence.toFixed(2)}, ${classification.source})`);

        // Handle immediate escalation if required
        if (classification.requiresHuman) {
            Logger.info('[BotOrchestrator] Classification requires human escalation');
            // Continue to normal flow but mark for escalation
        }

        // Handle conversational intents (saludo, despedida, agradecimiento)
        if (this.intentClassifier.isConversationalIntent(classification.intent) && classification.confidence >= 0.7) {
            let response = this.intentClassifier.getConversationalResponse(classification.intent, customerName);
            response = this.formatResponseByPersonality(response, chatConfig.personality);

            if (requireHumanApproval) {
                const approvalResult = await this.createApprovalAlert(
                    validJid,
                    sanitizedName,
                    sanitizedMessage,
                    response,
                    classification.intent,
                    classification.confidence,
                    'Respuesta conversacional pendiente de aprobación humana',
                    chatConfig.customFallback
                );

                if (approvalResult) {
                    this.addToHistory(validJid, 'assistant', approvalResult.message);
                    return {
                        source: 'escalated',
                        response: approvalResult.message,
                        confidence: classification.confidence,
                        escalated: true,
                        alertId: approvalResult.alertId
                    };
                }
            }

            this.addToHistory(validJid, 'assistant', response);

            return {
                source: 'qa',
                response,
                confidence: classification.confidence,
                escalated: false
            };
        }

        // Step 1: Search in Q&A knowledge base (with category/context boost)
        const suggestedCategory = this.resolveSuggestedCategory(
            classification.suggestedCategory,
            classification.confidence,
            contextHints?.triggerCategories
        );
        const qaResult = this.qaAgent.search(sanitizedMessage, {
            suggestedCategory
        });

        if (qaResult && qaResult.confidence >= escalateThreshold) {
            // Found a good match in Q&A
            let processedAnswer = this.qaAgent.processAnswer(qaResult.item.answer);

            // Apply personality formatting if configured
            processedAnswer = this.formatResponseByPersonality(processedAnswer, chatConfig.personality);

            if (requireHumanApproval) {
                const approvalResult = await this.createApprovalAlert(
                    validJid,
                    sanitizedName,
                    sanitizedMessage,
                    processedAnswer,
                    classification.intent,
                    qaResult.confidence,
                    'Respuesta basada en base de conocimiento pendiente de aprobación humana',
                    chatConfig.customFallback
                );

                if (approvalResult) {
                    this.addToHistory(validJid, 'assistant', approvalResult.message);
                    return {
                        source: 'escalated',
                        response: approvalResult.message,
                        confidence: qaResult.confidence,
                        escalated: true,
                        alertId: approvalResult.alertId
                    };
                }
            }

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

        // Step 2: AI Response Generation (Groq/Gemini with failover)
        if (this.config.settings.useGeminiFallback) {
            const context = this.buildGeminiContext(validJid, sanitizedMessage);
            let response: string | null = null;
            let providerUsed = 'none';

            // Determine provider order
            const providers: { name: string; agent: any }[] = [];
            if (this.config.aiConfig.preferredProvider === 'groq') {
                if (this.groqAgent) providers.push({ name: 'groq', agent: this.groqAgent });
                if (this.config.aiConfig.enableFailover && this.geminiAgent) providers.push({ name: 'gemini', agent: this.geminiAgent });
            } else {
                if (this.geminiAgent) providers.push({ name: 'gemini', agent: this.geminiAgent });
                if (this.config.aiConfig.enableFailover && this.groqAgent) providers.push({ name: 'groq', agent: this.groqAgent });
            }

            // Try providers in order
            for (const provider of providers) {
                try {
                    Logger.debug(`[BotOrchestrator] Trying ${provider.name}...`);
                    // Type assertion to handle both agent types which have compatible generateResponse signatures
                    const agent = provider.agent as any;
                    const aiResponse = await agent.generateResponse(sanitizedMessage, context);

                    if (aiResponse.text) {
                        response = aiResponse.text;
                        providerUsed = provider.name;
                        break; // Success!
                    }
                } catch (error) {
                    Logger.warn(`[BotOrchestrator] ${provider.name} failed:`, error);
                }
            }

            if (response) {
                response = this.formatResponseByPersonality(response, chatConfig.personality);

                if (requireHumanApproval) {
                    const approvalResult = await this.createApprovalAlert(
                        validJid,
                        sanitizedName,
                        sanitizedMessage,
                        response,
                        classification.intent,
                        classification.confidence,
                        `Respuesta generada por ${providerUsed} pendiente de aprobación humana`,
                        chatConfig.customFallback
                    );

                    if (approvalResult) {
                        this.addToHistory(validJid, 'assistant', approvalResult.message);
                        return {
                            source: 'escalated',
                            response: approvalResult.message,
                            confidence: qaResult?.confidence,
                            escalated: true,
                            alertId: approvalResult.alertId
                        };
                    }
                }

                this.config.stats.geminiResponses++; // Keep legacy stat name or add new one? Keeping for now.
                this.saveConfig();
                this.assignmentService.incrementStats(validJid, 'autoResponses');

                // Record AI resolution metric
                const aiResponseTimeMs = Date.now() - startTime;
                this.metrics.resolvedByAI(validJid, aiResponseTimeMs, qaResult?.confidence);

                this.addToHistory(validJid, 'assistant', response);

                return {
                    source: 'gemini', // Keeping 'gemini' source for compatibility, or update to 'ai'
                    response,
                    confidence: qaResult?.confidence
                };
            }
        }

        // Step 3: Cannot answer - Create escalation alert if enabled
        if (chatConfig.autoEscalate && this.alertService.checkRateLimit(validJid)) {
            const geminiAnalysis: GeminiAnalysis = {
                intent: this.extractIntent(sanitizedMessage),
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

            // Generate AI draft for the human agent (with failover)
            let aiDraftResponse: string | undefined;

            const providers: { name: string; agent: any }[] = [];
            // Assuming same preference as main response
            if (this.config.aiConfig.preferredProvider === 'groq') {
                if (this.groqAgent) providers.push({ name: 'groq', agent: this.groqAgent });
                if (this.config.aiConfig.enableFailover && this.geminiAgent) providers.push({ name: 'gemini', agent: this.geminiAgent });
            } else {
                if (this.geminiAgent) providers.push({ name: 'gemini', agent: this.geminiAgent });
                if (this.config.aiConfig.enableFailover && this.groqAgent) providers.push({ name: 'groq', agent: this.groqAgent });
            }

            if (providers.length > 0) {
                const draftContext = this.buildGeminiContext(validJid, sanitizedMessage) +
                    "\n\nINSTRUCTION: The user's query could not be confidently answered by the knowledge base. " +
                    "Generate a polite, helpful, and professional draft response that a human agent could send. " +
                    "If you don't have enough information, suggest asking for more details. " +
                    "Start your response directly with the message text.";

                for (const provider of providers) {
                    try {
                        const agent = provider.agent as any;
                        const draftResult = await agent.generateResponse(sanitizedMessage, draftContext);
                        if (draftResult.text) {
                            aiDraftResponse = this.formatResponseByPersonality(draftResult.text, chatConfig.personality);
                            break;
                        }
                    } catch (draftError) {
                        Logger.warn(`[BotOrchestrator] Failed to generate AI draft with ${provider.name}:`, draftError);
                    }
                }
            }

            // Create alert
            const alert = await this.alertService.createAlert(
                validJid,
                sanitizedName,
                sanitizedMessage,
                geminiAnalysis,
                conversationContext,
                aiDraftResponse
            );

            this.config.stats.noMatches++;
            this.saveConfig();
            this.assignmentService.incrementStats(validJid, 'escalations');

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
     * Resolve best category hint for KB search.
     * Priority:
     * 1) classifier suggestion (high confidence)
     * 2) trigger-derived categories mapped to existing KB categories
     */
    private resolveSuggestedCategory(
        classifierCategory: string | undefined,
        classifierConfidence: number,
        triggerCategories?: string[]
    ): string | undefined {
        const normalizedClassifier = classifierCategory?.trim();
        if (normalizedClassifier && classifierConfidence >= 0.75) {
            return normalizedClassifier;
        }

        const normalizedTriggers = (triggerCategories || [])
            .map(c => c.trim())
            .filter(Boolean);
        if (normalizedTriggers.length === 0) {
            return normalizedClassifier || undefined;
        }

        const categories = this.qaAgent.getCategories();
        const toNorm = (v: string) => v.toLowerCase();

        for (const triggerCategory of normalizedTriggers) {
            const triggerNorm = toNorm(triggerCategory);
            const match = categories.find(category => {
                const idNorm = toNorm(category.id);
                const nameNorm = toNorm(category.name);
                return (
                    idNorm.includes(triggerNorm) ||
                    nameNorm.includes(triggerNorm) ||
                    triggerNorm.includes(idNorm) ||
                    triggerNorm.includes(nameNorm)
                );
            });

            if (match) {
                Logger.debug(`[BotOrchestrator] Trigger category mapped: ${triggerCategory} -> ${match.id}`);
                return match.id;
            }
        }

        return normalizedClassifier || normalizedTriggers[0];
    }

    /**
     * Build context for Gemini including business info and related Q&A
     */
    private buildGeminiContext(jid: string, query: string): string {
        const parts: string[] = [];

        // Add business context
        const business = this.qaAgent.getBusinessContext();
        if (business) {
            parts.push(`Negocio: ${business.name}`);
            parts.push(`Descripcion: ${business.description}`);
            parts.push(`Tono de respuesta: ${business.tone}`);
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

    private getConversationContextForAlert(jid: string): AlertConversation[] {
        return this.getHistory(jid)
            .slice(-5)
            .map(msg => ({
                role: msg.role === 'user' ? 'customer' as const : 'bot' as const,
                message: msg.content,
                timestamp: new Date(msg.timestamp).toISOString()
            }));
    }

    private async createApprovalAlert(
        jid: string,
        customerName: string,
        originalMessage: string,
        aiDraftResponse: string,
        intent: string,
        confidence: number,
        reason: string,
        customFallback?: string
    ): Promise<{ alertId: string; message: string } | null> {
        if (!this.alertService.checkRateLimit(jid)) {
            return null;
        }

        const analysis: GeminiAnalysis = {
            intent: intent || this.extractIntent(originalMessage),
            suggestedTopics: this.qaAgent.getRelatedItems(originalMessage, 3).map(i => i.questions[0]),
            confidence: confidence || 0,
            reason,
            canAnswer: false
        };

        const alert = await this.alertService.createAlert(
            jid,
            customerName,
            originalMessage,
            analysis,
            this.getConversationContextForAlert(jid),
            aiDraftResponse
        );

        this.assignmentService.incrementStats(jid, 'escalations');
        this.metrics.escalatedToHuman(jid, alert.id, alert.priority, analysis.intent);

        return {
            alertId: alert.id,
            message: customFallback || 'Recibí tu mensaje. Un miembro del equipo lo revisará antes de responderte.'
        };
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

        // Limit per-chat history size
        if (history.length > this.config.settings.maxHistoryMessages) {
            history.shift();
        }

        // Limit total number of tracked chats to prevent unbounded memory growth
        const MAX_TRACKED_CHATS = 500;
        if (this.conversationHistory.size > MAX_TRACKED_CHATS) {
            // Evict the oldest chat (first key in Map insertion order)
            const oldestJid = this.conversationHistory.keys().next().value;
            if (oldestJid && oldestJid !== jid) {
                this.conversationHistory.delete(oldestJid);
            }
        }

        this.historyDirty = true;
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
        this.historyDirty = true;
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
        return {
            ...this.config,
            geminiConfigured: !!process.env.GEMINI_API_KEY || !!this.config.geminiApiKey
        };
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
     * Get resolution statistics with percentages
     */
    getResolutionStats(): {
        total: number;
        resolvedByKB: { count: number; percentage: number };
        resolvedByGemini: { count: number; percentage: number };
        escalatedToHuman: { count: number; percentage: number };
        fallback: { count: number; percentage: number };
    } {
        const { totalQueries, qaMatches, geminiResponses, noMatches } = this.config.stats;

        const total = totalQueries || 1; // Avoid division by zero

        return {
            total: totalQueries,
            resolvedByKB: {
                count: qaMatches,
                percentage: totalQueries > 0 ? Math.round((qaMatches / totalQueries) * 100) : 0
            },
            resolvedByGemini: {
                count: geminiResponses,
                percentage: totalQueries > 0 ? Math.round((geminiResponses / totalQueries) * 100) : 0
            },
            escalatedToHuman: {
                count: noMatches,
                percentage: totalQueries > 0 ? Math.round((noMatches / totalQueries) * 100) : 0
            },
            fallback: {
                count: totalQueries - qaMatches - geminiResponses - noMatches,
                percentage: totalQueries > 0 ? Math.round(((totalQueries - qaMatches - geminiResponses - noMatches) / totalQueries) * 100) : 0
            }
        };
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
                Logger.error('[BotOrchestrator] Learning failed:', error);
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
