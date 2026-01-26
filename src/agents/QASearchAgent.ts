import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export interface QAItem {
    id: string;
    keywords: string[];
    questions: string[];
    answer: string;
    priority: number;
}

export interface QACategory {
    id: string;
    name: string;
    icon: string;
    items: QAItem[];
}

export interface BusinessContext {
    name: string;
    description: string;
    tone: string;
}

export interface KnowledgeBase {
    version: number;
    updatedAt: string;
    business: BusinessContext;
    categories: QACategory[];
    fallback: {
        noMatch: string;
        useGemini: boolean;
        geminiPrompt: string;
    };
}

export interface QASearchResult {
    item: QAItem;
    category: QACategory;
    confidence: number;
    matchedKeywords: string[];
}

const KB_PATH = join(process.cwd(), 'data', 'knowledge-base.json');

export class QASearchAgent {
    private knowledgeBase: KnowledgeBase | null = null;

    constructor() {
        this.loadKnowledgeBase();
    }

    /**
     * Load or reload the knowledge base from file
     */
    loadKnowledgeBase(): void {
        try {
            if (existsSync(KB_PATH)) {
                const content = readFileSync(KB_PATH, 'utf-8');
                this.knowledgeBase = JSON.parse(content);
                console.log('[QASearchAgent] Knowledge base loaded');
            } else {
                console.warn('[QASearchAgent] Knowledge base file not found');
            }
        } catch (error) {
            console.error('[QASearchAgent] Error loading knowledge base:', error);
        }
    }

    /**
     * Get the business context for AI prompts
     */
    getBusinessContext(): BusinessContext | null {
        return this.knowledgeBase?.business || null;
    }

    /**
     * Get the fallback configuration
     */
    getFallbackConfig(): KnowledgeBase['fallback'] | null {
        return this.knowledgeBase?.fallback || null;
    }

    /**
     * Search for a matching Q&A item
     */
    search(query: string): QASearchResult | null {
        if (!this.knowledgeBase) return null;

        const normalizedQuery = this.normalizeText(query);
        let bestMatch: QASearchResult | null = null;
        let highestScore = 0;

        for (const category of this.knowledgeBase.categories) {
            for (const item of category.items) {
                const result = this.calculateMatch(normalizedQuery, item, category);

                if (result.confidence > highestScore) {
                    highestScore = result.confidence;
                    bestMatch = result;
                }
            }
        }

        return bestMatch;
    }

    /**
     * Get related Q&A items for context
     */
    getRelatedItems(query: string, limit: number = 3): QAItem[] {
        if (!this.knowledgeBase) return [];

        const normalizedQuery = this.normalizeText(query);
        const results: { item: QAItem; score: number }[] = [];

        for (const category of this.knowledgeBase.categories) {
            for (const item of category.items) {
                const match = this.calculateMatch(normalizedQuery, item, category);
                if (match.confidence > 0.3) {
                    results.push({ item, score: match.confidence });
                }
            }
        }

        // Sort by score and return top items
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map((r) => r.item);
    }

    /**
     * Calculate match score between query and Q&A item
     */
    private calculateMatch(
        normalizedQuery: string,
        item: QAItem,
        category: QACategory
    ): QASearchResult {
        let score = 0;
        const matchedKeywords: string[] = [];
        const queryWords = normalizedQuery.split(/\s+/);

        // Check keyword matches
        for (const keyword of item.keywords) {
            const normalizedKeyword = this.normalizeText(keyword);

            if (normalizedQuery.includes(normalizedKeyword)) {
                score += 0.3;
                matchedKeywords.push(keyword);
            }

            // Partial word match
            for (const word of queryWords) {
                if (word.length >= 3 && normalizedKeyword.includes(word)) {
                    score += 0.1;
                }
            }
        }

        // Check question similarity
        for (const question of item.questions) {
            const similarity = this.calculateSimilarity(
                normalizedQuery,
                this.normalizeText(question)
            );
            score = Math.max(score, similarity);
        }

        // Priority boost
        if (item.priority > 1) {
            score *= 1 + (item.priority - 1) * 0.1;
        }

        // Cap at 1.0
        score = Math.min(1, score);

        return {
            item,
            category,
            confidence: score,
            matchedKeywords
        };
    }

