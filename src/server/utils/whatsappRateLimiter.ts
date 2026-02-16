/**
 * WhatsAppRateLimiter - Rate limiting específico para WhatsApp API
 */

interface RateLimitConfig {
    maxMessagesPerSecond: number;
    maxMessagesPerMinute: number;
    maxMessagesPerHour: number;
    maxMessagesPerDay: number;
    
    // Límites específicos para grupos
    groupMultiplier: number; // Más restrictivo para grupos
    
    // Burst handling
    burstAllowance: number;
    burstRecoveryRateMs: number;
}

interface ChatLimits {
    lastMessageTime: number;
    messagesThisSecond: number;
    messagesThisMinute: number;
    messagesThisHour: number;
    messagesThisDay: number;
    
    // Burst tracking
    burstTokens: number;
    lastBurstRecovery: number;
    
    // Historial para análisis de patrones
    recentMessages: Array<{ timestamp: number; type: 'text' | 'media' | 'group' }>;
}

export class WhatsAppRateLimiter {
    private static instance: WhatsAppRateLimiter;
    private chatLimits = new Map<string, ChatLimits>();
    private globalLimits: ChatLimits;
    private config: RateLimitConfig;
    private cleanupInterval: ReturnType<typeof setInterval> | null = null;
    private dailyResetInterval: ReturnType<typeof setInterval> | null = null;

