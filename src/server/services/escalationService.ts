/**
 * Escalation Service
 * Sistema de tickets y notificaciones al administrador
 */

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { writeFileSyncAtomic } from '../utils/atomicWrite';
import type {
    EscalationTicket,
    TicketMessage,
    AdminConfig,
    AdminNotification,
    EscalationConfig,
    TicketStats
} from '../types/escalation';
import type { ContextMessage } from '../types/knowledge';

interface EscalationData {
    version: number;
    config: EscalationConfig;
    admins: AdminConfig[];
    tickets: EscalationTicket[];
    notifications: AdminNotification[];
    lastUpdated: string;
}

const DEFAULT_CONFIG: EscalationConfig = {
    enabled: true,
    defaultPriority: 'medium',
    autoAssign: true,
    reminderIntervalMinutes: 15,
    maxReminderCount: 3,
    escalateToSuperAfterMinutes: 60,
    waitingMessage: 'Gracias por tu mensaje. Tu consulta está siendo procesada y un agente te responderá pronto. 🙏',
    assignedMessage: 'Tu solicitud ha sido asignada a uno de nuestros agentes. Te responderemos en breve.',
    resolvedMessage: '¡Gracias por contactarnos! Si tienes más preguntas, no dudes en escribirnos.',
    outOfHoursMessage: 'Gracias por tu mensaje. Nuestro horario de atención es de Lunes a Viernes, 9:00 AM - 6:00 PM. Te responderemos en cuanto estemos disponibles.',
    urgentKeywords: ['urgente', 'emergencia', 'inmediato', 'ayuda', 'problema grave', 'no funciona'],
    negativeKeywords: ['molesto', 'enojado', 'frustrado', 'terrible', 'pésimo', 'queja', 'reclamo']
};

export class EscalationService {
    private static instance: EscalationService;
    private dataPath: string;
    private data: EscalationData;
    private sendMessageCallback?: (jid: string, message: string) => Promise<void>;

    private constructor() {
        this.dataPath = path.join(process.cwd(), 'data', 'escalation.json');
        console.log('[EscalationService] Initializing. Data path:', this.dataPath);
        this.data = this.loadData();
        
        if (!this.data) {
            console.error('[EscalationService] CRITICAL: loadData returned null/undefined!');
        } else {
            console.log('[EscalationService] Data loaded. Tickets:', this.data.tickets?.length ?? 0, 'Admins:', this.data.admins?.length ?? 0);
        }
    }

    public static getInstance(): EscalationService {
        if (!EscalationService.instance) {
            EscalationService.instance = new EscalationService();
        }
        return EscalationService.instance;
    }

    public setSendMessageCallback(callback: (jid: string, message: string) => Promise<void>): void {
        this.sendMessageCallback = callback;
    }

    private loadData(): EscalationData {
        try {
            const dir = path.dirname(this.dataPath);
            if (!fs.existsSync(dir)) {
                console.log('[EscalationService] Data directory does not exist, creating:', dir);
                fs.mkdirSync(dir, { recursive: true });
            }

            if (fs.existsSync(this.dataPath)) {
                console.log('[EscalationService] Reading data file...');
                const rawData = fs.readFileSync(this.dataPath, 'utf-8');
                const parsed = JSON.parse(rawData);

                // Validate structure
                if (!parsed.tickets || !Array.isArray(parsed.tickets)) {
                    console.warn('[EscalationService] Invalid tickets in data file, resetting to empty array');
                    parsed.tickets = [];
                }
                if (!parsed.admins || !Array.isArray(parsed.admins)) {
                    console.warn('[EscalationService] Invalid admins in data file, resetting to empty array');
                    parsed.admins = [];
                }
                if (!parsed.notifications || !Array.isArray(parsed.notifications)) {
                    console.warn('[EscalationService] Invalid notifications in data file, resetting to empty array');
                    parsed.notifications = [];
                }
                if (!parsed.config) {
                    console.warn('[EscalationService] Invalid config in data file, using defaults');
                    parsed.config = DEFAULT_CONFIG;
                }

                return parsed;
            } else {
                console.log('[EscalationService] Data file does not exist, using defaults.');
            }
        } catch (error) {
            console.error('[EscalationService] Error loading escalation data:', error);
        }

        console.log('[EscalationService] Returning default data');
        return {
            version: 1,
            config: DEFAULT_CONFIG,
            admins: [],
            tickets: [],
            notifications: [],
            lastUpdated: new Date().toISOString()
        };
    }

