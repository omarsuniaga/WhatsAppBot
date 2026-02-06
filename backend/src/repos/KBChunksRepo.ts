/**
 * KBChunksRepo - Repository for Knowledge Base Chunks
 */

import * as fs from 'fs';
import * as path from 'path';
import { KBChunk, CreateKBChunk, KBAudience } from '../domain/kb-types';

const DATA_DIR = path.join(process.cwd(), 'backend', 'data');
const FILE_PATH = path.join(DATA_DIR, 'kb_chunks.json');

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `kb_chunk_${timestamp}${random}`;
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadData(): KBChunk[] {
  ensureDataDir();
  if (!fs.existsSync(FILE_PATH)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(FILE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveData(chunks: KBChunk[]): void {
  ensureDataDir();
  fs.writeFileSync(FILE_PATH, JSON.stringify(chunks, null, 2));
}

export class KBChunksRepo {
  private static instance: KBChunksRepo;

  private constructor() {}

  static getInstance(): KBChunksRepo {
    if (!KBChunksRepo.instance) {
      KBChunksRepo.instance = new KBChunksRepo();
    }
    return KBChunksRepo.instance;
  }

  async list(): Promise<KBChunk[]> {
    return loadData();
  }

  async getById(id: string): Promise<KBChunk | null> {
    const chunks = loadData();
    return chunks.find(c => c.id === id) || null;
  }

  async getByDocId(docId: string): Promise<KBChunk[]> {
    const chunks = loadData();
    return chunks.filter(c => c.docId === docId).sort((a, b) => a.chunkIndex - b.chunkIndex);
  }

  async create(data: CreateKBChunk): Promise<KBChunk> {
    const chunks = loadData();
    const now = new Date().toISOString();

    const newChunk: KBChunk = {
      id: generateId(),
      docId: data.docId,
      chunkIndex: data.chunkIndex,
      headingPath: data.headingPath,
      text: data.text,
      tokenCount: data.tokenCount,
      audience: data.audience,
      tags: data.tags,
      embedding: null,
      embeddingModel: null,
      createdAt: now,
      updatedAt: now
    };

    chunks.push(newChunk);
    saveData(chunks);
    return newChunk;
  }

  async createMany(dataArray: CreateKBChunk[]): Promise<KBChunk[]> {
    const chunks = loadData();
    const now = new Date().toISOString();
    const newChunks: KBChunk[] = [];

    for (const data of dataArray) {
      const newChunk: KBChunk = {
        id: generateId(),
        docId: data.docId,
        chunkIndex: data.chunkIndex,
        headingPath: data.headingPath,
        text: data.text,
        tokenCount: data.tokenCount,
        audience: data.audience,
        tags: data.tags,
        embedding: null,
        embeddingModel: null,
        createdAt: now,
        updatedAt: now
      };
      newChunks.push(newChunk);
      chunks.push(newChunk);
    }

    saveData(chunks);
    return newChunks;
  }

  async updateEmbedding(id: string, embedding: number[], model: string): Promise<KBChunk | null> {
    const chunks = loadData();
    const index = chunks.findIndex(c => c.id === id);
    
    if (index === -1) return null;

    chunks[index].embedding = embedding;
    chunks[index].embeddingModel = model;
    chunks[index].updatedAt = new Date().toISOString();

    saveData(chunks);
    return chunks[index];
  }

  async updateManyEmbeddings(updates: { id: string; embedding: number[]; model: string }[]): Promise<number> {
    const chunks = loadData();
    let updated = 0;
    const now = new Date().toISOString();

    for (const update of updates) {
      const index = chunks.findIndex(c => c.id === update.id);
      if (index !== -1) {
        chunks[index].embedding = update.embedding;
        chunks[index].embeddingModel = update.model;
        chunks[index].updatedAt = now;
        updated++;
      }
    }

    saveData(chunks);
    return updated;
  }

  async removeByDocId(docId: string): Promise<number> {
    const chunks = loadData();
    const before = chunks.length;
    const filtered = chunks.filter(c => c.docId !== docId);
    saveData(filtered);
    return before - filtered.length;
  }

  async remove(id: string): Promise<boolean> {
    const chunks = loadData();
    const index = chunks.findIndex(c => c.id === id);
    
    if (index === -1) return false;

    chunks.splice(index, 1);
    saveData(chunks);
    return true;
  }

  async getWithEmbeddings(): Promise<KBChunk[]> {
    const chunks = loadData();
    return chunks.filter(c => c.embedding !== null && c.embedding.length > 0);
  }

  async getByAudience(audience: KBAudience): Promise<KBChunk[]> {
    const chunks = loadData();
    return chunks.filter(c => c.audience.includes(audience));
  }

  async getByTags(tags: string[]): Promise<KBChunk[]> {
    const chunks = loadData();
    return chunks.filter(c => 
      tags.some(tag => c.tags.includes(tag))
    );
  }

  async search(query: string): Promise<KBChunk[]> {
    const chunks = loadData();
    const lowerQuery = query.toLowerCase();
    
    return chunks.filter(c => 
      c.text.toLowerCase().includes(lowerQuery) ||
      c.headingPath.some(h => h.toLowerCase().includes(lowerQuery))
    );
  }

  async getStats(): Promise<{ total: number; withEmbeddings: number; byDoc: Record<string, number> }> {
    const chunks = loadData();
    const byDoc: Record<string, number> = {};
    let withEmbeddings = 0;
    
    for (const chunk of chunks) {
      byDoc[chunk.docId] = (byDoc[chunk.docId] || 0) + 1;
      if (chunk.embedding && chunk.embedding.length > 0) {
        withEmbeddings++;
      }
    }

    return { total: chunks.length, withEmbeddings, byDoc };
  }
}

export default KBChunksRepo;
