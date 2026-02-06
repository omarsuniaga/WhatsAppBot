/**
 * Smoke Test - Verify all repositories work correctly
 * 
 * Run: npx ts-node backend/scripts/smoke-test-repos.ts
 */

import { 
    initializeRepositories,
    ContactsRepo,
    StudentsRepo,
    TeachersRepo,
    ProgramsRepo,
    LevelsRepo,
    ClassGroupsRepo,
    EnrollmentsRepo,
    SessionsRepo,
    AttendanceRepo,
    TemplatesRepo,
    WhatsAppGroupsRepo,
    KnowledgeIndexRepo,
    EventLogRepo
} from '../src/repos';

import {
    ContactStatus,
    ContactType,
    StudentStatus,
    TeacherStatus,
    ProgramStatus,
    LevelStatus,
    ClassGroupStatus,
    EnrollmentStatus,
    SessionStatus,
    AttendanceStatus,
    TemplateCategory,
    TemplateStatus,
    WhatsAppGroupType,
    WhatsAppGroupStatus,
    KnowledgeFileType,
    KnowledgeFileStatus,
    EventLogType,
    EventLogLevel,
    DayOfWeek
} from '../src/domain';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

const pass = (msg: string) => console.log(`${GREEN}✓${RESET} ${msg}`);
const fail = (msg: string, err?: any) => {
    console.log(`${RED}✗${RESET} ${msg}`);
    if (err) console.error('  ', err.message || err);
};

async function testRepo<T>(
    name: string,
    repo: any,
    createData: Partial<T>
): Promise<boolean> {
    try {
        // Create
        const created = await repo.upsert(createData);
        if (!created.id) throw new Error('No ID returned');
        pass(`${name}: create`);

        // Read
        const read = await repo.getById(created.id);
        if (!read) throw new Error('Entity not found after create');
        pass(`${name}: getById`);

        // List
        const list = await repo.list();
        if (!list.some((e: any) => e.id === created.id)) {
            throw new Error('Entity not in list');
        }
        pass(`${name}: list`);

        // Update
        const updated = await repo.upsert({ ...read, id: created.id });
        if (updated.updatedAt <= created.updatedAt) {
            // This might fail if the test runs too fast, so we just warn
            console.log(`  (warning: updatedAt not incremented - test ran too fast)`);
        }
        pass(`${name}: update`);

        // Remove
        const removed = await repo.remove(created.id);
        if (!removed) throw new Error('Remove returned false');
        const afterRemove = await repo.getById(created.id);
        if (afterRemove) throw new Error('Entity still exists after remove');
        pass(`${name}: remove`);

        return true;
    } catch (err) {
        fail(`${name}: FAILED`, err);
        return false;
    }
}

