/**
 * TriggerService - Manages keywords/triggers that activate the bot auto-response
 *
 * Features:
 * - Enable/disable the message listener globally
 * - Manage activation keywords (triggers)
 * - Configure trigger behavior (exact match, contains, regex)
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { EventEmitter } from 'events';

export interface Trigger {
    id: string;
    keyword: string;
    matchType: 'exact' | 'contains' | 'startsWith' | 'regex';
    caseSensitive: boolean;
    enabled: boolean;
    description?: string;
    category?: string;
    priority: number;
    createdAt: string;
    updatedAt: string;
}

export interface TriggerConfig {
    version: number;
    listenerEnabled: boolean;
    requireTrigger: boolean; // If true, messages must contain a trigger to activate bot
    triggers: Trigger[];
    settings: {
        defaultMatchType: 'exact' | 'contains' | 'startsWith' | 'regex';
        defaultCaseSensitive: boolean;
        cooldownMs: number; // Cooldown between trigger activations per chat
        maxTriggersPerMessage: number;
    };
    stats: {
        totalActivations: number;
        lastActivation: string | null;
        triggerCounts: Record<string, number>;
    };
}

const CONFIG_PATH = join(process.cwd(), 'data', 'trigger-config.json');

export class TriggerService extends EventEmitter {
    private static instance: TriggerService;
    private config: TriggerConfig;
    private cooldowns: Map<string, number> = new Map(); // jid -> last activation time

    private constructor() {
        super();
        this.config = this.loadConfig();
    }

    static getInstance(): TriggerService {
        if (!TriggerService.instance) {
            TriggerService.instance = new TriggerService();
        }
        return TriggerService.instance;
    }

    private loadConfig(): TriggerConfig {
        try {
            if (existsSync(CONFIG_PATH)) {
                const data = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
                // Merge with defaults in case new fields were added
                return {
                    ...this.getDefaultConfig(),
                    ...data,
                    settings: { ...this.getDefaultConfig().settings, ...data.settings },
                    stats: { ...this.getDefaultConfig().stats, ...data.stats }
                };
            }
        } catch (error) {
            console.error('[TriggerService] Error loading config:', error);
        }
        return this.getDefaultConfig();
    }

    private getDefaultConfig(): TriggerConfig {
        return {
            version: 1,
            listenerEnabled: true,
            requireTrigger: false,
            triggers: [
                {
                    id: 'default-hola',
                    keyword: 'hola',
                    matchType: 'contains',
                    caseSensitive: false,
                    enabled: true,
                    description: 'Saludo basico',
                    category: 'saludo',
                    priority: 1,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                },
                {
                    id: 'default-info',
                    keyword: 'informacion',
                    matchType: 'contains',
                    caseSensitive: false,
                    enabled: true,
                    description: 'Solicitud de informacion',
                    category: 'consulta',
                    priority: 1,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                },
                {
                    id: 'default-ayuda',
                    keyword: 'ayuda',
                    matchType: 'contains',
                    caseSensitive: false,
                    enabled: true,
                    description: 'Solicitud de ayuda',
                    category: 'soporte',
                    priority: 1,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                },
                {
                    id: 'default-precio',
                    keyword: 'precio',
                    matchType: 'contains',
                    caseSensitive: false,
                    enabled: true,
                    description: 'Consulta de precios',
                    category: 'ventas',
                    priority: 1,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                },
                {
                    id: 'default-horario',
                    keyword: 'horario',
                    matchType: 'contains',
                    caseSensitive: false,
                    enabled: true,
                    description: 'Consulta de horarios',
                    category: 'info',
                    priority: 1,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            ],
            settings: {
                defaultMatchType: 'contains',
                defaultCaseSensitive: false,
                cooldownMs: 1000,
                maxTriggersPerMessage: 3
            },
            stats: {
                totalActivations: 0,
                lastActivation: null,
                triggerCounts: {}
            }
        };
    }

    private saveConfig(): void {
        try {
            // Ensure directory exists
            const dir = dirname(CONFIG_PATH);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
            writeFileSync(CONFIG_PATH, JSON.stringify(this.config, null, 2));
        } catch (error) {
            console.error('[TriggerService] Error saving config:', error);
        }
    }

    // ==========================================
    // Listener Control
    // ==========================================

    /**
     * Check if the message listener is enabled
     */
    isListenerEnabled(): boolean {
        return this.config.listenerEnabled;
    }

    /**
     * Enable or disable the message listener globally
     */
    setListenerEnabled(enabled: boolean): void {
        this.config.listenerEnabled = enabled;
        this.saveConfig();
        this.emit('listener:toggle', enabled);
        console.log(`[TriggerService] Listener ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Check if messages require a trigger to activate the bot
     */
    isRequireTrigger(): boolean {
        return this.config.requireTrigger;
    }

    /**
     * Set whether messages require a trigger to activate the bot
     */
    setRequireTrigger(require: boolean): void {
        this.config.requireTrigger = require;
        this.saveConfig();
        console.log(`[TriggerService] Require trigger: ${require}`);
    }

    // ==========================================
    // Trigger Matching
    // ==========================================

    /**
     * Check if a message matches any active trigger
     * Returns matched triggers sorted by priority
     */
    matchTriggers(message: string, jid: string): Trigger[] {
        // Check cooldown
        const lastActivation = this.cooldowns.get(jid);
        if (lastActivation && Date.now() - lastActivation < this.config.settings.cooldownMs) {
            return [];
        }

        const activeTriggers = this.config.triggers.filter(t => t.enabled);
        const matched: Trigger[] = [];

        for (const trigger of activeTriggers) {
            if (this.matchesTrigger(message, trigger)) {
                matched.push(trigger);

                // Update stats
                this.config.stats.triggerCounts[trigger.id] =
                    (this.config.stats.triggerCounts[trigger.id] || 0) + 1;

                if (matched.length >= this.config.settings.maxTriggersPerMessage) {
                    break;
                }
            }
        }

        if (matched.length > 0) {
            // Update cooldown
            this.cooldowns.set(jid, Date.now());

            // Update global stats
            this.config.stats.totalActivations++;
            this.config.stats.lastActivation = new Date().toISOString();
            this.saveConfig();

            // Emit event
            this.emit('trigger:matched', { jid, triggers: matched, message });
        }

        // Sort by priority (higher first)
        return matched.sort((a, b) => b.priority - a.priority);
    }

    /**
     * Check if a message matches a specific trigger
     */
    private matchesTrigger(message: string, trigger: Trigger): boolean {
        const text = trigger.caseSensitive ? message : message.toLowerCase();
        const keyword = trigger.caseSensitive ? trigger.keyword : trigger.keyword.toLowerCase();

        switch (trigger.matchType) {
            case 'exact':
                return text === keyword;
            case 'contains':
                return text.includes(keyword);
            case 'startsWith':
                return text.startsWith(keyword);
            case 'regex':
                try {
                    const flags = trigger.caseSensitive ? '' : 'i';
                    const regex = new RegExp(trigger.keyword, flags);
                    return regex.test(message);
                } catch {
                    console.warn(`[TriggerService] Invalid regex: ${trigger.keyword}`);
                    return false;
                }
            default:
                return text.includes(keyword);
        }
    }

    /**
     * Check if a message should activate the bot based on current config
     */
    shouldActivateBot(message: string, jid: string): { activate: boolean; triggers: Trigger[] } {
        // If listener is disabled, never activate
        if (!this.config.listenerEnabled) {
            return { activate: false, triggers: [] };
        }

        // If triggers are not required, always activate (for all messages)
        if (!this.config.requireTrigger) {
            return { activate: true, triggers: [] };
        }

        // Check for trigger matches
        const matchedTriggers = this.matchTriggers(message, jid);
        return {
            activate: matchedTriggers.length > 0,
            triggers: matchedTriggers
        };
    }

    // ==========================================
    // Trigger CRUD
    // ==========================================

    /**
     * Get all triggers
     */
    getAllTriggers(): Trigger[] {
        return [...this.config.triggers];
    }

    /**
     * Get active triggers only
     */
    getActiveTriggers(): Trigger[] {
        return this.config.triggers.filter(t => t.enabled);
    }

    /**
     * Get a trigger by ID
     */
    getTrigger(id: string): Trigger | undefined {
        return this.config.triggers.find(t => t.id === id);
    }

    /**
     * Add a new trigger
     */
    addTrigger(trigger: Omit<Trigger, 'id' | 'createdAt' | 'updatedAt'>): Trigger {
        const newTrigger: Trigger = {
            ...trigger,
            id: `trigger-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.config.triggers.push(newTrigger);
        this.saveConfig();
        this.emit('trigger:added', newTrigger);

        return newTrigger;
    }

    /**
     * Update an existing trigger
     */
    updateTrigger(id: string, updates: Partial<Omit<Trigger, 'id' | 'createdAt'>>): Trigger | null {
        const index = this.config.triggers.findIndex(t => t.id === id);
        if (index === -1) return null;

        this.config.triggers[index] = {
            ...this.config.triggers[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };

        this.saveConfig();
        this.emit('trigger:updated', this.config.triggers[index]);

        return this.config.triggers[index];
    }

    /**
     * Delete a trigger
     */
    deleteTrigger(id: string): boolean {
        const index = this.config.triggers.findIndex(t => t.id === id);
        if (index === -1) return false;

        const deleted = this.config.triggers.splice(index, 1)[0];
        this.saveConfig();
        this.emit('trigger:deleted', deleted);

        return true;
    }

    /**
     * Toggle a trigger's enabled state
     */
    toggleTrigger(id: string): Trigger | null {
        const trigger = this.config.triggers.find(t => t.id === id);
        if (!trigger) return null;

        trigger.enabled = !trigger.enabled;
        trigger.updatedAt = new Date().toISOString();
        this.saveConfig();
        this.emit('trigger:toggled', trigger);

        return trigger;
    }

    // ==========================================
    // Bulk Operations
    // ==========================================

    /**
     * Enable all triggers
     */
    enableAllTriggers(): void {
        this.config.triggers.forEach(t => {
            t.enabled = true;
            t.updatedAt = new Date().toISOString();
        });
        this.saveConfig();
    }

    /**
     * Disable all triggers
     */
    disableAllTriggers(): void {
        this.config.triggers.forEach(t => {
            t.enabled = false;
            t.updatedAt = new Date().toISOString();
        });
        this.saveConfig();
    }

    /**
     * Import triggers from array
     */
    importTriggers(triggers: Omit<Trigger, 'id' | 'createdAt' | 'updatedAt'>[]): number {
        let added = 0;
        for (const trigger of triggers) {
            this.addTrigger(trigger);
            added++;
        }
        return added;
    }

    /**
     * Export triggers
     */
    exportTriggers(): Trigger[] {
        return [...this.config.triggers];
    }

    // ==========================================
    // Configuration & Stats
    // ==========================================

    /**
     * Get full configuration
     */
    getConfig(): TriggerConfig {
        return { ...this.config };
    }

    /**
     * Update settings
     */
    updateSettings(settings: Partial<TriggerConfig['settings']>): void {
        this.config.settings = { ...this.config.settings, ...settings };
        this.saveConfig();
    }

    /**
     * Get statistics
     */
    getStats(): TriggerConfig['stats'] {
        return { ...this.config.stats };
    }

    /**
     * Reset statistics
     */
    resetStats(): void {
        this.config.stats = {
            totalActivations: 0,
            lastActivation: null,
            triggerCounts: {}
        };
        this.saveConfig();
    }

    /**
     * Get trigger categories
     */
    getCategories(): string[] {
        const categories = new Set<string>();
        this.config.triggers.forEach(t => {
            if (t.category) categories.add(t.category);
        });
        return Array.from(categories);
    }
}

export default TriggerService;
