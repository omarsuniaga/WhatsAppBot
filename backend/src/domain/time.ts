/**
 * Domain Time Helpers - Timestamp utilities
 * El Sistema Punta Cana - Institutional WhatsApp Bot
 * 
 * Convention: All timestamps are Unix seconds (not milliseconds)
 */

// ==========================================
// TIMESTAMP HELPERS
// ==========================================

/**
 * Get current Unix timestamp in seconds
 */
export const now = (): number => {
    return Math.floor(Date.now() / 1000);
};

/**
 * Convert Date to Unix seconds
 */
export const toUnix = (date: Date): number => {
    return Math.floor(date.getTime() / 1000);
};

/**
 * Convert Unix seconds to Date
 */
export const fromUnix = (unix: number): Date => {
    return new Date(unix * 1000);
};

/**
 * Convert Unix seconds to ISO string
 */
export const toISO = (unix: number): string => {
    return fromUnix(unix).toISOString();
};

/**
 * Convert ISO string to Unix seconds
 */
export const fromISO = (iso: string): number => {
    return toUnix(new Date(iso));
};

// ==========================================
// DATE FORMATTING
// ==========================================

/**
 * Format Unix timestamp to YYYY-MM-DD
 */
export const toDateString = (unix: number): string => {
    return fromUnix(unix).toISOString().split('T')[0];
};

/**
 * Format Unix timestamp to HH:mm
 */
export const toTimeString = (unix: number): string => {
    const date = fromUnix(unix);
    return date.toTimeString().slice(0, 5);
};

/**
 * Format Unix timestamp to locale string
 */
export const toLocaleString = (unix: number, locale: string = 'es-DO'): string => {
    return fromUnix(unix).toLocaleString(locale);
};

/**
 * Format Unix timestamp to locale date
 */
export const toLocaleDateString = (unix: number, locale: string = 'es-DO'): string => {
    return fromUnix(unix).toLocaleDateString(locale);
};

/**
 * Format Unix timestamp to locale time
 */
export const toLocaleTimeString = (unix: number, locale: string = 'es-DO'): string => {
    return fromUnix(unix).toLocaleTimeString(locale);
};

// ==========================================
// DATE CALCULATIONS
// ==========================================

/**
 * Get start of day in Unix seconds
 */
export const startOfDay = (unix: number): number => {
    const date = fromUnix(unix);
    date.setHours(0, 0, 0, 0);
    return toUnix(date);
};

/**
 * Get end of day in Unix seconds
 */
export const endOfDay = (unix: number): number => {
    const date = fromUnix(unix);
    date.setHours(23, 59, 59, 999);
    return toUnix(date);
};

/**
 * Add days to Unix timestamp
 */
export const addDays = (unix: number, days: number): number => {
    return unix + (days * 24 * 60 * 60);
};

/**
 * Subtract days from Unix timestamp
 */
export const subtractDays = (unix: number, days: number): number => {
    return unix - (days * 24 * 60 * 60);
};

/**
 * Get days between two Unix timestamps
 */
export const daysBetween = (start: number, end: number): number => {
    return Math.floor((end - start) / (24 * 60 * 60));
};

/**
 * Check if Unix timestamp is today
 */
export const isToday = (unix: number): boolean => {
    const today = toDateString(now());
    const target = toDateString(unix);
    return today === target;
};

/**
 * Get today's date string (YYYY-MM-DD)
 */
export const today = (): string => {
    return toDateString(now());
};

// ==========================================
// AUDIT FIELDS
// ==========================================

/**
 * Create audit timestamps for new entity
 */
export const createAuditTimestamps = (): { createdAt: number; updatedAt: number } => {
    const timestamp = now();
    return {
        createdAt: timestamp,
        updatedAt: timestamp
    };
};

/**
 * Update audit timestamp
 */
export const updateAuditTimestamp = (): { updatedAt: number } => {
    return {
        updatedAt: now()
    };
};
