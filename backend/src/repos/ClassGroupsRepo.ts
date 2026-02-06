/**
 * ClassGroupsRepo - Repository for ClassGroup entities
 */

import { BaseRepository, ValidationResult } from './BaseRepository';
import { FileStore, EntityCollection, createEntityStore } from '../storage/FileStore';
import { ClassGroup, ClassGroupStatus } from '../domain';
import { createId } from '../domain/id';

export class ClassGroupsRepo extends BaseRepository<ClassGroup> {
    private static instance: ClassGroupsRepo | null = null;

    private constructor(store: FileStore<EntityCollection<ClassGroup>>) {
        super(store, 'ClassGroup');
    }

    static getInstance(): ClassGroupsRepo {
        if (!ClassGroupsRepo.instance) {
            const store = createEntityStore<ClassGroup>('classGroups.json');
            ClassGroupsRepo.instance = new ClassGroupsRepo(store);
        }
        return ClassGroupsRepo.instance;
    }

    protected generateId(): string {
        return createId.classGroup();
    }

    protected validate(entity: ClassGroup): ValidationResult {
        const errors: string[] = [];

        if (!entity.name?.trim()) {
            errors.push('name is required');
        }
        if (!entity.programId?.trim()) {
            errors.push('programId is required');
        }
        if (!entity.levelId?.trim()) {
            errors.push('levelId is required');
        }
        if (!entity.status || !Object.values(ClassGroupStatus).includes(entity.status)) {
            errors.push('Valid status is required');
        }

        return { valid: errors.length === 0, errors };
    }

    // Entity-specific queries
    async findByProgram(programId: string): Promise<ClassGroup[]> {
        return this.find(c => c.programId === programId);
    }

    async findByLevel(levelId: string): Promise<ClassGroup[]> {
        return this.find(c => c.levelId === levelId);
    }

    async findByTeacher(teacherId: string): Promise<ClassGroup[]> {
        return this.find(c => c.teacherIds.includes(teacherId));
    }

    async findByStatus(status: ClassGroupStatus): Promise<ClassGroup[]> {
        return this.find(c => c.status === status);
    }

    async findActive(): Promise<ClassGroup[]> {
        return this.find(c => c.status === ClassGroupStatus.Active);
    }

    async findByWhatsAppGroup(waGroupId: string): Promise<ClassGroup | null> {
        return this.findOne(c => c.whatsappGroupId === waGroupId);
    }
}

export default ClassGroupsRepo;
