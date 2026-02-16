/**
 * Learning Pipeline & Pending Alerts Tests
 *
 * Tests the complete learning cycle:
 * Alert (unanswered question) → Human response → Learn → Approve → Create FAQ
 *
 * Also tests pending alert management, grouping, and cleanup.
 *
 * Priority: CRITICAL — Ensures the bot learns and improves over time
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ============================================
// Extracted interfaces
// ============================================

interface LearnedResponse {
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

interface FAQ {
    id: string;
    category: string;
    questions: string[];
    answer: string;
    keywords: string[];
    createdBy: 'admin' | 'ai_learned';
    approved: boolean;
}

interface PendingAlert {
    id: string;
    chatJid: string;
    customerName: string;
    customerPhone: string;
    originalMessage: string;
    status: 'pending' | 'answered' | 'dismissed';
    priority: 'low' | 'medium' | 'high';
    shouldLearn: boolean;
    createdAt: string;
    expiresAt: string;
    userResponse?: string;
    respondedAt?: string;
    respondedBy?: string;
}

interface AutoStats {
    totalAutoApproved: number;
    totalFaqsCreated: number;
    totalDuplicatesSkipped: number;
    lastFaqsCreated: { faqId: string; learnedId: string; createdAt: string }[];
}

// ============================================
// Extracted learning logic for testing
// ============================================

class LearningPipelineValidator {
    private responses: LearnedResponse[] = [];
    private faqs: FAQ[] = [];
    private autoApprove: boolean = false;
    private autoStats: AutoStats = {
        totalAutoApproved: 0,
        totalFaqsCreated: 0,
        totalDuplicatesSkipped: 0,
        lastFaqsCreated: []
    };

    private events: { event: string; data: any }[] = [];

    setAutoApprove(enabled: boolean): void {
        this.autoApprove = enabled;
    }

    setExistingFaqs(faqs: FAQ[]): void {
        this.faqs = faqs;
    }

    /**
     * Extract basic keywords (fallback when Gemini unavailable)
     */
    extractBasicKeywords(text: string): string[] {
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

        return [...new Set(words)].slice(0, 10);
    }

    /**
     * Learn from a human response to an alert
     */
    learnFromResponse(
        alertId: string,
        originalQuestion: string,
        userResponse: string
    ): LearnedResponse {
        const keywords = this.extractBasicKeywords(originalQuestion + ' ' + userResponse);

        const learned: LearnedResponse = {
            id: `learn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            sourceAlertId: alertId,
            originalQuestion,
            userResponse,
            extractedQuestions: [originalQuestion],
            extractedKeywords: keywords,
            suggestedCategory: 'general',
            status: this.autoApprove ? 'approved' : 'pending_review',
            createdAt: new Date().toISOString()
        };

        this.responses.unshift(learned);
        this.events.push({ event: 'learning:new', data: learned });

        if (this.autoApprove) {
            this.autoStats.totalAutoApproved++;
            this.events.push({ event: 'learning:approved', data: learned });

            // Auto-create FAQ
            const faqId = this.createFaqFromLearned(learned);
            if (faqId) {
                learned.createdFaqId = faqId;
            }
        }

        return learned;
    }

    /**
     * Approve a pending response
     */
    approveResponse(id: string, reviewedBy: string = 'admin'): LearnedResponse | null {
        const response = this.responses.find(r => r.id === id);
        if (!response) return null;

        response.status = 'approved';
        response.reviewedBy = reviewedBy;
        response.reviewedAt = new Date().toISOString();

        this.events.push({ event: 'learning:approved', data: response });

        // Create FAQ from approved response
        const faqId = this.createFaqFromLearned(response);
        if (faqId) {
            response.createdFaqId = faqId;
        }

        return response;
    }

    /**
     * Reject a pending response
     */
    rejectResponse(id: string, reason: string, reviewedBy: string = 'admin'): LearnedResponse | null {
        const response = this.responses.find(r => r.id === id);
        if (!response) return null;

        response.status = 'rejected';
        response.reviewedBy = reviewedBy;
        response.reviewedAt = new Date().toISOString();
        response.rejectionReason = reason;

        this.events.push({ event: 'learning:rejected', data: response });
        return response;
    }

    /**
     * Create FAQ from learned response with duplicate detection
     */
    createFaqFromLearned(learned: LearnedResponse): string | null {
        // Duplicate detection
        const duplicate = this.findDuplicate(learned.originalQuestion);
        if (duplicate) {
            this.autoStats.totalDuplicatesSkipped++;
            this.events.push({
                event: 'learning:faq-duplicate-skipped',
                data: { learnedId: learned.id, duplicateFaqId: duplicate.id }
            });
            return null;
        }

        // Create FAQ
        const faq: FAQ = {
            id: `faq-learned-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            category: learned.suggestedCategory || 'general',
            questions: learned.extractedQuestions,
            answer: learned.userResponse,
            keywords: learned.extractedKeywords,
            createdBy: 'ai_learned',
            approved: true
        };

        this.faqs.push(faq);

        // Update stats
        this.autoStats.totalFaqsCreated++;
        this.autoStats.lastFaqsCreated.unshift({
            faqId: faq.id,
            learnedId: learned.id,
            createdAt: new Date().toISOString()
        });

        if (this.autoStats.lastFaqsCreated.length > 10) {
            this.autoStats.lastFaqsCreated.pop();
        }

        this.events.push({
            event: 'learning:faq-created',
            data: { learnedId: learned.id, faqId: faq.id }
        });

        return faq.id;
    }

    /**
     * Find duplicate FAQ by question similarity (Jaccard > 0.85)
     */
    findDuplicate(question: string): FAQ | null {
        const normalized = this.normalizeText(question);
        const words = new Set(normalized.split(/\s+/));

        for (const faq of this.faqs) {
            for (const q of faq.questions) {
                const faqWords = new Set(this.normalizeText(q).split(/\s+/));
                const intersection = new Set([...words].filter(x => faqWords.has(x)));
                const union = new Set([...words, ...faqWords]);

                const similarity = union.size > 0 ? intersection.size / union.size : 0;

                if (similarity > 0.85) {
                    return faq;
                }
            }
        }

        return null;
    }

    private normalizeText(text: string): string {
        return text.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[¿?¡!.,;:()]/g, '')
            .trim();
    }

    /**
     * Process all pending responses (batch approve)
     */
    processAllPending(): number {
        const pending = this.responses.filter(r => r.status === 'pending_review');
        let processed = 0;

        for (const response of pending) {
            this.approveResponse(response.id, 'system_auto_process');
            processed++;
        }

        return processed;
    }

    /**
     * Cleanup old rejected responses
     */
    cleanupRejected(olderThanDays: number = 30): number {
        const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
        const before = this.responses.length;

        this.responses = this.responses.filter(
            r => r.status !== 'rejected' || new Date(r.createdAt) > cutoff
        );

        return before - this.responses.length;
    }

    // Getters
    getPendingReviews(): LearnedResponse[] {
        return this.responses.filter(r => r.status === 'pending_review');
    }

    getAll(): LearnedResponse[] {
        return this.responses;
    }

    getStats() {
        return {
            total: this.responses.length,
            pendingReview: this.responses.filter(r => r.status === 'pending_review').length,
            approved: this.responses.filter(r => r.status === 'approved').length,
            rejected: this.responses.filter(r => r.status === 'rejected').length,
            linkedToFaq: this.responses.filter(r => r.createdFaqId).length
        };
    }

    getAutoStats(): AutoStats {
        return { ...this.autoStats };
    }

    getFaqs(): FAQ[] {
        return this.faqs;
    }

    getEvents(): { event: string; data: any }[] {
        return this.events;
    }
}

