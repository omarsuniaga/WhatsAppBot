/**
 * IntentClassifierAgent - Semantic intent classification using Gemini AI
 * 
 * Replaces keyword-based intent extraction with AI-powered semantic analysis.
 * Falls back to keyword matching if Gemini is unavailable.
 */

import { AIService } from '../server/services/aiService';
import { BotOrchestrator } from './BotOrchestrator';
import { QASearchAgent, BusinessContext } from './QASearchAgent';
import { getErrorMessage } from '../server/utils/errorUtils';

// Classification result interface
export interface ClassificationResult {
    intent: string;
    confidence: number;
    entities: Record<string, string>;
    sentiment: 'positive' | 'neutral' | 'negative';
    suggestedCategory: string;
    requiresHuman: boolean;
    source: 'ai' | 'keyword_fallback';
}

// Conversation message for context
export interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
}

// Cache entry with timestamp
interface CacheEntry {
    result: ClassificationResult;
    timestamp: number;
}

// Valid intents for classification
const VALID_INTENTS = [
    'saludo',
    'despedida',
    'agradecimiento',
    'consulta_precio',
    'consulta_horario',
    'consulta_inscripcion',
    'consulta_disponibilidad',
    'consulta_ubicacion',
    'queja',
    'soporte_tecnico',
    'emergencia',
    'solicitud_info_general',
    'otro'
] as const;

// Intents that trigger immediate escalation
const ESCALATION_INTENTS = ['queja', 'emergencia', 'soporte_tecnico'];

// Intents that can be handled with simple responses
const CONVERSATIONAL_INTENTS = ['saludo', 'despedida', 'agradecimiento'];

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL_MS = 5 * 60 * 1000;

export class IntentClassifierAgent {
    private static instance: IntentClassifierAgent;
    private cache: Map<string, CacheEntry> = new Map();
    private qaAgent: QASearchAgent;

    private constructor() {
        this.qaAgent = new QASearchAgent();

        // Clean up expired cache entries periodically
        setInterval(() => this.cleanupCache(), CACHE_TTL_MS);
    }

    static getInstance(): IntentClassifierAgent {
        if (!IntentClassifierAgent.instance) {
            IntentClassifierAgent.instance = new IntentClassifierAgent();
        }
        return IntentClassifierAgent.instance;
    }

    /**
     * Main classification method - uses Gemini AI with keyword fallback
     */
    async classifyMessage(
        message: string,
        conversationHistory?: ConversationMessage[]
    ): Promise<ClassificationResult> {
        // Check cache first
        const cacheKey = this.getCacheKey(message);
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            console.log('[IntentClassifier] Cache hit for message');
            return cached;
        }

