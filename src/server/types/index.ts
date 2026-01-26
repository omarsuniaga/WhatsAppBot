// ==========================================
// Contact Groups (Local Tags/Labels)
// ==========================================

export interface ContactGroupContact {
    jid: string;
    name: string;
    addedAt: string;
}

export interface ContactGroup {
    id: string;
    name: string;
    description?: string;
    color: string;
    contacts: ContactGroupContact[];
    createdAt: string;
    updatedAt: string;
}

export interface ContactGroupsData {
    version: number;
    lastUpdated: string;
    groups: ContactGroup[];
}

// ==========================================
// Rate Limiting
// ==========================================

export interface RateLimitStats {
    messagesLastMinute: number;
    messagesLastHour: number;
    lastMessageTimestamp: number;
    minuteWindowStart: number;
    hourWindowStart: number;
}

export interface RateLimitBlocks {
    isBlocked: boolean;
    blockedUntil: number | null;
    blockReason: string | null;
    warningCount: number;
    lastWarningAt: number | null;
}

export interface RateLimitHistoryEntry {
    timestamp: number;
    action: string;
    target: string;
    success: boolean;
}

export interface RateLimitData {
    version: number;
    stats: RateLimitStats;
    blocks: RateLimitBlocks;
    history: RateLimitHistoryEntry[];
}

export type WarningLevel = 'none' | 'low' | 'medium' | 'high';

export interface RateLimitStatus {
    canSend: boolean;
    messagesRemaining: number;
    resetIn: number;
    isBlocked: boolean;
    blockedUntil: number | null;
    warningLevel: WarningLevel;
    warningMessage?: string;
}

// ==========================================
// Message Queue
// ==========================================

export type QueueMessageStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type QueueMessageType = 'text' | 'media' | 'file' | 'location' | 'contact' | 'poll' | 'sticker';
export type TargetType = 'individual' | 'group' | 'broadcast';

export interface QueueMessage {
    id: string;
    type: QueueMessageType;
    target: string;
    targetType: TargetType;
    content: Record<string, any>;
    priority: number;
    status: QueueMessageStatus;
    attempts: number;
    maxAttempts: number;
    scheduledFor: string;
    createdAt: string;
    processedAt: string | null;
    error: string | null;
}

export interface MessageQueueData {
    version: number;
    lastProcessed: string;
    queue: QueueMessage[];
    processed: QueueMessage[];
}

export interface QueueStatus {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    queue: QueueMessage[];
}

// ==========================================
// WhatsApp Groups
// ==========================================

export interface GroupParticipant {
    id: string;
    admin?: 'admin' | 'superadmin' | null;
}

export interface WhatsAppGroupMetadata {
    id: string;
    subject: string;
    owner?: string;
    desc?: string;
    descId?: string;
    participants: GroupParticipant[];
    size?: number;
    creation?: number;
    subjectOwner?: string;
    subjectTime?: number;
}

export type ParticipantAction = 'add' | 'remove' | 'promote' | 'demote';

// ==========================================
// API Responses
// ==========================================

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export interface BulkSendResult {
    queued: number;
    messageIds: string[];
}
