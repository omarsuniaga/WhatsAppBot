/**
 * SessionsRepo - Repository for Session entities
 */

import { BaseRepository, ValidationResult } from './BaseRepository';
import { FileStore, EntityCollection, createEntityStore } from '../storage/FileStore';
import { Session, SessionStatus } from '../domain';
import { createId } from '../domain/id';

export class SessionsRepo extends BaseRepository<Session> {
    private static instance: SessionsRepo | null = null;

    private constructor(store: FileStore<EntityCollection<Session>>) {
        super(store, 'Session');
    }

    static getInstance(): SessionsRepo {
        if (!SessionsRepo.instance) {
            const store = createEntityStore<Session>('sessions.json');
            SessionsRepo.instance = new SessionsRepo(store);
        }
        return SessionsRepo.instance;
    }

    protected generateId(): string {
        return createId.session();
    }

    protected validate(entity: Session): ValidationResult {
        const errors: string[] = [];

        if (!entity.classGroupId?.trim()) {
            errors.push('classGroupId is required');
        }
        if (!entity.date?.trim()) {
            errors.push('date is required');
        }
        if (!entity.scheduledStart?.trim()) {
            errors.push('scheduledStart is required');
        }
        if (!entity.scheduledEnd?.trim()) {
            errors.push('scheduledEnd is required');
        }
        if (!entity.status || !Object.values(SessionStatus).includes(entity.status)) {
            errors.push('Valid status is required');
        }

        return { valid: errors.length === 0, errors };
    }

    // Entity-specific queries
    async findByClassGroup(classGroupId: string): Promise<Session[]> {
        return this.find(s => s.classGroupId === classGroupId);
    }

    async findByDate(date: string): Promise<Session[]> {
        return this.find(s => s.date === date);
    }

    async findByDateRange(startDate: string, endDate: string): Promise<Session[]> {
        return this.find(s => s.date >= startDate && s.date <= endDate);
    }

    async findByTeacher(teacherId: string): Promise<Session[]> {
        return this.find(s => s.teacherIds.includes(teacherId));
    }

    async findByStatus(status: SessionStatus): Promise<Session[]> {
        return this.find(s => s.status === status);
    }

    async findTodaySessions(today: string): Promise<Session[]> {
        return this.findByDate(today);
    }
}

export default SessionsRepo;
