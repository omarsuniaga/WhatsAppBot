/**
 * Migration Script 003: Normalize Alumnos
 * Converts ALUMNOS.grupo (string array) to classIds (ID array)
 */

import { alumnosService } from '../services/firestore/alumnosService';
import { clasesService } from '../services/firestore/clasesService';

interface AlumnoMigrationResult {
    success: boolean;
    alumnosProcessed: number;
    alumnosUpdated: number;
    gruposConverted: number;
    unmatchedGrupos: Array<{ alumnoId: string; grupoName: string }>;
    errors: Array<{ alumnoId: string; error: string }>;
}

/**
 * Main migration function
 */
export async function normalizeAlumnos(dryRun: boolean = true): Promise<AlumnoMigrationResult> {
    const result: AlumnoMigrationResult = {
        success: true,
        alumnosProcessed: 0,
        alumnosUpdated: 0,
        gruposConverted: 0,
        unmatchedGrupos: [],
        errors: []
    };

    console.log('='.repeat(60));
    console.log('MIGRATION 003: Normalize Alumnos');
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
        result.alumnosProcessed = alumnos.length;
        console.log('');

        // 2. Create name → ID lookup
        const claseNameToId = new Map<string, string>();
        clases.forEach(c => {
            const name = (c.name || c.nombre || '').toLowerCase().trim();
            if (name) {
                claseNameToId.set(name, c.id);
            }
        });

        // 3. Process each alumno
        for (const alumno of alumnos) {
            if (!alumno.grupo || alumno.grupo.length === 0) {
                continue; // Skip if no grupo
            }

            const classIds: string[] = [];

            // Convert grupo names to class IDs
            for (const grupoName of alumno.grupo) {
                const normalized = grupoName.toLowerCase().trim();
                const classId = claseNameToId.get(normalized);

                if (classId) {
                    classIds.push(classId);
                    result.gruposConverted++;
                    console.log(`✓ ${alumno.id} (${alumno.nombre} ${alumno.apellido}): "${grupoName}" → ${classId}`);
                } else {
                    console.warn(`⚠️  ${alumno.id}: Cannot find clase for grupo "${grupoName}"`);
                    result.unmatchedGrupos.push({
                        alumnoId: alumno.id,
                        grupoName
                    });
                }
            }

            // Merge with existing classIds
            const existing = alumno.classIds || [];
            const merged = [...new Set([...existing, ...classIds])];

            if (merged.length > existing.length) {
                if (!dryRun) {
                    try {
                        await alumnosService.update(alumno.id, {
                            classIds: merged
                        });
                        result.alumnosUpdated++;
                    } catch (error) {
                        const errorMsg = error instanceof Error ? error.message : String(error);
                        console.error(`❌ Error updating alumno ${alumno.id}:`, errorMsg);
                        result.errors.push({ alumnoId: alumno.id, error: errorMsg });
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
        console.log(`Alumnos processed: ${result.alumnosProcessed}`);
        console.log(`Alumnos updated: ${dryRun ? '0 (dry run)' : result.alumnosUpdated}`);
        console.log(`Grupos converted: ${result.gruposConverted}`);
        console.log(`Unmatched grupos: ${result.unmatchedGrupos.length}`);
        console.log(`Errors: ${result.errors.length}`);
        console.log('');

        if (result.unmatchedGrupos.length > 0) {
            console.log('Unmatched grupos (need manual review):');
            result.unmatchedGrupos.forEach(u => {
                console.log(`  ${u.alumnoId}: "${u.grupoName}"`);
            });
            console.log('');
        }

        if (dryRun) {
            console.log('⚠️  This was a DRY RUN. Run with dryRun=false to apply changes.');
        } else {
            console.log('✓ Migration completed successfully!');
            console.log('');
            console.log('NEXT STEPS:');
            console.log('1. Run bidirectional sync script to sync CLASES.studentIds');
            console.log('2. Verify with dataValidator.generateIntegrityReport()');
            console.log('3. Remove references to ALUMNOS.grupo from UI');
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
    
    normalizeAlumnos(dryRun)
        .then(result => {
            console.log('Migration result:', result);
            process.exit(result.success ? 0 : 1);
        })
        .catch(err => {
            console.error('Fatal error:', err);
            process.exit(1);
        });
}
