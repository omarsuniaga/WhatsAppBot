/**
 * JID Normalization Utilities
 * 
 * Uses native Baileys functions for robust JID handling.
 * 
 * WhatsApp JID formats:
 * - 5491155551234@s.whatsapp.net (standard individual)
 * - 5491155551234@c.us (legacy individual)
 * - 5491155551234@lid (linked device ID)
 * - 5491155551234:45@lid (linked device with suffix)
 * - 120363123456789@g.us (group)
 * - status@broadcast (broadcast)
 * 
 * Two normalization functions:
 * 1. normalizeRawJid() - For Baileys API calls (returns valid WhatsApp JID)
 * 2. toStableKey() - For internal maps (consistent key format)
 */

import {
    jidDecode,
    jidEncode,
    jidNormalizedUser,
    isJidGroup,
    isJidBroadcast,
    isJidStatusBroadcast,
    isLidUser,
    areJidsSameUser,
    S_WHATSAPP_NET
} from '@whiskeysockets/baileys';

/** Standard WhatsApp domain for contacts */
const WHATSAPP_DOMAIN = 's.whatsapp.net';
const GROUP_DOMAIN = 'g.us';

/**
 * Extract phone number from any JID format using Baileys jidDecode.
 * Handles malformed inputs safely.
 * 
 * @param jid - Raw JID string
 * @returns Phone number digits or null if not extractable
 */
export function extractPhoneNumber(jid: string | null | undefined): string | null {
    if (!jid || typeof jid !== 'string') {
        return null;
    }

    try {
        // Use Baileys jidDecode for proper parsing
        const decoded = jidDecode(jid);
        if (decoded?.user) {
            // Remove any device suffix (e.g., "123:45" -> "123")
            const user = decoded.user.split(':')[0];
            // Only return if it looks like a phone number (all digits)
            if (/^\d+$/.test(user)) {
                return user;
            }
        }
    } catch {
        // Fallback to regex extraction if jidDecode fails
    }

    // Fallback: Extract leading digits manually
    const cleaned = jid.toLowerCase().trim();
    
    // Groups don't have phone numbers
    if (cleaned.includes('@g.us')) {
        return null;
    }

    const match = cleaned.match(/^(\d+)/);
    return match ? match[1] : null;
}

/**
 * Extract group ID from a group JID using Baileys jidDecode.
 * 
 * @param jid - Raw JID string
 * @returns Group ID or null if not a group
 */
export function extractGroupId(jid: string | null | undefined): string | null {
    if (!jid || typeof jid !== 'string') {
        return null;
    }

    try {
        // Use Baileys isJidGroup for proper detection
        if (!isJidGroup(jid)) {
            return null;
        }
        
        const decoded = jidDecode(jid);
        if (decoded?.user) {
            return decoded.user;
        }
    } catch {
        // Fallback to regex extraction
    }

    // Fallback: Extract manually
    const cleaned = jid.toLowerCase().trim();
    const match = cleaned.match(/^([^@]+)@g\.us/);
    return match ? match[1] : null;
}

/**
 * Check if a JID is a group using native Baileys function.
 */
export function isGroupJid(jid: string | null | undefined): boolean {
    if (!jid || typeof jid !== 'string') {
        return false;
    }
    try {
        return isJidGroup(jid) === true;
    } catch {
        return jid.toLowerCase().includes('@g.us');
    }
}

/**
 * Check if a JID is a broadcast using native Baileys function.
 */
export function isBroadcastJid(jid: string | null | undefined): boolean {
    if (!jid || typeof jid !== 'string') {
        return false;
    }
    try {
        return isJidBroadcast(jid) || isJidStatusBroadcast(jid);
    } catch {
        return jid.toLowerCase().includes('@broadcast');
    }
}

/**
 * Check if a JID is a LID (Linked ID) user.
 */
export function isLidJid(jid: string | null | undefined): boolean {
    if (!jid || typeof jid !== 'string') {
        return false;
    }
    try {
        return isLidUser(jid) === true;
    } catch {
        return jid.toLowerCase().includes('@lid');
    }
}

/**
 * Check if two JIDs belong to the same user using native Baileys function.
 * Useful for comparing JIDs across different formats (@lid, @s.whatsapp.net, @c.us).
 */
export function areSameUser(jid1: string | null | undefined, jid2: string | null | undefined): boolean {
    if (!jid1 || !jid2) {
        return false;
    }
    try {
        return areJidsSameUser(jid1, jid2);
    } catch {
        // Fallback: compare phone numbers
        const phone1 = extractPhoneNumber(jid1);
        const phone2 = extractPhoneNumber(jid2);
        return phone1 !== null && phone1 === phone2;
    }
}

/**
 * Normalize a raw JID to a valid Baileys-compatible format.
 * Uses native Baileys jidNormalizedUser when possible.
 * 
 * USE THIS when you need to:
 * - Send messages via Baileys
 * - Call Baileys API methods
 * - Store JIDs that will be used with Baileys later
 * 
 * @param jid - Raw JID from any source
 * @returns Valid Baileys JID or null if invalid
 */
