/**
 * PhoneIndexRepository - Maintains phone->contactId mapping
 * 
 * Enables fast lookup of contacts by phone number, which is essential
 * for resolving WhatsApp message senders to institutional contacts.
 * 
 * MIGRATION NOTE: Implements IPhoneIndexRepository interface.
 * To migrate to Firestore, create a new class implementing the same interface.
 */

import { FileStore, createStores, PhoneIndexFileData } from './FileStore';
import type { PhoneIndexEntry, IPhoneIndexRepository } from '../types/entities';

export class PhoneIndexRepository implements IPhoneIndexRepository {
    private store: FileStore<PhoneIndexFileData>;
    private static instance: PhoneIndexRepository | null = null;

    private constructor() {
        this.store = createStores.phoneIndex();
    }

    static getInstance(): PhoneIndexRepository {
        if (!PhoneIndexRepository.instance) {
            PhoneIndexRepository.instance = new PhoneIndexRepository();
        }
        return PhoneIndexRepository.instance;
    }

    async initialize(): Promise<void> {
        await this.store.ensureFileExists();
    }

    /**
     * Normalize phone number to a consistent format
     * Removes all non-digit characters
     */
    private normalizePhone(phone: string): string {
        return phone.replace(/\D/g, '');
    }

    /**
     * Lookup a contact by phone number
     */
    async lookup(phone: string): Promise<PhoneIndexEntry | null> {
        const normalized = this.normalizePhone(phone);
        const data = await this.store.read();
        return data.index[normalized] || null;
    }

    /**
     * Link a phone number to a contact
     */
    async link(
        phone: string, 
        contactId: string, 
        source: PhoneIndexEntry['source'] = 'manual'
    ): Promise<void> {
        const normalized = this.normalizePhone(phone);
        const now = new Date().toISOString();

        await this.store.update(data => ({
            ...data,
            lastUpdated: now,
            index: {
                ...data.index,
                [normalized]: {
                    phone: normalized,
                    contactId,
                    linkedAt: now,
                    source
                }
            }
        }));
    }

    /**
     * Unlink a phone number
     */
    async unlink(phone: string): Promise<boolean> {
        const normalized = this.normalizePhone(phone);
        let unlinked = false;

        await this.store.update(data => {
            if (!data.index[normalized]) return data;

            unlinked = true;
            const { [normalized]: removed, ...remaining } = data.index;

            return {
                ...data,
                lastUpdated: new Date().toISOString(),
                index: remaining
            };
        });

        return unlinked;
    }

    /**
     * Get all phone numbers linked to a contact
     */
    async getContactPhones(contactId: string): Promise<string[]> {
        const data = await this.store.read();
        const phones: string[] = [];

        for (const [phone, entry] of Object.entries(data.index)) {
            if (entry.contactId === contactId) {
                phones.push(phone);
            }
        }

        return phones;
    }

    /**
     * Bulk link multiple phones to a contact
     */
    async linkMultiple(
        phones: string[], 
        contactId: string, 
        source: PhoneIndexEntry['source'] = 'manual'
    ): Promise<number> {
        const now = new Date().toISOString();
        let linked = 0;

        await this.store.update(data => {
            const newIndex = { ...data.index };

            for (const phone of phones) {
                const normalized = this.normalizePhone(phone);
                if (normalized) {
                    newIndex[normalized] = {
                        phone: normalized,
                        contactId,
                        linkedAt: now,
                        source
                    };
                    linked++;
                }
            }

            return {
                ...data,
                lastUpdated: now,
                index: newIndex
            };
        });

        return linked;
    }

    /**
     * Remove all phone links for a contact
     */
    async unlinkContact(contactId: string): Promise<number> {
        let unlinked = 0;

        await this.store.update(data => {
            const newIndex: Record<string, PhoneIndexEntry> = {};

            for (const [phone, entry] of Object.entries(data.index)) {
                if (entry.contactId !== contactId) {
                    newIndex[phone] = entry;
                } else {
                    unlinked++;
                }
            }

            return {
                ...data,
                lastUpdated: new Date().toISOString(),
                index: newIndex
            };
        });

        return unlinked;
    }

    /**
     * Get all entries (for debugging/admin)
     */
    async getAll(): Promise<PhoneIndexEntry[]> {
        const data = await this.store.read();
        return Object.values(data.index);
    }

    /**
     * Get count of indexed phones
     */
    async count(): Promise<number> {
        const data = await this.store.read();
        return Object.keys(data.index).length;
    }

    /**
     * Rebuild index from contacts repository
     * Useful for data migration or recovery
     */
    async rebuildFromContacts(contacts: Array<{ id: string; phones: string[] }>): Promise<{
        indexed: number;
        duplicates: string[];
    }> {
        const now = new Date().toISOString();
        const duplicates: string[] = [];
        const newIndex: Record<string, PhoneIndexEntry> = {};

        for (const contact of contacts) {
            for (const phone of contact.phones) {
                const normalized = this.normalizePhone(phone);
                if (!normalized) continue;

                if (newIndex[normalized]) {
                    duplicates.push(`${normalized} (contact ${contact.id} conflicts with ${newIndex[normalized].contactId})`);
                    continue;
                }

                newIndex[normalized] = {
                    phone: normalized,
                    contactId: contact.id,
                    linkedAt: now,
                    source: 'import'
                };
            }
        }

        await this.store.write({
            version: 1,
            lastUpdated: now,
            index: newIndex
        });

        return {
            indexed: Object.keys(newIndex).length,
            duplicates
        };
    }
}

export default PhoneIndexRepository;
