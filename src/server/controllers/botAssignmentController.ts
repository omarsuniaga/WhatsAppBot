/**
 * Bot Assignment Controller - Handles API routes for bot configurations per chat
 */
import { Request, Response } from 'express';
import { BotOrchestrator } from '../../agents/BotOrchestrator';

/**
 * Get all bot assignments
 */
export const getAll = async (req: Request, res: Response): Promise<void> => {
    try {
        const orchestrator = BotOrchestrator.getInstance();
        const assignmentService = orchestrator.getAssignmentService();

        const activeOnly = req.query.active === 'true';
        
        const assignments = activeOnly 
            ? assignmentService.getActiveAssignments()
            : assignmentService.getAllAssignments();

        res.json({
            success: true,
            data: assignments,
            stats: assignmentService.getAggregateStats()
        });
    } catch (error: any) {
        console.error('Error getting bot assignments:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Get assignment by JID
 */
export const getByJid = async (req: Request, res: Response): Promise<void> => {
    try {
        const { jid } = req.params;
        const orchestrator = BotOrchestrator.getInstance();
        const assignmentService = orchestrator.getAssignmentService();

        const assignment = assignmentService.getAssignment(decodeURIComponent(jid));

        if (!assignment) {
            res.status(404).json({
                success: false,
                error: 'Assignment not found'
            });
            return;
        }

        res.json({
            success: true,
            data: assignment
        });
    } catch (error: any) {
        console.error('Error getting bot assignment:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Create or update bot assignment
 */
export const createOrUpdate = async (req: Request, res: Response): Promise<void> => {
    try {
        const { chatJid, chatName, isGroup = false, botConfig } = req.body;

        if (!chatJid) {
            res.status(400).json({
                success: false,
                error: 'chatJid is required'
            });
            return;
        }

        const orchestrator = BotOrchestrator.getInstance();
        const assignmentService = orchestrator.getAssignmentService();

        // Check if assignment exists
        let assignment = assignmentService.getAssignment(chatJid);

        if (assignment) {
            // Update existing
            if (botConfig) {
                assignment = assignmentService.updateAssignment(chatJid, botConfig);
            }
        } else {
            // Create new
            assignment = assignmentService.createAssignment(
                chatJid,
                chatName || chatJid.split('@')[0],
                isGroup,
                botConfig
            );
        }

        // Emit WebSocket event
        const io = (req as any).io;
        if (io) {
            io.emit('assignment:updated', assignment);
        }

        res.json({
            success: true,
            data: assignment
        });
    } catch (error: any) {
        console.error('Error creating/updating bot assignment:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Update bot configuration for a chat
 */
export const update = async (req: Request, res: Response): Promise<void> => {
    try {
        const { jid } = req.params;
        const updates = req.body;

        const orchestrator = BotOrchestrator.getInstance();
        const assignmentService = orchestrator.getAssignmentService();

        const assignment = assignmentService.updateAssignment(decodeURIComponent(jid), updates);

        if (!assignment) {
            res.status(404).json({
                success: false,
                error: 'Assignment not found'
            });
            return;
        }

        // Emit WebSocket event
        const io = (req as any).io;
        if (io) {
            io.emit('assignment:updated', assignment);
        }

        res.json({
            success: true,
            data: assignment
        });
    } catch (error: any) {
        console.error('Error updating bot assignment:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Toggle bot for a chat
 */
export const toggleBot = async (req: Request, res: Response): Promise<void> => {
    try {
        const { jid } = req.params;
        const { enabled, chatName } = req.body;

        if (typeof enabled !== 'boolean') {
            res.status(400).json({
                success: false,
                error: 'enabled (boolean) is required'
            });
            return;
        }

        const orchestrator = BotOrchestrator.getInstance();
        const assignmentService = orchestrator.getAssignmentService();

        const assignment = assignmentService.toggleBot(
            decodeURIComponent(jid), 
            enabled,
            chatName
        );

        // Emit WebSocket event
        const io = (req as any).io;
        if (io) {
            io.emit('bot:toggled', { 
                chatJid: decodeURIComponent(jid), 
                enabled,
                assignment 
            });
        }

        res.json({
            success: true,
            data: assignment
        });
    } catch (error: any) {
        console.error('Error toggling bot:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Delete bot assignment
 */
export const deleteAssignment = async (req: Request, res: Response): Promise<void> => {
    try {
        const { jid } = req.params;

        const orchestrator = BotOrchestrator.getInstance();
        const assignmentService = orchestrator.getAssignmentService();

        const deleted = assignmentService.deleteAssignment(decodeURIComponent(jid));

        if (!deleted) {
            res.status(404).json({
                success: false,
                error: 'Assignment not found'
            });
            return;
        }

        // Emit WebSocket event
        const io = (req as any).io;
        if (io) {
            io.emit('assignment:deleted', { chatJid: decodeURIComponent(jid) });
        }

        res.json({
            success: true,
            data: { deleted: true }
        });
    } catch (error: any) {
        console.error('Error deleting bot assignment:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Get default bot configuration
 */
export const getDefaultConfig = async (req: Request, res: Response): Promise<void> => {
    try {
        const orchestrator = BotOrchestrator.getInstance();
        const assignmentService = orchestrator.getAssignmentService();

        const defaultConfig = assignmentService.getDefaultConfig();

        res.json({
            success: true,
            data: defaultConfig
        });
    } catch (error: any) {
        console.error('Error getting default config:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Update default bot configuration
 */
export const updateDefaultConfig = async (req: Request, res: Response): Promise<void> => {
    try {
        const updates = req.body;

        const orchestrator = BotOrchestrator.getInstance();
        const assignmentService = orchestrator.getAssignmentService();

        assignmentService.updateDefaultConfig(updates);

        res.json({
            success: true,
            data: assignmentService.getDefaultConfig()
        });
    } catch (error: any) {
        console.error('Error updating default config:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Get aggregate statistics
 */
export const getStats = async (req: Request, res: Response): Promise<void> => {
    try {
        const orchestrator = BotOrchestrator.getInstance();
        const assignmentService = orchestrator.getAssignmentService();

        const stats = assignmentService.getAggregateStats();

        res.json({
            success: true,
            data: stats
        });
    } catch (error: any) {
        console.error('Error getting assignment stats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
