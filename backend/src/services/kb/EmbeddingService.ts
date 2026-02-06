/**
 * EmbeddingService - Generate embeddings and perform vector search
 * 
 * Two modes:
 * - MVP: In-memory cosine similarity search (for small datasets)
 * - Production: External vector DB (Pinecone/Weaviate) - interface ready
 */

import { KBChunk, KBChunkMatch, KBAudience } from '../../domain/kb-types';
import { KBChunksRepo } from '../../repos/KBChunksRepo';
import { KBDocsRepo } from '../../repos/KBDocsRepo';

// ============================================================
// INTERFACES
// ============================================================

export interface EmbeddingProvider {
  generateEmbedding(text: string): Promise<number[]>;
  generateEmbeddings(texts: string[]): Promise<number[][]>;
  getDimensions(): number;
  getModelName(): string;
}

export interface VectorSearchResult {
  chunkId: string;
  score: number;
  chunk: KBChunk;
}

export interface SearchOptions {
  topK?: number;
  minScore?: number;
  audience?: KBAudience;
  tags?: string[];
}

// ============================================================
// MOCK EMBEDDING PROVIDER (Development)
// ============================================================

class MockEmbeddingProvider implements EmbeddingProvider {
  private dimensions = 768;
  private modelName = 'mock-embedding-v1';

  async generateEmbedding(text: string): Promise<number[]> {
    // Generate a deterministic pseudo-random embedding based on text
    const embedding: number[] = [];
    let hash = 0;
    
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash = hash & hash;
    }
    
    for (let i = 0; i < this.dimensions; i++) {
      // Use hash and index to generate pseudo-random values
      const seed = hash + i * 1000;
      const value = Math.sin(seed) * 0.5 + Math.cos(seed * 0.7) * 0.3;
      embedding.push(value);
    }
    
    // Normalize the vector
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    return embedding.map(v => v / norm);
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(t => this.generateEmbedding(t)));
  }

  getDimensions(): number {
    return this.dimensions;
  }

  getModelName(): string {
    return this.modelName;
  }
}

// ============================================================
// GEMINI EMBEDDING PROVIDER (Production)
// ============================================================

class GeminiEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string;
  private dimensions = 768;
  private modelName = 'text-embedding-004';
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const embeddings = await this.generateEmbeddings([text]);
    return embeddings[0];
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const url = `${this.baseUrl}/models/${this.modelName}:batchEmbedContents?key=${this.apiKey}`;
      
      const requests = texts.map(text => ({
        model: `models/${this.modelName}`,
        content: { parts: [{ text }] }
      }));

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini API error: ${error}`);
      }

      const data = await response.json();
      return data.embeddings.map((e: any) => e.values);
    } catch (error) {
      console.error('Error generating embeddings:', error);
      throw error;
    }
  }

  getDimensions(): number {
    return this.dimensions;
  }

  getModelName(): string {
    return this.modelName;
  }
}

// ============================================================
// VECTOR SEARCH (Cosine Similarity)
// ============================================================

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }
  
  let dot = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ============================================================
// EMBEDDING SERVICE
// ============================================================

export class EmbeddingService {
  private static instance: EmbeddingService;
  private provider: EmbeddingProvider;
  private chunksRepo: KBChunksRepo;
  private docsRepo: KBDocsRepo;

  private constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (apiKey) {
      this.provider = new GeminiEmbeddingProvider(apiKey);
      console.log('[EmbeddingService] Using Gemini embeddings');
    } else {
      this.provider = new MockEmbeddingProvider();
      console.log('[EmbeddingService] Using mock embeddings (no GEMINI_API_KEY)');
    }
    
    this.chunksRepo = KBChunksRepo.getInstance();
    this.docsRepo = KBDocsRepo.getInstance();
  }

  static getInstance(): EmbeddingService {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService();
    }
    return EmbeddingService.instance;
  }

  getProvider(): EmbeddingProvider {
    return this.provider;
  }

  /**
   * Generate and store embeddings for all chunks of a document
   */
  async indexDocument(docId: string): Promise<number> {
    const chunks = await this.chunksRepo.getByDocId(docId);
    
    if (chunks.length === 0) {
      return 0;
    }

    // Generate embeddings in batches
    const batchSize = 100;
    let indexed = 0;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const texts = batch.map(c => c.text);
      
      try {
        const embeddings = await this.provider.generateEmbeddings(texts);
        const updates = batch.map((chunk, idx) => ({
          id: chunk.id,
          embedding: embeddings[idx],
          model: this.provider.getModelName()
        }));
        
        await this.chunksRepo.updateManyEmbeddings(updates);
        indexed += batch.length;
      } catch (error) {
        console.error(`Error indexing batch ${i}:`, error);
      }
    }

    // Update document status
    await this.docsRepo.updateStatus(docId, 'active', chunks.length);
    
    return indexed;
  }

  /**
   * Search for similar chunks using vector similarity
   */
  async search(query: string, options: SearchOptions = {}): Promise<KBChunkMatch[]> {
    const { topK = 5, minScore = 0.3, audience, tags } = options;

    // Generate query embedding
    const queryEmbedding = await this.provider.generateEmbedding(query);

    // Get all chunks with embeddings
    let chunks = await this.chunksRepo.getWithEmbeddings();

    // Apply filters
    if (audience) {
      chunks = chunks.filter(c => c.audience.includes(audience));
    }
    if (tags && tags.length > 0) {
      chunks = chunks.filter(c => tags.some(t => c.tags.includes(t)));
    }

    // Calculate similarities
    const scored: { chunk: KBChunk; score: number }[] = [];
    
    for (const chunk of chunks) {
      if (!chunk.embedding) continue;
      
      const score = cosineSimilarity(queryEmbedding, chunk.embedding);
      if (score >= minScore) {
        scored.push({ chunk, score });
      }
    }

    // Sort by score and take topK
    scored.sort((a, b) => b.score - a.score);
    const topResults = scored.slice(0, topK);

    // Get document titles for citations
    const docIdSet = new Set<string>();
    topResults.forEach(r => docIdSet.add(r.chunk.docId));
    const docIds: string[] = [];
    docIdSet.forEach(id => docIds.push(id));
    const docs = await Promise.all(docIds.map(id => this.docsRepo.getById(id)));
    const docMap = new Map(docs.filter(Boolean).map(d => [d!.id, d!]));

    // Build result
    return topResults.map(r => ({
      chunkId: r.chunk.id,
      docId: r.chunk.docId,
      score: r.score,
      title: docMap.get(r.chunk.docId)?.title || 'Unknown',
      headingPath: r.chunk.headingPath
    }));
  }

  /**
   * Get chunk details for context building
   */
  async getChunksForContext(chunkIds: string[]): Promise<Array<{
    id: string;
    docTitle: string;
    headingPath: string[];
    text: string;
  }>> {
    const results: Array<{
      id: string;
      docTitle: string;
      headingPath: string[];
      text: string;
    }> = [];

    for (const id of chunkIds) {
      const chunk = await this.chunksRepo.getById(id);
      if (!chunk) continue;

      const doc = await this.docsRepo.getById(chunk.docId);
      results.push({
        id: chunk.id,
        docTitle: doc?.title || 'Unknown',
        headingPath: chunk.headingPath,
        text: chunk.text
      });
    }

    return results;
  }

  /**
   * Re-index all documents
   */
  async reindexAll(): Promise<{ success: number; failed: number }> {
    const docs = await this.docsRepo.list();
    let success = 0;
    let failed = 0;

    for (const doc of docs) {
      try {
        await this.indexDocument(doc.id);
        success++;
      } catch (error) {
        console.error(`Failed to reindex doc ${doc.id}:`, error);
        failed++;
      }
    }

    return { success, failed };
  }
}

export default EmbeddingService;
