
import { BroadcastRepository, BroadcastDocument } from '../persistence/BroadcastRepository';
import BotService from './botService';
import Logger from './loggerService';

export class FirestoreBroadcastService {
    private static instance: FirestoreBroadcastService;
    private repository: BroadcastRepository;
    private botService: BotService;
    private isRunning: boolean = false;
    private intervalId: NodeJS.Timeout | null = null;
    private processingIds: Set<string> = new Set();

    private constructor() {
        this.repository = BroadcastRepository.getInstance();
        this.botService = BotService.getInstance();
    }

    public static getInstance(): FirestoreBroadcastService {
        if (!FirestoreBroadcastService.instance) {
            FirestoreBroadcastService.instance = new FirestoreBroadcastService();
        }
        return FirestoreBroadcastService.instance;
    }

    /**
     * Start the background worker
     */
    public start(intervalMs: number = 30000): void {
        if (this.isRunning) return;

        this.isRunning = true;
        Logger.info('[FirestoreBroadcast] Background worker started');

        // Run immediately
        this.checkAndExecute();

        // Schedule periodic checks
        this.intervalId = setInterval(() => {
            this.checkAndExecute();
        }, intervalMs);
    }

    public stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        Logger.info('[FirestoreBroadcast] Background worker stopped');
    }

    public getStatus(): any {
        const bot = this.botService.getBot();
        return {
            isRunning: this.isRunning,
            isBotConnected: bot ? bot.isReady() : false,
            processingCount: this.processingIds.size,
            processingIds: Array.from(this.processingIds),
            lastCheck: new Date().toISOString()
        };
    }

    private async checkAndExecute(): Promise<void> {
        if (!this.isRunning) return;

        try {
            // Check bot status first
            const bot = this.botService.getBot();
            if (!bot || !bot.isReady()) {
                Logger.warn('[FirestoreBroadcast] skipping check: Bot not connected');
                return;
            }

            // 1. Get broadcasts that need execution
            const pending = await this.repository.getPendingExecution();
            const immediate = await this.repository.getImmediateExecution();

            Logger.debug(`[FirestoreBroadcast] Pending: ${pending.length}, Immediate: ${immediate.length}`);

            const toExecute = [...pending, ...immediate].filter(b => {
                const isProcessing = this.processingIds.has(b.id);
                if (isProcessing) {
                    Logger.debug(`[FirestoreBroadcast] Broadcast ${b.id} is already being processed`);
                }
                return !isProcessing;
            });

            if (toExecute.length === 0) {
                if (pending.length > 0 || immediate.length > 0) {
                    Logger.debug('[FirestoreBroadcast] All potential broadcasts are already processing');
                }
                return;
            }

            Logger.info(`[FirestoreBroadcast] Found ${toExecute.length} broadcasts to execute`);

            for (const broadcast of toExecute) {
                // Execute without blocking the loop
                this.executeBroadcast(broadcast).catch(err => {
                    Logger.error(`[FirestoreBroadcast] Failed to execute broadcast ${broadcast.id}:`, err);
                });
            }
        } catch (error) {
            Logger.error('[FirestoreBroadcast] Error in check loop:', error);
        }
    }

    private async executeBroadcast(broadcast: BroadcastDocument): Promise<void> {
        if (this.processingIds.has(broadcast.id)) return;
        this.processingIds.add(broadcast.id);

        Logger.info(`[FirestoreBroadcast] Starting execution for: ${broadcast.nombre}`);

        let sent = 0;
        let failed = 0;

        try {
            // Update status to 'enviando' if it was 'programado'
            if (broadcast.estado === 'programado') {
                await this.repository.updateStatus(broadcast.id, 'enviando');
            }

            for (const phone of broadcast.destinatarios) {
                try {
                    if (!phone) continue;

                    // Normalize phone: remove non-digits and add @s.whatsapp.net
                    const cleanPhone = phone.replace(/\D/g, '');
                    const jid = `${cleanPhone}@s.whatsapp.net`;

                    Logger.info(`[FirestoreBroadcast] Sending to ${jid}`);

                    // Use BotService to send
                    await this.botService.sendText(jid, broadcast.mensaje);
                    sent++;

                    // Update progress every 5 messages or at the end
                    if (sent % 5 === 0) {
                        await this.repository.updateProgress(broadcast.id, sent, failed);
                    }

                    // Small delay between messages to avoid spam detection
                    await new Promise(resolve => setTimeout(resolve, 3000));
                } catch (err) {
                    Logger.error(`[FirestoreBroadcast] Error sending to ${phone}:`, err);
                    failed++;
                }
            }

            // Final update
            await this.repository.updateStatus(broadcast.id, 'completado', {
                enviados: sent,
                fallidos: failed,
                fecha_envio: new Date()
            });

            Logger.info(`[FirestoreBroadcast] Broadcast "${broadcast.nombre}" completed: ${sent} sent, ${failed} failed`);

        } catch (error) {
            Logger.error(`[FirestoreBroadcast] Critical error in broadcast ${broadcast.id}:`, error);
            await this.repository.updateStatus(broadcast.id, 'fallido');
        } finally {
            this.processingIds.delete(broadcast.id);
        }
    }
}

export default FirestoreBroadcastService;
