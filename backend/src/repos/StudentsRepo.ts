/**
 * StudentsRepo - Repository for Student entities
 */

import { BaseRepository, ValidationResult } from './BaseRepository';
import { FileStore, EntityCollection, createEntityStore } from '../storage/FileStore';
import { Student, StudentStatus } from '../domain';
import { createId } from '../domain/id';

export class StudentsRepo extends BaseRepository<Student> {
    private static instance: StudentsRepo | null = null;

    private constructor(store: FileStore<EntityCollection<Student>>) {
        super(store, 'Student');
    }

    static getInstance(): StudentsRepo {
        if (!StudentsRepo.instance) {
            const store = createEntityStore<Student>('students.json');
            StudentsRepo.instance = new StudentsRepo(store);
        }
        return StudentsRepo.instance;
    }

    protected generateId(): string {
        return createId.student();
    }

    protected validate(entity: Student): ValidationResult {
        const errors: string[] = [];

        if (!entity.firstName?.trim()) {
            errors.push('firstName is required');
        }
        if (!entity.lastName?.trim()) {
            errors.push('lastName is required');
        }
        if (!entity.status || !Object.values(StudentStatus).includes(entity.status)) {
            errors.push('Valid status is required');
        }

        return { valid: errors.length === 0, errors };
    }

    // Entity-specific queries
    async findByStatus(status: StudentStatus): Promise<Student[]> {
        return this.find(s => s.status === status);
    }

    async findActive(): Promise<Student[]> {
        return this.find(s => s.status === StudentStatus.Active);
    }

    async findByContactId(contactId: string): Promise<Student[]> {
        return this.find(s => s.contactIds.includes(contactId));
    }

    async findByInstrument(instrument: string): Promise<Student[]> {
        return this.find(s => s.instruments.includes(instrument));
    }

    async findByEnrollmentId(enrollmentId: string): Promise<Student[]> {
        return this.find(s => s.currentEnrollmentIds.includes(enrollmentId));
    }

    async search(query: string): Promise<Student[]> {
        const q = query.toLowerCase();
        return this.find(s => 
            s.firstName.toLowerCase().includes(q) ||
            s.lastName.toLowerCase().includes(q)
        );
    }
}

export default StudentsRepo;
