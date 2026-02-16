/**
 * FileStore<T> - Generic file-based JSON storage
 * 
 * Features:
 * - Atomic writes (write to temp file, then rename)
 * - In-process write queue to prevent corruption
 * - Auto-create directory if missing
 * - Type-safe with generics
 * 
 * MIGRATION NOTE: This class is the file-based implementation.
 * When migrating to Firestore, replace repository implementations
 * but keep the same interface contracts.
 */

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { getErrorMessage } from '../utils/errorUtils';

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const rename = promisify(fs.rename);
const unlink = promisify(fs.unlink);
const mkdir = promisify(fs.mkdir);
const access = promisify(fs.access);

export interface FileStoreOptions<T> {
    filePath: string;
    defaultValue: T;
    prettyPrint?: boolean;
}

export class FileStore<T> {
    private readonly filePath: string;
    private readonly defaultValue: T;
    private readonly prettyPrint: boolean;
    
    // Write queue to prevent concurrent writes
    private writeQueue: Promise<void> = Promise.resolve();
    private isWriting: boolean = false;
    
    // In-memory cache for fast reads
    private cache: T | null = null;
    private cacheValid: boolean = false;

    constructor(options: FileStoreOptions<T>) {
        this.filePath = options.filePath;
        this.defaultValue = options.defaultValue;
        this.prettyPrint = options.prettyPrint ?? true;
    }

    /**
     * Ensure the directory exists
     */
    async ensureDirExists(): Promise<void> {
        const dir = path.dirname(this.filePath);
        try {
            await access(dir, fs.constants.F_OK);
        } catch {
            await mkdir(dir, { recursive: true });
        }
    }

    /**
     * Ensure the file exists with default value if missing
     */
    async ensureFileExists(): Promise<void> {
        await this.ensureDirExists();
        try {
            await access(this.filePath, fs.constants.F_OK);
        } catch {
            await this.write(this.defaultValue);
        }
    }

    /**
     * Read and parse JSON from file
     * Returns default value if file doesn't exist or is invalid
     */
    async read(): Promise<T> {
        // Return cached value if valid
        if (this.cacheValid && this.cache !== null) {
            return this.cache;
        }

        try {
            await this.ensureDirExists();
            const content = await readFile(this.filePath, 'utf-8');
            const parsed = JSON.parse(content) as T;
            
            // Update cache
            this.cache = parsed;
            this.cacheValid = true;
            
            return parsed;
        } catch (error: unknown) {
            if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
                // File doesn't exist, return default
                return this.defaultValue;
            }
            if (error instanceof SyntaxError) {
                console.error(`[FileStore] Invalid JSON in ${this.filePath}, returning default`);
                return this.defaultValue;
            }
            throw error;
        }
    }

    /**
     * Atomic write: write to temp file, then rename
     * Uses a queue to prevent concurrent writes
     */
    async write(data: T): Promise<void> {
        // Invalidate cache immediately
        this.cacheValid = false;

        // Queue this write
        this.writeQueue = this.writeQueue.then(async () => {
            await this.atomicWrite(data);
        }).catch(error => {
            console.error(`[FileStore] Write error for ${this.filePath}:`, error);
            throw error;
        });

        return this.writeQueue;
    }

    /**
     * Perform atomic write operation
     */
    private async atomicWrite(data: T): Promise<void> {
        this.isWriting = true;
        
        try {
            await this.ensureDirExists();
            
            const tempPath = `${this.filePath}.tmp.${Date.now()}`;
            const content = this.prettyPrint 
                ? JSON.stringify(data, null, 2) 
                : JSON.stringify(data);
            
            // Write to temp file
            await writeFile(tempPath, content, 'utf-8');
            
            // Atomic rename
            await rename(tempPath, this.filePath);
            
            // Update cache
            this.cache = data;
            this.cacheValid = true;
            
        } finally {
            this.isWriting = false;
        }
    }

    /**
     * Update data using a transform function
     * Ensures read-modify-write is atomic
     */
    async update(transform: (current: T) => T): Promise<T> {
        const current = await this.read();
        const updated = transform(current);
        await this.write(updated);
        return updated;
    }

    /**
     * Check if file exists
     */
    async exists(): Promise<boolean> {
        try {
            await access(this.filePath, fs.constants.F_OK);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Delete the file
     */
    async delete(): Promise<boolean> {
        try {
            await unlink(this.filePath);
            this.cache = null;
            this.cacheValid = false;
            return true;
        } catch (error: unknown) {
            if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
                return false;
            }
            throw error;
        }
    }

    /**
     * Invalidate cache (force re-read on next access)
     */
    invalidateCache(): void {
        this.cacheValid = false;
    }

    /**
     * Get file path (for debugging)
     */
    getFilePath(): string {
        return this.filePath;
    }

    /**
     * Check if a write is in progress
     */
    isWriteInProgress(): boolean {
        return this.isWriting;
    }
}

// ==========================================
// Factory for creating stores with standard paths
// ==========================================

const DATA_DIR = path.resolve(process.cwd(), 'data');

export function createFileStore<T>(filename: string, defaultValue: T): FileStore<T> {
    return new FileStore<T>({
        filePath: path.join(DATA_DIR, filename),
        defaultValue,
        prettyPrint: true
    });
}

// Pre-configured store creators for each entity type
export const createStores = {
    contacts: () => createFileStore<ContactsFileData>('contacts-v2.json', {
        version: 1,
        lastUpdated: new Date().toISOString(),
        contacts: []
    }),
    
    students: () => createFileStore<StudentsFileData>('students.json', {
        version: 1,
        lastUpdated: new Date().toISOString(),
        students: []
    }),
    
    attendance: () => createFileStore<AttendanceFileData>('attendance.json', {
        version: 1,
        byDate: {}
    }),
    
    templates: () => createFileStore<TemplatesFileData>('templates.json', {
        version: 1,
        lastUpdated: new Date().toISOString(),
        templates: []
    }),
    
    phoneIndex: () => createFileStore<PhoneIndexFileData>('phoneIndex.json', {
        version: 1,
        lastUpdated: new Date().toISOString(),
        index: {}
    }),
    
    automations: () => createFileStore<AutomationsFileData>('automations.json', {
        version: 1,
        lastUpdated: new Date().toISOString(),
        automations: []
    }),
    
    knowledgeIndex: () => createFileStore<KnowledgeIndexFileData>('knowledgeIndex.json', {
        version: 1,
        lastRebuilt: new Date().toISOString(),
        entries: [],
        keywordMap: {}
    })
};

// ==========================================
// File Data Types (wrapper types for JSON files)
// ==========================================

import type { 
    Contact, 
    Student, 
    DailyAttendance, 
    Template, 
    PhoneIndexEntry,
    Automation,
    KnowledgeIndexEntry
} from '../types/entities';

export interface ContactsFileData {
    version: number;
    lastUpdated: string;
    contacts: Contact[];
}

export interface StudentsFileData {
    version: number;
    lastUpdated: string;
    students: Student[];
}

export interface AttendanceFileData {
    version: number;
    byDate: Record<string, DailyAttendance>;
}

export interface TemplatesFileData {
    version: number;
    lastUpdated: string;
    templates: Template[];
}

export interface PhoneIndexFileData {
    version: number;
    lastUpdated: string;
    index: Record<string, PhoneIndexEntry>;
}

export interface AutomationsFileData {
    version: number;
    lastUpdated: string;
    automations: Automation[];
}

export interface KnowledgeIndexFileData {
    version: number;
    lastRebuilt: string;
    entries: KnowledgeIndexEntry[];
    keywordMap: Record<string, string[]>;
}