// ============================================
// Pending Alert Grouping Logic (for unanswered questions)
// ============================================

class PendingAlertValidator {
    private alerts: PendingAlert[] = [];

    setAlerts(alerts: PendingAlert[]): void {
        this.alerts = alerts;
    }

    /**
     * Group similar pending alerts by question similarity
     */
    getFrequentUnanswered(threshold: number = 0.7): {
        question: string;
        count: number;
        alertIds: string[];
    }[] {
        const pending = this.alerts.filter(a => a.status === 'pending');
        const groups: { question: string; count: number; alertIds: string[] }[] = [];

        for (const alert of pending) {
            const normalized = alert.originalMessage.toLowerCase().trim();

            // Try to find an existing group
            let matched = false;
            for (const group of groups) {
                const similarity = this.jaccardSimilarity(normalized, group.question.toLowerCase());
                if (similarity >= threshold) {
                    group.count++;
                    group.alertIds.push(alert.id);
                    matched = true;
                    break;
                }
            }

            if (!matched) {
                groups.push({
                    question: alert.originalMessage,
                    count: 1,
                    alertIds: [alert.id]
                });
            }
        }

        // Sort by frequency (most frequent first)
        return groups.sort((a, b) => b.count - a.count);
    }

    /**
     * Auto-expire old pending alerts
     */
    autoExpire(now: Date = new Date()): string[] {
        const expired: string[] = [];

        for (const alert of this.alerts) {
            if (alert.status === 'pending' && new Date(alert.expiresAt) < now) {
                alert.status = 'dismissed';
                alert.userResponse = 'Auto-dismissed: expired';
                expired.push(alert.id);
            }
        }

        return expired;
    }

