import { existsSync, readFileSync, mkdirSync } from 'fs';
import { writeFileSyncAtomic } from '../utils/atomicWrite';
import { join, dirname } from 'path';
import { EventEmitter } from 'events';
import MetricsService from './metricsService';
import Logger from './loggerService';

export interface GeminiAnalysis {
    intent: string;
    suggestedTopics: string[];
    confidence: number;
    reason: string;
    canAnswer: boolean;
}

export interface ConversationMessage {
    role: 'customer' | 'bot';
    message: string;
    timestamp: string;
}

export interface PendingAlert {
    id: string;
    chatJid: string;
    customerName: string;
    customerPhone: string;
    originalMessage: string;
    conversationContext: ConversationMessage[];

    geminiAnalysis: GeminiAnalysis;

    status: 'pending' | 'answered' | 'dismissed';
    priority: 'low' | 'medium' | 'high';

    userResponse?: string;
    respondedAt?: string;
    respondedBy?: string;

    shouldLearn: boolean;
    learnedFaqId?: string;

    createdAt: string;
    expiresAt: string;
    aiDraftResponse?: string;
}

interface AlertsData {
    version: number;
    alerts: PendingAlert[];
}

const DATA_PATH = join(process.cwd(), 'data', 'pending-alerts.json');

// Input validation constants
const MAX_MESSAGE_LENGTH = 4096;
const MAX_NAME_LENGTH = 100;
const MAX_RESPONSE_LENGTH = 4096;

class PendingAlertService extends EventEmitter {
    private static instance: PendingAlertService;
    private data: AlertsData;
    private metrics: MetricsService;

    private constructor() {
        super();
        this.data = this.load();
        this.metrics = MetricsService.getInstance();
        this.cleanExpiredAlerts();
    }

    static getInstance(): PendingAlertService {
        if (!PendingAlertService.instance) {
            PendingAlertService.instance = new PendingAlertService();
        }
        return PendingAlertService.instance;
    }

    private load(): AlertsData {
        try {
            if (existsSync(DATA_PATH)) {
                return JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
            }
        } catch (error) {
            Logger.error('[PendingAlertService] Error loading data:', error);
        }

        return {
            version: 1,
            alerts: []
        };
    }

    private save(): void {
        try {
            const dir = dirname(DATA_PATH);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
            writeFileSyncAtomic(DATA_PATH, JSON.stringify(this.data, null, 2));
        } catch (error) {
            Logger.error('[PendingAlertService] Error saving data:', error);
        }
    }

