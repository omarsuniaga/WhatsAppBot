/**
 * MetricsService - Passive observability module
 * 
 * Records system events for future analysis without impacting performance.
 * This is a SEED implementation for Phase C+ analytics.
 * 
 * Events recorded:
 * - message_received: Incoming WhatsApp message
 * - resolved_by_kb: Message answered by Knowledge Base
 * - resolved_by_ai: Message answered by Gemini AI
 * - escalated_to_human: Message escalated (alert created)
 * - human_replied: Human responded to an alert
 * - fallback_response: Generic fallback used
 * 
 * @see /docs/METRICS.md for documentation
 */

import { existsSync, appendFileSync, mkdirSync, statSync, renameSync } from 'fs';
import { join, dirname } from 'path';

// Event types for type safety
export type MetricEventType =
    | 'message_received'
    | 'resolved_by_kb'
    | 'resolved_by_ai'
    | 'escalated_to_human'
    | 'human_replied'
    | 'fallback_response'
    | 'bot_toggled'
    | 'connection_status'
    | 'error';

// Base metric event structure
export interface MetricEvent {
    timestamp: string;
    event: MetricEventType;
    chatJid?: string;
    data?: Record<string, unknown>;
}

// Specific event data interfaces
export interface MessageReceivedData {
    messageLength: number;
    isGroup: boolean;
}

export interface ResolvedByKBData {
    confidence: number;
    category?: string;
    responseTimeMs: number;
}

export interface ResolvedByAIData {
    confidence?: number;
    responseTimeMs: number;
}

export interface EscalatedData {
    alertId: string;
    priority: 'low' | 'medium' | 'high';
    intent?: string;
}

export interface HumanRepliedData {
    alertId: string;
    responseTimeMs: number;
    shouldLearn: boolean;
}

// Configuration
const METRICS_DIR = join(process.cwd(), 'data', 'metrics');
const METRICS_FILE = join(METRICS_DIR, 'events.jsonl');
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

class MetricsService {
    private static instance: MetricsService;
    private buffer: MetricEvent[] = [];
    private flushInterval: NodeJS.Timeout | null = null;
    private isEnabled: boolean = true;

    private constructor() {
        this.ensureDirectory();
        this.startFlushInterval();
    }

    static getInstance(): MetricsService {
        if (!MetricsService.instance) {
            MetricsService.instance = new MetricsService();
        }
        return MetricsService.instance;
    }

    /**
     * Ensure metrics directory exists
     */
    private ensureDirectory(): void {
        try {
            if (!existsSync(METRICS_DIR)) {
                mkdirSync(METRICS_DIR, { recursive: true });
            }
        } catch (error) {
            console.error('[MetricsService] Failed to create metrics directory:', error);
            this.isEnabled = false;
        }
    }

    /**
     * Start periodic flush to disk (every 5 seconds)
     */
    private startFlushInterval(): void {
        this.flushInterval = setInterval(() => {
            this.flush();
        }, 5000);

        // Ensure flush on process exit and termination signals
        process.on('beforeExit', () => this.flush());
        const gracefulFlush = () => {
            this.flush();
        };
        process.on('SIGTERM', gracefulFlush);
        process.on('SIGINT', gracefulFlush);
    }

    /**
     * Record a metric event (non-blocking)
     */
    record(event: MetricEventType, chatJid?: string, data?: Record<string, unknown>): void {
        if (!this.isEnabled) return;

        const metric: MetricEvent = {
            timestamp: new Date().toISOString(),
            event,
            ...(chatJid && { chatJid: this.anonymizeJid(chatJid) }),
            ...(data && { data })
        };

        this.buffer.push(metric);

        // Auto-flush if buffer gets large
        if (this.buffer.length >= 100) {
            this.flush();
        }
    }

