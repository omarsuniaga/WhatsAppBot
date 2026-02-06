/**
 * Merge Classes Script
 * Combines multiple classes with same teacher, schedule, and room into a single multi-instrument class
 */

import { clasesService, Clase } from '../services/firestore/clasesService';
import { alumnosService } from '../services/firestore/alumnosService';

export interface MergeClassesOptions {
    keepName?: string;           // Name for the merged class (default: keep oldest)
    instruments?: string[];      // Instruments for merged class
    keepClassId?: string;        // Which class ID to keep (default: oldest)
    dryRun?: boolean;           // If true, don't actually modify data
}

export interface MergeClassesResult {
    success: boolean;
    message: string;
    mergedClassId?: string;
    deletedClassIds?: string[];
    totalStudents?: number;
    errors?: string[];
}

/**
 * Merge multiple classes into one multi-instrument class
 */
export async function mergeClasses(
    classIds: string[],
    options: MergeClassesOptions = {}
): Promise<MergeClassesResult> {
    const { keepName, instruments, keepClassId, dryRun = true } = options;

    console.log(`[MergeClasses] Starting merge process (DRY RUN: ${dryRun})`);
    console.log(`[MergeClasses] Class IDs:`, classIds);

    try {
        // 1. Validate input
        if (!classIds || classIds.length < 2) {
            return {
                success: false,
                message: 'Se requieren al menos 2 clases para fusionar',
                errors: ['Insufficient classes']
            };
        }

        // 2. Fetch all classes
        const allClasses = await clasesService.getAllClases();
        const classesToMerge = allClasses.filter(c => classIds.includes(c.id));

        if (classesToMerge.length !== classIds.length) {
            return {
                success: false,
                message: 'No se encontraron todas las clases especificadas',
                errors: ['Some classes not found']
            };
        }

        console.log(`[MergeClasses] Found ${classesToMerge.length} classes`);

        // 3. Validate compatibility (must be mergeable)
        const validation = validateClassesCanBeMerged(classesToMerge);
        if (!validation.canMerge) {
            return {
                success: false,
                message: validation.reason || 'Las clases no pueden fusionarse',
                errors: validation.errors
            };
        }

        // 4. Determine which class to keep
        const canonical = keepClassId 
            ? classesToMerge.find(c => c.id === keepClassId)
            : classesToMerge.sort((a, b) => {
                const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return aDate - bDate;
            })[0];

        if (!canonical) {
            return {
                success: false,
                message: 'No se pudo determinar la clase principal',
                errors: ['Canonical class not found']
            };
        }

        console.log(`[MergeClasses] Canonical class:`, canonical.name);

        // 5. Collect all unique students
        const allStudentIds = new Set<string>();
        classesToMerge.forEach(clase => {
            clase.studentIds?.forEach(id => allStudentIds.add(id));
        });

        console.log(`[MergeClasses] Total unique students: ${allStudentIds.size}`);

        // 6. Collect all instruments
        const allInstruments = new Set<string>();
        classesToMerge.forEach(clase => {
            if (clase.instruments?.length) {
                clase.instruments.forEach(inst => allInstruments.add(inst));
            } else if (clase.instrument) {
                allInstruments.add(clase.instrument);
            }
        });

        const mergedInstruments = instruments || Array.from(allInstruments);
        console.log(`[MergeClasses] Merged instruments:`, mergedInstruments);

        // 7. Prepare merged class data
        const mergedClass: Partial<Clase> = {
            ...canonical,
            name: keepName || canonical.name,
            instruments: mergedInstruments,
            instrument: mergedInstruments[0] || '', // Legacy field: first instrument
            studentIds: Array.from(allStudentIds),
            updatedAt: new Date().toISOString()
        };

        const classesToDelete = classesToMerge.filter(c => c.id !== canonical.id);
        
        if (dryRun) {
            console.log('[MergeClasses] DRY RUN - Would perform:');
            console.log('  - Update canonical class:', canonical.id);
            console.log('  - New name:', mergedClass.name);
            console.log('  - Instruments:', mergedClass.instruments);
            console.log('  - Students:', mergedClass.studentIds?.length);
            console.log('  - Delete classes:', classesToDelete.map(c => c.id));
            
            return {
                success: true,
                message: `DRY RUN: Fusionaría ${classesToMerge.length} clases en "${mergedClass.name}"`,
                mergedClassId: canonical.id,
                deletedClassIds: classesToDelete.map(c => c.id),
                totalStudents: allStudentIds.size
            };
        }

        // 8. Execute merge
        console.log('[MergeClasses] Executing merge...');

        // Update canonical class
        await clasesService.updateWithHistory(
            canonical.id,
            {
                name: mergedClass.name,
                instruments: mergedClass.instruments,
                instrument: mergedClass.instrument,
                studentIds: mergedClass.studentIds,
                updatedAt: mergedClass.updatedAt
            },
            `Fusión de ${classesToMerge.length} clases: ${classesToMerge.map(c => c.name).join(', ')}`,
            'system'
        );

        // 9. Update all student references
        const students = await alumnosService.getAllStudents();
        for (const student of students) {
            if (allStudentIds.has(student.id)) {
                // Remove references to deleted classes
                const updatedClassIds = (student.classIds || [])
                    .filter(id => !classesToDelete.some(c => c.id === id));
                
                // Add canonical class if not already there
                if (!updatedClassIds.includes(canonical.id)) {
                    updatedClassIds.push(canonical.id);
                }

                await alumnosService.update(student.id, { classIds: updatedClassIds });
            }
        }

        // 10. Delete duplicate classes
        for (const clase of classesToDelete) {
            await clasesService.delete(clase.id);
            console.log(`[MergeClasses] Deleted class: ${clase.name} (${clase.id})`);
        }

        return {
            success: true,
            message: `Fusionadas ${classesToMerge.length} clases exitosamente`,
            mergedClassId: canonical.id,
            deletedClassIds: classesToDelete.map(c => c.id),
            totalStudents: allStudentIds.size
        };

    } catch (error: any) {
        console.error('[MergeClasses] Error:', error);
        return {
            success: false,
            message: `Error al fusionar clases: ${error.message}`,
            errors: [error.message]
        };
    }
}

