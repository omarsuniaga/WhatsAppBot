/**
 * Broadcast Controller
 * API endpoints para gestión de campañas y difusión masiva
 */

import { Request, Response } from 'express';
import { BroadcastService } from '../services/broadcastService';
import { getErrorMessage } from '../utils/errorUtils';

const broadcastService = BroadcastService.getInstance();

// ==========================================
// Configuration
// ==========================================

export const getConfig = async (req: Request, res: Response): Promise<void> => {
    try {
        const config = broadcastService.getConfig();
        // Include legacy aliases for existing frontend forms
        res.json({
            success: true,
            data: {
                ...config,
                messageDelay: config.defaultDelay,
                randomizeDelay: config.defaultRandomizeDelay,
                startHour: config.allowedHours?.start,
                endHour: config.allowedHours?.end
            }
        });
    } catch (error: unknown) {
        res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
};

export const updateConfig = async (req: Request, res: Response): Promise<void> => {
    try {
        const config = broadcastService.updateConfig(req.body);
        res.json({ success: true, data: config });
    } catch (error: unknown) {
        res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
};

// ==========================================
// Contact Lists
// ==========================================

export const getContactLists = async (req: Request, res: Response): Promise<void> => {
    try {
        const lists = broadcastService.getContactLists();
        res.json({ success: true, data: lists });
    } catch (error: unknown) {
        res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
};

export const getContactList = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const list = broadcastService.getContactList(id);
        
        if (!list) {
            res.status(404).json({ success: false, error: 'Contact list not found' });
            return;
        }

        res.json({ success: true, data: list });
    } catch (error: unknown) {
        res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
};

export const createContactList = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, description, tags } = req.body;

        if (!name) {
            res.status(400).json({ success: false, error: 'name is required' });
            return;
        }

        const list = broadcastService.createContactList({ name, description, tags });
        res.json({ success: true, data: list });
    } catch (error: unknown) {
        res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
};

export const updateContactList = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const list = broadcastService.updateContactList(id, req.body);
        
        if (!list) {
            res.status(404).json({ success: false, error: 'Contact list not found' });
            return;
        }

        res.json({ success: true, data: list });
    } catch (error: unknown) {
        res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
};

export const deleteContactList = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const success = broadcastService.deleteContactList(id);
        
        if (!success) {
            res.status(404).json({ success: false, error: 'Contact list not found' });
            return;
        }

        res.json({ success: true });
    } catch (error: unknown) {
        res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
};

export const addContactToList = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { jid, name, phone, customFields } = req.body;

        if (!phone && !jid) {
            res.status(400).json({ success: false, error: 'phone or jid is required' });
            return;
        }

        const normalizedJid = jid || `${phone.replace(/\D/g, '')}@s.whatsapp.net`;
        const normalizedPhone = phone || jid.split('@')[0];

        const list = broadcastService.addContactToList(id, {
            jid: normalizedJid,
            name: name || normalizedPhone,
            phone: normalizedPhone,
            customFields
        });

        if (!list) {
            res.status(404).json({ success: false, error: 'Contact list not found' });
            return;
        }

        res.json({ success: true, data: list });
    } catch (error: unknown) {
        res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
};

export const removeContactFromList = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id, jid } = req.params;
        const list = broadcastService.removeContactFromList(id, jid);

        if (!list) {
            res.status(404).json({ success: false, error: 'Contact list not found' });
            return;
        }

        res.json({ success: true, data: list });
    } catch (error: unknown) {
        res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
};

export const importContacts = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { contacts } = req.body;

        if (!contacts || !Array.isArray(contacts)) {
            res.status(400).json({ success: false, error: 'contacts array is required' });
            return;
        }

        const result = broadcastService.importContacts(id, contacts);
        res.json({ success: true, data: result });
    } catch (error: unknown) {
        res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
};

// ==========================================
// Templates
// ==========================================

export const getTemplates = async (req: Request, res: Response): Promise<void> => {
    try {
        const templates = broadcastService.getTemplates();
        res.json({ success: true, data: templates });
    } catch (error: unknown) {
        res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
};

export const getTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const template = broadcastService.getTemplate(id);
        
        if (!template) {
            res.status(404).json({ success: false, error: 'Template not found' });
            return;
        }

        res.json({ success: true, data: template });
    } catch (error: unknown) {
        res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
};

