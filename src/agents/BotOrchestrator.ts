import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { DecisionAgent } from './DecisionAgent';
import { QASearchAgent, QASearchResult, BusinessContext, QAItem } from './QASearchAgent';
import { GeminiAgent } from './GeminiAgent';
import { AIResponse } from './types';

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
    source: 'qa' | 'gemini' | 'fallback';
    response: string;
    confidence?: number;
    matchedItem?: QASearchResult;
}

export interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

const CONFIG_PATH = join(process.cwd(), 'data', 'bot-config.json');

export class BotOrchestrator {
    private static instance: BotOrchestrator;
    private config: BotConfig;
    private decisionAgent: DecisionAgent;
    private qaAgent: QASearchAgent;
    private geminiAgent: GeminiAgent | null = null;
    private conversationHistory: Map<string, ConversationMessage[]> = new Map();

    private constructor() {
        this.config = this.loadConfig();
        this.decisionAgent = new DecisionAgent();
        this.qaAgent = new QASearchAgent();

        // Initialize Gemini if API key is available
        if (this.config.geminiApiKey) {
            this.initGemini(this.config.geminiApiKey);
        }
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
     * Main method to process incoming messages
     */
    async processMessage(
        jid: string,
        message: string,
        isFromMe: boolean = false
    ): Promise<BotResponse | null> {
        // Check if bot is enabled globally
        if (!this.config.enabled) {
            return null;
        }

        // Check if bot should reply to this chat
        if (!this.decisionAgent.shouldReply(jid, isFromMe)) {
            return null;
        }

        // Update stats
        this.config.stats.totalQueries++;

        // Store message in conversation history
        this.addToHistory(jid, 'user', message);

        // Step 1: Search in Q&A knowledge base
        const qaResult = this.qaAgent.search(message);

        if (qaResult && qaResult.confidence >= this.config.settings.minConfidenceForQA) {
            // Found a good match in Q&A
            const processedAnswer = this.qaAgent.processAnswer(qaResult.item.answer);

            this.config.stats.qaMatches++;
            this.saveConfig();

            this.addToHistory(jid, 'assistant', processedAnswer);

            return {
                source: 'qa',
                response: processedAnswer,
                confidence: qaResult.confidence,
                matchedItem: qaResult
            };
        }

        // Step 2: Try Gemini if enabled and available
        if (
            this.config.settings.useGeminiFallback &&
            this.geminiAgent
        ) {
            try {
                const context = this.buildGeminiContext(jid, message);
                const aiResponse = await this.geminiAgent.generateResponse(message, context);

                if (aiResponse.text) {
                    this.config.stats.geminiResponses++;
                    this.saveConfig();

                    this.addToHistory(jid, 'assistant', aiResponse.text);

                    return {
                        source: 'gemini',
                        response: aiResponse.text,
                        confidence: qaResult?.confidence
                    };
                }
            } catch (error) {
                console.error('[BotOrchestrator] Gemini error:', error);
            }
        }

        // Step 3: Return fallback message
        const fallbackConfig = this.qaAgent.getFallbackConfig();
        const fallbackMessage = fallbackConfig?.noMatch || 'Lo siento, no puedo ayudarte con eso en este momento.';

        this.config.stats.noMatches++;
        this.saveConfig();

        this.addToHistory(jid, 'assistant', fallbackMessage);

        return {
            source: 'fallback',
            response: fallbackMessage,
            confidence: qaResult?.confidence || 0
        };
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
}
