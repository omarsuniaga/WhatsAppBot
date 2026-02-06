/**
 * Triggers Controller - REST endpoints for trigger management
 */

import { Request, Response } from 'express';
import { TriggerService } from '../services';
import { TriggerRepo } from '../repos';

const service = TriggerService.getInstance();
const repo = TriggerRepo.getInstance();

// ============================================================
// CONFIGURATION & CONTROL
// ============================================================

export const getConfig = async (req: Request, res: Response) => {
    try {
        const config = service.getConfig();
        res.json({ success: true, data: config });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const toggleListener = async (req: Request, res: Response) => {
    try {
        const { enabled } = req.body;
        if (typeof enabled !== 'boolean') {
            return res.status(400).json({ success: false, error: 'enabled must be boolean' });
        }
        service.setListenerEnabled(enabled);
        res.json({ success: true, data: { listenerEnabled: enabled } });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const toggleRequireTrigger = async (req: Request, res: Response) => {
    try {
        const { require: requireTrigger } = req.body;
        if (typeof requireTrigger !== 'boolean') {
            return res.status(400).json({ success: false, error: 'require must be boolean' });
        }
        service.setRequireTrigger(requireTrigger);
        res.json({ success: true, data: { requireTrigger } });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const updateSettings = async (req: Request, res: Response) => {
    try {
        const { settings } = req.body;
        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({ success: false, error: 'settings object required' });
        }

        if (typeof settings.listenerEnabled === 'boolean') {
            service.setListenerEnabled(settings.listenerEnabled);
        }
        if (typeof settings.requireTrigger === 'boolean') {
            service.setRequireTrigger(settings.requireTrigger);
        }

        res.json({ success: true, data: service.getConfig() });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ============================================================
// CRUD OPERATIONS
// ============================================================

export const getAll = async (req: Request, res: Response) => {
    try {
        const { active } = req.query;
        const triggers = await service.getAll(active === 'true');
        res.json({ success: true, data: triggers, count: triggers.length });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getById = async (req: Request, res: Response) => {
    try {
        const trigger = await service.getById(req.params.id);
        if (!trigger) {
            return res.status(404).json({ success: false, error: 'Trigger not found' });
        }
        res.json({ success: true, data: trigger });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const create = async (req: Request, res: Response) => {
    try {
        const { keyword, matchType, caseSensitive, enabled, description, category, priority } = req.body;

        if (!keyword || !matchType) {
            return res.status(400).json({
                success: false,
                error: 'keyword and matchType are required'
            });
        }

        const trigger = await service.create({
            keyword: keyword.trim(),
            matchType,
            caseSensitive: caseSensitive || false,
            enabled: enabled !== false,
            description: description || '',
            category: category || '',
            priority: priority || 0
        });

        res.status(201).json({ success: true, data: trigger });
    } catch (error: any) {
        res.status(400).json({ success: false, error: error.message });
    }
};

export const update = async (req: Request, res: Response) => {
    try {
        const trigger = await service.update(req.params.id, req.body);
        res.json({ success: true, data: trigger });
    } catch (error: any) {
        if (error.message.includes('not found')) {
            return res.status(404).json({ success: false, error: error.message });
        }
        res.status(400).json({ success: false, error: error.message });
    }
};

export const remove = async (req: Request, res: Response) => {
    try {
        await service.delete(req.params.id);
        res.json({ success: true, message: 'Trigger deleted' });
    } catch (error: any) {
        if (error.message.includes('not found')) {
            return res.status(404).json({ success: false, error: error.message });
        }
        res.status(500).json({ success: false, error: error.message });
    }
};

export const toggle = async (req: Request, res: Response) => {
    try {
        const trigger = await service.toggle(req.params.id);
        res.json({ success: true, data: trigger });
    } catch (error: any) {
        if (error.message.includes('not found')) {
            return res.status(404).json({ success: false, error: error.message });
        }
        res.status(500).json({ success: false, error: error.message });
    }
};

// ============================================================
// BULK OPERATIONS
// ============================================================

export const enableAll = async (req: Request, res: Response) => {
    try {
        await service.enableAll();
        const triggers = await service.getAll();
        res.json({ success: true, data: triggers, message: 'All triggers enabled' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const disableAll = async (req: Request, res: Response) => {
    try {
        await service.disableAll();
        const triggers = await service.getAll();
        res.json({ success: true, data: triggers, message: 'All triggers disabled' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const importTriggers = async (req: Request, res: Response) => {
    try {
        const { triggers } = req.body;
        if (!Array.isArray(triggers)) {
            return res.status(400).json({ success: false, error: 'triggers must be an array' });
        }

        const imported = await service.import(triggers);
        res.status(201).json({ success: true, data: imported, count: imported.length });
    } catch (error: any) {
        res.status(400).json({ success: false, error: error.message });
    }
};

export const exportTriggers = async (req: Request, res: Response) => {
    try {
        const triggers = await service.export();
        res.json({ success: true, data: triggers, count: triggers.length });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ============================================================
// STATS & TESTING
// ============================================================

export const getStats = async (req: Request, res: Response) => {
    try {
        const stats = await service.getStats();
        res.json({ success: true, data: stats });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const resetStats = async (req: Request, res: Response) => {
    try {
        await service.resetStats();
        res.json({ success: true, message: 'Stats reset' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const testMessage = async (req: Request, res: Response) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ success: false, error: 'message is required' });
        }

        const result = await service.testMessage(message);
        res.json({ success: true, data: result });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};
