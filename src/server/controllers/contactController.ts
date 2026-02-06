import { Request, Response } from 'express';
import ContactService from '../services/contactService';

export const searchContacts = async (req: Request, res: Response): Promise<void> => {
    try {
        const { q } = req.query;

        if (!q || typeof q !== 'string') {
            res.status(400).json({
                success: false,
                error: 'Search query parameter "q" is required'
            });
            return;
        }

        const contactService = ContactService.getInstance();
        const contacts = await contactService.searchContacts(q);

        res.json({
            success: true,
            data: contacts
        });
    } catch (error: any) {
        console.error('Error searching contacts:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

export const getAllContacts = async (req: Request, res: Response): Promise<void> => {
    try {
        const contactService = ContactService.getInstance();
        const contacts = await contactService.getAllContacts();

        res.json({
            success: true,
            data: contacts
        });
    } catch (error: any) {
        console.error('Error getting all contacts:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

export const getContactInfo = async (req: Request, res: Response): Promise<void> => {
    try {
        const { jid } = req.params;

        if (!jid) {
            res.status(400).json({
                success: false,
                error: 'jid parameter is required'
            });
            return;
        }

        const contactService = ContactService.getInstance();
        const contactInfo = await contactService.getContactInfo(jid);

        res.json({
            success: true,
            data: contactInfo
        });
    } catch (error: any) {
        console.error('Error getting contact info:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
