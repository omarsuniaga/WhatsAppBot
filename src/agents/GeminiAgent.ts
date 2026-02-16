import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { AgentConfig, AIResponse } from './types';
import { getErrorMessage } from '../server/utils/errorUtils';

// Prefer lighter model to reduce quota usage; fallback to 2.0-flash
const GEMINI_MODEL = 'gemini-2.0-flash-lite';
const GEMINI_FALLBACK_MODEL = 'gemini-2.0-flash';

export class GeminiAgent {
    private genAI: GoogleGenerativeAI;
    private model: GenerativeModel;
    private fallbackModel: GenerativeModel;
    private config: AgentConfig;

    constructor(config: AgentConfig) {
        this.config = config;
        this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
        this.model = this.genAI.getGenerativeModel({
            model: GEMINI_MODEL,
            generationConfig: {
                maxOutputTokens: 512,   // WhatsApp messages are short
                temperature: 0.7,
            }
        });
        this.fallbackModel = this.genAI.getGenerativeModel({
            model: GEMINI_FALLBACK_MODEL,
            generationConfig: {
                maxOutputTokens: 512,
                temperature: 0.7,
            }
        });
    }

    /**
     * Genera una respuesta basada en el mensaje del usuario y el contexto encontrado.
     */
    async generateResponse(userMessage: string, context: string): Promise<AIResponse> {
        try {
            // Prompt optimizado: más corto = menos tokens = menos cuota
            const prompt = `Eres un asistente virtual útil y amable.

CONTEXTO: "${context}"

REGLAS:
1. Responde SOLO con info del contexto.
2. Si no hay info, di: "Lo siento, no tengo información sobre eso" y ofrece contactar a un humano.
3. Sé conciso y directo.
4. Tono profesional pero cercano.

PREGUNTA: "${userMessage}"`;

            let text = '';
            try {
                const result = await this.model.generateContent(prompt);
                text = result.response.text();
            } catch (primaryError: any) {
                // If primary model fails (quota, etc.), try fallback
                if (primaryError.message?.includes('429') || primaryError.message?.includes('quota')) {
                    console.warn(`GeminiAgent: ${GEMINI_MODEL} quota exceeded, trying ${GEMINI_FALLBACK_MODEL}...`);
                    const result = await this.fallbackModel.generateContent(prompt);
                    text = result.response.text();
                } else {
                    throw primaryError;
                }
            }

            return {
                text: text,
                usage: {
                    promptTokens: 0,
                    responseTokens: 0
                }
            };

        } catch (error: unknown) {
            const isQuota = getErrorMessage(error)?.includes('429') || getErrorMessage(error)?.includes('quota');
            console.error(`Error en GeminiAgent${isQuota ? ' (QUOTA EXCEEDED)' : ''}:`, getErrorMessage(error) || error);
            // Return empty text so BotOrchestrator falls through to escalation
            return {
                text: ''
            };
        }
    }

    updateConfig(newConfig: Partial<AgentConfig>) {
        this.config = { ...this.config, ...newConfig };
        if (newConfig.geminiApiKey) {
            this.genAI = new GoogleGenerativeAI(newConfig.geminiApiKey);
            this.model = this.genAI.getGenerativeModel({
                model: GEMINI_MODEL,
                generationConfig: {
                    maxOutputTokens: 512,
                    temperature: 0.7,
                }
            });
            this.fallbackModel = this.genAI.getGenerativeModel({
                model: GEMINI_FALLBACK_MODEL,
                generationConfig: {
                    maxOutputTokens: 512,
                    temperature: 0.7,
                }
            });
        }
    }
}
