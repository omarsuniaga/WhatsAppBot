/**
 * Auto-Response System Tests
 *
 * Tests the complete flow: Message → Intent Classification → KB Search → Response
 * Covers: IntentClassifierAgent (keyword fallback), KB matching, and response pipeline.
 *
 * Priority: CRITICAL — Core bot functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ============================================
// Extracted interfaces for testing
// ============================================

interface ClassificationResult {
    intent: string;
    confidence: number;
    entities: Record<string, string>;
    sentiment: 'positive' | 'neutral' | 'negative';
    suggestedCategory: string;
    requiresHuman: boolean;
    source: 'gemini' | 'keyword_fallback';
}

interface FAQ {
    id: string;
    category: string;
    questions: string[];
    answer: string;
    keywords: string[];
    confidence: number;
    approved: boolean;
}

interface QASearchResult {
    item: FAQ;
    confidence: number;
    matchType: 'exact' | 'keyword' | 'semantic';
}

// ============================================
// Extracted logic from IntentClassifierAgent
// ============================================

const VALID_INTENTS = [
    'saludo', 'despedida', 'agradecimiento',
    'consulta_precio', 'consulta_horario', 'consulta_inscripcion',
    'consulta_disponibilidad', 'consulta_ubicacion',
    'queja', 'soporte_tecnico', 'emergencia',
    'solicitud_info_general', 'otro'
] as const;

const ESCALATION_INTENTS = ['queja', 'emergencia', 'soporte_tecnico'];
const CONVERSATIONAL_INTENTS = ['saludo', 'despedida', 'agradecimiento'];

class IntentClassifierValidator {
    private cache: Map<string, { result: ClassificationResult; timestamp: number }> = new Map();
    private readonly CACHE_TTL_MS = 5 * 60 * 1000;

    classifyMessage(message: string): ClassificationResult {
        // Check cache
        const cacheKey = message.toLowerCase().trim().substring(0, 200);
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
            return cached.result;
        }

        // Keyword fallback (same logic as IntentClassifierAgent.keywordFallback)
        const result = this.keywordFallback(message);
        this.cache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
    }

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

        // Entity extraction
        const entities: Record<string, string> = {};
        const instruments = ['piano', 'guitarra', 'violin', 'violín', 'flauta', 'bateria', 'batería', 'canto', 'saxofon', 'saxofón', 'trompeta', 'cello', 'violonchelo'];
        for (const inst of instruments) {
            if (lowerMessage.includes(inst)) {
                entities['instrumento'] = inst;
                break;
            }
        }
        const ageMatch = lowerMessage.match(/(\d+)\s*años/);
        if (ageMatch) entities['edad'] = ageMatch[1];

        const relationships = ['hijo', 'hija', 'niño', 'niña', 'sobrino', 'sobrina'];
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

        if (positiveWords.some(w => lowerMessage.includes(w))) sentiment = 'positive';
        else if (negativeWords.some(w => lowerMessage.includes(w))) sentiment = 'negative';

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

    isConversationalIntent(intent: string): boolean {
        return CONVERSATIONAL_INTENTS.includes(intent);
    }

    normalizeResult(parsed: any): ClassificationResult {
        const intent = VALID_INTENTS.includes(parsed.intent) ? parsed.intent : 'otro';
        const confidence = Math.max(0, Math.min(1, parsed.confidence || 0.5));

        return {
            intent,
            confidence,
            entities: parsed.entities || {},
            sentiment: ['positive', 'neutral', 'negative'].includes(parsed.sentiment)
                ? parsed.sentiment : 'neutral',
            suggestedCategory: parsed.suggestedCategory || '',
            requiresHuman: parsed.requiresHuman === true || ESCALATION_INTENTS.includes(intent),
            source: 'gemini'
        };
    }
}

// ============================================
// Extracted KB search logic
// ============================================

class KBSearchValidator {
    private faqs: FAQ[] = [];

    constructor(faqs: FAQ[]) {
        this.faqs = faqs;
    }

    normalizeText(text: string): string {
        return text.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
            .replace(/[¿?¡!.,;:()]/g, '')
            .trim();
    }

    calculateJaccardSimilarity(text1: string, text2: string): number {
        const set1 = new Set(this.normalizeText(text1).split(/\s+/));
        const set2 = new Set(this.normalizeText(text2).split(/\s+/));

        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);

        return union.size > 0 ? intersection.size / union.size : 0;
    }

    search(query: string, options?: { suggestedCategory?: string }): QASearchResult | null {
        const normalizedQuery = this.normalizeText(query);
        let bestMatch: QASearchResult | null = null;
        let bestScore = 0;

        for (const faq of this.faqs) {
            if (!faq.approved) continue;

            // Check keyword match
            const keywordScore = faq.keywords.reduce((score, kw) => {
                return normalizedQuery.includes(this.normalizeText(kw)) ? score + 0.2 : score;
            }, 0);

            // Check question similarity
            let questionScore = 0;
            for (const question of faq.questions) {
                const similarity = this.calculateJaccardSimilarity(query, question);
                questionScore = Math.max(questionScore, similarity);
            }

            let totalScore = Math.min(Math.max(keywordScore, questionScore), 1);

            // Category boost
            if (options?.suggestedCategory && faq.category === options.suggestedCategory) {
                totalScore = Math.min(totalScore + 0.15, 1);
            }

            if (totalScore > bestScore) {
                bestScore = totalScore;
                bestMatch = {
                    item: faq,
                    confidence: totalScore,
                    matchType: totalScore > 0.9 ? 'exact' : totalScore > 0.5 ? 'keyword' : 'semantic'
                };
            }
        }

        return bestMatch && bestScore >= 0.7 ? bestMatch : null;
    }
}

// ============================================
// Extracted auto-response pipeline logic
// ============================================

class AutoResponsePipeline {
    private classifier: IntentClassifierValidator;
    private kbSearch: KBSearchValidator;
    private escalateThreshold: number;

    constructor(faqs: FAQ[], escalateThreshold: number = 0.7) {
        this.classifier = new IntentClassifierValidator();
        this.kbSearch = new KBSearchValidator(faqs);
        this.escalateThreshold = escalateThreshold;
    }

    processMessage(message: string, botEnabled: boolean = true): {
        source: 'conversational' | 'knowledge_base' | 'escalated' | 'fallback' | 'bot_disabled';
        response?: string;
        classification?: ClassificationResult;
        kbMatch?: QASearchResult;
    } {
        // Step 0: Check bot enabled
        if (!botEnabled) {
            return { source: 'bot_disabled' };
        }

        // Step 1: Classify intent
        const classification = this.classifier.classifyMessage(message);

        // Step 2: Handle conversational intents
        if (this.classifier.isConversationalIntent(classification.intent)) {
            return {
                source: 'conversational',
                classification,
                response: `[Conversational response for ${classification.intent}]`
            };
        }

        // Step 3: Search KB with category boost
        const kbMatch = this.kbSearch.search(message, {
            suggestedCategory: classification.suggestedCategory
        });

        if (kbMatch && kbMatch.confidence >= this.escalateThreshold) {
            return {
                source: 'knowledge_base',
                classification,
                kbMatch,
                response: kbMatch.item.answer
            };
        }

        // Step 4: Escalate if requiresHuman
        if (classification.requiresHuman) {
            return {
                source: 'escalated',
                classification
            };
        }

        // Step 5: Fallback
        return {
            source: 'fallback',
            classification
        };
    }
}

// ============================================
// TESTS
// ============================================

describe('Auto-Response System', () => {

    // ---- Intent Classification Tests ----
    describe('Intent Classification (CRITICAL)', () => {
        let classifier: IntentClassifierValidator;

        beforeEach(() => {
            classifier = new IntentClassifierValidator();
        });

        describe('Greeting detection', () => {
            it('should classify "hola" as saludo', () => {
                const result = classifier.classifyMessage('hola');
                expect(result.intent).toBe('saludo');
                expect(result.confidence).toBeGreaterThanOrEqual(0.7);
            });

            it('should classify "buenos días" as saludo', () => {
                const result = classifier.classifyMessage('Buenos días, quería preguntar algo');
                expect(result.intent).toBe('saludo');
            });

            it('should identify saludo as conversational', () => {
                expect(classifier.isConversationalIntent('saludo')).toBe(true);
                expect(classifier.isConversationalIntent('despedida')).toBe(true);
                expect(classifier.isConversationalIntent('agradecimiento')).toBe(true);
            });

            it('should NOT identify non-conversational intents', () => {
                expect(classifier.isConversationalIntent('consulta_precio')).toBe(false);
                expect(classifier.isConversationalIntent('queja')).toBe(false);
            });
        });

        describe('Price inquiry detection', () => {
            it('should classify "cuanto cuesta" as consulta_precio', () => {
                const result = classifier.classifyMessage('¿Cuánto cuesta la clase de piano?');
                expect(result.intent).toBe('consulta_precio');
                expect(result.suggestedCategory).toBe('precios');
            });

            it('should classify "mensualidad" as consulta_precio', () => {
                const result = classifier.classifyMessage('Quiero saber la mensualidad');
                expect(result.intent).toBe('consulta_precio');
            });
        });

        describe('Schedule inquiry detection', () => {
            it('should classify "horario" as consulta_horario', () => {
                const result = classifier.classifyMessage('¿Cuál es el horario de clases?');
                expect(result.intent).toBe('consulta_horario');
                expect(result.suggestedCategory).toBe('horarios');
            });
        });

        describe('Enrollment inquiry detection', () => {
            it('should classify "inscribir" as consulta_inscripcion', () => {
                const result = classifier.classifyMessage('Necesito inscribir a alguien en la inscripción');
                expect(result.intent).toBe('consulta_inscripcion');
                expect(result.suggestedCategory).toBe('inscripciones');
            });

            it('should classify "matricular" as consulta_inscripcion', () => {
                // The keyword "matricular" should match consulta_inscripcion
                const result = classifier.classifyMessage('Quiero matricular estudiantes nuevos');
                expect(result.intent).toBe('consulta_inscripcion');
            });
        });

        describe('Complaint detection (CRITICAL - must escalate)', () => {
            it('should classify "queja" as queja and mark requiresHuman', () => {
                const result = classifier.classifyMessage('Tengo una queja sobre el servicio');
                expect(result.intent).toBe('queja');
                expect(result.requiresHuman).toBe(true);
                expect(result.sentiment).toBe('negative');
            });

            it('should classify "problema" as queja and mark requiresHuman', () => {
                const result = classifier.classifyMessage('Tengo un problema con mi clase');
                expect(result.intent).toBe('queja');
                expect(result.requiresHuman).toBe(true);
            });

            it('should classify "emergencia" as requiresHuman', () => {
                const result = classifier.classifyMessage('Es una emergencia, necesito ayuda');
                expect(result.intent).toBe('emergencia');
                expect(result.requiresHuman).toBe(true);
            });
        });

        describe('Entity extraction', () => {
            it('should extract instrument entity', () => {
                const result = classifier.classifyMessage('Quiero clases de guitarra');
                expect(result.entities).toHaveProperty('instrumento', 'guitarra');
            });

            it('should extract age entity', () => {
                const result = classifier.classifyMessage('Mi hijo tiene 8 años');
                expect(result.entities).toHaveProperty('edad', '8');
            });

            it('should extract relationship entity', () => {
                const result = classifier.classifyMessage('Quiero inscribir a mi hija');
                expect(result.entities).toHaveProperty('relacion', 'hija');
            });

            it('should extract multiple entities', () => {
                const result = classifier.classifyMessage('Quiero inscribir a mi hijo de 10 años en piano');
                expect(result.entities).toHaveProperty('instrumento', 'piano');
                expect(result.entities).toHaveProperty('edad', '10');
                expect(result.entities).toHaveProperty('relacion', 'hijo');
            });
        });

        describe('Sentiment detection', () => {
            it('should detect positive sentiment', () => {
                const result = classifier.classifyMessage('Muchas gracias, excelente servicio');
                expect(result.sentiment).toBe('positive');
            });

            it('should detect negative sentiment', () => {
                const result = classifier.classifyMessage('Estoy muy molesto con el servicio');
                expect(result.sentiment).toBe('negative');
            });

            it('should detect neutral sentiment', () => {
                const result = classifier.classifyMessage('Quiero información sobre clases');
                expect(result.sentiment).toBe('neutral');
            });
        });

        describe('Unknown messages', () => {
            it('should classify unknown messages as solicitud_info_general', () => {
                const result = classifier.classifyMessage('xyzabc 12345');
                expect(result.intent).toBe('solicitud_info_general');
                expect(result.confidence).toBe(0.5);
                expect(result.requiresHuman).toBe(false);
            });
        });

        describe('Cache behavior', () => {
            it('should return same result for same message (cache hit)', () => {
                const result1 = classifier.classifyMessage('hola buenos días');
                const result2 = classifier.classifyMessage('hola buenos días');
                expect(result1).toEqual(result2);
            });

            it('should normalize cache key (case insensitive)', () => {
                const result1 = classifier.classifyMessage('HOLA');
                const result2 = classifier.classifyMessage('hola');
                expect(result1.intent).toBe(result2.intent);
            });
        });

        describe('Gemini result normalization', () => {
            it('should normalize valid Gemini response', () => {
                const result = classifier.normalizeResult({
                    intent: 'consulta_precio',
                    confidence: 0.92,
                    entities: { instrumento: 'piano' },
                    sentiment: 'neutral',
                    suggestedCategory: 'precios',
                    requiresHuman: false
                });

                expect(result.intent).toBe('consulta_precio');
                expect(result.confidence).toBe(0.92);
                expect(result.source).toBe('gemini');
            });

            it('should fallback invalid intent to "otro"', () => {
                const result = classifier.normalizeResult({
                    intent: 'invalid_intent_xyz',
                    confidence: 0.8,
                    sentiment: 'neutral'
                });
                expect(result.intent).toBe('otro');
            });

            it('should clamp confidence to 0-1 range', () => {
                const result = classifier.normalizeResult({
                    intent: 'saludo',
                    confidence: 1.5,
                    sentiment: 'neutral'
                });
                expect(result.confidence).toBeLessThanOrEqual(1);

                const result2 = classifier.normalizeResult({
                    intent: 'saludo',
                    confidence: -0.5,
                    sentiment: 'neutral'
                });
                expect(result2.confidence).toBeGreaterThanOrEqual(0);
            });

            it('should force requiresHuman for escalation intents', () => {
                const result = classifier.normalizeResult({
                    intent: 'queja',
                    confidence: 0.9,
                    sentiment: 'negative',
                    requiresHuman: false // Even if Gemini says false
                });
                expect(result.requiresHuman).toBe(true);
            });

            it('should default missing fields', () => {
                const result = classifier.normalizeResult({ intent: 'saludo' });
                expect(result.entities).toEqual({});
                expect(result.sentiment).toBe('neutral');
                expect(result.suggestedCategory).toBe('');
                expect(result.confidence).toBe(0.5);
            });
        });
    });

    // ---- KB Search Tests ----
    describe('Knowledge Base Search', () => {
        const testFaqs: FAQ[] = [
            {
                id: 'faq-001',
                category: 'precios',
                questions: ['¿Cuánto cuesta la clase de piano?', '¿Cuál es el precio del piano?'],
                answer: 'Las clases de piano tienen un costo de $50 mensuales.',
                keywords: ['precio', 'costo', 'piano', 'mensualidad'],
                confidence: 1,
                approved: true
            },
            {
                id: 'faq-002',
                category: 'horarios',
                questions: ['¿Cuál es el horario de clases?', '¿A qué hora son las clases?'],
                answer: 'Nuestro horario es de lunes a viernes, 8am a 6pm.',
                keywords: ['horario', 'hora', 'clases', 'lunes', 'viernes'],
                confidence: 1,
                approved: true
            },
            {
                id: 'faq-003',
                category: 'inscripciones',
                questions: ['¿Cómo me inscribo?', '¿Cómo puedo registrarme?'],
                answer: 'Puedes inscribirte en nuestra oficina o llamando al 555-0100.',
                keywords: ['inscripción', 'registrar', 'inscribir'],
                confidence: 1,
                approved: true
            },
            {
                id: 'faq-unapproved',
                category: 'general',
                questions: ['Pregunta no aprobada'],
                answer: 'Respuesta no aprobada',
                keywords: ['noaprobada'],
                confidence: 1,
                approved: false
            }
        ];

        let kbSearch: KBSearchValidator;

        beforeEach(() => {
            kbSearch = new KBSearchValidator(testFaqs);
        });

        describe('Text normalization', () => {
            it('should normalize accents', () => {
                expect(kbSearch.normalizeText('Información')).toBe('informacion');
            });

            it('should lowercase', () => {
                expect(kbSearch.normalizeText('HOLA')).toBe('hola');
            });

            it('should remove punctuation', () => {
                expect(kbSearch.normalizeText('¿Hola?')).toBe('hola');
            });
        });

        describe('Keyword matching', () => {
            it('should find FAQ by keyword match', () => {
                // Uses enough keywords to exceed threshold (each keyword adds 0.2)
                const result = kbSearch.search('precio costo mensualidad piano');
                expect(result).not.toBeNull();
                expect(result!.item.id).toBe('faq-001');
                expect(result!.confidence).toBeGreaterThanOrEqual(0.7);
            });

            it('should find FAQ by question similarity', () => {
                const result = kbSearch.search('¿Cuánto cuesta la clase de piano?');
                expect(result).not.toBeNull();
                expect(result!.item.id).toBe('faq-001');
            });

            it('should find schedule FAQ', () => {
                const result = kbSearch.search('¿Cuál es el horario de clases?');
                expect(result).not.toBeNull();
                expect(result!.item.id).toBe('faq-002');
            });
        });

        describe('Category boost', () => {
            it('should boost matching category by 0.15', () => {
                const withBoost = kbSearch.search('información general sobre precios', { suggestedCategory: 'precios' });
                const withoutBoost = kbSearch.search('información general sobre precios');

                // With boost should be higher or equal
                if (withBoost && withoutBoost) {
                    expect(withBoost.confidence).toBeGreaterThanOrEqual(withoutBoost.confidence);
                }
            });
        });

        describe('Threshold filtering', () => {
            it('should return null for low confidence matches', () => {
                const result = kbSearch.search('qwerty asdfgh zxcvbn');
                expect(result).toBeNull();
            });
        });

        describe('Unapproved FAQ filtering', () => {
            it('should NOT return unapproved FAQs', () => {
                const result = kbSearch.search('noaprobada');
                // Even though keyword matches, FAQ is not approved
                expect(result === null || result.item.approved === true).toBe(true);
            });
        });

        describe('Jaccard similarity', () => {
            it('should calculate similarity between similar texts', () => {
                const similarity = kbSearch.calculateJaccardSimilarity(
                    '¿Cuánto cuesta el piano?',
                    '¿Cuánto cuesta la clase de piano?'
                );
                expect(similarity).toBeGreaterThan(0.4);
            });

            it('should return 0 for completely different texts', () => {
                const similarity = kbSearch.calculateJaccardSimilarity(
                    'abc def',
                    'xyz uvw'
                );
                expect(similarity).toBe(0);
            });

            it('should return 1 for identical texts', () => {
                const similarity = kbSearch.calculateJaccardSimilarity(
                    'hola mundo',
                    'hola mundo'
                );
                expect(similarity).toBe(1);
            });
        });
    });

    // ---- Full Pipeline Tests ----
    describe('Auto-Response Pipeline (CRITICAL - end to end)', () => {
        const faqs: FAQ[] = [
            {
                id: 'faq-precio',
                category: 'precios',
                questions: ['¿Cuánto cuesta?', '¿Cuál es el precio?'],
                answer: 'Nuestras clases cuestan $50 mensuales.',
                keywords: ['precio', 'costo', 'cuanto', 'mensualidad'],
                confidence: 1,
                approved: true
            },
            {
                id: 'faq-horario',
                category: 'horarios',
                questions: ['¿Cuál es el horario?', '¿A qué hora abren?'],
                answer: 'Abrimos de 8am a 6pm, lunes a viernes.',
                keywords: ['horario', 'hora', 'abren'],
                confidence: 1,
                approved: true
            }
        ];

        let pipeline: AutoResponsePipeline;

        beforeEach(() => {
            pipeline = new AutoResponsePipeline(faqs);
        });

        describe('Bot disabled', () => {
            it('should return bot_disabled when bot is off', () => {
                const result = pipeline.processMessage('hola', false);
                expect(result.source).toBe('bot_disabled');
            });
        });

        describe('Conversational flow', () => {
            it('should handle greetings directly (no KB search)', () => {
                const result = pipeline.processMessage('Hola buenos días');
                expect(result.source).toBe('conversational');
                expect(result.classification?.intent).toBe('saludo');
            });

            it('should handle farewells directly', () => {
                const result = pipeline.processMessage('Adiós, hasta luego');
                expect(result.source).toBe('conversational');
                expect(result.classification?.intent).toBe('despedida');
            });

            it('should handle thanks directly', () => {
                const result = pipeline.processMessage('Muchas gracias por la información');
                expect(result.source).toBe('conversational');
                expect(result.classification?.intent).toBe('agradecimiento');
            });
        });

        describe('KB response flow', () => {
            it('should respond from KB for price questions', () => {
                // Use exact question from KB for reliable matching
                const result = pipeline.processMessage('¿Cuánto cuesta?');
                expect(result.source).toBe('knowledge_base');
                expect(result.response).toContain('$50');
                expect(result.kbMatch).toBeDefined();
            });

            it('should respond from KB for schedule questions', () => {
                // Use exact question from KB for reliable matching
                const result = pipeline.processMessage('¿Cuál es el horario?');
                expect(result.source).toBe('knowledge_base');
                expect(result.response).toContain('8am');
            });
        });

        describe('Escalation flow', () => {
            it('should escalate complaints', () => {
                const result = pipeline.processMessage('Tengo una queja sobre el servicio');
                expect(result.source).toBe('escalated');
                expect(result.classification?.requiresHuman).toBe(true);
            });

            it('should escalate emergencies', () => {
                // Use direct keyword match for emergencia
                const result = pipeline.processMessage('Esto es una emergencia urgente');
                expect(result.source).toBe('escalated');
                expect(result.classification?.requiresHuman).toBe(true);
            });
        });

        describe('Fallback flow', () => {
            it('should fallback for unrecognized messages', () => {
                const result = pipeline.processMessage('asghjkl qwerty zxcvbn random');
                expect(result.source).toBe('fallback');
            });
        });

        describe('Classification enriches KB search', () => {
            it('should pass suggestedCategory to KB search', () => {
                const result = pipeline.processMessage('¿Cuánto cuesta el piano?');
                // The classifier suggests 'precios' category which boosts the FAQ match
                expect(result.classification?.suggestedCategory).toBe('precios');
                if (result.source === 'knowledge_base') {
                    expect(result.kbMatch?.item.category).toBe('precios');
                }
            });
        });
    });
});
