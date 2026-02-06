/**
 * Knowledge Base Controller - Manage KB index, files, and RAG queries
 */

import { Request, Response } from 'express';
import { KnowledgeIndexRepo } from '../repos';
import { KnowledgeFileType, KnowledgeFileStatus } from '../domain';
import { KBDocsRepo } from '../repos/KBDocsRepo';
import { KBChunksRepo } from '../repos/KBChunksRepo';
import { KBQueriesRepo } from '../repos/KBQueriesRepo';
import { MarkdownParser } from '../services/kb/MarkdownParser';
import { EmbeddingService } from '../services/kb/EmbeddingService';
import { AskKBService } from '../services/kb/AskKBService';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const access = promisify(fs.access);
const mkdir = promisify(fs.mkdir);

const repo = KnowledgeIndexRepo.getInstance();

// Safe path resolution - prevent directory traversal
const KB_ROOT = path.join(process.cwd(), 'backend', 'data', 'knowledge');

const resolveSafePath = (filePath: string): string | null => {
    const resolved = path.resolve(KB_ROOT, filePath);
    if (!resolved.startsWith(KB_ROOT)) {
        return null; // Directory traversal attempt
    }
    return resolved;
};

/**
 * Get KB index (all indexed files)
 */
export const getIndex = async (req: Request, res: Response) => {
    try {
        const { type, status, search } = req.query;
        let files = await repo.list();

        if (type) {
            files = files.filter(f => f.type === type);
        }
        if (status) {
            files = files.filter(f => f.status === status);
        }
        if (search && typeof search === 'string') {
            files = await repo.search(search);
        }

        res.json({ success: true, data: files, count: files.length });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Get single KB entry
 */
export const getById = async (req: Request, res: Response) => {
    try {
        const file = await repo.getById(req.params.id);
        if (!file) {
            return res.status(404).json({ success: false, error: 'KB entry not found' });
        }
        res.json({ success: true, data: file });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Update KB index entry metadata
 */
export const updateIndex = async (req: Request, res: Response) => {
    try {
        const existing = await repo.getById(req.params.id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'KB entry not found' });
        }

        // Only allow updating metadata, not content
        const { name, type, status, keywords, summary } = req.body;

        const file = await repo.upsert({
            ...existing,
            name: name ?? existing.name,
            type: type ?? existing.type,
            status: status ?? existing.status,
            keywords: keywords ?? existing.keywords,
            summary: summary ?? existing.summary,
            id: req.params.id
        });

        res.json({ success: true, data: file });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Create new KB entry
 */
export const create = async (req: Request, res: Response) => {
    try {
        const { name, filename, content, type, keywords, summary } = req.body;

        if (!name || !filename || !content || !type) {
            return res.status(400).json({
                success: false,
                error: 'name, filename, content, and type are required'
            });
        }

        const file = await repo.upsert({
            name,
            filename,
            content,
            type,
            keywords: keywords || [],
            summary,
            status: KnowledgeFileStatus.Active
        });

        res.status(201).json({ success: true, data: file });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Delete KB entry
 */
export const remove = async (req: Request, res: Response) => {
    try {
        const deleted = await repo.remove(req.params.id);
        if (!deleted) {
            return res.status(404).json({ success: false, error: 'KB entry not found' });
        }
        res.json({ success: true, message: 'KB entry deleted' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Read a KB markdown file directly
 */
export const readKbFile = async (req: Request, res: Response) => {
    try {
        const filePath = req.query.path as string;
        if (!filePath) {
            return res.status(400).json({ success: false, error: 'path query parameter is required' });
        }

        const safePath = resolveSafePath(filePath);
        if (!safePath) {
            return res.status(403).json({ success: false, error: 'Invalid file path' });
        }

        try {
            await access(safePath, fs.constants.R_OK);
        } catch {
            return res.status(404).json({ success: false, error: 'File not found' });
        }

        const content = await readFile(safePath, 'utf-8');

        res.json({
            success: true,
            data: {
                path: filePath,
                content,
                size: content.length
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Write a KB markdown file directly
 */
export const writeKbFile = async (req: Request, res: Response) => {
    try {
        const filePath = req.query.path as string;
        const { content } = req.body;

        if (!filePath) {
            return res.status(400).json({ success: false, error: 'path query parameter is required' });
        }
        if (content === undefined) {
            return res.status(400).json({ success: false, error: 'content is required in body' });
        }

        const safePath = resolveSafePath(filePath);
        if (!safePath) {
            return res.status(403).json({ success: false, error: 'Invalid file path' });
        }

        // Ensure directory exists
        const dir = path.dirname(safePath);
        try {
            await access(dir, fs.constants.F_OK);
        } catch {
            await mkdir(dir, { recursive: true });
        }

        await writeFile(safePath, content, 'utf-8');

        res.json({
            success: true,
            data: {
                path: filePath,
                size: content.length
            },
            message: 'File saved successfully'
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ============================================================
// RAG-BASED KB ENDPOINTS (New)
// ============================================================

const docsRepo = KBDocsRepo.getInstance();
const chunksRepo = KBChunksRepo.getInstance();
const queriesRepo = KBQueriesRepo.getInstance();

/**
 * Import a markdown document into the KB (parse, chunk, index)
 */
export const importDocument = async (req: Request, res: Response) => {
    try {
        const { filename, rawMd } = req.body;

        if (!filename || !rawMd) {
            return res.status(400).json({
                success: false,
                error: 'filename and rawMd are required'
            });
        }

        // Check if document already exists (by checksum)
        const checksum = MarkdownParser.calculateChecksum(rawMd);
        const existing = await docsRepo.getByChecksum(checksum);
        
        if (existing) {
            return res.json({
                success: true,
                data: {
                    docId: existing.id,
                    title: existing.title,
                    chunksCount: existing.chunksCount,
                    status: existing.status
                },
                message: 'Document already exists (same checksum)'
            });
        }

        // Parse the markdown document
        const { doc, chunks } = MarkdownParser.parse(rawMd, filename);

        // Check if filename exists and update or create
        const existingByFilename = await docsRepo.getByFilename(filename);
        
        if (existingByFilename) {
            // Remove old chunks
            await chunksRepo.removeByDocId(existingByFilename.id);
            
            // Update document
            await docsRepo.upsert({
                ...doc,
                id: existingByFilename.id,
                status: 'indexing'
            });
            doc.id = existingByFilename.id;
        } else {
            // Create new document
            await docsRepo.upsert({
                ...doc,
                status: 'indexing'
            });
        }

        // Create chunks
        const chunkData = chunks.map(c => ({
            docId: doc.id,
            chunkIndex: c.chunkIndex,
            headingPath: c.headingPath,
            text: c.text,
            tokenCount: c.tokenCount,
            audience: c.audience,
            tags: c.tags
        }));
        
        await chunksRepo.createMany(chunkData);

        // Index embeddings (async, don't wait)
        const embeddingService = EmbeddingService.getInstance();
        embeddingService.indexDocument(doc.id).catch(err => {
            console.error(`[KB] Failed to index doc ${doc.id}:`, err);
            docsRepo.updateStatus(doc.id, 'error');
        });

        res.status(201).json({
            success: true,
            data: {
                docId: doc.id,
                title: doc.title,
                chunksCount: chunks.length,
                status: 'indexing'
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * List all KB documents (RAG)
 */
export const listDocs = async (req: Request, res: Response) => {
    try {
        const { status, audience, search } = req.query;
        let docs = await docsRepo.list();

        if (status) {
            docs = docs.filter(d => d.status === status);
        }
        if (audience) {
            docs = docs.filter(d => d.audience.includes(audience as any));
        }
        if (search && typeof search === 'string') {
            docs = await docsRepo.search(search);
        }

        // Don't send rawMd in list response (too large)
        const sanitized = docs.map(d => ({
            id: d.id,
            filename: d.filename,
            title: d.title,
            checksum: d.checksum,
            audience: d.audience,
            tags: d.tags,
            version: d.version,
            source: d.source,
            status: d.status,
            chunksCount: d.chunksCount,
            indexedAt: d.indexedAt,
            createdAt: d.createdAt,
            updatedAt: d.updatedAt
        }));

        res.json({ success: true, data: sanitized, count: sanitized.length });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Get a single KB document with content
 */
export const getDoc = async (req: Request, res: Response) => {
    try {
        const doc = await docsRepo.getById(req.params.id);
        if (!doc) {
            return res.status(404).json({ success: false, error: 'Document not found' });
        }
        res.json({ success: true, data: doc });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Delete a KB document and its chunks
 */
export const deleteDoc = async (req: Request, res: Response) => {
    try {
        const doc = await docsRepo.getById(req.params.id);
        if (!doc) {
            return res.status(404).json({ success: false, error: 'Document not found' });
        }

        // Remove chunks first
        await chunksRepo.removeByDocId(req.params.id);
        
        // Remove document
        await docsRepo.remove(req.params.id);

        res.json({ success: true, message: 'Document and chunks deleted' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Reindex a document's embeddings
 */
export const reindexDoc = async (req: Request, res: Response) => {
    try {
        const doc = await docsRepo.getById(req.params.id);
        if (!doc) {
            return res.status(404).json({ success: false, error: 'Document not found' });
        }

        await docsRepo.updateStatus(doc.id, 'indexing');

        const embeddingService = EmbeddingService.getInstance();
        const indexed = await embeddingService.indexDocument(doc.id);

        res.json({
            success: true,
            data: { docId: doc.id, chunksIndexed: indexed },
            message: 'Document reindexed'
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Ask a question to the KB (RAG)
 */
export const askKB = async (req: Request, res: Response) => {
    try {
        const { question, audience, channel, topK } = req.body;

        if (!question) {
            return res.status(400).json({
                success: false,
                error: 'question is required'
            });
        }

        const askService = AskKBService.getInstance();
        const response = await askService.ask({
            question,
            audience: audience || 'publico',
            channel: channel || 'web',
            topK: topK || 5
        });

        res.json({ success: true, data: response });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Get queries with gaps (no good evidence)
 */
export const getGaps = async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const gaps = await queriesRepo.getGaps(limit);

        res.json({ success: true, data: gaps, count: gaps.length });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Get query history
 */
export const getQueries = async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const queries = await queriesRepo.list(limit);

        res.json({ success: true, data: queries, count: queries.length });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Get KB statistics
 */
export const getKBStats = async (req: Request, res: Response) => {
    try {
        const docsStats = await docsRepo.getStats();
        const chunksStats = await chunksRepo.getStats();
        const queriesStats = await queriesRepo.getStats();

        res.json({
            success: true,
            data: {
                docs: docsStats,
                chunks: chunksStats,
                queries: queriesStats
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Get chunks for a document
 */
export const getDocChunks = async (req: Request, res: Response) => {
    try {
        const chunks = await chunksRepo.getByDocId(req.params.id);
        
        // Don't send embeddings in response (too large)
        const sanitized = chunks.map(c => ({
            id: c.id,
            docId: c.docId,
            chunkIndex: c.chunkIndex,
            headingPath: c.headingPath,
            text: c.text,
            tokenCount: c.tokenCount,
            audience: c.audience,
            tags: c.tags,
            hasEmbedding: c.embedding !== null && c.embedding.length > 0,
            createdAt: c.createdAt
        }));

        res.json({ success: true, data: sanitized, count: sanitized.length });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};