    private generateId(): string {
        return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private determinePriority(analysis: GeminiAnalysis): 'low' | 'medium' | 'high' {
        // High priority intents
        const highPriorityIntents = ['queja', 'urgente', 'problema', 'error', 'falla', 'cancelar'];
        const mediumPriorityIntents = ['precio', 'cotizacion', 'compra', 'pedido', 'envio'];

        const intent = analysis.intent.toLowerCase();

        if (highPriorityIntents.some(p => intent.includes(p))) {
            return 'high';
        }
        if (mediumPriorityIntents.some(p => intent.includes(p))) {
            return 'medium';
        }
        return 'low';
    }

    /**
     * Validate JID format
     */
    private isValidJid(jid: string): boolean {
        if (!jid || typeof jid !== 'string') return false;
        return /^\d+@(s\.whatsapp\.net|g\.us)$/.test(jid.trim());
    }

    /**
     * Sanitize string input
     */
    private sanitizeString(input: string, maxLength: number): string {
        if (!input || typeof input !== 'string') return '';
        return input.trim().slice(0, maxLength);
    }

    /**
     * Create a new pending alert
     */
    async createAlert(
        chatJid: string,
        customerName: string,
        originalMessage: string,
        geminiAnalysis: GeminiAnalysis,
        conversationContext: ConversationMessage[] = [],
        aiDraftResponse?: string
    ): Promise<PendingAlert> {
        // Input validation
        if (!this.isValidJid(chatJid)) {
            Logger.error(`[PendingAlertService] Invalid JID: ${chatJid}`);
            throw new Error('Invalid chat JID format');
        }

        const sanitizedMessage = this.sanitizeString(originalMessage, MAX_MESSAGE_LENGTH);
        if (!sanitizedMessage) {
            Logger.error('[PendingAlertService] Empty message provided');
            throw new Error('Message cannot be empty');
        }

        const sanitizedName = this.sanitizeString(customerName, MAX_NAME_LENGTH) || 'Cliente';
        const customerPhone = chatJid.split('@')[0];

        const alert: PendingAlert = {
            id: this.generateId(),
            chatJid: chatJid.trim(),
            customerName: sanitizedName,
            customerPhone,
            originalMessage: sanitizedMessage,
            conversationContext,
            geminiAnalysis,
            status: 'pending',
            priority: this.determinePriority(geminiAnalysis),
            shouldLearn: true,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
            aiDraftResponse
        };

        this.data.alerts.unshift(alert);
        this.save();

        // Emit event for WebSocket
        this.emit('alert:new', alert);

        Logger.info(`[PendingAlertService] Created alert ${alert.id} for ${customerName}`);

        return alert;
    }

    /**
     * Get all active (pending) alerts
     */
    getActiveAlerts(): PendingAlert[] {
        this.cleanExpiredAlerts();
        return this.data.alerts.filter(a => a.status === 'pending');
    }

    /**
     * Get all alerts (including answered/dismissed)
     */
    getAllAlerts(limit: number = 100): PendingAlert[] {
        return this.data.alerts.slice(0, limit);
    }

    /**
     * Get alert by ID
     */
    getAlert(alertId: string): PendingAlert | null {
        return this.data.alerts.find(a => a.id === alertId) || null;
    }

    /**
     * Get alerts for a specific chat
     */
    getAlertsByChat(chatJid: string): PendingAlert[] {
        return this.data.alerts.filter(a => a.chatJid === chatJid);
    }

    /**
     * Get pending alert count
     */
    getPendingCount(): number {
        return this.data.alerts.filter(a => a.status === 'pending').length;
    }

    /**
     * Respond to an alert
     */
    async respondToAlert(
        alertId: string,
        response: string,
        respondedBy: string = 'admin',
        shouldLearn: boolean = true
    ): Promise<{ alert: PendingAlert; learnedFaqId?: string } | null> {
        // Input validation
        if (!alertId || typeof alertId !== 'string') {
            Logger.error('[PendingAlertService] Invalid alert ID');
            return null;
        }

        const sanitizedResponse = this.sanitizeString(response, MAX_RESPONSE_LENGTH);
        if (!sanitizedResponse) {
            Logger.error('[PendingAlertService] Empty response provided');
            return null;
        }

        const sanitizedRespondedBy = this.sanitizeString(respondedBy, MAX_NAME_LENGTH) || 'admin';

        const alertIndex = this.data.alerts.findIndex(a => a.id === alertId);

        if (alertIndex === -1) {
            Logger.error(`[PendingAlertService] Alert ${alertId} not found`);
            return null;
        }

        const alert = this.data.alerts[alertIndex];

        alert.status = 'answered';
        alert.userResponse = sanitizedResponse;
        alert.respondedAt = new Date().toISOString();
        alert.respondedBy = sanitizedRespondedBy;
        alert.shouldLearn = shouldLearn;

        this.save();

        // Record human reply metric
        const createdTime = new Date(alert.createdAt).getTime();
        const responseTimeMs = Date.now() - createdTime;
        this.metrics.humanReplied(alert.chatJid, alertId, responseTimeMs, shouldLearn);

        // Emit event
        this.emit('alert:responded', alert);

        Logger.info(`[PendingAlertService] Alert ${alertId} responded by ${respondedBy}`);

        return { alert };
    }

    /**
     * Dismiss an alert without responding
     */
    dismissAlert(alertId: string, reason?: string): PendingAlert | null {
        const alertIndex = this.data.alerts.findIndex(a => a.id === alertId);

        if (alertIndex === -1) {
            return null;
        }

        const alert = this.data.alerts[alertIndex];
        alert.status = 'dismissed';
        alert.userResponse = reason || 'Dismissed without response';
        alert.respondedAt = new Date().toISOString();

        this.save();

        // Emit event
        this.emit('alert:dismissed', alert);

        return alert;
    }

    /**
     * Update alert's shouldLearn flag
     */
    updateShouldLearn(alertId: string, shouldLearn: boolean): void {
        const alert = this.data.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.shouldLearn = shouldLearn;
            this.save();
        }
    }