    /**
     * Cleanup old resolved alerts (> 7 days)
     */
    cleanupOldAlerts(now: Date = new Date()): number {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const before = this.alerts.length;

        this.alerts = this.alerts.filter(a => {
            if (a.status === 'pending') return true;
            if (a.respondedAt && new Date(a.respondedAt) < sevenDaysAgo) return false;
            if (a.status === 'dismissed' && new Date(a.createdAt) < sevenDaysAgo) return false;
            return true;
        });

        return before - this.alerts.length;
    }

    /**
     * Export pending alerts as CSV data
     */
    exportAsCsv(statusFilter: 'pending' | 'all' = 'pending'): string {
        const filtered = statusFilter === 'all'
            ? this.alerts
            : this.alerts.filter(a => a.status === statusFilter);

        const headers = ['Fecha', 'Nombre', 'Teléfono', 'Pregunta', 'Prioridad', 'Estado'];
        const rows = filtered.map(a => [
            a.createdAt,
            a.customerName,
            a.customerPhone,
            `"${a.originalMessage.replace(/"/g, '""')}"`,
            a.priority,
            a.status
        ]);

        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }

    getActiveAlerts(): PendingAlert[] {
        return this.alerts.filter(a => a.status === 'pending');
    }

    private jaccardSimilarity(text1: string, text2: string): number {
        const set1 = new Set(text1.split(/\s+/));
        const set2 = new Set(text2.split(/\s+/));
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        return union.size > 0 ? intersection.size / union.size : 0;
    }
}

// ============================================
// Helpers
// ============================================

function createAlert(overrides: Partial<PendingAlert> = {}): PendingAlert {
    const now = new Date();
    return {
        id: `alert-${Math.random().toString(36).substr(2, 9)}`,
        chatJid: '5491234567890@s.whatsapp.net',
        customerName: 'Test User',
        customerPhone: '5491234567890',
        originalMessage: 'Test question',
        status: 'pending',
        priority: 'low',
        shouldLearn: true,
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 24 * 3600000).toISOString(),
        ...overrides
    };
}

// ============================================
// TESTS
// ============================================

