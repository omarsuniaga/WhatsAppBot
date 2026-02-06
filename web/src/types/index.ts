export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contact' | 'sticker' | 'poll' | 'unknown';

export interface Message {
    id: string;
    from: string;
    body: string;
    type: MessageType;
    timestamp: number;
    fromMe: boolean;
    status?: 'pending' | 'sent' | 'delivered' | 'read' | 'error';
    pushName?: string;
    ack?: number; // WhatsApp ack: 0=pending, 1=sent, 2=received, 3=read, 4=failed
    messageTimestamp?: number;
    remoteJid?: string;
    // Group message sender info
    senderJid?: string;
    senderName?: string;
    senderProfilePic?: string;
}

export interface Chat {
    jid: string;
    stableKey?: string; // Stable key for internal lookups (e.g., "123456@contact")
    name: string;
    displayName?: string; // Stable name from ContactStore (derived from pushName)
    profilePicUrl?: string;
    lastMessage?: string;
    lastMessageTime?: number;
    unreadCount: number;
    isGroup: boolean;
    botActive?: boolean;
    lastMessageSender?: {
        jid: string;
        name: string;
    };
    // Group specific properties
    memberCount?: number;
    groupDesc?: string;
    groupOwner?: string;
    groupCreation?: number;
    // Color for group identification
    groupColor?: string;
}

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

// ==========================================
// Rate Limiting Types
// ==========================================

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
// Contact Groups (Local Tags)
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

// ==========================================
// Message Queue Types
// ==========================================

export type QueueMessageStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type QueueMessageType = 'text' | 'media' | 'file' | 'location' | 'contact' | 'poll' | 'sticker';

export interface QueueMessage {
    id: string;
    type: QueueMessageType;
    target: string;
    targetType: 'individual' | 'group' | 'broadcast';
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

export interface QueueStatus {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    queue: QueueMessage[];
}

// ==========================================
// WhatsApp Group Types
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
    participants: GroupParticipant[];
    size?: number;
    creation?: number;
}

// ==========================================
// Bot Intelligence Types
// ==========================================

export interface QAItem {
    id: string;
    keywords: string[];
    questions: string[];
    answer: string;
    priority: number;
}

export interface QACategory {
    id: string;
    name: string;
    icon: string;
    items: QAItem[];
}

export interface KnowledgeBase {
    version: number;
    updatedAt: string;
    business: {
        name: string;
        description: string;
        tone: string;
    };
    categories: QACategory[];
    fallback: {
        noMatch: string;
        useGemini: boolean;
        geminiPrompt: string;
    };
}

export interface BotConfig {
    geminiApiKey?: string;
    enabled: boolean;
    activeChats: string[];
}

// ==========================================
// Chat Filter Types
// ==========================================

export type ChatFilterType = 'all' | 'unread' | 'groups' | 'custom';

export interface ChatFilter {
    type: ChatFilterType;
    customGroupId?: string;
}
