/**
 * TeachersRepo - Repository for Teacher entities
 */

import { BaseRepository, ValidationResult } from './BaseRepository';
import { FileStore, EntityCollection, createEntityStore } from '../storage/FileStore';
import { Teacher, TeacherStatus } from '../domain';
import { createId } from '../domain/id';

export class TeachersRepo extends BaseRepository<Teacher> {
    private static instance: TeachersRepo | null = null;

    private constructor(store: FileStore<EntityCollection<Teacher>>) {
        super(store, 'Teacher');
    }

    static getInstance(): TeachersRepo {
        if (!TeachersRepo.instance) {
            const store = createEntityStore<Teacher>('teachers.json');
            TeachersRepo.instance = new TeachersRepo(store);
        }
        return TeachersRepo.instance;
    }

    protected generateId(): string {
        return createId.teacher();
    }

    protected validate(entity: Teacher): ValidationResult {
        const errors: string[] = [];

        if (!entity.firstName?.trim()) {
            errors.push('firstName is required');
        }
        if (!entity.lastName?.trim()) {
            errors.push('lastName is required');
        }
        if (!entity.status || !Object.values(TeacherStatus).includes(entity.status)) {
            errors.push('Valid status is required');
        }

        return { valid: errors.length === 0, errors };
    }

    // Entity-specific queries
    async findByStatus(status: TeacherStatus): Promise<Teacher[]> {
        return this.find(t => t.status === status);
    }

    async findActive(): Promise<Teacher[]> {
        return this.find(t => t.status === TeacherStatus.Active);
    }

    async findByInstrument(instrument: string): Promise<Teacher[]> {
        return this.find(t => t.instruments.includes(instrument));
    }

    async findByClassGroup(classGroupId: string): Promise<Teacher[]> {
        return this.find(t => t.classGroupIds.includes(classGroupId));
    }

    async search(query: string): Promise<Teacher[]> {
        const q = query.toLowerCase();
        return this.find(t => 
            t.firstName.toLowerCase().includes(q) ||
            t.lastName.toLowerCase().includes(q)
        );
    }
}

export default TeachersRepo;
