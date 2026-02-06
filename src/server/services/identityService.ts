/**
 * IdentityService - Phone normalization, JID handling, and sender resolution
 * 
 * This service is responsible for:
 * - Normalizing phone numbers to E.164-like format
 * - Extracting phone numbers from WhatsApp JIDs
 * - Linking phones to contacts
 * - Resolving message senders to contacts and students
 */

import { ContactsRepository } from '../persistence/ContactsRepository';
import { StudentsRepository } from '../persistence/StudentsRepository';
import { PhoneIndexRepository } from '../persistence/PhoneIndexRepository';

export interface SenderResolution {
    contactId?: string;
    studentIds: string[];
    phone: string;
    isKnown: boolean;
    contact?: {
        id: string;
        firstName: string;
        lastName: string;
        displayName?: string;
        type: string;
    };
}

export class IdentityService {
    private static instance: IdentityService | null = null;
    
    private contactsRepo: ContactsRepository;
    private studentsRepo: StudentsRepository;
    private phoneIndexRepo: PhoneIndexRepository;

    private constructor() {
        this.contactsRepo = ContactsRepository.getInstance();
        this.studentsRepo = StudentsRepository.getInstance();
        this.phoneIndexRepo = PhoneIndexRepository.getInstance();
    }

    static getInstance(): IdentityService {
        if (!IdentityService.instance) {
            IdentityService.instance = new IdentityService();
        }
        return IdentityService.instance;
    }

    /**
     * Normalize phone number to E.164-like format
     * 
     * Examples:
     * - "+1 (809) 555-1234" -> "18095551234"
     * - "809-555-1234" -> "8095551234"
     * - "1-809-555-1234" -> "18095551234"
     * 
     * NOTE: This is a simplified normalization. For production,
     * consider using libphonenumber for proper country code handling.
     */
    normalizePhone(input: string): string {
        if (!input) return '';
        
        // Remove all non-digit characters except leading +
        let normalized = input.replace(/[^\d+]/g, '');
        
        // Remove leading + if present (we store digits only)
        if (normalized.startsWith('+')) {
            normalized = normalized.substring(1);
        }
        
        // Handle common Dominican Republic formats
        // If starts with 1809, 1829, or 1849, it's already normalized
        // If starts with 809, 829, or 849, prepend country code
        if (/^(809|829|849)/.test(normalized) && normalized.length === 10) {
            normalized = '1' + normalized;
        }
        
        return normalized;
    }

    /**
     * Extract phone number from WhatsApp JID
     * 
     * JID formats:
     * - Individual: "18095551234@s.whatsapp.net"
     * - Group: "123456789-1234567890@g.us"
     */
    jidToPhone(jid: string): string {
        if (!jid) return '';
        
        // Check if it's a group JID
        if (jid.includes('@g.us')) {
            return ''; // Groups don't have a phone number
        }
        
        // Extract digits before @
        const match = jid.match(/^(\d+)@/);
        return match ? match[1] : '';
    }

    /**
     * Convert phone to JID format
     */
    phoneToJid(phone: string): string {
        const normalized = this.normalizePhone(phone);
        return normalized ? `${normalized}@s.whatsapp.net` : '';
    }

    /**
     * Check if JID is a group
     */
    isGroupJid(jid: string): boolean {
        return jid.includes('@g.us');
    }

    /**
     * Check if JID is a broadcast list
     */
    isBroadcastJid(jid: string): boolean {
        return jid.includes('@broadcast');
    }

    /**
     * Link a phone number to a contact
     */
    async linkPhoneToContact(
        contactId: string, 
        phone: string, 
        source: 'manual' | 'whatsapp' | 'import' = 'manual'
    ): Promise<boolean> {
        const normalized = this.normalizePhone(phone);
        if (!normalized) return false;

        // Verify contact exists
        const contact = await this.contactsRepo.findById(contactId);
        if (!contact) return false;

        // Add to phone index
        await this.phoneIndexRepo.link(normalized, contactId, source);

        // Update contact's phones array if not already present
        if (!contact.phones.includes(normalized)) {
            await this.contactsRepo.update(contactId, {
                phones: [...contact.phones, normalized]
            });
        }

        return true;
    }

