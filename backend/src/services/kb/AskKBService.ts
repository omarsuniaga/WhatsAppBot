/**
 * AskKBService - RAG-based Q&A service for Knowledge Base
 */

import { 
  KBQuery, 
  KBChunkMatch, 
  KBAudience, 
  KBChannel, 
  CreateKBQuery,
  AskKBRequest,
  AskKBResponse 
} from '../../domain/kb-types';
import { KBQueriesRepo } from '../../repos/KBQueriesRepo';
import { EmbeddingService } from './EmbeddingService';

// ============================================================
// CONSTANTS
// ============================================================

const DEFAULT_TOP_K = 5;
const CONFIDENCE_THRESHOLD = 0.7;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// ============================================================
// PROMPT TEMPLATES
// ============================================================

const SYSTEM_PROMPT = `Eres el asistente virtual institucional.
Tu rol es responder preguntas de la comunidad educativa (padres, alumnos, docentes) 
usando ÚNICAMENTE la información proporcionada en la EVIDENCIA.

REGLAS ESTRICTAS:
1. SOLO responde con base en la EVIDENCIA proporcionada
2. Si la información no está en la evidencia: di "No tengo esa información en mi base de conocimiento"
3. Sugiere a qué área contactar si no puedes responder
4. Usa tono institucional, cordial y directo
5. Incluye pasos accionables cuando aplique
6. Menciona horarios, canales oficiales y responsables cuando sea relevante
7. NO inventes información
8. NO uses palabras como "chunk", "embedding", "base de datos"
9. Responde en español`;

const DEVELOPER_PROMPT = `Formato de salida OBLIGATORIO (JSON válido):
{
  "answer": "Respuesta clara y concisa en español",
  "confidence": 0.0-1.0,
  "used_citations": ["chunk_id_1", "chunk_id_2"],
  "gap": false,
  "followups": ["Pregunta relacionada 1", "Pregunta relacionada 2"]
}

Si gap=true, la respuesta debe incluir:
- Reconocer que no hay información disponible
- Sugerir área de contacto
- Indicar qué documento podría faltar

IMPORTANTE: Devuelve SOLO el JSON, sin markdown ni texto adicional.`;

// ============================================================
// HELPERS
// ============================================================

function normalizeQuestion(question: string): string {
  return question
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function buildContext(chunks: Array<{
  id: string;
  docTitle: string;
  headingPath: string[];
  text: string;
}>): string {
  if (chunks.length === 0) {
    return 'No hay evidencia disponible para esta consulta.';
  }

  return chunks.map(c => `
[${c.id}] Documento: ${c.docTitle}
Sección: ${c.headingPath.length > 0 ? c.headingPath.join(' > ') : 'General'}
Contenido:
${c.text}
---`).join('\n');
}

function buildUserPrompt(question: string, audience: KBAudience, context: string): string {
  return `PREGUNTA: ${question}
AUDIENCIA: ${audience}

EVIDENCIA DISPONIBLE:
${context}

Responde en formato JSON siguiendo las reglas establecidas.`;
}

interface GeminiResponse {
  answer: string;
  confidence: number;
  used_citations: string[];
  gap: boolean;
  followups: string[];
}

function parseGeminiResponse(text: string): GeminiResponse {
  // Try to extract JSON from the response
  let jsonStr = text.trim();
  
  // Remove markdown code blocks if present
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3);
  }
  
  jsonStr = jsonStr.trim();
  
  try {
    const parsed = JSON.parse(jsonStr);
    return {
      answer: parsed.answer || 'No se pudo generar una respuesta.',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      used_citations: Array.isArray(parsed.used_citations) ? parsed.used_citations : [],
      gap: Boolean(parsed.gap),
      followups: Array.isArray(parsed.followups) ? parsed.followups : []
    };
  } catch (e) {
    // If JSON parsing fails, return the raw text as answer
    return {
      answer: text,
      confidence: 0.5,
      used_citations: [],
      gap: true,
      followups: []
    };
  }
}

// ============================================================
// GEMINI CLIENT
// ============================================================

