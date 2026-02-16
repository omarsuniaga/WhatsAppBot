import { existsSync, readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { writeFileSyncAtomic } from '../utils/atomicWrite';
import { ContactGroup, ContactGroupsData, ContactGroupContact } from '../types';

const DATA_PATH = join(process.cwd(), 'data', 'contact-groups.json');

// Default colors for groups
const DEFAULT_COLORS = [
    '#4CAF50', // Green
    '#2196F3', // Blue
    '#FF9800', // Orange
    '#9C27B0', // Purple
    '#F44336', // Red
    '#00BCD4', // Cyan
    '#E91E63', // Pink
    '#795548'  // Brown
];

class ContactGroupService {
    private static instance: ContactGroupService;
    private data: ContactGroupsData;

    private constructor() {
        this.data = this.loadData();
    }

    static getInstance(): ContactGroupService {
        if (!ContactGroupService.instance) {
            ContactGroupService.instance = new ContactGroupService();
        }
        return ContactGroupService.instance;
    }

    private getDefaultData(): ContactGroupsData {
        return {
            version: 1,
            lastUpdated: new Date().toISOString(),
            groups: []
        };
    }

    private loadData(): ContactGroupsData {
        try {
            if (existsSync(DATA_PATH)) {
                return JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
            }
        } catch (error) {
            console.error('Error loading contact groups:', error);
        }
        return this.getDefaultData();
    }

    private saveData(): void {
        try {
            const dir = dirname(DATA_PATH);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
            this.data.lastUpdated = new Date().toISOString();
            writeFileSyncAtomic(DATA_PATH, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error('Error saving contact groups:', error);
        }
    }

    private getNextColor(): string {
        const usedColors = this.data.groups.map((g) => g.color);
        const available = DEFAULT_COLORS.filter((c) => !usedColors.includes(c));
        return available.length > 0
            ? available[0]
            : DEFAULT_COLORS[this.data.groups.length % DEFAULT_COLORS.length];
    }

    // ==========================================
    // CRUD Operations for Groups
    // ==========================================

    /**
     * Get all groups
     */
    getAllGroups(): ContactGroup[] {
        return this.data.groups;
    }

    /**
     * Get a group by ID
     */
    getGroupById(id: string): ContactGroup | undefined {
        return this.data.groups.find((g) => g.id === id);
    }

    /**
     * Create a new group
     */
    createGroup(name: string, description?: string, color?: string): ContactGroup {
        const group: ContactGroup = {
            id: uuidv4(),
            name: name.trim(),
            description: description?.trim(),
            color: color || this.getNextColor(),
            contacts: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.data.groups.push(group);
        this.saveData();

        console.log(`[ContactGroups] Created group: ${group.name}`);

        return group;
    }

    /**
     * Update a group
     */
    updateGroup(
        id: string,
        updates: Partial<Pick<ContactGroup, 'name' | 'description' | 'color'>>
    ): ContactGroup | null {
        const group = this.getGroupById(id);
        if (!group) return null;

        if (updates.name !== undefined) group.name = updates.name.trim();
        if (updates.description !== undefined) group.description = updates.description?.trim();
        if (updates.color !== undefined) group.color = updates.color;

        group.updatedAt = new Date().toISOString();
        this.saveData();

        console.log(`[ContactGroups] Updated group: ${group.name}`);

        return group;
    }

    /**
     * Delete a group
     */
    deleteGroup(id: string): boolean {
        const index = this.data.groups.findIndex((g) => g.id === id);
        if (index === -1) return false;

        const group = this.data.groups[index];
        this.data.groups.splice(index, 1);
        this.saveData();

        console.log(`[ContactGroups] Deleted group: ${group.name}`);

        return true;
    }

    // ==========================================
    // Contact Management within Groups
    // ==========================================

    /**
     * Add a single contact to a group
     */
    addContact(groupId: string, jid: string, name: string): ContactGroup | null {
        const group = this.getGroupById(groupId);
        if (!group) return null;

        // Normalize JID
        const normalizedJid = this.normalizeJid(jid);

        // Avoid duplicates
        if (group.contacts.some((c) => c.jid === normalizedJid)) {
            return group;
        }

        group.contacts.push({
            jid: normalizedJid,
            name: name.trim(),
            addedAt: new Date().toISOString()
        });

        group.updatedAt = new Date().toISOString();
        this.saveData();

        console.log(`[ContactGroups] Added ${name} to ${group.name}`);

        return group;
    }

    /**
     * Add multiple contacts to a group
     */
    addContacts(
        groupId: string,
        contacts: { jid: string; name: string }[]
    ): ContactGroup | null {
        const group = this.getGroupById(groupId);
        if (!group) return null;

        let addedCount = 0;

        for (const contact of contacts) {
            const normalizedJid = this.normalizeJid(contact.jid);

            if (!group.contacts.some((c) => c.jid === normalizedJid)) {
                group.contacts.push({
                    jid: normalizedJid,
                    name: contact.name.trim(),
                    addedAt: new Date().toISOString()
                });
                addedCount++;
            }
        }

        if (addedCount > 0) {
            group.updatedAt = new Date().toISOString();
            this.saveData();
            console.log(`[ContactGroups] Added ${addedCount} contacts to ${group.name}`);
        }

        return group;
    }

    /**
     * Remove a contact from a group
     */
    removeContact(groupId: string, jid: string): ContactGroup | null {
        const group = this.getGroupById(groupId);
        if (!group) return null;

        const normalizedJid = this.normalizeJid(jid);
        const initialCount = group.contacts.length;

        group.contacts = group.contacts.filter((c) => c.jid !== normalizedJid);

        if (group.contacts.length < initialCount) {
            group.updatedAt = new Date().toISOString();
            this.saveData();
            console.log(`[ContactGroups] Removed contact from ${group.name}`);
        }

        return group;
    }

    /**
     * Get all contacts in a group
     */
    getGroupContacts(groupId: string): ContactGroupContact[] {
        const group = this.getGroupById(groupId);
        return group?.contacts || [];
    }

    /**
     * Get all groups that contain a specific contact
     */
    getGroupsForContact(jid: string): ContactGroup[] {
        const normalizedJid = this.normalizeJid(jid);
        return this.data.groups.filter((g) =>
            g.contacts.some((c) => c.jid === normalizedJid)
        );
    }

    /**
     * Get JIDs of all contacts in a group (for bulk sending)
     */
    getGroupJids(groupId: string): string[] {
        const group = this.getGroupById(groupId);
        return group?.contacts.map((c) => c.jid) || [];
    }

    // ==========================================
    // Utility Methods
    // ==========================================

    /**
     * Normalize a phone number to WhatsApp JID format
     */
    private normalizeJid(input: string): string {
        // If already a valid JID, return as-is
        if (input.includes('@s.whatsapp.net') || input.includes('@c.us')) {
            return input;
        }

        // Remove all non-numeric characters except +
        let cleaned = input.replace(/[^\d+]/g, '');

        // Remove leading + if present
        if (cleaned.startsWith('+')) {
            cleaned = cleaned.substring(1);
        }

        // Return as WhatsApp JID
        return `${cleaned}@s.whatsapp.net`;
    }

    /**
     * Search groups by name
     */
    searchGroups(query: string): ContactGroup[] {
        const lowerQuery = query.toLowerCase();
        return this.data.groups.filter(
            (g) =>
                g.name.toLowerCase().includes(lowerQuery) ||
                g.description?.toLowerCase().includes(lowerQuery)
        );
    }

    /**
     * Get group statistics
     */
    getStats(): { totalGroups: number; totalContacts: number; avgContactsPerGroup: number } {
        const totalGroups = this.data.groups.length;
        const totalContacts = this.data.groups.reduce((sum, g) => sum + g.contacts.length, 0);
        const avgContactsPerGroup = totalGroups > 0 ? totalContacts / totalGroups : 0;

        return {
            totalGroups,
            totalContacts,
            avgContactsPerGroup: Math.round(avgContactsPerGroup * 10) / 10
        };
    }
}

export default ContactGroupService;
