/**
 * User Config Service
 * Manages user settings and preferences in Firestore
 * Syncs across devices while maintaining localStorage fallback
 */

import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { FirestoreDocument } from './baseService';

export interface UserConfig extends FirestoreDocument {
    userId: string;
    // Theme preference
    theme: 'dark' | 'light';
    // Gemini AI API Key
    geminiApiKey?: string;
    // Knowledge Base Config
    knowledgeConfig?: {
        businessName: string;
        businessDescription: string;
        toneStyle: string;
        minConfidenceToRespond: number;
        minConfidenceToConfirm: number;
        enableAutoLearn: boolean;
    };
    // Escalation Config
    escalationConfig?: {
        autoAssign: boolean;
        reminderInterval: number;
        maxTicketsPerAdmin: number;
    };
    // Broadcast Config
    broadcastConfig?: {
        messageDelay: number;
        randomizeDelay: boolean;
        startHour: string;
        endHour: string;
    };
}

class UserConfigServiceClass {
    private collectionName = 'USUARIOS';

    /**
     * Get user config document reference
     */
    private getUserDocRef(userId: string) {
        return doc(db, this.collectionName, userId);
    }

    /**
     * Get user configuration
     */
    async getUserConfig(userId: string): Promise<UserConfig | null> {
        try {
            const docSnap = await getDoc(this.getUserDocRef(userId));

            if (!docSnap.exists()) {
                return null;
            }

            return {
                id: docSnap.id,
                ...docSnap.data()
            } as UserConfig;
        } catch (error) {
            console.error('Error getting user config:', error);
            throw error;
        }
    }

    /**
     * Update user configuration (creates if doesn't exist)
     */
    async updateUserConfig(userId: string, config: Partial<UserConfig>): Promise<void> {
        try {
            // Remove id and timestamps from update data
            const { id: _id, createdAt: _created, updatedAt: _updated, ...updateData } = config as any;

            await setDoc(this.getUserDocRef(userId), {
                userId,
                ...updateData,
                updatedAt: new Date()
            }, { merge: true });

            console.log('✅ User config updated in Firebase');
        } catch (error) {
            console.error('Error updating user config:', error);
            throw error;
        }
    }

    /**
     * Update theme preference
     */
    async updateTheme(userId: string, theme: 'dark' | 'light'): Promise<void> {
        return this.updateUserConfig(userId, { theme });
    }

    /**
     * Update Gemini API Key
     */
    async updateGeminiApiKey(userId: string, apiKey: string): Promise<void> {
        return this.updateUserConfig(userId, { geminiApiKey: apiKey });
    }

    /**
     * Update Knowledge Base config
     */
    async updateKnowledgeConfig(userId: string, config: UserConfig['knowledgeConfig']): Promise<void> {
        return this.updateUserConfig(userId, { knowledgeConfig: config });
    }

    /**
     * Update Escalation config
     */
    async updateEscalationConfig(userId: string, config: UserConfig['escalationConfig']): Promise<void> {
        return this.updateUserConfig(userId, { escalationConfig: config });
    }

    /**
     * Update Broadcast config
     */
    async updateBroadcastConfig(userId: string, config: UserConfig['broadcastConfig']): Promise<void> {
        return this.updateUserConfig(userId, { broadcastConfig: config });
    }

    /**
     * Sync from localStorage to Firebase (one-time migration)
     */
    async syncFromLocalStorage(userId: string): Promise<void> {
        try {
            const theme = localStorage.getItem('app-theme') as 'dark' | 'light' | null;
            const geminiApiKey = localStorage.getItem('GEMINI_API_KEY');
            const knowledgeConfig = localStorage.getItem('whatsapp_bot_knowledge_config');
            const escalationConfig = localStorage.getItem('whatsapp_bot_escalation_config');
            const broadcastConfig = localStorage.getItem('whatsapp_bot_broadcast_config');

            const config: Partial<UserConfig> = {};

            if (theme) config.theme = theme;
            if (geminiApiKey) config.geminiApiKey = geminiApiKey;
            if (knowledgeConfig) config.knowledgeConfig = JSON.parse(knowledgeConfig);
            if (escalationConfig) config.escalationConfig = JSON.parse(escalationConfig);
            if (broadcastConfig) config.broadcastConfig = JSON.parse(broadcastConfig);

            if (Object.keys(config).length > 0) {
                await this.updateUserConfig(userId, config);
                console.log('✅ Migrated settings from localStorage to Firebase');
            }
        } catch (error) {
            console.error('Error syncing from localStorage:', error);
            // Don't throw - migration is optional
        }
    }
}

export const userConfigService = new UserConfigServiceClass();