/**
 * Validate if classes can be merged
 */
function validateClassesCanBeMerged(classes: Clase[]): {
    canMerge: boolean;
    reason?: string;
    errors?: string[];
} {
    if (classes.length < 2) {
        return { canMerge: false, reason: 'Se requieren al menos 2 clases' };
    }

    const first = classes[0];
    const errors: string[] = [];

    // Check teacher
    const sameTeacher = classes.every(c => c.teacherId === first.teacherId);
    if (!sameTeacher) {
        errors.push('Las clases tienen diferentes profesores');
    }

    // Check room
    const sameRoom = classes.every(c => c.roomId === first.roomId);
    if (!sameRoom) {
        errors.push('Las clases tienen diferentes salones');
    }

    // Check schedule overlap
    if (first.schedule?.slots?.length) {
        const firstSlots = first.schedule.slots;
        for (const clase of classes.slice(1)) {
            if (!clase.schedule?.slots?.length) {
                errors.push(`La clase "${clase.name}" no tiene horarios definidos`);
                continue;
            }

            // Check if schedules overlap
            let hasOverlap = false;
            for (const slot1 of firstSlots) {
                for (const slot2 of clase.schedule.slots) {
                    if (slot1.day === slot2.day && slot1.startTime === slot2.startTime) {
                        hasOverlap = true;
                        break;
                    }
                }
                if (hasOverlap) break;
            }

            if (!hasOverlap) {
                errors.push(`La clase "${clase.name}" no tiene horarios coincidentes con "${first.name}"`);
            }
        }
    }

    if (errors.length > 0) {
        return {
            canMerge: false,
            reason: 'Las clases no son compatibles para fusionar',
            errors
        };
    }

    return { canMerge: true };
}

/**
 * Detect classes that could potentially be merged
 * Returns groups of classes with same teacher, room, and schedule
 */
export async function detectMergeableclasses(): Promise<Clase[][]> {
    const classes = await clasesService.getAllClases();
    const groups: Map<string, Clase[]> = new Map();

    for (const clase of classes) {
        if (!clase.schedule?.slots?.length) continue;
        if (clase.status !== 'active') continue;

        // Create fingerprint: teacher + room + schedule
        const slots = clase.schedule.slots
            .map(s => `${s.day}-${s.startTime}-${s.endTime}`)
            .sort()
            .join('|');
        const key = `${clase.teacherId || 'no-teacher'}__${clase.roomId || 'no-room'}__${slots}`;

        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key)!.push(clase);
    }

    // Filter groups with 2+ classes
    return Array.from(groups.values()).filter(group => group.length >= 2);
}
