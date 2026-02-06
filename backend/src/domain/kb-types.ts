/**
 * Knowledge Base Domain Types
 */

// ============================================================
// ENUMS
// ============================================================

export type KBAudience = 'padre' | 'alumno' | 'docente' | 'admin' | 'publico';
export type KBChannel = 'web' | 'whatsapp' | 'internal';
export type KBDocStatus = 'draft' | 'active' | 'deprecated' | 'indexing' | 'error';

// ============================================================
// DOCUMENTS
// ============================================================

export interface KBDoc {
  id: string;
  filename: string;
  title: string;
  rawMd: string;
  checksum: string;
  audience: KBAudience[];
  tags: string[];
  version: string;
  source: string;
  status: KBDocStatus;
  chunksCount: number;
  indexedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateKBDoc {
  filename: string;
  title: string;
  rawMd: string;
  checksum: string;
  audience: KBAudience[];
  tags: string[];
  version: string;
  source: string;
  status?: KBDocStatus;
}

// ============================================================
// CHUNKS
// ============================================================

export interface KBChunk {
  id: string;
  docId: string;
  chunkIndex: number;
  headingPath: string[];
  text: string;
  tokenCount: number;
  audience: KBAudience[];
  tags: string[];
  embedding: number[] | null;
  embeddingModel: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateKBChunk {
  docId: string;
  chunkIndex: number;
  headingPath: string[];
  text: string;
  tokenCount: number;
  audience: KBAudience[];
  tags: string[];
}

// ============================================================
// QUERIES (LOG)
// ============================================================

export interface KBChunkMatch {
  chunkId: string;
  docId: string;
  score: number;
  title: string;
  headingPath: string[];
}

export interface KBQuery {
  id: string;
  question: string;
  normalizedQuestion: string;
  channel: KBChannel;
  audience: KBAudience;
  topChunks: KBChunkMatch[];
  answer: string;
  confidence: number;
  gap: boolean;
  usedCitations: string[];
  suggestedActions: string[];
  processingTimeMs: number;
  createdAt: string;
}

export interface CreateKBQuery {
  question: string;
  normalizedQuestion: string;
  channel: KBChannel;
  audience: KBAudience;
  topChunks: KBChunkMatch[];
  answer: string;
  confidence: number;
  gap: boolean;
  usedCitations: string[];
  suggestedActions: string[];
  processingTimeMs: number;
}

// ============================================================
// API REQUEST/RESPONSE TYPES
// ============================================================

export interface ImportKBDocRequest {
  filename: string;
  rawMd: string;
}

export interface ImportKBDocResponse {
  docId: string;
  title: string;
  chunksCount: number;
  status: KBDocStatus;
}

export interface AskKBRequest {
  question: string;
  audience?: KBAudience;
  channel?: KBChannel;
  topK?: number;
}

export interface AskKBResponse {
  answer: string;
  confidence: number;
  gap: boolean;
  citations: KBChunkMatch[];
  suggestedActions: string[];
  queryId: string;
}

export interface KBStats {
  totalDocs: number;
  totalChunks: number;
  totalQueries: number;
  gapQueries: number;
  avgConfidence: number;
  docsByStatus: Record<KBDocStatus, number>;
  queriesByChannel: Record<KBChannel, number>;
}
