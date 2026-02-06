/**
 * Knowledge Base Types
 * Sistema de preguntas y respuestas con IA
 */

export interface FAQ {
    id: string;
    category: string;
    questions: string[];           // Variaciones de la pregunta
    answer: string;                // Respuesta base
    keywords: string[];            // Palabras clave para matching
    confidence: number;            // 0-1 nivel de confianza
    usageCount: number;            // Veces que se usó
    lastUsed: Date | null;
    createdBy: 'admin' | 'ai_learned';
    approved: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface FAQCategory {
    id: string;
    name: string;
    description: string;
    icon?: string;
    order: number;
    isActive: boolean;
}

export interface ConversationContext {
    chatJid: string;
    customerName: string;
    lastMessages: ContextMessage[];
    topic: string;
    sentiment: 'positive' | 'neutral' | 'negative';
    pendingQuestion?: string;
    escalatedAt?: Date;
    resolvedBy?: string;
}

export interface ContextMessage {
    id: string;
    from: string;
    body: string;
    timestamp: Date;
    isFromMe: boolean;
}

export interface AIResponse {
    canAnswer: boolean;
    confidence: number;
    response: string;
    matchedFaqId: string | null;
    detectedIntent: string;
    shouldEscalate: boolean;
    escalationReason: string | null;
    suggestedCategory?: string;
}

export interface KnowledgeBaseConfig {
    minConfidenceToRespond: number;      // Default: 0.85
    minConfidenceToConfirm: number;      // Default: 0.50
    maxContextMessages: number;          // Default: 10
    enableSemanticSearch: boolean;       // Default: true
    enableAutoLearn: boolean;            // Default: false (require approval)
    responseLanguage: string;            // Default: 'es'
    businessName: string;
    businessDescription: string;
    toneStyle: 'formal' | 'friendly' | 'professional';
}

export interface SearchResult {
    faq: FAQ;
    score: number;
    matchType: 'exact' | 'keyword' | 'semantic';
}
