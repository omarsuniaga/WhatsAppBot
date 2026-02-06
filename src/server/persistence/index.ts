/**
 * Persistence Layer - Index
 * 
 * Exports all repositories and the FileStore for centralized access.
 * 
 * MIGRATION NOTE: When migrating to Firestore, update the imports here
 * to point to Firestore implementations while keeping the same exports.
 */

// Core storage
export { FileStore, createFileStore, createStores } from './FileStore';
export type {
    FileStoreOptions,
    ContactsFileData,
    StudentsFileData,
    AttendanceFileData,
    TemplatesFileData,
    PhoneIndexFileData,
    AutomationsFileData,
    KnowledgeIndexFileData
} from './FileStore';

// Repositories
export { ContactsRepository } from './ContactsRepository';
export { StudentsRepository } from './StudentsRepository';
export { AttendanceRepository } from './AttendanceRepository';
export { TemplatesRepository } from './TemplatesRepository';
export { PhoneIndexRepository } from './PhoneIndexRepository';

// Initialize all repositories
export async function initializePersistence(): Promise<void> {
    const { ContactsRepository } = await import('./ContactsRepository');
    const { StudentsRepository } = await import('./StudentsRepository');
    const { AttendanceRepository } = await import('./AttendanceRepository');
    const { TemplatesRepository } = await import('./TemplatesRepository');
    const { PhoneIndexRepository } = await import('./PhoneIndexRepository');

    await Promise.all([
        ContactsRepository.getInstance().initialize(),
        StudentsRepository.getInstance().initialize(),
        AttendanceRepository.getInstance().initialize(),
        TemplatesRepository.getInstance().initialize(),
        PhoneIndexRepository.getInstance().initialize()
    ]);

    console.log('[Persistence] All repositories initialized');
}
