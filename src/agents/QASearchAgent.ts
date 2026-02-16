import { existsSync, readFileSync } from 'fs';
import { writeFileSyncAtomic } from '../server/utils/atomicWrite';
import { join } from 'path';

export interface QAItem {
    id: string;
    keywords: string[];
    questions: string[];
    answer: string;
    priority: number;
    category?: string;
}

export interface QACategory {
    id: string;
    name: string;
    icon?: string;
    description?: string;
    order?: number;
    isActive?: boolean;
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
    private static sharedKnowledgeBase: KnowledgeBase | null = null;
    private knowledgeBase: KnowledgeBase | null = null;

    constructor() {
        if (QASearchAgent.sharedKnowledgeBase) {
            this.knowledgeBase = QASearchAgent.sharedKnowledgeBase;
            return;
        }
        this.loadKnowledgeBase();
    }

    /**
     * Load or reload the knowledge base from file.
     * Supports both formats:
     *   - Flat: { categories: [{id,name}], faqs: [{id,category,questions,answer,keywords}] }
     *   - Nested: { categories: [{id,name,items:[{id,keywords,questions,answer}]}] }
     * Also reads business context from either `business` or `config` fields.
     */
    loadKnowledgeBase(): void {
        try {
            if (!existsSync(KB_PATH)) {
                console.warn('[QASearchAgent] Knowledge base file not found');
                return;
            }

            const content = readFileSync(KB_PATH, 'utf-8');
            const raw = JSON.parse(content);

            this.knowledgeBase = this.normalizeKBData(raw);
            QASearchAgent.sharedKnowledgeBase = this.knowledgeBase;

            const totalItems = this.knowledgeBase.categories.reduce(
                (sum, cat) => sum + cat.items.length, 0
            );
            console.log(
                `[QASearchAgent] Knowledge base loaded: ${this.knowledgeBase.categories.length} categories, ${totalItems} Q&A items`
            );
        } catch (error) {
            console.error('[QASearchAgent] Error loading knowledge base:', error);
        }
    }