    private saveData(): void {
        try {
            this.data.lastUpdated = new Date().toISOString();
            writeFileSyncAtomic(this.dataPath, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error('Error saving escalation data:', error);
        }
    }

    // ==========================================
    // Configuration
    // ==========================================

    public getConfig(): EscalationConfig {
        return { ...this.data.config };
    }

    public updateConfig(config: Partial<EscalationConfig>): EscalationConfig {
        this.data.config = { ...this.data.config, ...config };
        this.saveData();
        return this.data.config;
    }

    // ==========================================
    // Admin Management
    // ==========================================

    public getAdmins(): AdminConfig[] {
        return [...this.data.admins];
    }

    public getActiveAdmins(): AdminConfig[] {
        return this.data.admins.filter(a => a.isActive);
    }

    public addAdmin(admin: Omit<AdminConfig, 'jid'> & { jid: string }): AdminConfig {
        // Check if admin already exists
        const existing = this.data.admins.find(a => a.jid === admin.jid);
        if (existing) {
            return this.updateAdmin(admin.jid, admin)!;
        }

        const newAdmin: AdminConfig = {
            ...admin,
            isActive: admin.isActive !== undefined ? admin.isActive : true,
            notifyOnNewTicket: admin.notifyOnNewTicket !== undefined ? admin.notifyOnNewTicket : true,
            notifyOnUrgent: admin.notifyOnUrgent !== undefined ? admin.notifyOnUrgent : true,
            notifyOnReminder: admin.notifyOnReminder !== undefined ? admin.notifyOnReminder : true,
            maxConcurrentTickets: admin.maxConcurrentTickets || 10,
            categories: admin.categories || []
        };

        this.data.admins.push(newAdmin);
        this.saveData();
        return newAdmin;
    }

    public updateAdmin(jid: string, updates: Partial<AdminConfig>): AdminConfig | null {
        const index = this.data.admins.findIndex(a => a.jid === jid);
        if (index === -1) return null;

        this.data.admins[index] = { ...this.data.admins[index], ...updates };
        this.saveData();
        return this.data.admins[index];
    }

    public removeAdmin(jid: string): boolean {
        const index = this.data.admins.findIndex(a => a.jid === jid);
        if (index === -1) return false;

        this.data.admins.splice(index, 1);
        this.saveData();
        return true;
    }

    // ==========================================
    // Ticket Management
    // ==========================================

    public async createTicket(params: {
        chatJid: string;
        customerName: string;
        customerPhone: string;
        originalMessage: string;
        conversationContext: ContextMessage[] | TicketMessage[];
        reason?: string;
        priority?: 'low' | 'medium' | 'high' | 'urgent';
    }): Promise<EscalationTicket> {
        const priority = params.priority || this.detectPriority(params.originalMessage);

        const ticket: EscalationTicket = {
            id: uuidv4(),
            chatJid: params.chatJid,
            customerName: params.customerName,
            customerPhone: params.customerPhone,
            originalMessage: params.originalMessage,
            conversationContext: params.conversationContext.map(m => ({
                id: m.id,
                from: m.from,
                body: m.body,
                timestamp: m.timestamp,
                isFromMe: m.isFromMe
            })),
            status: 'pending',
            priority,
            shouldLearn: false,
            tags: [],
            notes: params.reason ? [params.reason] : [],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        this.data.tickets.push(ticket);
        this.saveData();

        // Auto-assign if enabled
        if (this.data.config.autoAssign) {
            await this.autoAssignTicket(ticket.id);
        }

        // Notify admins
        await this.notifyAdminsNewTicket(ticket);

        console.log(`📋 Ticket created: ${ticket.id} for ${params.customerName}`);
        return ticket;
    }

    public getTicket(id: string): EscalationTicket | null {
        return this.data.tickets.find(t => t.id === id) || null;
    }

    public getTicketByChat(chatJid: string): EscalationTicket | null {
        return this.data.tickets.find(
            t => t.chatJid === chatJid && ['pending', 'assigned', 'in_progress'].includes(t.status)
        ) || null;
    }

    public getAllTickets(): EscalationTicket[] {
        return [...this.data.tickets].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }

    public getPendingTickets(): EscalationTicket[] {
        return this.data.tickets.filter(t => t.status === 'pending');
    }

    public getTicketsByAdmin(adminJid: string): EscalationTicket[] {
        return this.data.tickets.filter(
            t => t.assignedTo === adminJid && ['assigned', 'in_progress'].includes(t.status)
        );
    }

    public updateTicket(id: string, updates: Partial<EscalationTicket>): EscalationTicket | null {
        const index = this.data.tickets.findIndex(t => t.id === id);
        if (index === -1) return null;

        this.data.tickets[index] = {
            ...this.data.tickets[index],
            ...updates,
            updatedAt: new Date()
        };
        this.saveData();
        return this.data.tickets[index];
    }

    public async assignTicket(ticketId: string, adminJid: string): Promise<EscalationTicket | null> {
        const ticket = this.updateTicket(ticketId, {
            assignedTo: adminJid,
            assignedAt: new Date(),
            status: 'assigned'
        });

        if (ticket && this.sendMessageCallback) {
            // Notify customer
            await this.sendMessageCallback(ticket.chatJid, this.data.config.assignedMessage);
        }

        return ticket;
    }

    private async autoAssignTicket(ticketId: string): Promise<void> {
        const activeAdmins = this.getActiveAdmins();
        if (activeAdmins.length === 0) return;

        // Find admin with least tickets
        let bestAdmin: AdminConfig | null = null;
        let minTickets = Infinity;

        for (const admin of activeAdmins) {
            const assignedTickets = this.getTicketsByAdmin(admin.jid).length;
            if (assignedTickets < admin.maxConcurrentTickets && assignedTickets < minTickets) {
                minTickets = assignedTickets;
                bestAdmin = admin;
            }
        }

        if (bestAdmin) {
            await this.assignTicket(ticketId, bestAdmin.jid);
        }
    }

    public async resolveTicket(
        ticketId: string,
        adminResponse: string,
        shouldLearn: boolean = false
    ): Promise<EscalationTicket | null> {
        const ticket = this.getTicket(ticketId);
        if (!ticket) return null;

        const now = new Date();
        const responseTime = ticket.assignedAt
            ? now.getTime() - new Date(ticket.assignedAt).getTime()
            : now.getTime() - new Date(ticket.createdAt).getTime();
        const resolutionTime = now.getTime() - new Date(ticket.createdAt).getTime();

        const updated = this.updateTicket(ticketId, {
            status: 'resolved',
            adminResponse,
            resolvedAt: now,
            responseTime,
            resolutionTime,
            shouldLearn
        });

        if (updated && this.sendMessageCallback) {
            // Send response to customer
            await this.sendMessageCallback(ticket.chatJid, adminResponse);
        }

        return updated;
    }

    public closeTicket(ticketId: string): EscalationTicket | null {
        return this.updateTicket(ticketId, {
            status: 'closed',
            closedAt: new Date()
        });
    }

    // ==========================================
    // Admin Response Handling
    // ==========================================

    public async handleAdminMessage(
        adminJid: string,
        message: string
    ): Promise<{ handled: boolean; ticketId?: string; response?: string }> {
        // Check if message is a ticket response
        // Format: #TICKET_ID respuesta
        // or: /responder TICKET_ID respuesta
        
        const ticketMatch = message.match(/^#([a-f0-9-]+)\s+(.+)$/i) ||
                           message.match(/^\/responder\s+([a-f0-9-]+)\s+(.+)$/i);

        if (ticketMatch) {
            const [, ticketId, response] = ticketMatch;
            const ticket = await this.resolveTicket(ticketId, response.trim());
            
            if (ticket) {
                return {
                    handled: true,
                    ticketId: ticket.id,
                    response: `✅ Respuesta enviada al cliente ${ticket.customerName}`
                };
            } else {
                return {
                    handled: true,
                    response: `❌ Ticket no encontrado: ${ticketId}`
                };
            }
        }

        // Check if admin has pending assigned tickets
        const adminTickets = this.getTicketsByAdmin(adminJid);
        if (adminTickets.length === 1) {
            // Only one ticket - assume response is for that ticket
            const ticket = await this.resolveTicket(adminTickets[0].id, message);
            if (ticket) {
                return {
                    handled: true,
                    ticketId: ticket.id,
                    response: `✅ Respuesta enviada al cliente ${ticket.customerName}`
                };
            }
        }

        return { handled: false };
    }

    // ==========================================
    // Notifications
    // ==========================================

    private async notifyAdminsNewTicket(ticket: EscalationTicket): Promise<void> {
        const admins = this.getActiveAdmins().filter(a => a.notifyOnNewTicket);

        if (ticket.priority === 'urgent') {
            // Notify all admins for urgent tickets
            const urgentAdmins = this.getActiveAdmins().filter(a => a.notifyOnUrgent);
            admins.push(...urgentAdmins.filter(a => !admins.find(existing => existing.jid === a.jid)));
        }

        // Exclude the already-assigned admin to avoid duplicate notification
        // (autoAssignTicket already sends its own assignment notification)
        const adminsToNotify = ticket.assignedTo
            ? admins.filter(a => a.jid !== ticket.assignedTo)
            : admins;

        const priorityEmoji = {
            low: '🟢',
            medium: '🟡',
            high: '🟠',
            urgent: '🔴'
        };

        const message = `
📋 *Nuevo Ticket de Soporte*

${priorityEmoji[ticket.priority]} Prioridad: ${ticket.priority.toUpperCase()}
👤 Cliente: ${ticket.customerName}
📱 Teléfono: ${ticket.customerPhone}

💬 *Mensaje:*
${ticket.originalMessage}

Para responder, usa:
#${ticket.id} tu respuesta aquí
`.trim();

        for (const admin of adminsToNotify) {
            await this.sendNotification(admin.jid, 'new_ticket', ticket.id, message);
        }
    }

    private async sendNotification(
        adminJid: string,
        type: AdminNotification['type'],
        ticketId: string | undefined,
        message: string
    ): Promise<void> {
        const notification: AdminNotification = {
            id: uuidv4(),
            type,
            ticketId,
            adminJid,
            message,
            sentAt: new Date()
        };

        this.data.notifications.push(notification);
        this.saveData();

        if (this.sendMessageCallback) {
            try {
                await this.sendMessageCallback(adminJid, message);
                notification.deliveredAt = new Date();
                this.saveData();
            } catch (error) {
                console.error(`Failed to send notification to ${adminJid}:`, error);
            }
        }
    }

    // ==========================================
    // Priority Detection
    // ==========================================

    private detectPriority(message: string): 'low' | 'medium' | 'high' | 'urgent' {
        const lowerMessage = message.toLowerCase();

        // Check for urgent keywords
        if (this.data.config.urgentKeywords.some(kw => lowerMessage.includes(kw))) {
            return 'urgent';
        }

        // Check for negative sentiment (high priority)
        if (this.data.config.negativeKeywords.some(kw => lowerMessage.includes(kw))) {
            return 'high';
        }

        // Check message length (longer messages might need more attention)
        if (message.length > 500) {
            return 'medium';
        }

        return this.data.config.defaultPriority;
    }

    // ==========================================
    // Statistics
    // ==========================================

    public getStats(): TicketStats {
            if (!this.data) {
                console.error('EscalationService: this.data is undefined, returning empty stats');
                return {
                    total: 0,
                    pending: 0,
                    inProgress: 0,
                    resolved: 0,
                    avgResponseTime: 0,
                    avgResolutionTime: 0,
                    byPriority: {},
                    byCategory: {},
                    byAdmin: {}
                };
            }
            const tickets = this.data.tickets || []; // Safety fallback
            const resolved = tickets.filter(t => t.status === 'resolved');

        const avgResponseTime = resolved.length > 0
            ? resolved.reduce((sum, t) => sum + (t.responseTime || 0), 0) / resolved.length
            : 0;

        const avgResolutionTime = resolved.length > 0
            ? resolved.reduce((sum, t) => sum + (t.resolutionTime || 0), 0) / resolved.length
            : 0;

        const byPriority: Record<string, number> = {};
        const byCategory: Record<string, number> = {};
        const byAdmin: Record<string, number> = {};

        tickets.forEach(t => {
            byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
            (t.tags || []).forEach(tag => {
                byCategory[tag] = (byCategory[tag] || 0) + 1;
            });
            if (t.assignedTo) {
                byAdmin[t.assignedTo] = (byAdmin[t.assignedTo] || 0) + 1;
            }
        });

        return {
            total: tickets.length,
            pending: tickets.filter(t => t.status === 'pending').length,
            inProgress: tickets.filter(t => ['assigned', 'in_progress'].includes(t.status)).length,
            resolved: resolved.length,
            avgResponseTime,
            avgResolutionTime,
            byPriority,
            byCategory,
            byAdmin
        };
    }

    // ==========================================
    // Cleanup
    // ==========================================

    public cleanupOldTickets(daysOld: number = 30): number {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysOld);

        const initialCount = this.data.tickets.length;
        this.data.tickets = this.data.tickets.filter(t => {
            if (t.status === 'closed' || t.status === 'resolved') {
                const closedDate = t.closedAt || t.resolvedAt || t.createdAt;
                return new Date(closedDate) > cutoff;
            }
            return true;
        });

        const removed = initialCount - this.data.tickets.length;
        if (removed > 0) {
            this.saveData();
        }

        return removed;
    }
}

export default EscalationService;
