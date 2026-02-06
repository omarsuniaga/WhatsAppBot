/**
 * ContactStoreService - Persistent Contact Display Names
 * 
 * Stores and retrieves display names (pushName) for WhatsApp contacts.
 * pushName arrives per message, not as stable profile data, so we persist it
 * to provide consistent display names across sessions.
 * 
 * CRITICAL: Uses toStableKey() from jidUtils for ALL lookups.
 * This ensures consistent keys regardless of JID format variations.
 */

import * as fs from 'fs';
import * as path from 'path';
import { toStableKey, extractPhoneNumber as extractPhone, isGroupJid } from '../utils/jidUtils';

interface ContactEntry {
    displayName: string;
    updatedAt: string;      // ISO timestamp
    source: 'pushName' | 'manual' | 'profile';  // Where the name came from
}

interface ContactStoreData {
    version: number;
    contacts: Record<string, ContactEntry>;
}

class ContactStoreService {
    private static instance: ContactStoreService;
    private contacts: Map<string, ContactEntry> = new Map();
    private dataDir: string;
    private dataFile: string;
    private saveTimeout: NodeJS.Timeout | null = null;
    private readonly SAVE_DELAY_MS = 2000; // Debounce saves

    private constructor() {
        this.dataDir = path.join(process.cwd(), 'data');
        this.dataFile = path.join(this.dataDir, 'contacts.json');
        this.ensureDataDir();
        this.loadFromDisk();
    }

    static getInstance(): ContactStoreService {
        if (!ContactStoreService.instance) {
            ContactStoreService.instance = new ContactStoreService();
        }
        return ContactStoreService.instance;
    }

    private ensureDataDir(): void {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
    }

    private loadFromDisk(): void {
        try {
            if (fs.existsSync(this.dataFile)) {
                const data = fs.readFileSync(this.dataFile, 'utf-8');
                const store: ContactStoreData = JSON.parse(data);
                
                for (const [jid, entry] of Object.entries(store.contacts)) {
                    this.contacts.set(jid, entry);
                }
                
                console.log(`[ContactStore] Loaded ${this.contacts.size} contacts`);
            }
        } catch (error) {
            console.error('[ContactStore] Error loading contacts:', error);
        }
    }

    private scheduleSave(): void {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        
        this.saveTimeout = setTimeout(() => {
            this.saveToDisk();
        }, this.SAVE_DELAY_MS);
    }

    private saveToDisk(): void {
        try {
            const store: ContactStoreData = {
                version: 1,
                contacts: Object.fromEntries(this.contacts)
            };
            
            fs.writeFileSync(this.dataFile, JSON.stringify(store, null, 2));
        } catch (error) {
            console.error('[ContactStore] Error saving contacts:', error);
        }
    }

    /**
     * Get stable key for a JID using centralized jidUtils.
     * Delegates to toStableKey() for consistency.
     */
    private getStableKey(jid: string): string | null {
        return toStableKey(jid);
    }

    /**
     * Extract phone number using centralized jidUtils.
     */
    extractPhoneNumber(jid: string): string | null {
        return extractPhone(jid);
    }

