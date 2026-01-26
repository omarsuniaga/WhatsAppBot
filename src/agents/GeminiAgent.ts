import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { AgentConfig, AIResponse } from './types';

export class GeminiAgent {
    private genAI: GoogleGenerativeAI;
    private model: GenerativeModel;
    private config: AgentConfig;

    constructor(config: AgentConfig) {
        this.config = config;
        this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
        // Usamos Gemini 1.5 Flash por ser rápido y económico para chat
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    }

    /**
     * Genera una respuesta basada en el mensaje del usuario y el contexto encontrado.
     */
    async generateResponse(userMessage: string, context: string): Promise<AIResponse> {
        try {
            // Construimos el prompt con instrucciones estrictas
            const prompt = `
            ROL: Eres un asistente virtual útil y amable.
            
            CONTEXTO DE CONOCIMIENTO (Base de datos):
            "${context}"
            
            INSTRUCCIONES:
            1. Responde a la pregunta del usuario basándote EXCLUSIVAMENTE en el "CONTEXTO DE CONOCIMIENTO" provisto arriba.
            2. Si la respuesta no está en el contexto, di amablemente: "Lo siento, no tengo información sobre eso en este momento" y ofrece contactar a un humano si es posible.
            3. Sé conciso y directo.
            4. Mantén un tono profesional pero cercano.
            
            PREGUNTA DEL USUARIO:
            "${userMessage}"
            `;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            return {
                text: text,
                usage: {
                    // Nota: El conteo exacto depende de la respuesta completa de la API, 
                    // aquí simplificamos si no necesitamos métricas exactas
                    promptTokens: 0, 
                    responseTokens: 0
                }
            };

        } catch (error) {
            console.error('Error en GeminiAgent:', error);
            return {
                text: 'Lo siento, tuve un problema procesando tu solicitud. Por favor intenta más tarde.'
            };
        }
    }

    updateConfig(newConfig: Partial<AgentConfig>) {
        this.config = { ...this.config, ...newConfig };
        if (newConfig.geminiApiKey) {
            this.genAI = new GoogleGenerativeAI(newConfig.geminiApiKey);
            this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        }
    }
}
