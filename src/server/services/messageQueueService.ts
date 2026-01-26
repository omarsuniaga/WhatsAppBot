import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
    MessageQueueData,
    QueueMessage,
    QueueMessageType,
    QueueStatus,
    TargetType
} from '../types';
import RateLimitService from './rateLimitService';
import BotService from './botService';

const DATA_PATH = join(process.cwd(), 'data', 'message-queue.json');
const PROCESSED_LIMIT = 500; // Keep last 500 processed messages
const PROCESS_INTERVAL_MS = 500; // Check queue every 500ms

class MessageQueueService {
    private static instance: MessageQueueService;
    private data: MessageQueueData;
    private isProcessing: boolean = false;
    private processingInterval: NodeJS.Timeout | null = null;

    private constructor() {
        this.data = this.loadData();
        this.startProcessing();
    }

    static getInstance(): MessageQueueService {
        if (!MessageQueueService.instance) {
            MessageQueueService.instance = new MessageQueueService();
        }
        return MessageQueueService.instance;
    }

    private getDefaultData(): MessageQueueData {
        return {
            version: 1,
            lastProcessed: new Date().toISOString(),
            queue: [],
            processed: []
        };
    }

    private loadData(): MessageQueueData {
        try {
            if (existsSync(DATA_PATH)) {
                return JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
            }
        } catch (error) {
            console.error('Error loading message queue:', error);
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
            console.error('Error saving message queue:', error);
        }
    }

    /**
     * Add a single message to the queue
     */
    enqueue(
        type: QueueMessageType,
        target: string,
        content: Record<string, any>,
        options: {
            targetType?: TargetType;
            priority?: number;
            scheduledFor?: Date;
        } = {}
    ): QueueMessage {
        // Determine target type from JID if not specified
        let targetType: TargetType = options.targetType || 'individual';
        if (!options.targetType) {
            if (target.includes('@g.us')) {
                targetType = 'group';
            } else if (target.includes('@broadcast')) {
                targetType = 'broadcast';
            }
        }

        const message: QueueMessage = {
            id: uuidv4(),
            type,
            target,
            targetType,
            content,
            priority: options.priority || 1,
            status: 'pending',
            attempts: 0,
            maxAttempts: 3,
            scheduledFor: (options.scheduledFor || new Date()).toISOString(),
            createdAt: new Date().toISOString(),
            processedAt: null,
            error: null
        };

        this.data.queue.push(message);
        // Sort by priority (higher first)
        this.data.queue.sort((a, b) => b.priority - a.priority);
        this.saveData();

        console.log(`[Queue] Message ${message.id} enqueued for ${target}`);

        return message;
    }

    /**
     * Add multiple messages to the queue (for bulk sending to contact groups)
     */
    enqueueBulk(
        type: QueueMessageType,
        targets: string[],
        content: Record<string, any>,
        options: { priority?: number } = {}
    ): QueueMessage[] {
        const messages: QueueMessage[] = [];

        for (const target of targets) {
            const msg = this.enqueue(type, target, content, {
                targetType: 'individual',
                priority: options.priority || 1
            });
            messages.push(msg);
        }

        console.log(`[Queue] ${messages.length} messages enqueued for bulk send`);

        return messages;
    }

    /**
     * Start the queue processing loop
     */
    private startProcessing(): void {
        if (this.processingInterval) return;

        this.processingInterval = setInterval(() => {
            this.processNext();
        }, PROCESS_INTERVAL_MS);

        console.log('[Queue] Processing started');
    }

