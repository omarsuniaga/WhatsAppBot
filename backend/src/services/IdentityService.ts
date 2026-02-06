/**
 * IdentityService - Phone normalization and contact/student resolution
 * 
 * Domain service for identity resolution. No HTTP/UI dependencies.
 */

import { EventEmitter } from 'events';
import { Contact, Student } from '../domain/types';
import { ContactsRepo, StudentsRepo } from '../repos';

export class IdentityService extends EventEmitter {
    private static instance: IdentityService;
    private contactsRepo = ContactsRepo.getInstance();
    private studentsRepo = StudentsRepo.getInstance();

    private constructor() {
        super();
    }

    public static getInstance(): IdentityService {
        if (!IdentityService.instance) {
            IdentityService.instance = new IdentityService();
        }
        return IdentityService.instance;
    }

    /**
     * Normalizes a phone number to a standard format.
     * Removes non-digit characters.
     * @param input - The phone number to normalize.
     * @returns The normalized phone number.
     */
    normalizePhone(input: string): string {
        return input.replace(/\D/g, '');
    }

    /**
     * Extracts a phone number from a WhatsApp JID.
     * @param jid - The JID (e.g., "1234567890@s.whatsapp.net").
     * @returns The phone number or null if not a valid JID.
     */
    jidToPhone(jid: string): string | null {
        if (!jid.includes('@')) {
            return null;
        }
        return this.normalizePhone(jid.split('@')[0]);
    }

    /**
     * Resolves a contact by their phone number.
     * @param phone - The normalized phone number.
     * @returns The contact or null if not found.
     */
    async resolveContactByPhone(phone: string): Promise<Contact | null> {
        const normalizedPhone = this.normalizePhone(phone);
        const contact = await this.contactsRepo.findOne(c => 
            c.phones.includes(normalizedPhone) || 
            c.preferredPhone === normalizedPhone
        );
        if (contact) {
            this.emit('contact:resolved', contact);
        }
        return contact;
    }

    /**
     * Resolves the context of a sender from their JID.
     * Finds the associated contact and any students linked to that contact.
     * @param jid - The sender's WhatsApp JID.
     * @returns An object with the contact and a list of students.
     */
    async resolveSenderContext(jid: string): Promise<{ contact?: Contact, students: Student[] }> {
        const phone = this.jidToPhone(jid);
        if (!phone) {
            return { students: [] };
        }

        const contact = await this.resolveContactByPhone(phone);
        if (!contact) {
            return { students: [] };
        }

        const students = await this.studentsRepo.find(s => contact.studentIds.includes(s.id));
        const context = { contact, students };
        this.emit('sender:context:resolved', context);
        return context;
    }

    /**
     * Links a contact to a student.
     * @param studentId - The ID of the student.
     * @param contactId - The ID of the contact.
     * @param relation - The relationship (e.g., 'mother', 'father'). Not used yet.
     * @param primary - Whether this is the primary contact. Not used yet.
     */
    async linkContactToStudent(
        studentId: string, 
        contactId: string, 
        _relation: string, 
        _primary: boolean
    ): Promise<void> {
        const student = await this.studentsRepo.getById(studentId);
        const contact = await this.contactsRepo.getById(contactId);

        if (!student || !contact) {
            throw new Error('Student or Contact not found');
        }

        let studentUpdated = false;
        let contactUpdated = false;

        // Avoid duplicates
        if (!student.contactIds.includes(contactId)) {
            studentUpdated = true;
            await this.studentsRepo.upsert({
                ...student,
                contactIds: [...student.contactIds, contactId]
            });
        }

        if (!contact.studentIds.includes(studentId)) {
            contactUpdated = true;
            await this.contactsRepo.upsert({
                ...contact,
                studentIds: [...contact.studentIds, studentId]
            });
        }

        if (studentUpdated || contactUpdated) {
            this.emit('contact:student:linked', { studentId, contactId });
        }
    }
}

export default IdentityService;