        // Try Gemini classification
        try {
            const result = await this.classifyWithAI(message, conversationHistory);

            // Cache the result
            this.setInCache(cacheKey, result);

            return result;
        } catch (error: unknown) {
            console.error('[IntentClassifier] Gemini error, using fallback:', getErrorMessage(error));
            return this.keywordFallback(message);
        }
    }

    /**
     * Classify message using AI (Gemini/Groq)
     */
    private async classifyWithAI(
        message: string,
        conversationHistory: ConversationMessage[] | undefined
    ): Promise<ClassificationResult> {
        const aiService = AIService.getInstance();

        // Get business context
        const businessContext = this.qaAgent.getBusinessContext();
        const categories = this.qaAgent.getCategories().map(c => c.name);

        // Build conversation context
        const historyContext = conversationHistory
            ? conversationHistory.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n')
            : 'Sin historial previo';

        const prompt = `Eres un clasificador de intenciones para un bot de WhatsApp de una academia de música.

CONTEXTO DEL NEGOCIO:
${businessContext ? `- Nombre: ${businessContext.name}\n- Descripción: ${businessContext.description}\n- Tono: ${businessContext.tone}` : 'Academia de música'}

CATEGORÍAS DISPONIBLES EN LA BASE DE CONOCIMIENTO:
${categories.length > 0 ? categories.join(', ') : 'información general, inscripciones, horarios, precios'}

HISTORIAL DE CONVERSACIÓN RECIENTE:
${historyContext}

MENSAJE A CLASIFICAR:
"${message}"

INTENCIONES VÁLIDAS:
- saludo: Saludos iniciales (hola, buenos días, etc.)
- despedida: Despedidas (adiós, hasta luego, etc.)
- agradecimiento: Expresiones de gratitud (gracias, muy amable, etc.)
- consulta_precio: Preguntas sobre costos, tarifas, pagos
- consulta_horario: Preguntas sobre horarios, disponibilidad de tiempo
- consulta_inscripcion: Interés en inscribirse, matricularse, registrarse
- consulta_disponibilidad: Preguntas sobre disponibilidad de clases/instrumentos
- consulta_ubicacion: Preguntas sobre dirección, ubicación, cómo llegar
- queja: Reclamos, problemas, insatisfacción
- soporte_tecnico: Problemas técnicos con la plataforma
- emergencia: Situaciones urgentes que requieren atención inmediata
- solicitud_info_general: Preguntas generales sobre la academia
- otro: No encaja en ninguna categoría

RESPONDE ÚNICAMENTE con un JSON válido (sin markdown):
{
    "intent": "una de las intenciones válidas",
    "confidence": 0.0-1.0,
    "entities": {"clave": "valor detectado"},
    "sentiment": "positive|neutral|negative",
    "suggestedCategory": "categoría de KB más relevante",
    "requiresHuman": true/false
}

Extrae entidades como: nombre, instrumento, edad, fecha, hora, telefono, email, relacion (padre/madre/hijo).
Marca requiresHuman=true si es queja, emergencia, o si el mensaje es muy complejo.`;

        try {
            const result = await aiService.generateText(prompt, {
                temperature: 0.1, // Low temperature for classification
                systemPrompt: "Eres un clasificador de intenciones experto."
            });
            const text = result.text;

            // Parse the JSON response
            const parsed = this.parseAIResponse(text);

            // Validate and normalize the result
            return this.normalizeResult(parsed, result.provider === 'gemini' ? 'ai' : 'ai'); // We use 'ai' as source now
        } catch (error: unknown) {
            throw error;
        }
    }

    /**
     * Parse AI response to JSON
     */
    private parseAIResponse(text: string): any {
        // Remove markdown code blocks if present
        let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        // Find JSON object
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        throw new Error('No valid JSON found in Gemini response');
    }

    /**
     * Normalize and validate classification result
     */
    private normalizeResult(parsed: any, source: 'ai' | 'keyword_fallback' = 'ai'): ClassificationResult {
        const intent = VALID_INTENTS.includes(parsed.intent) ? parsed.intent : 'otro';
        const confidence = Math.max(0, Math.min(1, parsed.confidence || 0.5));

        return {
            intent,
            confidence,
            entities: parsed.entities || {},
            sentiment: ['positive', 'neutral', 'negative'].includes(parsed.sentiment)
                ? parsed.sentiment
                : 'neutral',
            suggestedCategory: parsed.suggestedCategory || '',
            requiresHuman: parsed.requiresHuman === true || ESCALATION_INTENTS.includes(intent),
            source
        };
    }

    /**
     * Keyword-based fallback classification (original extractIntent logic + enhancements)
     */
    private keywordFallback(message: string): ClassificationResult {
        const lowerMessage = message.toLowerCase();

        const intentKeywords: Record<string, string[]> = {
            'saludo': ['hola', 'buenos días', 'buenas tardes', 'buenas noches', 'hey', 'hi', 'saludos'],
            'despedida': ['adiós', 'adios', 'hasta luego', 'chao', 'bye', 'nos vemos', 'hasta pronto'],
            'agradecimiento': ['gracias', 'muchas gracias', 'te agradezco', 'muy amable', 'excelente', 'perfecto'],
            'consulta_precio': ['precio', 'costo', 'cuanto', 'cuánto', 'vale', 'tarifa', 'mensualidad', 'pago'],
            'consulta_horario': ['horario', 'hora', 'cuando', 'cuándo', 'disponible', 'abierto', 'atienden'],
            'consulta_inscripcion': ['inscribir', 'inscripción', 'inscripcion', 'matricular', 'registrar', 'apuntar', 'empezar clases'],
            'consulta_disponibilidad': ['disponible', 'hay cupo', 'tienen', 'ofrecen', 'dan clases'],
            'consulta_ubicacion': ['direccion', 'dirección', 'donde', 'dónde', 'ubicacion', 'ubicación', 'llegar', 'queda'],
            'queja': ['queja', 'reclamo', 'problema', 'mal', 'molesto', 'terrible', 'pésimo', 'decepcionado'],
            'soporte_tecnico': ['no funciona', 'error', 'falla', 'bug', 'no puedo', 'no carga'],
            'emergencia': ['urgente', 'emergencia', 'inmediato', 'ahora mismo', 'critical']
        };

        // Entity extraction patterns
        const entities: Record<string, string> = {};

        // Extract instrument
        const instruments = ['piano', 'guitarra', 'violin', 'violín', 'flauta', 'bateria', 'batería', 'canto', 'saxofon', 'saxofón', 'trompeta', 'cello', 'violonchelo'];
        for (const inst of instruments) {
            if (lowerMessage.includes(inst)) {
                entities['instrumento'] = inst;
                break;
            }
        }

        // Extract age
        const ageMatch = lowerMessage.match(/(\d+)\s*años/);
        if (ageMatch) {
            entities['edad'] = ageMatch[1];
        }

        // Extract relationship
        const relationships = ['hijo', 'hija', 'niño', 'niña', 'sobrino', 'sobrina', 'nieto', 'nieta'];
        for (const rel of relationships) {
            if (lowerMessage.includes(rel)) {
                entities['relacion'] = rel;
                break;
            }
        }

        // Detect intent
        let detectedIntent = 'solicitud_info_general';
        let confidence = 0.5;

        for (const [intent, keywords] of Object.entries(intentKeywords)) {
            const matchedKeywords = keywords.filter(kw => lowerMessage.includes(kw));
            if (matchedKeywords.length > 0) {
                detectedIntent = intent;
                confidence = Math.min(0.7 + (matchedKeywords.length * 0.1), 0.9);
                break;
            }
        }

        // Detect sentiment
        let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
        const positiveWords = ['gracias', 'excelente', 'perfecto', 'genial', 'bueno', 'interesado'];
        const negativeWords = ['mal', 'problema', 'queja', 'molesto', 'terrible'];

        if (positiveWords.some(w => lowerMessage.includes(w))) {
            sentiment = 'positive';
        } else if (negativeWords.some(w => lowerMessage.includes(w))) {
            sentiment = 'negative';
        }

        // Suggest category based on intent
        const categoryMap: Record<string, string> = {
            'consulta_precio': 'precios',
            'consulta_horario': 'horarios',
            'consulta_inscripcion': 'inscripciones',
            'consulta_disponibilidad': 'clases',
            'consulta_ubicacion': 'ubicación'
        };

        return {
            intent: detectedIntent,
            confidence,
            entities,
            sentiment,
            suggestedCategory: categoryMap[detectedIntent] || '',
            requiresHuman: ESCALATION_INTENTS.includes(detectedIntent),
            source: 'keyword_fallback'
        };
    }

    /**
     * Check if intent is conversational (can be handled with simple response)
     */
    isConversationalIntent(intent: string): boolean {
        return CONVERSATIONAL_INTENTS.includes(intent);
    }

    /**
     * Get a simple response for conversational intents
     */
    getConversationalResponse(intent: string, customerName?: string): string {
        const name = customerName || '';
        const greeting = name ? ` ${name}` : '';

        const responses: Record<string, string[]> = {
            'saludo': [
                `¡Hola${greeting}! 👋 Bienvenido a nuestra academia de música. ¿En qué puedo ayudarte hoy?`,
                `¡Buenos días${greeting}! 🎵 Es un gusto atenderte. ¿Qué información necesitas?`
            ],
            'despedida': [
                `¡Hasta pronto${greeting}! 👋 Fue un gusto atenderte. ¡Que tengas un excelente día! 🎶`,
                `¡Adiós${greeting}! Cualquier cosa que necesites, aquí estaremos. 🎵`
            ],
            'agradecimiento': [
                `¡De nada${greeting}! 😊 Es un placer poder ayudarte. ¿Hay algo más en lo que pueda asistirte?`,
                `¡Con mucho gusto${greeting}! 🎵 Estamos aquí para servirte.`
            ]
        };

        const intentResponses = responses[intent] || responses['saludo'];
        return intentResponses[Math.floor(Math.random() * intentResponses.length)];
    }

    // ==========================================
    // Cache Management
    // ==========================================

    private getCacheKey(message: string): string {
        // Normalize message for cache key
        return message.toLowerCase().trim().substring(0, 200);
    }

    private getFromCache(key: string): ClassificationResult | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        // Check if expired
        if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
            this.cache.delete(key);
            return null;
        }

        return entry.result;
    }

    private setInCache(key: string, result: ClassificationResult): void {
        this.cache.set(key, {
            result,
            timestamp: Date.now()
        });
    }

    private cleanupCache(): void {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > CACHE_TTL_MS) {
                this.cache.delete(key);
            }
        }
    }

}

export default IntentClassifierAgent;
