/**
 * LevelsRepo - Repository for Level entities
 */

import { BaseRepository, ValidationResult } from './BaseRepository';
import { FileStore, EntityCollection, createEntityStore } from '../storage/FileStore';
import { Level, LevelStatus } from '../domain';
import { createId } from '../domain/id';

export class LevelsRepo extends BaseRepository<Level> {
    private static instance: LevelsRepo | null = null;

    private constructor(store: FileStore<EntityCollection<Level>>) {
        super(store, 'Level');
    }

    static getInstance(): LevelsRepo {
        if (!LevelsRepo.instance) {
            const store = createEntityStore<Level>('levels.json');
            LevelsRepo.instance = new LevelsRepo(store);
        }
        return LevelsRepo.instance;
    }

    protected generateId(): string {
        return createId.level();
    }

    protected validate(entity: Level): ValidationResult {
        const errors: string[] = [];

        if (!entity.name?.trim()) {
            errors.push('name is required');
        }
        if (!entity.code?.trim()) {
            errors.push('code is required');
        }
        if (!entity.programId?.trim()) {
            errors.push('programId is required');
        }
        if (typeof entity.order !== 'number') {
            errors.push('order is required');
        }
        if (!entity.status || !Object.values(LevelStatus).includes(entity.status)) {
            errors.push('Valid status is required');
        }

        return { valid: errors.length === 0, errors };
    }

    // Entity-specific queries
    async findByProgram(programId: string): Promise<Level[]> {
        const levels = await this.find(l => l.programId === programId);
        return levels.sort((a, b) => a.order - b.order);
    }

    async findByStatus(status: LevelStatus): Promise<Level[]> {
        return this.find(l => l.status === status);
    }

    async findActive(): Promise<Level[]> {
        return this.find(l => l.status === LevelStatus.Active);
    }
}

export default LevelsRepo;
