
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// --- MOCK REPOS ---
// Use vi.mock to mock the entire module and its exports, defining mock classes
vi.mock('../../backend/src/repos/ContactsRepo', () => {
    class MockContactsRepo {
        findById = vi.fn();
        findOneBy = vi.fn();
        update = vi.fn();
    }
    return { ContactsRepo: MockContactsRepo };
});

vi.mock('../../backend/src/repos/StudentsRepo', () => {
    class MockStudentsRepo {
        findById = vi.fn();
        findByIds = vi.fn();
        update = vi.fn();
    }
    return { StudentsRepo: MockStudentsRepo };
});

vi.mock('../../backend/src/repos/EnrollmentsRepo', () => {
    class MockEnrollmentsRepo {
        findOneBy = vi.fn();
    }
    return { EnrollmentsRepo: MockEnrollmentsRepo };
});

vi.mock('../../backend/src/repos/ClassGroupsRepo', () => {
    class MockClassGroupsRepo {
        findAll = vi.fn();
    }
    return { ClassGroupsRepo: MockClassGroupsRepo };
});

vi.mock('../../backend/src/repos/SessionsRepo', () => {
    class MockSessionsRepo {
        findById = vi.fn();
        findOneBy = vi.fn();
        findAll = vi.fn();
        create = vi.fn();
    }
    return { SessionsRepo: MockSessionsRepo };
});

vi.mock('../../backend/src/repos/AttendanceRepo', () => {
    class MockAttendanceRepo {
        create = vi.fn();
        findAll = vi.fn();
    }
    return { AttendanceRepo: MockAttendanceRepo };
});


// Now import the service instances, AFTER the repos have been mocked.
import {
    attendanceService,
    eventLogService,
    identityService,
    schedulingService,
    templateService,
} from '../../backend/src/services';

// Import the MOCKED Repo classes for type safety and to access their prototypes for mocking
// These are the MockClasses defined in the vi.mock calls above.
import { ContactsRepo } from '../../backend/src/repos/ContactsRepo';
import { StudentsRepo } from '../../backend/src/repos/StudentsRepo';
import { EnrollmentsRepo } from '../../backend/src/repos/EnrollmentsRepo';
import { ClassGroupsRepo } from '../../backend/src/repos/ClassGroupsRepo';
import { SessionsRepo } from '../../backend/src/repos/SessionsRepo';
import { AttendanceRepo } from '../../backend/src/repos/AttendanceRepo';

// Get references to the prototypes of the mocked classes to reset and configure their methods
const mockContactsRepoPrototype = ContactsRepo.prototype as any;
const mockStudentsRepoPrototype = StudentsRepo.prototype as any;
const mockEnrollmentsRepoPrototype = EnrollmentsRepo.prototype as any;
const mockClassGroupsRepoPrototype = ClassGroupsRepo.prototype as any;
const mockSessionsRepoPrototype = SessionsRepo.prototype as any;
const mockAttendanceRepoPrototype = AttendanceRepo.prototype as any;


// Mock fs for EventLogService
vi.mock('fs', async (importOriginal) => {
    const actualFs = await importOriginal<typeof fs>();
    return {
        ...actualFs,
        promises: {
            ...actualFs.promises,
            appendFile: vi.fn(() => Promise.resolve()),
            mkdir: vi.fn(() => Promise.resolve()),
            access: vi.fn(() => Promise.resolve()), // Assume directory exists by default
        },
    };
});
const mockAppendFile = vi.mocked(fs.promises.appendFile);
const mockMkdir = vi.mocked(fs.promises.mkdir);
const mockAccess = vi.mocked(fs.promises.access);


// --- MOCK DATA ---
import {
    Contact,
    Student,
    ClassGroup,
    Session,
    AttendanceRecord,
    Enrollment
} from '../../backend/src/domain/types';
import { DayOfWeek, AttendanceStatus, SessionStatus, ContactStatus, ContactType, StudentStatus, ClassGroupStatus, EnrollmentStatus, EventLogLevel, EventLogType } from '../../backend/src/domain/enums';
import { generateId } from '../../backend/src/domain/id';