    /**
     * Check if a pushName is valid and worth storing.
     * 
     * Filters out:
     * - Empty or whitespace-only names
     * - Very short names (< 2 chars) like "." or "-"
     * - Names that are only numbers (likely phone numbers)
     * - Names that look like spam/garbage
     */
    isValidDisplayName(name: string | undefined | null): boolean {
        if (!name || typeof name !== 'string') {
            return false;
        }

        const trimmed = name.trim();

        // Too short
        if (trimmed.length < 2) {
            return false;
        }

        // Only numbers (probably a phone number, not a real name)
        if (/^\d+$/.test(trimmed)) {
            return false;
        }

        // Only special characters
        if (/^[.\-_+*#@!?]+$/.test(trimmed)) {
            return false;
        }

        // Excessively long (likely spam)
        if (trimmed.length > 100) {
            return false;
        }

        return true;
    }

    /**
     * Store or update a contact's display name.
     * Only updates if the new name is valid and different.
     * 
     * @param jid - Raw JID from message
     * @param displayName - pushName or other name source
     * @param source - Where the name came from
     * @returns true if stored/updated, false if rejected
     */
    setDisplayName(
        jid: string, 
        displayName: string, 
        source: 'pushName' | 'manual' | 'profile' = 'pushName'
    ): boolean {
        if (!this.isValidDisplayName(displayName)) {
            return false;
        }

        const normalizedJid = this.getStableKey(jid);
        if (!normalizedJid) {
            return false;
        }

        const trimmedName = displayName.trim();
        const existing = this.contacts.get(normalizedJid);

        // Skip if same name already stored
        if (existing && existing.displayName === trimmedName) {
            return false;
        }

        // Don't overwrite manual names with pushName
        if (existing && existing.source === 'manual' && source === 'pushName') {
            return false;
        }

        const entry: ContactEntry = {
            displayName: trimmedName,
            updatedAt: new Date().toISOString(),
            source
        };

        this.contacts.set(normalizedJid, entry);
        this.scheduleSave();

        console.log(`[ContactStore] ✓ Stored "${trimmedName}" for key=${normalizedJid} (raw jid=${jid})`);
        return true;
    }

    /**
     * Get the display name for a JID.
     * 
     * @param jid - Raw JID
     * @returns Display name or null if not found
     */
    getDisplayName(jid: string): string | null {
        const normalizedJid = this.getStableKey(jid);
        if (!normalizedJid) {
            return null;
        }

        const entry = this.contacts.get(normalizedJid);
        if (entry) {
            return entry.displayName;
        }
        
        // Debug: log when lookup fails
        console.log(`[ContactStore] Lookup miss for key=${normalizedJid} (raw=${jid}), stored keys: ${this.contacts.size}`);
        return null;
    }

    /**
     * Get display name with fallback chain.
     * 
     * Fallback order:
     * 1. Stored display name (from pushName/manual)
     * 2. Provided fallback name (e.g., from Baileys contact)
     * 3. Formatted phone number
     * 
     * @param jid - Raw JID
     * @param fallbackName - Optional fallback from other source
     * @returns Best available display name
     */
    getDisplayNameWithFallback(jid: string, fallbackName?: string): string {
        const normalizedKey = this.getStableKey(jid);
        
        // 1. Try stored name
        const storedName = this.getDisplayName(jid);
        if (storedName) {
            console.log(`[ContactStore] ✓ Found stored name for ${normalizedKey}: "${storedName}"`);
            return storedName;
        }

        // 2. Try provided fallback (if valid)
        if (this.isValidDisplayName(fallbackName)) {
            console.log(`[ContactStore] Using fallback name for ${normalizedKey}: "${fallbackName}"`);
            return fallbackName!.trim();
        }

        // 3. Format phone number from normalized key
        const phoneNumber = this.extractPhoneNumber(jid);
        if (phoneNumber) {
            console.log(`[ContactStore] No name found for ${normalizedKey}, using phone: +${phoneNumber}`);
            return `+${phoneNumber}`;
        }

        // Last resort: return normalized key or original
        console.log(`[ContactStore] No name/phone for ${jid}, returning as-is`);
        return normalizedKey || jid;
    }

    /**
     * Get the full contact entry (for debugging/export).
     */
    getContactEntry(jid: string): ContactEntry | null {
        const normalizedJid = this.getStableKey(jid);
        if (!normalizedJid) return null;
        return this.contacts.get(normalizedJid) || null;
    }

    /**
     * Get all stored contacts (for debugging/export).
     */
    getAllContacts(): Map<string, ContactEntry> {
        return new Map(this.contacts);
    }

    /**
     * Get count of stored contacts.
     */
    getCount(): number {
        return this.contacts.size;
    }

    /**
     * Clear a specific contact (for testing).
     */
    clearContact(jid: string): void {
        const normalizedJid = this.getStableKey(jid);
        if (!normalizedJid) return;
        this.contacts.delete(normalizedJid);
        this.scheduleSave();
    }

    /**
     * Force save to disk (for shutdown).
     */
    forceSave(): void {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.saveToDisk();
    }
}

export default ContactStoreService;