    /**
     * Unlink a phone from a contact
     */
    async unlinkPhone(phone: string): Promise<boolean> {
        const normalized = this.normalizePhone(phone);
        if (!normalized) return false;

        // Get current mapping
        const entry = await this.phoneIndexRepo.lookup(normalized);
        if (!entry) return false;

        // Remove from index
        await this.phoneIndexRepo.unlink(normalized);

        // Update contact's phones array
        const contact = await this.contactsRepo.findById(entry.contactId);
        if (contact) {
            await this.contactsRepo.update(entry.contactId, {
                phones: contact.phones.filter(p => p !== normalized)
            });
        }

        return true;
    }

    /**
     * Resolve a message sender (from JID) to contact and students
     * 
     * This is the main method used when processing incoming messages
     * to identify who sent the message and their related students.
     */
    async resolveSender(jid: string): Promise<SenderResolution> {
        const phone = this.jidToPhone(jid);
        
        // Default result for unknown sender
        const result: SenderResolution = {
            phone,
            studentIds: [],
            isKnown: false
        };

        if (!phone) {
            return result; // Group or invalid JID
        }

        // Try to find in phone index first (fast lookup)
        const indexed = await this.phoneIndexRepo.lookup(phone);
        
        if (indexed) {
            const contact = await this.contactsRepo.findById(indexed.contactId);
            if (contact) {
                result.contactId = contact.id;
                result.isKnown = true;
                result.studentIds = contact.studentIds;
                result.contact = {
                    id: contact.id,
                    firstName: contact.firstName,
                    lastName: contact.lastName,
                    displayName: contact.displayName,
                    type: contact.type
                };
                return result;
            }
        }

        // Fallback: search contacts by phone (slower)
        const contact = await this.contactsRepo.findByPhone(phone);
        if (contact) {
            result.contactId = contact.id;
            result.isKnown = true;
            result.studentIds = contact.studentIds;
            result.contact = {
                id: contact.id,
                firstName: contact.firstName,
                lastName: contact.lastName,
                displayName: contact.displayName,
                type: contact.type
            };

            // Index for future fast lookups
            await this.phoneIndexRepo.link(phone, contact.id, 'whatsapp');
        }

        return result;
    }

    /**
     * Get students for a contact
     */
    async getContactStudents(contactId: string): Promise<Array<{
        id: string;
        firstName: string;
        lastName: string;
        status: string;
    }>> {
        const students = await this.studentsRepo.findByContactId(contactId);
        return students.map(s => ({
            id: s.id,
            firstName: s.firstName,
            lastName: s.lastName,
            status: s.status
        }));
    }

    /**
     * Link a WhatsApp JID to a contact
     */
    async linkJidToContact(contactId: string, jid: string): Promise<boolean> {
        const phone = this.jidToPhone(jid);
        if (!phone) return false;

        // Update contact with WhatsApp JID
        await this.contactsRepo.update(contactId, {
            whatsappJid: jid,
            whatsappVerified: true
        });

        // Also link the phone
        return this.linkPhoneToContact(contactId, phone, 'whatsapp');
    }

    /**
     * Find contact by JID
     */
    async findContactByJid(jid: string): Promise<SenderResolution> {
        return this.resolveSender(jid);
    }

    /**
     * Rebuild phone index from all contacts
     */
    async rebuildPhoneIndex(): Promise<{ indexed: number; duplicates: string[] }> {
        const contacts = await this.contactsRepo.findAll();
        const contactData = contacts.map(c => ({
            id: c.id,
            phones: c.phones
        }));
        
        return this.phoneIndexRepo.rebuildFromContacts(contactData);
    }

    /**
     * Format phone for display
     */
    formatPhoneForDisplay(phone: string): string {
        const digits = this.normalizePhone(phone);
        
        // Format for DR numbers (1-809-XXX-XXXX)
        if (digits.length === 11 && digits.startsWith('1')) {
            const area = digits.substring(1, 4);
            const first = digits.substring(4, 7);
            const last = digits.substring(7);
            return `+1 (${area}) ${first}-${last}`;
        }
        
        // Format for 10-digit numbers
        if (digits.length === 10) {
            const area = digits.substring(0, 3);
            const first = digits.substring(3, 6);
            const last = digits.substring(6);
            return `(${area}) ${first}-${last}`;
        }
        
        // Default: just add + prefix
        return `+${digits}`;
    }
}

export default IdentityService;
