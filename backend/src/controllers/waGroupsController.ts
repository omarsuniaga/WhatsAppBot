/**
 * WhatsApp Groups Controller - CRUD operations for WhatsAppGroup entities
 */

import { Request, Response } from 'express';
import { WhatsAppGroupsRepo } from '../repos';
import { WhatsAppGroupType, WhatsAppGroupStatus } from '../domain';

const repo = WhatsAppGroupsRepo.getInstance();

export const list = async (req: Request, res: Response) => {
    try {
        const { type, status, botEnabled } = req.query;
        let groups = await repo.list();

        if (type) {
            groups = groups.filter(g => g.type === type);
        }
        if (status) {
            groups = groups.filter(g => g.status === status);
        }
        if (botEnabled !== undefined) {
            groups = groups.filter(g => g.botEnabled === (botEnabled === 'true'));
        }

        res.json({ success: true, data: groups, count: groups.length });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getById = async (req: Request, res: Response) => {
    try {
        const group = await repo.getById(req.params.id);
        if (!group) {
            return res.status(404).json({ success: false, error: 'WhatsApp group not found' });
        }
        res.json({ success: true, data: group });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const create = async (req: Request, res: Response) => {
    try {
        const { jid, name, type, classGroupId, programId, description, botEnabled, announcementsOnly } = req.body;

        if (!jid || !name || !type) {
            return res.status(400).json({
                success: false,
                error: 'jid, name, and type are required'
            });
        }

        // Check if JID already registered
        const existing = await repo.findByJid(jid);
        if (existing) {
            return res.status(409).json({
                success: false,
                error: 'WhatsApp group with this JID already exists'
            });
        }

        const group = await repo.upsert({
            jid,
            name,
            type,
            classGroupId,
            programId,
            description,
            participantJids: [],
            adminJids: [],
            botEnabled: botEnabled ?? true,
            announcementsOnly: announcementsOnly ?? false,
            status: WhatsAppGroupStatus.Active
        });

        res.status(201).json({ success: true, data: group });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const update = async (req: Request, res: Response) => {
    try {
        const existing = await repo.getById(req.params.id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'WhatsApp group not found' });
        }

        const group = await repo.upsert({
            ...existing,
            ...req.body,
            id: req.params.id
        });

        res.json({ success: true, data: group });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const remove = async (req: Request, res: Response) => {
    try {
        const deleted = await repo.remove(req.params.id);
        if (!deleted) {
            return res.status(404).json({ success: false, error: 'WhatsApp group not found' });
        }
        res.json({ success: true, message: 'WhatsApp group deleted' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Toggle bot for a group
 */
export const toggleBot = async (req: Request, res: Response) => {
    try {
        const existing = await repo.getById(req.params.id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'WhatsApp group not found' });
        }

        const group = await repo.upsert({
            ...existing,
            botEnabled: !existing.botEnabled
        });

        res.json({
            success: true,
            data: group,
            message: `Bot ${group.botEnabled ? 'enabled' : 'disabled'} for ${group.name}`
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};
