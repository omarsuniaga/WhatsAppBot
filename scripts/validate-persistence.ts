/**
 * Validation Script for File-Based Persistence Layer
 * 
 * Run with: npx ts-node scripts/validate-persistence.ts
 * 
 * This script tests:
 * 1. FileStore atomic writes
 * 2. Repository CRUD operations
 * 3. IdentityService phone normalization
 * 4. TemplateService variable extraction and rendering
 */

import * as path from 'path';

// Set up paths before importing
process.chdir(path.join(__dirname, '..'));

async function main() {
    console.log('='.repeat(60));
    console.log('Persistence Layer Validation Script');
    console.log('='.repeat(60));
    console.log('');

    let passed = 0;
    let failed = 0;

    // Helper
    function test(name: string, condition: boolean, details?: string) {
        if (condition) {
            console.log(`✅ PASS: ${name}`);
            passed++;
        } else {
            console.log(`❌ FAIL: ${name}${details ? ` - ${details}` : ''}`);
            failed++;
        }
    }

    try {
        // ==========================================
        // Test 1: FileStore
        // ==========================================
        console.log('\n--- Testing FileStore ---');
        
        const { FileStore } = await import('../src/server/persistence/FileStore');
        
        const testStore = new FileStore<{ value: number }>({
            filePath: path.join(__dirname, '../data/test-validation.json'),
            defaultValue: { value: 0 }
        });

        // Ensure file exists
        await testStore.ensureFileExists();
        test('FileStore.ensureFileExists()', await testStore.exists());

        // Write
        await testStore.write({ value: 42 });
        const readResult = await testStore.read();
        test('FileStore.write() and read()', readResult.value === 42);

        // Update
        const updated = await testStore.update(data => ({ value: data.value + 1 }));
        test('FileStore.update()', updated.value === 43);

        // Delete test file
        await testStore.delete();
        test('FileStore.delete()', !(await testStore.exists()));

        // ==========================================
        // Test 2: ContactsRepository
        // ==========================================
        console.log('\n--- Testing ContactsRepository ---');
        
        const { ContactsRepository } = await import('../src/server/persistence/ContactsRepository');
        const contactsRepo = ContactsRepository.getInstance();
        await contactsRepo.initialize();

        // Create
        const contact = await contactsRepo.create({
            firstName: 'Test',
            lastName: 'User',
            phones: ['8095551234'],
            type: 'parent',
            status: 'active',
            whatsappVerified: false,
            studentIds: [],
            tags: ['test'],
            notificationPreferences: {
                enabled: true,
                channels: ['whatsapp']
            }
        });
        test('ContactsRepository.create()', !!contact.id);

        // Find by ID
        const found = await contactsRepo.findById(contact.id);
        test('ContactsRepository.findById()', found?.id === contact.id);

        // Find by phone
        const byPhone = await contactsRepo.findByPhone('8095551234');
        test('ContactsRepository.findByPhone()', byPhone?.id === contact.id);

        // Update
        const updatedContact = await contactsRepo.update(contact.id, { lastName: 'Updated' });
        test('ContactsRepository.update()', updatedContact?.lastName === 'Updated');

        // Search
        const searchResults = await contactsRepo.search('Test');
        test('ContactsRepository.search()', searchResults.length > 0);

        // Delete
        const deleted = await contactsRepo.delete(contact.id);
        test('ContactsRepository.delete()', deleted);

        // ==========================================
        // Test 3: StudentsRepository
        // ==========================================
        console.log('\n--- Testing StudentsRepository ---');
        
        const { StudentsRepository } = await import('../src/server/persistence/StudentsRepository');
        const studentsRepo = StudentsRepository.getInstance();
        await studentsRepo.initialize();

        const student = await studentsRepo.create({
            firstName: 'Maria',
            lastName: 'Garcia',
            enrollmentDate: '2024-01-15',
            status: 'active',
            instruments: [{ name: 'Violin', level: 'beginner', startDate: '2024-01-15', isPrimary: true }],
            ensembles: ['Orquesta Juvenil'],
            contactIds: [],
            currentClasses: [],
            tags: ['test']
        });
        test('StudentsRepository.create()', !!student.id);

        const activeStudents = await studentsRepo.findActive();
        test('StudentsRepository.findActive()', activeStudents.some(s => s.id === student.id));

        const byEnsemble = await studentsRepo.findByEnsemble('Orquesta Juvenil');
        test('StudentsRepository.findByEnsemble()', byEnsemble.some(s => s.id === student.id));

        await studentsRepo.delete(student.id);
        test('StudentsRepository.delete()', !(await studentsRepo.findById(student.id)));

        // ==========================================
        // Test 4: TemplatesRepository
        // ==========================================
        console.log('\n--- Testing TemplatesRepository ---');
        
        const { TemplatesRepository } = await import('../src/server/persistence/TemplatesRepository');
        const templatesRepo = TemplatesRepository.getInstance();
        await templatesRepo.initialize();

        const template = await templatesRepo.create({
            name: 'Test Template',
            slug: 'test-template',
            body: 'Hola {{nombre}}, tu hijo {{alumno}} tiene clase a las {{hora}}.',
            category: 'reminder',
            variables: [],
            isActive: true,
            usageCount: 0,
            tags: ['test']
        });
        test('TemplatesRepository.create()', !!template.id);
        test('TemplatesRepository auto-extracts variables', template.variables.length === 2); // nombre, alumno (hora is built-in)

        const bySlug = await templatesRepo.findBySlug('test-template');
        test('TemplatesRepository.findBySlug()', bySlug?.id === template.id);

        await templatesRepo.delete(template.id);

        // ==========================================
        // Test 5: AttendanceRepository
        // ==========================================
        console.log('\n--- Testing AttendanceRepository ---');
        
        const { AttendanceRepository } = await import('../src/server/persistence/AttendanceRepository');
        const attendanceRepo = AttendanceRepository.getInstance();
        await attendanceRepo.initialize();

        const testDate = '2024-01-15';
        await attendanceRepo.recordStudentAttendance(testDate, 'student-123', 'present', {
            notes: 'Test attendance'
        });

        const daily = await attendanceRepo.getByDate(testDate);
        test('AttendanceRepository.recordStudentAttendance()', daily?.records.length === 1);
        test('AttendanceRepository record status', daily?.records[0].status === 'present');

        const summary = await attendanceRepo.getStudentSummary('student-123', '2024-01-01', '2024-12-31');
        test('AttendanceRepository.getStudentSummary()', summary.present === 1);

        await attendanceRepo.deleteByDate(testDate);
        test('AttendanceRepository.deleteByDate()', !(await attendanceRepo.getByDate(testDate)));

        // ==========================================
        // Test 6: PhoneIndexRepository
        // ==========================================
        console.log('\n--- Testing PhoneIndexRepository ---');
        
        const { PhoneIndexRepository } = await import('../src/server/persistence/PhoneIndexRepository');
        const phoneIndexRepo = PhoneIndexRepository.getInstance();
        await phoneIndexRepo.initialize();

        await phoneIndexRepo.link('8095551234', 'contact-123', 'manual');
        const lookup = await phoneIndexRepo.lookup('8095551234');
        test('PhoneIndexRepository.link() and lookup()', lookup?.contactId === 'contact-123');

        const phones = await phoneIndexRepo.getContactPhones('contact-123');
        test('PhoneIndexRepository.getContactPhones()', phones.includes('8095551234'));

        await phoneIndexRepo.unlink('8095551234');
        test('PhoneIndexRepository.unlink()', !(await phoneIndexRepo.lookup('8095551234')));

        // ==========================================
        // Test 7: IdentityService
        // ==========================================
        console.log('\n--- Testing IdentityService ---');
        
        const { IdentityService } = await import('../src/server/services/identityService');
        const identityService = IdentityService.getInstance();

        // Phone normalization
        test('normalizePhone("+1 (809) 555-1234")', 
            identityService.normalizePhone('+1 (809) 555-1234') === '18095551234');
        test('normalizePhone("809-555-1234")', 
            identityService.normalizePhone('809-555-1234') === '18095551234');

        // JID extraction
        test('jidToPhone("18095551234@s.whatsapp.net")', 
            identityService.jidToPhone('18095551234@s.whatsapp.net') === '18095551234');
        test('jidToPhone group returns empty', 
            identityService.jidToPhone('123456@g.us') === '');

        // JID detection
        test('isGroupJid("123456@g.us")', identityService.isGroupJid('123456@g.us'));
        test('isGroupJid individual', !identityService.isGroupJid('18095551234@s.whatsapp.net'));

        // Phone formatting
        test('formatPhoneForDisplay("18095551234")', 
            identityService.formatPhoneForDisplay('18095551234') === '+1 (809) 555-1234');

        // ==========================================
        // Test 8: TemplateService
        // ==========================================
        console.log('\n--- Testing TemplateService ---');
        
        const { TemplateService } = await import('../src/server/services/templateService');
        const templateService = TemplateService.getInstance();

        // Variable extraction
        const vars = templateService.extractVariables('Hola {{nombre}}, tu clase es {{clase}}');
        test('extractVariables()', vars.length === 2 && vars.includes('nombre') && vars.includes('clase'));

        // Rendering
        const renderResult = templateService.renderTemplate(
            'Hola {{nombre}}, tu clase de {{clase}} es hoy.',
            { nombre: 'Maria', clase: 'Violin' }
        );
        test('renderTemplate() success', renderResult.success);
        test('renderTemplate() content', !!(renderResult.rendered?.includes('Maria') && renderResult.rendered?.includes('Violin')));

        // Missing variables
        const missingResult = templateService.renderTemplate(
            'Hola {{nombre}}, tu clase es {{clase}}',
            { nombre: 'Maria' }
        );
        test('renderTemplate() detects missing vars', !missingResult.success && !!missingResult.missingVariables?.includes('clase'));

        // Validation
        const validation = templateService.validateTemplate('Hola {{nombre}}');
        test('validateTemplate() valid', validation.isValid);

        const badValidation = templateService.validateTemplate('Hola {{nombre} mal formado');
        test('validateTemplate() detects errors', !badValidation.isValid);

        // Built-in variables
        const builtInResult = templateService.renderTemplate('Hoy es {{dia}}, {{fecha}}', {});
        test('renderTemplate() built-in vars', builtInResult.success && builtInResult.rendered !== 'Hoy es {{dia}}, {{fecha}}');

        // ==========================================
        // Summary
        // ==========================================
        console.log('\n' + '='.repeat(60));
        console.log(`RESULTS: ${passed} passed, ${failed} failed`);
        console.log('='.repeat(60));

        if (failed > 0) {
            process.exit(1);
        }

    } catch (error) {
        console.error('\n❌ CRITICAL ERROR:', error);
        process.exit(1);
    }
}

main();