    /**
     * Link alert to learned FAQ
     */
    linkToLearnedFaq(alertId: string, faqId: string): void {
        const alert = this.data.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.learnedFaqId = faqId;
            this.save();
        }
    }

    /**
     * Clean expired alerts (auto-dismiss) and purge old resolved alerts
     */
    private cleanExpiredAlerts(): void {
        const now = new Date();
        let changed = false;

        for (const alert of this.data.alerts) {
            if (alert.status === 'pending' && new Date(alert.expiresAt) < now) {
                alert.status = 'dismissed';
                alert.userResponse = 'Auto-dismissed (expired)';
                alert.respondedAt = now.toISOString();
                changed = true;
            }
        }

        // Purge resolved alerts older than 7 days to prevent unbounded array growth
        const RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
        const cutoff = new Date(now.getTime() - RETENTION_MS);
        const beforeCount = this.data.alerts.length;
        this.data.alerts = this.data.alerts.filter(a => {
            if (a.status === 'pending') return true; // Never remove pending alerts
            const resolvedDate = a.respondedAt ? new Date(a.respondedAt) : new Date(a.createdAt);
            return resolvedDate > cutoff;
        });
        if (this.data.alerts.length !== beforeCount) {
            changed = true;
        }

        if (changed) {
            this.save();
        }
    }

    /**
     * Get statistics
     */
    getStats(): {
        total: number;
        pending: number;
        answered: number;
        dismissed: number;
        avgResponseTime: number;
        byPriority: { high: number; medium: number; low: number };
    } {
        const alerts = this.data.alerts;
        const answered = alerts.filter(a => a.status === 'answered');

        let totalResponseTime = 0;
        for (const alert of answered) {
            if (alert.respondedAt) {
                const created = new Date(alert.createdAt).getTime();
                const responded = new Date(alert.respondedAt).getTime();
                totalResponseTime += responded - created;
            }
        }

        return {
            total: alerts.length,
            pending: alerts.filter(a => a.status === 'pending').length,
            answered: answered.length,
            dismissed: alerts.filter(a => a.status === 'dismissed').length,
            avgResponseTime: answered.length > 0 ? totalResponseTime / answered.length : 0,
            byPriority: {
                high: alerts.filter(a => a.priority === 'high' && a.status === 'pending').length,
                medium: alerts.filter(a => a.priority === 'medium' && a.status === 'pending').length,
                low: alerts.filter(a => a.priority === 'low' && a.status === 'pending').length
            }
        };
    }

    /**
     * Get frequent unanswered questions grouped by similarity
     */
    getFrequentUnanswered(similarityThreshold: number = 0.7): Array<{
        question: string;
        count: number;
        alertIds: string[];
        latestAlert: PendingAlert;
    }> {
        const pendingAlerts = this.getActiveAlerts();
        const groups: Array<{
            question: string;
            alertIds: string[];
            latestAlert: PendingAlert;
        }> = [];

        for (const alert of pendingAlerts) {
            let addedToGroup = false;

            // Try to find a matching group
            for (const group of groups) {
                const similarity = this.calculateSimilarity(alert.originalMessage, group.question);
                if (similarity >= similarityThreshold) {
                    group.alertIds.push(alert.id);
                    // Keep the most recent alert as the representative for the group
                    if (new Date(alert.createdAt) > new Date(group.latestAlert.createdAt)) {
                        group.latestAlert = alert;
                    }
                    addedToGroup = true;
                    break;
                }
            }

            // Create new group if no match found
            if (!addedToGroup) {
                groups.push({
                    question: alert.originalMessage,
                    alertIds: [alert.id],
                    latestAlert: alert
                });
            }
        }

        // Transform and sort by count (descending)
        return groups
            .map(g => ({
                question: g.latestAlert.originalMessage, // Use the latest message as the "canonical" one
                count: g.alertIds.length,
                alertIds: g.alertIds,
                latestAlert: g.latestAlert
            }))
            .sort((a, b) => b.count - a.count);
    }

    /**
     * Calculate string similarity (Jaccard index on word overlap)
     */
    private calculateSimilarity(str1: string, str2: string): number {
        const normalize = (s: string) => s.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\w\s]/g, '')
            .split(/\s+/).filter(w => w.length > 3); // Only consider words > 3 chars

        const words1 = new Set(normalize(str1));
        const words2 = new Set(normalize(str2));

        if (words1.size === 0 && words2.size === 0) return 1;
        if (words1.size === 0 || words2.size === 0) return 0;

        let intersection = 0;
        for (const word of words1) {
            if (words2.has(word)) {
                intersection++;
            }
        }

        const union = words1.size + words2.size - intersection;
        return union > 0 ? intersection / union : 0;
    }

    /**
     * Check rate limit for alerts (max 5 per hour per chat)
     */
    checkRateLimit(chatJid: string): boolean {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentAlerts = this.data.alerts.filter(
            a => a.chatJid === chatJid && new Date(a.createdAt) > oneHourAgo
        );
        return recentAlerts.length < 5;
    }
}

export default PendingAlertService;
