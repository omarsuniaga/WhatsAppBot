/**
 * BaseRepository - Abstract base for all entity repositories
 * El Sistema Punta Cana - Institutional WhatsApp Bot
 * 
 * Provides common CRUD operations for all entities.
 * Each repository extends this with entity-specific validation and queries.
 */

import { FileStore, EntityCollection } from '../storage/FileStore';
import { BaseEntity } from '../domain/types';
import { now } from '../domain/time';

export interface IRepository<T extends BaseEntity> {
    list(): Promise<T[]>;
    getById(id: string): Promise<T | null>;
    upsert(entity: Partial<T> & { id?: string }): Promise<T>;
    remove(id: string): Promise<boolean>;
}

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

export abstract class BaseRepository<T extends BaseEntity> implements IRepository<T> {
    protected store: FileStore<EntityCollection<T>>;
    protected entityName: string;

    constructor(store: FileStore<EntityCollection<T>>, entityName: string) {
        this.store = store;
        this.entityName = entityName;
    }

    /**
     * Initialize the repository (ensure file exists)
     */
    async initialize(): Promise<void> {
        await this.store.ensureFile();
    }

    /**
     * List all entities
     */
    async list(): Promise<T[]> {
        const data = await this.store.read();
        return data.entities;
    }

    /**
     * Get entity by ID
     */
    async getById(id: string): Promise<T | null> {
        const data = await this.store.read();
        return data.entities.find(e => e.id === id) || null;
    }

    /**
     * Insert or update an entity
     * If id is provided, updates existing; otherwise creates new
     */
    async upsert(input: Partial<T> & { id?: string }): Promise<T> {
        const timestamp = now();

        if (input.id) {
            // Update existing
            const existing = await this.getById(input.id);
            if (!existing) {
                throw new Error(`${this.entityName} not found: ${input.id}`);
            }

            const updated = {
                ...existing,
                ...input,
                updatedAt: timestamp
            } as T;

            const validation = this.validate(updated);
            if (!validation.valid) {
                throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
            }

            await this.store.update(data => ({
                entities: data.entities.map(e => e.id === input.id ? updated : e),
                lastUpdated: timestamp
            }));

            return updated;
        } else {
            // Create new
            const newEntity = {
                ...input,
                id: this.generateId(),
                createdAt: timestamp,
                updatedAt: timestamp
            } as T;

            const validation = this.validate(newEntity);
            if (!validation.valid) {
                throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
            }

            await this.store.update(data => ({
                entities: [...data.entities, newEntity],
                lastUpdated: timestamp
            }));

            return newEntity;
        }
    }

    /**
     * Remove entity by ID
     */
    async remove(id: string): Promise<boolean> {
        const existing = await this.getById(id);
        if (!existing) {
            return false;
        }

        await this.store.update(data => ({
            entities: data.entities.filter(e => e.id !== id),
            lastUpdated: now()
        }));

        return true;
    }

    /**
     * Find entities matching a predicate
     */
    async find(predicate: (entity: T) => boolean): Promise<T[]> {
        const data = await this.store.read();
        return data.entities.filter(predicate);
    }

    /**
     * Find first entity matching a predicate
     */
    async findOne(predicate: (entity: T) => boolean): Promise<T | null> {
        const data = await this.store.read();
        return data.entities.find(predicate) || null;
    }

    /**
     * Count entities
     */
    async count(): Promise<number> {
        const data = await this.store.read();
        return data.entities.length;
    }

    /**
     * Check if entity exists
     */
    async exists(id: string): Promise<boolean> {
        const entity = await this.getById(id);
        return entity !== null;
    }

    /**
     * Generate a new ID - must be implemented by subclass
     */
    protected abstract generateId(): string;

    /**
     * Validate entity - must be implemented by subclass
     */
    protected abstract validate(entity: T): ValidationResult;
}
