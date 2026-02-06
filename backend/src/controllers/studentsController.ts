/**
 * Students Controller - CRUD operations for Student entities
 */

import { Request, Response } from 'express';
import { StudentsRepo } from '../repos';
import { StudentStatus } from '../domain';

const repo = StudentsRepo.getInstance();

export const list = async (req: Request, res: Response) => {
    try {
        const { status, instrument, search } = req.query;
        let students = await repo.list();

        if (status) {
            students = students.filter(s => s.status === status);
        }
        if (instrument && typeof instrument === 'string') {
            students = students.filter(s => s.instruments.includes(instrument));
        }
        if (search && typeof search === 'string') {
            students = await repo.search(search);
        }

        res.json({ success: true, data: students, count: students.length });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getById = async (req: Request, res: Response) => {
    try {
        const student = await repo.getById(req.params.id);
        if (!student) {
            return res.status(404).json({ success: false, error: 'Student not found' });
        }
        res.json({ success: true, data: student });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const create = async (req: Request, res: Response) => {
    try {
        const { firstName, lastName, dateOfBirth, instruments, contactIds, notes, tags } = req.body;

        if (!firstName || !lastName) {
            return res.status(400).json({
                success: false,
                error: 'firstName and lastName are required'
            });
        }

        const student = await repo.upsert({
            firstName,
            lastName,
            dateOfBirth,
            status: StudentStatus.Active,
            instruments: instruments || [],
            contactIds: contactIds || [],
            currentEnrollmentIds: [],
            notes,
            tags: tags || []
        });

        res.status(201).json({ success: true, data: student });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const update = async (req: Request, res: Response) => {
    try {
        const existing = await repo.getById(req.params.id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Student not found' });
        }

        const student = await repo.upsert({
            ...existing,
            ...req.body,
            id: req.params.id
        });

        res.json({ success: true, data: student });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const remove = async (req: Request, res: Response) => {
    try {
        const deleted = await repo.remove(req.params.id);
        if (!deleted) {
            return res.status(404).json({ success: false, error: 'Student not found' });
        }
        res.json({ success: true, message: 'Student deleted' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};
