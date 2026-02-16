/**
 * Asistencias Service
 * Manages ASISTENCIAS collection in Firestore
 */

import { where, orderBy, QueryConstraint } from 'firebase/firestore';
import { FirestoreService, FirestoreDocument } from './baseService';

export interface Asistencia extends FirestoreDocument {
    alumno_id: string;
    alumno_nombre?: string;
    clase_id: string;
    clase_nombre?: string;
    fecha: string;
    estado: 'presente' | 'ausente' | 'tardanza' | 'justificado' | 'pendiente';
    hora_entrada?: string;
    hora_salida?: string;
    observaciones?: string;
    justificacion?: string;
    registrado_por?: string;
    profesor_id?: string;
}

class AsistenciasServiceClass extends FirestoreService<Asistencia> {
    constructor() {
        super('ASISTENCIAS');
    }

    async getByDate(date: string): Promise<Asistencia[]> {
        const results = await this.query('fecha', '==', date);
        return this.expandBulkRecords(results);
    }

    async getByStudent(studentId: string): Promise<Asistencia[]> {
        const constraints: QueryConstraint[] = [
            where('alumno_id', '==', studentId),
            orderBy('fecha', 'desc')
        ];
        const results = await super.getAll(constraints);
        return this.expandBulkRecords(results);
    }

    async getByClass(classId: string): Promise<Asistencia[]> {
        const results = await this.query('clase_id', '==', classId);
        return this.expandBulkRecords(results);
    }

    /**
     * Expands documents that contain multiple student records in a 'data' object
     * into individual virtual Asistencia records.
     */
    private expandBulkRecords(docs: any[]): Asistencia[] {
        const expanded: Asistencia[] = [];

        const resolveStudentRef = (ref: any): { id: string; name?: string } => {
            if (typeof ref === 'string') return { id: ref };
            if (typeof ref === 'number') return { id: String(ref) };
            if (ref && typeof ref === 'object') {
                const id =
                    ref.alumno_id ||
                    ref.studentId ||
                    ref.id ||
                    ref.uid ||
                    ref.codigo ||
                    '';
                const name =
                    ref.alumno_nombre ||
                    ref.studentName ||
                    ref.nombre ||
                    ref.name ||
                    undefined;
                return { id: String(id || ''), name };
            }
            return { id: '' };
        };

        docs.forEach(doc => {
            // Check if it's a bulk session format (has 'data' property with arrays)
            if (doc.data && (doc.data.presentes || doc.data.ausentes || doc.data.tarde || doc.data.justificacion)) {
                const data = doc.data;

                // Resolve clase_id: try multiple field names
                const rawClaseId = doc.classId || doc.clase_id || '';
                // Resolve clase_nombre: try multiple field names including legacy
                const rawClaseNombre = doc.clase_nombre || doc.className || doc.clase_nombre_legacy
                    || data.className || data.clase_nombre || '';

                const baseInfo = {
                    clase_id: rawClaseId,
                    clase_nombre: rawClaseNombre,
                    fecha: this.normalizeDate(doc.fecha),
                    profesor_id: doc.teacherId || doc.uid || doc.profesor_id,
                    observaciones: data.observacion || doc.observaciones || doc.observacion || '',
                    registrado_por: doc.uid,
                    id: doc.id
                };

                // Map 'presentes'
                (data.presentes || []).forEach((entry: any, index: number) => {
                    const student = resolveStudentRef(entry);
                    if (!student.id) return;
                    expanded.push({
                        ...baseInfo,
                        alumno_id: student.id,
                        alumno_nombre: student.name,
                        estado: 'presente',
                        id: `${doc.id}_${student.id}_presente_${index}`
                    } as Asistencia);
                });

                // Map 'ausentes'
                (data.ausentes || []).forEach((entry: any, index: number) => {
                    const student = resolveStudentRef(entry);
                    if (!student.id) return;
                    expanded.push({
                        ...baseInfo,
                        alumno_id: student.id,
                        alumno_nombre: student.name,
                        estado: 'ausente',
                        id: `${doc.id}_${student.id}_ausente_${index}`
                    } as Asistencia);
                });

                // Map 'tarde' (maps to 'tardanza')
                (data.tarde || []).forEach((entry: any, index: number) => {
                    const student = resolveStudentRef(entry);
                    if (!student.id) return;
                    expanded.push({
                        ...baseInfo,
                        alumno_id: student.id,
                        alumno_nombre: student.name,
                        estado: 'tardanza',
                        id: `${doc.id}_${student.id}_tardanza_${index}`
                    } as Asistencia);
                });

                // Map 'justificacion' (maps to 'justificado')
                (data.justificacion || []).forEach((entry: any, index: number) => {
                    const student = resolveStudentRef(entry);
                    if (!student.id) return;
                    expanded.push({
                        ...baseInfo,
                        alumno_id: student.id,
                        alumno_nombre: student.name,
                        estado: 'justificado',
                        id: `${doc.id}_${student.id}_justificado_${index}`
                    } as Asistencia);
                });
            } else {
                // Individual record format - normalize property names
                expanded.push({
                    ...doc,
                    clase_id: doc.clase_id || doc.classId || '',
                    clase_nombre: doc.clase_nombre || doc.className || '',
                    alumno_id: doc.alumno_id || doc.studentId || '',
                    fecha: this.normalizeDate(doc.fecha)
                });
            }
        });

        return expanded;
    }

