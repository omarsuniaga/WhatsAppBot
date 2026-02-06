import React, { useState } from 'react';
import {
    X, Upload, FileText, AlertCircle, CheckCircle,
    AlertTriangle, Loader2, Play, Table, Database,
    User, MapPin, Users, Music, Calendar, Clock
} from 'lucide-react';
import {
    clasesService,
    maestrosService,
    salonesService,
    alumnosService
} from '../../services/firestore';

interface BulkImportModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

interface ImportRow {
    raw: Record<string, string>;
    status: 'ok' | 'warning' | 'error';
    messages: string[];
    analysis: {
        claseName: string;
        maestroId?: string;
        maestroName?: string;
        salonId?: string;
        salonName?: string;
        instrument?: string;
        studentIds: string[];
        studentNames: string[];
        day: string;
        startTime: string;
        endTime: string;
        isNewRoom: boolean;
        isNewMaestro: boolean;
        isDuplicate?: boolean;
        duplicateClassId?: string;
        duplicateAction?: 'skip' | 'overwrite' | 'merge' | 'ignore';
        newStudentNames: string[];
        conflicts: any[];
    };
}

const DAYS_MAP: Record<string, string> = {
    'lunes': 'Lunes', 'martes': 'Martes', 'miercoles': 'Miércoles', 'miércoles': 'Miércoles',
    'jueves': 'Jueves', 'viernes': 'Viernes', 'sabado': 'Sábado', 'sábado': 'Sábado',
    'sabados': 'Sábado', 'sábados': 'Sábado', 'domingo': 'Domingo', 'domingos': 'Domingo',
    'mon': 'Lunes', 'tue': 'Martes', 'wed': 'Miércoles', 'thu': 'Jueves', 'fri': 'Viernes',
    'sat': 'Sábado', 'sun': 'Domingo'
};

