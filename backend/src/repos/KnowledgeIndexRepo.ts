/**
 * KnowledgeIndexRepo - Repository for KnowledgeFile entities
 */

import { BaseRepository, ValidationResult } from './BaseRepository';
import { FileStore, EntityCollection, createEntityStore } from '../storage/FileStore';
import { KnowledgeFile, KnowledgeFileType, KnowledgeFileStatus } from '../domain';
import { createId } from '../domain/id';

export class KnowledgeIndexRepo extends BaseRepository<KnowledgeFile> {
    private static instance: KnowledgeIndexRepo | null = null;

    private constructor(store: FileStore<EntityCollection<KnowledgeFile>>) {
        super(store, 'KnowledgeFile');
    }

    static getInstance(): KnowledgeIndexRepo {
        if (!KnowledgeIndexRepo.instance) {
            const store = createEntityStore<KnowledgeFile>('knowledgeIndex.json');
            KnowledgeIndexRepo.instance = new KnowledgeIndexRepo(store);
        }
        return KnowledgeIndexRepo.instance;
    }

    protected generateId(): string {
        return createId.knowledgeFile();
    }

    protected validate(entity: KnowledgeFile): ValidationResult {
        const errors: string[] = [];

        if (!entity.name?.trim()) {
            errors.push('name is required');
        }
        if (!entity.filename?.trim()) {
            errors.push('filename is required');
        }
        if (!entity.content?.trim()) {
            errors.push('content is required');
        }
        if (!entity.type || !Object.values(KnowledgeFileType).includes(entity.type)) {
            errors.push('Valid type is required');
        }
        if (!entity.status || !Object.values(KnowledgeFileStatus).includes(entity.status)) {
            errors.push('Valid status is required');
        }

        return { valid: errors.length === 0, errors };
    }

    // Entity-specific queries
    async findByType(type: KnowledgeFileType): Promise<KnowledgeFile[]> {
        return this.find(k => k.type === type);
    }

    async findByStatus(status: KnowledgeFileStatus): Promise<KnowledgeFile[]> {
        return this.find(k => k.status === status);
    }

    async findActive(): Promise<KnowledgeFile[]> {
        return this.find(k => k.status === KnowledgeFileStatus.Active);
    }

    async findByKeyword(keyword: string): Promise<KnowledgeFile[]> {
        const kw = keyword.toLowerCase();
        return this.find(k => k.keywords.some(k => k.toLowerCase().includes(kw)));
    }

    async search(query: string): Promise<KnowledgeFile[]> {
        const q = query.toLowerCase();
        return this.find(k => 
            k.name.toLowerCase().includes(q) ||
            k.content.toLowerCase().includes(q) ||
            k.summary?.toLowerCase().includes(q) ||
            k.keywords.some(kw => kw.toLowerCase().includes(q))
        );
    }
}

export default KnowledgeIndexRepo;