const MOCK_CONTACT: Contact = {
    id: generateId('ct'), createdAt: 0, updatedAt: 0,
    firstName: 'John', lastName: 'Doe', phones: ['+11234567890'],
    type: ContactType.Guardian, status: ContactStatus.Active, studentIds: [generateId('st')]
};
const MOCK_STUDENT: Student = {
    id: MOCK_CONTACT.studentIds[0], createdAt: 0, updatedAt: 0,
    firstName: 'Jane', lastName: 'Doe', status: StudentStatus.Active, contactIds: [MOCK_CONTACT.id],
    instruments: [], tags: [], currentEnrollmentIds: []
};
const MOCK_CLASS_GROUP: ClassGroup = {
    id: generateId('cl'), createdAt: 0, updatedAt: 0,
    name: 'Music 101', programId: generateId('pg'), levelId: generateId('lv'), teacherIds: [],
    status: ClassGroupStatus.Active,
    schedule: [{ dayOfWeek: DayOfWeek.Monday, startTime: '10:00', endTime: '11:00' }]
};
const MOCK_SESSION: Session = {
    id: generateId('ss'), createdAt: 0, updatedAt: 0,
    classGroupId: MOCK_CLASS_GROUP.id, date: '2026-01-27', scheduledStart: '10:00', scheduledEnd: '11:00',
    status: SessionStatus.Scheduled, teacherIds: [], attendanceRecordIds: []
};
const MOCK_ENROLLMENT: Enrollment = {
    id: generateId('en'), createdAt: 0, updatedAt: 0,
    studentId: MOCK_STUDENT.id, classGroupId: MOCK_CLASS_GROUP.id,
    status: EnrollmentStatus.Active, startDate: '2026-01-01'
};
const MOCK_ATTENDANCE_RECORD: AttendanceRecord = {
    id: generateId('ar'), createdAt: 0, updatedAt: 0, recordedAt: 0,
    sessionId: MOCK_SESSION.id, studentId: MOCK_STUDENT.id, enrollmentId: MOCK_ENROLLMENT.id,
    status: AttendanceStatus.Present, guardianNotified: false, recordedBy: 'system'
};




