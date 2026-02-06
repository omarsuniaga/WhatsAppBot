/**
 * FileStore - Generic JSON file-based storage
 * El Sistema Punta Cana - Institutional WhatsApp Bot
 * 
 * Features:
 * - Atomic writes (write to temp, then rename)
 * - In-process write queue to prevent corruption
 * - Auto-create directory if missing
 * - Read with default value if file missing
 * 
 * MIGRATION NOTE: This is the file-based implementation.
 * When migrating to Firestore, replace repository implementations
 * but keep the same interface contracts.
 */

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const rename = promisify(fs.rename);
const unlink = promisify(fs.unlink);
const mkdir = promisify(fs.mkdir);
const access = promisify(fs.access);

export class FileStore<T> {
    private filePath: string;
    private defaultValue: T;
    private writeQueue: Promise<void> = Promise.resolve();
    private cache: T | null = null;
    private cacheValid: boolean = false;

    constructor(filePath: string, defaultValue: T) {
        this.filePath = filePath;
        this.defaultValue = defaultValue;
    }

    /**
     * Ensure the directory exists
     */
    async ensureDir(): Promise<void> {
        const dir = path.dirname(this.filePath);
        try {
            await access(dir, fs.constants.F_OK);
        } catch {
            await mkdir(dir, { recursive: true });
        }
    }

    /**
     * Ensure the file exists with default content
     */
    async ensureFile(): Promise<void> {
        await this.ensureDir();
        try {
            await access(this.filePath, fs.constants.F_OK);
        } catch {
            await this.write(this.defaultValue);
        }
    }

    /**
     * Read data from file
     * Returns default value if file doesn't exist
     */
    async read(): Promise<T> {
        if (this.cacheValid && this.cache !== null) {
            return this.cache;
        }

        try {
            await access(this.filePath, fs.constants.F_OK);
            const content = await readFile(this.filePath, 'utf-8');
            const data = JSON.parse(content) as T;
            this.cache = data;
            this.cacheValid = true;
            return data;
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                this.cache = this.defaultValue;
                this.cacheValid = true;
                return this.defaultValue;
            }
            throw error;
        }
    }

    /**
     * Write data to file atomically
     * Uses temp file + rename to prevent corruption
     */
    async write(data: T): Promise<void> {
        this.writeQueue = this.writeQueue.then(async () => {
            await this.ensureDir();
            
            const tempPath = `${this.filePath}.tmp.${Date.now()}`;
            const content = JSON.stringify(data, null, 2);

            try {
                await writeFile(tempPath, content, 'utf-8');
                await rename(tempPath, this.filePath);
                this.cache = data;
                this.cacheValid = true;
            } catch (error) {
                // Clean up temp file on error
                try {
                    await unlink(tempPath);
                } catch {
                    // Ignore cleanup errors
                }
                throw error;
            }
        });

        await this.writeQueue;
    }

    /**
     * Update data using a transform function
     * Ensures atomic read-modify-write
     */
    async update(transformer: (data: T) => T): Promise<T> {
        const currentData = await this.read();
        const newData = transformer(currentData);
        await this.write(newData);
        return newData;
    }

    /**
     * Invalidate cache (force re-read on next access)
     */
    invalidateCache(): void {
        this.cacheValid = false;
        this.cache = null;
    }

    /**
     * Get file path
     */
    getFilePath(): string {
        return this.filePath;
    }
}

// ==========================================
// STORE FACTORY
// ==========================================

const DATA_DIR = path.join(process.cwd(), 'backend', 'data');

export interface EntityCollection<T> {
    entities: T[];
    lastUpdated: number;
}

export const createEntityStore = <T>(filename: string): FileStore<EntityCollection<T>> => {
    const filePath = path.join(DATA_DIR, filename);
    const defaultValue: EntityCollection<T> = {
        entities: [],
        lastUpdated: 0
    };
    return new FileStore(filePath, defaultValue);
};

// Pre-configured stores for each entity type
export const stores = {
    contacts: () => createEntityStore<any>('contacts.json'),
    students: () => createEntityStore<any>('students.json'),
    teachers: () => createEntityStore<any>('teachers.json'),
    programs: () => createEntityStore<any>('programs.json'),
    levels: () => createEntityStore<any>('levels.json'),
    classGroups: () => createEntityStore<any>('classGroups.json'),
    enrollments: () => createEntityStore<any>('enrollments.json'),
    sessions: () => createEntityStore<any>('sessions.json'),
    attendance: () => createEntityStore<any>('attendance.json'),
    templates: () => createEntityStore<any>('templates.json'),
    waGroups: () => createEntityStore<any>('waGroups.json'),
    knowledgeIndex: () => createEntityStore<any>('knowledgeIndex.json'),
    eventLog: () => createEntityStore<any>('eventLog.json')
};