    /**
     * Normalize any on-disk KB format into the internal KnowledgeBase shape
     */
    private normalizeKBData(raw: any): KnowledgeBase {
        // --- Business context ---
        let business: BusinessContext;
        if (raw.business && raw.business.name) {
            business = raw.business;
        } else if (raw.config) {
            business = {
                name: raw.config.businessName || 'Mi Empresa',
                description: raw.config.businessDescription || '',
                tone: raw.config.toneStyle || 'professional',
            };
        } else {
            business = { name: 'Mi Empresa', description: '', tone: 'professional' };
        }

        // --- Fallback config ---
        const fallback = raw.fallback || {
            noMatch: 'Lo siento, no tengo informacion sobre eso. Un agente te ayudara en breve.',
            useGemini: true,
            geminiPrompt: '',
        };

        // --- Categories + Items ---
        const categories: QACategory[] = [];

        // Check if we have a flat faqs[] array (current JSON format)
        const hasFlatFaqs = Array.isArray(raw.faqs) && raw.faqs.length > 0;
        // Check if categories already have nested items[]
        const hasNestedItems = Array.isArray(raw.categories) &&
            raw.categories.some((c: any) => Array.isArray(c.items) && c.items.length > 0);

        if (hasFlatFaqs && !hasNestedItems) {
            // === FLAT FORMAT: group faqs into categories ===
            const catMap = new Map<string, QACategory>();

            // Build categories from the categories array
            if (Array.isArray(raw.categories)) {
                for (const cat of raw.categories) {
                    catMap.set(cat.id, {
                        id: cat.id,
                        name: cat.name,
                        icon: cat.icon || '',
                        description: cat.description,
                        order: cat.order,
                        isActive: cat.isActive !== false,
                        items: [],
                    });
                }
            }

            // Group FAQs into their categories
            for (const faq of raw.faqs) {
                // Only include approved FAQs (or FAQs without the approved field)
                if (faq.approved === false) continue;

                const catId = faq.category || 'general';

                if (!catMap.has(catId)) {
                    catMap.set(catId, {
                        id: catId,
                        name: catId.charAt(0).toUpperCase() + catId.slice(1),
                        icon: '',
                        items: [],
                    });
                }

                const cat = catMap.get(catId)!;
                cat.items.push({
                    id: faq.id,
                    keywords: faq.keywords || [],
                    questions: faq.questions || [],
                    answer: faq.answer || '',
                    priority: faq.priority || faq.confidence || 1,
                    category: catId,
                });
            }

            for (const cat of catMap.values()) {
                if (cat.isActive !== false) {
                    categories.push(cat);
                }
            }
        } else if (hasNestedItems) {
            // === NESTED FORMAT: categories already have items ===
            for (const cat of raw.categories) {
                if (cat.isActive === false) continue;
                categories.push({
                    id: cat.id,
                    name: cat.name,
                    icon: cat.icon || '',
                    description: cat.description,
                    order: cat.order,
                    isActive: cat.isActive,
                    items: (cat.items || []).map((item: any) => ({
                        id: item.id,
                        keywords: item.keywords || [],
                        questions: item.questions || [],
                        answer: item.answer || '',
                        priority: item.priority || 1,
                        category: cat.id,
                    })),
                });
            }
        } else {
            // Empty KB
            if (Array.isArray(raw.categories)) {
                for (const cat of raw.categories) {
                    categories.push({
                        id: cat.id,
                        name: cat.name,
                        icon: cat.icon || '',
                        description: cat.description,
                        items: [],
                    });
                }
            }
        }

        return {
            version: raw.version || 1,
            updatedAt: raw.updatedAt || raw.lastUpdated || new Date().toISOString(),
            business,
            categories,
            fallback,
        };
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
     * @param query - The search query
     * @param options - Optional search options
     * @param options.suggestedCategory - Category to boost in search results (from IntentClassifier)
     */
    search(query: string, options?: { suggestedCategory?: string }): QASearchResult | null {
        if (!this.knowledgeBase) return null;

        const normalizedQuery = this.normalizeText(query);
        const suggestedCategory = options?.suggestedCategory?.toLowerCase();
        let bestMatch: QASearchResult | null = null;
        let highestScore = 0;

        for (const category of this.knowledgeBase.categories) {
            for (const item of category.items) {
                const result = this.calculateMatch(normalizedQuery, item, category);

                // Apply category boost if suggestedCategory matches
                if (suggestedCategory) {
                    const categoryMatches =
                        category.id.toLowerCase().includes(suggestedCategory) ||
                        category.name.toLowerCase().includes(suggestedCategory) ||
                        suggestedCategory.includes(category.id.toLowerCase()) ||
                        suggestedCategory.includes(category.name.toLowerCase());

                    if (categoryMatches) {
                        // Boost score by 0.15 for matching category
                        result.confidence = Math.min(1, result.confidence + 0.15);
                    }
                }

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

        // Check keyword matches (capped at 0.8 to prevent keyword-only false positives)
        let keywordScore = 0;
        for (const keyword of item.keywords) {
            const normalizedKeyword = this.normalizeText(keyword);

            if (normalizedQuery.includes(normalizedKeyword)) {
                keywordScore += 0.3;
                matchedKeywords.push(keyword);
            }

            // Partial word match
            for (const word of queryWords) {
                if (word.length >= 3 && normalizedKeyword.includes(word)) {
                    keywordScore += 0.1;
                }
            }
        }
        // Cap keyword score to prevent items with many keywords from always hitting 1.0
        score = Math.min(0.8, keywordScore);

        // Check question similarity (can override keyword score if better)
        for (const question of item.questions) {
            const similarity = this.calculateSimilarity(
                normalizedQuery,
                this.normalizeText(question)
            );
            score = Math.max(score, similarity);
        }

        // Priority boost (applied after both keyword and similarity scoring)
        if (item.priority > 1) {
            score *= 1 + (item.priority - 1) * 0.1;
        }

        // Final cap at 1.0
        score = Math.min(1, score);

        return {
            item,
            category,
            confidence: score,
            matchedKeywords
        };
    }

    /**
     * Calculate string similarity (Jaccard index on word overlap)
     */
    private calculateSimilarity(str1: string, str2: string): number {
        const len1 = str1.length;
        const len2 = str2.length;

        if (len1 === 0) return len2 === 0 ? 1 : 0;
        if (len2 === 0) return 0;

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

        // Move items to 'general' category before deleting
        const deletedCat = this.knowledgeBase.categories[index];
        if (deletedCat.items.length > 0) {
            let generalCat = this.knowledgeBase.categories.find(c => c.id === 'general');
            if (!generalCat) {
                generalCat = { id: 'general', name: 'General', items: [] };
                this.knowledgeBase.categories.push(generalCat);
            }
            generalCat.items.push(...deletedCat.items);
        }

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

        item.category = categoryId;
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
     * Add a learned FAQ from user responses
     */
    addLearnedFaq(data: {
        questions: string[];
        answer: string;
        keywords: string[];
        category: string;
    }): QAItem {
        if (!this.knowledgeBase) {
            throw new Error('Knowledge base not loaded');
        }

        // Find or create category
        let category = this.knowledgeBase.categories.find(c => c.id === data.category);

        if (!category) {
            category = {
                id: data.category,
                name: data.category.charAt(0).toUpperCase() + data.category.slice(1),
                icon: 'brain',
                items: []
            };
            this.knowledgeBase.categories.push(category);
        }

        const faqItem: QAItem = {
            id: `faq-learned-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            keywords: data.keywords,
            questions: data.questions,
            answer: data.answer,
            priority: 1,
            category: data.category,
        };

        category.items.push(faqItem);
        this.save();

        console.log(`[QASearchAgent] Added learned FAQ: ${faqItem.id}`);

        return faqItem;
    }

    /**
     * Save knowledge base to file.
     * Writes in the flat format (faqs[] + categories[]) to stay compatible
     * with KnowledgeBaseService and the dashboard.
     */
    private save(): void {
        if (!this.knowledgeBase) return;

        try {
            // Read the current disk state first to preserve any changes made by
            // KnowledgeBaseService (e.g., FAQs added via the REST API).
            // We merge our in-memory items with disk items to prevent data loss.
            let diskExistingFaqs: any[] = [];
            let diskConfig: any = null;
            const existingFaqIds = new Set<string>();

            try {
                if (existsSync(KB_PATH)) {
                    const diskRaw = JSON.parse(readFileSync(KB_PATH, 'utf-8'));
                    if (Array.isArray(diskRaw.faqs)) {
                        diskExistingFaqs = diskRaw.faqs;
                    }
                    if (diskRaw.config) {
                        diskConfig = diskRaw.config;
                    }
                }
            } catch (_e) {
                // If we can't read disk, proceed with our data only
            }

            // Build our in-memory FAQs as flat format
            const flatFaqs: any[] = [];
            const flatCategories: any[] = [];
            const ourFaqIds = new Set<string>();

            for (const cat of this.knowledgeBase.categories) {
                flatCategories.push({
                    id: cat.id,
                    name: cat.name,
                    description: cat.description || '',
                    order: cat.order || 0,
                    isActive: cat.isActive !== false,
                });

                for (const item of cat.items) {
                    ourFaqIds.add(item.id);
                    flatFaqs.push({
                        id: item.id,
                        category: cat.id,
                        questions: item.questions,
                        answer: item.answer,
                        keywords: item.keywords,
                        confidence: item.priority || 1,
                        usageCount: 0,
                        approved: true,
                        createdBy: 'admin',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    });
                }
            }

            // Merge: add any disk FAQs that we don't have in memory
            // (i.e., FAQs created by KnowledgeBaseService after our last reload)
            for (const diskFaq of diskExistingFaqs) {
                if (!ourFaqIds.has(diskFaq.id)) {
                    flatFaqs.push(diskFaq);
                    // Also ensure its category exists
                    const catId = diskFaq.category || 'general';
                    if (!flatCategories.some((c: any) => c.id === catId)) {
                        flatCategories.push({
                            id: catId,
                            name: catId.charAt(0).toUpperCase() + catId.slice(1),
                            description: '',
                            order: 0,
                            isActive: true,
                        });
                    }
                }
            }

            // Preserve config values from disk that KnowledgeBaseService manages
            const mergedConfig = diskConfig || {};

            const diskData = {
                version: this.knowledgeBase.version,
                lastUpdated: new Date().toISOString(),
                config: {
                    ...mergedConfig,
                    businessName: this.knowledgeBase.business.name,
                    businessDescription: this.knowledgeBase.business.description,
                    toneStyle: this.knowledgeBase.business.tone,
                },
                categories: flatCategories,
                faqs: flatFaqs,
            };

            writeFileSyncAtomic(KB_PATH, JSON.stringify(diskData, null, 2));
            console.log('[QASearchAgent] Knowledge base saved (merged with disk)');
        } catch (error) {
            console.error('[QASearchAgent] Error saving knowledge base:', error);
        }
    }
}