export function normalizeRawJid(jid: string | null | undefined): string | null {
    if (!jid || typeof jid !== 'string') {
        return null;
    }

    const cleaned = jid.trim();

    try {
        // Try native Baileys normalization first
        const normalized = jidNormalizedUser(cleaned);
        if (normalized) {
            return normalized;
        }
    } catch {
        // Continue with manual normalization
    }

    // Handle groups
    if (isGroupJid(cleaned)) {
        const groupId = extractGroupId(cleaned);
        if (groupId) {
            return `${groupId}@${GROUP_DOMAIN}`;
        }
        return null;
    }

    // Handle broadcast
    if (isBroadcastJid(cleaned)) {
        return cleaned.toLowerCase();
    }

    // Handle individual contacts - try jidDecode first
    try {
        const decoded = jidDecode(cleaned);
        if (decoded?.user) {
            // Remove device suffix and encode properly
            const user = decoded.user.split(':')[0];
            if (/^\d+$/.test(user)) {
                return jidEncode(user, WHATSAPP_DOMAIN);
            }
        }
    } catch {
        // Continue with manual extraction
    }

    // Fallback: Extract phone number and build JID
    const phoneNumber = extractPhoneNumber(cleaned);
    if (phoneNumber) {
        return `${phoneNumber}@${WHATSAPP_DOMAIN}`;
    }

    console.warn(`[jidUtils] Could not normalize invalid JID: "${jid}"`);
    return null;
}

/**
 * Convert any JID to a stable internal key for Maps/lookups.
 * Uses native Baileys functions for robust parsing.
 * 
 * USE THIS when you need to:
 * - Store/retrieve from ContactStore
 * - Store/retrieve from ChatState
 * - Store/retrieve from ReadState
 * - Any internal map that tracks per-chat data
 * 
 * Format:
 * - Groups: "{groupId}@group"
 * - Contacts: "{phoneNumber}@contact"
 * - Broadcast: "broadcast"
 * 
 * @param jid - Raw JID from any source
 * @returns Stable key or null if invalid
 */
export function toStableKey(jid: string | null | undefined): string | null {
    if (!jid || typeof jid !== 'string') {
        return null;
    }

    const cleaned = jid.trim();

    // Groups - use Baileys isJidGroup
    if (isGroupJid(cleaned)) {
        const groupId = extractGroupId(cleaned);
        if (groupId) {
            return `${groupId}@group`;
        }
        return null;
    }

    // Broadcast - use Baileys isJidBroadcast
    if (isBroadcastJid(cleaned)) {
        return 'broadcast';
    }

    // Individual contact - try jidDecode first for accuracy
    try {
        const decoded = jidDecode(cleaned);
        if (decoded?.user) {
            const user = decoded.user.split(':')[0];
            if (/^\d+$/.test(user)) {
                return `${user}@contact`;
            }
        }
    } catch {
        // Continue with fallback
    }

    // Fallback: Extract phone number
    const phoneNumber = extractPhoneNumber(cleaned);
    if (phoneNumber) {
        return `${phoneNumber}@contact`;
    }

    console.warn(`[jidUtils] Could not create stable key for invalid JID: "${jid}"`);
    return null;
}

/**
 * Debug helper: Log JID normalization for troubleshooting.
 */
export function debugJid(context: string, rawJid: string | null | undefined): void {
    const stableKey = toStableKey(rawJid);
    const normalizedJid = normalizeRawJid(rawJid);
    console.log(`[JID:${context}] raw="${rawJid}" → stableKey="${stableKey}" normalizedJid="${normalizedJid}"`);
}

/**
 * Validate that a JID is properly formatted using Baileys jidDecode.
 * Use this to catch bugs like "@lidid" early.
 */
export function isValidJid(jid: string | null | undefined): boolean {
    if (!jid || typeof jid !== 'string') {
        return false;
    }

    const cleaned = jid.trim();

    // Check for obvious corruption patterns first
    const lowerCleaned = cleaned.toLowerCase();
    if (lowerCleaned.includes('@lid@') || 
        lowerCleaned.includes('@lidid') || 
        lowerCleaned.includes('@@') ||
        lowerCleaned.endsWith('@') ||
        lowerCleaned.startsWith('@')) {
        console.error(`[jidUtils] INVALID JID DETECTED: "${jid}"`);
        return false;
    }

    // Try to decode with Baileys - if it works, it's valid
    try {
        const decoded = jidDecode(cleaned);
        if (decoded?.user && decoded?.server) {
            return true;
        }
    } catch {
        // Continue with manual validation
    }

    // Fallback: Check structure manually
    const atCount = (lowerCleaned.match(/@/g) || []).length;
    if (atCount === 0 && !lowerCleaned.includes('broadcast')) {
        return false;
    }
    
    // Must be able to extract something useful
    return extractPhoneNumber(cleaned) !== null || 
           extractGroupId(cleaned) !== null || 
           isBroadcastJid(cleaned);
}

/**
 * Get decoded JID information using Baileys jidDecode.
 * Returns user, server, and device information.
 */
export function getJidInfo(jid: string | null | undefined): {
    user: string | null;
    server: string | null;
    device: number | null;
    isGroup: boolean;
    isBroadcast: boolean;
    isLid: boolean;
} {
    const defaultResult = {
        user: null,
        server: null,
        device: null,
        isGroup: false,
        isBroadcast: false,
        isLid: false
    };

    if (!jid || typeof jid !== 'string') {
        return defaultResult;
    }

    try {
        const decoded = jidDecode(jid);
        return {
            user: decoded?.user || null,
            server: decoded?.server || null,
            device: decoded?.device ?? null,
            isGroup: isGroupJid(jid),
            isBroadcast: isBroadcastJid(jid),
            isLid: isLidJid(jid)
        };
    } catch {
        return {
            ...defaultResult,
            isGroup: isGroupJid(jid),
            isBroadcast: isBroadcastJid(jid),
            isLid: isLidJid(jid)
        };
    }
}

/**
 * Re-export native Baileys functions for convenience.
 * This allows other modules to import everything from jidUtils.
 */
export { 
    jidDecode, 
    jidEncode, 
    jidNormalizedUser,
    areJidsSameUser,
    S_WHATSAPP_NET 
};
