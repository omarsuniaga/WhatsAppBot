/**
 * Broadcast System Types
 * Sistema de mensajes masivos y difusión
 */

export interface BroadcastCampaign {
    id: string;
    name: string;
    description?: string;
    
    // Contenido
    message: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'video' | 'document' | 'audio';
    buttons?: MessageButton[];
    
    // Destinatarios
    targetLists: string[];         // IDs de listas de contactos
    targetContacts: string[];      // JIDs individuales adicionales
    excludeContacts: string[];     // JIDs a excluir
    
    // Programación
    schedule?: Date;
    timezone?: string;
    
    // Estado
    status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled';
    startedAt?: Date;
    completedAt?: Date;
    pausedAt?: Date;
    
    // Métricas
    totalRecipients: number;
    sent: number;
    delivered: number;
    read: number;
    replied: number;
    failed: number;
    failedContacts: FailedContact[];
    
    // Configuración
    delayBetweenMessages: number;  // Milisegundos entre mensajes
    randomizeDelay: boolean;       // Aleatorizar delay
    minDelay: number;              // Delay mínimo si aleatorio
    maxDelay: number;              // Delay máximo si aleatorio
    personalizeMessage: boolean;   // Usar {nombre} en mensaje
    trackDelivery: boolean;        // Rastrear entregas
    trackRead: boolean;            // Rastrear lecturas
    
    // Metadatos
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface MessageButton {
    id: string;
    text: string;
    type: 'reply' | 'url' | 'call';
    data?: string;                 // URL o número de teléfono
}

export interface FailedContact {
    jid: string;
    reason: string;
    failedAt: Date;
    retryCount: number;
}

export interface ContactList {
    id: string;
    name: string;
    description?: string;
    contacts: ContactListItem[];
    tags: string[];
    isActive: boolean;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface ContactListItem {
    jid: string;
    name: string;
    phone: string;
    customFields?: Record<string, string>;
    addedAt: Date;
}

export interface MessageTemplate {
    id: string;
    name: string;
    description?: string;
    category: string;
    content: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'video' | 'document' | 'audio';
    variables: string[];           // ['nombre', 'fecha', 'empresa']
    buttons?: MessageButton[];
    isActive: boolean;
    usageCount: number;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface BroadcastConfig {
    enabled: boolean;
    maxRecipientsPerCampaign: number;
    maxCampaignsPerDay: number;
    defaultDelay: number;
    defaultRandomizeDelay: boolean;
    minDelayBetweenCampaigns: number;   // Minutos entre campañas
    
    // Anti-spam
    cooldownPerContact: number;         // Horas antes de enviar al mismo contacto
    maxMessagesPerContactPerDay: number;
    blacklistedNumbers: string[];
    
    // Horarios permitidos
    allowedHours: AllowedHours;
}

export interface AllowedHours {
    enabled: boolean;
    timezone: string;
    start: string;                      // "08:00"
    end: string;                        // "20:00"
    allowWeekends: boolean;
}

export interface CampaignStats {
    totalCampaigns: number;
    activeCampaigns: number;
    completedCampaigns: number;
    totalMessagesSent: number;
    totalDelivered: number;
    totalRead: number;
    totalReplied: number;
    averageDeliveryRate: number;
    averageReadRate: number;
    averageReplyRate: number;
}

export interface BroadcastProgress {
    campaignId: string;
    status: string;
    progress: number;              // 0-100
    sent: number;
    total: number;
    currentContact?: string;
    estimatedTimeRemaining?: number; // Segundos
}
