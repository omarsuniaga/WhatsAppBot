import { useState } from 'react';
import { MessageSquare, ChevronDown, ChevronUp, User, Calendar, GraduationCap, FileText } from 'lucide-react';
import { type EnrichedAttendance } from '../types';

interface ObservationFeedProps {
    attendances: EnrichedAttendance[];
    onToggleJustified: (attendance: EnrichedAttendance) => void;
    onExportPdf?: (sessionData: {
        date: string;
        className: string;
        teacherName: string;
        attendances: EnrichedAttendance[];
        clase_id: string;
    }) => void;
}

interface GroupedObservation {
    clase_id: string;
    className: string;
    teacherName: string;
    fecha: string;
    observaciones: string;
    students: EnrichedAttendance[];
}

export const ObservationFeed = ({ attendances, onToggleJustified, onExportPdf }: ObservationFeedProps) => {
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    const toggleGroup = (key: string) => {
        setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // Filter and group attendances by class and date (only those with observations)
    const grouped = attendances
        .filter(a => a.observaciones)
        .reduce((acc, current) => {
            const key = `${current.clase_id}-${current.fecha}`;
            if (!acc[key]) {
                acc[key] = {
                    clase_id: current.clase_id || '',
                    className: current.className || 'Clase no encontrada',
                    teacherName: current.teacherName || 'Docente no identificado',
                    fecha: current.fecha || '',
                    observaciones: current.observaciones || '',
                    students: []
                };
            }
            acc[key].students.push(current);
            return acc;
        }, {} as Record<string, GroupedObservation>);

    const observationGroups = Object.values(grouped).sort((a, b) => b.fecha.localeCompare(a.fecha));

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'presente': return 'text-green-600 dark:text-green-400';
            case 'ausente': return 'text-red-500 dark:text-red-400';
            case 'tardanza': return 'text-amber-500 dark:text-amber-400';
            case 'justificado': return 'text-indigo-500 dark:text-indigo-400';
            default: return 'text-gray-400';
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 shadow-sm flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/10">
                <h3 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-indigo-500" />
                    Feed de Observaciones
                </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[700px]">
                {observationGroups.length > 0 ? (
                    observationGroups.map((group) => {
                        const key = `${group.clase_id}-${group.fecha}`;
                        const isExpanded = expandedGroups[key] || false;

                        return (
                            <div key={key} className="border dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800/50 shadow-sm">
                                {/* Header */}
                                <div className="p-4 bg-gray-50 dark:bg-gray-700/30 border-b dark:border-gray-700">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <GraduationCap className={`w-4 h-4 shrink-0 ${group.className === 'Clase no encontrada' ? 'text-red-400' : 'text-indigo-500'}`} />
                                            <h4 className="font-bold text-gray-800 dark:text-gray-100 uppercase text-xs sm:text-sm truncate">
                                                {group.className}
                                            </h4>
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] sm:text-[11px] font-medium text-gray-500 dark:text-gray-400">
                                            <div className="flex items-center gap-1">
                                                <User className="w-3 h-3 text-indigo-400" />
                                                <span className="truncate max-w-[100px] sm:max-w-none">{group.teacherName}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3 text-indigo-400" />
                                                <span>{group.fecha}</span>
                                            </div>

                                            {onExportPdf && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onExportPdf({
                                                            date: group.fecha,
                                                            className: group.className,
                                                            teacherName: group.teacherName,
                                                            attendances: group.students,
                                                            clase_id: group.clase_id
                                                        });
                                                    }}
                                                    className="p-1 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded transition-colors text-indigo-600 dark:text-indigo-400"
                                                    title="Exportar PDF"
                                                >
                                                    <FileText className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Body */}
                                <div className="p-4 space-y-3">
                                    {/* Observation Text */}
                                    <div className="relative group">
                                        <div className="absolute -left-2 top-0 bottom-0 w-1 bg-indigo-500/20 rounded-full group-hover:bg-indigo-500/40 transition-colors" />
                                        <p className="text-sm text-gray-700 dark:text-gray-300 italic leading-relaxed whitespace-pre-wrap">
                                            "{group.observaciones}"
                                        </p>
                                    </div>

                                    {/* Expandable Student List */}
                                    <div className="pt-2">
                                        <button
                                            onClick={() => toggleGroup(key)}
                                            className="flex items-center gap-2 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition-colors uppercase tracking-wider"
                                        >
                                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                            ESTADO POR ALUMNO ({group.students.length})
                                        </button>

                                        {isExpanded && (
                                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                                {group.students.map((a, idx) => (
                                                    <div key={`${a.id}-${idx}`} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-900/40 border dark:border-gray-700/50">
                                                        <div className="flex flex-col min-w-0 mr-2">
                                                            <span className={`text-[11px] font-semibold truncate ${a.studentName === 'Alumno no identificado' ? 'text-red-400 italic' : 'text-gray-700 dark:text-gray-200'}`}>
                                                                {a.studentName}
                                                            </span>
                                                            <span className={`text-[9px] font-bold uppercase ${getStatusColor(a.estado)}`}>
                                                                {a.estado === 'tardanza' ? 'Tardanza' : a.estado}
                                                            </span>
                                                        </div>

                                                        {/* Justification toggle only for absent students */}
                                                        {a.estado === 'ausente' && (
                                                            <button
                                                                onClick={() => onToggleJustified(a)}
                                                                className="text-[9px] font-extrabold px-2 py-1 rounded-lg border bg-white dark:bg-gray-700 text-gray-400 border-gray-200 dark:border-gray-600 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all shrink-0"
                                                            >
                                                                JUSTIFICAR?
                                                            </button>
                                                        )}

                                                        {a.estado === 'justificado' && (
                                                            <button
                                                                onClick={() => onToggleJustified(a)}
                                                                className="text-[9px] font-extrabold px-2 py-1 rounded-lg border bg-green-100 text-green-700 border-green-200 shadow-sm transition-all shrink-0"
                                                            >
                                                                JUSTIFICADO
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="p-12 text-center text-gray-500">
                        <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-10" />
                        <p className="text-sm font-medium">No se han registrado observaciones en este periodo</p>
                        <p className="text-xs mt-1">Las clases sin comentarios no aparecerán aquí</p>
                    </div>
                )}
            </div>
        </div>
    );
};