    private constructor() {
        this.config = {
            maxMessagesPerSecond: 1,
            maxMessagesPerMinute: 10,
            maxMessagesPerHour: 60,
            maxMessagesPerDay: 1000,
            groupMultiplier: 0.5, // 50% más lento para grupos
            burstAllowance: 5,
            burstRecoveryRateMs: 2000 // 2 segundos por token
        };

        // Inicializar límites globales
        this.globalLimits = {
            lastMessageTime: 0,
            messagesThisSecond: 0,
            messagesThisMinute: 0,
            messagesThisHour: 0,
            messagesThisDay: 0,
            burstTokens: this.config.burstAllowance,
            lastBurstRecovery: Date.now(),
            recentMessages: []
        };

        // Cleanup cada hora (stored for shutdown)
        this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 60 * 1000);
        // Reset diario (stored for shutdown)
        this.dailyResetInterval = setInterval(() => this.resetDaily(), 24 * 60 * 60 * 1000);
    }
    
    static getInstance(): WhatsAppRateLimiter {
        if (!WhatsAppRateLimiter.instance) {
            WhatsAppRateLimiter.instance = new WhatsAppRateLimiter();
        }
        return WhatsAppRateLimiter.instance;
    }
    
    /**
     * Verifica si se puede enviar un mensaje a un chat específico
     */
    async canSendMessage(jid: string, messageType: 'text' | 'media' = 'text'): Promise<{
        canSend: boolean;
        waitTime: number;
        reason?: string;
        retryAt?: Date;
    }> {
        const now = Date.now();
        const isGroup = jid.endsWith('@g.us');
        const multiplier = isGroup ? this.config.groupMultiplier : 1;
        
        // Obtener o crear límites del chat
        let chatLimits = this.chatLimits.get(jid);
        if (!chatLimits) {
            chatLimits = {
                lastMessageTime: 0,
                messagesThisSecond: 0,
                messagesThisMinute: 0,
                messagesThisHour: 0,
                messagesThisDay: 0,
                burstTokens: this.config.burstAllowance,
                lastBurstRecovery: now,
                recentMessages: []
            };
            this.chatLimits.set(jid, chatLimits);
        }
        
        // Resetear contadores por períodos
        this.resetCounters(chatLimits, now);

        // Recover burst tokens before checking limits
        this.recoverBurstTokens(chatLimits, now);

        // Verificar límites de tiempo
        const timeSinceLastMessage = now - chatLimits.lastMessageTime;
        const minIntervalMs = isGroup ? 3000 : 2000; // 3s grupos, 2s chats
        
        if (timeSinceLastMessage < minIntervalMs) {
            return {
                canSend: false,
                waitTime: minIntervalMs - timeSinceLastMessage,
                reason: 'minimum_interval',
                retryAt: new Date(now + minIntervalMs - timeSinceLastMessage)
            };
        }
        
        // Verificar burst tokens
        if (chatLimits.burstTokens <= 0) {
            const recoveryTime = this.config.burstRecoveryRateMs;
            return {
                canSend: false,
                waitTime: recoveryTime,
                reason: 'burst_limit_exceeded',
                retryAt: new Date(now + recoveryTime)
            };
        }
        
        // Verificar límites por segundo
        if (chatLimits.messagesThisSecond >= Math.ceil(this.config.maxMessagesPerSecond * multiplier)) {
            return {
                canSend: false,
                waitTime: 1000,
                reason: 'per_second_limit',
                retryAt: new Date(now + 1000)
            };
        }
        
        // Verificar límites por minuto
        if (chatLimits.messagesThisMinute >= Math.ceil(this.config.maxMessagesPerMinute * multiplier)) {
            const waitTime = 60000 - (now % 60000);
            return {
                canSend: false,
                waitTime,
                reason: 'per_minute_limit',
                retryAt: new Date(now + waitTime)
            };
        }
        
        // Verificar límites por hora
        if (chatLimits.messagesThisHour >= Math.ceil(this.config.maxMessagesPerHour * multiplier)) {
            const waitTime = 3600000 - (now % 3600000);
            return {
                canSend: false,
                waitTime,
                reason: 'per_hour_limit',
                retryAt: new Date(now + waitTime)
            };
        }
        
        // Verificar límites diarios
        if (chatLimits.messagesThisDay >= Math.ceil(this.config.maxMessagesPerDay * multiplier)) {
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            
            return {
                canSend: false,
                waitTime: tomorrow.getTime() - now,
                reason: 'daily_limit_exceeded',
                retryAt: tomorrow
            };
        }
        
        // Verificar patrón de spam (mensajes idénticos)
        const recentIdentical = chatLimits.recentMessages.filter(
            msg => msg.timestamp > now - 30000 && msg.type === messageType // Últimos 30s
        ).length;
        
        if (recentIdentical >= 3) {
            return {
                canSend: false,
                waitTime: 30000,
                reason: 'duplicate_pattern_detected',
                retryAt: new Date(now + 30000)
            };
        }
        
        // Todo OK para enviar
        return { canSend: true, waitTime: 0 };
    }
    
    /**
     * Registra que se envió un mensaje
     */
    recordSentMessage(jid: string, messageType: 'text' | 'media' = 'text'): void {
        const now = Date.now();
        const chatLimits = this.chatLimits.get(jid);
        
        if (!chatLimits) return;
        
        // Actualizar contadores
        chatLimits.lastMessageTime = now;
        chatLimits.messagesThisSecond++;
        chatLimits.messagesThisMinute++;
        chatLimits.messagesThisHour++;
        chatLimits.messagesThisDay++;
        chatLimits.burstTokens--;
        
        // Agregar al historial reciente
        chatLimits.recentMessages.push({
            timestamp: now,
            type: messageType
        });
        
        // Limitar tamaño del historial reciente
        if (chatLimits.recentMessages.length > 50) {
            chatLimits.recentMessages = chatLimits.recentMessages.slice(-50);
        }
    }
    
    /**
     * Resetea contadores según tiempo transcurrido
     */
    private resetCounters(limits: ChatLimits, now: number): void {
        const currentSecond = Math.floor(now / 1000);
        const currentMinute = Math.floor(now / 60000);
        const currentHour = Math.floor(now / 3600000);
        const currentDay = Math.floor(now / 86400000);
        
        const lastSecond = Math.floor(limits.lastMessageTime / 1000);
        const lastMinute = Math.floor(limits.lastMessageTime / 60000);
        const lastHour = Math.floor(limits.lastMessageTime / 3600000);
        const lastDay = Math.floor(limits.lastMessageTime / 86400000);
        
        if (currentSecond !== lastSecond) {
            limits.messagesThisSecond = 0;
        }
        
        if (currentMinute !== lastMinute) {
            limits.messagesThisMinute = 0;
        }
        
        if (currentHour !== lastHour) {
            limits.messagesThisHour = 0;
        }
        
        if (currentDay !== lastDay) {
            limits.messagesThisDay = 0;
        }
    }
    
    /**
     * Recupera burst tokens gradualmente
     */
    private recoverBurstTokens(limits: ChatLimits, now: number): void {
        const timeSinceRecovery = now - limits.lastBurstRecovery;
        const tokensToRecover = Math.floor(timeSinceRecovery / this.config.burstRecoveryRateMs);
        
        if (tokensToRecover > 0) {
            limits.burstTokens = Math.min(
                this.config.burstAllowance,
                limits.burstTokens + tokensToRecover
            );
            limits.lastBurstRecovery = now;
        }
    }
    
    /**
     * Limpia datos viejos
     */
    private cleanup(): void {
        const now = Date.now();
        const cutoff = now - 60 * 60 * 1000; // 1 hora
        
        for (const [jid, limits] of this.chatLimits.entries()) {
            // Limpiar historial reciente
            limits.recentMessages = limits.recentMessages.filter(
                msg => msg.timestamp > cutoff
            );
            
            // Recuperar burst tokens
            this.recoverBurstTokens(limits, now);
            
            // Eliminar chats inactivos por mucho tiempo
            if (now - limits.lastMessageTime > 24 * 60 * 60 * 1000) { // 24 horas
                this.chatLimits.delete(jid);
            }
        }
    }
    
    /**
     * Resetea contadores diarios
     */
    private resetDaily(): void {
        console.log('[WhatsAppRateLimiter] Daily reset - clearing daily counters');
        
        for (const limits of this.chatLimits.values()) {
            limits.messagesThisDay = 0;
        }
        
        this.globalLimits.messagesThisDay = 0;
    }
    
    /**
     * Obtiene estadísticas de rate limiting
     */
    getStats(): {
        totalChats: number;
        activeChatsLastHour: number;
        averageMessagesPerMinute: number;
        chatsNearLimits: Array<{ jid: string; percentageUsage: number; limitType: string }>;
    } {
        const now = Date.now();
        const oneHourAgo = now - 60 * 60 * 1000;
        
        let activeChats = 0;
        let totalMessagesInHour = 0;
        const nearLimitChats: Array<{ jid: string; percentageUsage: number; limitType: string }> = [];
        
        for (const [jid, limits] of this.chatLimits.entries()) {
            if (limits.lastMessageTime > oneHourAgo) {
                activeChats++;
                totalMessagesInHour += limits.messagesThisHour;
            }
            
            // Verificar qué chats están cerca de límites
            const minuteUsage = (limits.messagesThisMinute / this.config.maxMessagesPerMinute) * 100;
            const hourUsage = (limits.messagesThisHour / this.config.maxMessagesPerHour) * 100;
            const dayUsage = (limits.messagesThisDay / this.config.maxMessagesPerDay) * 100;
            
            const maxUsage = Math.max(minuteUsage, hourUsage, dayUsage);
            if (maxUsage > 80) { // 80% o más de algún límite
                let limitType = 'minute';
                if (hourUsage >= minuteUsage && hourUsage >= dayUsage) limitType = 'hour';
                else if (dayUsage >= minuteUsage && dayUsage >= hourUsage) limitType = 'day';
                
                nearLimitChats.push({
                    jid,
                    percentageUsage: maxUsage,
                    limitType
                });
            }
        }
        
        return {
            totalChats: this.chatLimits.size,
            activeChatsLastHour: activeChats,
            averageMessagesPerMinute: activeChats > 0 ? totalMessagesInHour / 60 : 0,
            chatsNearLimits: nearLimitChats.slice(0, 10) // Top 10
        };
    }
    
    /**
     * Actualiza configuración
     */
    updateConfig(newConfig: Partial<RateLimitConfig>): void {
        Object.assign(this.config, newConfig);
        console.log('[WhatsAppRateLimiter] Configuration updated:', this.config);
    }
    
    /**
     * Wait until a message can be sent, then return.
     * If rate limited, automatically waits the required time.
     * Returns false if daily limit exceeded (caller should not send).
     */
    async waitForSendSlot(jid: string, messageType: 'text' | 'media' = 'text'): Promise<{ allowed: boolean; waitedMs: number; reason?: string }> {
        const maxWaitMs = 120_000; // 2 minutes max wait
        let totalWaited = 0;

        while (totalWaited < maxWaitMs) {
            const check = await this.canSendMessage(jid, messageType);

            if (check.canSend) {
                return { allowed: true, waitedMs: totalWaited };
            }

            // Daily limit exceeded — don't wait, just deny
            if (check.reason === 'daily_limit_exceeded') {
                console.warn(`[WhatsAppRateLimiter] Daily limit exceeded for ${jid}`);
                return { allowed: false, waitedMs: totalWaited, reason: check.reason };
            }

            // Wait the required time
            const waitTime = Math.min(check.waitTime, maxWaitMs - totalWaited);
            if (waitTime <= 0) break;

            await new Promise(resolve => setTimeout(resolve, waitTime));
            totalWaited += waitTime;
        }

        return { allowed: false, waitedMs: totalWaited, reason: 'max_wait_exceeded' };
    }

    /**
     * Shutdown: clear all intervals to prevent memory leaks
     */
    shutdown(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        if (this.dailyResetInterval) {
            clearInterval(this.dailyResetInterval);
            this.dailyResetInterval = null;
        }
        console.log('[WhatsAppRateLimiter] Shutdown complete — intervals cleared');
    }

    /**
     * Limpia todos los datos (para testing)
     */
    clearAll(): void {
        this.chatLimits.clear();
        console.log('[WhatsAppRateLimiter] All data cleared');
    }
}