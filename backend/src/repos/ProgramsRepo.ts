/**
 * ProgramsRepo - Repository for Program entities
 */

import { BaseRepository, ValidationResult } from './BaseRepository';
import { FileStore, EntityCollection, createEntityStore } from '../storage/FileStore';
import { Program, ProgramStatus } from '../domain';
import { createId } from '../domain/id';

export class ProgramsRepo extends BaseRepository<Program> {
    private static instance: ProgramsRepo | null = null;

    private constructor(store: FileStore<EntityCollection<Program>>) {
        super(store, 'Program');
    }

    static getInstance(): ProgramsRepo {
        if (!ProgramsRepo.instance) {
            const store = createEntityStore<Program>('programs.json');
            ProgramsRepo.instance = new ProgramsRepo(store);
        }
        return ProgramsRepo.instance;
    }

    protected generateId(): string {
        return createId.program();
    }

    protected validate(entity: Program): ValidationResult {
        const errors: string[] = [];

        if (!entity.name?.trim()) {
            errors.push('name is required');
        }
        if (!entity.code?.trim()) {
            errors.push('code is required');
        }
        if (!entity.status || !Object.values(ProgramStatus).includes(entity.status)) {
            errors.push('Valid status is required');
        }

        return { valid: errors.length === 0, errors };
    }

    // Entity-specific queries
    async findByStatus(status: ProgramStatus): Promise<Program[]> {
        return this.find(p => p.status === status);
    }

    async findActive(): Promise<Program[]> {
        return this.find(p => p.status === ProgramStatus.Active);
    }

    async findByCode(code: string): Promise<Program | null> {
        return this.findOne(p => p.code === code);
    }
}

export default ProgramsRepo;
