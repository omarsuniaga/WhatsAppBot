/**
 * BotAssignmentService - Manages bot configuration per chat
 * Each chat can have customized bot behavior, personality, and limits
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { EventEmitter } from 'events';

export interface BotConfig {
    enabled: boolean;
    personality: 'professional' | 'friendly' | 'formal';
    language: string;
    customGreeting?: string;
    customFallback?: string;

    allowedCategories: string[];

    maxResponseLength: number;
    responseDelayMs: number;

    autoEscalate: boolean;
    escalateThreshold: number;
    learningEnabled: boolean;
}

export interface BotStats {
    totalMessages: number;
    autoResponses: number;
    escalations: number;
    learnedResponses: number;
    lastActivity?: string;
}

export interface BotAssignment {
    id: string;
    chatJid: string;
    chatName: string;
    isGroup: boolean;

    botConfig: BotConfig;
    stats: BotStats;

    createdAt: string;
    updatedAt: string;
}

interface AssignmentsData {
    version: number;
    defaultConfig: BotConfig;
    assignments: BotAssignment[];
}

const DATA_PATH = join(process.cwd(), 'data', 'bot-assignments.json');

const DEFAULT_BOT_CONFIG: BotConfig = {
    enabled: false,
    personality: 'friendly',
    language: 'es',
    customGreeting: '¡Hola! Soy el asistente virtual. ¿En qué puedo ayudarte?',
    customFallback: 'Un momento, estoy consultando con mi equipo para darte la mejor respuesta.',
    allowedCategories: [],
    maxResponseLength: 500,
    responseDelayMs: 1500,
    autoEscalate: true,
    escalateThreshold: 0.7,
    learningEnabled: true
};

class BotAssignmentService extends EventEmitter {
    private static instance: BotAssignmentService;
    private data: AssignmentsData;

    private constructor() {
        super();
        this.data = this.load();
    }

    static getInstance(): BotAssignmentService {
        if (!BotAssignmentService.instance) {
            BotAssignmentService.instance = new BotAssignmentService();
        }
        return BotAssignmentService.instance;
    }

    private load(): AssignmentsData {
        try {
            if (existsSync(DATA_PATH)) {
                return JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
            }
        } catch (error) {
            console.error('[BotAssignmentService] Error loading data:', error);
        }

        return {
            version: 1,
            defaultConfig: DEFAULT_BOT_CONFIG,
            assignments: []
        };
    }

    private save(): void {
        try {
            const dir = dirname(DATA_PATH);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
            writeFileSync(DATA_PATH, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error('[BotAssignmentService] Error saving data:', error);
        }
    }

    private generateId(): string {
        return `assign-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get default bot configuration
     */
    getDefaultConfig(): BotConfig {
        return { ...this.data.defaultConfig };
    }

    /**
     * Update default bot configuration
     */
    updateDefaultConfig(config: Partial<BotConfig>): void {
        this.data.defaultConfig = { ...this.data.defaultConfig, ...config };
        this.save();
    }

    /**
     * Get assignment for a chat (creates one with defaults if not exists)
     */
    getAssignment(chatJid: string): BotAssignment | null {
        return this.data.assignments.find(a => a.chatJid === chatJid) || null;
    }

    /**
     * Get or create assignment for a chat
     */
    getOrCreateAssignment(chatJid: string, chatName: string, isGroup: boolean = false): BotAssignment {
        let assignment = this.getAssignment(chatJid);

        if (!assignment) {
            assignment = this.createAssignment(chatJid, chatName, isGroup);
        }

        return assignment;
    }

    /**
     * Create a new bot assignment for a chat
     */
    createAssignment(
        chatJid: string,
        chatName: string,
        isGroup: boolean = false,
        config?: Partial<BotConfig>
    ): BotAssignment {
        const existing = this.getAssignment(chatJid);
        if (existing) {
            return existing;
        }

        const assignment: BotAssignment = {
            id: this.generateId(),
            chatJid,
            chatName,
            isGroup,
            botConfig: {
                ...this.data.defaultConfig,
                ...config
            },
            stats: {
                totalMessages: 0,
                autoResponses: 0,
                escalations: 0,
                learnedResponses: 0
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.data.assignments.push(assignment);
        this.save();

        this.emit('assignment:created', assignment);

        console.log(`[BotAssignmentService] Created assignment for ${chatName} (${chatJid})`);

        return assignment;
    }

    /**
     * Update bot configuration for a chat
     */
    updateAssignment(chatJid: string, updates: Partial<BotConfig>): BotAssignment | null {
        const assignment = this.getAssignment(chatJid);

        if (!assignment) {
            return null;
        }

        assignment.botConfig = { ...assignment.botConfig, ...updates };
        assignment.updatedAt = new Date().toISOString();

        this.save();

        this.emit('assignment:updated', assignment);

        return assignment;
    }

    /**
     * Toggle bot enabled/disabled for a chat
     */
    toggleBot(chatJid: string, enabled: boolean, chatName?: string): BotAssignment {
        let assignment = this.getAssignment(chatJid);

        if (!assignment && chatName) {
            assignment = this.createAssignment(chatJid, chatName);
        }

        if (assignment) {
            assignment.botConfig.enabled = enabled;
            assignment.updatedAt = new Date().toISOString();
            this.save();

            this.emit('bot:toggled', { chatJid, enabled });
        }

        return assignment!;
    }

    /**
     * Check if bot is active for a chat
     */
    isBotActive(chatJid: string): boolean {
        const assignment = this.getAssignment(chatJid);
        return assignment?.botConfig.enabled ?? false;
    }

    /**
     * Get all assignments
     */
    getAllAssignments(): BotAssignment[] {
        return this.data.assignments;
    }

    /**
     * Get active assignments (bot enabled)
     */
    getActiveAssignments(): BotAssignment[] {
        return this.data.assignments.filter(a => a.botConfig.enabled);
    }

    /**
     * Delete assignment
     */
    deleteAssignment(chatJid: string): boolean {
        const index = this.data.assignments.findIndex(a => a.chatJid === chatJid);

        if (index === -1) {
            return false;
        }

        const [removed] = this.data.assignments.splice(index, 1);
        this.save();

        this.emit('assignment:deleted', removed);

        return true;
    }

    /**
     * Increment stats for a chat
     */
    incrementStats(
        chatJid: string,
        stat: 'totalMessages' | 'autoResponses' | 'escalations' | 'learnedResponses'
    ): void {
        const assignment = this.getAssignment(chatJid);

        if (assignment) {
            assignment.stats[stat]++;
            assignment.stats.lastActivity = new Date().toISOString();
            this.save();
        }
    }

    /**
     * Get aggregate statistics
     */
    getAggregateStats(): {
        totalAssignments: number;
        activeAssignments: number;
        totalMessages: number;
        autoResponses: number;
        escalations: number;
        learnedResponses: number;
        autoResponseRate: number;
    } {
        const assignments = this.data.assignments;
        const active = assignments.filter(a => a.botConfig.enabled);

        let totalMessages = 0;
        let autoResponses = 0;
        let escalations = 0;
        let learnedResponses = 0;

        for (const a of assignments) {
            totalMessages += a.stats.totalMessages;
            autoResponses += a.stats.autoResponses;
            escalations += a.stats.escalations;
            learnedResponses += a.stats.learnedResponses;
        }

        return {
            totalAssignments: assignments.length,
            activeAssignments: active.length,
            totalMessages,
            autoResponses,
            escalations,
            learnedResponses,
            autoResponseRate: totalMessages > 0 ? (autoResponses / totalMessages) * 100 : 0
        };
    }

    /**
     * Search assignments by name
     */
    searchAssignments(query: string): BotAssignment[] {
        const lowerQuery = query.toLowerCase();
        return this.data.assignments.filter(
            a => a.chatName.toLowerCase().includes(lowerQuery) ||
                 a.chatJid.includes(lowerQuery)
        );
    }
}

export default BotAssignmentService;
