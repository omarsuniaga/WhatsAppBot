/**
 * SchedulingService - Session generation based on class schedules
 * 
 * Domain service for scheduling. No HTTP/UI dependencies.
 */

import { EventEmitter } from 'events';
import { Session } from '../domain/types';
import { DayOfWeek, SessionStatus, ClassGroupStatus } from '../domain/enums';
import { ClassGroupsRepo, SessionsRepo } from '../repos';

export class SchedulingService extends EventEmitter {
    private static instance: SchedulingService;
    private classGroupsRepo = ClassGroupsRepo.getInstance();
    private sessionsRepo = SessionsRepo.getInstance();

    private constructor() {
        super();
    }

    public static getInstance(): SchedulingService {
        if (!SchedulingService.instance) {
            SchedulingService.instance = new SchedulingService();
        }
        return SchedulingService.instance;
    }

    private getDayOfWeekFromDate(dateYYYYMMDD: string): DayOfWeek {
        // Assumes YYYY-MM-DD format
        const date = new Date(`${dateYYYYMMDD}T12:00:00Z`); // Use UTC to avoid timezone issues
        const dayIndex = date.getUTCDay(); // Sunday = 0, Monday = 1, ...

        const dayMap: { [key: number]: DayOfWeek } = {
            0: DayOfWeek.Sunday,
            1: DayOfWeek.Monday,
            2: DayOfWeek.Tuesday,
            3: DayOfWeek.Wednesday,
            4: DayOfWeek.Thursday,
            5: DayOfWeek.Friday,
            6: DayOfWeek.Saturday,
        };
        return dayMap[dayIndex];
    }

    /**
     * Generates all missing sessions for a given date based on class group schedules.
     * @param dateYYYYMMDD - The date in YYYY-MM-DD format.
     * @returns A list of newly created sessions.
     */
    async generateSessionsForDate(dateYYYYMMDD: string): Promise<Session[]> {
        const dayOfWeek = this.getDayOfWeekFromDate(dateYYYYMMDD);
        
        // Get active class groups
        const activeGroups = await this.classGroupsRepo.find(
            g => g.status === ClassGroupStatus.Active
        );

        // Filter groups that have schedule for this day
        const groupsForDay = activeGroups.filter(group =>
            group.schedule?.some(s => s.dayOfWeek === dayOfWeek)
        );

        const createdSessions: Session[] = [];

        for (const group of groupsForDay) {
            const scheduleInfo = group.schedule?.find(s => s.dayOfWeek === dayOfWeek);
            if (!scheduleInfo) continue;

            // Check if a session already exists
            const existingSession = await this.sessionsRepo.findOne(
                s => s.classGroupId === group.id && s.date === dateYYYYMMDD
            );

            if (existingSession) {
                continue;
            }

            // Create a new session
            const createdSession = await this.sessionsRepo.upsert({
                classGroupId: group.id,
                date: dateYYYYMMDD,
                scheduledStart: scheduleInfo.startTime,
                scheduledEnd: scheduleInfo.endTime,
                status: SessionStatus.Scheduled,
                teacherIds: group.teacherIds,
                attendanceRecordIds: [],
            });

            this.emit('session:created', createdSession);
            createdSessions.push(createdSession);
        }

        if (createdSessions.length > 0) {
            this.emit('sessions:generated', { date: dateYYYYMMDD, count: createdSessions.length });
        }

        return createdSessions;
    }
}

export default SchedulingService;
