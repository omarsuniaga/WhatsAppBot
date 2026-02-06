/**
 * Knowledge Base Service
 * Gestión de preguntas frecuentes y respuestas automáticas
 */

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { 
    FAQ, 
    FAQCategory, 
    KnowledgeBaseConfig, 
    SearchResult 
} from '../types/knowledge';

interface KnowledgeBaseData {
    version: number;
    config: KnowledgeBaseConfig;
    categories: FAQCategory[];
    faqs: FAQ[];
    lastUpdated: string;
}

const DEFAULT_CONFIG: KnowledgeBaseConfig = {
    minConfidenceToRespond: 0.85,
    minConfidenceToConfirm: 0.50,
    maxContextMessages: 10,
    enableSemanticSearch: true,
    enableAutoLearn: false,
    responseLanguage: 'es',
    businessName: 'Mi Empresa',
    businessDescription: 'Descripción de la empresa',
    toneStyle: 'professional'
};

export class KnowledgeBaseService {
    private static instance: KnowledgeBaseService;
    private dataPath: string;
    private data: KnowledgeBaseData;

    private constructor() {
        this.dataPath = path.join(process.cwd(), 'data', 'knowledge-base.json');
        console.log('[KnowledgeBaseService] Initializing. Data path:', this.dataPath);
        this.data = this.loadData();
        if (!this.data) {
            console.error('[KnowledgeBaseService] CRITICAL: loadData returned null/undefined!');
        } else {
            console.log('[KnowledgeBaseService] Data loaded. Categories:', this.data.categories?.length || 'undefined');
        }
    }

    public static getInstance(): KnowledgeBaseService {
        if (!KnowledgeBaseService.instance) {
            KnowledgeBaseService.instance = new KnowledgeBaseService();
        }
        return KnowledgeBaseService.instance;
    }

    private loadData(): KnowledgeBaseData {
        try {
            const dir = path.dirname(this.dataPath);
            if (!fs.existsSync(dir)) {
                console.log('[KnowledgeBaseService] Data directory does not exist, creating:', dir);
                fs.mkdirSync(dir, { recursive: true });
            }

            if (fs.existsSync(this.dataPath)) {
                console.log('[KnowledgeBaseService] Reading data file...');
                const rawData = fs.readFileSync(this.dataPath, 'utf-8');
                const parsed = JSON.parse(rawData);
                
                // Validate parsed data structure
                if (!parsed.categories || !Array.isArray(parsed.categories)) {
                    console.warn('[KnowledgeBaseService] Invalid categories in data file, using empty array');
                    parsed.categories = [];
                }
                if (!parsed.faqs || !Array.isArray(parsed.faqs)) {
                    console.warn('[KnowledgeBaseService] Invalid faqs in data file, using empty array');
                    parsed.faqs = [];
                }
                
                return parsed;
            } else {
                console.log('[KnowledgeBaseService] Data file does not exist, using defaults.');
            }
        } catch (error) {
            console.error('[KnowledgeBaseService] Error loading knowledge base:', error);
        }

        // Return default data
        console.log('[KnowledgeBaseService] Returning default data');
        return {
            version: 1,
            config: DEFAULT_CONFIG,
            categories: [
                {
                    id: 'general',
                    name: 'General',
                    description: 'Preguntas generales',
                    order: 1,
                    isActive: true
                },
                {
                    id: 'productos',
                    name: 'Productos y Servicios',
                    description: 'Información sobre productos y servicios',
                    order: 2,
                    isActive: true
                },
                {
                    id: 'pagos',
                    name: 'Pagos y Facturación',
                    description: 'Preguntas sobre pagos y facturación',
                    order: 3,
                    isActive: true
                },
                {
                    id: 'soporte',
                    name: 'Soporte Técnico',
                    description: 'Problemas técnicos y soporte',
                    order: 4,
                    isActive: true
                }
            ],
            faqs: [],
            lastUpdated: new Date().toISOString()
        };
    }

    private saveData(): void {
        try {
            this.data.lastUpdated = new Date().toISOString();
            fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error('Error saving knowledge base:', error);
        }
    }

