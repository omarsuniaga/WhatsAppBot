/**
 * Auto Response Service
 * Sistema de respuestas automáticas con IA (Gemini)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { KnowledgeBaseService } from './knowledgeBaseService';
import { EscalationService } from './escalationService';
import type { 
    AIResponse, 
    ConversationContext, 
    ContextMessage,
    KnowledgeBaseConfig 
} from '../types/knowledge';

interface AutoResponseConfig {
    enabled: boolean;
    geminiApiKey: string;
    model: string;
    maxTokens: number;
    temperature: number;
}

const DEFAULT_CONFIG: AutoResponseConfig = {
    enabled: true,
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    model: 'gemini-1.5-flash',
    maxTokens: 1024,
    temperature: 0.7
};

export class AutoResponseService {
    private static instance: AutoResponseService;
    private config: AutoResponseConfig;
    private genAI: GoogleGenerativeAI | null = null;
    private knowledgeBase: KnowledgeBaseService;
    private escalationService: EscalationService | null = null;
    private conversationContexts: Map<string, ConversationContext> = new Map();

    private constructor() {
        this.config = DEFAULT_CONFIG;
        this.knowledgeBase = KnowledgeBaseService.getInstance();
        this.initializeGemini();
    }

    public static getInstance(): AutoResponseService {
        if (!AutoResponseService.instance) {
            AutoResponseService.instance = new AutoResponseService();
        }
        return AutoResponseService.instance;
    }

    private initializeGemini(): void {
        if (this.config.geminiApiKey) {
            try {
                this.genAI = new GoogleGenerativeAI(this.config.geminiApiKey);
                console.log('✅ Gemini AI initialized for auto-response');
            } catch (error) {
                console.error('❌ Failed to initialize Gemini AI:', error);
            }
        } else {
            console.warn('⚠️ Gemini API key not configured for auto-response');
        }
    }

    public setEscalationService(service: EscalationService): void {
        this.escalationService = service;
    }

    public updateConfig(config: Partial<AutoResponseConfig>): void {
        this.config = { ...this.config, ...config };
        if (config.geminiApiKey) {
            this.initializeGemini();
        }
    }

    public isEnabled(): boolean {
        return this.config.enabled && this.genAI !== null;
    }

    // ==========================================
    // Main Response Logic
    // ==========================================

    public async processMessage(
        chatJid: string,
        customerName: string,
        message: string,
        isGroup: boolean = false
    ): Promise<{
        shouldRespond: boolean;
        response: string | null;
        confidence: number;
        escalated: boolean;
        faqId: string | null;
    }> {
        // Don't auto-respond in groups by default
        if (isGroup) {
            return {
                shouldRespond: false,
                response: null,
                confidence: 0,
                escalated: false,
                faqId: null
            };
        }

        if (!this.isEnabled()) {
            return {
                shouldRespond: false,
                response: null,
                confidence: 0,
                escalated: false,
                faqId: null
            };
        }

        // Update conversation context
        this.updateContext(chatJid, customerName, message, false);

        // Get knowledge base config
        const kbConfig = this.knowledgeBase.getConfig();

        // Step 1: Search in knowledge base
        const searchResult = this.knowledgeBase.findBestMatch(message);

        // Step 2: Analyze with AI
        const aiResponse = await this.analyzeWithAI(chatJid, message, kbConfig);

        // Step 3: Decision making
        if (searchResult && searchResult.score >= kbConfig.minConfidenceToRespond) {
            // High confidence - respond directly
            const response = await this.adaptResponse(
                searchResult.faq.answer,
                customerName,
                kbConfig
            );

            this.knowledgeBase.recordUsage(searchResult.faq.id);

            return {
                shouldRespond: true,
                response,
                confidence: searchResult.score,
                escalated: false,
                faqId: searchResult.faq.id
            };
        }

        if (aiResponse.canAnswer && aiResponse.confidence >= kbConfig.minConfidenceToRespond) {
            // AI can answer with high confidence
            return {
                shouldRespond: true,
                response: aiResponse.response,
                confidence: aiResponse.confidence,
                escalated: false,
                faqId: aiResponse.matchedFaqId
            };
        }

        if (searchResult && searchResult.score >= kbConfig.minConfidenceToConfirm) {
            // Medium confidence - respond but may need confirmation
            const response = await this.adaptResponse(
                searchResult.faq.answer + '\n\n¿Esto responde tu pregunta? Si no, un agente te ayudará.',
                customerName,
                kbConfig
            );

            this.knowledgeBase.recordUsage(searchResult.faq.id);

            return {
                shouldRespond: true,
                response,
                confidence: searchResult.score,
                escalated: false,
                faqId: searchResult.faq.id
            };
        }

        // Low confidence - escalate to human
        if (aiResponse.shouldEscalate || !aiResponse.canAnswer) {
            const escalated = await this.escalateToHuman(
                chatJid,
                customerName,
                message,
                aiResponse.escalationReason || 'No se encontró respuesta en la base de conocimiento'
            );

            if (escalated) {
                return {
                    shouldRespond: true,
                    response: this.getWaitingMessage(customerName, kbConfig),
                    confidence: 0,
                    escalated: true,
                    faqId: null
                };
            }
        }

        return {
            shouldRespond: false,
            response: null,
            confidence: 0,
            escalated: false,
            faqId: null
        };
    }

    // ==========================================
    // AI Analysis
    // ==========================================

    private async analyzeWithAI(
        chatJid: string,
        message: string,
        kbConfig: KnowledgeBaseConfig
    ): Promise<AIResponse> {
        if (!this.genAI) {
            return {
                canAnswer: false,
                confidence: 0,
                response: '',
                matchedFaqId: null,
                detectedIntent: 'unknown',
                shouldEscalate: true,
                escalationReason: 'AI not configured'
            };
        }

        try {
            const model = this.genAI.getGenerativeModel({ model: this.config.model });
            const context = this.getContext(chatJid);
            const faqs = this.knowledgeBase.getApprovedFaqs();

            const prompt = this.buildAnalysisPrompt(message, context, faqs, kbConfig);

            const result = await model.generateContent(prompt);
            const responseText = result.response.text();

            // Parse JSON response
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    canAnswer: parsed.can_answer || false,
                    confidence: parsed.confidence || 0,
                    response: parsed.response || '',
                    matchedFaqId: parsed.matched_faq_id || null,
                    detectedIntent: parsed.detected_intent || 'unknown',
                    shouldEscalate: parsed.should_escalate || false,
                    escalationReason: parsed.escalation_reason || null
                };
            }

            // Fallback if JSON parsing fails
            return {
                canAnswer: false,
                confidence: 0,
                response: responseText,
                matchedFaqId: null,
                detectedIntent: 'unknown',
                shouldEscalate: true,
                escalationReason: 'Could not parse AI response'
            };
        } catch (error) {
            console.error('Error analyzing with AI:', error);
            return {
                canAnswer: false,
                confidence: 0,
                response: '',
                matchedFaqId: null,
                detectedIntent: 'error',
                shouldEscalate: true,
                escalationReason: `AI error: ${error}`
            };
        }
    }

    private buildAnalysisPrompt(
        message: string,
        context: ConversationContext | null,
        faqs: any[],
        kbConfig: KnowledgeBaseConfig
    ): string {
        const toneGuide = {
            formal: 'Usa un tono formal y profesional. Evita emojis y expresiones coloquiales.',
            friendly: 'Usa un tono amigable y cercano. Puedes usar emojis moderadamente.',
            professional: 'Usa un tono profesional pero accesible. Usa emojis ocasionalmente si es apropiado.'
        };

        const faqsText = faqs.map(faq => 
            `[ID: ${faq.id}]\nPreguntas: ${faq.questions.join(', ')}\nRespuesta: ${faq.answer}\n`
        ).join('\n---\n');

        const contextText = context?.lastMessages
            .map(m => `${m.isFromMe ? 'Bot' : 'Cliente'}: ${m.body}`)
            .join('\n') || 'Sin historial previo';

        return `
Eres un asistente virtual de ${kbConfig.businessName}. ${kbConfig.businessDescription}

INSTRUCCIONES:
1. Analiza el mensaje del cliente y determina si puedes responder usando SOLO la información de la base de conocimiento.
2. ${toneGuide[kbConfig.toneStyle]}
3. Si no tienes información suficiente para responder, indica que se debe escalar a un humano.
4. NUNCA inventes información que no esté en la base de conocimiento.
5. Responde en español.

BASE DE CONOCIMIENTO:
${faqsText || 'Sin FAQs registradas aún.'}

HISTORIAL DE CONVERSACIÓN:
${contextText}

MENSAJE DEL CLIENTE:
"${message}"

Responde ÚNICAMENTE con un JSON válido en el siguiente formato:
{
  "can_answer": boolean,
  "confidence": number (0-1),
  "response": "texto de respuesta para el cliente",
  "matched_faq_id": "id de la FAQ que coincide o null",
  "detected_intent": "string describiendo la intención del usuario",
  "should_escalate": boolean,
  "escalation_reason": "razón para escalar o null"
}
`;
    }

    // ==========================================
    // Response Adaptation
    // ==========================================

    private async adaptResponse(
        baseResponse: string,
        customerName: string,
        kbConfig: KnowledgeBaseConfig
    ): Promise<string> {
        // Replace placeholders
        let response = baseResponse
            .replace(/\{nombre\}/gi, customerName || 'estimado cliente')
            .replace(/\{empresa\}/gi, kbConfig.businessName);

        // Optionally use AI to adapt tone
        if (this.genAI && kbConfig.toneStyle !== 'professional') {
            try {
                const model = this.genAI.getGenerativeModel({ model: this.config.model });
                const tonePrompt = `
Adapta el siguiente mensaje al tono ${kbConfig.toneStyle === 'formal' ? 'formal' : 'amigable'}:
"${response}"

Responde SOLO con el mensaje adaptado, sin explicaciones.
`;
                const result = await model.generateContent(tonePrompt);
                response = result.response.text().trim();
            } catch (error) {
                console.warn('Could not adapt tone:', error);
            }
        }

        return response;
    }

    private getWaitingMessage(customerName: string, kbConfig: KnowledgeBaseConfig): string {
        const messages = [
            `Hola ${customerName}! 👋 Gracias por tu mensaje. Tu consulta requiere atención personalizada. Un agente te responderá en breve.`,
            `Gracias por contactarnos, ${customerName}. Estamos procesando tu solicitud y un representante te atenderá pronto. 🙏`,
            `Hola ${customerName}! Tu pregunta ha sido recibida. Un miembro de nuestro equipo te responderá a la brevedad.`
        ];

        return messages[Math.floor(Math.random() * messages.length)]
            .replace(/\{empresa\}/gi, kbConfig.businessName);
    }

    // ==========================================
    // Escalation
    // ==========================================

    private async escalateToHuman(
        chatJid: string,
        customerName: string,
        message: string,
        reason: string
    ): Promise<boolean> {
        if (!this.escalationService) {
            console.warn('Escalation service not configured');
            return false;
        }

        try {
            const context = this.getContext(chatJid);
            await this.escalationService.createTicket({
                chatJid,
                customerName,
                customerPhone: chatJid.split('@')[0],
                originalMessage: message,
                conversationContext: context?.lastMessages || [],
                reason
            });
            return true;
        } catch (error) {
            console.error('Error escalating to human:', error);
            return false;
        }
    }

    // ==========================================
    // Context Management
    // ==========================================

    public updateContext(
        chatJid: string,
        customerName: string,
        message: string,
        isFromMe: boolean
    ): void {
        let context = this.conversationContexts.get(chatJid);
        
        if (!context) {
            context = {
                chatJid,
                customerName,
                lastMessages: [],
                topic: '',
                sentiment: 'neutral'
            };
        }

        const kbConfig = this.knowledgeBase.getConfig();

        context.lastMessages.push({
            id: Date.now().toString(),
            from: isFromMe ? 'bot' : chatJid,
            body: message,
            timestamp: new Date(),
            isFromMe
        });

        // Keep only last N messages
        if (context.lastMessages.length > kbConfig.maxContextMessages) {
            context.lastMessages = context.lastMessages.slice(-kbConfig.maxContextMessages);
        }

        this.conversationContexts.set(chatJid, context);
    }

    public getContext(chatJid: string): ConversationContext | null {
        return this.conversationContexts.get(chatJid) || null;
    }

    public clearContext(chatJid: string): void {
        this.conversationContexts.delete(chatJid);
    }

    // ==========================================
    // Quick Responses (without AI)
    // ==========================================

    public getQuickResponse(message: string): string | null {
        const greetings = ['hola', 'buenos dias', 'buenas tardes', 'buenas noches', 'hey', 'hi'];
        const thanks = ['gracias', 'muchas gracias', 'thank you', 'thanks'];
        const goodbyes = ['adios', 'chao', 'bye', 'hasta luego', 'nos vemos'];

        const normalized = message.toLowerCase().trim();

        if (greetings.some(g => normalized.includes(g))) {
            return '¡Hola! 👋 ¿En qué puedo ayudarte hoy?';
        }

        if (thanks.some(t => normalized.includes(t))) {
            return '¡De nada! 😊 Si tienes más preguntas, no dudes en escribirme.';
        }

        if (goodbyes.some(g => normalized.includes(g))) {
            return '¡Hasta pronto! 👋 Que tengas un excelente día.';
        }

        return null;
    }
}

export default AutoResponseService;
