/**
 * Driving adapter — translates HTTP requests into calls on the
 * application service. Input validation belongs here (the HTTP boundary),
 * not in the domain or application layer.
 */
import { Request, Response } from 'express';
import { BotOrchestrator } from '../../../agents/BotOrchestrator';
import { isValidRelationType, isValidLanguage } from '../domain/ConversationContext';

export const getAll = async (req: Request, res: Response): Promise<void> => {
    try {
        const orchestrator = BotOrchestrator.getInstance();
        const contexts = orchestrator.getContextService().getAllContexts();

        res.json({ success: true, data: contexts });
    } catch (error: any) {
        console.error('Error getting conversation contexts:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getByChat = async (req: Request, res: Response): Promise<void> => {
    try {
        const { jid } = req.params;
        const orchestrator = BotOrchestrator.getInstance();
        const context = orchestrator.getContextService().getContext(decodeURIComponent(jid));

        if (!context) {
            res.status(404).json({ success: false, error: 'Context not found' });
            return;
        }

        res.json({ success: true, data: context });
    } catch (error: any) {
        console.error('Error getting conversation context:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
    try {
        const { jid } = req.params;
        const { displayName, relationType, preferredLanguage, tags } = req.body;

        if (relationType !== undefined && !isValidRelationType(relationType)) {
            res.status(400).json({ success: false, error: 'Invalid relationType' });
            return;
        }
        if (preferredLanguage !== undefined && !isValidLanguage(preferredLanguage)) {
            res.status(400).json({ success: false, error: 'Invalid preferredLanguage' });
            return;
        }
        if (tags !== undefined && !Array.isArray(tags)) {
            res.status(400).json({ success: false, error: 'tags must be an array' });
            return;
        }

        const orchestrator = BotOrchestrator.getInstance();
        const context = orchestrator.getContextService().updateProfile(decodeURIComponent(jid), {
            displayName,
            relationType,
            preferredLanguage,
            tags
        });

        if (!context) {
            res.status(404).json({ success: false, error: 'Context not found' });
            return;
        }

        res.json({ success: true, data: context });
    } catch (error: any) {
        console.error('Error updating conversation context profile:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const setOptedOut = async (req: Request, res: Response): Promise<void> => {
    try {
        const { jid } = req.params;
        const { optedOut } = req.body;

        if (typeof optedOut !== 'boolean') {
            res.status(400).json({ success: false, error: 'optedOut must be a boolean' });
            return;
        }

        const orchestrator = BotOrchestrator.getInstance();
        const context = orchestrator.getContextService().setOptedOut(decodeURIComponent(jid), optedOut);

        if (!context) {
            res.status(404).json({ success: false, error: 'Context not found' });
            return;
        }

        res.json({ success: true, data: context });
    } catch (error: any) {
        console.error('Error updating opt-out status:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
