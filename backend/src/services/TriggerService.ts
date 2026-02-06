/**
 * TriggerService - Business logic for trigger matching and management
 */

import { EventEmitter } from 'events';
import { TriggerRepo } from '../repos';
import { Trigger, CreateTrigger, UpdateTrigger } from '../domain';

export class TriggerService extends EventEmitter {
    private static instance: TriggerService;
    private repo: TriggerRepo;
    private listenerEnabled: boolean = true;
    private requireTrigger: boolean = false;

    private constructor() {
        super();
        this.repo = TriggerRepo.getInstance();
    }

    public static getInstance(): TriggerService {
        if (!TriggerService.instance) {
            TriggerService.instance = new TriggerService();
        }
        return TriggerService.instance;
    }

    // ============================================================
    // CONFIGURATION
    // ============================================================

    getConfig() {
        return {
            listenerEnabled: this.listenerEnabled,
            requireTrigger: this.requireTrigger
        };
    }

    setListenerEnabled(enabled: boolean): void {
        this.listenerEnabled = enabled;
        this.emit('listener:toggled', { enabled });
    }

    setRequireTrigger(require: boolean): void {
        this.requireTrigger = require;
        this.emit('setting:requireTrigger', { require });
    }

    // ============================================================
    // CRUD OPERATIONS
    // ============================================================

    async create(data: CreateTrigger): Promise<Trigger> {
        // Validate regex if needed
        if (data.matchType === 'regex') {
            if (!this.repo.isValidRegex(data.keyword)) {
                throw new Error(`Invalid regex pattern: ${data.keyword}`);
            }
        }

        const trigger = await this.repo.upsert({
            ...data,
            id: '',
            createdAt: Math.floor(Date.now() / 1000),
            updatedAt: Math.floor(Date.now() / 1000),
            matchCount: 0
        } as any);

        this.emit('trigger:created', trigger);
        return trigger;
    }

    async getById(id: string): Promise<Trigger | null> {
        return this.repo.getById(id);
    }

    async getAll(activeOnly: boolean = false): Promise<Trigger[]> {
        if (activeOnly) {
            return this.repo.findActive();
        }
        return this.repo.list();
    }

    async update(id: string, updates: UpdateTrigger): Promise<Trigger> {
        const existing = await this.repo.getById(id);
        if (!existing) {
            throw new Error(`Trigger not found: ${id}`);
        }

        // Validate regex if changing match type
        if (updates.matchType && updates.matchType === 'regex') {
            const pattern = updates.keyword || existing.keyword;
            if (!this.repo.isValidRegex(pattern)) {
                throw new Error(`Invalid regex pattern: ${pattern}`);
            }
        }

        const updated = await this.repo.upsert({
            ...existing,
            ...updates,
            id,
            updatedAt: Math.floor(Date.now() / 1000)
        });

        this.emit('trigger:updated', updated);
        return updated;
    }

    async delete(id: string): Promise<void> {
        const trigger = await this.repo.getById(id);
        if (!trigger) {
            throw new Error(`Trigger not found: ${id}`);
        }

        await this.repo.remove(id);
        this.emit('trigger:deleted', trigger);
    }

    async toggle(id: string): Promise<Trigger> {
        const trigger = await this.repo.getById(id);
        if (!trigger) {
            throw new Error(`Trigger not found: ${id}`);
        }

        return this.update(id, { enabled: !trigger.enabled });
    }

    // ============================================================
    // BULK OPERATIONS
    // ============================================================

    async enableAll(): Promise<void> {
        const triggers = await this.repo.list();
        for (const trigger of triggers) {
            await this.repo.upsert({
                ...trigger,
                enabled: true,
                updatedAt: Math.floor(Date.now() / 1000)
            });
        }
        this.emit('triggers:enabledAll', triggers.length);
    }

    async disableAll(): Promise<void> {
        const triggers = await this.repo.list();
        for (const trigger of triggers) {
            await this.repo.upsert({
                ...trigger,
                enabled: false,
                updatedAt: Math.floor(Date.now() / 1000)
            });
        }
        this.emit('triggers:disabledAll', triggers.length);
    }

    async import(triggers: CreateTrigger[]): Promise<Trigger[]> {
        const imported: Trigger[] = [];
        for (const triggerData of triggers) {
            const trigger = await this.create(triggerData);
            imported.push(trigger);
        }
        this.emit('triggers:imported', imported.length);
        return imported;
    }

    async export(): Promise<Trigger[]> {
        return this.repo.list();
    }

    // ============================================================
    // MATCHING & TESTING
    // ============================================================

    /**
     * Test if a message matches any trigger
     * Returns detailed match information
     */
    async testMessage(message: string): Promise<{
        matched: Trigger[];
        message: string;
    }> {
        if (!this.listenerEnabled) {
            return { matched: [], message };
        }

        const triggers = await this.repo.findActiveSorted();
        const matched: Trigger[] = [];

        for (const trigger of triggers) {
            if (this.matchesTrigger(message, trigger)) {
                matched.push(trigger);
                // Record the match
                await this.repo.recordMatch(trigger.id);
            }
        }

        return { matched, message };
    }

    /**
     * Core matching logic
     */
    matchesTrigger(message: string, trigger: Trigger): boolean {
        if (!trigger.enabled) return false;

        const testMessage = trigger.caseSensitive ? message : message.toLowerCase();
        const testKeyword = trigger.caseSensitive ? trigger.keyword : trigger.keyword.toLowerCase();

        try {
            switch (trigger.matchType) {
                case 'exact':
                    return testMessage === testKeyword;
                
                case 'contains':
                    return testMessage.includes(testKeyword);
                
                case 'startsWith':
                    return testMessage.startsWith(testKeyword);
                
                case 'regex':
                    const regex = new RegExp(testKeyword, trigger.caseSensitive ? '' : 'i');
                    return regex.test(message);
                
                default:
                    return false;
            }
        } catch (error) {
            console.error(`Error matching trigger ${trigger.id}:`, error);
            return false;
        }
    }

    /**
     * Get all matching triggers for a message
     * Used by BotService to determine if a message triggers any actions
     */
    async findMatchingTriggers(message: string): Promise<Trigger[]> {
        if (!this.listenerEnabled) return [];

        const triggers = await this.repo.findActiveSorted();
        const matching: Trigger[] = [];

        for (const trigger of triggers) {
            if (this.matchesTrigger(message, trigger)) {
                matching.push(trigger);
                await this.repo.recordMatch(trigger.id);
            }
        }

        if (matching.length > 0) {
            this.emit('triggers:matched', {
                message,
                matched: matching.length,
                triggers: matching.map(t => t.keyword)
            });
        }

        return matching;
    }

    // ============================================================
    // STATISTICS
    // ============================================================

    async getStats(): Promise<{
        total: number;
        active: number;
        inactive: number;
        byCategory: Record<string, number>;
        byMatchType: Record<string, number>;
    }> {
        const triggers = await this.repo.list();
        
        const byCategory: Record<string, number> = {};
        const byMatchType: Record<string, number> = {};

        triggers.forEach(t => {
            const category = t.category || 'uncategorized';
            byCategory[category] = (byCategory[category] || 0) + 1;
            byMatchType[t.matchType] = (byMatchType[t.matchType] || 0) + 1;
        });

        return {
            total: triggers.length,
            active: triggers.filter(t => t.enabled).length,
            inactive: triggers.filter(t => !t.enabled).length,
            byCategory,
            byMatchType
        };
    }

    async resetStats(): Promise<void> {
        await this.repo.resetStats();
        this.emit('triggers:statsReset', {});
    }
}

export default TriggerService;
