/**
 * EventLogRepo - Repository for EventLog entities (Audit trail)
 */

import { BaseRepository, ValidationResult } from './BaseRepository';
import { FileStore, EntityCollection, createEntityStore } from '../storage/FileStore';
import { EventLog, EventLogType, EventLogLevel } from '../domain';
import { createId } from '../domain/id';

export class EventLogRepo extends BaseRepository<EventLog> {
    private static instance: EventLogRepo | null = null;

    private constructor(store: FileStore<EntityCollection<EventLog>>) {
        super(store, 'EventLog');
    }

    static getInstance(): EventLogRepo {
        if (!EventLogRepo.instance) {
            const store = createEntityStore<EventLog>('eventLog.json');
            EventLogRepo.instance = new EventLogRepo(store);
        }
        return EventLogRepo.instance;
    }

    protected generateId(): string {
        return createId.eventLog();
    }

    protected validate(entity: EventLog): ValidationResult {
        const errors: string[] = [];

        if (!entity.type || !Object.values(EventLogType).includes(entity.type)) {
            errors.push('Valid type is required');
        }
        if (!entity.level || !Object.values(EventLogLevel).includes(entity.level)) {
            errors.push('Valid level is required');
        }
        if (!entity.message?.trim()) {
            errors.push('message is required');
        }

        return { valid: errors.length === 0, errors };
    }

    // Entity-specific queries
    async findByType(type: EventLogType): Promise<EventLog[]> {
        return this.find(e => e.type === type);
    }

    async findByLevel(level: EventLogLevel): Promise<EventLog[]> {
        return this.find(e => e.level === level);
    }

    async findByEntity(entityType: string, entityId: string): Promise<EventLog[]> {
        return this.find(e => e.entityType === entityType && e.entityId === entityId);
    }

    async findByActor(actorId: string): Promise<EventLog[]> {
        return this.find(e => e.actorId === actorId);
    }

    async findErrors(): Promise<EventLog[]> {
        return this.find(e => e.level === EventLogLevel.Error);
    }

    async findRecent(limit: number = 100): Promise<EventLog[]> {
        const all = await this.list();
        return all
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, limit);
    }

    // Convenience method to log an event
    async log(
        type: EventLogType,
        level: EventLogLevel,
        message: string,
        options?: {
            entityType?: string;
            entityId?: string;
            actorId?: string;
            actorType?: 'user' | 'system' | 'bot';
            data?: Record<string, unknown>;
            error?: string;
        }
    ): Promise<EventLog> {
        return this.upsert({
            type,
            level,
            message,
            entityType: options?.entityType,
            entityId: options?.entityId,
            actorId: options?.actorId,
            actorType: options?.actorType || 'system',
            data: options?.data,
            error: options?.error
        });
    }
}

export default EventLogRepo;
