/**
 * Deduplication Script for Classes
 * Detects and merges duplicate classes in Firestore
 * 
 * A class is considered duplicate if it has:
 * - Same name
 * - Same teacher
 * - Same room
 * - Same schedule time
 */

import { clasesService, type Clase } from '../services/firestore/clasesService';
import { alumnosService } from '../services/firestore/alumnosService';

interface DuplicateGroup {
    canonical: Clase;  // The one we'll keep
    duplicates: Clase[];  // The ones to merge/delete
    reason: string;
}

interface DeduplicationResult {
    success: boolean;
    duplicateGroups: DuplicateGroup[];
    clasesAnalyzed: number;
    duplicatesFound: number;
    duplicatesRemoved: number;
    studentsMerged: number;
    errors: Array<{ claseId: string; error: string }>;
}

/**
 * Generate a fingerprint for a class to detect duplicates
 */
function getClassFingerprint(clase: Clase): string {
    const name = (clase.name || clase.nombre || '').toLowerCase().trim();
    const teacherId = clase.teacherId || clase.profesor_id || '';
    const roomId = clase.roomId || clase.salon_id || '';
    
    // Get schedule slots as sorted string
    const slots = clase.schedule?.slots || [];
    const slotsStr = slots
        .map(s => `${s.day}-${s.startTime}-${s.endTime}`)
        .sort()
        .join('|');
    
    return `${name}::${teacherId}::${roomId}::${slotsStr}`;
}

/**
 * Detect duplicate classes
 */
export async function detectDuplicates(): Promise<DuplicateGroup[]> {
    const allClases = await clasesService.getAllClases();
    const fingerprintMap = new Map<string, Clase[]>();
    
    // Group by fingerprint
    allClases.forEach(clase => {
        const fingerprint = getClassFingerprint(clase);
        if (!fingerprintMap.has(fingerprint)) {
            fingerprintMap.set(fingerprint, []);
        }
        fingerprintMap.get(fingerprint)!.push(clase);
    });
    
    // Find groups with duplicates
    const duplicateGroups: DuplicateGroup[] = [];
    
    fingerprintMap.forEach((clases) => {
        if (clases.length > 1) {
            // Sort by creation date (keep oldest)
            clases.sort((a, b) => {
                const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return aDate - bDate;
            });
            
            duplicateGroups.push({
                canonical: clases[0],
                duplicates: clases.slice(1),
                reason: `${clases.length} clases con mismo nombre, profesor, salón y horario`
            });
        }
    });
    
    return duplicateGroups;
}

/**
 * Merge students from duplicate classes into canonical class
 */
async function mergeStudents(canonical: Clase, duplicates: Clase[]): Promise<number> {
    const canonicalStudents = new Set(canonical.studentIds || canonical.alumno_ids || []);
    let mergedCount = 0;
    
    for (const dup of duplicates) {
        const dupStudents = dup.studentIds || dup.alumno_ids || [];
        
        for (const studentId of dupStudents) {
            if (!canonicalStudents.has(studentId)) {
                canonicalStudents.add(studentId);
                mergedCount++;
            }
        }
    }
    
    // Update canonical class with merged students
    if (mergedCount > 0) {
        await clasesService.update(canonical.id, {
            studentIds: Array.from(canonicalStudents)
        });
    }
    
    return mergedCount;
}

/**
 * Update student references from duplicate classes to canonical class
 */
async function updateStudentReferences(canonical: Clase, duplicates: Clase[]): Promise<void> {
    const duplicateIds = duplicates.map(d => d.id);
    const allStudents = await alumnosService.getAll();
    
    for (const student of allStudents) {
        if (student.classIds?.some(id => duplicateIds.includes(id))) {
            // Replace duplicate class IDs with canonical ID
            const updatedClassIds = student.classIds
                .map(id => duplicateIds.includes(id) ? canonical.id : id)
                .filter((id, index, self) => self.indexOf(id) === index); // Remove duplicates
            
            await alumnosService.update(student.id, { classIds: updatedClassIds });
        }
    }
}

