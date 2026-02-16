/**
 * Broadcast Scheduler Tests
 *
 * Tests the scheduling system: campaign scheduling, auto-start logic,
 * missed campaign recovery, and expiration handling.
 *
 * Priority: CRITICAL — Ensures scheduled campaigns execute correctly
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// ============================================
// Extracted interfaces for testing
// ============================================

interface BroadcastCampaign {
    id: string;
    name: string;
    status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled';
    schedule?: string; // ISO8601 date string
    contactListId: string;
    templateId?: string;
    message?: string;
    createdAt: string;
}

interface SchedulerStatus {
    isRunning: boolean;
    scheduledCampaignsCount: number;
    lastCheck: string | null;
}

interface CampaignStartResult {
    campaignId: string;
    started: boolean;
    reason?: string;
}

// ============================================
// Extracted scheduler logic for testing
// ============================================

class SchedulerValidator {
    private campaigns: BroadcastCampaign[] = [];
    private startedCampaigns: string[] = [];
    private expiredCampaigns: string[] = [];
    private failedCampaigns: { id: string; error: string }[] = [];
    private isRunning: boolean = false;
    private lastCheck: Date | null = null;

    setCampaigns(campaigns: BroadcastCampaign[]): void {
        this.campaigns = campaigns;
    }

    /**
     * Core scheduling check logic — mirrors BroadcastSchedulerService.checkScheduledCampaigns
     */
    checkScheduledCampaigns(now: Date = new Date()): CampaignStartResult[] {
        this.lastCheck = now;
        const results: CampaignStartResult[] = [];

        for (const campaign of this.campaigns) {
            if (campaign.status !== 'scheduled') continue;
            if (!campaign.schedule) continue;

            const scheduleDate = new Date(campaign.schedule);
            const twoMinutesFromNow = new Date(now.getTime() + 120000);

            // Execute if scheduled time is now or within 2 min window
            if (scheduleDate <= twoMinutesFromNow) {
                this.startedCampaigns.push(campaign.id);
                campaign.status = 'running';
                results.push({
                    campaignId: campaign.id,
                    started: true
                });
            }
        }

        return results;
    }

    /**
     * Missed campaign recovery logic — mirrors BroadcastSchedulerService.checkMissedCampaigns
     */
    checkMissedCampaigns(now: Date = new Date()): {
        started: string[];
        expired: string[];
    } {
        const started: string[] = [];
        const expired: string[] = [];

        for (const campaign of this.campaigns) {
            if (campaign.status !== 'scheduled' || !campaign.schedule) continue;

            const scheduleDate = new Date(campaign.schedule);
            const hoursMissed = (now.getTime() - scheduleDate.getTime()) / (1000 * 60 * 60);

            if (scheduleDate < now) {
                // Missed by less than 24h → start now
                if (hoursMissed < 24) {
                    this.startedCampaigns.push(campaign.id);
                    campaign.status = 'running';
                    started.push(campaign.id);
                }
                // Missed by more than 24h → mark as expired
                else {
                    this.expiredCampaigns.push(campaign.id);
                    campaign.status = 'cancelled';
                    expired.push(campaign.id);
                }
            }
        }

        return { started, expired };
    }

    /**
     * Validate campaign can be scheduled
     */
    validateSchedule(schedule: string | Date, now: Date = new Date()): {
        valid: boolean;
        reason?: string;
    } {
        const scheduleDate = new Date(schedule);

        // Check valid date
        if (isNaN(scheduleDate.getTime())) {
            return { valid: false, reason: 'invalid_date' };
        }

        // Must be in the future
        if (scheduleDate <= now) {
            return { valid: false, reason: 'past_date' };
        }

        // Check allowed hours (8:00 - 20:00)
        const hours = scheduleDate.getHours();
        if (hours < 8 || hours >= 20) {
            return { valid: false, reason: 'outside_allowed_hours' };
        }

        return { valid: true };
    }

    /**
     * Get scheduled campaigns (future only)
     */
    getScheduledCampaigns(now: Date = new Date()): BroadcastCampaign[] {
        return this.campaigns.filter(c =>
            c.status === 'scheduled' &&
            c.schedule &&
            new Date(c.schedule) > now
        );
    }

    getStartedCampaignIds(): string[] {
        return [...this.startedCampaigns];
    }

    getExpiredCampaignIds(): string[] {
        return [...this.expiredCampaigns];
    }

    getStatus(): SchedulerStatus {
        return {
            isRunning: this.isRunning,
            scheduledCampaignsCount: this.getScheduledCampaigns().length,
            lastCheck: this.lastCheck?.toISOString() || null
        };
    }

    start(): void {
        this.isRunning = true;
    }

    stop(): void {
        this.isRunning = false;
    }

    reset(): void {
        this.campaigns = [];
        this.startedCampaigns = [];
        this.expiredCampaigns = [];
        this.failedCampaigns = [];
        this.isRunning = false;
        this.lastCheck = null;
    }
}

