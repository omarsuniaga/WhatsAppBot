/**
 * Repositories Index - Central export and initialization
 * El Sistema Punta Cana - Institutional WhatsApp Bot
 */

// Export all repositories
export { ContactsRepo } from './ContactsRepo';
export { StudentsRepo } from './StudentsRepo';
export { TeachersRepo } from './TeachersRepo';
export { ProgramsRepo } from './ProgramsRepo';
export { LevelsRepo } from './LevelsRepo';
export { ClassGroupsRepo } from './ClassGroupsRepo';
export { EnrollmentsRepo } from './EnrollmentsRepo';
export { SessionsRepo } from './SessionsRepo';
export { AttendanceRepo } from './AttendanceRepo';
export { TemplatesRepo } from './TemplatesRepo';
export { WhatsAppGroupsRepo } from './WhatsAppGroupsRepo';
export { KnowledgeIndexRepo } from './KnowledgeIndexRepo';
export { EventLogRepo } from './EventLogRepo';
export { TriggerRepo } from './TriggerRepo';

// Export base
export { BaseRepository, IRepository, ValidationResult } from './BaseRepository';

// Import for initialization
import { ContactsRepo } from './ContactsRepo';
import { StudentsRepo } from './StudentsRepo';
import { TeachersRepo } from './TeachersRepo';
import { ProgramsRepo } from './ProgramsRepo';
import { LevelsRepo } from './LevelsRepo';
import { ClassGroupsRepo } from './ClassGroupsRepo';
import { EnrollmentsRepo } from './EnrollmentsRepo';
import { SessionsRepo } from './SessionsRepo';
import { AttendanceRepo } from './AttendanceRepo';
import { TemplatesRepo } from './TemplatesRepo';
import { WhatsAppGroupsRepo } from './WhatsAppGroupsRepo';
import { KnowledgeIndexRepo } from './KnowledgeIndexRepo';
import { EventLogRepo } from './EventLogRepo';
import { TriggerRepo } from './TriggerRepo';

/**
 * Get all repository instances
 */
export const getRepositories = () => ({
    contacts: ContactsRepo.getInstance(),
    students: StudentsRepo.getInstance(),
    teachers: TeachersRepo.getInstance(),
    programs: ProgramsRepo.getInstance(),
    levels: LevelsRepo.getInstance(),
    classGroups: ClassGroupsRepo.getInstance(),
    enrollments: EnrollmentsRepo.getInstance(),
    sessions: SessionsRepo.getInstance(),
    attendance: AttendanceRepo.getInstance(),
    templates: TemplatesRepo.getInstance(),
    waGroups: WhatsAppGroupsRepo.getInstance(),
    knowledgeIndex: KnowledgeIndexRepo.getInstance(),
    eventLog: EventLogRepo.getInstance(),
    triggers: TriggerRepo.getInstance()
});

/**
 * Initialize all repositories (ensure data files exist)
 */
export const initializeRepositories = async (): Promise<void> => {
    console.log('[Repos] Initializing all repositories...');
    
    const repos = getRepositories();
    
    await Promise.all([
        repos.contacts.initialize(),
        repos.students.initialize(),
        repos.teachers.initialize(),
        repos.programs.initialize(),
        repos.levels.initialize(),
        repos.classGroups.initialize(),
        repos.enrollments.initialize(),
        repos.sessions.initialize(),
        repos.attendance.initialize(),
        repos.templates.initialize(),
        repos.waGroups.initialize(),
        repos.knowledgeIndex.initialize(),
        repos.eventLog.initialize(),
        repos.triggers.initialize()
    ]);
    
    console.log('[Repos] All repositories initialized');
};
