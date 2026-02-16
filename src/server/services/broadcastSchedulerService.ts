/**
 * BroadcastSchedulerService
 * Monitors scheduled campaigns and executes them automatically at the specified time.
 * Uses node-cron to check every minute for campaigns that need to be started.
 */

import { EventEmitter } from 'events';
import { getErrorMessage } from '../utils/errorUtils';

// Type for cron job (dynamic import to handle missing module)
type CronTask = {
    stop: () => void;
    start: () => void;
};

export interface SchedulerStatus {
    isRunning: boolean;
    scheduledCampaignsCount: number;
    lastCheck: string | null;
    nextCheck: string;
}

export interface CampaignAutoStartEvent {
    campaignId: string;
    name: string;
    scheduledFor: Date;
}

export interface CampaignAutoStartFailedEvent {
    campaignId: string;
    name: string;
    error: string;
}

class BroadcastSchedulerService extends EventEmitter {
    private static instance: BroadcastSchedulerService;
    private cronJob: CronTask | null = null;
    private isRunning: boolean = false;
    private lastCheck: Date | null = null;
    private cronAvailable: boolean = false;

    private constructor() {
        super();
    }

    static getInstance(): BroadcastSchedulerService {
        if (!BroadcastSchedulerService.instance) {
            BroadcastSchedulerService.instance = new BroadcastSchedulerService();
        }
        return BroadcastSchedulerService.instance;
    }

    /**
     * Start the scheduler - runs every 60 seconds to check for scheduled campaigns
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            console.log('[BroadcastScheduler] Already running');
            return;
        }

        try {
            // Dynamic import to handle missing node-cron gracefully
            const cron = await import('node-cron');
            this.cronAvailable = true;

            // Run every minute
            this.cronJob = cron.schedule('* * * * *', () => {
                this.checkScheduledCampaigns();
            });

            this.isRunning = true;
            console.log('[BroadcastScheduler] Started - checking every 60 seconds');

            // Check for missed campaigns on startup
            await this.checkMissedCampaigns();

        } catch (error: unknown) {
            console.warn('[BroadcastScheduler] node-cron not available, using setInterval fallback');
            this.cronAvailable = false;

            // Fallback to setInterval if node-cron is not installed
            const intervalId = setInterval(() => {
                this.checkScheduledCampaigns();
            }, 60000); // Every 60 seconds

            // Store interval as a mock cron task
            this.cronJob = {
                stop: () => clearInterval(intervalId),
                start: () => { } // No-op for interval
            };

            this.isRunning = true;
            console.log('[BroadcastScheduler] Started with setInterval fallback - checking every 60 seconds');

            // Check for missed campaigns on startup
            await this.checkMissedCampaigns();
        }
    }

    /**
     * Check for campaigns that should be executed NOW
     */
    private async checkScheduledCampaigns(): Promise<void> {
        this.lastCheck = new Date();

        try {
            // Dynamic import to avoid circular dependency
            const { BroadcastService } = await import('./broadcastService');
            const broadcastService = BroadcastService.getInstance();
            const campaigns = broadcastService.getCampaigns();

            for (const campaign of campaigns) {
                if (campaign.status !== 'scheduled') continue;
                if (!campaign.schedule) continue;

                const scheduleDate = new Date(campaign.schedule);
                const now = new Date();

                // Execute if scheduled time has passed or is within 2 minute window
                const twoMinutesFromNow = new Date(now.getTime() + 120000);

                if (scheduleDate <= twoMinutesFromNow) {
                    console.log(`[BroadcastScheduler] Starting campaign "${campaign.name}" (scheduled: ${scheduleDate.toISOString()})`);

                    try {
                        const result = await broadcastService.startCampaign(campaign.id);

                        if (result.success) {
                            console.log(`[BroadcastScheduler] Campaign "${campaign.name}" started successfully`);

                            this.emit('campaign:auto-started', {
                                campaignId: campaign.id,
                                name: campaign.name,
                                scheduledFor: scheduleDate
                            } as CampaignAutoStartEvent);
                        } else {
                            console.error(`[BroadcastScheduler] Failed to start "${campaign.name}":`, result.error);

                            this.emit('campaign:auto-start-failed', {
                                campaignId: campaign.id,
                                name: campaign.name,
                                error: result.error || 'Unknown error'
                            } as CampaignAutoStartFailedEvent);
                        }
                    } catch (error: unknown) {
                        console.error(`[BroadcastScheduler] Error starting "${campaign.name}":`, getErrorMessage(error));

                        this.emit('campaign:auto-start-failed', {
                            campaignId: campaign.id,
                            name: campaign.name,
                            error: getErrorMessage(error)
                        } as CampaignAutoStartFailedEvent);
                    }
                }
            }
        } catch (error: unknown) {
            console.error('[BroadcastScheduler] Error checking scheduled campaigns:', getErrorMessage(error));
        }
    }