    /**
     * Anonymize JID for privacy (keep only country code pattern)
     */
    private anonymizeJid(jid: string): string {
        // Convert "5491234567890@s.whatsapp.net" to "549***@s.whatsapp.net"
        const match = jid.match(/^(\d{1,4})(\d+)@(.+)$/);
        if (match) {
            return `${match[1]}***@${match[3]}`;
        }
        return '***@unknown';
    }

    /**
     * Flush buffer to disk
     */
    private flush(): void {
        if (this.buffer.length === 0) return;

        try {
            // Rotate file if too large
            this.rotateIfNeeded();

            // Write buffered events as JSONL (one JSON object per line)
            const lines = this.buffer.map(event => JSON.stringify(event)).join('\n') + '\n';
            appendFileSync(METRICS_FILE, lines);

            // Clear buffer
            this.buffer = [];
        } catch (error) {
            console.error('[MetricsService] Failed to flush metrics:', error);
        }
    }

    /**
     * Rotate log file if it exceeds max size
     */
    private rotateIfNeeded(): void {
        try {
            if (!existsSync(METRICS_FILE)) return;

            const stats = statSync(METRICS_FILE);
            if (stats.size >= MAX_FILE_SIZE_BYTES) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const rotatedFile = join(METRICS_DIR, `events-${timestamp}.jsonl`);
                renameSync(METRICS_FILE, rotatedFile);
                console.log(`[MetricsService] Rotated metrics file to ${rotatedFile}`);
            }
        } catch (error) {
            console.error('[MetricsService] Failed to rotate metrics file:', error);
        }
    }

    // ==========================================
    // Convenience methods for common events
    // ==========================================

    /**
     * Record incoming message
     */
    messageReceived(chatJid: string, messageLength: number, isGroup: boolean = false): void {
        this.record('message_received', chatJid, {
            messageLength,
            isGroup
        });
    }

    /**
     * Record KB resolution
     */
    resolvedByKB(chatJid: string, confidence: number, responseTimeMs: number, category?: string): void {
        this.record('resolved_by_kb', chatJid, {
            confidence,
            responseTimeMs,
            ...(category && { category })
        });
    }

    /**
     * Record AI resolution
     */
    resolvedByAI(chatJid: string, responseTimeMs: number, confidence?: number): void {
        this.record('resolved_by_ai', chatJid, {
            responseTimeMs,
            ...(confidence !== undefined && { confidence })
        });
    }

    /**
     * Record escalation to human
     */
    escalatedToHuman(chatJid: string, alertId: string, priority: 'low' | 'medium' | 'high', intent?: string): void {
        this.record('escalated_to_human', chatJid, {
            alertId,
            priority,
            ...(intent && { intent })
        });
    }

    /**
     * Record human reply to alert
     */
    humanReplied(chatJid: string, alertId: string, responseTimeMs: number, shouldLearn: boolean): void {
        this.record('human_replied', chatJid, {
            alertId,
            responseTimeMs,
            shouldLearn
        });
    }

    /**
     * Record fallback response
     */
    fallbackResponse(chatJid: string, reason?: string): void {
        this.record('fallback_response', chatJid, {
            ...(reason && { reason })
        });
    }

    /**
     * Record bot toggle
     */
    botToggled(chatJid: string, enabled: boolean): void {
        this.record('bot_toggled', chatJid, { enabled });
    }

    /**
     * Record connection status change
     */
    connectionStatus(status: 'connected' | 'disconnected' | 'connecting'): void {
        this.record('connection_status', undefined, { status });
    }

    /**
     * Record error
     */
    error(context: string, message: string, chatJid?: string): void {
        this.record('error', chatJid, {
            context,
            message
        });
    }

    /**
     * Get current buffer size (for monitoring)
     */
    getBufferSize(): number {
        return this.buffer.length;
    }

    /**
     * Force flush (for graceful shutdown)
     */
    forceFlush(): void {
        this.flush();
    }

    /**
     * Disable metrics collection
     */
    disable(): void {
        this.isEnabled = false;
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
        }
    }
}

export default MetricsService;