    /**
     * Calculate string similarity using Levenshtein distance
     */
    private calculateSimilarity(str1: string, str2: string): number {
        const len1 = str1.length;
        const len2 = str2.length;

        if (len1 === 0) return len2 === 0 ? 1 : 0;
        if (len2 === 0) return 0;

        // Simple word overlap similarity
        const words1 = new Set(str1.split(/\s+/));
        const words2 = new Set(str2.split(/\s+/));

        let intersection = 0;
        for (const word of words1) {
            if (words2.has(word)) {
                intersection++;
            }
        }

        const union = words1.size + words2.size - intersection;
        return union > 0 ? intersection / union : 0;
    }

    /**
     * Normalize text for comparison
     */
    private normalizeText(text: string): string {
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove accents
            .replace(/[^\w\s]/g, ' ') // Remove punctuation
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Process answer template with business context
     */
    processAnswer(answer: string): string {
        if (!this.knowledgeBase) return answer;

        const { business } = this.knowledgeBase;

        return answer
            .replace(/{business\.name}/g, business.name)
            .replace(/{business\.description}/g, business.description)
            .replace(/{business\.tone}/g, business.tone);
    }

    /**
     * Get all categories and items
     */
    getAll(): KnowledgeBase | null {
        return this.knowledgeBase;
    }

    /**
     * Get all categories
     */
    getCategories(): QACategory[] {
        return this.knowledgeBase?.categories || [];
    }

    // ==========================================
    // CRUD Operations
    // ==========================================

    /**
     * Add a new category
     */
    addCategory(category: Omit<QACategory, 'items'>): QACategory {
        if (!this.knowledgeBase) throw new Error('Knowledge base not loaded');

        const newCategory: QACategory = {
            ...category,
            items: []
        };

        this.knowledgeBase.categories.push(newCategory);
        this.save();

        return newCategory;
    }

    /**
     * Update a category
     */
    updateCategory(
        categoryId: string,
        updates: Partial<Omit<QACategory, 'items'>>
    ): QACategory | null {
        if (!this.knowledgeBase) return null;

        const category = this.knowledgeBase.categories.find((c) => c.id === categoryId);
        if (!category) return null;

        Object.assign(category, updates);
        this.save();

        return category;
    }

    /**
     * Delete a category
     */
    deleteCategory(categoryId: string): boolean {
        if (!this.knowledgeBase) return false;

        const index = this.knowledgeBase.categories.findIndex((c) => c.id === categoryId);
        if (index === -1) return false;

        this.knowledgeBase.categories.splice(index, 1);
        this.save();

        return true;
    }

    /**
     * Add a question to a category
     */
    addQuestion(categoryId: string, item: QAItem): QAItem | null {
        if (!this.knowledgeBase) return null;

        const category = this.knowledgeBase.categories.find((c) => c.id === categoryId);
        if (!category) return null;

        category.items.push(item);
        this.save();

        return item;
    }

    /**
     * Update a question
     */
    updateQuestion(itemId: string, updates: Partial<QAItem>): QAItem | null {
        if (!this.knowledgeBase) return null;

        for (const category of this.knowledgeBase.categories) {
            const item = category.items.find((i) => i.id === itemId);
            if (item) {
                Object.assign(item, updates);
                this.save();
                return item;
            }
        }

        return null;
    }

    /**
     * Delete a question
     */
    deleteQuestion(itemId: string): boolean {
        if (!this.knowledgeBase) return false;

        for (const category of this.knowledgeBase.categories) {
            const index = category.items.findIndex((i) => i.id === itemId);
            if (index !== -1) {
                category.items.splice(index, 1);
                this.save();
                return true;
            }
        }

        return false;
    }

    /**
     * Update business context
     */
    updateBusinessContext(updates: Partial<BusinessContext>): BusinessContext | null {
        if (!this.knowledgeBase) return null;

        Object.assign(this.knowledgeBase.business, updates);
        this.save();

        return this.knowledgeBase.business;
    }

    /**
     * Update fallback configuration
     */
    updateFallback(updates: Partial<KnowledgeBase['fallback']>): KnowledgeBase['fallback'] | null {
        if (!this.knowledgeBase) return null;

        Object.assign(this.knowledgeBase.fallback, updates);
        this.save();

        return this.knowledgeBase.fallback;
    }

    /**
     * Save knowledge base to file
     */
    private save(): void {
        if (!this.knowledgeBase) return;

        try {
            this.knowledgeBase.updatedAt = new Date().toISOString();
            writeFileSync(KB_PATH, JSON.stringify(this.knowledgeBase, null, 2));
            console.log('[QASearchAgent] Knowledge base saved');
        } catch (error) {
            console.error('[QASearchAgent] Error saving knowledge base:', error);
        }
    }
}
