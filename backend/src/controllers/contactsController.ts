/**
 * Contacts Controller - CRUD operations for Contact entities
 */

import { Request, Response } from 'express';
import { ContactsRepo } from '../repos';
import { ContactStatus, ContactType } from '../domain';

const repo = ContactsRepo.getInstance();

export const list = async (req: Request, res: Response) => {
    try {
        const { status, type, search } = req.query;
        let contacts = await repo.list();

        if (status) {
            contacts = contacts.filter(c => c.status === status);
        }
        if (type) {
            contacts = contacts.filter(c => c.type === type);
        }
        if (search && typeof search === 'string') {
            contacts = await repo.search(search);
        }

        res.json({ success: true, data: contacts, count: contacts.length });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getById = async (req: Request, res: Response) => {
    try {
        const contact = await repo.getById(req.params.id);
        if (!contact) {
            return res.status(404).json({ success: false, error: 'Contact not found' });
        }
        res.json({ success: true, data: contact });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const create = async (req: Request, res: Response) => {
    try {
        const { firstName, lastName, phones, type, displayName, email, notes, tags } = req.body;

        if (!firstName || !lastName || !phones?.length) {
            return res.status(400).json({
                success: false,
                error: 'firstName, lastName, and phones are required'
            });
        }

        const contact = await repo.upsert({
            firstName,
            lastName,
            displayName,
            phones,
            email,
            type: type || ContactType.Guardian,
            status: ContactStatus.Active,
            studentIds: [],
            notes,
            tags: tags || []
        });

        res.status(201).json({ success: true, data: contact });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const update = async (req: Request, res: Response) => {
    try {
        const existing = await repo.getById(req.params.id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Contact not found' });
        }

        const contact = await repo.upsert({
            ...existing,
            ...req.body,
            id: req.params.id
        });

        res.json({ success: true, data: contact });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const remove = async (req: Request, res: Response) => {
    try {
        const deleted = await repo.remove(req.params.id);
        if (!deleted) {
            return res.status(404).json({ success: false, error: 'Contact not found' });
        }
        res.json({ success: true, message: 'Contact deleted' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};