    // ==========================================
    // Configuration
    // ==========================================

    public getConfig(): KnowledgeBaseConfig {
        return { ...this.data.config };
    }

    public updateConfig(config: Partial<KnowledgeBaseConfig>): KnowledgeBaseConfig {
        this.data.config = { ...this.data.config, ...config };
        this.saveData();
        return this.data.config;
    }

    // ==========================================
    // Categories
    // ==========================================

    public getCategories(): FAQCategory[] {
        return this.data.categories
            .filter(c => c.isActive)
            .sort((a, b) => a.order - b.order);
    }

    public getAllCategories(): FAQCategory[] {
        return [...this.data.categories].sort((a, b) => a.order - b.order);
    }

    public addCategory(category: Omit<FAQCategory, 'id'>): FAQCategory {
        const newCategory: FAQCategory = {
            ...category,
            id: uuidv4()
        };
        this.data.categories.push(newCategory);
        this.saveData();
        return newCategory;
    }

    public updateCategory(id: string, updates: Partial<FAQCategory>): FAQCategory | null {
        const index = this.data.categories.findIndex(c => c.id === id);
        if (index === -1) return null;

        this.data.categories[index] = { ...this.data.categories[index], ...updates };
        this.saveData();
        return this.data.categories[index];
    }

    public deleteCategory(id: string): boolean {
        const index = this.data.categories.findIndex(c => c.id === id);
        if (index === -1) return false;

        // Move FAQs to 'general' category
        this.data.faqs.forEach(faq => {
            if (faq.category === id) {
                faq.category = 'general';
            }
        });

        this.data.categories.splice(index, 1);
        this.saveData();
        return true;
    }

    // ==========================================
    // FAQs
    // ==========================================

    public getAllFaqs(): FAQ[] {
        return [...this.data.faqs];
    }

    public getApprovedFaqs(): FAQ[] {
        return this.data.faqs.filter(faq => faq.approved);
    }

    public getFaqsByCategory(categoryId: string): FAQ[] {
        return this.data.faqs.filter(faq => faq.category === categoryId && faq.approved);
    }

    public getFaqById(id: string): FAQ | null {
        return this.data.faqs.find(faq => faq.id === id) || null;
    }

    public addFaq(faq: {
        category: string;
        questions: string[];
        answer: string;
        keywords?: string[];
        createdBy?: 'admin' | 'ai_learned';
        approved?: boolean;
    }): FAQ {
        const newFaq: FAQ = {
            id: uuidv4(),
            category: faq.category,
            questions: faq.questions,
            answer: faq.answer,
            keywords: faq.keywords || this.extractKeywords(faq.questions.join(' ') + ' ' + faq.answer),
            confidence: 1.0,
            usageCount: 0,
            lastUsed: null,
            createdBy: faq.createdBy || 'admin',
            approved: faq.approved !== undefined ? faq.approved : true,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        this.data.faqs.push(newFaq);
        this.saveData();
        return newFaq;
    }

    public updateFaq(id: string, updates: Partial<FAQ>): FAQ | null {
        const index = this.data.faqs.findIndex(f => f.id === id);
        if (index === -1) return null;

        this.data.faqs[index] = { 
            ...this.data.faqs[index], 
            ...updates,
            updatedAt: new Date()
        };
        this.saveData();
        return this.data.faqs[index];
    }

    public deleteFaq(id: string): boolean {
        const index = this.data.faqs.findIndex(f => f.id === id);
        if (index === -1) return false;

        this.data.faqs.splice(index, 1);
        this.saveData();
        return true;
    }

    public approveFaq(id: string): FAQ | null {
        return this.updateFaq(id, { approved: true });
    }

    public rejectFaq(id: string): boolean {
        return this.deleteFaq(id);
    }

    // ==========================================
    // Search & Matching
    // ==========================================

    public searchFaqs(query: string, limit: number = 5): SearchResult[] {
        const normalizedQuery = this.normalizeText(query);
        const queryKeywords = this.extractKeywords(query);
        const results: SearchResult[] = [];

        for (const faq of this.getApprovedFaqs()) {
            let score = 0;
            let matchType: 'exact' | 'keyword' | 'semantic' = 'semantic';

            // Exact match in questions
            for (const question of faq.questions) {
                const normalizedQuestion = this.normalizeText(question);
                if (normalizedQuestion === normalizedQuery) {
                    score = 1.0;
                    matchType = 'exact';
                    break;
                }
                
                // Partial match
                const similarity = this.calculateSimilarity(normalizedQuery, normalizedQuestion);
                if (similarity > score) {
                    score = similarity;
                    matchType = similarity > 0.8 ? 'exact' : 'keyword';
                }
            }

            // Keyword matching
            if (score < 0.8) {
                const keywordScore = this.calculateKeywordScore(queryKeywords, faq.keywords);
                if (keywordScore > score) {
                    score = keywordScore;
                    matchType = 'keyword';
                }
            }

            if (score > 0.3) {
                results.push({ faq, score, matchType });
            }
        }

        // Sort by score descending
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, limit);
    }

