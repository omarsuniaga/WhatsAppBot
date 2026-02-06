/**
 * Migration Script 001: Consolidate Horarios
 * Moves schedule data from HORARIOS collection into CLASES.schedule.slots
 */

import { horariosService } from '../services/firestore/horariosService';
import { clasesService } from '../services/firestore/clasesService';
import type { ScheduleSlot } from '../services/firestore/clasesService';

interface MigrationResult {
    success: boolean;
    clasesUpdated: number;
    horariosProcessed: number;
    errors: Array<{ claseId: string; error: string }>;
}

/**
 * Main migration function
 */
export async function consolidateHorarios(dryRun: boolean = true): Promise<MigrationResult> {
    const result: MigrationResult = {
        success: true,
        clasesUpdated: 0,
        horariosProcessed: 0,
        errors: []
    };

    console.log('='.repeat(60));
    console.log('MIGRATION 001: Consolidate Horarios');
    console.log('='.repeat(60));
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log('');

    try {
        // 1. Fetch all horarios
        const horarios = await horariosService.getAllHorarios();
        console.log(`Found ${horarios.length} horarios in HORARIOS collection`);
        result.horariosProcessed = horarios.length;

        // 2. Group by clase_id
        const horariosMap = new Map<string, typeof horarios>();
        horarios.forEach(h => {
            if (h.clase_id) {
                if (!horariosMap.has(h.clase_id)) {
                    horariosMap.set(h.clase_id, []);
                }
                horariosMap.get(h.clase_id)!.push(h);
            }
        });

        console.log(`Grouped into ${horariosMap.size} classes`);
        console.log('');

        // 3. Update each clase
        for (const [claseId, horariosForClase] of horariosMap) {
            try {
                // Fetch clase
                const clase = await clasesService.getById(claseId);
                if (!clase) {
                    console.warn(`⚠️  Clase ${claseId} not found, skipping ${horariosForClase.length} horarios`);
                    continue;
                }

                // Check if clase already has schedule.slots
                const hasModernSchedule = clase.schedule?.slots && clase.schedule.slots.length > 0;

                if (hasModernSchedule) {
                    console.log(`ℹ️  Clase ${claseId} (${clase.name || clase.nombre}) already has schedule.slots, skipping`);
                    continue;
                }

                // Convert horarios to slots
                const slots: ScheduleSlot[] = horariosForClase.map(h => ({
                    day: h.dia,
                    startTime: h.hora_inicio,
                    endTime: h.hora_fin
                }));

                console.log(`✓ Clase ${claseId} (${clase.name || clase.nombre}): ${slots.length} slots`);
                slots.forEach(s => {
                    console.log(`    ${s.day} ${s.startTime} - ${s.endTime}`);
                });

                if (!dryRun) {
                    // Update clase with new schedule
                    await clasesService.update(claseId, {
                        schedule: { slots }
                    });
                    result.clasesUpdated++;
                }

            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                console.error(`❌ Error processing clase ${claseId}:`, errorMsg);
                result.errors.push({ claseId, error: errorMsg });
                result.success = false;
            }
        }

        console.log('');
        console.log('='.repeat(60));
        console.log('MIGRATION COMPLETE');
        console.log('='.repeat(60));
        console.log(`Mode: ${dryRun ? 'DRY RUN (no changes made)' : 'LIVE'}`);
        console.log(`Horarios processed: ${result.horariosProcessed}`);
        console.log(`Clases updated: ${dryRun ? '0 (dry run)' : result.clasesUpdated}`);
        console.log(`Errors: ${result.errors.length}`);
        console.log('');

        if (dryRun) {
            console.log('⚠️  This was a DRY RUN. Run with dryRun=false to apply changes.');
        } else {
            console.log('✓ Migration completed successfully!');
            console.log('');
            console.log('NEXT STEPS:');
            console.log('1. Verify data integrity with dataValidator.generateIntegrityReport()');
            console.log('2. Keep HORARIOS collection as backup for 1 week');
            console.log('3. After verification, delete HORARIOS collection');
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
    
    consolidateHorarios(dryRun)
        .then(result => {
            console.log('Migration result:', result);
            process.exit(result.success ? 0 : 1);
        })
        .catch(err => {
            console.error('Fatal error:', err);
            process.exit(1);
        });
}