describe('Learning Pipeline', () => {
    let pipeline: LearningPipelineValidator;

    beforeEach(() => {
        pipeline = new LearningPipelineValidator();
    });

    // ---- Keyword Extraction ----
    describe('Keyword Extraction (fallback)', () => {
        it('should extract meaningful keywords', () => {
            const keywords = pipeline.extractBasicKeywords('¿Cuánto cuesta la clase de piano?');
            expect(keywords.length).toBeGreaterThan(0);
            expect(keywords).toContain('cuesta');
            expect(keywords).toContain('clase');
            expect(keywords).toContain('piano');
        });

        it('should filter stop words', () => {
            const keywords = pipeline.extractBasicKeywords('el la los las de del al');
            expect(keywords).toHaveLength(0);
        });

        it('should filter short words (<=2 chars)', () => {
            const keywords = pipeline.extractBasicKeywords('yo tu el no');
            expect(keywords).toHaveLength(0);
        });

        it('should remove duplicates', () => {
            const keywords = pipeline.extractBasicKeywords('piano piano piano guitarra guitarra');
            expect(keywords).toHaveLength(2);
        });

        it('should limit to 10 keywords max', () => {
            const longText = 'alfa beta gamma delta epsilon zeta theta iota kappa lambda mu nu xi omicron';
            const keywords = pipeline.extractBasicKeywords(longText);
            expect(keywords.length).toBeLessThanOrEqual(10);
        });
    });

    // ---- Learning Flow (Manual Approve) ----
    describe('Manual Approval Flow (CRITICAL)', () => {
        it('should create a pending_review response', () => {
            const learned = pipeline.learnFromResponse('alert-1', '¿Cuánto cuesta el piano?', 'Cuesta $50 mensuales.');
            expect(learned.status).toBe('pending_review');
            expect(learned.sourceAlertId).toBe('alert-1');
            expect(learned.originalQuestion).toBe('¿Cuánto cuesta el piano?');
            expect(learned.userResponse).toBe('Cuesta $50 mensuales.');
        });

        it('should extract keywords from question + response', () => {
            const learned = pipeline.learnFromResponse('alert-1', '¿Cuánto cuesta el piano?', 'Cuesta $50 mensuales.');
            expect(learned.extractedKeywords.length).toBeGreaterThan(0);
        });

        it('should emit learning:new event', () => {
            pipeline.learnFromResponse('alert-1', 'Question?', 'Answer.');
            const events = pipeline.getEvents();
            expect(events.some(e => e.event === 'learning:new')).toBe(true);
        });

        it('should approve and create FAQ', () => {
            const learned = pipeline.learnFromResponse('alert-1', '¿Hay clases los sábados?', 'Sí, tenemos clases los sábados de 9am a 1pm.');

            const approved = pipeline.approveResponse(learned.id, 'admin_john');
            expect(approved).not.toBeNull();
            expect(approved!.status).toBe('approved');
            expect(approved!.reviewedBy).toBe('admin_john');
            expect(approved!.createdFaqId).toBeDefined();
        });

        it('should add FAQ to knowledge base when approved', () => {
            const learned = pipeline.learnFromResponse('alert-1', '¿Hay clases los sábados?', 'Sí, los sábados de 9am a 1pm.');
            pipeline.approveResponse(learned.id);

            const faqs = pipeline.getFaqs();
            expect(faqs).toHaveLength(1);
            expect(faqs[0].createdBy).toBe('ai_learned');
            expect(faqs[0].approved).toBe(true);
            expect(faqs[0].answer).toBe('Sí, los sábados de 9am a 1pm.');
        });

        it('should emit learning:faq-created event', () => {
            const learned = pipeline.learnFromResponse('alert-1', 'Question?', 'Answer.');
            pipeline.approveResponse(learned.id);

            const events = pipeline.getEvents();
            expect(events.some(e => e.event === 'learning:faq-created')).toBe(true);
        });

        it('should reject with reason', () => {
            const learned = pipeline.learnFromResponse('alert-1', 'Bad question', 'Bad answer');
            const rejected = pipeline.rejectResponse(learned.id, 'Low quality answer', 'admin_jane');

            expect(rejected).not.toBeNull();
            expect(rejected!.status).toBe('rejected');
            expect(rejected!.rejectionReason).toBe('Low quality answer');
            expect(rejected!.reviewedBy).toBe('admin_jane');
        });

        it('should NOT create FAQ for rejected responses', () => {
            const learned = pipeline.learnFromResponse('alert-1', 'Question?', 'Answer.');
            pipeline.rejectResponse(learned.id, 'Bad quality');

            const faqs = pipeline.getFaqs();
            expect(faqs).toHaveLength(0);
        });

        it('should return null for non-existent response', () => {
            expect(pipeline.approveResponse('non-existent')).toBeNull();
            expect(pipeline.rejectResponse('non-existent', 'reason')).toBeNull();
        });
    });

    // ---- Auto-Approve Flow ----
    describe('Auto-Approve Flow', () => {
        it('should auto-approve when enabled', () => {
            pipeline.setAutoApprove(true);
            const learned = pipeline.learnFromResponse('alert-1', '¿Dónde están ubicados?', 'Estamos en la Calle 5.');

            expect(learned.status).toBe('approved');
        });

        it('should auto-create FAQ when auto-approve is on', () => {
            pipeline.setAutoApprove(true);
            pipeline.learnFromResponse('alert-1', '¿Dónde están ubicados?', 'Estamos en la Calle 5.');

            const faqs = pipeline.getFaqs();
            expect(faqs).toHaveLength(1);
        });

        it('should track auto-approve stats', () => {
            pipeline.setAutoApprove(true);
            pipeline.learnFromResponse('alert-1', 'Q1?', 'A1.');
            pipeline.learnFromResponse('alert-2', 'Q2?', 'A2.');

            const stats = pipeline.getAutoStats();
            expect(stats.totalAutoApproved).toBe(2);
            expect(stats.totalFaqsCreated).toBe(2);
        });

        it('should emit both learning:new and learning:approved for auto-approve', () => {
            pipeline.setAutoApprove(true);
            pipeline.learnFromResponse('alert-1', 'Q?', 'A.');

            const events = pipeline.getEvents();
            expect(events.some(e => e.event === 'learning:new')).toBe(true);
            expect(events.some(e => e.event === 'learning:approved')).toBe(true);
        });
    });

    // ---- Duplicate Detection ----
    describe('Duplicate Detection (CRITICAL)', () => {
        it('should detect duplicate questions and skip FAQ creation', () => {
            pipeline.setExistingFaqs([{
                id: 'faq-existing',
                category: 'precios',
                questions: ['¿Cuánto cuesta la clase de piano?'],
                answer: 'Cuesta $50.',
                keywords: ['precio', 'piano'],
                createdBy: 'admin',
                approved: true
            }]);

            const learned = pipeline.learnFromResponse('alert-1', '¿Cuánto cuesta la clase de piano?', 'Cuesta $55 ahora.');
            pipeline.approveResponse(learned.id);

            // Should have skipped FAQ creation
            const stats = pipeline.getAutoStats();
            expect(stats.totalDuplicatesSkipped).toBe(1);
        });

        it('should emit faq-duplicate-skipped event', () => {
            pipeline.setExistingFaqs([{
                id: 'faq-existing',
                category: 'general',
                questions: ['¿Dónde están ubicados?'],
                answer: 'En la Calle 5.',
                keywords: ['ubicacion'],
                createdBy: 'admin',
                approved: true
            }]);

            const learned = pipeline.learnFromResponse('alert-1', '¿Dónde están ubicados?', 'Estamos en la Calle 5.');
            pipeline.approveResponse(learned.id);

            const events = pipeline.getEvents();
            expect(events.some(e => e.event === 'learning:faq-duplicate-skipped')).toBe(true);
        });

        it('should NOT flag very different questions as duplicates', () => {
            pipeline.setExistingFaqs([{
                id: 'faq-existing',
                category: 'precios',
                questions: ['¿Cuánto cuesta el piano?'],
                answer: 'Cuesta $50.',
                keywords: ['precio', 'piano'],
                createdBy: 'admin',
                approved: true
            }]);

            const learned = pipeline.learnFromResponse('alert-1', '¿Tienen clases los fines de semana?', 'Sí, sábados.');
            pipeline.approveResponse(learned.id);

            // Should have created a new FAQ (not a duplicate)
            const faqs = pipeline.getFaqs();
            expect(faqs.length).toBeGreaterThan(1);
        });
    });

    // ---- Batch Processing ----
    describe('Batch Processing (processAllPending)', () => {
        it('should approve all pending responses', () => {
            pipeline.learnFromResponse('a1', 'Q1?', 'A1.');
            pipeline.learnFromResponse('a2', 'Q2?', 'A2.');
            pipeline.learnFromResponse('a3', 'Q3?', 'A3.');

            expect(pipeline.getPendingReviews()).toHaveLength(3);

            const processed = pipeline.processAllPending();
            expect(processed).toBe(3);
            expect(pipeline.getPendingReviews()).toHaveLength(0);
        });

        it('should create FAQs for all processed responses', () => {
            pipeline.learnFromResponse('a1', 'Unique question one?', 'Answer one.');
            pipeline.learnFromResponse('a2', 'Totally different question two?', 'Answer two.');

            pipeline.processAllPending();

            const faqs = pipeline.getFaqs();
            expect(faqs.length).toBe(2);
        });
    });

    // ---- Cleanup ----
    describe('Cleanup Old Rejected', () => {
        it('should remove old rejected responses', () => {
            // Create a response and reject it
            const learned = pipeline.learnFromResponse('a1', 'Q?', 'A.');
            pipeline.rejectResponse(learned.id, 'bad quality');

            // Manually set old date
            const response = pipeline.getAll().find(r => r.id === learned.id);
            if (response) {
                response.createdAt = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(); // 60 days ago
            }

            const removed = pipeline.cleanupRejected(30);
            expect(removed).toBe(1);
        });

        it('should keep recent rejected responses', () => {
            const learned = pipeline.learnFromResponse('a1', 'Q?', 'A.');
            pipeline.rejectResponse(learned.id, 'bad quality');

            const removed = pipeline.cleanupRejected(30);
            expect(removed).toBe(0); // Just created, so it's recent
        });

        it('should not remove pending or approved responses', () => {
            pipeline.learnFromResponse('a1', 'Q1?', 'A1.'); // pending_review
            const approved = pipeline.learnFromResponse('a2', 'Q2?', 'A2.');
            pipeline.approveResponse(approved.id);

            const removed = pipeline.cleanupRejected(0); // Even with 0 days
            expect(removed).toBe(0);
        });
    });

    // ---- Statistics ----
    describe('Statistics', () => {
        it('should track all response states', () => {
            pipeline.learnFromResponse('a1', 'Q1?', 'A1.'); // pending
            pipeline.learnFromResponse('a2', 'Q2?', 'A2.'); // pending

            const l3 = pipeline.learnFromResponse('a3', 'Q3?', 'A3.');
            pipeline.approveResponse(l3.id); // approved

            const l4 = pipeline.learnFromResponse('a4', 'Q4?', 'A4.');
            pipeline.rejectResponse(l4.id, 'bad'); // rejected

            const stats = pipeline.getStats();
            expect(stats.total).toBe(4);
            expect(stats.pendingReview).toBe(2);
            expect(stats.approved).toBe(1);
            expect(stats.rejected).toBe(1);
            expect(stats.linkedToFaq).toBeGreaterThanOrEqual(1);
        });

        it('should keep only last 10 in lastFaqsCreated', () => {
            pipeline.setAutoApprove(true);

            for (let i = 0; i < 15; i++) {
                pipeline.learnFromResponse(`a${i}`, `Question ${i}?`, `Answer ${i}.`);
            }

            const stats = pipeline.getAutoStats();
            expect(stats.lastFaqsCreated.length).toBeLessThanOrEqual(10);
        });
    });
});

