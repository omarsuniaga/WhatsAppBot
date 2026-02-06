/**
 * LearningService - Learns from user responses to create new FAQs
 * Uses Gemini to generate question variations and extract keywords
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { EventEmitter } from 'events';

export interface LearnedResponse {
    id: string;
    sourceAlertId: string;
    originalQuestion: string;
    userResponse: string;

    extractedQuestions: string[];
    extractedKeywords: string[];
    suggestedCategory: string;

    status: 'pending_review' | 'approved' | 'rejected';
    reviewedBy?: string;
    reviewedAt?: string;
    rejectionReason?: string;

    createdFaqId?: string;

    createdAt: string;
}

interface LearningData {
    version: number;
    autoApprove: boolean;
    minConfidenceForAutoApprove: number;
    responses: LearnedResponse[];
}

const DATA_PATH = join(process.cwd(), 'data', 'learned-responses.json');

class LearningService extends EventEmitter {
    private static instance: LearningService;
    private data: LearningData;
    private geminiAgent: any = null;

    private constructor() {
        super();
        this.data = this.load();
    }

    static getInstance(): LearningService {
        if (!LearningService.instance) {
            LearningService.instance = new LearningService();
        }
        return LearningService.instance;
    }

    private load(): LearningData {
        try {
            if (existsSync(DATA_PATH)) {
                return JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
            }
        } catch (error) {
            console.error('[LearningService] Error loading data:', error);
        }

        return {
            version: 1,
            autoApprove: false,
            minConfidenceForAutoApprove: 0.9,
            responses: []
        };
    }

    private save(): void {
        try {
            const dir = dirname(DATA_PATH);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
            writeFileSync(DATA_PATH, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error('[LearningService] Error saving data:', error);
        }
    }

    private generateId(): string {
        return `learn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Set Gemini agent for AI processing
     */
    setGeminiAgent(agent: any): void {
        this.geminiAgent = agent;
    }

    /**
     * Learn from a user response to an alert
     */
    async learnFromResponse(
        alertId: string,
        originalQuestion: string,
        userResponse: string
    ): Promise<LearnedResponse> {
        // Generate variations and extract info
        let extractedQuestions: string[] = [originalQuestion];
        let extractedKeywords: string[] = [];
        let suggestedCategory = 'general';

        if (this.geminiAgent) {
            try {
                const analysis = await this.analyzeForLearning(originalQuestion, userResponse);
                extractedQuestions = analysis.variations || [originalQuestion];
                extractedKeywords = analysis.keywords || [];
                suggestedCategory = analysis.suggestedCategory || 'general';
            } catch (error) {
                console.error('[LearningService] Gemini analysis failed:', error);
                // Fallback to basic extraction
                extractedKeywords = this.extractBasicKeywords(originalQuestion + ' ' + userResponse);
            }
        } else {
            extractedKeywords = this.extractBasicKeywords(originalQuestion + ' ' + userResponse);
        }

        const learned: LearnedResponse = {
            id: this.generateId(),
            sourceAlertId: alertId,
            originalQuestion,
            userResponse,
            extractedQuestions,
            extractedKeywords,
            suggestedCategory,
            status: this.data.autoApprove ? 'approved' : 'pending_review',
            createdAt: new Date().toISOString()
        };

        this.data.responses.unshift(learned);
        this.save();

        this.emit('learning:new', learned);

        console.log(`[LearningService] Created learned response ${learned.id}`);

        // If auto-approve is enabled, emit approved event
        if (this.data.autoApprove) {
            this.emit('learning:approved', learned);
        }

        return learned;
    }

    /**
     * Use Gemini to analyze question/answer for learning
     */
    private async analyzeForLearning(
        question: string,
        answer: string
    ): Promise<{
        variations: string[];
        keywords: string[];
        suggestedCategory: string;
    }> {
        if (!this.geminiAgent) {
            throw new Error('Gemini agent not available');
        }

        const prompt = `Genera variaciones de la siguiente pregunta que un cliente podría hacer.
Las variaciones deben ser naturales y en español.

PREGUNTA ORIGINAL:
"${question}"

RESPUESTA PROPORCIONADA:
"${answer}"

Genera 5 variaciones diferentes de cómo un cliente podría preguntar lo mismo.
Incluye variaciones coloquiales, formales y con errores típicos de escritura.

Responde SOLO en JSON válido (sin markdown):
{
  "variations": ["var1", "var2", "var3", "var4", "var5"],
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "suggestedCategory": "nombre_categoria"
}`;

        try {
            const response = await this.geminiAgent.generateResponse(prompt, '');

            // Parse JSON response
            const jsonMatch = response.text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (error) {
            console.error('[LearningService] Error parsing Gemini response:', error);
        }

        return {
            variations: [question],
            keywords: this.extractBasicKeywords(question),
            suggestedCategory: 'general'
        };
    }

    /**
     * Basic keyword extraction (fallback when Gemini unavailable)
     */
    private extractBasicKeywords(text: string): string[] {
        const stopWords = new Set([
            'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
            'de', 'del', 'al', 'a', 'en', 'con', 'por', 'para',
            'que', 'qué', 'cual', 'cuál', 'como', 'cómo', 'donde', 'dónde',
            'es', 'son', 'está', 'están', 'ser', 'estar', 'tener', 'hacer',
            'y', 'o', 'pero', 'si', 'no', 'me', 'te', 'se', 'lo', 'le',
            'mi', 'tu', 'su', 'nos', 'les', 'esto', 'eso', 'aquello'
        ]);

        const words = text.toLowerCase()
            .replace(/[¿?¡!.,;:()]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 2 && !stopWords.has(word));

        // Get unique words
        return [...new Set(words)].slice(0, 10);
    }

    /**
     * Get pending reviews
     */
    getPendingReviews(): LearnedResponse[] {
        return this.data.responses.filter(r => r.status === 'pending_review');
    }

    /**
     * Get all learned responses
     */
    getAllResponses(limit: number = 100): LearnedResponse[] {
        return this.data.responses.slice(0, limit);
    }

    /**
     * Get learned response by ID
     */
    getResponse(id: string): LearnedResponse | null {
        return this.data.responses.find(r => r.id === id) || null;
    }

    /**
     * Approve a learned response
     */
    approveResponse(id: string, reviewedBy: string = 'admin'): LearnedResponse | null {
        const response = this.data.responses.find(r => r.id === id);

        if (!response) {
            return null;
        }

        response.status = 'approved';
        response.reviewedBy = reviewedBy;
        response.reviewedAt = new Date().toISOString();

        this.save();

        this.emit('learning:approved', response);

        console.log(`[LearningService] Approved response ${id}`);

        return response;
    }

    /**
     * Reject a learned response
     */
    rejectResponse(id: string, reason: string, reviewedBy: string = 'admin'): LearnedResponse | null {
        const response = this.data.responses.find(r => r.id === id);

        if (!response) {
            return null;
        }

        response.status = 'rejected';
        response.reviewedBy = reviewedBy;
        response.reviewedAt = new Date().toISOString();
        response.rejectionReason = reason;

        this.save();

        this.emit('learning:rejected', response);

        return response;
    }

    /**
     * Link to created FAQ
     */
    linkToFaq(id: string, faqId: string): void {
        const response = this.data.responses.find(r => r.id === id);
        if (response) {
            response.createdFaqId = faqId;
            this.save();
        }
    }

    /**
     * Update settings
     */
    updateSettings(settings: { autoApprove?: boolean; minConfidenceForAutoApprove?: number }): void {
        if (settings.autoApprove !== undefined) {
            this.data.autoApprove = settings.autoApprove;
        }
        if (settings.minConfidenceForAutoApprove !== undefined) {
            this.data.minConfidenceForAutoApprove = settings.minConfidenceForAutoApprove;
        }
        this.save();
    }

    /**
     * Get settings
     */
    getSettings(): { autoApprove: boolean; minConfidenceForAutoApprove: number } {
        return {
            autoApprove: this.data.autoApprove,
            minConfidenceForAutoApprove: this.data.minConfidenceForAutoApprove
        };
    }

    /**
     * Get statistics
     */
    getStats(): {
        total: number;
        pendingReview: number;
        approved: number;
        rejected: number;
        linkedToFaq: number;
    } {
        const responses = this.data.responses;
        return {
            total: responses.length,
            pendingReview: responses.filter(r => r.status === 'pending_review').length,
            approved: responses.filter(r => r.status === 'approved').length,
            rejected: responses.filter(r => r.status === 'rejected').length,
            linkedToFaq: responses.filter(r => r.createdFaqId).length
        };
    }

    /**
     * Delete old rejected responses (cleanup)
     */
    cleanupRejected(olderThanDays: number = 30): number {
        const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
        const before = this.data.responses.length;

        this.data.responses = this.data.responses.filter(
            r => r.status !== 'rejected' || new Date(r.createdAt) > cutoff
        );

        const removed = before - this.data.responses.length;
        if (removed > 0) {
            this.save();
        }

        return removed;
    }
}

export default LearningService;