    public findBestMatch(query: string): SearchResult | null {
        const results = this.searchFaqs(query, 1);
        return results.length > 0 ? results[0] : null;
    }

    public recordUsage(faqId: string): void {
        const faq = this.data.faqs.find(f => f.id === faqId);
        if (faq) {
            faq.usageCount++;
            faq.lastUsed = new Date();
            this.saveData();
        }
    }

    // ==========================================
    // Learning
    // ==========================================

    public learnFromResponse(
        originalQuestion: string,
        adminAnswer: string,
        category: string = 'general',
        autoApprove: boolean = false
    ): FAQ {
        // Check if similar question exists
        const existing = this.findBestMatch(originalQuestion);
        
        if (existing && existing.score > 0.85) {
            // Update existing FAQ
            const updated = this.updateFaq(existing.faq.id, {
                questions: [...new Set([...existing.faq.questions, originalQuestion])],
                answer: adminAnswer
            });
            return updated!;
        }

        // Create new FAQ
        return this.addFaq({
            category,
            questions: [originalQuestion],
            answer: adminAnswer,
            createdBy: 'ai_learned',
            approved: autoApprove
        });
    }

    public generateQuestionVariations(question: string): string[] {
        // Basic variations - in production, use AI to generate more
        const variations: string[] = [question];
        
        // Remove question marks and add variations
        const base = question.replace(/[¿?]/g, '').trim();
        variations.push(`¿${base}?`);
        variations.push(base);
        
        // Common reformulations
        if (base.toLowerCase().startsWith('cómo')) {
            variations.push(base.replace(/^cómo/i, 'de qué manera'));
        }
        if (base.toLowerCase().startsWith('qué')) {
            variations.push(base.replace(/^qué/i, 'cuál'));
        }
        if (base.toLowerCase().startsWith('cuánto')) {
            variations.push(base.replace(/^cuánto/i, 'cuál es el precio'));
        }

        return [...new Set(variations)];
    }

    // ==========================================
    // Import / Export
    // ==========================================

    public exportToJson(): string {
        return JSON.stringify({
            categories: this.data.categories,
            faqs: this.data.faqs,
            exportedAt: new Date().toISOString()
        }, null, 2);
    }

    public importFromJson(jsonData: string): { imported: number; errors: string[] } {
        const errors: string[] = [];
        let imported = 0;

        try {
            const data = JSON.parse(jsonData);
            
            // Import categories
            if (data.categories && Array.isArray(data.categories)) {
                for (const category of data.categories) {
                    try {
                        if (!this.data.categories.find(c => c.id === category.id)) {
                            this.data.categories.push(category);
                        }
                    } catch (e) {
                        errors.push(`Error importing category: ${category.name}`);
                    }
                }
            }

            // Import FAQs
            if (data.faqs && Array.isArray(data.faqs)) {
                for (const faq of data.faqs) {
                    try {
                        if (!this.data.faqs.find(f => f.id === faq.id)) {
                            this.data.faqs.push({
                                ...faq,
                                createdAt: new Date(faq.createdAt),
                                updatedAt: new Date(),
                                lastUsed: faq.lastUsed ? new Date(faq.lastUsed) : null
                            });
                            imported++;
                        }
                    } catch (e) {
                        errors.push(`Error importing FAQ: ${faq.questions?.[0]}`);
                    }
                }
            }

            this.saveData();
        } catch (e) {
            errors.push(`Invalid JSON format: ${e}`);
        }

        return { imported, errors };
    }

