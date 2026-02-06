/**
 * SchedulePage - Dynamic Weekly Schedule Management
 * Features: Multi-room view, conflict detection, visual time blocks
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Calendar, ChevronLeft, ChevronRight, RefreshCw,
    Filter, User, MapPin, Users, Clock, X, AlertTriangle,
    Layers, Grid3X3, List, Edit2, Trash2
} from 'lucide-react';
import {
    Schedule, ClassGroup, Conflict, ViewMode,
    DAYS, DAYS_FULL, WORKING_DAYS,
    START_HOUR, END_HOUR,
    PROGRAM_COLORS, timeToMinutes, getBlockPosition, getBlockHeight
} from '../components/schedule/types';
import {
    clasesService,
    maestrosService,
    salonesService
} from '../services/firestore';

// Generate time slots for grid display
const TIME_SLOTS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) =>
    `${String(START_HOUR + i).padStart(2, '0')}:00`
);



export const SchedulePage = () => {
    const navigate = useNavigate();
    const [classes, setClasses] = useState<ClassGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>('week');
    const [selectedDay, setSelectedDay] = useState(new Date().getDay() || 1);
    const [selectedClass, setSelectedClass] = useState<ClassGroup | null>(null);
    const [filterProgram, setFilterProgram] = useState('');
    const [filterRoom, setFilterRoom] = useState('');

    // Modal state
    const [showConflictsModal, setShowConflictsModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);


    useEffect(() => {
        loadClasses();
    }, []);

    const loadClasses = async () => {
        setLoading(true);
        try {
            const [clasesData, maestrosData, salonesData] = await Promise.all([
                clasesService.getAllClases(),
                maestrosService.getAllMaestros(),
                salonesService.getAllSalones()
            ]);

            // Map Firestore data to Schedule format
            const mappedClasses: ClassGroup[] = clasesData.map(clase => {
                // Feature: Smart time normalization to fix "5:00" -> "17:00" issues
                const normalizeTime = (time: string): string => {
                    if (!time) return '00:00';
                    const parts = time.split(':');
                    let hours = parseInt(parts[0]);
                    const minutes = parts[1] || '00';

                    // Heuristic: If hour is less than START_HOUR (8), assume it's PM
                    // unless it's explicitly very early morning which is rare in this context.
                    // This fixes user entry errors like "5:00" meaning "5:00 PM"
                    // Also ensures "HH:mm" format (padding)
                    if (hours < 8) {
                        hours += 12;
                    }

                    return `${String(hours).padStart(2, '0')}:${minutes}`;
                };

                // Get teacher names
                const teacherId = clase.teacherId || clase.profesor_id;
                const teacherObj = maestrosData.find(m => m.id === teacherId);
                const teacherNames = teacherObj ? [`${teacherObj.name}`] : [];

                // Get room name
                const roomObj = salonesData.find(s => s.id === clase.roomId || s.id === clase.salon_id);
                const roomName = roomObj?.nombre || clase.salon_nombre || 'Sin salón';

                // Map schedules
                let schedules: Schedule[] = [];
                if (clase.schedule?.slots) {
                    schedules = clase.schedule.slots.map(slot => ({
                        dayOfWeek: DAYS_FULL.indexOf(slot.day),
                        startTime: normalizeTime(slot.startTime),
                        endTime: normalizeTime(slot.endTime)
                    })).filter(s => s.dayOfWeek !== -1);
                } else if (clase.horarios) {
                    schedules = clase.horarios.map(h => ({
                        dayOfWeek: h.dia,
                        startTime: normalizeTime(h.hora_inicio),
                        endTime: normalizeTime(h.hora_fin)
                    }));
                }

                // If no schedules found and it has day/hours fields (Legacy fallback 2)
                if (schedules.length === 0 && clase.hora_inicio && clase.hora_fin) {
                    const dayIdx = clase.dia ? DAYS_FULL.indexOf(clase.dia) : -1;
                    if (dayIdx !== -1) {
                        schedules.push({
                            dayOfWeek: dayIdx,
                            startTime: normalizeTime(clase.hora_inicio),
                            endTime: normalizeTime(clase.hora_fin)
                        });
                    }
                }

                // Infer program for colors
                let program = 'orquesta';
                const name = (clase.name || clase.nombre || '').toLowerCase();
                if (name.includes('coro')) program = 'coro';
                if (name.includes('iniciacion') || name.includes('preparatorio')) program = 'iniciacion';
                if (name.includes('teoria') || name.includes('lenguaje')) program = 'preparatoria';

                return {
                    id: clase.id,
                    name: clase.name || clase.nombre || 'Sin nombre',
                    program,
                    level: 'Nivel 1', // Default or infer from name
                    teacherIds: teacherId ? [teacherId] : [],
                    teacherNames,
                    room: roomName,
                    schedules,
                    enrolledCount: (clase.studentIds || clase.alumno_ids || []).length,
                    capacity: roomObj?.capacidad || 20
                };
            });

            setClasses(mappedClasses);
        } catch (err) {
            console.error('Error loading data from Firestore:', err);
        } finally {
            setLoading(false);
        }
    };

    // Filter classes based on current filters
    const filteredClasses = useMemo(() => {
        return classes.filter(c => {
            if (filterProgram && c.program !== filterProgram) return false;
            if (filterRoom && c.room !== filterRoom) return false;
            return true;
        });
    }, [classes, filterProgram, filterRoom]);

    // Get classes for a specific day
    const getClassesForDay = (day: number) => {
        return filteredClasses.filter((c: ClassGroup) =>
            c.schedules.some((s: Schedule) => s.dayOfWeek === day)
        ).sort((a: ClassGroup, b: ClassGroup) => {
            const aTime = a.schedules.find((s: Schedule) => s.dayOfWeek === day)?.startTime || '';
            const bTime = b.schedules.find((s: Schedule) => s.dayOfWeek === day)?.startTime || '';
            return aTime.localeCompare(bTime);
        });
    };

    // Get classes for a specific room on a specific day
    const getClassesForRoomAndDay = (roomName: string, day: number) => {
        return filteredClasses.filter(c =>
            c.room === roomName && c.schedules.some(s => s.dayOfWeek === day)
        );
    };

    // Detect conflicts (overlapping classes in same room or same teacher)
    const conflicts = useMemo((): Conflict[] => {
        const result: Conflict[] = [];

        for (let day = 1; day <= 6; day++) {
            const dayClasses = classes.filter((c: ClassGroup) => c.schedules.some((s: Schedule) => s.dayOfWeek === day));

            for (let i = 0; i < dayClasses.length; i++) {
                for (let j = i + 1; j < dayClasses.length; j++) {
                    const classA = dayClasses[i];
                    const classB = dayClasses[j];
                    const schedA = classA.schedules.find((s: Schedule) => s.dayOfWeek === day)!;
                    const schedB = classB.schedules.find((s: Schedule) => s.dayOfWeek === day)!;

                    const startA = timeToMinutes(schedA.startTime);
                    const endA = timeToMinutes(schedA.endTime);
                    const startB = timeToMinutes(schedB.startTime);
                    const endB = timeToMinutes(schedB.endTime);

                    const overlaps = startA < endB && startB < endA;

                    if (overlaps) {
                        // Check room conflict
                        if (classA.room && classA.room === classB.room) {
                            result.push({
                                type: 'room',
                                classes: [classA.name, classB.name],
                                day,
                                time: schedA.startTime,
                                resource: classA.room
                            });
                        }
                        // Check teacher conflict
                        const sharedTeachers = classA.teacherIds.filter(t => classB.teacherIds.includes(t));
                        if (sharedTeachers.length > 0) {
                            const teacherName = classA.teacherNames?.[classA.teacherIds.indexOf(sharedTeachers[0])] || 'Profesor';
                            result.push({
                                type: 'teacher',
                                classes: [classA.name, classB.name],
                                day,
                                time: schedA.startTime,
                                resource: teacherName
                            });
                        }
                    }
                }
            }
        }
        return result;
    }, [classes]);

    const handleDeleteClass = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar esta clase por completo?')) return;
        setIsDeleting(true);
        try {
            await clasesService.delete(id);
            await loadClasses();
            setSelectedClass(null);
        } catch (err) {
            console.error('Error deleting class from schedule:', err);
            alert('Error al eliminar la clase');
        } finally {
            setIsDeleting(false);
        }
    };

    // Get unique rooms from classes
    const uniqueRooms = useMemo(() => {
        const roomNames = new Set(classes.map(c => c.room).filter(Boolean) as string[]);
        return Array.from(roomNames);
    }, [classes]);

    // Layout algorithm for handling overlapping events
    const calculateLayout = (classesForDay: ClassGroup[], day: number) => {
        // 1. Map to simplified events with start/end in minutes
        const events = classesForDay.map(c => {
            const schedule = c.schedules.find(s => s.dayOfWeek === day);
            if (!schedule) return null;
            return {
                id: c.id,
                start: timeToMinutes(schedule.startTime),
                end: timeToMinutes(schedule.endTime),
                obj: c
            };
        }).filter(e => e !== null) as { id: string, start: number, end: number, obj: ClassGroup }[];

        if (events.length === 0) return {};

        // 2. Sort by start time
        events.sort((a, b) => a.start - b.start);

        // 3. Group overlapping events
        const columns: { id: string, start: number, end: number }[][] = [];

        events.forEach(event => {
            let placed = false;
            // Try to place in an existing column
            for (const column of columns) {
                const lastInColumn = column[column.length - 1];
                if (lastInColumn.end <= event.start) {
                    column.push(event);
                    placed = true;
                    break;
                }
            }
            // If not placed, start a new column
            if (!placed) {
                columns.push([event]);
            }
        });

        // 4. Calculate positions
        const layout: Record<string, { left: string, width: string }> = {};

        // This is a simplified columnation. 
        // A better approach for visual overlap is "packing".
        // But for now, we'll check distinct overlapping groups to optimize width.
        // Actually, the simple "columns" approach above handles non-overlapping items in the same column nicely.
        // We just need to know which events *concurrently* overlap to split width.

        // Revised approach: "Expand" columns.
        // If we have 2 columns, but an event in Col 1 has no overlap with Col 2 at its time, it can expand?
        // For simplicity/robustness given the request: Just split width by max concurrent overlaps.

        // Re-calculate max concurrent overlaps for each event
        events.forEach(event => {
            // Find all events that overlap with this one
            const concurrent = events.filter(e =>
                (e.start < event.end && e.end > event.start)
            );

            // Assign index based on start time sort order among concurrent
            concurrent.sort((a, b) => a.start - b.start || (a.end - a.start) - (b.end - b.start));
            const index = concurrent.findIndex(e => e.id === event.id);
            const count = concurrent.length;

            layout[event.id] = {
                left: `${(index / count) * 100}%`,
                width: `${100 / count}%`
            };
        });

        return layout;
    };

    // Time block component for visual grid
    const TimeBlock = ({ classGroup, schedule, onClick, layoutStyle }: {
        classGroup: ClassGroup;
        schedule: Schedule;
        onClick: () => void;
        layoutStyle?: { left: string, width: string };
    }) => {
        const colors = PROGRAM_COLORS[classGroup.program] || PROGRAM_COLORS.orquesta;
        const top = getBlockPosition(schedule.startTime);
        const height = getBlockHeight(schedule.startTime, schedule.endTime);

        // Default style if no layout provided
        const style: React.CSSProperties = {
            top: `${top}px`,
            height: `${height}px`,
            minHeight: '30px',
            left: layoutStyle?.left || '4px',
            right: layoutStyle ? 'auto' : '4px', // careful with right
            width: layoutStyle?.width || 'calc(100% - 8px)',
            position: 'absolute',
            zIndex: 10
        };

        return (
            <div
                className={`absolute ${colors.bg} ${colors.border} ${colors.text} border-l-4 rounded px-1 py-1 cursor-pointer hover:shadow-lg transition-shadow overflow-hidden group hover:z-50`}
                style={style}
                onClick={onClick}
                title={`${classGroup.name} (${schedule.startTime} - ${schedule.endTime})`}
            >
                <div className="font-medium text-xs leading-tight truncate group-hover:whitespace-normal">
                    {classGroup.name}
                </div>
                {height > 35 && (
                    <div className="text-[10px] opacity-75 leading-tight">
                        {schedule.startTime}
                    </div>
                )}
            </div>
        );
    };

    // Class detail modal
    const ClassDetailModal = () => {
        if (!selectedClass) return null;
        const colors = PROGRAM_COLORS[selectedClass.program] || PROGRAM_COLORS.orquesta;

        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedClass(null)}>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
                    <div className={`${colors.bg} ${colors.text} px-6 py-4 rounded-t-xl border-b ${colors.border}`}>
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-lg font-bold">{selectedClass.name}</h3>
                                <p className="text-sm opacity-75">{selectedClass.level}</p>
                            </div>
                            <button onClick={() => setSelectedClass(null)} className="p-1 hover:bg-black/10 rounded">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="flex items-center gap-3">
                            <User className="w-5 h-5 text-gray-400" />
                            <div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">Profesores</div>
                                <div className="font-medium text-gray-800 dark:text-gray-200">
                                    {selectedClass.teacherNames?.join(', ') || 'Sin asignar'}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <MapPin className="w-5 h-5 text-gray-400" />
                            <div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">Salón</div>
                                <div className="font-medium text-gray-800 dark:text-gray-200">
                                    {selectedClass.room || 'Sin asignar'}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Users className="w-5 h-5 text-gray-400" />
                            <div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">Estudiantes</div>
                                <div className="font-medium text-gray-800 dark:text-gray-200">
                                    {selectedClass.enrolledCount} / {selectedClass.capacity || '∞'}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Clock className="w-5 h-5 text-gray-400" />
                            <div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">Horarios</div>
                                <div className="font-medium text-gray-800 dark:text-gray-200">
                                    {selectedClass.schedules.map((s, i) => (
                                        <div key={i}>{DAYS_FULL[s.dayOfWeek]} {s.startTime} - {s.endTime}</div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="pt-4 flex gap-2">
                            <button
                                onClick={() => { setSelectedClass(null); navigate(`/classes?edit=${selectedClass.id}`); }}
                                className="flex-1 px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 rounded-lg font-medium transition-colors text-sm flex items-center justify-center gap-2"
                            >
                                <Edit2 className="w-4 h-4" />
                                Gestionar
                            </button>
                            <button
                                onClick={() => handleDeleteClass(selectedClass.id)}
                                disabled={isDeleting}
                                className="px-4 py-2 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg font-medium transition-colors text-sm flex items-center justify-center gap-2"
                            >
                                {isDeleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Conflicts List Modal
    const ConflictsModal = () => {
        if (!showConflictsModal) return null;

        return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowConflictsModal(false)}>
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full border dark:border-gray-700 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                    <div className="px-6 py-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50 rounded-t-2xl">
                        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                            <AlertTriangle className="w-5 h-5" />
                            <h3 className="text-lg font-bold">Conflictos Detectados</h3>
                        </div>
                        <button onClick={() => setShowConflictsModal(false)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-6 overflow-y-auto space-y-4">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Se han detectado cruces de horarios por salón o por profesor. Revisa los siguientes casos para resolverlos:
                        </p>

                        <div className="space-y-3">
                            {conflicts.map((c, i) => (
                                <div key={i} className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/50 rounded-xl">
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="space-y-1">
                                            <div className="text-sm font-bold text-gray-800 dark:text-gray-200">
                                                {c.classes.join(' ↔ ')}
                                            </div>
                                            <div className="text-xs text-red-600 dark:text-red-400 flex items-center gap-3">
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {DAYS[c.day]}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {c.time}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    {c.type === 'room' ? <MapPin className="w-3 h-3" /> : <User className="w-3 h-3" />}
                                                    {c.resource}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 shrink-0">
                                            <button
                                                onClick={() => {
                                                    const target = classes.find(cl => cl.name === c.classes[0]);
                                                    if (target) { setSelectedClass(target); setShowConflictsModal(false); }
                                                }}
                                                className="px-3 py-1 bg-white dark:bg-gray-800 border dark:border-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                                            >
                                                Resolver
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="p-4 border-t dark:border-gray-700 flex justify-end">
                        <button
                            onClick={() => setShowConflictsModal(false)}
                            className="px-6 py-2 bg-gray-800 dark:bg-gray-700 text-white rounded-xl font-medium hover:bg-gray-900 transition-all shadow-lg shadow-gray-900/20"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <Calendar className="w-7 h-7 text-orange-500" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                                Horarios
                            </h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Gestión de horarios semanales • {filteredClasses.length} clases
                            </p>
                        </div>
                    </div>

                    {/* View Mode Toggle */}
                    <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                        {([
                            { mode: 'week' as ViewMode, label: 'Semana', icon: Grid3X3 },
                            { mode: 'rooms' as ViewMode, label: 'Salones', icon: Layers },
                            { mode: 'day' as ViewMode, label: 'Día', icon: Calendar },
                            { mode: 'list' as ViewMode, label: 'Lista', icon: List },
                        ]).map(({ mode, label, icon: Icon }) => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === mode
                                    ? 'bg-white dark:bg-gray-700 text-orange-600 dark:text-orange-400 shadow-sm'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                                    }`}
                            >
                                <Icon className="w-4 h-4" />
                                <span className="hidden sm:inline">{label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Conflicts Warning */}
                {conflicts.length > 0 && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-bold">
                                <AlertTriangle className="w-5 h-5" />
                                {conflicts.length} conflicto{conflicts.length > 1 ? 's' : ''} detectado{conflicts.length > 1 ? 's' : ''}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowConflictsModal(true)}
                                    className="px-4 py-2 bg-white dark:bg-gray-800 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 text-sm font-semibold rounded-lg hover:bg-red-50 dark:hover:bg-red-900/40 transition-colors"
                                >
                                    Ver Detalles
                                </button>
                                <button
                                    onClick={() => navigate('/schedule/conflicts')}
                                    className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                                >
                                    Resolver Automáticamente →
                                </button>
                            </div>
                        </div>
                        <div className="mt-3 space-y-1 text-sm text-red-600 dark:text-red-300 opacity-80">
                            {conflicts.slice(0, 3).map((c, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                                    {DAYS[c.day]} {c.time}: {c.classes.join(' y ')} ({c.type === 'room' ? `Salón: ${c.resource}` : `Profesor: ${c.resource}`})
                                </div>
                            ))}
                            {conflicts.length > 3 && <div className="pl-3.5 italic">... y {conflicts.length - 3} más</div>}
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 mb-6">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-gray-500" />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filtros:</span>
                        </div>
                        <select
                            value={filterProgram}
                            onChange={(e) => setFilterProgram(e.target.value)}
                            className="px-3 py-1.5 text-sm border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                        >
                            <option value="">Todos los programas</option>
                            <option value="orquesta">Orquesta</option>
                            <option value="coro">Coro</option>
                            <option value="iniciacion">Iniciación</option>
                            <option value="preparatoria">Preparatoria</option>
                        </select>
                        <select
                            value={filterRoom}
                            onChange={(e) => setFilterRoom(e.target.value)}
                            className="px-3 py-1.5 text-sm border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                        >
                            <option value="">Todos los salones</option>
                            {uniqueRooms.map(room => (
                                <option key={room} value={room}>{room}</option>
                            ))}
                        </select>

                        <button
                            onClick={loadClasses}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title="Recargar"
                        >
                            <RefreshCw className="w-4 h-4 text-gray-500" />
                        </button>

                        {/* Legend */}
                        <div className="flex-1" />
                        <div className="flex flex-wrap gap-2 text-xs">
                            {Object.entries(PROGRAM_COLORS).map(([key, colors]) => (
                                <span key={key} className={`px-2 py-1 rounded ${colors.bg} ${colors.text} capitalize`}>
                                    {key}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Schedule Content */}
                {loading ? (
                    <div className="flex items-center justify-center h-48">
                        <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
                    </div>
                ) : viewMode === 'week' ? (
                    /* Week View - Visual Grid */
                    <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 overflow-hidden">
                        <div className="overflow-x-auto">
                            <div className="min-w-[900px]">
                                {/* Header */}
                                <div className="grid grid-cols-[80px_repeat(6,1fr)] bg-gray-50 dark:bg-gray-900/50 border-b dark:border-gray-700">
                                    <div className="px-2 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border-r dark:border-gray-700">
                                        Hora
                                    </div>
                                    {WORKING_DAYS.map(day => (
                                        <div key={day} className="px-2 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border-r dark:border-gray-700 last:border-r-0">
                                            {DAYS_FULL[day]}
                                        </div>
                                    ))}
                                </div>
                                {/* Time Grid */}
                                <div className="grid grid-cols-[80px_repeat(6,1fr)]">
                                    {/* Time column */}
                                    <div className="border-r dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                                        {TIME_SLOTS.map(time => (
                                            <div key={time} className="h-[60px] px-2 py-1 text-xs text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
                                                {time}
                                            </div>
                                        ))}
                                    </div>
                                    {/* Day columns */}
                                    {WORKING_DAYS.map(day => {
                                        const classesForDay = getClassesForDay(day);
                                        const layout = calculateLayout(classesForDay, day);

                                        return (
                                            <div key={day} className="relative border-r dark:border-gray-700 last:border-r-0">
                                                {/* Hour lines */}
                                                {TIME_SLOTS.map(time => (
                                                    <div key={time} className="h-[60px] border-b dark:border-gray-700" />
                                                ))}
                                                {/* Class blocks */}
                                                {classesForDay.map(classGroup => {
                                                    const schedule = classGroup.schedules.find(s => s.dayOfWeek === day);
                                                    if (!schedule) return null;
                                                    return (
                                                        <TimeBlock
                                                            key={`${classGroup.id}-${day}`}
                                                            classGroup={classGroup}
                                                            schedule={schedule}
                                                            onClick={() => setSelectedClass(classGroup)}
                                                            layoutStyle={layout[classGroup.id]}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : viewMode === 'rooms' ? (
                    /* Rooms View - Horizontal by room */
                    <div className="space-y-4">
                        {/* Day selector for rooms view */}
                        <div className="flex items-center justify-center gap-4 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-3">
                            <button
                                onClick={() => setSelectedDay(d => d <= 1 ? 6 : d - 1)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 min-w-[150px] text-center">
                                {DAYS_FULL[selectedDay]}
                            </h3>
                            <button
                                onClick={() => setSelectedDay(d => d >= 6 ? 1 : d + 1)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Rooms grid */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 overflow-hidden">
                            <div className="overflow-x-auto">
                                <div className="min-w-[800px]">
                                    {/* Time header */}
                                    <div className="flex bg-gray-50 dark:bg-gray-900/50 border-b dark:border-gray-700">
                                        <div className="w-32 shrink-0 px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border-r dark:border-gray-700">
                                            Salón
                                        </div>
                                        <div className="flex-1 flex">
                                            {TIME_SLOTS.map(time => (
                                                <div key={time} className="flex-1 min-w-[60px] px-1 py-2 text-xs text-center text-gray-500 dark:text-gray-400 border-r dark:border-gray-700 last:border-r-0">
                                                    {time.split(':')[0]}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    {/* Room rows */}
                                    {uniqueRooms.map(roomName => {
                                        const roomClasses = getClassesForRoomAndDay(roomName, selectedDay);
                                        return (
                                            <div key={roomName} className="flex border-b dark:border-gray-700 last:border-b-0">
                                                <div className="w-32 shrink-0 px-3 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 border-r dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 flex items-center gap-2">
                                                    <MapPin className="w-4 h-4 text-gray-400" />
                                                    {roomName}
                                                </div>
                                                <div className="flex-1 relative h-16">
                                                    {/* Hour divisions */}
                                                    <div className="absolute inset-0 flex">
                                                        {TIME_SLOTS.map(time => (
                                                            <div key={time} className="flex-1 min-w-[60px] border-r dark:border-gray-700 last:border-r-0" />
                                                        ))}
                                                    </div>
                                                    {/* Class blocks */}
                                                    {roomClasses.map(classGroup => {
                                                        const schedule = classGroup.schedules.find(s => s.dayOfWeek === selectedDay);
                                                        if (!schedule) return null;
                                                        const startMinutes = timeToMinutes(schedule.startTime) - START_HOUR * 60;
                                                        const duration = timeToMinutes(schedule.endTime) - timeToMinutes(schedule.startTime);
                                                        const totalMinutes = (END_HOUR - START_HOUR) * 60;
                                                        const left = (startMinutes / totalMinutes) * 100;
                                                        const width = (duration / totalMinutes) * 100;
                                                        const colors = PROGRAM_COLORS[classGroup.program] || PROGRAM_COLORS.orquesta;

                                                        return (
                                                            <div
                                                                key={classGroup.id}
                                                                className={`absolute top-1 bottom-1 ${colors.bg} ${colors.border} ${colors.text} border-l-4 rounded-r-lg px-2 py-1 cursor-pointer hover:shadow-lg transition-shadow overflow-hidden`}
                                                                style={{ left: `${left}%`, width: `${width}%` }}
                                                                onClick={() => setSelectedClass(classGroup)}
                                                            >
                                                                <div className="font-medium text-xs truncate">{classGroup.name}</div>
                                                                <div className="text-[10px] opacity-75">{schedule.startTime}-{schedule.endTime}</div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {uniqueRooms.length === 0 && (
                                        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                                            No hay salones asignados
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : viewMode === 'day' ? (
                    /* Day View */
                    <div className="space-y-4">
                        {/* Day Selector */}
                        <div className="flex items-center justify-center gap-4 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-3">
                            <button
                                onClick={() => setSelectedDay(d => d <= 1 ? 6 : d - 1)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 min-w-[150px] text-center">
                                {DAYS_FULL[selectedDay]}
                            </h3>
                            <button
                                onClick={() => setSelectedDay(d => d >= 6 ? 1 : d + 1)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Day Classes */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 divide-y dark:divide-gray-700">
                            {getClassesForDay(selectedDay).length > 0 ? (
                                getClassesForDay(selectedDay).map(classGroup => {
                                    const schedule = classGroup.schedules.find(s => s.dayOfWeek === selectedDay);
                                    const colors = PROGRAM_COLORS[classGroup.program] || PROGRAM_COLORS.orquesta;
                                    return (
                                        <div
                                            key={classGroup.id}
                                            className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                                            onClick={() => setSelectedClass(classGroup)}
                                        >
                                            <div className="flex items-start gap-4">
                                                <div className="text-center min-w-[80px]">
                                                    <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                                                        {schedule?.startTime}
                                                    </div>
                                                    <div className="text-sm text-gray-500">
                                                        {schedule?.endTime}
                                                    </div>
                                                </div>
                                                <div className={`flex-1 p-3 rounded-lg border-l-4 ${colors.bg} ${colors.border} ${colors.text}`}>
                                                    <h4 className="font-semibold">{classGroup.name}</h4>
                                                    <div className="flex flex-wrap gap-4 mt-2 text-sm opacity-75">
                                                        {classGroup.teacherNames && classGroup.teacherNames.length > 0 && (
                                                            <span className="flex items-center gap-1">
                                                                <User className="w-4 h-4" />
                                                                {classGroup.teacherNames.join(', ')}
                                                            </span>
                                                        )}
                                                        {classGroup.room && (
                                                            <span className="flex items-center gap-1">
                                                                <MapPin className="w-4 h-4" />
                                                                {classGroup.room}
                                                            </span>
                                                        )}
                                                        <span className="flex items-center gap-1">
                                                            <Users className="w-4 h-4" />
                                                            {classGroup.enrolledCount}/{classGroup.capacity || '∞'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                                    No hay clases programadas para {DAYS_FULL[selectedDay]}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* List View */
                    <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-gray-900/50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Clase</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Programa</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden sm:table-cell">Profesores</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Horario</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden md:table-cell">Salón</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden lg:table-cell">Ocupación</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-gray-700">
                                {filteredClasses.map(classGroup => {
                                    const colors = PROGRAM_COLORS[classGroup.program] || PROGRAM_COLORS.orquesta;
                                    return (
                                        <tr
                                            key={classGroup.id}
                                            className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                                            onClick={() => setSelectedClass(classGroup)}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-gray-800 dark:text-gray-200">{classGroup.name}</div>
                                                <div className="text-sm text-gray-500">{classGroup.level}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${colors.bg} ${colors.text} capitalize`}>
                                                    {classGroup.program}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 hidden sm:table-cell">
                                                {classGroup.teacherNames?.join(', ') || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                                {classGroup.schedules.map((s, i) => (
                                                    <div key={i}>{DAYS[s.dayOfWeek]} {s.startTime}-{s.endTime}</div>
                                                ))}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 hidden md:table-cell">
                                                {classGroup.room || '-'}
                                            </td>
                                            <td className="px-4 py-3 hidden lg:table-cell">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full ${colors.solid} rounded-full`}
                                                            style={{ width: `${Math.min(100, ((classGroup.enrolledCount || 0) / (classGroup.capacity || 1)) * 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-gray-500 whitespace-nowrap">
                                                        {classGroup.enrolledCount}/{classGroup.capacity || '∞'}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Class Detail Modal */}
            <ClassDetailModal />

            {/* Conflicts Modal */}
            <ConflictsModal />
        </div>
    );
};