// ============================================
// Helper to create test campaigns
// ============================================

function createCampaign(overrides: Partial<BroadcastCampaign> = {}): BroadcastCampaign {
    return {
        id: `campaign-${Math.random().toString(36).substr(2, 6)}`,
        name: 'Test Campaign',
        status: 'scheduled',
        contactListId: 'list-001',
        createdAt: new Date().toISOString(),
        ...overrides
    };
}

// ============================================
// TESTS
// ============================================

describe('Broadcast Scheduler System', () => {
    let scheduler: SchedulerValidator;

    beforeEach(() => {
        scheduler = new SchedulerValidator();
    });

    // ---- Schedule Validation ----
    describe('Schedule Validation', () => {
        it('should accept a future date', () => {
            // Tomorrow at 10 AM — guaranteed future + within allowed hours
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 1);
            futureDate.setHours(10, 0, 0, 0);
            const result = scheduler.validateSchedule(futureDate);
            expect(result.valid).toBe(true);
        });

        it('should reject a past date', () => {
            const pastDate = new Date(Date.now() - 3600000); // 1 hour ago
            const result = scheduler.validateSchedule(pastDate);
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('past_date');
        });

        it('should reject invalid date string', () => {
            const result = scheduler.validateSchedule('not-a-date');
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('invalid_date');
        });

        it('should reject schedule outside allowed hours (before 8am)', () => {
            const earlyDate = new Date(Date.now() + 86400000); // Tomorrow
            earlyDate.setHours(5, 0, 0, 0); // 5 AM
            const result = scheduler.validateSchedule(earlyDate);
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('outside_allowed_hours');
        });

        it('should reject schedule outside allowed hours (after 8pm)', () => {
            const lateDate = new Date(Date.now() + 86400000); // Tomorrow
            lateDate.setHours(21, 0, 0, 0); // 9 PM
            const result = scheduler.validateSchedule(lateDate);
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('outside_allowed_hours');
        });

        it('should accept schedule at exactly 8am', () => {
            const date = new Date(Date.now() + 86400000);
            date.setHours(8, 0, 0, 0);
            const result = scheduler.validateSchedule(date);
            expect(result.valid).toBe(true);
        });

        it('should accept schedule at 7:59pm', () => {
            const date = new Date(Date.now() + 86400000);
            date.setHours(19, 59, 0, 0);
            const result = scheduler.validateSchedule(date);
            expect(result.valid).toBe(true);
        });
    });

    // ---- Scheduled Campaign Checking ----
    describe('Check Scheduled Campaigns (CRITICAL)', () => {
        it('should start a campaign when scheduled time has passed', () => {
            const now = new Date();
            const pastSchedule = new Date(now.getTime() - 60000); // 1 min ago

            scheduler.setCampaigns([
                createCampaign({
                    id: 'c1',
                    schedule: pastSchedule.toISOString()
                })
            ]);

            const results = scheduler.checkScheduledCampaigns(now);
            expect(results).toHaveLength(1);
            expect(results[0].campaignId).toBe('c1');
            expect(results[0].started).toBe(true);
        });

        it('should start a campaign within 2-minute window', () => {
            const now = new Date();
            const soonSchedule = new Date(now.getTime() + 90000); // 90 seconds from now

            scheduler.setCampaigns([
                createCampaign({
                    id: 'c2',
                    schedule: soonSchedule.toISOString()
                })
            ]);

            const results = scheduler.checkScheduledCampaigns(now);
            expect(results).toHaveLength(1);
            expect(results[0].started).toBe(true);
        });

        it('should NOT start a campaign scheduled far in the future', () => {
            const now = new Date();
            const futureSchedule = new Date(now.getTime() + 3600000); // 1 hour from now

            scheduler.setCampaigns([
                createCampaign({
                    id: 'c3',
                    schedule: futureSchedule.toISOString()
                })
            ]);

            const results = scheduler.checkScheduledCampaigns(now);
            expect(results).toHaveLength(0);
        });

        it('should only start campaigns with status "scheduled"', () => {
            const now = new Date();
            const pastSchedule = new Date(now.getTime() - 60000);

            scheduler.setCampaigns([
                createCampaign({ id: 'c-draft', status: 'draft', schedule: pastSchedule.toISOString() }),
                createCampaign({ id: 'c-running', status: 'running', schedule: pastSchedule.toISOString() }),
                createCampaign({ id: 'c-completed', status: 'completed', schedule: pastSchedule.toISOString() }),
                createCampaign({ id: 'c-scheduled', status: 'scheduled', schedule: pastSchedule.toISOString() })
            ]);

            const results = scheduler.checkScheduledCampaigns(now);
            expect(results).toHaveLength(1);
            expect(results[0].campaignId).toBe('c-scheduled');
        });

        it('should skip campaigns without schedule date', () => {
            const now = new Date();

            scheduler.setCampaigns([
                createCampaign({ id: 'c-no-schedule', status: 'scheduled' })
                // No schedule field set
            ]);

            const results = scheduler.checkScheduledCampaigns(now);
            expect(results).toHaveLength(0);
        });

        it('should start multiple campaigns at once', () => {
            const now = new Date();
            const pastSchedule = new Date(now.getTime() - 60000);

            scheduler.setCampaigns([
                createCampaign({ id: 'c-a', schedule: pastSchedule.toISOString() }),
                createCampaign({ id: 'c-b', schedule: pastSchedule.toISOString() }),
                createCampaign({ id: 'c-c', schedule: pastSchedule.toISOString() })
            ]);

            const results = scheduler.checkScheduledCampaigns(now);
            expect(results).toHaveLength(3);
            expect(scheduler.getStartedCampaignIds()).toEqual(['c-a', 'c-b', 'c-c']);
        });

        it('should change campaign status to running after start', () => {
            const now = new Date();
            const pastSchedule = new Date(now.getTime() - 60000);

            const campaigns = [
                createCampaign({ id: 'c-status', schedule: pastSchedule.toISOString() })
            ];
            scheduler.setCampaigns(campaigns);

            scheduler.checkScheduledCampaigns(now);
            expect(campaigns[0].status).toBe('running');
        });
    });

    // ---- Missed Campaign Recovery ----
    describe('Missed Campaign Recovery (CRITICAL)', () => {
        it('should start campaigns missed by less than 24 hours', () => {
            const now = new Date();
            const missedBy3Hours = new Date(now.getTime() - 3 * 3600000); // 3 hours ago

            scheduler.setCampaigns([
                createCampaign({ id: 'missed-3h', schedule: missedBy3Hours.toISOString() })
            ]);

            const result = scheduler.checkMissedCampaigns(now);
            expect(result.started).toContain('missed-3h');
            expect(result.expired).toHaveLength(0);
        });

        it('should expire campaigns missed by more than 24 hours', () => {
            const now = new Date();
            const missedBy48Hours = new Date(now.getTime() - 48 * 3600000); // 48 hours ago

            scheduler.setCampaigns([
                createCampaign({ id: 'expired-48h', schedule: missedBy48Hours.toISOString() })
            ]);

            const result = scheduler.checkMissedCampaigns(now);
            expect(result.expired).toContain('expired-48h');
            expect(result.started).toHaveLength(0);
        });

        it('should mark expired campaigns as cancelled', () => {
            const now = new Date();
            const missedBy48Hours = new Date(now.getTime() - 48 * 3600000);

            const campaigns = [
                createCampaign({ id: 'exp', schedule: missedBy48Hours.toISOString() })
            ];
            scheduler.setCampaigns(campaigns);

            scheduler.checkMissedCampaigns(now);
            expect(campaigns[0].status).toBe('cancelled');
        });

        it('should handle mixed missed and expired campaigns', () => {
            const now = new Date();

            scheduler.setCampaigns([
                createCampaign({
                    id: 'recent-missed',
                    schedule: new Date(now.getTime() - 2 * 3600000).toISOString() // 2h ago
                }),
                createCampaign({
                    id: 'old-missed',
                    schedule: new Date(now.getTime() - 30 * 3600000).toISOString() // 30h ago
                }),
                createCampaign({
                    id: 'future',
                    schedule: new Date(now.getTime() + 3600000).toISOString() // 1h future
                })
            ]);

            const result = scheduler.checkMissedCampaigns(now);
            expect(result.started).toContain('recent-missed');
            expect(result.expired).toContain('old-missed');
            // Future campaign should not be touched
            expect(result.started).not.toContain('future');
            expect(result.expired).not.toContain('future');
        });

        it('should NOT process non-scheduled campaigns', () => {
            const now = new Date();

            scheduler.setCampaigns([
                createCampaign({
                    id: 'draft-old',
                    status: 'draft',
                    schedule: new Date(now.getTime() - 2 * 3600000).toISOString()
                })
            ]);

            const result = scheduler.checkMissedCampaigns(now);
            expect(result.started).toHaveLength(0);
            expect(result.expired).toHaveLength(0);
        });

        it('should handle boundary case: exactly 24 hours ago', () => {
            const now = new Date();
            // Exactly 24h → hoursMissed = 24 → should be expired (>= 24 check)
            const exactly24h = new Date(now.getTime() - 24 * 3600000);

            scheduler.setCampaigns([
                createCampaign({ id: 'boundary', schedule: exactly24h.toISOString() })
            ]);

            const result = scheduler.checkMissedCampaigns(now);
            // At exactly 24h, hoursMissed >= 24, so should expire
            expect(result.expired).toContain('boundary');
        });
    });

    // ---- Scheduler Status ----
    describe('Scheduler Lifecycle', () => {
        it('should report not running initially', () => {
            const status = scheduler.getStatus();
            expect(status.isRunning).toBe(false);
            expect(status.lastCheck).toBeNull();
        });

        it('should report running after start()', () => {
            scheduler.start();
            const status = scheduler.getStatus();
            expect(status.isRunning).toBe(true);
        });

        it('should report stopped after stop()', () => {
            scheduler.start();
            scheduler.stop();
            const status = scheduler.getStatus();
            expect(status.isRunning).toBe(false);
        });

        it('should count scheduled campaigns correctly', () => {
            const now = new Date();
            scheduler.setCampaigns([
                createCampaign({ id: 'a', schedule: new Date(now.getTime() + 3600000).toISOString() }),
                createCampaign({ id: 'b', schedule: new Date(now.getTime() + 7200000).toISOString() }),
                createCampaign({ id: 'c', status: 'draft' }) // Not scheduled
            ]);

            const status = scheduler.getStatus();
            expect(status.scheduledCampaignsCount).toBe(2);
        });

        it('should update lastCheck after checking campaigns', () => {
            const now = new Date();
            scheduler.setCampaigns([]);
            scheduler.checkScheduledCampaigns(now);

            const status = scheduler.getStatus();
            expect(status.lastCheck).not.toBeNull();
        });

        it('should clean up after reset', () => {
            scheduler.start();
            scheduler.setCampaigns([
                createCampaign({ id: 'x', schedule: new Date(Date.now() - 60000).toISOString() })
            ]);
            scheduler.checkScheduledCampaigns();

            scheduler.reset();
            expect(scheduler.getStartedCampaignIds()).toHaveLength(0);
            expect(scheduler.getStatus().isRunning).toBe(false);
        });
    });

    // ---- Campaign status filtering ----
    describe('Get Scheduled Campaigns (future only)', () => {
        it('should only return future scheduled campaigns', () => {
            const now = new Date();

            scheduler.setCampaigns([
                createCampaign({ id: 'future1', schedule: new Date(now.getTime() + 3600000).toISOString() }),
                createCampaign({ id: 'past1', schedule: new Date(now.getTime() - 3600000).toISOString() }),
                createCampaign({ id: 'draft1', status: 'draft' }),
                createCampaign({ id: 'future2', schedule: new Date(now.getTime() + 7200000).toISOString() })
            ]);

            const scheduled = scheduler.getScheduledCampaigns(now);
            expect(scheduled).toHaveLength(2);
            expect(scheduled.map(c => c.id)).toContain('future1');
            expect(scheduled.map(c => c.id)).toContain('future2');
        });
    });

    // ---- Idempotency ----
    describe('Idempotency & Safety', () => {
        it('should not start the same campaign twice (status changes to running)', () => {
            const now = new Date();
            const pastSchedule = new Date(now.getTime() - 60000);

            scheduler.setCampaigns([
                createCampaign({ id: 'idem', schedule: pastSchedule.toISOString() })
            ]);

            // First check
            const results1 = scheduler.checkScheduledCampaigns(now);
            expect(results1).toHaveLength(1);

            // Second check — campaign is now "running", should not start again
            const results2 = scheduler.checkScheduledCampaigns(now);
            expect(results2).toHaveLength(0);
        });
    });
});
