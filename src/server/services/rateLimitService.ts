import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import {
    RateLimitData,
    RateLimitStatus,
    RateLimitHistoryEntry,
    WarningLevel,
    TargetType
} from '../types';

const DATA_PATH = join(process.cwd(), 'data', 'rate-limits.json');

// Conservative limits to avoid WhatsApp bans
const MAX_MESSAGES_PER_MINUTE = 30;
const MIN_DELAY_MS = 1000; // 1 second minimum between messages
const MAX_DELAY_MS = 3000; // 3 seconds maximum
const BLOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes block
const MAX_WARNINGS = 3;
const HISTORY_LIMIT = 100;
const SUSPICIOUS_THRESHOLD = 10; // messages in 10 seconds triggers warning

class RateLimitService {
    private static instance: RateLimitService;
    private data: RateLimitData;

    private constructor() {
        this.data = this.loadData();
    }

    static getInstance(): RateLimitService {
        if (!RateLimitService.instance) {
            RateLimitService.instance = new RateLimitService();
        }
        return RateLimitService.instance;
    }

    private getDefaultData(): RateLimitData {
        return {
            version: 1,
            stats: {
                messagesLastMinute: 0,
                messagesLastHour: 0,
                lastMessageTimestamp: 0,
                minuteWindowStart: Date.now(),
                hourWindowStart: Date.now()
            },
            blocks: {
                isBlocked: false,
                blockedUntil: null,
                blockReason: null,
                warningCount: 0,
                lastWarningAt: null
            },
            history: []
        };
    }

    private loadData(): RateLimitData {
        try {
            if (existsSync(DATA_PATH)) {
                const content = readFileSync(DATA_PATH, 'utf-8');
                return JSON.parse(content);
            }
        } catch (error) {
            console.error('Error loading rate limit data:', error);
        }
        return this.getDefaultData();
    }