    /**
     * Normalizes different date formats (D/M/YYYY, DD/MM/YYYY, YYYY-MM-DD) to ISO YYYY-MM-DD
     */
    private normalizeDate(dateStr: string): string {
        if (!dateStr) return '';
        // If it's already YYYY-MM-DD correctly formatted
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

        const parts = dateStr.split(/[-/]/);
        if (parts.length === 3) {
            // Case YYYY-M-D or YYYY-MM-DD
            if (parts[0].length === 4) {
                return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            }
            // Case D/M/YYYY or DD/MM/YYYY
            if (parts[2].length === 4) {
                return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
        }
        return dateStr;
    }

    async getByDateRange(startDate: string, endDate: string, classId?: string): Promise<Asistencia[]> {
        // Fetch ALL to handle inconsistent date formats (D/M/YYYY vs YYYY-MM-DD)
        // String range queries in Firestore fail when formats are mixed
        const results = await super.getAll();

        const start = this.normalizeDate(startDate);
        const end = this.normalizeDate(endDate);

        const filtered = results.filter(r => {
            const normalizedFecha = this.normalizeDate(r.fecha);

            // Check date range
            const isInRange = normalizedFecha >= start && normalizedFecha <= end;
            if (!isInRange) return false;

            // Check classId if provided
            if (classId) {
                const matchClass = (r.clase_id === classId || (r as any).classId === classId);
                if (!matchClass) return false;
            }

            return true;
        });

        const expanded = this.expandBulkRecords(filtered);

        // Sort locally
        return expanded.sort((a, b) => {
            const dateA = a.fecha;
            const dateB = b.fecha;
            return dateB.localeCompare(dateA);
        });
    }

    async getAbsences(date?: string): Promise<Asistencia[]> {
        if (date) {
            const constraints: QueryConstraint[] = [
                where('fecha', '==', date),
                where('estado', '==', 'ausente')
            ];
            return super.getAll(constraints);
        }
        return this.query('estado', '==', 'ausente');
    }

    async getPending(): Promise<Asistencia[]> {
        return this.query('estado', '==', 'pendiente');
    }

    async deleteByDateRange(startDate: string, endDate: string): Promise<number> {
        const results = await super.getAll();
        const start = this.normalizeDate(startDate);
        const end = this.normalizeDate(endDate);

        const docsToDelete = results.filter(r => {
            const normalizedFecha = this.normalizeDate(r.fecha);
            return normalizedFecha >= start && normalizedFecha <= end;
        });

        const deletePromises = docsToDelete.map(doc => this.delete(doc.id));
        await Promise.all(deletePromises);

        return docsToDelete.length;
    }
}

export const asistenciasService = new AsistenciasServiceClass();
