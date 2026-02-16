/**
 * MessageProcessor - Procesamiento seguro de mensajes con prevención de race conditions
 */

import { EventEmitter } from 'events';

interface QueuedMessage {
    id: string;
    jid: string;
    message: any;
    timestamp: number;
    resolve: (result: any) => void;
    reject: (error: any) => void;
}

export class MessageProcessor extends EventEmitter {
    private processingChats = new Map<string, Promise<any>>();
    private messageQueue = new Map<string, QueuedMessage[]>();
    private maxQueueSize = 10;
    private queueTimeoutMs = 30000; // 30 segundos

    /**
     * Procesa mensaje de forma thread-safe por chat
     */
    async processMessage(jid: string, message: any): Promise<any> {
        // Verificar si ya hay procesamiento en curso para este chat
        const existingPromise = this.processingChats.get(jid);
        
        if (existingPromise) {
            // Encolar mensaje si ya hay procesamiento
            return this.enqueueMessage(jid, message);
        }

        // Crear nueva promesa de procesamiento
        const processingPromise = this.processMessageInternal(jid, message);
        
        // Guardar promesa y limpiar al finalizar
        this.processingChats.set(jid, processingPromise);
        
        try {
            const result = await processingPromise;
            return result;
        } finally {
            this.processingChats.delete(jid);
            this.processNextQueued(jid);
        }
    }

