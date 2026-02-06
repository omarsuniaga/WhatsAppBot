/**
 * KBDocsRepo - Repository for Knowledge Base Documents
 */

import * as fs from 'fs';
import * as path from 'path';
import { KBDoc, CreateKBDoc, KBDocStatus } from '../domain/kb-types';

const DATA_DIR = path.join(process.cwd(), 'backend', 'data');
const FILE_PATH = path.join(DATA_DIR, 'kb_docs.json');

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `kb_doc_${timestamp}${random}`;
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadData(): KBDoc[] {
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

function saveData(docs: KBDoc[]): void {
  ensureDataDir();
  fs.writeFileSync(FILE_PATH, JSON.stringify(docs, null, 2));
}

export class KBDocsRepo {
  private static instance: KBDocsRepo;

  private constructor() {}

  static getInstance(): KBDocsRepo {
    if (!KBDocsRepo.instance) {
      KBDocsRepo.instance = new KBDocsRepo();
    }
    return KBDocsRepo.instance;
  }

  async list(): Promise<KBDoc[]> {
    return loadData();
  }

  async getById(id: string): Promise<KBDoc | null> {
    const docs = loadData();
    return docs.find(d => d.id === id) || null;
  }

  async getByChecksum(checksum: string): Promise<KBDoc | null> {
    const docs = loadData();
    return docs.find(d => d.checksum === checksum) || null;
  }

  async getByFilename(filename: string): Promise<KBDoc | null> {
    const docs = loadData();
    return docs.find(d => d.filename === filename) || null;
  }

  async upsert(data: CreateKBDoc & { id?: string }): Promise<KBDoc> {
    const docs = loadData();
    const now = new Date().toISOString();

    if (data.id) {
      // Update existing
      const index = docs.findIndex(d => d.id === data.id);
      if (index !== -1) {
        const updated: KBDoc = {
          ...docs[index],
          ...data,
          id: data.id,
          updatedAt: now
        };
        docs[index] = updated;
        saveData(docs);
        return updated;
      }
    }

    // Create new
    const newDoc: KBDoc = {
      id: data.id || generateId(),
      filename: data.filename,
      title: data.title,
      rawMd: data.rawMd,
      checksum: data.checksum,
      audience: data.audience,
      tags: data.tags,
      version: data.version,
      source: data.source,
      status: data.status || 'draft',
      chunksCount: 0,
      indexedAt: null,
      createdAt: now,
      updatedAt: now
    };

    docs.push(newDoc);
    saveData(docs);
    return newDoc;
  }

  async updateStatus(id: string, status: KBDocStatus, chunksCount?: number): Promise<KBDoc | null> {
    const docs = loadData();
    const index = docs.findIndex(d => d.id === id);
    
    if (index === -1) return null;

    docs[index].status = status;
    docs[index].updatedAt = new Date().toISOString();
    
    if (chunksCount !== undefined) {
      docs[index].chunksCount = chunksCount;
    }
    
    if (status === 'active') {
      docs[index].indexedAt = new Date().toISOString();
    }

    saveData(docs);
    return docs[index];
  }

  async remove(id: string): Promise<boolean> {
    const docs = loadData();
    const index = docs.findIndex(d => d.id === id);
    
    if (index === -1) return false;

    docs.splice(index, 1);
    saveData(docs);
    return true;
  }

  async search(query: string): Promise<KBDoc[]> {
    const docs = loadData();
    const lowerQuery = query.toLowerCase();
    
    return docs.filter(d => 
      d.title.toLowerCase().includes(lowerQuery) ||
      d.tags.some(t => t.toLowerCase().includes(lowerQuery)) ||
      d.filename.toLowerCase().includes(lowerQuery)
    );
  }

  async getByTags(tags: string[]): Promise<KBDoc[]> {
    const docs = loadData();
    return docs.filter(d => 
      tags.some(tag => d.tags.includes(tag))
    );
  }

  async getByAudience(audience: string): Promise<KBDoc[]> {
    const docs = loadData();
    return docs.filter(d => d.audience.includes(audience as any));
  }

  async getStats(): Promise<{ total: number; byStatus: Record<string, number> }> {
    const docs = loadData();
    const byStatus: Record<string, number> = {};
    
    for (const doc of docs) {
      byStatus[doc.status] = (byStatus[doc.status] || 0) + 1;
    }

    return { total: docs.length, byStatus };
  }
}

export default KBDocsRepo;