export const BulkImportModal: React.FC<BulkImportModalProps> = ({ onClose, onSuccess }) => {
    const [step, setStep] = useState<'upload' | 'analyze' | 'applying' | 'success'>('upload');
    const [file, setFile] = useState<File | null>(null);
    const [importData, setImportData] = useState<ImportRow[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) setFile(selectedFile);
    };

    const parseCSV = (text: string): Record<string, string>[] => {
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        if (lines.length < 2) return [];

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        return lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim());
            const obj: Record<string, string> = {};
            headers.forEach((h, i) => {
                obj[h] = values[i] || '';
            });
            return obj;
        });
    };

    const normalizeString = (str: string) =>
        str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    const analyzeData = async () => {
        if (!file) return;
        setIsAnalyzing(true);
        setStep('analyze');

        try {
            const text = await file.text();
            const rawRows = parseCSV(text);

            // Load existing data for matching
            const [maestros, salones, alumnos, existingClases] = await Promise.all([
                maestrosService.getAllMaestros(),
                salonesService.getAllSalones(),
                alumnosService.getAllStudents(),
                clasesService.getAllClases()
            ]);

            // Grouping logic for "Master File" (where one row = one student)
            const groupedClasses: Record<string, { rows: any[], students: string[] }> = {};

            rawRows.forEach(row => {
                const claseName = row.clase || row.name || '';
                const maestro = row.profesor || row.maestro || '';
                const salon = row.salon || '';
                const dia = row.dia || '';
                const hora = row.hora || '';
                const instrument = row['instrumento/fila'] || row.instrumento || '';

                // Unique key for a class session
                const key = `${claseName}|${maestro}|${salon}|${dia}|${hora}|${instrument}`.toLowerCase();

                if (!groupedClasses[key]) {
                    groupedClasses[key] = { rows: [], students: [] };
                }

                groupedClasses[key].rows.push(row);
                if (row.alumnos) {
                    groupedClasses[key].students.push(row.alumnos.replace('*', '').trim());
                }
            });

            const analyzedRows: ImportRow[] = Object.values(groupedClasses).map(group => {
                const row = group.rows[0];
                const messages: string[] = [];
                let status: 'ok' | 'warning' | 'error' = 'ok';

                // Extract fields
                const claseName = row.clase || row.nombre || row.name || '';
                const maestroInput = row.profesor || row.maestro || row.teacher || '';
                const salonInput = row.salon || row.room || row.aula || '';
                const instrument = row['instrumento/fila'] || row.instrumento || row.instrument || '';
                const dayInput = (row.dia || row.day || '').toLowerCase();
                const horaInput = row.hora || '';

                // Parse "3:30 a 6:30" format
                let startTime = row.inicio || '';
                let endTime = row.fin || '';
                if (horaInput.includes(' a ')) {
                    const parts = horaInput.split(' a ').map((p: string) => p.trim());
                    startTime = parts[0];
                    endTime = parts[1];
                    // Add :00 if missing
                    if (startTime && !startTime.includes(':')) startTime += ':00';
                    if (endTime && !endTime.includes(':')) endTime += ':00';
                }

                if (!claseName) {
                    messages.push('Falta el nombre de la clase');
                    status = 'error';
                }

                // Match Maestro
                const normalizedMaestro = normalizeString(maestroInput);
                const maestroMatch = maestros.find(m => {
                    const mNameNorm = normalizeString(m.name);
                    return mNameNorm === normalizedMaestro ||
                        mNameNorm.includes(normalizedMaestro) ||
                        normalizedMaestro.includes(mNameNorm);
                });

                const isNewMaestro = !maestroMatch && !!maestroInput;
                if (isNewMaestro) {
                    messages.push(`Se creará un nuevo maestro: "${maestroInput}"`);
                    if (status !== 'error') status = 'warning';
                }

                // Match Salon
                const normalizedSalon = normalizeString(salonInput);
                const salonMatch = salones.find(s => normalizeString(s.nombre) === normalizedSalon);
                const isNewRoom = !salonMatch && !!salonInput;
                if (isNewRoom) {
                    messages.push(`Se creará un nuevo salón: "${salonInput}"`);
                    if (status !== 'error') status = 'warning';
                }

                // Match Students
                const studentIds: string[] = [];
                const newStudentNames: string[] = [];

                group.students.forEach(name => {
                    const normName = normalizeString(name);
                    const match = alumnos.find(a => {
                        const aNameNorm = normalizeString(a.nombre);
                        const aFullNameNorm = normalizeString(`${a.nombre} ${a.apellido || ''}`);
                        const aReverseFullNameNorm = normalizeString(`${a.apellido || ''} ${a.nombre}`);

                        return aFullNameNorm === normName ||
                            aFullNameNorm.includes(normName) ||
                            normName.includes(aFullNameNorm) ||
                            aNameNorm === normName ||
                            aReverseFullNameNorm === normName;
                    });

                    if (match) {
                        studentIds.push(match.id);
                    } else {
                        newStudentNames.push(name);
                    }
                });

                if (newStudentNames.length > 0) {
                    messages.push(`Se crearán ${newStudentNames.length} nuevos alumnos: ${newStudentNames.slice(0, 3).join(', ')}...`);
                    if (status !== 'error') status = 'warning';
                }

                // Normalize Day
                const dayNorm = normalizeString(dayInput);
                const mappedDay = DAYS_MAP[dayNorm] || (dayNorm.length > 3 ? DAYS_MAP[dayNorm.slice(0, -1)] : '') || '';

                if (!mappedDay && dayInput) {
                    messages.push(`Día "${dayInput}" no reconocido`);
                    status = 'error';
                }

                // Duplicate Detection
                let isDuplicate = false;
                let duplicateClassId = '';
                const existingMatch = existingClases.find(c => {
                    const normExistingName = normalizeString(c.name || c.nombre || '');
                    const normClaseName = normalizeString(claseName);

                    // Simple similarity check
                    const nameMatch = normExistingName === normClaseName || normExistingName.includes(normClaseName) || normClaseName.includes(normExistingName);

                    // Schedule check
                    const scheduleMatch = c.schedule?.slots?.some(s =>
                        s.day === mappedDay &&
                        (s.startTime === startTime || s.endTime === endTime)
                    );

                    return nameMatch && scheduleMatch;
                });

                if (existingMatch) {
                    isDuplicate = true;
                    duplicateClassId = existingMatch.id;
                    messages.push(`Posible duplicado detectado: "${existingMatch.name}".`);
                    if (status !== 'error') status = 'warning';
                }

                return {
                    raw: row,
                    status,
                    messages,
                    analysis: {
                        claseName,
                        maestroId: maestroMatch?.id,
                        maestroName: maestroMatch?.name || maestroInput,
                        salonId: salonMatch?.id,
                        salonName: salonMatch?.nombre || salonInput,
                        instrument,
                        studentIds,
                        studentNames: group.students,
                        day: mappedDay,
                        startTime,
                        endTime,
                        isNewRoom,
                        isNewMaestro,
                        isDuplicate,
                        duplicateClassId,
                        duplicateAction: isDuplicate ? 'merge' : undefined,
                        newStudentNames,
                        conflicts: []
                    }
                };
            });

            setImportData(analyzedRows);
        } catch (err) {
            console.error('Error analyzing CSV:', err);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const applyImport = async () => {
        const itemsToApply = importData.filter(row => row.status !== 'error');
        if (itemsToApply.length === 0) return;

        setStep('applying');
        setProgress({ current: 0, total: itemsToApply.length });

        const newRoomsCache = new Map<string, string>();
        const newMaestrosCache = new Map<string, string>();
        const newAlumnosCache = new Map<string, string>();

        try {
            for (const row of itemsToApply) {
                try {
                    const { analysis } = row;

                    // 0. Handle Duplicates Action
                    if (analysis.isDuplicate && analysis.duplicateAction === 'skip') {
                        setProgress(prev => ({ ...prev, current: prev.current + 1 }));
                        continue;
                    }

                    if (analysis.isDuplicate && analysis.duplicateAction === 'overwrite' && analysis.duplicateClassId) {
                        await clasesService.delete(analysis.duplicateClassId);
                    }

                    if (analysis.isDuplicate && analysis.duplicateAction === 'merge' && analysis.duplicateClassId) {
                        const existing = await clasesService.getById(analysis.duplicateClassId);
                        if (existing) {
                            // Merge students logic
                            const currentStudentIds = existing.studentIds || [];
                            const mergedIds = Array.from(new Set([...currentStudentIds, ...analysis.studentIds]));

                            // Handle new students that need creation
                            if (analysis.newStudentNames.length > 0) {
                                for (const sName of analysis.newStudentNames) {
                                    if (newAlumnosCache.has(sName)) {
                                        mergedIds.push(newAlumnosCache.get(sName)!);
                                    } else {
                                        const newId = await alumnosService.create({
                                            nombre: sName.split(' ')[0] || sName,
                                            apellido: sName.split(' ').slice(1).join(' ') || '',
                                            activo: true
                                        } as any);
                                        newAlumnosCache.set(sName, newId!);
                                        mergedIds.push(newId!);
                                    }
                                }
                            }

                            await clasesService.update(analysis.duplicateClassId, {
                                studentIds: mergedIds
                            } as any);

                            setProgress(prev => ({ ...prev, current: prev.current + 1 }));
                            continue;
                        }
                    }

                    // 1. Create room if it doesn't exist
                    let roomId = analysis.salonId;
                    if (analysis.isNewRoom && analysis.salonName) {
                        const cachedId = newRoomsCache.get(analysis.salonName);
                        if (cachedId) {
                            roomId = cachedId;
                        } else {
                            roomId = await salonesService.create({
                                nombre: analysis.salonName,
                                capacidad: 20,
                                activo: true
                            } as any);
                            newRoomsCache.set(analysis.salonName, roomId!);
                        }
                    }

                    // 2. Create Maestro if it doesn't exist
                    let maestroId = analysis.maestroId;
                    if (analysis.isNewMaestro && analysis.maestroName) {
                        if (newMaestrosCache.has(analysis.maestroName)) {
                            maestroId = newMaestrosCache.get(analysis.maestroName);
                        } else {
                            maestroId = await maestrosService.create({
                                name: analysis.maestroName,
                                active: true
                            } as any);
                            newMaestrosCache.set(analysis.maestroName, maestroId!);
                        }
                    }

                    // 3. Create Alumnos if they don't exist
                    const finalStudentIds = [...analysis.studentIds];
                    if (analysis.newStudentNames.length > 0) {
                        for (const sName of analysis.newStudentNames) {
                            if (newAlumnosCache.has(sName)) {
                                finalStudentIds.push(newAlumnosCache.get(sName)!);
                            } else {
                                const newId = await alumnosService.create({
                                    nombre: sName.split(' ')[0] || sName,
                                    apellido: sName.split(' ').slice(1).join(' ') || '',
                                    activo: true
                                } as any);
                                newAlumnosCache.set(sName, newId!);
                                finalStudentIds.push(newId!);
                            }
                        }
                    }

                    // 4. Create Class
                    await clasesService.create({
                        name: analysis.claseName,
                        instrument: analysis.instrument,
                        teacherId: maestroId || '',
                        roomId: roomId || '',
                        salon_nombre: analysis.salonName || '',
                        studentIds: finalStudentIds,
                        schedule: {
                            slots: analysis.day && analysis.startTime && analysis.endTime ? [{
                                day: analysis.day,
                                startTime: analysis.startTime,
                                endTime: analysis.endTime
                            }] : []
                        },
                        status: 'active'
                    });

                    setProgress(prev => ({ ...prev, current: prev.current + 1 }));
                } catch (err) {
                    console.error('Error importing row:', err);
                }
            }

            setStep('success');
        } catch (err) {
            console.error('Apply import error:', err);
            alert('Error al aplicar la importación');
        }
    };

    const updateRowAction = (idx: number, action: 'skip' | 'overwrite' | 'merge' | 'ignore') => {
        const newData = [...importData];
        newData[idx].analysis.duplicateAction = action;
        setImportData(newData);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border dark:border-gray-700">
                {/* Header */}
                <div className="p-6 border-b dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center text-white">
                            <Database className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Carga Masiva (Borrador)</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Importa clases, salones y horarios desde CSV</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full">
                        <X className="w-6 h-6 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {step === 'upload' && (
                        <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl bg-gray-50 dark:bg-gray-900/30">
                            <Upload className="w-16 h-16 text-indigo-500 mb-4 opacity-50" />
                            <h4 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Selecciona tu archivo CSV</h4>
                            <p className="text-sm text-gray-500 mb-6 text-center max-w-xs">
                                Formato: Clase, Maestro, Instrumento, Dia, Inicio, Fin, Salon, Alumnos
                            </p>
                            <label className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl cursor-pointer font-medium transition-all shadow-lg shadow-indigo-500/20 active:scale-95">
                                Explorar Archivos
                                <input type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
                            </label>
                            {file && (
                                <div className="mt-4 flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-medium">
                                    <FileText className="w-4 h-4" />
                                    {file.name}
                                </div>
                            )}
                        </div>
                    )}

                    {step === 'analyze' && (
                        <div className="space-y-4">
                            {isAnalyzing ? (
                                <div className="flex flex-col items-center justify-center py-20">
                                    <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
                                    <p className="text-gray-600 dark:text-gray-400 font-medium font-medium">Analizando datos y detectando conflictos...</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto rounded-xl border dark:border-gray-700">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 uppercase text-[10px] font-bold tracking-wider">
                                            <tr>
                                                <th className="px-4 py-3">Estado</th>
                                                <th className="px-4 py-3">Clase / Instrumento</th>
                                                <th className="px-4 py-3">Maestro</th>
                                                <th className="px-4 py-3">Salón</th>
                                                <th className="px-4 py-3">Horario</th>
                                                <th className="px-4 py-3">Alumnos</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y dark:divide-gray-700">
                                            {importData.map((row, idx) => (
                                                <tr key={idx} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                                                    <td className="px-4 py-3">
                                                        {row.status === 'ok' && <CheckCircle className="w-5 h-5 text-emerald-500" />}
                                                        {row.status === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
                                                        {row.status === 'error' && <AlertCircle className="w-5 h-5 text-rose-500" />}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-bold text-gray-800 dark:text-gray-200">{row.analysis.claseName}</div>
                                                        <div className="text-[10px] text-gray-500 flex items-center gap-1">
                                                            <Music className="w-3 h-3" />
                                                            {row.analysis.instrument}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-1.5 font-medium">
                                                            <User className="w-3.5 h-3.5 text-gray-400" />
                                                            {row.analysis.maestroName}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-1.5 font-medium">
                                                            <MapPin className={`w-3.5 h-3.5 ${row.analysis.isNewRoom ? 'text-amber-500' : 'text-gray-400'}`} />
                                                            <span className="text-gray-700 dark:text-gray-300">{row.analysis.salonName}</span>
                                                        </div>
                                                        {row.analysis.isNewRoom && <span className="text-[9px] text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded-full font-bold">NUEVO</span>}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col gap-0.5 whitespace-nowrap">
                                                            <div className="flex items-center gap-1 font-bold text-gray-700 dark:text-gray-300">
                                                                <Calendar className="w-3 h-3" />
                                                                {row.analysis.day || 'Sin día'}
                                                            </div>
                                                            <div className="text-[10px] text-gray-500 flex items-center gap-1">
                                                                <Clock className="w-3 h-3" />
                                                                {row.analysis.startTime}-{row.analysis.endTime}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-1 text-xs">
                                                            <Users className="w-3.5 h-3.5 text-gray-400" />
                                                            {row.analysis.studentIds.length} / {row.analysis.studentNames.length}
                                                        </div>
                                                        {row.analysis.isDuplicate && (
                                                            <div className="mt-2 space-y-1">
                                                                <div className="text-[9px] font-bold text-amber-600 uppercase">Duplicado</div>
                                                                <select
                                                                    value={row.analysis.duplicateAction}
                                                                    onChange={(e) => updateRowAction(idx, e.target.value as any)}
                                                                    className="text-[10px] bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 rounded px-1 py-0.5 text-amber-800 dark:text-amber-200"
                                                                >
                                                                    <option value="merge">Fusionar Alumnos</option>
                                                                    <option value="overwrite">Sobrescribir Clase</option>
                                                                    <option value="ignore">Crear Nueva</option>
                                                                    <option value="skip">Omitir</option>
                                                                </select>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Messages / Warnings */}
                            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl space-y-2">
                                <h5 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Alertas y Sugerencias</h5>
                                <div className="max-h-32 overflow-y-auto space-y-1 pr-2">
                                    {importData.flatMap(r => r.messages).slice(0, 50).map((msg, i) => (
                                        <div key={i} className="text-xs flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                            <div className="w-1 h-1 rounded-full bg-indigo-500" />
                                            {msg}
                                        </div>
                                    ))}
                                    {importData.flatMap(r => r.messages).length === 0 && (
                                        <div className="text-xs text-gray-400 italic">No se detectaron problemas</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'applying' && (
                        <div className="flex flex-col items-center justify-center py-20 px-12">
                            <div className="w-full max-w-md bg-gray-100 dark:bg-gray-700 h-3 rounded-full overflow-hidden mb-6">
                                <div
                                    className="bg-indigo-600 h-full transition-all duration-300"
                                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                />
                            </div>
                            <h4 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">Procesando Importación...</h4>
                            <p className="text-gray-500 dark:text-gray-400">
                                {progress.current} de {progress.total} clases procesadas
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-between">
                    <div className="text-sm font-medium text-gray-500">
                        {step === 'analyze' && (
                            <div className="flex gap-4">
                                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle className="w-4 h-4" /> {importData.filter(r => r.status === 'ok').length} Listos
                                </span>
                                <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                                    <AlertTriangle className="w-4 h-4" /> {importData.filter(r => r.status === 'warning').length} Con avisos
                                </span>
                                <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                                    <AlertCircle className="w-4 h-4" /> {importData.filter(r => r.status === 'error').length} Errores
                                </span>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors font-medium"
                        >
                            Cancelar
                        </button>
                        {step === 'upload' && (
                            <button
                                onClick={analyzeData}
                                disabled={!file}
                                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20 transition-all active:scale-95 font-medium"
                            >
                                <Table className="w-4 h-4" />
                                Analizar Archivo
                            </button>
                        )}
                        {step === 'analyze' && (
                            <button
                                onClick={applyImport}
                                disabled={isAnalyzing || importData.filter(r => r.status !== 'error').length === 0}
                                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20 transition-all active:scale-95 font-medium"
                            >
                                <Play className="w-4 h-4" />
                                Aplicar Cambios
                            </button>
                        )}
                    </div>
                </div>
                {step === 'success' && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6 animate-in zoom-in-50 duration-500">
                            <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                            ¡Importación Completada!
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 max-w-xs mb-8">
                            Se han procesado {importData.length} registros exitosamente en Firestore.
                        </p>
                        <button
                            onClick={onSuccess}
                            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                        >
                            Volver al Listado
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
