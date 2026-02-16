// @ts-ignore
import Groq from 'groq-sdk';
import { AgentConfig, AIResponse } from './types';
import { getErrorMessage } from '../server/utils/errorUtils';

// Using Groq's Llama 3 or Mixtral models for fast inference
const GROQ_MODEL = 'llama3-70b-8192';
const GROQ_FALLBACK_MODEL = 'mixtral-8x7b-32768';

export class GroqAgent {
    private groq: Groq;
    private config: AgentConfig;

    constructor(config: Partial<AgentConfig> & { groqApiKey: string }) {
        this.config = config as AgentConfig;
        this.groq = new Groq({
            apiKey: config.groqApiKey
        });
    }

    /**
     * Generate response using Groq
     */
    async generateResponse(userMessage: string, context: string): Promise<AIResponse> {
        try {
            const messages = [
                {
                    role: 'system' as const,
                    content: `Eres un asistente virtual útil y amable.

CONTEXTO: "${context}"

REGLAS:
1. Responde SOLO con info del contexto.
2. Si no hay info, di: "Lo siento, no tengo información sobre eso" y ofrece contactar a un humano.
3. Sé conciso y directo.
4. Tono profesional pero cercano.`
                },
                {
                    role: 'user' as const,
                    content: userMessage
                }
            ];

            let text = '';
            try {
                const chatCompletion = await this.groq.chat.completions.create({
                    messages: messages,
                    model: GROQ_MODEL,
                    temperature: 0.7,
                    max_tokens: 512,
                });

                text = chatCompletion.choices[0]?.message?.content || '';
            } catch (primaryError: any) {
                console.warn(`GroqAgent: ${GROQ_MODEL} failed, trying ${GROQ_FALLBACK_MODEL}...`, primaryError);
                // Fallback to secondary model
                const chatCompletion = await this.groq.chat.completions.create({
                    messages: messages,
                    model: GROQ_FALLBACK_MODEL,
                    temperature: 0.7,
                    max_tokens: 512,
                });
                text = chatCompletion.choices[0]?.message?.content || '';
            }

            return {
                text: text,
                usage: {
                    promptTokens: 0, // Groq SDK might provide usage, but optional for now
                    responseTokens: 0
                }
            };

        } catch (error: unknown) {
            console.error('GroqAgent Error:', error);
            // Return empty to allow fallback to Gemini
            return { text: '' };
        }
    }

    updateConfig(newConfig: Partial<AgentConfig>) {
        if (newConfig.groqApiKey) {
            this.groq = new Groq({
                apiKey: newConfig.groqApiKey
            });
        }
    }
}