    // ==========================================
    // Utility Methods
    // ==========================================

    private normalizeText(text: string): string {
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove accents
            .replace(/[^\w\s]/g, '') // Remove punctuation
            .replace(/\s+/g, ' ')
            .trim();
    }

    private extractKeywords(text: string): string[] {
        const stopWords = new Set([
            'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
            'de', 'del', 'al', 'a', 'en', 'con', 'por', 'para',
            'es', 'son', 'está', 'están', 'ser', 'estar',
            'que', 'qué', 'como', 'cómo', 'cuando', 'cuándo',
            'donde', 'dónde', 'quien', 'quién', 'cual', 'cuál',
            'y', 'o', 'pero', 'si', 'no', 'mi', 'tu', 'su',
            'me', 'te', 'se', 'nos', 'les', 'lo', 'le',
            'hay', 'tiene', 'tienen', 'puede', 'pueden',
            'hola', 'gracias', 'por favor', 'buenos', 'dias'
        ]);

        const normalized = this.normalizeText(text);
        const words = normalized.split(' ');
        
        return words
            .filter(word => word.length > 2 && !stopWords.has(word))
            .slice(0, 10);
    }

    private calculateSimilarity(str1: string, str2: string): number {
        const words1 = new Set(str1.split(' '));
        const words2 = new Set(str2.split(' '));
        
        let intersection = 0;
        words1.forEach(word => {
            if (words2.has(word)) intersection++;
        });

        const union = words1.size + words2.size - intersection;
        return union > 0 ? intersection / union : 0;
    }

    private calculateKeywordScore(queryKeywords: string[], faqKeywords: string[]): number {
        if (queryKeywords.length === 0 || faqKeywords.length === 0) return 0;

        const faqKeywordSet = new Set(faqKeywords);
        let matches = 0;

        for (const keyword of queryKeywords) {
            if (faqKeywordSet.has(keyword)) {
                matches++;
            } else {
                // Partial match
                for (const faqKeyword of faqKeywords) {
                    if (faqKeyword.includes(keyword) || keyword.includes(faqKeyword)) {
                        matches += 0.5;
                        break;
                    }
                }
            }
        }

        return matches / queryKeywords.length;
    }

    // ==========================================
    // Stats
    // ==========================================

    public getStats(): {
        totalFaqs: number;
        approvedFaqs: number;
        pendingFaqs: number;
        totalCategories: number;
        mostUsedFaqs: FAQ[];
        recentlyAdded: FAQ[];
    } {
        try {
            if (!this.data) {
                console.error('KnowledgeBaseService: this.data is undefined, returning empty stats');
                 return {
                    totalFaqs: 0,
                    approvedFaqs: 0,
                    pendingFaqs: 0,
                    totalCategories: 0,
                    mostUsedFaqs: [],
                    recentlyAdded: []
                };
            }
            const faqs = this.data.faqs || [];
            
            return {
                totalFaqs: faqs.length,
                approvedFaqs: faqs.filter(f => f.approved).length,
                pendingFaqs: faqs.filter(f => !f.approved).length,
                totalCategories: (this.data.categories || []).length,
                mostUsedFaqs: [...faqs]
                    .sort((a, b) => b.usageCount - a.usageCount)
                    .slice(0, 5),
                recentlyAdded: [...faqs]
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .slice(0, 5)
            };
        } catch (error) {
            console.error('Error in KnowledgeBaseService.getStats:', error);
            throw error;
        }
    }
}

export default KnowledgeBaseService;