    /**
     * Stop the queue processing loop
     */
    stopProcessing(): void {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
            console.log('[Queue] Processing stopped');
        }
    }

    /**
     * Process the next message in the queue
     */
    private async processNext(): Promise<void> {
        if (this.isProcessing) return;

        const rateLimitService = RateLimitService.getInstance();
        const botService = BotService.getInstance();

        // Find next pending message that's ready to send
        const message = this.data.queue.find(
            (m) => m.status === 'pending' && new Date(m.scheduledFor) <= new Date()
        );

        if (!message) return;

        // Check rate limit for individual messages only
        if (message.targetType === 'individual') {
            const status = rateLimitService.canSendIndividual();
            if (!status.canSend) {
                return; // Wait for rate limit to reset
            }
        }

        this.isProcessing = true;
        message.status = 'processing';
        message.attempts++;

        try {
            // Apply random delay for individual messages to appear more human
            if (message.targetType === 'individual') {
                const delay = rateLimitService.getRandomDelay();
                await this.sleep(delay);
            }

            // Send the message
            await this.sendMessage(botService, message);

            // Mark as completed
            message.status = 'completed';
            message.processedAt = new Date().toISOString();

            // Record in rate limit tracker
            rateLimitService.recordMessage(message.target, true, message.targetType);

            console.log(`[Queue] Message ${message.id} sent successfully`);
        } catch (error: any) {
            message.error = error.message;

            if (message.attempts >= message.maxAttempts) {
                message.status = 'failed';
                message.processedAt = new Date().toISOString();
                console.error(`[Queue] Message ${message.id} failed permanently:`, error.message);
            } else {
                message.status = 'pending';
                // Schedule retry with exponential backoff
                const backoff = Math.pow(2, message.attempts) * 1000;
                message.scheduledFor = new Date(Date.now() + backoff).toISOString();
                console.warn(`[Queue] Message ${message.id} will retry in ${backoff}ms`);
            }

            rateLimitService.recordMessage(message.target, false, message.targetType);
        }

        // Move to processed if final status
        if (message.status === 'completed' || message.status === 'failed') {
            this.data.queue = this.data.queue.filter((m) => m.id !== message.id);
            this.data.processed.unshift(message);

            // Limit processed history
            if (this.data.processed.length > PROCESSED_LIMIT) {
                this.data.processed = this.data.processed.slice(0, PROCESSED_LIMIT);
            }
        }

        this.data.lastProcessed = new Date().toISOString();
        this.saveData();
        this.isProcessing = false;
    }

    private async sendMessage(botService: BotService, message: QueueMessage): Promise<any> {
        const { type, target, content } = message;

        switch (type) {
            case 'text':
                return botService.sendText(target, content.message);
            case 'media':
                return botService.sendMedia(target, content.mediaUrl, content.caption || '');
            case 'file':
                return botService.sendFile(target, content.fileUrl || content.filePath);
            case 'location':
                return botService.sendLocation(target, content.latitude, content.longitude);
            case 'contact':
                return botService.sendContact(target, content.contactNumber, content.displayName);
            case 'poll':
                return botService.sendPoll(target, content.question, content.options);
            case 'sticker':
                return botService.sendSticker(target, content.stickerUrl, content.stickerOptions || {});
            default:
                throw new Error(`Unsupported message type: ${type}`);
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Get queue status summary
     */
    getQueueStatus(): QueueStatus {
        return {
            pending: this.data.queue.filter((m) => m.status === 'pending').length,
            processing: this.data.queue.filter((m) => m.status === 'processing').length,
            completed: this.data.processed.filter((m) => m.status === 'completed').length,
            failed: this.data.processed.filter((m) => m.status === 'failed').length,
            queue: this.data.queue
        };
    }

    /**
     * Get a specific message by ID
     */
    getMessage(messageId: string): QueueMessage | undefined {
        return (
            this.data.queue.find((m) => m.id === messageId) ||
            this.data.processed.find((m) => m.id === messageId)
        );
    }

    /**
     * Cancel a pending message
     */
    cancel(messageId: string): boolean {
        const index = this.data.queue.findIndex(
            (m) => m.id === messageId && m.status === 'pending'
        );
        if (index !== -1) {
            this.data.queue.splice(index, 1);
            this.saveData();
            console.log(`[Queue] Message ${messageId} cancelled`);
            return true;
        }
        return false;
    }

    /**
     * Cancel all pending messages
     */
    clearQueue(): number {
        const count = this.data.queue.filter((m) => m.status === 'pending').length;
        this.data.queue = this.data.queue.filter((m) => m.status !== 'pending');
        this.saveData();
        console.log(`[Queue] ${count} pending messages cleared`);
        return count;
    }

    /**
     * Clear processed history
     */
    clearHistory(): void {
        this.data.processed = [];
        this.saveData();
        console.log('[Queue] History cleared');
    }
}

export default MessageQueueService;
