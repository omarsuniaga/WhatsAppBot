/**
 * Migration Script 004: Sync Bidirectional References
 * Ensures ALUMNOS.classIds and CLASES.studentIds are in sync
 */

import { alumnosService } from '../services/firestore/alumnosService';
import { clasesService } from '../services/firestore/clasesService';

interface SyncResult {
    success: boolean;
    clasesSynced: number;
    alumnosSynced: number;
    studentsAdded: number;
    studentsRemoved: number;
    errors: Array<{ id: string; error: string }>;
}

/**
 * Main sync function
 */
export async function syncBidirectionalReferences(dryRun: boolean = true): Promise<SyncResult> {
    const result: SyncResult = {
        success: true,
        clasesSynced: 0,
        alumnosSynced: 0,
        studentsAdded: 0,
        studentsRemoved: 0,
        errors: []
    };

    console.log('='.repeat(60));
    console.log('MIGRATION 004: Sync Bidirectional References');
    console.log('='.repeat(60));
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log('');

    try {
        // 1. Fetch all data
        const [alumnos, clases] = await Promise.all([
            alumnosService.getAll(),
            clasesService.getAllClases()
        ]);

        console.log(`Found ${alumnos.length} alumnos`);
        console.log(`Found ${clases.length} clases`);
        console.log('');

        // 2. Build expected state from ALUMNOS
        const expectedStudentsPerClase = new Map<string, Set<string>>();
        
        alumnos.forEach(alumno => {
            if (alumno.classIds?.length) {
                alumno.classIds.forEach(classId => {
                    if (!expectedStudentsPerClase.has(classId)) {
                        expectedStudentsPerClase.set(classId, new Set());
                    }
                    expectedStudentsPerClase.get(classId)!.add(alumno.id);
                });
            }
        });

        console.log('Expected state built from ALUMNOS.classIds');
        console.log('');

        // 3. Sync CLASES.studentIds
        for (const clase of clases) {
            const expected = expectedStudentsPerClase.get(clase.id) || new Set();
            const current = new Set(clase.studentIds || clase.alumno_ids || []);

            const toAdd = [...expected].filter(id => !current.has(id));
            const toRemove = [...current].filter(id => !expected.has(id));

            if (toAdd.length > 0 || toRemove.length > 0) {
                console.log(`${clase.id} (${clase.name || clase.nombre}):`);
                if (toAdd.length > 0) {
                    console.log(`  + Add ${toAdd.length} students: ${toAdd.join(', ')}`);
                    result.studentsAdded += toAdd.length;
                }
                if (toRemove.length > 0) {
                    console.log(`  - Remove ${toRemove.length} students: ${toRemove.join(', ')}`);
                    result.studentsRemoved += toRemove.length;
                }

                if (!dryRun) {
                    try {
                        await clasesService.update(clase.id, {
                            studentIds: [...expected]
                        });
                        result.clasesSynced++;
                    } catch (error) {
                        const errorMsg = error instanceof Error ? error.message : String(error);
                        console.error(`❌ Error updating clase ${clase.id}:`, errorMsg);
                        result.errors.push({ id: clase.id, error: errorMsg });
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
        console.log(`Clases synced: ${dryRun ? '0 (dry run)' : result.clasesSynced}`);
        console.log(`Students added: ${result.studentsAdded}`);
        console.log(`Students removed: ${result.studentsRemoved}`);
        console.log(`Errors: ${result.errors.length}`);
        console.log('');

        if (dryRun) {
            console.log('⚠️  This was a DRY RUN. Run with dryRun=false to apply changes.');
        } else {
            console.log('✓ Migration completed successfully!');
            console.log('');
            console.log('NEXT STEPS:');
            console.log('1. Verify with dataValidator.generateIntegrityReport()');
            console.log('2. Test UI to ensure class rosters display correctly');
        }

    } catch (error) {
        console.error('❌ Migration failed:', error);
        result.success = false;
        throw error;
    }

    return result;
}

// Allow running directly
if (require.main === module) {
    const dryRun = process.argv.includes('--live') ? false : true;
    
    syncBidirectionalReferences(dryRun)
        .then(result => {
            console.log('Migration result:', result);
            process.exit(result.success ? 0 : 1);
        })
        .catch(err => {
            console.error('Fatal error:', err);
            process.exit(1);
        });
}