export const createTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, description, category, content, mediaUrl, mediaType } = req.body;

        if (!name || !content) {
            res.status(400).json({ success: false, error: 'name and content are required' });
            return;
        }

        const template = broadcastService.createTemplate({
            name,
            description,
            category: category || 'general',
            content,
            mediaUrl,
            mediaType
        });

        res.json({ success: true, data: template });
    } catch (error: unknown) {
        res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
};

export const updateTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const template = broadcastService.updateTemplate(id, req.body);
        
        if (!template) {
            res.status(404).json({ success: false, error: 'Template not found' });
            return;
        }

        res.json({ success: true, data: template });
    } catch (error: unknown) {
        res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
};

export const deleteTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const success = broadcastService.deleteTemplate(id);
        
        if (!success) {
            res.status(404).json({ success: false, error: 'Template not found' });
            return;
        }

        res.json({ success: true });
    } catch (error: unknown) {
        res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
};

// ==========================================
// Campaigns
// ==========================================

export const getCampaigns = async (req: Request, res: Response): Promise<void> => {
    try {
        const campaigns = broadcastService.getCampaigns();
        res.json({ success: true, data: campaigns });
    } catch (error: unknown) {
        res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
};

export const getCampaign = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const campaign = broadcastService.getCampaign(id);
        
        if (!campaign) {
            res.status(404).json({ success: false, error: 'Campaign not found' });
            return;
        }

        res.json({ success: true, data: campaign });
    } catch (error: unknown) {
        res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
};

export const createCampaign = async (req: Request, res: Response): Promise<void> => {
    try {
        const { 
            name, description, message, mediaUrl, mediaType,
            targetLists, targetContacts, excludeContacts,
            schedule, delayBetweenMessages, randomizeDelay, personalizeMessage
        } = req.body;

        if (!name || !message) {
            res.status(400).json({ success: false, error: 'name and message are required' });
            return;
        }

        if (!targetLists?.length && !targetContacts?.length) {
            res.status(400).json({ 
                success: false, 
                error: 'At least one targetList or targetContact is required' 
            });
            return;
        }

        const campaign = broadcastService.createCampaign({
            name,
            description,
            message,
            mediaUrl,
            mediaType,
            targetLists: targetLists || [],
            targetContacts,
            excludeContacts,
            schedule: schedule ? new Date(schedule) : undefined,
            delayBetweenMessages,
            randomizeDelay,
            personalizeMessage
        });

        res.json({ success: true, data: campaign });
    } catch (error: unknown) {
        res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
};

export const updateCampaign = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const campaign = broadcastService.updateCampaign(id, req.body);
        
        if (!campaign) {
            res.status(404).json({ success: false, error: 'Campaign not found or is running' });
            return;
        }

        res.json({ success: true, data: campaign });
    } catch (error: unknown) {
        res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
};

export const deleteCampaign = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const success = broadcastService.deleteCampaign(id);
        
        if (!success) {
            res.status(404).json({ success: false, error: 'Campaign not found or is running' });
            return;
        }

        res.json({ success: true });
    } catch (error: unknown) {
        res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
};

export const startCampaign = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const result = await broadcastService.startCampaign(id);

        if (!result.success) {
            res.status(400).json({ success: false, error: result.error });
            return;
        }

        res.json({ success: true, data: { message: 'Campaign started' } });
    } catch (error: unknown) {
        res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
};

export const pauseCampaign = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const success = broadcastService.pauseCampaign(id);

        if (!success) {
            res.status(400).json({ success: false, error: 'Campaign is not running' });
            return;
        }

        res.json({ success: true, data: { message: 'Campaign paused' } });
    } catch (error: unknown) {
        res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
};

export const getCampaignProgress = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const progress = broadcastService.getCampaignProgress(id);

        if (!progress) {
            const campaign = broadcastService.getCampaign(id);
            if (campaign) {
                res.json({ 
                    success: true, 
                    data: {
                        campaignId: id,
                        status: campaign.status,
                        progress: campaign.status === 'completed' ? 100 : 0,
                        sent: campaign.sent,
                        total: campaign.totalRecipients
                    }
                });
                return;
            }
            res.status(404).json({ success: false, error: 'Campaign not found' });
            return;
        }

        res.json({ success: true, data: progress });
    } catch (error: unknown) {
        res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
};

// ==========================================
// Stats
// ==========================================

export const getStats = async (req: Request, res: Response): Promise<void> => {
    try {
        const stats = broadcastService.getStats();
        res.json({ success: true, data: stats });
    } catch (error: unknown) {
        res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
};
