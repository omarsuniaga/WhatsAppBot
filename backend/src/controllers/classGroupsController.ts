/**
 * ClassGroups Controller - CRUD operations for ClassGroup entities
 */

import { Request, Response } from 'express';
import { ClassGroupsRepo } from '../repos';
import { ClassGroupStatus } from '../domain';

const repo = ClassGroupsRepo.getInstance();

export const list = async (req: Request, res: Response) => {
    try {
        const { status, programId, levelId, teacherId } = req.query;
        let classGroups = await repo.list();

        if (status) {
            classGroups = classGroups.filter(c => c.status === status);
        }
        if (programId) {
            classGroups = classGroups.filter(c => c.programId === programId);
        }
        if (levelId) {
            classGroups = classGroups.filter(c => c.levelId === levelId);
        }
        if (teacherId && typeof teacherId === 'string') {
            classGroups = classGroups.filter(c => c.teacherIds.includes(teacherId));
        }

        res.json({ success: true, data: classGroups, count: classGroups.length });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getById = async (req: Request, res: Response) => {
    try {
        const classGroup = await repo.getById(req.params.id);
        if (!classGroup) {
            return res.status(404).json({ success: false, error: 'ClassGroup not found' });
        }
        res.json({ success: true, data: classGroup });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const create = async (req: Request, res: Response) => {
    try {
        const { name, code, programId, levelId, teacherIds, schedule, maxStudents, location, notes } = req.body;

        if (!name || !programId || !levelId) {
            return res.status(400).json({
                success: false,
                error: 'name, programId, and levelId are required'
            });
        }

        const classGroup = await repo.upsert({
            name,
            code,
            programId,
            levelId,
            teacherIds: teacherIds || [],
            schedule: schedule || [],
            maxStudents,
            location,
            notes,
            status: ClassGroupStatus.Active
        });

        res.status(201).json({ success: true, data: classGroup });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const update = async (req: Request, res: Response) => {
    try {
        const existing = await repo.getById(req.params.id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'ClassGroup not found' });
        }

        const classGroup = await repo.upsert({
            ...existing,
            ...req.body,
            id: req.params.id
        });

        res.json({ success: true, data: classGroup });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const remove = async (req: Request, res: Response) => {
    try {
        const deleted = await repo.remove(req.params.id);
        if (!deleted) {
            return res.status(404).json({ success: false, error: 'ClassGroup not found' });
        }
        res.json({ success: true, message: 'ClassGroup deleted' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Get students enrolled in a class group (M:N via Enrollments)
 */
export const getStudents = async (req: Request, res: Response) => {
    try {
        const classGroup = await repo.getById(req.params.id);
        if (!classGroup) {
            return res.status(404).json({ success: false, error: 'ClassGroup not found' });
        }

        // Get enrollments for this class
        const { EnrollmentsRepo } = await import('../repos');
        const { StudentsRepo } = await import('../repos');
        
        const enrollmentsRepo = EnrollmentsRepo.getInstance();
        const studentsRepo = StudentsRepo.getInstance();
        
        const enrollments = await enrollmentsRepo.list();
        const activeEnrollments = enrollments.filter(
            e => e.classGroupId === req.params.id && e.status === 'active'
        );
        
        // Get student details
        const studentIds = activeEnrollments.map(e => e.studentId);
        const allStudents = await studentsRepo.list();
        const students = allStudents.filter(s => studentIds.includes(s.id));

        res.json({ success: true, data: students, count: students.length });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};
