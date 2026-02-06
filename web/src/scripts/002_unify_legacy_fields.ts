/**
 * Migration Script 002: Unify Legacy Fields
 * Consolidates legacy Spanish field names to new English names
 */

import { clasesService, type Clase } from '../services/firestore/clasesService';

interface FieldMigrationResult {
    success: boolean;
    clasesProcessed: number;
    clasesUpdated: number;
    fieldsMigrated: {
        name: number;
        teacherId: number;
        roomId: number;
        studentIds: number;
        schedule: number;
    };
    errors: Array<{ claseId: string; error: string }>;
}

/**
 * Main migration function
 */
export async function unifyLegacyFields(dryRun: boolean = true): Promise<FieldMigrationResult> {
    const result: FieldMigrationResult = {
        success: true,
        clasesProcessed: 0,
        clasesUpdated: 0,
        fieldsMigrated: {
            name: 0,
            teacherId: 0,
            roomId: 0,
            studentIds: 0,
            schedule: 0
        },
        errors: []
    };

    console.log('='.repeat(60));
    console.log('MIGRATION 002: Unify Legacy Fields');
    console.log('='.repeat(60));
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log('');

    try {
        // Fetch all clases
        const clases = await clasesService.getAllClases();
        console.log(`Found ${clases.length} clases`);
        result.clasesProcessed = clases.length;
        console.log('');

        for (const clase of clases) {
            const updates: Partial<Clase> = {};
            let needsUpdate = false;

            // Unify name
            if (!clase.name && clase.nombre) {
                updates.name = clase.nombre;
                result.fieldsMigrated.name++;
                needsUpdate = true;
                console.log(`✓ ${clase.id}: nombre → name ("${clase.nombre}")`);
            }

            // Unify teacherId
            if (!clase.teacherId && clase.profesor_id) {
                updates.teacherId = clase.profesor_id;
                result.fieldsMigrated.teacherId++;
                needsUpdate = true;
                console.log(`✓ ${clase.id}: profesor_id → teacherId`);
            }

            // Unify roomId
            if (!clase.roomId && clase.salon_id) {
                updates.roomId = clase.salon_id;
                result.fieldsMigrated.roomId++;
                needsUpdate = true;
                console.log(`✓ ${clase.id}: salon_id → roomId`);
            }

            // Unify studentIds
            if ((!clase.studentIds || clase.studentIds.length === 0) && clase.alumno_ids && clase.alumno_ids.length > 0) {
                updates.studentIds = clase.alumno_ids;
                result.fieldsMigrated.studentIds++;
                needsUpdate = true;
                console.log(`✓ ${clase.id}: alumno_ids → studentIds (${clase.alumno_ids.length} students)`);
            }

            // Unify schedule (legacy horarios array to schedule.slots)
            if ((!clase.schedule?.slots || clase.schedule.slots.length === 0) && clase.horarios && clase.horarios.length > 0) {
                updates.schedule = {
                    slots: clase.horarios.map(h => ({
                        day: getDayName(h.dia),
                        startTime: h.hora_inicio,
                        endTime: h.hora_fin
                    }))
                };
                result.fieldsMigrated.schedule++;
                needsUpdate = true;
                console.log(`✓ ${clase.id}: horarios → schedule.slots (${clase.horarios.length} slots)`);
            }

            if (needsUpdate) {
                if (!dryRun) {
                    try {
                        await clasesService.update(clase.id, updates);
                        result.clasesUpdated++;
                    } catch (error) {
                        const errorMsg = error instanceof Error ? error.message : String(error);
                        console.error(`❌ Error updating clase ${clase.id}:`, errorMsg);
                        result.errors.push({ claseId: clase.id, error: errorMsg });
                        result.success = false;
                    }
                }
            }
        }

        console.log('');
        console.log('='.repeat(60));
        console.log('MIGRATION COMPLETE');
        console.log('='.repeat(60));
        console.log(`Mode: ${dryRun ? 'DRY RUN (no changes made)' : 'LIVE'}`);
        console.log(`Clases processed: ${result.clasesProcessed}`);
        console.log(`Clases updated: ${dryRun ? '0 (dry run)' : result.clasesUpdated}`);
        console.log('');
        console.log('Fields migrated:');
        console.log(`  name: ${result.fieldsMigrated.name}`);
        console.log(`  teacherId: ${result.fieldsMigrated.teacherId}`);
        console.log(`  roomId: ${result.fieldsMigrated.roomId}`);
        console.log(`  studentIds: ${result.fieldsMigrated.studentIds}`);
        console.log(`  schedule: ${result.fieldsMigrated.schedule}`);
        console.log(`  Errors: ${result.errors.length}`);
        console.log('');

        if (dryRun) {
            console.log('⚠️  This was a DRY RUN. Run with dryRun=false to apply changes.');
        } else {
            console.log('✓ Migration completed successfully!');
            console.log('');
            console.log('NEXT STEPS:');
            console.log('1. Verify data with dataValidator.generateIntegrityReport()');
            console.log('2. Update UI components to use new field names');
            console.log('3. Remove legacy field fallbacks from code');
        }

    } catch (error) {
        console.error('❌ Migration failed:', error);
        result.success = false;
        throw error;
    }

    return result;
}

/**
 * Convert numeric day to Spanish day name
 */
function getDayName(dia: number): string {
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    return days[dia - 1] || 'Lunes';
}

// Allow running directly
if (require.main === module) {
    const dryRun = process.argv.includes('--live') ? false : true;
    
    unifyLegacyFields(dryRun)
        .then(result => {
            console.log('Migration result:', result);
            process.exit(result.success ? 0 : 1);
        })
        .catch(err => {
            console.error('Fatal error:', err);
            process.exit(1);
        });
}