    /**
     * Check for campaigns that were missed while the server was down
     */
    private async checkMissedCampaigns(): Promise<void> {
        console.log('[BroadcastScheduler] Checking for missed campaigns...');

        try {
            const { BroadcastService } = await import('./broadcastService');
            const broadcastService = BroadcastService.getInstance();
            const campaigns = broadcastService.getCampaigns();
            const now = new Date();

            let missedCount = 0;
            let expiredCount = 0;

            for (const campaign of campaigns) {
                if (campaign.status !== 'scheduled' || !campaign.schedule) continue;

                const scheduleDate = new Date(campaign.schedule);
                const hoursMissed = (now.getTime() - scheduleDate.getTime()) / (1000 * 60 * 60);

                // If scheduled date has passed
                if (scheduleDate < now) {
                    // If missed by less than 24 hours, execute now
                    if (hoursMissed < 24) {
                        console.log(`[BroadcastScheduler] Missed campaign "${campaign.name}" (${hoursMissed.toFixed(1)}h ago). Starting now...`);

                        try {
                            await broadcastService.startCampaign(campaign.id);
                            missedCount++;

                            this.emit('campaign:auto-started', {
                                campaignId: campaign.id,
                                name: campaign.name,
                                scheduledFor: scheduleDate
                            } as CampaignAutoStartEvent);
                        } catch (error: unknown) {
                            console.error(`[BroadcastScheduler] Failed to start missed campaign "${campaign.name}":`, getErrorMessage(error));
                        }
                    }
                    // If missed by more than 24 hours, mark as expired
                    else {
                        console.log(`[BroadcastScheduler] Campaign "${campaign.name}" expired (${hoursMissed.toFixed(0)}h ago). Skipping.`);
                        expiredCount++;

                        // Update campaign status to 'cancelled' to prevent future attempts
                        try {
                            broadcastService.updateCampaign(campaign.id, {
                                status: 'cancelled' as any
                            });
                        } catch (e) {
                            // Ignore update errors
                        }
                    }
                }
            }

            if (missedCount > 0 || expiredCount > 0) {
                console.log(`[BroadcastScheduler] Missed campaigns check complete: ${missedCount} started, ${expiredCount} expired`);
            }
        } catch (error: unknown) {
            console.error('[BroadcastScheduler] Error checking missed campaigns:', getErrorMessage(error));
        }
    }

    /**
     * Get list of campaigns scheduled for the future
     */
    async getScheduledCampaigns(): Promise<any[]> {
        try {
            const { BroadcastService } = await import('./broadcastService');
            const broadcastService = BroadcastService.getInstance();
            const campaigns = broadcastService.getCampaigns();

            return campaigns.filter(c =>
                c.status === 'scheduled' &&
                c.schedule &&
                new Date(c.schedule) > new Date()
            );
        } catch {
            return [];
        }
    }

    /**
     * Stop the scheduler
     */
    stop(): void {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
        }

        this.isRunning = false;
        console.log('[BroadcastScheduler] Stopped');
    }

    /**
     * Get current scheduler status
     */
    async getStatus(): Promise<SchedulerStatus> {
        const scheduledCampaigns = await this.getScheduledCampaigns();

        return {
            isRunning: this.isRunning,
            scheduledCampaignsCount: scheduledCampaigns.length,
            lastCheck: this.lastCheck?.toISOString() || null,
            nextCheck: this.isRunning ? 'Every 60 seconds' : 'Not running'
        };
    }

    /**
     * Check if scheduler is using node-cron or fallback
     */
    isUsingCron(): boolean {
        return this.cronAvailable;
    }
}

export default BroadcastSchedulerService;
