/**
 * EnrollmentsRepo - Repository for Enrollment entities
 */

import { BaseRepository, ValidationResult } from './BaseRepository';
import { FileStore, EntityCollection, createEntityStore } from '../storage/FileStore';
import { Enrollment, EnrollmentStatus } from '../domain';
import { createId } from '../domain/id';

export class EnrollmentsRepo extends BaseRepository<Enrollment> {
    private static instance: EnrollmentsRepo | null = null;

    private constructor(store: FileStore<EntityCollection<Enrollment>>) {
        super(store, 'Enrollment');
    }

    static getInstance(): EnrollmentsRepo {
        if (!EnrollmentsRepo.instance) {
            const store = createEntityStore<Enrollment>('enrollments.json');
            EnrollmentsRepo.instance = new EnrollmentsRepo(store);
        }
        return EnrollmentsRepo.instance;
    }

    protected generateId(): string {
        return createId.enrollment();
    }

    protected validate(entity: Enrollment): ValidationResult {
        const errors: string[] = [];

        if (!entity.studentId?.trim()) {
            errors.push('studentId is required');
        }
        if (!entity.classGroupId?.trim()) {
            errors.push('classGroupId is required');
        }
        if (!entity.startDate?.trim()) {
            errors.push('startDate is required');
        }
        if (!entity.status || !Object.values(EnrollmentStatus).includes(entity.status)) {
            errors.push('Valid status is required');
        }

        return { valid: errors.length === 0, errors };
    }

    // Entity-specific queries
    async findByStudent(studentId: string): Promise<Enrollment[]> {
        return this.find(e => e.studentId === studentId);
    }

    async findByClassGroup(classGroupId: string): Promise<Enrollment[]> {
        return this.find(e => e.classGroupId === classGroupId);
    }

    async findActiveByStudent(studentId: string): Promise<Enrollment[]> {
        return this.find(e => e.studentId === studentId && e.status === EnrollmentStatus.Active);
    }

    async findActiveByClassGroup(classGroupId: string): Promise<Enrollment[]> {
        return this.find(e => e.classGroupId === classGroupId && e.status === EnrollmentStatus.Active);
    }

    async findByStatus(status: EnrollmentStatus): Promise<Enrollment[]> {
        return this.find(e => e.status === status);
    }
}

export default EnrollmentsRepo;
