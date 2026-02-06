/**
 * KBQueriesRepo - Repository for Knowledge Base Query Logs
 */

import * as fs from 'fs';
import * as path from 'path';
import { KBQuery, CreateKBQuery, KBChannel, KBAudience } from '../domain/kb-types';

const DATA_DIR = path.join(process.cwd(), 'backend', 'data');
const FILE_PATH = path.join(DATA_DIR, 'kb_queries.json');

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `kb_query_${timestamp}${random}`;
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadData(): KBQuery[] {
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

function saveData(queries: KBQuery[]): void {
  ensureDataDir();
  fs.writeFileSync(FILE_PATH, JSON.stringify(queries, null, 2));
}

export class KBQueriesRepo {
  private static instance: KBQueriesRepo;

  private constructor() {}

  static getInstance(): KBQueriesRepo {
    if (!KBQueriesRepo.instance) {
      KBQueriesRepo.instance = new KBQueriesRepo();
    }
    return KBQueriesRepo.instance;
  }

  async list(limit?: number): Promise<KBQuery[]> {
    const queries = loadData();
    const sorted = queries.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return limit ? sorted.slice(0, limit) : sorted;
  }

  async getById(id: string): Promise<KBQuery | null> {
    const queries = loadData();
    return queries.find(q => q.id === id) || null;
  }

  async create(data: CreateKBQuery): Promise<KBQuery> {
    const queries = loadData();
    const now = new Date().toISOString();

    const newQuery: KBQuery = {
      id: generateId(),
      question: data.question,
      normalizedQuestion: data.normalizedQuestion,
      channel: data.channel,
      audience: data.audience,
      topChunks: data.topChunks,
      answer: data.answer,
      confidence: data.confidence,
      gap: data.gap,
      usedCitations: data.usedCitations,
      suggestedActions: data.suggestedActions,
      processingTimeMs: data.processingTimeMs,
      createdAt: now
    };

    queries.push(newQuery);
    saveData(queries);
    return newQuery;
  }

  async getGaps(limit?: number): Promise<KBQuery[]> {
    const queries = loadData();
    const gaps = queries
      .filter(q => q.gap === true)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return limit ? gaps.slice(0, limit) : gaps;
  }

  async getByChannel(channel: KBChannel, limit?: number): Promise<KBQuery[]> {
    const queries = loadData();
    const filtered = queries
      .filter(q => q.channel === channel)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return limit ? filtered.slice(0, limit) : filtered;
  }

  async getByAudience(audience: KBAudience, limit?: number): Promise<KBQuery[]> {
    const queries = loadData();
    const filtered = queries
      .filter(q => q.audience === audience)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return limit ? filtered.slice(0, limit) : filtered;
  }

  async getByDateRange(startDate: string, endDate: string): Promise<KBQuery[]> {
    const queries = loadData();
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    
    return queries.filter(q => {
      const created = new Date(q.createdAt).getTime();
      return created >= start && created <= end;
    });
  }

  async getStats(): Promise<{
    total: number;
    gaps: number;
    avgConfidence: number;
    byChannel: Record<string, number>;
    byAudience: Record<string, number>;
  }> {
    const queries = loadData();
    const byChannel: Record<string, number> = {};
    const byAudience: Record<string, number> = {};
    let totalConfidence = 0;
    let gaps = 0;
    
    for (const query of queries) {
      byChannel[query.channel] = (byChannel[query.channel] || 0) + 1;
      byAudience[query.audience] = (byAudience[query.audience] || 0) + 1;
      totalConfidence += query.confidence;
      if (query.gap) gaps++;
    }

    return {
      total: queries.length,
      gaps,
      avgConfidence: queries.length > 0 ? totalConfidence / queries.length : 0,
      byChannel,
      byAudience
    };
  }

  async search(query: string, limit?: number): Promise<KBQuery[]> {
    const queries = loadData();
    const lowerQuery = query.toLowerCase();
    
    const filtered = queries.filter(q => 
      q.question.toLowerCase().includes(lowerQuery) ||
      q.answer.toLowerCase().includes(lowerQuery)
    ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return limit ? filtered.slice(0, limit) : filtered;
  }

  async remove(id: string): Promise<boolean> {
    const queries = loadData();
    const index = queries.findIndex(q => q.id === id);
    
    if (index === -1) return false;

    queries.splice(index, 1);
    saveData(queries);
    return true;
  }

  async cleanup(olderThanDays: number): Promise<number> {
    const queries = loadData();
    const cutoff = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    const before = queries.length;
    
    const filtered = queries.filter(q => 
      new Date(q.createdAt).getTime() > cutoff
    );
    
    saveData(filtered);
    return before - filtered.length;
  }
}

export default KBQueriesRepo;
