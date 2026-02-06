/**
 * Master Migration Runner
 * Runs all migration scripts in sequence
 */

import { consolidateHorarios } from './001_consolidate_horarios';
import { unifyLegacyFields } from './002_unify_legacy_fields';
import { normalizeAlumnos } from './003_normalize_alumnos';
import { syncBidirectionalReferences } from './004_sync_bidirectional_refs';
import { dataValidator } from '../services/firestore/dataValidator';

/**
 * Run all migrations in order
 */
export async function runAllMigrations(dryRun: boolean = true) {
    console.log('');
    console.log('╔' + '═'.repeat(58) + '╗');
    console.log('║' + ' '.repeat(58) + '║');
    console.log('║' + '  DATA ARCHITECTURE MIGRATION'.padEnd(58) + '║');
    console.log('║' + '  Running all migration scripts'.padEnd(58) + '║');
    console.log('║' + ' '.repeat(58) + '║');
    console.log('╚' + '═'.repeat(58) + '╝');
    console.log('');
    console.log(`Mode: ${dryRun ? '🔍 DRY RUN' : '🚀 LIVE EXECUTION'}`);
    console.log('');

    try {
        // Migration 1: Consolidate Horarios
        console.log('📋 Step 1/4: Consolidating HORARIOS into CLASES...');
        const result1 = await consolidateHorarios(dryRun);
        if (!result1.success) throw new Error('Migration 1 failed');
        console.log('');

        // Migration 2: Unify Legacy Fields
        console.log('📋 Step 2/4: Unifying legacy field names...');
        const result2 = await unifyLegacyFields(dryRun);
        if (!result2.success) throw new Error('Migration 2 failed');
        console.log('');

        // Migration 3: Normalize Alumnos
        console.log('📋 Step 3/4: Normalizing student class assignments...');
        const result3 = await normalizeAlumnos(dryRun);
        if (!result3.success) throw new Error('Migration 3 failed');
        console.log('');

        // Migration 4: Sync Bidirectional References
        console.log('📋 Step 4/4: Syncing bidirectional references...');
        const result4 = await syncBidirectionalReferences(dryRun);
        if (!result4.success) throw new Error('Migration 4 failed');
        console.log('');

        // Generate integrity report
        console.log('📊 Generating integrity report...');
        console.log('');
        const integrityReport = await dataValidator.generateIntegrityReport();
        dataValidator.printIntegrityReport(integrityReport);

        // Final summary
        console.log('');
        console.log('╔' + '═'.repeat(58) + '╗');
        console.log('║' + ' '.repeat(58) + '║');
        console.log('║' + '  ✅ ALL MIGRATIONS COMPLETED SUCCESSFULLY'.padEnd(58) + '║');
        console.log('║' + ' '.repeat(58) + '║');
        console.log('╚' + '═'.repeat(58) + '╝');
        console.log('');

        if (dryRun) {
            console.log('⚠️  This was a DRY RUN. No changes were made to Firestore.');
            console.log('');
            console.log('To apply these changes, run:');
            console.log('  npm run migrate -- --live');
        } else {
            console.log('✅ Migrations applied successfully!');
            console.log('');
            console.log('NEXT STEPS:');
            console.log('1. ✅ Update UI components to use new field names');
            console.log('2. ✅ Remove legacy field fallbacks from service code');
            console.log('3. ⚠️  Keep HORARIOS collection as backup for 1 week');
            console.log('4. ⚠️  Monitor for any issues');
            console.log('5. 🗑️  Delete HORARIOS collection after verification period');
        }

        return {
            success: true,
            results: {
                consolidateHorarios: result1,
                unifyLegacyFields: result2,
                normalizeAlumnos: result3,
                syncBidirectional: result4
            },
            integrityReport
        };

    } catch (error) {
        console.error('');
        console.error('╔' + '═'.repeat(58) + '╗');
        console.error('║' + ' '.repeat(58) + '║');
        console.error('║' + '  ❌ MIGRATION FAILED'.padEnd(58) + '║');
        console.error('║' + ' '.repeat(58) + '║');
        console.error('╚' + '═'.repeat(58) + '╝');
        console.error('');
        console.error('Error:', error);
        console.error('');
        console.error('Migrations have been stopped. Please review the errors above.');
        
        if (!dryRun) {
            console.error('');
            console.error('⚠️  IMPORTANT: Some changes may have been applied.');
            console.error('Please run dataValidator.generateIntegrityReport() to check data state.');
        }

        throw error;
    }
}

// Allow running directly
if (require.main === module) {
    const dryRun = process.argv.includes('--live') ? false : true;
    
    runAllMigrations(dryRun)
        .then(() => {
            console.log('');
            console.log('Migration process completed.');
            process.exit(0);
        })
        .catch(() => {
            console.error('');
            console.error('Migration process failed.');
            process.exit(1);
        });
}