// ============================================
// PENDING ALERTS TESTS
// ============================================

describe('Pending Alerts / Unanswered Questions', () => {
    let alertValidator: PendingAlertValidator;

    beforeEach(() => {
        alertValidator = new PendingAlertValidator();
    });

    // ---- Frequent Unanswered Grouping ----
    describe('Frequent Unanswered Questions (CRITICAL)', () => {
        it('should group similar questions together', () => {
            alertValidator.setAlerts([
                createAlert({ id: 'a1', originalMessage: '¿Cuánto cuesta la clase de piano?' }),
                createAlert({ id: 'a2', originalMessage: '¿Cuánto cuesta la clase de piano?' }),
                createAlert({ id: 'a3', originalMessage: '¿Dónde están ubicados exactamente?' }),
                createAlert({ id: 'a4', originalMessage: '¿Cuánto cuesta la clase de piano?' })
            ]);

            const groups = alertValidator.getFrequentUnanswered();

            // Most frequent group first (piano price questions)
            expect(groups[0].count).toBeGreaterThanOrEqual(3);
            expect(groups[0].alertIds).toHaveLength(3);
            // Second group is the location question (unique)
            expect(groups).toHaveLength(2);
        });

        it('should NOT group very different questions', () => {
            alertValidator.setAlerts([
                createAlert({ id: 'a1', originalMessage: '¿Cuánto cuesta el piano?' }),
                createAlert({ id: 'a2', originalMessage: '¿Dónde están ubicados?' }),
                createAlert({ id: 'a3', originalMessage: '¿Tienen clases los sábados?' })
            ]);

            const groups = alertValidator.getFrequentUnanswered();
            expect(groups.length).toBe(3); // Each question is unique
        });

        it('should sort by frequency descending', () => {
            alertValidator.setAlerts([
                createAlert({ id: 'a1', originalMessage: 'Rare question' }),
                createAlert({ id: 'a2', originalMessage: 'Common question' }),
                createAlert({ id: 'a3', originalMessage: 'Common question' }),
                createAlert({ id: 'a4', originalMessage: 'Common question' })
            ]);

            const groups = alertValidator.getFrequentUnanswered();
            expect(groups[0].count).toBeGreaterThan(groups[groups.length - 1].count);
        });

        it('should only consider pending alerts', () => {
            alertValidator.setAlerts([
                createAlert({ id: 'a1', originalMessage: 'Question?', status: 'pending' }),
                createAlert({ id: 'a2', originalMessage: 'Question?', status: 'answered' }),
                createAlert({ id: 'a3', originalMessage: 'Question?', status: 'dismissed' })
            ]);

            const groups = alertValidator.getFrequentUnanswered();
            expect(groups[0]?.count || 0).toBe(1); // Only the pending one
        });
    });

    // ---- Auto-Expire ----
    describe('Auto-Expire Old Alerts', () => {
        it('should expire alerts past their expiration date', () => {
            const now = new Date();
            alertValidator.setAlerts([
                createAlert({
                    id: 'a-expired',
                    expiresAt: new Date(now.getTime() - 3600000).toISOString() // Expired 1h ago
                })
            ]);

            const expired = alertValidator.autoExpire(now);
            expect(expired).toContain('a-expired');
        });

        it('should NOT expire alerts that are not yet expired', () => {
            const now = new Date();
            alertValidator.setAlerts([
                createAlert({
                    id: 'a-valid',
                    expiresAt: new Date(now.getTime() + 3600000).toISOString() // Expires in 1h
                })
            ]);

            const expired = alertValidator.autoExpire(now);
            expect(expired).toHaveLength(0);
        });

        it('should mark expired alerts as dismissed', () => {
            const now = new Date();
            const alerts = [
                createAlert({
                    id: 'a-exp',
                    expiresAt: new Date(now.getTime() - 1000).toISOString()
                })
            ];
            alertValidator.setAlerts(alerts);

            alertValidator.autoExpire(now);
            expect(alerts[0].status).toBe('dismissed');
        });
    });

    // ---- Cleanup ----
    describe('Cleanup Old Resolved Alerts', () => {
        it('should remove resolved alerts older than 7 days', () => {
            const now = new Date();
            alertValidator.setAlerts([
                createAlert({
                    id: 'a-old',
                    status: 'answered',
                    respondedAt: new Date(now.getTime() - 10 * 24 * 3600000).toISOString() // 10 days ago
                }),
                createAlert({
                    id: 'a-recent',
                    status: 'answered',
                    respondedAt: new Date(now.getTime() - 2 * 24 * 3600000).toISOString() // 2 days ago
                })
            ]);

            const removed = alertValidator.cleanupOldAlerts(now);
            expect(removed).toBe(1);
        });

        it('should keep pending alerts regardless of age', () => {
            const now = new Date();
            alertValidator.setAlerts([
                createAlert({
                    id: 'a-old-pending',
                    status: 'pending',
                    createdAt: new Date(now.getTime() - 30 * 24 * 3600000).toISOString() // 30 days ago
                })
            ]);

            const removed = alertValidator.cleanupOldAlerts(now);
            expect(removed).toBe(0);
        });
    });

    // ---- CSV Export ----
    describe('CSV Export', () => {
        it('should export pending alerts as CSV', () => {
            alertValidator.setAlerts([
                createAlert({ id: 'a1', customerName: 'Juan', customerPhone: '5551234', originalMessage: 'Test question' }),
                createAlert({ id: 'a2', customerName: 'Maria', customerPhone: '5555678', originalMessage: 'Another question' })
            ]);

            const csv = alertValidator.exportAsCsv('pending');
            expect(csv).toContain('Fecha,Nombre,Teléfono,Pregunta,Prioridad,Estado');
            expect(csv).toContain('Juan');
            expect(csv).toContain('Maria');
        });

        it('should properly escape quotes in messages', () => {
            alertValidator.setAlerts([
                createAlert({ id: 'a1', originalMessage: 'He said "hello" to me' })
            ]);

            const csv = alertValidator.exportAsCsv('pending');
            expect(csv).toContain('""hello""');
        });

        it('should filter by status', () => {
            alertValidator.setAlerts([
                createAlert({ id: 'a1', status: 'pending', customerName: 'Pending User' }),
                createAlert({ id: 'a2', status: 'answered', customerName: 'Answered User' })
            ]);

            const pendingCsv = alertValidator.exportAsCsv('pending');
            expect(pendingCsv).toContain('Pending User');
            expect(pendingCsv).not.toContain('Answered User');

            const allCsv = alertValidator.exportAsCsv('all');
            expect(allCsv).toContain('Pending User');
            expect(allCsv).toContain('Answered User');
        });
    });
});