describe('Domain Services', () => {
    beforeEach(() => {
        vi.clearAllMocks(); // Clears call history for all vi.fn()

        // Reset individual mock methods on the prototypes
        mockContactsRepoPrototype.findById.mockReset();
        mockContactsRepoPrototype.findOneBy.mockReset();
        mockContactsRepoPrototype.update.mockReset();

        mockStudentsRepoPrototype.findById.mockReset();
        mockStudentsRepoPrototype.findByIds.mockReset();
        mockStudentsRepoPrototype.update.mockReset();

        mockEnrollmentsRepoPrototype.findOneBy.mockReset();

        mockClassGroupsRepoPrototype.findAll.mockReset();

        mockSessionsRepoPrototype.findById.mockReset();
        mockSessionsRepoPrototype.findOneBy.mockReset();
        mockSessionsRepoPrototype.findAll.mockReset();
        mockSessionsRepoPrototype.create.mockReset();

        mockAttendanceRepoPrototype.create.mockReset();
        mockAttendanceRepoPrototype.findAll.mockReset();

        mockAppendFile.mockReset();
        mockMkdir.mockReset();
        mockAccess.mockReset();
        mockAccess.mockResolvedValue(undefined); // Assume directory exists by default for fs mocks
    });

    // --- IdentityService Tests ---
    describe('IdentityService', () => {
        it('should normalize phone number', () => {
            expect(identityService.normalizePhone('+1 (123) 456-7890')).toBe('11234567890');
            expect(identityService.normalizePhone('123-abc-456')).toBe('123456');
            expect(identityService.normalizePhone('1234567890')).toBe('1234567890');
        });

        it('should extract phone from jid', () => {
            expect(identityService.jidToPhone('1234567890@s.whatsapp.net')).toBe('1234567890');
            expect(identityService.jidToPhone('invalid-jid')).toBeNull();
        });

        it('should resolve contact by phone', async () => {
            mockContactsRepoPrototype.findOneBy.mockResolvedValue(MOCK_CONTACT);
            const contact = await identityService.resolveContactByPhone('+11234567890');
            expect(contact).toEqual(MOCK_CONTACT);
            expect(mockContactsRepo.findOneBy).toHaveBeenCalledWith({ phones: '11234567890' });
        });

        it('should return null if contact not found by phone', async () => {
            mockContactsRepoPrototype.findOneBy.mockResolvedValue(null);
            const contact = await identityService.resolveContactByPhone('+11234567890');
            expect(contact).toBeNull();
        });

        it('should resolve sender context with contact and students', async () => {
            mockContactsRepoPrototype.findOneBy.mockResolvedValue(MOCK_CONTACT);
            mockStudentsRepo.findByIds.mockResolvedValue([MOCK_STUDENT]);

            const context = await identityService.resolveSenderContext('11234567890@s.whatsapp.net');
            expect(context.contact).toEqual(MOCK_CONTACT);
            expect(context.students).toEqual([MOCK_STUDENT]);
            expect(mockContactsRepo.findOneBy).toHaveBeenCalledTimes(1);
            expect(mockStudentsRepo.findByIds).toHaveBeenCalledWith(MOCK_CONTACT.studentIds);
        });

        it('should link contact to student', async () => {
            const studentId = MOCK_STUDENT.id;
            const contactId = MOCK_CONTACT.id;

            const studentCopy: Student = { ...MOCK_STUDENT, contactIds: [] }; // Simulate student without contactId
            const contactCopy: Contact = { ...MOCK_CONTACT, studentIds: [] }; // Simulate contact without studentId

            mockStudentsRepo.findById.mockResolvedValue(studentCopy);
            mockContactsRepo.findById.mockResolvedValue(contactCopy);
            mockStudentsRepo.update.mockImplementation(async (id, updates) => ({
                ...studentCopy,
                ...(updates as Partial<Student>),
            }));
            mockContactsRepo.update.mockImplementation(async (id, updates) => ({
                ...contactCopy,
                ...(updates as Partial<Contact>),
            }));

            await identityService.linkContactToStudent(studentId, contactId, 'parent', true);

            expect(mockStudentsRepo.findById).toHaveBeenCalledWith(studentId);
            expect(mockContactsRepo.findById).toHaveBeenCalledWith(contactId);
            expect(mockStudentsRepo.update).toHaveBeenCalledWith(studentId, { contactIds: [contactId] });
            expect(mockContactsRepo.update).toHaveBeenCalledWith(contactId, { studentIds: [studentId] });
        });

        it('should not link if already linked', async () => {
            const studentId = MOCK_STUDENT.id;
            const contactId = MOCK_CONTACT.id;

            const studentCopy: Student = { ...MOCK_STUDENT, contactIds: [contactId] }; // Already linked
            const contactCopy: Contact = { ...MOCK_CONTACT, studentIds: [studentId] }; // Already linked

            mockStudentsRepo.findById.mockResolvedValue(studentCopy);
            mockContactsRepo.findById.mockResolvedValue(contactCopy);

            await identityService.linkContactToStudent(studentId, contactId, 'parent', true);

            expect(mockStudentsRepo.update).not.toHaveBeenCalled();
            expect(mockContactsRepo.update).not.toHaveBeenCalled();
        });

        it('should throw error if student or contact not found for linking', async () => {
            mockStudentsRepo.findById.mockResolvedValue(null);
            mockContactsRepo.findById.mockResolvedValue(MOCK_CONTACT);

            await expect(identityService.linkContactToStudent('st_nonexistent', MOCK_CONTACT.id, 'parent', true))
                .rejects.toThrow('Student or Contact not found');
        });
    });

    // --- TemplateService Tests ---
    describe('TemplateService', () => {
        it('should extract variables correctly', () => {
            const template = 'Hello {{name}}, your balance is {{amount}}. Thank you {{name}}!';
            const variables = templateService.extractVariables(template);
            expect(variables).toEqual(['name', 'amount']);
        });

        it('should render template with provided variables', () => {
            const template = 'Hello {{name}}, your balance is {{amount}}.';
            const vars = { name: 'Alice', amount: 100 };
            const rendered = templateService.render(template, vars);
            expect(rendered).toBe('Hello Alice, your balance is 100.');
        });

        it('should keep missing variables as placeholders', () => {
            const template = 'Hello {{name}}, your balance is {{amount}}.';
            const vars = { name: 'Alice' };
            const rendered = templateService.render(template, vars);
            expect(rendered).toBe('Hello Alice, your balance is {{amount}}.');
        });

        it('should validate template variables - ok', () => {
            const template = 'Hello {{name}}, your balance is {{amount}}.';
            const vars = { name: 'Alice', amount: 100 };
            const result = templateService.validate(template, vars);
            expect(result.ok).toBe(true);
            expect(result.missingVars).toEqual([]);
        });

        it('should validate template variables - missing', () => {
            const template = 'Hello {{name}}, your balance is {{amount}}.';
            const vars = { name: 'Alice' };
            const result = templateService.validate(template, vars);
            expect(result.ok).toBe(false);
            expect(result.missingVars).toEqual(['amount']);
        });
    });


    // --- SchedulingService Tests ---
    describe('SchedulingService', () => {
        it('should generate sessions for a given date based on class group schedule', async () => {
            const date = '2026-01-26'; // A Monday
            const classGroupMonday: ClassGroup = {
                ...MOCK_CLASS_GROUP,
                id: generateId('cl'),
                schedule: [{ dayOfWeek: DayOfWeek.Monday, startTime: '09:00', endTime: '10:00' }]
            };
            const classGroupTuesday: ClassGroup = {
                ...MOCK_CLASS_GROUP,
                id: generateId('cl'),
                schedule: [{ dayOfWeek: DayOfWeek.Tuesday, startTime: '10:00', endTime: '11:00' }]
            };

            mockClassGroupsRepo.findAll.mockResolvedValue([classGroupMonday, classGroupTuesday]);
            mockSessionsRepo.findOneBy.mockResolvedValue(null); // No existing session
            mockSessionsRepo.create.mockImplementation(async (session) => ({
                ...session,
                id: generateId('ss'),
                createdAt: Math.floor(Date.now() / 1000),
                updatedAt: Math.floor(Date.now() / 1000)
            }));

            const createdSessions = await schedulingService.generateSessionsForDate(date);

            expect(mockClassGroupsRepo.findAll).toHaveBeenCalledWith({ where: { status: 'active' } });
            expect(mockSessionsRepo.findOneBy).toHaveBeenCalledTimes(1);
            expect(mockSessionsRepo.create).toHaveBeenCalledTimes(1);
            expect(mockSessionsRepo.create).toHaveBeenCalledWith(expect.objectContaining({
                classGroupId: classGroupMonday.id,
                date: date,
                scheduledStart: '09:00',
                status: SessionStatus.Scheduled,
            }));
            expect(createdSessions).toHaveLength(1);
            expect(createdSessions[0].classGroupId).toBe(classGroupMonday.id);
        });

        it('should not generate sessions if one already exists', async () => {
            const date = '2026-01-26'; // A Monday
            const classGroupMonday: ClassGroup = {
                ...MOCK_CLASS_GROUP,
                id: generateId('cl'),
                schedule: [{ dayOfWeek: DayOfWeek.Monday, startTime: '09:00', endTime: '10:00' }]
            };

            mockClassGroupsRepo.findAll.mockResolvedValue([classGroupMonday]);
            mockSessionsRepo.findOneBy.mockResolvedValue({ // Existing session
                ...MOCK_SESSION,
                id: generateId('ss'),
                classGroupId: classGroupMonday.id,
                date: date
            });

            const createdSessions = await schedulingService.generateSessionsForDate(date);

            expect(mockSessionsRepo.findOneBy).toHaveBeenCalledTimes(1);
            expect(mockSessionsRepo.create).not.toHaveBeenCalled();
            expect(createdSessions).toHaveLength(0);
        });

        it('should not generate sessions for incorrect day of week', async () => {
            const date = '2026-01-27'; // A Tuesday
            const classGroupMonday: ClassGroup = {
                ...MOCK_CLASS_GROUP,
                id: generateId('cl'),
                schedule: [{ dayOfWeek: DayOfWeek.Monday, startTime: '09:00', endTime: '10:00' }]
            };

            mockClassGroupsRepo.findAll.mockResolvedValue([classGroupMonday]);

            const createdSessions = await schedulingService.generateSessionsForDate(date);

            expect(mockClassGroupsRepo.findAll).toHaveBeenCalledWith({ where: { status: 'active' } });
            expect(mockSessionsRepo.findOneBy).not.toHaveBeenCalled();
            expect(mockSessionsRepo.create).not.toHaveBeenCalled();
            expect(createdSessions).toHaveLength(0);
        });
    });


    // --- AttendanceService Tests ---
    describe('AttendanceService', () => {
        const testSessionId = MOCK_SESSION.id;
        const testStudentId = MOCK_STUDENT.id;
        const testClassGroupId = MOCK_CLASS_GROUP.id;

        it('should mark attendance successfully', async () => {
            mockSessionsRepo.findById.mockResolvedValue(MOCK_SESSION);
            mockEnrollmentsRepo.findOneBy.mockResolvedValue(MOCK_ENROLLMENT);
            mockAttendanceRepo.create.mockImplementation(async (record) => ({
                ...record,
                id: generateId('ar'),
                createdAt: Math.floor(Date.now() / 1000),
                updatedAt: Math.floor(Date.now() / 1000)
            }));

            const record = await attendanceService.markAttendance(
                testSessionId,
                testStudentId,
                AttendanceStatus.Present,
                'Note',
                'teacher_id'
            );

            expect(mockSessionsRepo.findById).toHaveBeenCalledWith(testSessionId);
            expect(mockEnrollmentsRepo.findOneBy).toHaveBeenCalledWith({ studentId: testStudentId, classGroupId: MOCK_SESSION.classGroupId });
            expect(mockAttendanceRepo.create).toHaveBeenCalledWith(expect.objectContaining({
                sessionId: testSessionId,
                studentId: testStudentId,
                status: AttendanceStatus.Present,
                recordedBy: 'teacher_id',
                note: 'Note',
                enrollmentId: MOCK_ENROLLMENT.id
            }));
            expect(record).toBeDefined();
            expect(record.status).toBe(AttendanceStatus.Present);
        });

        it('should throw error if session not found when marking attendance', async () => {
            mockSessionsRepo.findById.mockResolvedValue(null);

            await expect(attendanceService.markAttendance(
                'ss_nonexistent', testStudentId, AttendanceStatus.Present
            )).rejects.toThrow('Session with id ss_nonexistent not found');
        });

        it('should throw error if student not enrolled when marking attendance', async () => {
            mockSessionsRepo.findById.mockResolvedValue(MOCK_SESSION);
            mockEnrollmentsRepo.findOneBy.mockResolvedValue(null);

            await expect(attendanceService.markAttendance(
                testSessionId, 'st_nonexistent', AttendanceStatus.Present
            )).rejects.toThrow(`Student st_nonexistent is not enrolled in class group for session ${testSessionId}`);
        });

        it('should get daily report correctly', async () => {
            const session1: Session = { ...MOCK_SESSION, id: generateId('ss'), classGroupId: 'cl_group1', date: '2026-01-27' };
            const session2: Session = { ...MOCK_SESSION, id: generateId('ss'), classGroupId: 'cl_group2', date: '2026-01-27' };
            mockSessionsRepo.findAll.mockResolvedValue([session1, session2]);

            const record1: AttendanceRecord = { ...MOCK_ATTENDANCE_RECORD, sessionId: session1.id, studentId: 'st_1', status: AttendanceStatus.Present };
            const record2: AttendanceRecord = { ...MOCK_ATTENDANCE_RECORD, sessionId: session1.id, studentId: 'st_2', status: AttendanceStatus.Absent };
            const record3: AttendanceRecord = { ...MOCK_ATTENDANCE_RECORD, sessionId: session2.id, studentId: 'st_3', status: AttendanceStatus.Late };
            mockAttendanceRepo.findAll.mockResolvedValue([record1, record2, record3]);

            const report = await attendanceService.getDailyReport('2026-01-27');

            expect(mockSessionsRepo.findAll).toHaveBeenCalledWith({ where: { date: '2026-01-27' } });
            expect(mockAttendanceRepo.findAll).toHaveBeenCalledWith({ where: { sessionId: [session1.id, session2.id] } });
            expect(report).toEqual({
                'cl_group1': { present: 1, absent: 1, late: 0, excused: 0, total: 2 },
                'cl_group2': { present: 0, absent: 0, late: 1, excused: 0, total: 1 },
            });
        });

        it('should get absence stats correctly', async () => {
            const nowSeconds = Math.floor(Date.now() / 1000);
            const sevenDaysAgoSeconds = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);

            const record1: AttendanceRecord = { ...MOCK_ATTENDANCE_RECORD, studentId: 'st_1', status: AttendanceStatus.Absent, createdAt: nowSeconds - 1000 };
            const record2: AttendanceRecord = { ...MOCK_ATTENDANCE_RECORD, studentId: 'st_1', status: AttendanceStatus.Late, createdAt: nowSeconds - 2000 };
            const record3: AttendanceRecord = { ...MOCK_ATTENDANCE_RECORD, studentId: 'st_2', status: AttendanceStatus.Absent, createdAt: nowSeconds - 3000 };
            const oldRecord: AttendanceRecord = { ...MOCK_ATTENDANCE_RECORD, studentId: 'st_1', status: AttendanceStatus.Absent, createdAt: sevenDaysAgoSeconds - 1000 }; // Outside 7 days

            mockAttendanceRepo.findAll.mockResolvedValue([record1, record2, record3, oldRecord]);

            const stats = await attendanceService.getAbsenceStats(7);

            expect(mockAttendanceRepo.findAll).toHaveBeenCalledWith({});
            expect(stats).toEqual({
                'st_1': { absences: 1, lates: 1 },
                'st_2': { absences: 1, lates: 0 },
            });
        });
    });

    // --- EventLogService Tests ---
    describe('EventLogService', () => {
        const LOG_FILE_PATH = path.join(process.cwd(), 'data', 'metrics', 'events.jsonl');

        it('should log an event to file and ensure directory exists', async () => {
            mockAccess.mockRejectedValueOnce({ code: 'ENOENT' }); // Simulate directory not existing

            const payload = { detail: 'test event' };
            const event = await eventLogService.logEvent(
                EventLogType.SessionCreated,
                payload,
                'user_1',
                EventLogLevel.Info,
                'A session was created.'
            );

            expect(mockMkdir).toHaveBeenCalledWith(path.dirname(LOG_FILE_PATH), { recursive: true });
            expect(mockAppendFile).toHaveBeenCalledTimes(1);
            const loggedString = mockAppendFile.mock.calls[0][0];
            const loggedEvent = JSON.parse(loggedString.toString().trim());

            expect(loggedEvent).toEqual(expect.objectContaining({
                type: EventLogType.SessionCreated,
                level: EventLogLevel.Info,
                message: 'A session was created.',
                data: payload,
                actorId: 'user_1',
                actorType: 'user', // Assuming user_1 is a generic user, not st_ or ct_
            }));
            expect(event).toBeDefined();
            expect(event.id).toMatch(/^ev_/);
        });

        it('should log an event with default message and system actor', async () => {
            const payload = { action: 'system_init' };
            const event = await eventLogService.logEvent(EventLogType.AutomationTriggered, payload);

            expect(mockAppendFile).toHaveBeenCalledTimes(1);
            const loggedString = mockAppendFile.mock.calls[0][0];
            const loggedEvent = JSON.parse(loggedString.toString().trim());

            expect(loggedEvent).toEqual(expect.objectContaining({
                type: EventLogType.AutomationTriggered,
                level: EventLogLevel.Info,
                message: 'Event of type automation_triggered occurred.',
                data: payload,
                actorId: undefined,
                actorType: 'system',
            }));
        });

        it('should log event with actorType as user for student ID', async () => {
            const studentId = generateId('st');
            await eventLogService.logEvent(EventLogType.AttendanceRecorded, {}, studentId);
            const loggedString = mockAppendFile.mock.calls[0][0];
            const loggedEvent = JSON.parse(loggedString.toString().trim());
            expect(loggedEvent.actorType).toBe('user');
        });

        it('should log event with actorType as user for contact ID', async () => {
            const contactId = generateId('ct');
            await eventLogService.logEvent(EventLogType.ContactUpdated, {}, contactId);
            const loggedString = mockAppendFile.mock.calls[0][0];
            const loggedEvent = JSON.parse(loggedString.toString().trim());
            expect(loggedEvent.actorType).toBe('user');
        });
    });
});
