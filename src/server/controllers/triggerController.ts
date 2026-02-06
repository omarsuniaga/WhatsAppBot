/**
 * TriggerController - API endpoints for managing bot triggers and listener state
 */

import { Request, Response } from 'express';
import TriggerService, { Trigger } from '../services/triggerService';

const triggerService = TriggerService.getInstance();

// ==========================================
// Listener Control
// ==========================================

/**
 * Get current listener and trigger configuration
 */
export const getConfig = async (req: Request, res: Response): Promise<void> => {
    try {
        const config = triggerService.getConfig();
        res.json({
            success: true,
            data: {
                listenerEnabled: config.listenerEnabled,
                requireTrigger: config.requireTrigger,
                settings: config.settings,
                stats: config.stats,
                triggersCount: config.triggers.length,
                activeTriggersCount: config.triggers.filter(t => t.enabled).length
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Toggle the message listener on/off
 */
export const toggleListener = async (req: Request, res: Response): Promise<void> => {
    try {
        const { enabled } = req.body;

        if (typeof enabled !== 'boolean') {
            res.status(400).json({
                success: false,
                error: 'enabled parameter must be a boolean'
            });
            return;
        }

        triggerService.setListenerEnabled(enabled);

        res.json({
            success: true,
            message: `Listener ${enabled ? 'activado' : 'desactivado'}`,
            listenerEnabled: enabled
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Toggle require trigger mode
 */
export const toggleRequireTrigger = async (req: Request, res: Response): Promise<void> => {
    try {
        const { require } = req.body;

        if (typeof require !== 'boolean') {
            res.status(400).json({
                success: false,
                error: 'require parameter must be a boolean'
            });
            return;
        }

        triggerService.setRequireTrigger(require);

        res.json({
            success: true,
            message: require
                ? 'Bot solo responderá cuando detecte una palabra clave'
                : 'Bot responderá a todos los mensajes',
            requireTrigger: require
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Update trigger settings
 */
export const updateSettings = async (req: Request, res: Response): Promise<void> => {
    try {
        const { settings } = req.body;

        if (!settings || typeof settings !== 'object') {
            res.status(400).json({
                success: false,
                error: 'settings object is required'
            });
            return;
        }

        triggerService.updateSettings(settings);

        res.json({
            success: true,
            message: 'Configuración actualizada',
            settings: triggerService.getConfig().settings
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// ==========================================
// Trigger CRUD
// ==========================================

/**
 * Get all triggers
 */
export const getAllTriggers = async (req: Request, res: Response): Promise<void> => {
    try {
        const { active } = req.query;
        const triggers = active === 'true'
            ? triggerService.getActiveTriggers()
            : triggerService.getAllTriggers();

        res.json({
            success: true,
            data: triggers,
            count: triggers.length
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Get a specific trigger by ID
 */
export const getTrigger = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const trigger = triggerService.getTrigger(id);

        if (!trigger) {
            res.status(404).json({
                success: false,
                error: 'Trigger no encontrado'
            });
            return;
        }

        res.json({
            success: true,
            data: trigger
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Create a new trigger
 */
export const createTrigger = async (req: Request, res: Response): Promise<void> => {
    try {
        const { keyword, matchType, caseSensitive, enabled, description, category, priority } = req.body;

        if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
            res.status(400).json({
                success: false,
                error: 'keyword es requerido y debe ser un texto no vacío'
            });
            return;
        }

        const trigger = triggerService.addTrigger({
            keyword: keyword.trim(),
            matchType: matchType || 'contains',
            caseSensitive: caseSensitive ?? false,
            enabled: enabled ?? true,
            description: description || '',
            category: category || '',
            priority: priority ?? 1
        });

        res.status(201).json({
            success: true,
            message: 'Trigger creado exitosamente',
            data: trigger
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Update an existing trigger
 */
export const updateTrigger = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Validate keyword if provided
        if (updates.keyword !== undefined) {
            if (typeof updates.keyword !== 'string' || updates.keyword.trim().length === 0) {
                res.status(400).json({
                    success: false,
                    error: 'keyword debe ser un texto no vacío'
                });
                return;
            }
            updates.keyword = updates.keyword.trim();
        }

        const trigger = triggerService.updateTrigger(id, updates);

        if (!trigger) {
            res.status(404).json({
                success: false,
                error: 'Trigger no encontrado'
            });
            return;
        }

        res.json({
            success: true,
            message: 'Trigger actualizado',
            data: trigger
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Delete a trigger
 */
export const deleteTrigger = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const deleted = triggerService.deleteTrigger(id);

        if (!deleted) {
            res.status(404).json({
                success: false,
                error: 'Trigger no encontrado'
            });
            return;
        }

        res.json({
            success: true,
            message: 'Trigger eliminado'
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Toggle a trigger's enabled state
 */
export const toggleTrigger = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const trigger = triggerService.toggleTrigger(id);

        if (!trigger) {
            res.status(404).json({
                success: false,
                error: 'Trigger no encontrado'
            });
            return;
        }

        res.json({
            success: true,
            message: `Trigger ${trigger.enabled ? 'activado' : 'desactivado'}`,
            data: trigger
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// ==========================================
// Bulk Operations
// ==========================================

/**
 * Enable all triggers
 */
export const enableAllTriggers = async (req: Request, res: Response): Promise<void> => {
    try {
        triggerService.enableAllTriggers();
        res.json({
            success: true,
            message: 'Todos los triggers han sido activados'
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Disable all triggers
 */
export const disableAllTriggers = async (req: Request, res: Response): Promise<void> => {
    try {
        triggerService.disableAllTriggers();
        res.json({
            success: true,
            message: 'Todos los triggers han sido desactivados'
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Import triggers from JSON
 */
export const importTriggers = async (req: Request, res: Response): Promise<void> => {
    try {
        const { triggers } = req.body;

        if (!Array.isArray(triggers)) {
            res.status(400).json({
                success: false,
                error: 'triggers debe ser un array'
            });
            return;
        }

        const count = triggerService.importTriggers(triggers);

        res.json({
            success: true,
            message: `${count} triggers importados`,
            count
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Export all triggers
 */
export const exportTriggers = async (req: Request, res: Response): Promise<void> => {
    try {
        const triggers = triggerService.exportTriggers();
        res.json({
            success: true,
            data: triggers,
            count: triggers.length
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// ==========================================
// Statistics
// ==========================================

/**
 * Get trigger statistics
 */
export const getStats = async (req: Request, res: Response): Promise<void> => {
    try {
        const stats = triggerService.getStats();
        const categories = triggerService.getCategories();

        res.json({
            success: true,
            data: {
                ...stats,
                categories
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Reset statistics
 */
export const resetStats = async (req: Request, res: Response): Promise<void> => {
    try {
        triggerService.resetStats();
        res.json({
            success: true,
            message: 'Estadísticas reiniciadas'
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Test a message against triggers
 */
export const testMessage = async (req: Request, res: Response): Promise<void> => {
    try {
        const { message } = req.body;

        if (!message || typeof message !== 'string') {
            res.status(400).json({
                success: false,
                error: 'message es requerido'
            });
            return;
        }

        const result = triggerService.shouldActivateBot(message, 'test-jid');

        res.json({
            success: true,
            data: {
                wouldActivate: result.activate,
                matchedTriggers: result.triggers,
                listenerEnabled: triggerService.isListenerEnabled(),
                requireTrigger: triggerService.isRequireTrigger()
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