    private saveData(): void {
        try {
            const dir = dirname(DATA_PATH);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
            writeFileSync(DATA_PATH, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error('Error saving rate limit data:', error);
        }
    }

    private resetWindowsIfNeeded(): void {
        const now = Date.now();

        // Reset minute window
        if (now - this.data.stats.minuteWindowStart >= 60000) {
            this.data.stats.messagesLastMinute = 0;
            this.data.stats.minuteWindowStart = now;
        }

        // Reset hour window
        if (now - this.data.stats.hourWindowStart >= 3600000) {
            this.data.stats.messagesLastHour = 0;
            this.data.stats.hourWindowStart = now;
        }

        // Check if block has expired
        if (
            this.data.blocks.isBlocked &&
            this.data.blocks.blockedUntil &&
            now >= this.data.blocks.blockedUntil
        ) {
            this.data.blocks.isBlocked = false;
            this.data.blocks.blockedUntil = null;
            this.data.blocks.blockReason = null;
            // Reset warnings after block expires
            this.data.blocks.warningCount = 0;
        }
    }

    /**
     * Check if we can send an individual message (NOT for groups/broadcasts)
     */
    canSendIndividual(): RateLimitStatus {
        this.resetWindowsIfNeeded();

        const messagesRemaining = MAX_MESSAGES_PER_MINUTE - this.data.stats.messagesLastMinute;
        const resetIn = Math.max(0, 60000 - (Date.now() - this.data.stats.minuteWindowStart));

        // Check if blocked
        if (this.data.blocks.isBlocked && this.data.blocks.blockedUntil) {
            return {
                canSend: false,
                messagesRemaining: 0,
                resetIn: Math.max(0, this.data.blocks.blockedUntil - Date.now()),
                isBlocked: true,
                blockedUntil: this.data.blocks.blockedUntil,
                warningLevel: 'high',
                warningMessage: `Bloqueado temporalmente: ${this.data.blocks.blockReason}`
            };
        }

        // Check minute limit
        if (this.data.stats.messagesLastMinute >= MAX_MESSAGES_PER_MINUTE) {
            return {
                canSend: false,
                messagesRemaining: 0,
                resetIn,
                isBlocked: false,
                blockedUntil: null,
                warningLevel: 'high',
                warningMessage: 'Limite de 30 mensajes por minuto alcanzado. Espera para continuar.'
            };
        }

        // Calculate warning level
        let warningLevel: WarningLevel = 'none';
        let warningMessage: string | undefined;

        if (messagesRemaining <= 5) {
            warningLevel = 'high';
            warningMessage = `Solo quedan ${messagesRemaining} mensajes disponibles este minuto`;
        } else if (messagesRemaining <= 10) {
            warningLevel = 'medium';
            warningMessage = `${messagesRemaining} mensajes restantes este minuto`;
        } else if (messagesRemaining <= 15) {
            warningLevel = 'low';
        }

        return {
            canSend: true,
            messagesRemaining,
            resetIn,
            isBlocked: false,
            blockedUntil: null,
            warningLevel,
            warningMessage
        };
    }

    /**
     * Record a sent message for rate limiting tracking
     */
    recordMessage(target: string, success: boolean, targetType: TargetType): void {
        const now = Date.now();
        this.resetWindowsIfNeeded();

        // Only count individual messages for rate limiting
        // Groups and broadcasts are exempt
        if (targetType === 'individual') {
            this.data.stats.messagesLastMinute++;
            this.data.stats.messagesLastHour++;
            this.data.stats.lastMessageTimestamp = now;

            // Check for suspicious patterns (too many messages too fast)
            const recentHistory = this.data.history.filter(
                (h) => now - h.timestamp < 10000 && h.action === 'send_individual'
            );
            if (recentHistory.length >= SUSPICIOUS_THRESHOLD) {
                this.addWarning('Patron sospechoso: demasiados mensajes en 10 segundos');
            }
        }

        // Add to history
        const entry: RateLimitHistoryEntry = {
            timestamp: now,
            action: `send_${targetType}`,
            target,
            success
        };
        this.data.history.unshift(entry);

        // Limit history size
        if (this.data.history.length > HISTORY_LIMIT) {
            this.data.history = this.data.history.slice(0, HISTORY_LIMIT);
        }

        this.saveData();
    }

    private addWarning(reason: string): void {
        this.data.blocks.warningCount++;
        this.data.blocks.lastWarningAt = Date.now();

        console.warn(`[RateLimit] Warning ${this.data.blocks.warningCount}/${MAX_WARNINGS}: ${reason}`);

        if (this.data.blocks.warningCount >= MAX_WARNINGS) {
            this.blockTemporarily(reason);
        }

        this.saveData();
    }

    private blockTemporarily(reason: string): void {
        this.data.blocks.isBlocked = true;
        this.data.blocks.blockedUntil = Date.now() + BLOCK_DURATION_MS;
        this.data.blocks.blockReason = reason;

        console.warn(`[RateLimit] BLOCKED for ${BLOCK_DURATION_MS / 1000}s: ${reason}`);

        this.saveData();
    }

    /**
     * Get a random delay between MIN_DELAY_MS and MAX_DELAY_MS
     */
    getRandomDelay(): number {
        return Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
    }

    /**
     * Get minimum delay required before next message
     */
    getMinDelay(): number {
        return MIN_DELAY_MS;
    }

    /**
     * Get full rate limit statistics
     */
    getStats(): RateLimitData {
        this.resetWindowsIfNeeded();
        return { ...this.data };
    }

    /**
     * Get current status summary
     */
    getStatus(): RateLimitStatus {
        return this.canSendIndividual();
    }

    /**
     * Manually reset all rate limits (admin function)
     */
    reset(): void {
        this.data = this.getDefaultData();
        this.saveData();
        console.log('[RateLimit] All limits reset');
    }

    /**
     * Clear block status only
     */
    clearBlock(): void {
        this.data.blocks.isBlocked = false;
        this.data.blocks.blockedUntil = null;
        this.data.blocks.blockReason = null;
        this.data.blocks.warningCount = 0;
        this.saveData();
        console.log('[RateLimit] Block cleared');
    }
}

export default RateLimitService;
