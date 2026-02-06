/**
 * WhatsAppGroupsRepo - Repository for WhatsAppGroup entities
 */

import { BaseRepository, ValidationResult } from './BaseRepository';
import { FileStore, EntityCollection, createEntityStore } from '../storage/FileStore';
import { WhatsAppGroup, WhatsAppGroupType, WhatsAppGroupStatus } from '../domain';
import { createId } from '../domain/id';

export class WhatsAppGroupsRepo extends BaseRepository<WhatsAppGroup> {
    private static instance: WhatsAppGroupsRepo | null = null;

    private constructor(store: FileStore<EntityCollection<WhatsAppGroup>>) {
        super(store, 'WhatsAppGroup');
    }

    static getInstance(): WhatsAppGroupsRepo {
        if (!WhatsAppGroupsRepo.instance) {
            const store = createEntityStore<WhatsAppGroup>('waGroups.json');
            WhatsAppGroupsRepo.instance = new WhatsAppGroupsRepo(store);
        }
        return WhatsAppGroupsRepo.instance;
    }

    protected generateId(): string {
        return createId.whatsAppGroup();
    }

    protected validate(entity: WhatsAppGroup): ValidationResult {
        const errors: string[] = [];

        if (!entity.jid?.trim()) {
            errors.push('jid is required');
        }
        if (!entity.name?.trim()) {
            errors.push('name is required');
        }
        if (!entity.type || !Object.values(WhatsAppGroupType).includes(entity.type)) {
            errors.push('Valid type is required');
        }
        if (!entity.status || !Object.values(WhatsAppGroupStatus).includes(entity.status)) {
            errors.push('Valid status is required');
        }

        return { valid: errors.length === 0, errors };
    }

    // Entity-specific queries
    async findByJid(jid: string): Promise<WhatsAppGroup | null> {
        return this.findOne(g => g.jid === jid);
    }

    async findByType(type: WhatsAppGroupType): Promise<WhatsAppGroup[]> {
        return this.find(g => g.type === type);
    }

    async findByStatus(status: WhatsAppGroupStatus): Promise<WhatsAppGroup[]> {
        return this.find(g => g.status === status);
    }

    async findActive(): Promise<WhatsAppGroup[]> {
        return this.find(g => g.status === WhatsAppGroupStatus.Active);
    }

    async findByClassGroup(classGroupId: string): Promise<WhatsAppGroup | null> {
        return this.findOne(g => g.classGroupId === classGroupId);
    }

    async findByProgram(programId: string): Promise<WhatsAppGroup[]> {
        return this.find(g => g.programId === programId);
    }

    async findBotEnabled(): Promise<WhatsAppGroup[]> {
        return this.find(g => g.botEnabled);
    }
}

export default WhatsAppGroupsRepo;
