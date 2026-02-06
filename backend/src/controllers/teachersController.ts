/**
 * Teachers Controller - CRUD operations for Teacher entities
 */

import { Request, Response } from 'express';
import { TeachersRepo } from '../repos';
import { TeacherStatus } from '../domain';

const repo = TeachersRepo.getInstance();

export const list = async (req: Request, res: Response) => {
    try {
        const { status, instrument, search } = req.query;
        let teachers = await repo.list();

        if (status) {
            teachers = teachers.filter(t => t.status === status);
        }
        if (instrument && typeof instrument === 'string') {
            teachers = teachers.filter(t => t.instruments.includes(instrument));
        }
        if (search && typeof search === 'string') {
            teachers = await repo.search(search);
        }

        res.json({ success: true, data: teachers, count: teachers.length });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getById = async (req: Request, res: Response) => {
    try {
        const teacher = await repo.getById(req.params.id);
        if (!teacher) {
            return res.status(404).json({ success: false, error: 'Teacher not found' });
        }
        res.json({ success: true, data: teacher });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const create = async (req: Request, res: Response) => {
    try {
        const { firstName, lastName, phone, email, instruments, specializations, notes, tags } = req.body;

        if (!firstName || !lastName) {
            return res.status(400).json({
                success: false,
                error: 'firstName and lastName are required'
            });
        }

        const teacher = await repo.upsert({
            firstName,
            lastName,
            phone,
            email,
            status: TeacherStatus.Active,
            instruments: instruments || [],
            specializations: specializations || [],
            classGroupIds: [],
            notes,
            tags: tags || []
        });

        res.status(201).json({ success: true, data: teacher });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const update = async (req: Request, res: Response) => {
    try {
        const existing = await repo.getById(req.params.id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Teacher not found' });
        }

        const teacher = await repo.upsert({
            ...existing,
            ...req.body,
            id: req.params.id
        });

        res.json({ success: true, data: teacher });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const remove = async (req: Request, res: Response) => {
    try {
        const deleted = await repo.remove(req.params.id);
        if (!deleted) {
            return res.status(404).json({ success: false, error: 'Teacher not found' });
        }
        res.json({ success: true, message: 'Teacher deleted' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};
