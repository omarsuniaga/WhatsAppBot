/**
 * Reference Resolver Utility
 * Hydrates entity references by fetching related data
 */

import { clasesService, type Clase } from './clasesService';
import { maestrosService, type Maestro } from './maestrosService';
import { salonesService, type Salon } from './salonesService';
import { alumnosService, type Alumno } from './alumnosService';

// Enriched types with resolved references
export interface EnrichedClase extends Clase {
    teacher?: Maestro | null;
    room?: Salon | null;
    students?: Alumno[];
}

export interface EnrichedAlumno extends Alumno {
    classes?: Clase[];
}

export interface EnrichedMaestro extends Maestro {
    classes?: Clase[];
}

/**
 * Cache for resolved references to avoid redundant queries
 */
class ReferenceCacheClass {
    private cache: Map<string, any> = new Map();
    private cacheExpiry: Map<string, number> = new Map();
    private TTL = 5 * 60 * 1000; // 5 minutes

    set(key: string, value: any): void {
        this.cache.set(key, value);
        this.cacheExpiry.set(key, Date.now() + this.TTL);
    }

    get(key: string): any | null {
        const expiry = this.cacheExpiry.get(key);
        if (!expiry || Date.now() > expiry) {
            this.cache.delete(key);
            this.cacheExpiry.delete(key);
            return null;
        }
        return this.cache.get(key) || null;
    }

    clear(): void {
        this.cache.clear();
        this.cacheExpiry.clear();
    }
}

const cache = new ReferenceCacheClass();

/**
 * Reference Resolver Service
 */
export class ReferenceResolverClass {
    /**
     * Enrich a Clase with teacher, room, and student data
     */
    async enrichClase(clase: Clase): Promise<EnrichedClase> {
        const enriched: EnrichedClase = { ...clase };

        // Resolve teacher
        const teacherId = clase.teacherId || clase.profesor_id;
        if (teacherId) {
            const cacheKey = `teacher:${teacherId}`;
            let teacher = cache.get(cacheKey);
            if (!teacher) {
                teacher = await maestrosService.getById(teacherId);
                if (teacher) cache.set(cacheKey, teacher);
            }
            enriched.teacher = teacher;
        }

        // Resolve room
        const roomId = clase.roomId || clase.salon_id;
        if (roomId) {
            const cacheKey = `room:${roomId}`;
            let room = cache.get(cacheKey);
            if (!room) {
                room = await salonesService.getById(roomId);
                if (room) cache.set(cacheKey, room);
            }
            enriched.room = room;
        }

        // Resolve students
        const studentIds = clase.studentIds || clase.alumno_ids || [];
        if (studentIds.length > 0) {
            const students = await Promise.all(
                studentIds.map(async (id) => {
                    const cacheKey = `student:${id}`;
                    let student = cache.get(cacheKey);
                    if (!student) {
                        student = await alumnosService.getById(id);
                        if (student) cache.set(cacheKey, student);
                    }
                    return student;
                })
            );
            enriched.students = students.filter(Boolean) as Alumno[];
        }

        return enriched;
    }

    /**
     * Enrich multiple Clases at once
     */
    async enrichClases(clases: Clase[]): Promise<EnrichedClase[]> {
        return Promise.all(clases.map(c => this.enrichClase(c)));
    }

    /**
     * Enrich an Alumno with their classes
     */
    async enrichAlumno(alumno: Alumno): Promise<EnrichedAlumno> {
        const enriched: EnrichedAlumno = { ...alumno };

        if (alumno.classIds?.length) {
            const classes = await Promise.all(
                alumno.classIds.map(async (id) => {
                    const cacheKey = `clase:${id}`;
                    let clase = cache.get(cacheKey);
                    if (!clase) {
                        clase = await clasesService.getById(id);
                        if (clase) cache.set(cacheKey, clase);
                    }
                    return clase;
                })
            );
            enriched.classes = classes.filter(Boolean) as Clase[];
        }

        return enriched;
    }

    /**
     * Enrich a Maestro with their classes
     */
    async enrichMaestro(maestro: Maestro): Promise<EnrichedMaestro> {
        const enriched: EnrichedMaestro = { ...maestro };
        
        // Get classes where this teacher is assigned
        const classes = await clasesService.getByTeacher(maestro.id);
        enriched.classes = classes;

        return enriched;
    }

    /**
     * Clear the reference cache
     */
    clearCache(): void {
        cache.clear();
    }
}

export const referenceResolver = new ReferenceResolverClass();
