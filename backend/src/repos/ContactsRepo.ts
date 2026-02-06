/**
 * ContactsRepo - Repository for Contact entities
 */

import { BaseRepository, ValidationResult } from './BaseRepository';
import { FileStore, EntityCollection, createEntityStore } from '../storage/FileStore';
import { Contact, ContactStatus, ContactType } from '../domain';
import { createId } from '../domain/id';

export class ContactsRepo extends BaseRepository<Contact> {
    private static instance: ContactsRepo | null = null;

    private constructor(store: FileStore<EntityCollection<Contact>>) {
        super(store, 'Contact');
    }

    static getInstance(): ContactsRepo {
        if (!ContactsRepo.instance) {
            const store = createEntityStore<Contact>('contacts.json');
            ContactsRepo.instance = new ContactsRepo(store);
        }
        return ContactsRepo.instance;
    }

    protected generateId(): string {
        return createId.contact();
    }

    protected validate(entity: Contact): ValidationResult {
        const errors: string[] = [];

        if (!entity.firstName?.trim()) {
            errors.push('firstName is required');
        }
        if (!entity.lastName?.trim()) {
            errors.push('lastName is required');
        }
        if (!entity.phones || entity.phones.length === 0) {
            errors.push('At least one phone number is required');
        }
        if (!entity.type || !Object.values(ContactType).includes(entity.type)) {
            errors.push('Valid type is required');
        }
        if (!entity.status || !Object.values(ContactStatus).includes(entity.status)) {
            errors.push('Valid status is required');
        }

        return { valid: errors.length === 0, errors };
    }

    // Entity-specific queries
    async findByPhone(phone: string): Promise<Contact | null> {
        return this.findOne(c => c.phones.includes(phone));
    }

    async findByStatus(status: ContactStatus): Promise<Contact[]> {
        return this.find(c => c.status === status);
    }

    async findByType(type: ContactType): Promise<Contact[]> {
        return this.find(c => c.type === type);
    }

    async findByStudentId(studentId: string): Promise<Contact[]> {
        return this.find(c => c.studentIds.includes(studentId));
    }

    async search(query: string): Promise<Contact[]> {
        const q = query.toLowerCase();
        return this.find(c => 
            c.firstName.toLowerCase().includes(q) ||
            c.lastName.toLowerCase().includes(q) ||
            c.displayName?.toLowerCase().includes(q) ||
            c.phones.some(p => p.includes(query))
        );
    }
}

export default ContactsRepo;
