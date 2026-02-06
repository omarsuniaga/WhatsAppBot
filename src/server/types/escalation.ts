/**
 * Escalation System Types
 * Sistema de tickets y notificaciones al administrador
 */

export interface EscalationTicket {
    id: string;
    chatJid: string;
    customerName: string;
    customerPhone: string;
    originalMessage: string;
    conversationContext: TicketMessage[];
    
    // Estado
    status: 'pending' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    
    // Asignación
    assignedTo?: string;           // JID del admin
    assignedAt?: Date;
    
    // Resolución
    adminResponse?: string;
    resolvedAt?: Date;
    closedAt?: Date;
    
    // Aprendizaje
    shouldLearn: boolean;          // ¿Guardar respuesta en KB?
    learnedFaqId?: string;
    
    // Métricas
    responseTime?: number;         // Tiempo hasta primera respuesta (ms)
    resolutionTime?: number;       // Tiempo total de resolución (ms)
    
    // Metadatos
    tags: string[];
    notes: string[];
    createdAt: Date;
    updatedAt: Date;
}

export interface TicketMessage {
    id: string;
    from: string;
    body: string;
    timestamp: Date;
    isFromMe: boolean;
    isAdminResponse?: boolean;
}

export interface AdminConfig {
    jid: string;                   // WhatsApp JID del admin
    name: string;
    role: 'super_admin' | 'admin' | 'agent';
    isActive: boolean;
    notifyOnNewTicket: boolean;
    notifyOnUrgent: boolean;
    notifyOnReminder: boolean;
    workingHours?: WorkingHours;
    maxConcurrentTickets: number;
    categories: string[];          // Categorías que puede atender
}

export interface WorkingHours {
    timezone: string;
    schedule: DaySchedule[];
}

export interface DaySchedule {
    day: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday
    isWorkingDay: boolean;
    startTime?: string;            // "09:00"
    endTime?: string;              // "18:00"
}

export interface AdminNotification {
    id: string;
    type: 'new_ticket' | 'urgent_ticket' | 'reminder' | 'daily_summary' | 'ticket_reply';
    ticketId?: string;
    adminJid: string;
    message: string;
    sentAt: Date;
    readAt?: Date;
    deliveredAt?: Date;
}

export interface EscalationConfig {
    enabled: boolean;
    defaultPriority: 'low' | 'medium' | 'high';
    autoAssign: boolean;
    reminderIntervalMinutes: number;    // Recordar si no hay respuesta
    maxReminderCount: number;
    escalateToSuperAfterMinutes: number; // Escalar a super admin si no hay respuesta
    
    // Mensajes automáticos
    waitingMessage: string;
    assignedMessage: string;
    resolvedMessage: string;
    outOfHoursMessage: string;
    
    // Detección de urgencia
    urgentKeywords: string[];
    negativeKeywords: string[];
}

export interface TicketStats {
    total: number;
    pending: number;
    inProgress: number;
    resolved: number;
    avgResponseTime: number;
    avgResolutionTime: number;
    byPriority: Record<string, number>;
    byCategory: Record<string, number>;
    byAdmin: Record<string, number>;
}
