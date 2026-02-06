/**
 * ContactsRepository - CRUD operations for Contact entities
 * 
 * MIGRATION NOTE: Implements IContactsRepository interface.
 * To migrate to Firestore, create a new class implementing the same interface.
 */

import { v4 as uuidv4 } from 'uuid';
import { FileStore, createStores, ContactsFileData } from './FileStore';
import type { Contact, IContactsRepository } from '../types/entities';

export class ContactsRepository implements IContactsRepository {
    private store: FileStore<ContactsFileData>;
    private static instance: ContactsRepository | null = null;

    private constructor() {
        this.store = createStores.contacts();
    }

    static getInstance(): ContactsRepository {
        if (!ContactsRepository.instance) {
            ContactsRepository.instance = new ContactsRepository();
        }
        return ContactsRepository.instance;
    }

    async initialize(): Promise<void> {
        await this.store.ensureFileExists();
    }

    async findById(id: string): Promise<Contact | null> {
        const data = await this.store.read();
        return data.contacts.find(c => c.id === id) || null;
    }

    async findAll(): Promise<Contact[]> {
        const data = await this.store.read();
        return data.contacts;
    }

    async findByPhone(phone: string): Promise<Contact | null> {
        const data = await this.store.read();
        const normalizedPhone = phone.replace(/\D/g, '');
        return data.contacts.find(c => 
            c.phones.some(p => p.replace(/\D/g, '') === normalizedPhone)
        ) || null;
    }

    async findByJid(jid: string): Promise<Contact | null> {
        const data = await this.store.read();
        return data.contacts.find(c => c.whatsappJid === jid) || null;
    }

    async findByStudentId(studentId: string): Promise<Contact[]> {
        const data = await this.store.read();
        return data.contacts.filter(c => c.studentIds.includes(studentId));
    }

    async findByStatus(status: Contact['status']): Promise<Contact[]> {
        const data = await this.store.read();
        return data.contacts.filter(c => c.status === status);
    }

    async findByType(type: Contact['type']): Promise<Contact[]> {
        const data = await this.store.read();
        return data.contacts.filter(c => c.type === type);
    }

    async create(input: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>): Promise<Contact> {
        const now = new Date().toISOString();
        const contact: Contact = {
            ...input,
            id: uuidv4(),
            createdAt: now,
            updatedAt: now
        };

        await this.store.update(data => ({
            ...data,
            lastUpdated: now,
            contacts: [...data.contacts, contact]
        }));

        return contact;
    }

    async update(id: string, updates: Partial<Contact>): Promise<Contact | null> {
        const now = new Date().toISOString();
        let updated: Contact | null = null;

        await this.store.update(data => {
            const index = data.contacts.findIndex(c => c.id === id);
            if (index === -1) return data;

            updated = {
                ...data.contacts[index],
                ...updates,
                id, // Prevent ID change
                createdAt: data.contacts[index].createdAt, // Prevent createdAt change
                updatedAt: now
            };

            const newContacts = [...data.contacts];
            newContacts[index] = updated;

            return {
                ...data,
                lastUpdated: now,
                contacts: newContacts
            };
        });

        return updated;
    }

    async delete(id: string): Promise<boolean> {
        let deleted = false;

        await this.store.update(data => {
            const index = data.contacts.findIndex(c => c.id === id);
            if (index === -1) return data;

            deleted = true;
            return {
                ...data,
                lastUpdated: new Date().toISOString(),
                contacts: data.contacts.filter(c => c.id !== id)
            };
        });

        return deleted;
    }

    async linkWhatsApp(id: string, jid: string): Promise<Contact | null> {
        return this.update(id, {
            whatsappJid: jid,
            whatsappVerified: true
        });
    }

    async unlinkWhatsApp(id: string): Promise<Contact | null> {
        return this.update(id, {
            whatsappJid: undefined,
            whatsappVerified: false
        });
    }

    async addStudent(contactId: string, studentId: string): Promise<Contact | null> {
        const contact = await this.findById(contactId);
        if (!contact) return null;

        if (contact.studentIds.includes(studentId)) {
            return contact; // Already linked
        }

        return this.update(contactId, {
            studentIds: [...contact.studentIds, studentId]
        });
    }

    async removeStudent(contactId: string, studentId: string): Promise<Contact | null> {
        const contact = await this.findById(contactId);
        if (!contact) return null;

        return this.update(contactId, {
            studentIds: contact.studentIds.filter(id => id !== studentId)
        });
    }

    async search(query: string): Promise<Contact[]> {
        const data = await this.store.read();
        const lowerQuery = query.toLowerCase();

        return data.contacts.filter(c => 
            c.firstName.toLowerCase().includes(lowerQuery) ||
            c.lastName.toLowerCase().includes(lowerQuery) ||
            c.displayName?.toLowerCase().includes(lowerQuery) ||
            c.email?.toLowerCase().includes(lowerQuery) ||
            c.phones.some(p => p.includes(query))
        );
    }

    async count(): Promise<number> {
        const data = await this.store.read();
        return data.contacts.length;
    }
}

export default ContactsRepository;