    /**
     * Encola mensaje para procesamiento secuencial
     */
    private async enqueueMessage(jid: string, message: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const queue = this.messageQueue.get(jid) || [];
            
            // Limitar tamaño de cola
            if (queue.length >= this.maxQueueSize) {
                reject(new Error(`Queue full for chat ${jid}`));
                return;
            }

            const queuedMessage: QueuedMessage = {
                id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                jid,
                message,
                timestamp: Date.now(),
                resolve,
                reject
            };

            queue.push(queuedMessage);
            this.messageQueue.set(jid, queue);

            // Timeout para mensajes en cola
            setTimeout(() => {
                const index = queue.findIndex(m => m.id === queuedMessage.id);
                if (index !== -1) {
                    queue.splice(index, 1);
                    reject(new Error(`Message timeout for chat ${jid}`));
                }
            }, this.queueTimeoutMs);
        });
    }

    /**
     * Procesa el siguiente mensaje en cola
     */
    private processNextQueued(jid: string): void {
        const queue = this.messageQueue.get(jid);
        if (!queue || queue.length === 0) return;

        const nextMessage = queue.shift();
        if (!nextMessage) return;

        // Procesar siguiente mensaje
        this.processMessageInternal(jid, nextMessage.message)
            .then(result => nextMessage.resolve(result))
            .catch(error => nextMessage.reject(error));
    }

    /**
     * Procesamiento interno del mensaje
     */
    private async processMessageInternal(jid: string, message: any): Promise<any> {
        try {
            // Emitir evento de inicio
            this.emit('processing:start', { jid, messageId: message.id });

            // Si el mensaje incluye el botService, usamos la lógica real
            if (message.botService) {
                return await this.processWithBotService(jid, message, message.botService);
            }

            // Aquí va la lógica real de procesamiento
            // Por ahora, simulamos procesamiento
            await new Promise(resolve => setTimeout(resolve, 100));

            // Emitir evento de finalización
            this.emit('processing:complete', { jid, messageId: message.id });

            return { success: true, processed: true };
        } catch (error) {
            this.emit('processing:error', { jid, messageId: message.id, error });
            throw error;
        }
    }

    /**
     * Procesamiento usando la lógica real del BotService
     */
    private async processWithBotService(jid: string, message: any, botService: any): Promise<any> {
        const { messageText, isFromMe, rawRemoteJid, context } = message;
        
        try {
            // Validar y sanitizar mensaje
            const sanitizedMessage = botService.sanitizeMessage ? botService.sanitizeMessage(messageText) : messageText;
            
            // Anti-loop checks
            const skipCheck = botService.shouldSkipMessage ? botService.shouldSkipMessage(jid, sanitizedMessage, isFromMe) : { skip: false };
            if (skipCheck.skip) {
                console.log(`[MessageProcessor] Message skipped: ${skipCheck.reason}`);
                return { skipped: true, reason: skipCheck.reason };
            }

            // Record metric
            const isGroup = botService.isGroupJid ? botService.isGroupJid(rawRemoteJid) : false;
            botService.metrics?.messageReceived(jid, sanitizedMessage.length, isGroup);

            // Check triggers
            const triggerCheck = botService.triggerService?.shouldActivateBot(sanitizedMessage, jid);
            const triggerContext = botService.triggerService?.analyzeContext(sanitizedMessage);
            if (!triggerCheck?.activate) {
                console.log(`[MessageProcessor] Message skipped - listener disabled or no trigger matched`);
                return { skipped: true, reason: 'no_trigger' };
            }

            // Emit keyword automation event for observability/dashboard
            if (triggerContext?.matchedTriggers?.length) {
                botService.io?.emit('automation:keyword:detected', {
                    jid,
                    message: sanitizedMessage,
                    triggerIds: triggerContext.triggerIds,
                    keywords: triggerContext.keywords,
                    categories: triggerContext.categories
                });
            }

            // Log matched triggers
            if (triggerCheck?.triggers?.length > 0) {
                console.log(`[MessageProcessor] Triggers matched: ${triggerCheck.triggers.map(t => t.keyword).join(', ')}`);
                botService.io?.emit('trigger:matched', {
                    jid,
                    message: sanitizedMessage,
                    triggers: triggerCheck.triggers.map(t => ({ id: t.id, keyword: t.keyword, category: t.category }))
                });
            }

            // Process with orchestrator
            const customerName = context.senderDisplayName || 'Cliente';
            const { BotOrchestrator } = await import('../../agents/BotOrchestrator');
            const orchestrator = BotOrchestrator.getInstance();
            const response = await orchestrator.processMessage(
                jid,
                sanitizedMessage,
                isFromMe,
                customerName,
                {
                    triggerKeywords: triggerContext?.keywords || [],
                    triggerCategories: triggerContext?.categories || [],
                    triggerIds: triggerContext?.triggerIds || []
                }
            );

            if (response && response.response) {
                // Show typing indicator
                await botService.sendPresenceUpdate?.(jid, 'composing').catch(() => {});

                // Add typing delay
                const config = orchestrator?.getConfig();
                if (config?.settings?.typingIndicator) {
                    await new Promise(resolve => setTimeout(resolve, config.settings.typingDelayMs));
                }

                // Rate limit check using waitForRateLimit method
                await botService.waitForRateLimit?.(jid);

                // Send response
                await botService.sendText?.(jid, response.response);

                // Track for anti-loop
                if (botService.sentMessages && botService.hashMessage) {
                    botService.sentMessages.set(jid, {
                        lastSentAt: Date.now(),
                        messageHash: botService.hashMessage(jid, response.response)
                    });
                }

                // Emit bot response event
                botService.io?.emit('bot:response', {
                    jid,
                    response: response.response,
                    source: response.source,
                    confidence: response.confidence
                });

                await botService.sendPresenceUpdate?.(jid, 'paused').catch(() => {});

                console.log(`[MessageProcessor] Response sent to ${jid} (source: ${response.source})`);
            }

            return { success: true, processed: true };
        } catch (error) {
            botService.metrics?.error('message_processing', error.message || String(error), jid);
            await botService.sendPresenceUpdate?.(jid, 'paused').catch(() => {});
            throw error;
        }
    }

    /**
     * Obtiene estadísticas de procesamiento
     */
    getStats(): {
        processingChats: number;
        queuedMessages: number;
        queueByChat: Array<{ jid: string; count: number }>;
    } {
        const queueByChat = Array.from(this.messageQueue.entries())
            .map(([jid, queue]) => ({ jid, count: queue.length }))
            .filter(item => item.count > 0);

        return {
            processingChats: this.processingChats.size,
            queuedMessages: Array.from(this.messageQueue.values())
                .reduce((total, queue) => total + queue.length, 0),
            queueByChat
        };
    }

    /**
     * Limpia cola de un chat específico
     */
    clearQueue(jid: string): number {
        const queue = this.messageQueue.get(jid);
        if (!queue) return 0;

        const count = queue.length;
        queue.forEach(msg => msg.reject(new Error('Queue cleared')));
        this.messageQueue.delete(jid);

        return count;
    }

    /**
     * Limpia todas las colas (para shutdown)
     */
    clearAllQueues(): number {
        let totalCleared = 0;
        
        for (const [jid, queue] of this.messageQueue.entries()) {
            totalCleared += queue.length;
            queue.forEach(msg => msg.reject(new Error('System shutdown')));
        }
        
        this.messageQueue.clear();
        return totalCleared;
    }
}