/**
 * Main deduplication function
 */
export async function deduplicateClasses(dryRun: boolean = true): Promise<DeduplicationResult> {
    const result: DeduplicationResult = {
        success: true,
        duplicateGroups: [],
        clasesAnalyzed: 0,
        duplicatesFound: 0,
        duplicatesRemoved: 0,
        studentsMerged: 0,
        errors: []
    };
    
    console.log('='.repeat(60));
    console.log('CLASS DEDUPLICATION SCRIPT');
    console.log('='.repeat(60));
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log('');
    
    try {
        // 1. Detect duplicates
        console.log('🔍 Detecting duplicates...');
        const duplicateGroups = await detectDuplicates();
        result.duplicateGroups = duplicateGroups;
        result.duplicatesFound = duplicateGroups.reduce((sum, g) => sum + g.duplicates.length, 0);
        
        const allClases = await clasesService.getAllClases();
        result.clasesAnalyzed = allClases.length;
        
        console.log(`Found ${duplicateGroups.length} duplicate groups`);
        console.log(`Total duplicates: ${result.duplicatesFound}`);  console.log('');
        
        if (duplicateGroups.length === 0) {
            console.log('✅ No duplicates found!');
            return result;
        }
        
        // 2. Show duplicates
        console.log('Duplicate groups:');
        console.log('');
        
        duplicateGroups.forEach((group, index) => {
            console.log(`Group ${index + 1}: ${group.reason}`);
            console.log(`  Canonical: ${group.canonical.id} - "${group.canonical.name || group.canonical.nombre}"`);
            console.log(`  Duplicates:`);
            group.duplicates.forEach(dup => {
                console.log(`    - ${dup.id} - "${dup.name || dup.nombre}"`);
            });
            console.log('');
        });
        
        if (dryRun) {
            console.log('⚠️  This is a DRY RUN. Run with dryRun=false to apply changes.');
            return result;
        }
        
        // 3. Merge and delete
        console.log('🔄 Merging duplicates...');
        
        for (const group of duplicateGroups) {
            try {
                // Merge students
                const studentsMerged = await mergeStudents(group.canonical, group.duplicates);
                result.studentsMerged += studentsMerged;
                
                if (studentsMerged > 0) {
                    console.log(`  ✓ Merged ${studentsMerged} students into ${group.canonical.id}`);
                }
                
                // Update student references
                await updateStudentReferences(group.canonical, group.duplicates);
                
                // Delete duplicates
                for (const dup of group.duplicates) {
                    await clasesService.delete(dup.id);
                    result.duplicatesRemoved++;
                    console.log(`  ✓ Deleted duplicate ${dup.id}`);
                }
                
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                console.error(`  ❌ Error processing group:`, errorMsg);
                result.errors.push({ claseId: group.canonical.id, error: errorMsg });
                result.success = false;
            }
        }
        
        console.log('');
        console.log('='.repeat(60));
        console.log('DEDUPLICATION COMPLETE');
        console.log('='.repeat(60));
        console.log(`Clases analyzed: ${result.clasesAnalyzed}`);
        console.log(`Duplicates found: ${result.duplicatesFound}`);
        console.log(`Duplicates removed: ${result.duplicatesRemoved}`);
        console.log(`Students merged: ${result.studentsMerged}`);
        console.log(`Errors: ${result.errors.length}`);
        console.log('');
        
        if (result.success) {
            console.log('✅ Deduplication completed successfully!');
            console.log('');
            console.log('NEXT STEPS:');
            console.log('1. Refresh the Schedule page');
            console.log('2. Verify conflicts are resolved');
            console.log('3. Check that student assignments are correct');
        }
        
    } catch (error) {
        console.error('❌ Deduplication failed:', error);
        result.success = false;
        throw error;
    }
    
    return result;
}
