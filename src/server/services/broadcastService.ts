/**
 * Broadcast Service
 * Sistema de mensajes masivos y difusión
 */

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type {
    BroadcastCampaign,
    ContactList,
    ContactListItem,
    MessageTemplate,
    BroadcastConfig,
    CampaignStats,
    BroadcastProgress,
    FailedContact
} from '../types/broadcast';

interface BroadcastData {
    version: number;
    config: BroadcastConfig;
    campaigns: BroadcastCampaign[];
    contactLists: ContactList[];
    templates: MessageTemplate[];
    lastUpdated: string;
}

const DEFAULT_CONFIG: BroadcastConfig = {
    enabled: true,
    maxRecipientsPerCampaign: 1000,
    maxCampaignsPerDay: 5,
    defaultDelay: 3000,
    defaultRandomizeDelay: true,
    minDelayBetweenCampaigns: 30,
    cooldownPerContact: 24,
    maxMessagesPerContactPerDay: 2,
    blacklistedNumbers: [],
    allowedHours: {
        enabled: true,
        timezone: 'America/Santo_Domingo',
        start: '08:00',
        end: '20:00',
        allowWeekends: false
    }
};

export class BroadcastService {
    private static instance: BroadcastService;
    private dataPath: string;
    private data: BroadcastData;
    private sendMessageCallback?: (jid: string, message: string, mediaUrl?: string) => Promise<boolean>;
    private runningCampaigns: Map<string, { abort: boolean; progress: BroadcastProgress }> = new Map();

    private constructor() {
        this.dataPath = path.join(process.cwd(), 'data', 'broadcast.json');
        this.data = this.loadData();
    }

    public static getInstance(): BroadcastService {
        if (!BroadcastService.instance) {
            BroadcastService.instance = new BroadcastService();
        }
        return BroadcastService.instance;
    }

    public setSendMessageCallback(
        callback: (jid: string, message: string, mediaUrl?: string) => Promise<boolean>
    ): void {
        this.sendMessageCallback = callback;
    }