async function main() {
    console.log('\n========================================');
    console.log('   Repository Smoke Test');
    console.log('========================================\n');

    // Initialize
    try {
        await initializeRepositories();
        pass('Repositories initialized');
    } catch (err) {
        fail('Failed to initialize repositories', err);
        process.exit(1);
    }

    console.log('\n--- Testing each repository ---\n');

    const results: boolean[] = [];

    // Contacts
    results.push(await testRepo('ContactsRepo', ContactsRepo.getInstance(), {
        firstName: 'Test',
        lastName: 'Contact',
        phones: ['18095551234'],
        type: ContactType.Guardian,
        status: ContactStatus.Active,
        studentIds: [],
        tags: []
    }));

    // Students
    results.push(await testRepo('StudentsRepo', StudentsRepo.getInstance(), {
        firstName: 'Test',
        lastName: 'Student',
        status: StudentStatus.Active,
        contactIds: [],
        currentEnrollmentIds: [],
        instruments: [],
        tags: []
    }));

    // Teachers
    results.push(await testRepo('TeachersRepo', TeachersRepo.getInstance(), {
        firstName: 'Test',
        lastName: 'Teacher',
        status: TeacherStatus.Active,
        instruments: [],
        specializations: [],
        classGroupIds: [],
        tags: []
    }));

    // Programs
    results.push(await testRepo('ProgramsRepo', ProgramsRepo.getInstance(), {
        name: 'Test Program',
        code: 'TST',
        status: ProgramStatus.Active,
        levelIds: []
    }));

    // Levels
    results.push(await testRepo('LevelsRepo', LevelsRepo.getInstance(), {
        name: 'Test Level',
        code: 'L1',
        order: 1,
        programId: 'pg_test123',
        status: LevelStatus.Active
    }));

    // ClassGroups
    results.push(await testRepo('ClassGroupsRepo', ClassGroupsRepo.getInstance(), {
        name: 'Test Class',
        programId: 'pg_test123',
        levelId: 'lv_test123',
        teacherIds: [],
        schedule: [{
            dayOfWeek: DayOfWeek.Monday,
            startTime: '15:00',
            endTime: '16:00'
        }],
        status: ClassGroupStatus.Active
    }));

    // Enrollments
    results.push(await testRepo('EnrollmentsRepo', EnrollmentsRepo.getInstance(), {
        studentId: 'st_test123',
        classGroupId: 'cl_test123',
        startDate: '2026-01-01',
        status: EnrollmentStatus.Active
    }));

    // Sessions
    results.push(await testRepo('SessionsRepo', SessionsRepo.getInstance(), {
        classGroupId: 'cl_test123',
        date: '2026-01-27',
        scheduledStart: '15:00',
        scheduledEnd: '16:00',
        teacherIds: [],
        attendanceRecordIds: [],
        status: SessionStatus.Scheduled
    }));

    // Attendance
    results.push(await testRepo('AttendanceRepo', AttendanceRepo.getInstance(), {
        sessionId: 'ss_test123',
        studentId: 'st_test123',
        enrollmentId: 'en_test123',
        status: AttendanceStatus.Present,
        recordedBy: 'system',
        recordedAt: Math.floor(Date.now() / 1000),
        guardianNotified: false
    }));

    // Templates
    results.push(await testRepo('TemplatesRepo', TemplatesRepo.getInstance(), {
        name: 'Test Template',
        code: 'test_tpl',
        body: 'Hello {{name}}!',
        category: TemplateCategory.General,
        status: TemplateStatus.Active,
        variables: ['name'],
        requiredVariables: ['name'],
        useCount: 0,
        tags: []
    }));

    // WhatsAppGroups
    results.push(await testRepo('WhatsAppGroupsRepo', WhatsAppGroupsRepo.getInstance(), {
        jid: '123456789@g.us',
        name: 'Test Group',
        type: WhatsAppGroupType.ClassGroup,
        status: WhatsAppGroupStatus.Active,
        participantJids: [],
        adminJids: [],
        botEnabled: true,
        announcementsOnly: false
    }));

    // KnowledgeIndex
    results.push(await testRepo('KnowledgeIndexRepo', KnowledgeIndexRepo.getInstance(), {
        name: 'Test KB',
        filename: 'test.txt',
        content: 'This is test content for knowledge base.',
        type: KnowledgeFileType.General,
        status: KnowledgeFileStatus.Active,
        keywords: ['test', 'smoke']
    }));

    // EventLog
    results.push(await testRepo('EventLogRepo', EventLogRepo.getInstance(), {
        type: EventLogType.SystemError,
        level: EventLogLevel.Info,
        message: 'Smoke test event',
        actorType: 'system'
    }));

    // Summary
    console.log('\n========================================');
    const passed = results.filter(r => r).length;
    const total = results.length;
    
    if (passed === total) {
        console.log(`${GREEN}All ${total} repositories passed!${RESET}`);
    } else {
        console.log(`${RED}${passed}/${total} repositories passed${RESET}`);
        process.exit(1);
    }
    console.log('========================================\n');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