async function callGemini(
  systemPrompt: string,
  developerPrompt: string,
  userPrompt: string,
  apiKey: string
): Promise<string> {
  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\n${developerPrompt}\n\n${userPrompt}` }]
        }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024
      }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${error}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!text) {
    throw new Error('No response from Gemini');
  }

  return text;
}

// ============================================================
// FALLBACK RESPONSE (when no API key)
// ============================================================

function generateFallbackResponse(
  question: string,
  chunks: Array<{ id: string; docTitle: string; headingPath: string[]; text: string }>,
  maxScore: number
): GeminiResponse {
  if (chunks.length === 0 || maxScore < CONFIDENCE_THRESHOLD) {
    return {
      answer: 'No tengo esa información en mi base de conocimiento. Te sugiero contactar directamente a la administración para obtener una respuesta precisa.',
      confidence: maxScore,
      used_citations: [],
      gap: true,
      followups: ['¿Cuál es el horario de atención?', '¿Cómo puedo contactar a la administración?']
    };
  }

  // Build a simple answer from the top chunk
  const topChunk = chunks[0];
  const sectionInfo = topChunk.headingPath.length > 0 
    ? ` (${topChunk.headingPath.join(' > ')})` 
    : '';

  return {
    answer: `Según la información disponible en "${topChunk.docTitle}"${sectionInfo}:\n\n${topChunk.text.substring(0, 500)}${topChunk.text.length > 500 ? '...' : ''}`,
    confidence: maxScore,
    used_citations: [topChunk.id],
    gap: false,
    followups: []
  };
}

// ============================================================
// ASK KB SERVICE
// ============================================================

export class AskKBService {
  private static instance: AskKBService;
  private embeddingService: EmbeddingService;
  private queriesRepo: KBQueriesRepo;
  private apiKey: string | null;

  private constructor() {
    this.embeddingService = EmbeddingService.getInstance();
    this.queriesRepo = KBQueriesRepo.getInstance();
    this.apiKey = process.env.GEMINI_API_KEY || null;
    
    if (!this.apiKey) {
      console.log('[AskKBService] No GEMINI_API_KEY - using fallback responses');
    }
  }

  static getInstance(): AskKBService {
    if (!AskKBService.instance) {
      AskKBService.instance = new AskKBService();
    }
    return AskKBService.instance;
  }

  /**
   * Main entry point for asking questions to the KB
   */
  async ask(request: AskKBRequest): Promise<AskKBResponse> {
    const startTime = Date.now();
    const { 
      question, 
      audience = 'publico', 
      channel = 'web', 
      topK = DEFAULT_TOP_K 
    } = request;

    // Normalize question
    const normalizedQuestion = normalizeQuestion(question);

    // Search for relevant chunks
    const matches = await this.embeddingService.search(question, {
      topK,
      audience,
      minScore: 0.2
    });

    // Get max score to determine if we have good evidence
    const maxScore = matches.length > 0 ? matches[0].score : 0;
    const hasGoodEvidence = maxScore >= CONFIDENCE_THRESHOLD;

    // Get chunk details for context
    const chunkIds = matches.map(m => m.chunkId);
    const chunkDetails = await this.embeddingService.getChunksForContext(chunkIds);

    // Generate response
    let geminiResponse: GeminiResponse;

    if (this.apiKey && chunkDetails.length > 0) {
      try {
        const context = buildContext(chunkDetails);
        const userPrompt = buildUserPrompt(question, audience, context);
        
        const rawResponse = await callGemini(
          SYSTEM_PROMPT,
          DEVELOPER_PROMPT,
          userPrompt,
          this.apiKey
        );
        
        geminiResponse = parseGeminiResponse(rawResponse);
        
        // Override gap if score is too low
        if (!hasGoodEvidence) {
          geminiResponse.gap = true;
          geminiResponse.confidence = Math.min(geminiResponse.confidence, maxScore);
        }
      } catch (error) {
        console.error('[AskKBService] Gemini error:', error);
        geminiResponse = generateFallbackResponse(question, chunkDetails, maxScore);
      }
    } else {
      geminiResponse = generateFallbackResponse(question, chunkDetails, maxScore);
    }

    // Calculate processing time
    const processingTimeMs = Date.now() - startTime;

    // Log the query
    const queryLog: CreateKBQuery = {
      question,
      normalizedQuestion,
      channel,
      audience,
      topChunks: matches,
      answer: geminiResponse.answer,
      confidence: geminiResponse.confidence,
      gap: geminiResponse.gap,
      usedCitations: geminiResponse.used_citations,
      suggestedActions: geminiResponse.followups,
      processingTimeMs
    };

    const savedQuery = await this.queriesRepo.create(queryLog);

    // Return response
    return {
      answer: geminiResponse.answer,
      confidence: geminiResponse.confidence,
      gap: geminiResponse.gap,
      citations: matches.filter(m => geminiResponse.used_citations.includes(m.chunkId)),
      suggestedActions: geminiResponse.followups,
      queryId: savedQuery.id
    };
  }

  /**
   * Get recent gaps (questions without good evidence)
   */
  async getGaps(limit: number = 20): Promise<KBQuery[]> {
    return this.queriesRepo.getGaps(limit);
  }

  /**
   * Get query statistics
   */
  async getStats() {
    return this.queriesRepo.getStats();
  }
}

export default AskKBService;