    private loadData(): BroadcastData {
        try {
            const dir = path.dirname(this.dataPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            if (fs.existsSync(this.dataPath)) {
                const rawData = fs.readFileSync(this.dataPath, 'utf-8');
                return JSON.parse(rawData);
            }
        } catch (error) {
            console.error('Error loading broadcast data:', error);
        }

        return {
            version: 1,
            config: DEFAULT_CONFIG,
            campaigns: [],
            contactLists: [],
            templates: [],
            lastUpdated: new Date().toISOString()
        };
    }

    private saveData(): void {
        try {
            this.data.lastUpdated = new Date().toISOString();
            fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error('Error saving broadcast data:', error);
        }
    }

    // ==========================================
    // Configuration
    // ==========================================

    public getConfig(): BroadcastConfig {
        return { ...this.data.config };
    }

    public updateConfig(config: Partial<BroadcastConfig>): BroadcastConfig {
        this.data.config = { ...this.data.config, ...config };
        this.saveData();
        return this.data.config;
    }

    // ==========================================
    // Contact Lists
    // ==========================================

    public getContactLists(): ContactList[] {
        return [...this.data.contactLists];
    }

    public getContactList(id: string): ContactList | null {
        return this.data.contactLists.find(l => l.id === id) || null;
    }

    public createContactList(params: {
        name: string;
        description?: string;
        tags?: string[];
    }): ContactList {
        const list: ContactList = {
            id: uuidv4(),
            name: params.name,
            description: params.description,
            contacts: [],
            tags: params.tags || [],
            isActive: true,
            createdBy: 'admin',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        this.data.contactLists.push(list);
        this.saveData();
        return list;
    }

    public updateContactList(id: string, updates: Partial<ContactList>): ContactList | null {
        const index = this.data.contactLists.findIndex(l => l.id === id);
        if (index === -1) return null;

        this.data.contactLists[index] = {
            ...this.data.contactLists[index],
            ...updates,
            updatedAt: new Date()
        };
        this.saveData();
        return this.data.contactLists[index];
    }

    public deleteContactList(id: string): boolean {
        const index = this.data.contactLists.findIndex(l => l.id === id);
        if (index === -1) return false;

        this.data.contactLists.splice(index, 1);
        this.saveData();
        return true;
    }

    public addContactToList(listId: string, contact: {
        jid: string;
        name: string;
        phone: string;
        customFields?: Record<string, string>;
    }): ContactList | null {
        const list = this.getContactList(listId);
        if (!list) return null;

        // Check if contact already exists
        if (list.contacts.some(c => c.jid === contact.jid)) {
            return list;
        }

        const contactItem: ContactListItem = {
            jid: contact.jid,
            name: contact.name,
            phone: contact.phone,
            customFields: contact.customFields,
            addedAt: new Date()
        };

        list.contacts.push(contactItem);
        return this.updateContactList(listId, { contacts: list.contacts });
    }

    public removeContactFromList(listId: string, jid: string): ContactList | null {
        const list = this.getContactList(listId);
        if (!list) return null;

        list.contacts = list.contacts.filter(c => c.jid !== jid);
        return this.updateContactList(listId, { contacts: list.contacts });
    }

    public importContacts(listId: string, contacts: Array<{
        phone: string;
        name?: string;
        customFields?: Record<string, string>;
    }>): { imported: number; skipped: number; errors: string[] } {
        const list = this.getContactList(listId);
        if (!list) {
            return { imported: 0, skipped: 0, errors: ['List not found'] };
        }

        let imported = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (const contact of contacts) {
            try {
                // Normalize phone number
                let phone = contact.phone.replace(/\D/g, '');
                if (!phone) {
                    errors.push(`Invalid phone: ${contact.phone}`);
                    continue;
                }

                const jid = `${phone}@s.whatsapp.net`;

                // Check if already exists
                if (list.contacts.some(c => c.jid === jid)) {
                    skipped++;
                    continue;
                }

                // Check blacklist
                if (this.data.config.blacklistedNumbers.includes(phone)) {
                    skipped++;
                    continue;
                }

                list.contacts.push({
                    jid,
                    name: contact.name || phone,
                    phone,
                    customFields: contact.customFields,
                    addedAt: new Date()
                });
                imported++;
            } catch (e) {
                errors.push(`Error processing ${contact.phone}: ${e}`);
            }
        }

        this.updateContactList(listId, { contacts: list.contacts });
        return { imported, skipped, errors };
    }

    // ==========================================
    // Templates
    // ==========================================

    public getTemplates(): MessageTemplate[] {
        return [...this.data.templates];
    }

    public getTemplate(id: string): MessageTemplate | null {
        return this.data.templates.find(t => t.id === id) || null;
    }

    public createTemplate(params: {
        name: string;
        description?: string;
        category: string;
        content: string;
        mediaUrl?: string;
        mediaType?: 'image' | 'video' | 'document' | 'audio';
    }): MessageTemplate {
        // Extract variables from content
        const variables = this.extractVariables(params.content);

        const template: MessageTemplate = {
            id: uuidv4(),
            name: params.name,
            description: params.description,
            category: params.category,
            content: params.content,
            mediaUrl: params.mediaUrl,
            mediaType: params.mediaType,
            variables,
            isActive: true,
            usageCount: 0,
            createdBy: 'admin',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        this.data.templates.push(template);
        this.saveData();
        return template;
    }

    public updateTemplate(id: string, updates: Partial<MessageTemplate>): MessageTemplate | null {
        const index = this.data.templates.findIndex(t => t.id === id);
        if (index === -1) return null;

        if (updates.content) {
            updates.variables = this.extractVariables(updates.content);
        }

        this.data.templates[index] = {
            ...this.data.templates[index],
            ...updates,
            updatedAt: new Date()
        };
        this.saveData();
        return this.data.templates[index];
    }

    public deleteTemplate(id: string): boolean {
        const index = this.data.templates.findIndex(t => t.id === id);
        if (index === -1) return false;

        this.data.templates.splice(index, 1);
        this.saveData();
        return true;
    }

    private extractVariables(content: string): string[] {
        const matches = content.match(/\{(\w+)\}/g) || [];
        return [...new Set(matches.map(m => m.slice(1, -1)))];
    }

    // ==========================================
    // Campaigns
    // ==========================================

    public getCampaigns(): BroadcastCampaign[] {
        return [...this.data.campaigns].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }

    public getCampaign(id: string): BroadcastCampaign | null {
        return this.data.campaigns.find(c => c.id === id) || null;
    }

    public createCampaign(params: {
        name: string;
        description?: string;
        message: string;
        mediaUrl?: string;
        mediaType?: 'image' | 'video' | 'document' | 'audio';
        targetLists: string[];
        targetContacts?: string[];
        excludeContacts?: string[];
        schedule?: Date;
        delayBetweenMessages?: number;
        randomizeDelay?: boolean;
        personalizeMessage?: boolean;
    }): BroadcastCampaign {
        // Calculate total recipients
        const recipients = this.getRecipientsForCampaign(
            params.targetLists,
            params.targetContacts || [],
            params.excludeContacts || []
        );

        const campaign: BroadcastCampaign = {
            id: uuidv4(),
            name: params.name,
            description: params.description,
            message: params.message,
            mediaUrl: params.mediaUrl,
            mediaType: params.mediaType,
            targetLists: params.targetLists,
            targetContacts: params.targetContacts || [],
            excludeContacts: params.excludeContacts || [],
            schedule: params.schedule,
            status: params.schedule ? 'scheduled' : 'draft',
            totalRecipients: recipients.length,
            sent: 0,
            delivered: 0,
            read: 0,
            replied: 0,
            failed: 0,
            failedContacts: [],
            delayBetweenMessages: params.delayBetweenMessages || this.data.config.defaultDelay,
            randomizeDelay: params.randomizeDelay ?? this.data.config.defaultRandomizeDelay,
            minDelay: 2000,
            maxDelay: 5000,
            personalizeMessage: params.personalizeMessage ?? true,
            trackDelivery: true,
            trackRead: true,
            createdBy: 'admin',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        this.data.campaigns.push(campaign);
        this.saveData();
        return campaign;
    }

    public updateCampaign(id: string, updates: Partial<BroadcastCampaign>): BroadcastCampaign | null {
        const index = this.data.campaigns.findIndex(c => c.id === id);
        if (index === -1) return null;

        // Don't allow updating running campaigns
        if (this.data.campaigns[index].status === 'running') {
            return null;
        }

        this.data.campaigns[index] = {
            ...this.data.campaigns[index],
            ...updates,
            updatedAt: new Date()
        };
        this.saveData();
        return this.data.campaigns[index];
    }

    public deleteCampaign(id: string): boolean {
        const campaign = this.getCampaign(id);
        if (!campaign || campaign.status === 'running') return false;

        const index = this.data.campaigns.findIndex(c => c.id === id);
        this.data.campaigns.splice(index, 1);
        this.saveData();
        return true;
    }

    private getRecipientsForCampaign(
        listIds: string[],
        additionalContacts: string[],
        excludeContacts: string[]
    ): ContactListItem[] {
        const recipientMap = new Map<string, ContactListItem>();
        const excludeSet = new Set(excludeContacts);
        const blacklistSet = new Set(this.data.config.blacklistedNumbers);

        // Add contacts from lists
        for (const listId of listIds) {
            const list = this.getContactList(listId);
            if (list && list.isActive) {
                for (const contact of list.contacts) {
                    if (!excludeSet.has(contact.jid) && !blacklistSet.has(contact.phone)) {
                        recipientMap.set(contact.jid, contact);
                    }
                }
            }
        }

        // Add individual contacts
        for (const jid of additionalContacts) {
            if (!excludeSet.has(jid) && !recipientMap.has(jid)) {
                const phone = jid.split('@')[0];
                if (!blacklistSet.has(phone)) {
                    recipientMap.set(jid, {
                        jid,
                        name: phone,
                        phone,
                        addedAt: new Date()
                    });
                }
            }
        }

        return Array.from(recipientMap.values());
    }

    // ==========================================
    // Campaign Execution
    // ==========================================

    public async startCampaign(id: string): Promise<{ success: boolean; error?: string }> {
        const campaign = this.getCampaign(id);
        if (!campaign) {
            return { success: false, error: 'Campaign not found' };
        }

        if (campaign.status === 'running') {
            return { success: false, error: 'Campaign is already running' };
        }

        if (!this.sendMessageCallback) {
            return { success: false, error: 'Send message callback not configured' };
        }

        // Check allowed hours
        if (this.data.config.allowedHours.enabled && !this.isWithinAllowedHours()) {
            return { success: false, error: 'Outside allowed sending hours' };
        }

        // Update campaign status
        this.updateCampaign(id, {
            status: 'running',
            startedAt: new Date()
        });

        // Initialize progress tracking
        const progress: BroadcastProgress = {
            campaignId: id,
            status: 'running',
            progress: 0,
            sent: 0,
            total: campaign.totalRecipients
        };
        this.runningCampaigns.set(id, { abort: false, progress });

        // Run campaign asynchronously
        this.executeCampaign(id).catch(error => {
            console.error(`Campaign ${id} failed:`, error);
            this.updateCampaign(id, { status: 'paused' });
        });

        return { success: true };
    }

    private async executeCampaign(campaignId: string): Promise<void> {
        const campaign = this.getCampaign(campaignId);
        if (!campaign) return;

        const recipients = this.getRecipientsForCampaign(
            campaign.targetLists,
            campaign.targetContacts,
            campaign.excludeContacts
        );

        console.log(`📢 Starting campaign "${campaign.name}" with ${recipients.length} recipients`);

        let sent = campaign.sent;
        let failed = campaign.failed;
        const failedContacts: FailedContact[] = [...campaign.failedContacts];

        for (let i = sent; i < recipients.length; i++) {
            const runningState = this.runningCampaigns.get(campaignId);
            if (!runningState || runningState.abort) {
                console.log(`Campaign ${campaignId} aborted`);
                break;
            }

            const recipient = recipients[i];

            try {
                // Personalize message
                let message = campaign.message;
                if (campaign.personalizeMessage) {
                    message = this.personalizeMessage(message, recipient);
                }

                // Send message
                const success = await this.sendMessageCallback!(
                    recipient.jid,
                    message,
                    campaign.mediaUrl
                );

                if (success) {
                    sent++;
                } else {
                    failed++;
                    failedContacts.push({
                        jid: recipient.jid,
                        reason: 'Send failed',
                        failedAt: new Date(),
                        retryCount: 0
                    });
                }
            } catch (error: any) {
                failed++;
                failedContacts.push({
                    jid: recipient.jid,
                    reason: error.message || 'Unknown error',
                    failedAt: new Date(),
                    retryCount: 0
                });
            }

            // Update progress
            const progress = Math.round(((i + 1) / recipients.length) * 100);
            if (runningState) {
                runningState.progress = {
                    campaignId,
                    status: 'running',
                    progress,
                    sent,
                    total: recipients.length,
                    currentContact: recipient.name,
                    estimatedTimeRemaining: this.estimateTimeRemaining(
                        recipients.length - i - 1,
                        campaign.delayBetweenMessages
                    )
                };
            }

            // Update campaign in database periodically
            if (i % 10 === 0 || i === recipients.length - 1) {
                this.updateCampaign(campaignId, {
                    sent,
                    failed,
                    failedContacts
                });
            }

            // Delay before next message
            if (i < recipients.length - 1) {
                const delay = this.calculateDelay(campaign);
                await this.sleep(delay);
            }
        }

        // Campaign completed
        this.updateCampaign(campaignId, {
            status: 'completed',
            completedAt: new Date(),
            sent,
            failed,
            failedContacts
        });

        this.runningCampaigns.delete(campaignId);
        console.log(`✅ Campaign "${campaign.name}" completed: ${sent} sent, ${failed} failed`);
    }

    public pauseCampaign(id: string): boolean {
        const runningState = this.runningCampaigns.get(id);
        if (runningState) {
            runningState.abort = true;
            this.updateCampaign(id, { status: 'paused', pausedAt: new Date() });
            return true;
        }
        return false;
    }

    public getCampaignProgress(id: string): BroadcastProgress | null {
        const runningState = this.runningCampaigns.get(id);
        return runningState?.progress || null;
    }

    private personalizeMessage(message: string, contact: ContactListItem): string {
        let personalized = message
            .replace(/\{nombre\}/gi, contact.name || contact.phone)
            .replace(/\{telefono\}/gi, contact.phone)
            .replace(/\{fecha\}/gi, new Date().toLocaleDateString('es-ES'));

        // Replace custom fields
        if (contact.customFields) {
            for (const [key, value] of Object.entries(contact.customFields)) {
                personalized = personalized.replace(new RegExp(`\\{${key}\\}`, 'gi'), value);
            }
        }

        return personalized;
    }

    private calculateDelay(campaign: BroadcastCampaign): number {
        if (campaign.randomizeDelay) {
            const min = campaign.minDelay || 2000;
            const max = campaign.maxDelay || 5000;
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }
        return campaign.delayBetweenMessages;
    }

    private estimateTimeRemaining(remaining: number, delayMs: number): number {
        return Math.round((remaining * delayMs) / 1000);
    }

    private isWithinAllowedHours(): boolean {
        const config = this.data.config.allowedHours;
        if (!config.enabled) return true;

        const now = new Date();
        const day = now.getDay();

        // Check weekends
        if (!config.allowWeekends && (day === 0 || day === 6)) {
            return false;
        }

        // Check time
        const currentTime = now.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            timeZone: config.timezone
        });

        return currentTime >= config.start && currentTime <= config.end;
    }

    // ==========================================
    // Immediate Messages (for Alerts)
    // ==========================================

    /**
     * Send immediate message (for alerts/notifications, not campaigns)
     * Bypasses campaign workflow for urgent/realtime messages
     */
    public async sendImmediateMessage(params: {
        jid: string;
        message: string;
        mediaUrl?: string;
        metadata?: Record<string, any>;
    }): Promise<boolean> {
        if (!this.sendMessageCallback) {
            console.error('Send message callback not configured');
            return false;
        }

        try {
            const success = await this.sendMessageCallback(
                params.jid,
                params.message,
                params.mediaUrl
            );

            if (success && params.metadata) {
                console.log(`✅ Immediate message sent: ${params.metadata.type || 'alert'}`);
            }

            return success;
        } catch (error) {
            console.error('Error sending immediate message:', error);
            return false;
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ==========================================
    // Statistics
    // ==========================================

    public getStats(): CampaignStats {
        const campaigns = this.data.campaigns;
        const completed = campaigns.filter(c => c.status === 'completed');

        const totalSent = campaigns.reduce((sum, c) => sum + c.sent, 0);
        const totalDelivered = campaigns.reduce((sum, c) => sum + c.delivered, 0);
        const totalRead = campaigns.reduce((sum, c) => sum + c.read, 0);
        const totalReplied = campaigns.reduce((sum, c) => sum + c.replied, 0);

        return {
            totalCampaigns: campaigns.length,
            activeCampaigns: campaigns.filter(c => c.status === 'running').length,
            completedCampaigns: completed.length,
            totalMessagesSent: totalSent,
            totalDelivered,
            totalRead,
            totalReplied,
            averageDeliveryRate: totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0,
            averageReadRate: totalDelivered > 0 ? (totalRead / totalDelivered) * 100 : 0,
            averageReplyRate: totalSent > 0 ? (totalReplied / totalSent) * 100 : 0
        };
    }
}

export default BroadcastService;
