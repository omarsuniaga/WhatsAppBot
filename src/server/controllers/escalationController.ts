/**
 * Escalation Controller
 * API endpoints para gestión de tickets y administradores
 */

import { Request, Response } from 'express';
import { EscalationService } from '../services/escalationService';

const escalationService = EscalationService.getInstance();

// ==========================================
// Configuration
// ==========================================

export const getConfig = async (req: Request, res: Response): Promise<void> => {
    try {
        const config = escalationService.getConfig();
        res.json({ success: true, data: config });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const updateConfig = async (req: Request, res: Response): Promise<void> => {
    try {
        const config = escalationService.updateConfig(req.body);
        res.json({ success: true, data: config });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==========================================
// Admins
// ==========================================

export const getAdmins = async (req: Request, res: Response): Promise<void> => {
    try {
        const activeOnly = req.query.active === 'true';
        const admins = activeOnly 
            ? escalationService.getActiveAdmins()
            : escalationService.getAdmins();
        res.json({ success: true, data: admins });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const addAdmin = async (req: Request, res: Response): Promise<void> => {
    try {
        const { jid, name, role, ...rest } = req.body;

        if (!jid || !name) {
            res.status(400).json({ 
                success: false, 
                error: 'jid and name are required' 
            });
            return;
        }

        // Normalize JID
        let normalizedJid = jid;
        if (!jid.includes('@')) {
            normalizedJid = `${jid.replace(/\D/g, '')}@s.whatsapp.net`;
        }

        const admin = escalationService.addAdmin({
            jid: normalizedJid,
            name,
            role: role || 'admin',
            ...rest
        });

        res.json({ success: true, data: admin });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const updateAdmin = async (req: Request, res: Response): Promise<void> => {
    try {
        const { jid } = req.params;
        const admin = escalationService.updateAdmin(jid, req.body);
        
        if (!admin) {
            res.status(404).json({ success: false, error: 'Admin not found' });
            return;
        }

        res.json({ success: true, data: admin });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const removeAdmin = async (req: Request, res: Response): Promise<void> => {
    try {
        const { jid } = req.params;
        const success = escalationService.removeAdmin(jid);
        
        if (!success) {
            res.status(404).json({ success: false, error: 'Admin not found' });
            return;
        }

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==========================================
// Tickets
// ==========================================

export const getTickets = async (req: Request, res: Response): Promise<void> => {
    try {
        const { status, priority, assignedTo } = req.query;
        let tickets = escalationService.getAllTickets();

        if (status) {
            tickets = tickets.filter(t => t.status === status);
        }

        if (priority) {
            tickets = tickets.filter(t => t.priority === priority);
        }

        if (assignedTo) {
            tickets = tickets.filter(t => t.assignedTo === assignedTo);
        }

        res.json({ success: true, data: tickets });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getPendingTickets = async (req: Request, res: Response): Promise<void> => {
    try {
        const tickets = escalationService.getPendingTickets();
        res.json({ success: true, data: tickets });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getTicket = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const ticket = escalationService.getTicket(id);
        
        if (!ticket) {
            res.status(404).json({ success: false, error: 'Ticket not found' });
            return;
        }

        res.json({ success: true, data: ticket });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const createTicket = async (req: Request, res: Response): Promise<void> => {
    try {
        const { chatJid, customerName, customerPhone, originalMessage, priority } = req.body;

        if (!chatJid || !originalMessage) {
            res.status(400).json({ 
                success: false, 
                error: 'chatJid and originalMessage are required' 
            });
            return;
        }

        const ticket = await escalationService.createTicket({
            chatJid,
            customerName: customerName || chatJid.split('@')[0],
            customerPhone: customerPhone || chatJid.split('@')[0],
            originalMessage,
            conversationContext: [],
            priority
        });

        res.json({ success: true, data: ticket });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const assignTicket = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { adminJid } = req.body;

        if (!adminJid) {
            res.status(400).json({ success: false, error: 'adminJid is required' });
            return;
        }

        const ticket = await escalationService.assignTicket(id, adminJid);
        
        if (!ticket) {
            res.status(404).json({ success: false, error: 'Ticket not found' });
            return;
        }

        res.json({ success: true, data: ticket });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const resolveTicket = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { response, shouldLearn } = req.body;

        if (!response) {
            res.status(400).json({ success: false, error: 'response is required' });
            return;
        }

        const ticket = await escalationService.resolveTicket(id, response, shouldLearn);
        
        if (!ticket) {
            res.status(404).json({ success: false, error: 'Ticket not found' });
            return;
        }

        res.json({ success: true, data: ticket });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const closeTicket = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const ticket = escalationService.closeTicket(id);
        
        if (!ticket) {
            res.status(404).json({ success: false, error: 'Ticket not found' });
            return;
        }

        res.json({ success: true, data: ticket });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const updateTicket = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const ticket = escalationService.updateTicket(id, req.body);
        
        if (!ticket) {
            res.status(404).json({ success: false, error: 'Ticket not found' });
            return;
        }

        res.json({ success: true, data: ticket });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==========================================
// Stats
// ==========================================

export const getStats = async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('[EscalationController] getStats called');
        const stats = escalationService.getStats();
        console.log('[EscalationController] getStats success:', stats ? 'ok' : 'null');
        res.json({ success: true, data: stats });
    } catch (error: any) {
        console.error('[EscalationController] getStats CRITICAL error:', error);
        if (error.stack) console.error(error.stack);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==========================================
// Admin Response Handler
// ==========================================

export const handleAdminResponse = async (req: Request, res: Response): Promise<void> => {
    try {
        const { adminJid, message } = req.body;

        if (!adminJid || !message) {
            res.status(400).json({ 
                success: false, 
                error: 'adminJid and message are required' 
            });
            return;
        }

        const result = await escalationService.handleAdminMessage(adminJid, message);
        res.json({ success: true, data: result });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};
