/**
 * Chat Title Utilities
 * Provides consistent naming logic for WhatsApp chats across the app.
 */

import type { Chat } from '../types';

/**
 * Check if a string looks like a phone number (mostly digits)
 */
const looksLikePhoneNumber = (str: string): boolean => {
    if (!str) return false;
    // Remove common separators and check if remaining is mostly digits
    const cleaned = str.replace(/[\s\-\+\(\)]/g, '');
    return /^\d{7,}$/.test(cleaned);
};

/**
 * Check if a name is a valid human-readable name (not junk)
 */
const isValidName = (name: string | undefined): name is string => {
    if (!name || !name.trim()) return false;
    const trimmed = name.trim();
    // Reject "Unknown", pure numbers, or very short names
    if (trimmed === 'Unknown' || trimmed === 'unknown') return false;
    if (looksLikePhoneNumber(trimmed)) return false;
    if (trimmed.length < 2) return false;
    return true;
};

/**
 * Format a JID to a readable phone number
 */
const formatPhoneFromJid = (jid: string): string => {
    const phoneNumber = jid.split('@')[0];
    // Add + prefix if it's a valid phone number
    if (/^\d+$/.test(phoneNumber)) {
        return `+${phoneNumber}`;
    }
    return phoneNumber;
};

/**
 * Detect if a chat is a group chat
 */
export const isGroupChat = (chat: Chat): boolean => {
    return chat.isGroup ?? chat.jid.endsWith('@g.us');
};

/**
 * Get the best display title for a chat.
 * 
 * Rules:
 * - Group chats: prefer chat.name (group subject) > displayName > 'Grupo'
 * - Individual chats: prefer displayName (pushName) > valid chat.name > formatted phone
 * 
 * @param chat - The chat object
 * @returns The best title to display
 */
export const getChatTitle = (chat: Chat): string => {
    const isGroup = isGroupChat(chat);

    if (isGroup) {
        // For groups: prefer the group subject (chat.name)
        if (isValidName(chat.name)) {
            return chat.name.trim();
        }
        // Fallback to displayName if available
        if (isValidName(chat.displayName)) {
            return chat.displayName.trim();
        }
        // Last resort for groups
        return 'Grupo';
    } else {
        // For individual chats: prefer displayName (from pushName/ContactStore)
        if (isValidName(chat.displayName)) {
            return chat.displayName.trim();
        }
        // Use chat.name if it looks like a real name (not a phone number)
        if (isValidName(chat.name)) {
            return chat.name.trim();
        }
        // Format phone number as fallback
        return formatPhoneFromJid(chat.jid);
    }
};

/**
 * Get display name for a message sender in a group chat.
 * 
 * @param sender - The sender object with jid, name, displayName
 * @returns The best name to display for the sender
 */
export const getSenderDisplayName = (sender: { jid?: string; name?: string; displayName?: string } | undefined): string => {
    if (!sender) return '';

    // Prefer displayName
    if (isValidName(sender.displayName)) {
        return sender.displayName.trim();
    }

    // Use name if valid
    if (isValidName(sender.name)) {
        return sender.name.trim();
    }

    // Format phone from jid as fallback
    if (sender.jid) {
        return formatPhoneFromJid(sender.jid);
    }

    return '';
};
