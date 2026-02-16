import { GoogleGenerativeAI } from '@google/generative-ai';
import { BotOrchestrator } from '../../agents/BotOrchestrator';
import Logger from './loggerService';
import { getErrorMessage } from '../utils/errorUtils';

export interface AIResponse {
    text: string;
    provider: 'gemini' | 'groq';
    model: string;
}

export interface AIRequestOptions {
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string; // Optional system instruction (Groq/OpenAI style)
}

export class AIService {
    private static instance: AIService;

    private constructor() { }

    public static getInstance(): AIService {
        if (!AIService.instance) {
            AIService.instance = new AIService();
        }
        return AIService.instance;
    }

    /**
     * Get the current AI configuration from BotOrchestrator
     */
    private getConfig() {
        return BotOrchestrator.getInstance().getConfig().aiConfig;
    }

    /**
     * Main method: Generate text with Smart Failover
     */
    async generateText(prompt: string, options?: AIRequestOptions): Promise<AIResponse> {
        const config = this.getConfig();
        const preferred = config.preferredProvider || 'groq'; // Changed default to GROQ

        Logger.info(`AIService: Requesting generation. Preferred: ${preferred}. Failover: ${config.enableFailover}`);

        // Try preferred provider first
        try {
            if (preferred === 'groq') {
                return await this.generateWithGroq(prompt, options);
            } else {
                return await this.generateWithGemini(prompt, options);
            }
        } catch (error: unknown) {
            // Check if failover is enabled
            if (config.enableFailover) {
                Logger.warn(`AIService: Preferred provider ${preferred} failed. Attempting failover... Error: ${getErrorMessage(error)}`);

                // Try the OTHER provider
                try {
                    if (preferred === 'groq') {
                        return await this.generateWithGemini(prompt, options);
                    } else {
                        return await this.generateWithGroq(prompt, options);
                    }
                } catch (failoverError: any) {
                    Logger.error(`AIService: Failover provider also failed. Error: ${failoverError.message}`);
                    throw new Error(`All AI providers failed. Primary: ${getErrorMessage(error)}. Failover: ${failoverError.message}`);
                }
            } else {
                // No failover configured
                throw error;
            }
        }
    }

    /**
     * Provider: Gemini (Google)
     */
    private async generateWithGemini(prompt: string, options?: AIRequestOptions): Promise<AIResponse> {
        const config = this.getConfig();
        const apiKey = config.geminiApiKey || process.env.GEMINI_API_KEY;

        if (!apiKey) throw new Error('Gemini API Key not configured');

        const genAI = new GoogleGenerativeAI(apiKey);
        // Models to try for resilience (prioritize free tier friendly models)
        const models = ['gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-pro'];

        let lastError;
        for (const modelName of models) {
            try {
                const model = genAI.getGenerativeModel({
                    model: modelName,
                    generationConfig: {
                        maxOutputTokens: options?.maxTokens,
                        temperature: options?.temperature
                    }
                });

                // Combine system prompt if provided
                const finalPrompt = options?.systemPrompt
                    ? `INSTRUCCIONES DEL SISTEMA: ${options.systemPrompt}\n\nUSUARIO: ${prompt}`
                    : prompt;

                const result = await model.generateContent(finalPrompt);
                const text = result.response.text();

                if (!text) throw new Error('Empty response from Gemini');

                return { text, provider: 'gemini', model: modelName };
            } catch (err) {
                lastError = err;
                // Continue to next model
            }
        }
        throw lastError || new Error('Gemini generation failed on all models');
    }

    /**
     * Provider: Groq (OpenAI Compatible)
     */
    private async generateWithGroq(prompt: string, options?: AIRequestOptions): Promise<AIResponse> {
        const config = this.getConfig();
        const apiKey = config.groqApiKey;

        if (!apiKey) throw new Error('Groq API Key not configured');

        // Llama 3 70B is the comparable model to Gemini Flash
        const model = 'llama-3.3-70b-versatile';

        const messages: { role: string; content: string }[] = [];
        if (options?.systemPrompt) {
            messages.push({ role: 'system', content: options.systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages,
                model,
                temperature: options?.temperature || 0.7,
                max_tokens: options?.maxTokens || 1024
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(`Groq API Error: ${response.status} - ${JSON.stringify(errData)}`);
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;

        if (!text) throw new Error('Empty response from Groq');

        return { text, provider: 'groq', model };
    }

    /**
     * Test connection for a specific provider
     */
    public async testConnection(
        provider: 'gemini' | 'groq',
        apiKey?: string
    ): Promise<{ success: boolean; message: string; model?: string }> {
        const config = this.getConfig();
        const resolvedApiKey = (apiKey || '').trim() || (
            provider === 'gemini'
                ? (config.geminiApiKey || process.env.GEMINI_API_KEY || '')
                : (config.groqApiKey || process.env.GROQ_API_KEY || '')
        );

        if (!resolvedApiKey) {
            return {
                success: false,
                message: `No API key configured for provider: ${provider}`
            };
        }

        try {
            if (provider === 'gemini') {
                const genAI = new GoogleGenerativeAI(resolvedApiKey);
                const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
                await model.generateContent('Test');
                return { success: true, message: 'Gemini Operational', model: 'gemini-1.5-flash' };
            } else {
                const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${resolvedApiKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        messages: [{ role: 'user', content: 'Test' }],
                        model: 'llama3-8b-8192' // Use small model for test
                    })
                });
                if (!response.ok) throw new Error(`Status ${response.status}`);
                return { success: true, message: 'Groq Operational', model: 'llama3-8b-8192' };
            }
        } catch (error: unknown) {
            return { success: false, message: getErrorMessage(error) };
        }
    }
}
