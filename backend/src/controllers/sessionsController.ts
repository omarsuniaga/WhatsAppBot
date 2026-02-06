/**
 * Sessions Controller - Session generation and management
 */

import { Request, Response } from 'express';
import { SessionsRepo, ClassGroupsRepo, EnrollmentsRepo } from '../repos';
import { SessionStatus, DayOfWeek, EnrollmentStatus } from '../domain';
import { today } from '../domain/time';

const sessionsRepo = SessionsRepo.getInstance();
const classGroupsRepo = ClassGroupsRepo.getInstance();
const enrollmentsRepo = EnrollmentsRepo.getInstance();

const dayOfWeekMap: Record<number, DayOfWeek> = {
    0: DayOfWeek.Sunday,
    1: DayOfWeek.Monday,
    2: DayOfWeek.Tuesday,
    3: DayOfWeek.Wednesday,
    4: DayOfWeek.Thursday,
    5: DayOfWeek.Friday,
    6: DayOfWeek.Saturday
};

export const list = async (req: Request, res: Response) => {
    try {
        const { date, classGroupId, status, startDate, endDate } = req.query;
        let sessions = await sessionsRepo.list();

        if (date) {
            sessions = sessions.filter(s => s.date === date);
        }
        if (classGroupId) {
            sessions = sessions.filter(s => s.classGroupId === classGroupId);
        }
        if (status) {
            sessions = sessions.filter(s => s.status === status);
        }
        if (startDate && endDate) {
            sessions = sessions.filter(s => s.date >= startDate && s.date <= endDate);
        }

        res.json({ success: true, data: sessions, count: sessions.length });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getById = async (req: Request, res: Response) => {
    try {
        const session = await sessionsRepo.getById(req.params.id);
        if (!session) {
            return res.status(404).json({ success: false, error: 'Session not found' });
        }
        res.json({ success: true, data: session });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Generate sessions for a specific date based on class group schedules
 */
export const generate = async (req: Request, res: Response) => {
    try {
        const date = (req.query.date as string) || today();
        const targetDate = new Date(date + 'T12:00:00');
        const dayOfWeek = dayOfWeekMap[targetDate.getDay()];

        // Get all active class groups
        const classGroups = await classGroupsRepo.findActive();
        const generatedSessions: any[] = [];
        const skipped: string[] = [];

        for (const classGroup of classGroups) {
            // Check if class has schedule for this day
            const scheduleForDay = classGroup.schedule?.find(s => s.dayOfWeek === dayOfWeek);
            if (!scheduleForDay) {
                continue;
            }

            // Check if session already exists for this date and class
            const existing = await sessionsRepo.findOne(s => 
                s.classGroupId === classGroup.id && s.date === date
            );
            if (existing) {
                skipped.push(`${classGroup.name} (already exists)`);
                continue;
            }

            // Create session
            const session = await sessionsRepo.upsert({
                classGroupId: classGroup.id,
                date,
                scheduledStart: scheduleForDay.startTime,
                scheduledEnd: scheduleForDay.endTime,
                teacherIds: classGroup.teacherIds,
                attendanceRecordIds: [],
                status: SessionStatus.Scheduled
            });

            generatedSessions.push({
                id: session.id,
                classGroup: classGroup.name,
                time: `${scheduleForDay.startTime}-${scheduleForDay.endTime}`
            });
        }

        res.json({
            success: true,
            data: {
                date,
                dayOfWeek,
                generated: generatedSessions,
                skipped,
                summary: {
                    generatedCount: generatedSessions.length,
                    skippedCount: skipped.length
                }
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Get sessions with enrolled students for a date
 */
export const getByDate = async (req: Request, res: Response) => {
    try {
        const date = (req.query.date as string) || today();
        const sessions = await sessionsRepo.findByDate(date);

        // Enrich with class group and enrollment info
        const enrichedSessions = await Promise.all(sessions.map(async session => {
            const classGroup = await classGroupsRepo.getById(session.classGroupId);
            const enrollments = await enrollmentsRepo.findActiveByClassGroup(session.classGroupId);
            
            return {
                ...session,
                classGroupName: classGroup?.name,
                enrolledCount: enrollments.length,
                studentIds: enrollments.map(e => e.studentId)
            };
        }));

        res.json({
            success: true,
            data: {
                date,
                sessions: enrichedSessions,
                count: enrichedSessions.length
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};
