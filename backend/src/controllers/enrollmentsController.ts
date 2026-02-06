/**
 * Enrollments Controller - CRUD operations for Enrollment entities
 */

import { Request, Response } from 'express';
import { EnrollmentsRepo, StudentsRepo } from '../repos';
import { EnrollmentStatus } from '../domain';
import { today } from '../domain/time';

const repo = EnrollmentsRepo.getInstance();
const studentsRepo = StudentsRepo.getInstance();

export const list = async (req: Request, res: Response) => {
    try {
        const { studentId, classGroupId, status } = req.query;
        let enrollments = await repo.list();

        if (studentId) {
            enrollments = enrollments.filter(e => e.studentId === studentId);
        }
        if (classGroupId) {
            enrollments = enrollments.filter(e => e.classGroupId === classGroupId);
        }
        if (status) {
            enrollments = enrollments.filter(e => e.status === status);
        }

        res.json({ success: true, data: enrollments, count: enrollments.length });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getById = async (req: Request, res: Response) => {
    try {
        const enrollment = await repo.getById(req.params.id);
        if (!enrollment) {
            return res.status(404).json({ success: false, error: 'Enrollment not found' });
        }
        res.json({ success: true, data: enrollment });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const create = async (req: Request, res: Response) => {
    try {
        const { studentId, classGroupId, startDate, notes } = req.body;

        if (!studentId || !classGroupId) {
            return res.status(400).json({
                success: false,
                error: 'studentId and classGroupId are required'
            });
        }

        // Check if student already enrolled in this class
        const existing = await repo.findOne(e => 
            e.studentId === studentId && 
            e.classGroupId === classGroupId && 
            e.status === EnrollmentStatus.Active
        );
        if (existing) {
            return res.status(409).json({
                success: false,
                error: 'Student already enrolled in this class'
            });
        }

        const enrollment = await repo.upsert({
            studentId,
            classGroupId,
            startDate: startDate || today(),
            status: EnrollmentStatus.Active,
            notes
        });

        // Update student's currentEnrollmentIds
        const student = await studentsRepo.getById(studentId);
        if (student && !student.currentEnrollmentIds.includes(enrollment.id)) {
            await studentsRepo.upsert({
                ...student,
                currentEnrollmentIds: [...student.currentEnrollmentIds, enrollment.id]
            });
        }

        res.status(201).json({ success: true, data: enrollment });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const remove = async (req: Request, res: Response) => {
    try {
        const enrollment = await repo.getById(req.params.id);
        if (!enrollment) {
            return res.status(404).json({ success: false, error: 'Enrollment not found' });
        }

        // Mark as withdrawn instead of hard delete
        await repo.upsert({
            ...enrollment,
            status: EnrollmentStatus.Withdrawn,
            endDate: today()
        });

        // Update student's currentEnrollmentIds
        const student = await studentsRepo.getById(enrollment.studentId);
        if (student) {
            await studentsRepo.upsert({
                ...student,
                currentEnrollmentIds: student.currentEnrollmentIds.filter(id => id !== enrollment.id)
            });
        }

        res.json({ success: true, message: 'Enrollment withdrawn' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};
