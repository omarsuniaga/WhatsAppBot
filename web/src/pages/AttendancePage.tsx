
/**
 * AttendancePage - Daily attendance control
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { flushSync } from 'react-dom';
import {
    RefreshCw, Bell, Save, LayoutDashboard, Share2,
    Calendar, ClipboardCheck, Users, CheckCircle, XCircle, Clock, FileText
} from 'lucide-react';
import { AttendanceTemplate } from '../components/attendance/AttendanceTemplate';
import { type EnrichedAttendance } from './AttendanceControl/types';
import { asistenciasService, clasesService, type Clase } from '../services/firestore';
import { dataApi } from '../api/adminSystem';
import { useAuth } from '../contexts/AuthContext';

// Local type for attendance records from backend API
interface Asistencia {
    id: string;
    alumno_id: string;
    alumno_nombre?: string;
    clase_id: string;
    clase_nombre?: string;
    fecha: string;
    estado: 'presente' | 'ausente' | 'tardanza' | 'justificado' | 'pendiente';
    observaciones?: string;
    justificacion?: string;
    [key: string]: any;
}
import { DashboardTab } from '../components/attendance/DashboardTab';
import { CalendarTab } from '../components/attendance/CalendarTab';

import { DailyReminderPanel } from '../components/attendance/DailyReminderPanel';
import { InfoButton } from '../components/common/InfoButton';
import { usePageInfo } from '../hooks/useViewInfo';

interface ClassGroup extends Partial<Clase> {
    id: string;
    name: string;
    program: string;
    level: string;
    teacherIds?: string[];
}

interface Student {
    id: string;
    firstName: string;
    lastName: string;
    program: string;
    instrument?: string;
}

interface AttendanceRecord {
    studentId: string;
    status: 'present' | 'absent' | 'late' | 'excused' | 'pending';
    note?: string;
    registeredBy?: string;
    updatedAt?: Date;
}

interface AttendanceSession {
    id: string; // unique key (e.g., classId_date)
    classId: string;
    className: string;
    date: string;
    records: Asistencia[];
    summary: {
        present: number;
        absent: number;
        late: number;
        excused: number;
    };
    isExpanded?: boolean;
    observation?: string;
}

type TabType = 'dashboard' | 'today' | 'report' | 'rules' | 'calendar';

export const AttendancePage = () => {
    // const navigate = useNavigate(); // Unused
    const [searchParams] = useSearchParams();
    const urlClassId = searchParams.get('classId');
    const pageInfo = usePageInfo('attendance');
    const { currentUser: user } = useAuth();

    const [activeTab, setActiveTab] = useState<TabType>('dashboard');
    const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [classes, setClasses] = useState<ClassGroup[]>([]);
    const [students, setStudents] = useState<Student[]>([]);

    // Default history range: 1 month back
    const today = new Date();
    const oneMonthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());

    const [historyDateStart, setHistoryDateStart] = useState(oneMonthAgo.toISOString().split('T')[0]);
    const [historyDateEnd, setHistoryDateEnd] = useState(new Date().toISOString().split('T')[0]);
    const [historyRecords, setHistoryRecords] = useState<Asistencia[]>([]);
    const [attendance, setAttendance] = useState<Map<string, AttendanceRecord>>(new Map());
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [printingSessions, setPrintingSessions] = useState<any[] | null>(null);

    // History state
    const [historyLoading, setHistoryLoading] = useState(false);
    const [groupedSessions, setGroupedSessions] = useState<AttendanceSession[]>([]);

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab && ['dashboard', 'today', 'report', 'rules', 'calendar'].includes(tab)) {
            setActiveTab(tab as TabType);
        }
    }, [searchParams]);

    useEffect(() => {
        loadClasses();
    }, []);

    useEffect(() => {
        if (selectedClass) {
            loadStudentsForClass(selectedClass);
        }
    }, [selectedClass, selectedDate]);

    const loadClasses = async () => {
        try {
            const data = await clasesService.getAllClases(true);
            const mappedClasses = data.map((c: Clase) => ({
                ...c,
                id: c.id!,
                name: c.nombre || c.name || 'Sin nombre',
                program: c.instrumento || c.instrument || '',
                level: (c as any).nivel || ''
            }));
            setClasses(mappedClasses);

            // Priority: URL Param > Existing Selection > Default to All
            if (urlClassId) {
                setSelectedClass(urlClassId);
            }
            // else: leave selectedClass as '' (All Classes)
        } catch (err) {
            console.error('Error loading classes:', err);
        }
    };

    const [studentMap, setStudentMap] = useState<Map<string, string>>(new Map());

    useEffect(() => {
        const loadAllStudents = async () => {
            try {
                const res = await dataApi.getAllStudents();
                const students = res.data.data || [];
                const map = new Map<string, string>();
                students.forEach((s: any) => {
                    map.set(s.id, `${s.nombre || ''} ${s.apellido || ''}`.trim());
                });
                setStudentMap(map);
            } catch (err) {
                console.error('Error loading all students:', err);
            }
        };
        loadAllStudents();
    }, []);

    const [classesWithAttendance, setClassesWithAttendance] = useState<Set<string>>(new Set());

    useEffect(() => {
        checkExistingAttendance();
    }, [selectedDate]);

    const checkExistingAttendance = async () => {
        try {
            console.log('Checking attendance for date:', selectedDate);
            const res = await dataApi.getAttendancesToday(selectedDate);
            const records = res.data.data || [];
            console.log('Records found:', records.length);

            if (records.length > 0) {
                console.log('First record sample:', records[0]);
                console.log('Class IDs in records:', records.map((r: any) => r.clase_id || r.classId));
            }

            const classIds = new Set<string>(records.map((r: any) => r.clase_id || r.classId));
            console.log('Unique Class IDs with attendance:', Array.from(classIds));
            setClassesWithAttendance(classIds);
        } catch (err) {
            console.error('Error checking existing attendance:', err);
        }
    };

    const loadStudentsForClass = async (classId: string) => {
        // Validate classId is not empty
        if (!classId || classId.trim() === '') {
            setStudents([]);
            setAttendance(new Map());
            return;
        }

        setLoading(true);
        try {
            // Fetch class details and all students via backend API
            const [classRes, studentsRes] = await Promise.all([
                dataApi.getClass(classId),
                dataApi.getAllStudents()
            ]);

            const classDoc = classRes.data.data;
            if (!classDoc) {
                setStudents([]);
                return;
            }

            const studentIds = classDoc.studentIds || classDoc.alumno_ids || classDoc.alumnos || [];
            const allStudents = studentsRes.data.data || [];

            // Filter students that belong to this class (instead of N+1 queries)
            const classStudents = allStudents.filter((s: any) => studentIds.includes(s.id));

            const mappedStudents = classStudents.map((s: any) => ({
                id: s.id,
                firstName: s.nombre || '',
                lastName: s.apellido || '',
                program: s.instrumento || '',
                instrument: s.instrumento || ''
            }));

            setStudents(mappedStudents);

            // Fetch existing attendance via Firestore service
            const allAttendance = await asistenciasService.getByDateRange(selectedDate, selectedDate, classId);
            const dateFiltered = allAttendance; // Already filtered by classId and date in service

            const newAttendance = new Map<string, AttendanceRecord>();

            // Initialize with defaults (pending)
            mappedStudents.forEach((student: any) => {
                newAttendance.set(student.id, { studentId: student.id, status: 'pending' });
            });

            // Map Firestore states to UI states
            const stateMap: Record<string, AttendanceRecord['status']> = {
                'presente': 'present',
                'ausente': 'absent',
                'tardanza': 'late',
                'justificado': 'excused'
            };

            // Overlay existing records
            dateFiltered.forEach(record => {
                const studentId = record.alumno_id || record.studentId;
                if (!studentId) return;

                const uiStatus = stateMap[record.estado] || 'present';
                newAttendance.set(studentId, {
                    studentId: studentId,
                    status: uiStatus,
                    note: record.observaciones || record.notes,
                    registeredBy: record.registrado_por,
                    updatedAt: record.updatedAt ? new Date(record.updatedAt as any) : undefined
                });
            });

            setAttendance(newAttendance);

        } catch (err) {
            console.error('Error loading data:', err);
            setStudents([]);
        } finally {
            setLoading(false);
        }
    };

    const updateAttendance = (studentId: string, status: AttendanceRecord['status']) => {
        const newAttendance = new Map(attendance);
        const current = newAttendance.get(studentId) || { studentId, status: 'present' };
        newAttendance.set(studentId, { ...current, status });
        setAttendance(newAttendance);
    };

    const updateNote = (studentId: string, note: string) => {
        const newAttendance = new Map(attendance);
        const current = newAttendance.get(studentId) || { studentId, status: 'present' };
        newAttendance.set(studentId, { ...current, note });
        setAttendance(newAttendance);
    };

    const markRemainingPresent = () => {
        const newAttendance = new Map(attendance);
        students.forEach(student => {
            const current = newAttendance.get(student.id);
            if (current && current.status === 'pending') {
                newAttendance.set(student.id, { ...current, status: 'present' });
            }
        });
        setAttendance(newAttendance);
    };

    const copyFromLastClass = async () => {
        if (!selectedClass) return;
        setLoading(true);
        try {
            // Fetch records for this class ordered by date desc, but before selectedDate
            const records = await asistenciasService.getByDateRange('2024-01-01', selectedDate, selectedClass);

            // Filter out current date and get most recent date
            const previousDates = Array.from(new Set(records.map((r: Asistencia) => r.fecha)))
                .filter((d: string) => d < selectedDate)
                .sort((a: string, b: string) => b.localeCompare(a));

            if (previousDates.length === 0) {
                alert('No hay registros previos para esta clase.');
                return;
            }

            const lastDate = previousDates[0];
            const lastAttendance = records.filter((r: Asistencia) => r.fecha === lastDate);

            const newAttendance = new Map(attendance);
            lastAttendance.forEach((att: any) => {
                const current = newAttendance.get(att.alumno_id) || { studentId: att.alumno_id, status: 'present' };
                newAttendance.set(att.alumno_id, { ...current, status: att.estado });
            });

            setAttendance(newAttendance);
            alert(`Copiada asistencia del ${lastDate}`);

        } catch (err) {
            console.error('Error copying last attendance:', err);
            alert('Error al copiar asistencia previa.');
        } finally {
            setLoading(false);
        }
    };

    const saveAttendance = async () => {
        if (!selectedClass || students.length === 0) return;

        // Validation: Check for pending records
        const pendingCount = Array.from(attendance.values()).filter(r => r.status === 'pending').length;
        if (pendingCount > 0) {
            alert(`Aún hay ${pendingCount} estudiantes sin marcar. Por favor completa la lista.`);
            return;
        }

        setSaving(true);
        try {
            const classRes = await dataApi.getClass(selectedClass);
            const classDoc = classRes.data.data;
            const class_nombre = classDoc?.nombre || classDoc?.name || 'Clase';

            // Map UI status back to Firestore status
            const statusMap: Record<AttendanceRecord['status'], Asistencia['estado']> = {
                'present': 'presente',
                'absent': 'ausente',
                'late': 'tardanza',
                'excused': 'justificado',
                'pending': 'pendiente'
            };

            // Fetch existing attendance for this date via backend API (single query)
            const attRes = await dataApi.getAttendancesToday(selectedDate);
            const existingRecords: Asistencia[] = (attRes.data.data || []).filter(
                (a: Asistencia) => a.clase_id === selectedClass
            );

            // Process each record
            for (const student of students) {
                const record = attendance.get(student.id);
                if (!record) continue;

                // Find existing record to update or create new
                const match = existingRecords.find(a => (a.alumno_id || a.studentId) === student.id);

                const attendanceData: any = {
                    alumno_id: student.id,
                    alumno_nombre: `${student.firstName} ${student.lastName}`,
                    clase_id: selectedClass,
                    clase_nombre: class_nombre,
                    fecha: selectedDate,
                    estado: statusMap[record.status],
                    observaciones: record.note,
                    activo: true,
                    registrado_por: user?.displayName || user?.email || 'Administrador',
                    profesor_id: user?.uid
                };

                if (match) {
                    // Write directly to Firestore (teacher writes)
                    await asistenciasService.update(match.id, attendanceData);
                } else {
                    await asistenciasService.create(attendanceData);
                }
            }

            alert('Asistencia guardada exitosamente en Firestore');
        } catch (err: any) {
            console.error('Error saving attendance:', err);
            alert('Error al guardar: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const generateDrafts = async () => {
        const absentStudents = Array.from(attendance.values()).filter(r => r.status === 'absent');
        if (absentStudents.length === 0) {
            alert('No hay ausencias para notificar');
            return;
        }

        try {
            // Mock or replace with actual API call if analyticsApi is available
            // const result = await analyticsApi.preFillJustifications(selectedClass, selectedDate);
            // if (result.data) {
            //     console.log('Justificaciones pre-llenadas:', result.data);
            // }
            console.log('Generating drafts for:', absentStudents.length);
        } catch (e) { }

    };

    const copyToWhatsApp = (session: AttendanceSession) => {
        const date = new Date(session.date + 'T12:00:00').toLocaleDateString('es-ES', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        let text = `📅 *REPORTE DE ASISTENCIA*\n`;
        text += `🎻 *Clase:* ${session.className}\n`;
        text += `🗓️ *Fecha:* ${date}\n\n`;

        if (session.observation) {
            text += `📝 *Observación General:*\n_${session.observation}_\n\n`;
        }

        const groups = {
            'presente': { emoji: '✅', title: 'PRESENTES', list: [] as string[] },
            'ausente': { emoji: '❌', title: 'AUSENTES', list: [] as string[] },
            'tardanza': { emoji: '🕒', title: 'TARDANZAS', list: [] as string[] },
            'justificado': { emoji: '🛡️', title: 'JUSTIFICADOS', list: [] as string[] },
            'pendiente': { emoji: '⏳', title: 'PENDIENTES', list: [] as string[] }
        };

        session.records.forEach(r => {
            const name = r.alumno_nombre || studentMap.get(r.alumno_id) || 'Alumno';
            if (groups[r.estado]) {
                groups[r.estado].list.push(name);
            }
        });

        // Add stats
        text += `📊 *Resumen:*\n`;

        text += `✅ ${session.summary.present} | ❌ ${session.summary.absent} | 🕒 ${session.summary.late} | 🛡️ ${session.summary.excused}\n\n`;

        Object.values(groups).forEach(group => {
            if (group.list.length > 0) {
                text += `${group.emoji} *${group.title} (${group.list.length})*\n`;
                const cleanList = group.list.filter((name, index, self) => self.indexOf(name) === index); // Dedup
                cleanList.forEach(name => {
                    text += `• ${name}\n`;
                });
                text += `\n`;
            }
        });

        navigator.clipboard.writeText(text);
        alert(' Reporte copiado al portapapeles para WhatsApp');
    };

    const buildPrintableSession = (session: AttendanceSession) => {
        // Map records to EnrichedAttendance format
        const sessionAttendances: EnrichedAttendance[] = session.records.map(r => {
            let studentName = r.alumno_nombre || '';

            if (!studentName) {
                // Try global map
                studentName = studentMap.get(r.alumno_id) || '';

                // Try class students if available
                if (!studentName && session.classId === selectedClass) {
                    const student = students.find(s => s.id === r.alumno_id);
                    if (student) studentName = `${student.firstName} ${student.lastName}`;
                }

                if (!studentName) studentName = 'Estudiante';
            }

            return {
                id: r.id,
                alumno_id: r.alumno_id,
                studentName: studentName,
                estado: r.estado,
                fecha: r.fecha,
                observaciones: r.observaciones || '',
                clase_id: r.clase_id,
                className: session.className,
                teacherName: ''
            } as EnrichedAttendance;
        });

        // Find class info if possible
        const clase = classes.find(c => c.id === session.classId);
        const roomName = (clase as any)?.salon_nombre || (clase as any)?.roomName || '';

        let scheduleTime = '';
        if ((clase as any)?.hora_inicio) {
            scheduleTime = `${(clase as any).hora_inicio} - ${(clase as any).hora_fin || ''}`;
        } else if (clase?.schedule?.slots && clase.schedule.slots.length > 0) {
            const slot = clase.schedule.slots[0];
            scheduleTime = `${slot.startTime} - ${slot.endTime}`;
        }

        const teacherName = (clase as any)?.profesor_nombre || (clase as any)?.teacherName || '';

        return {
            date: session.date,
            className: session.className,
            teacherName: teacherName || '(Indicar Nombre)',
            roomName: roomName || '(Indicar Salón)',
            scheduleTime: scheduleTime || '(Indicar Horario)',
            attendances: sessionAttendances,
            observation: session.observation || ''
        };
    };

    const handleExportPdf = (session: AttendanceSession) => {
        const printable = buildPrintableSession(session);
        flushSync(() => {
            setPrintingSessions([printable]);
        });

        setTimeout(() => {
            window.print();
        }, 80);
    };

    const handleExportHistoryPdf = () => {
        if (groupedSessions.length === 0) {
            alert('No hay registros de asistencia para exportar en el rango seleccionado');
            return;
        }

        const printables = groupedSessions.map(buildPrintableSession);
        flushSync(() => {
            setPrintingSessions(printables);
        });

        setTimeout(() => {
            window.print();
        }, 80);
    };





    const loadHistory = async () => {
        if (!historyDateStart || !historyDateEnd) {
            alert('Por favor selecciona un rango de fechas');
            return;
        }

        setHistoryLoading(true);
        try {
            // Fetch records - classId is now optional
            const records = await asistenciasService.getByDateRange(
                historyDateStart,
                historyDateEnd,
                selectedClass || undefined // Pass undefined if empty string
            );

            setHistoryRecords(records);

            // Group by Class + Date
            const sessionsMap = new Map<string, AttendanceSession>();

            records.forEach(record => {
                // Create a unique key for the session
                const sessionKey = `${record.clase_id}_${record.fecha}`;

                if (!sessionsMap.has(sessionKey)) {
                    // Resolve class name from state if missing in record
                    const resolvedClassName = record.clase_nombre ||
                        classes.find(c => c.id === record.clase_id)?.name ||
                        classes.find(c => c.id === (record as any).classId)?.name ||
                        'Clase Desconocida';

                    sessionsMap.set(sessionKey, {
                        id: sessionKey,
                        classId: record.clase_id,
                        className: resolvedClassName,
                        date: record.fecha,
                        records: [],
                        summary: { present: 0, absent: 0, late: 0, excused: 0 },
                        isExpanded: false,
                        observation: record.observaciones || '' // Take initial observation
                    });
                }

                const session = sessionsMap.get(sessionKey)!;
                session.records.push(record);

                // Update observation if we found a non-empty one and ours is empty
                if (!session.observation && record.observaciones) {
                    session.observation = record.observaciones;
                }

                // Update summary
                if (record.estado === 'presente') session.summary.present++;
                else if (record.estado === 'ausente') session.summary.absent++;
                else if (record.estado === 'tardanza') session.summary.late++;
                else if (record.estado === 'justificado') session.summary.excused++;
            });

            // Sort sessions by date desc
            const sortedSessions = Array.from(sessionsMap.values()).sort((a, b) =>
                b.date.localeCompare(a.date)
            );

            setGroupedSessions(sortedSessions);

        } catch (error) {
            console.error('Error loading history:', error);
            alert('Error al cargar el historial');
        } finally {
            setHistoryLoading(false);
        }
    };

    const toggleSessionExpand = (sessionId: string) => {
        setGroupedSessions(prev => prev.map(session =>
            session.id === sessionId
                ? { ...session, isExpanded: !session.isExpanded }
                : session
        ));
    };

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteDateStart, setDeleteDateStart] = useState('');
    const [deleteDateEnd, setDeleteDateEnd] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDeleteRange = async () => {
        if (!deleteDateStart || !deleteDateEnd) return;

        if (!confirm(`¿Estás seguro de ELIMINAR PERMANENTEMENTE los registros desde ${deleteDateStart} hasta ${deleteDateEnd}? Esta acción no se puede deshacer.`)) {
            return;
        }

        setIsDeleting(true);
        try {
            const count = await asistenciasService.deleteByDateRange(deleteDateStart, deleteDateEnd);
            alert(`Se han eliminado ${count} registros correctamente.`);
            setShowDeleteModal(false);
            loadHistory(); // Reload
        } catch (error) {
            console.error('Error deleting records:', error);
            alert('Error al eliminar registros');
        } finally {
            setIsDeleting(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'report') {
            loadHistory();
        }
    }, [activeTab, selectedClass, historyDateStart, historyDateEnd]);

    const exportToCSV = () => {
        if (historyRecords.length === 0) return;

        const headers = ['Fecha', 'Estudiante', 'Clase', 'Estado', 'Observaciones'];
        const rows = historyRecords.map(r => [
            r.fecha,
            r.alumno_nombre || 'N/A',
            r.clase_nombre || 'N/A',
            r.estado,
            r.observaciones || ''
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `asistencia_${historyDateStart}_${historyDateEnd}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getStatusCounts = () => {
        const counts = { present: 0, absent: 0, late: 0, excused: 0, pending: 0 };
        attendance.forEach(record => {
            counts[record.status]++;
        });
        return counts;
    };

    const counts = getStatusCounts();

    const tabs: { id: TabType; label: string; icon: any }[] = [
        { id: 'dashboard', label: 'Tablero', icon: LayoutDashboard },
        { id: 'calendar', label: 'Calendario', icon: Calendar },
        { id: 'today', label: 'Registrar', icon: ClipboardCheck },
        { id: 'report', label: 'Historial', icon: ClipboardCheck },
        { id: 'rules', label: 'Configuración', icon: Bell },
    ];

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6">
            <div className="attendance-screen-content max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <ClipboardCheck className="w-7 h-7 text-green-500" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                                Control de Asistencia
                            </h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Gestión y monitoreo de asistencia académica
                            </p>
                        </div>
                        {pageInfo.hasInfo && (
                            <InfoButton
                                title={pageInfo.title}
                                description={pageInfo.description}
                                tips={pageInfo.tips}
                            />
                        )}
                    </div>
                </div>

                <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 overflow-x-auto">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1 justify-center whitespace-nowrap ${activeTab === tab.id
                                ? 'bg-white dark:bg-gray-700 text-green-600 dark:text-green-400 shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {activeTab === 'dashboard' && (
                    <DashboardTab />
                )}

                {activeTab === 'calendar' && (
                    <CalendarTab />
                )}

                {activeTab === 'rules' && (
                    <div className="p-4">
                        <DailyReminderPanel />
                    </div>
                )}

                {
                    activeTab === 'today' && (
                        <div className="space-y-6">
                            <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Fecha
                                        </label>
                                        <input
                                            type="date"
                                            value={selectedDate}
                                            onChange={(e) => setSelectedDate(e.target.value)}
                                            className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Clase
                                        </label>
                                        <select
                                            value={selectedClass}
                                            onChange={(e) => setSelectedClass(e.target.value)}
                                            className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500"
                                        >
                                            <option value="">Seleccionar clase...</option>
                                            {classes.map(c => (
                                                <option key={c.id} value={c.id}>
                                                    {c.name} {classesWithAttendance.has(c.id) ? '✅' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex items-end">
                                        <button
                                            onClick={() => loadStudentsForClass(selectedClass)}
                                            disabled={!selectedClass}
                                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                            Recargar
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-5 gap-3">
                                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">{counts.present}</div>
                                    <div className="text-xs text-green-700 dark:text-green-300">Presentes</div>
                                </div>
                                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
                                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">{counts.absent}</div>
                                    <div className="text-xs text-red-700 dark:text-red-300">Ausentes</div>
                                </div>
                                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 text-center">
                                    <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{counts.late}</div>
                                    <div className="text-xs text-yellow-700 dark:text-yellow-300">Tardanzas</div>
                                </div>
                                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{counts.excused}</div>
                                    <div className="text-xs text-blue-700 dark:text-blue-300">Excusados</div>
                                </div>
                                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 text-center">
                                    <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">{counts.pending}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">Sin Marcar</div>
                                </div>
                            </div>

                            {loading ? (
                                <div className="flex items-center justify-center h-48">
                                    <RefreshCw className="w-8 h-8 animate-spin text-green-500" />
                                </div>
                            ) : students.length > 0 ? (
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border dark:border-gray-700 shadow-sm">
                                            <div className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-tight">
                                                Lista de Estudiantes ({students.length})
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={copyFromLastClass}
                                                    className="text-xs px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800/40 rounded-md font-bold transition-all border border-blue-200 dark:border-blue-800/50 flex items-center gap-2 shadow-sm active:scale-95"
                                                >
                                                    <RefreshCw className="w-4 h-4" />
                                                    Copiar última clase
                                                </button>
                                                <button
                                                    onClick={markRemainingPresent}
                                                    className="text-xs px-3 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-800/40 rounded-md font-bold transition-all border border-green-200 dark:border-green-800/50 flex items-center gap-2 shadow-sm active:scale-95"
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                    Marcar Restantes Presentes
                                                </button>
                                            </div>
                                        </div>
                                        <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 overflow-hidden">
                                            <div className="divide-y dark:divide-gray-700">
                                                {students.map(student => {
                                                    const record = attendance.get(student.id);
                                                    return (
                                                        <div key={student.id} className="p-4">
                                                            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                                                <div className="flex-1">
                                                                    <div className="font-medium text-gray-800 dark:text-gray-200">
                                                                        {student.firstName} {student.lastName}
                                                                    </div>
                                                                    {student.instrument && (
                                                                        <div className="text-sm text-gray-500 dark:text-gray-400">
                                                                            {student.instrument}
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={() => updateAttendance(student.id, 'present')}
                                                                        className={`p-2 rounded-lg transition-colors ${record?.status === 'present'
                                                                            ? 'bg-green-500 text-white'
                                                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-green-100 dark:hover:bg-green-900/30'
                                                                            }`}
                                                                        title="Presente"
                                                                    >
                                                                        <CheckCircle className="w-5 h-5" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => updateAttendance(student.id, 'absent')}
                                                                        className={`p-2 rounded-lg transition-colors ${record?.status === 'absent'
                                                                            ? 'bg-red-500 text-white'
                                                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-red-100 dark:hover:bg-red-900/30'
                                                                            }`}
                                                                        title="Ausente"
                                                                    >
                                                                        <XCircle className="w-5 h-5" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => updateAttendance(student.id, 'late')}
                                                                        className={`p-2 rounded-lg transition-colors ${record?.status === 'late'
                                                                            ? 'bg-yellow-500 text-white'
                                                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/30'
                                                                            }`}
                                                                        title="Tarde"
                                                                    >
                                                                        <Clock className="w-5 h-5" />
                                                                    </button>
                                                                </div>

                                                                <input
                                                                    type="text"
                                                                    placeholder="Nota opcional..."
                                                                    value={record?.note || ''}
                                                                    onChange={(e) => updateNote(student.id, e.target.value)}
                                                                    className="flex-1 sm:max-w-xs px-3 py-2 text-sm border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500"
                                                                />
                                                            </div>
                                                            {record?.updatedAt && (
                                                                <div className="mt-1 text-xs text-gray-400 pl-1">
                                                                    Actualizado por: <span className="font-medium">{record.registeredBy || 'Desconocido'}</span> • {record.updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <button
                                            onClick={saveAttendance}
                                            disabled={saving}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
                                        >
                                            <Save className="w-5 h-5" />
                                            {saving ? 'Guardando...' : 'Guardar Asistencia'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                // Create a virtual session from current state
                                                const currentRecords = Array.from(attendance.entries())
                                                    .filter(([_, rec]) => rec.status !== 'pending')
                                                    .map(([studentId, rec]) => {
                                                        const student = students.find(s => s.id === studentId);
                                                        return {
                                                            id: `today_${studentId}`,
                                                            alumno_id: studentId,
                                                            alumno_nombre: student ? `${student.firstName} ${student.lastName}` : (studentMap.get(studentId) || 'Estudiante'),
                                                            clase_id: selectedClass,
                                                            fecha: selectedDate,
                                                            estado: rec.status === 'present' ? 'presente' : rec.status === 'absent' ? 'ausente' : rec.status === 'late' ? 'tardanza' : 'justificado',
                                                            observaciones: rec.note || ''
                                                        } as Asistencia;
                                                    });

                                                const virtualSession: AttendanceSession = {
                                                    id: 'today_session',
                                                    classId: selectedClass,
                                                    className: classes.find(c => c.id === selectedClass)?.name || '',
                                                    date: selectedDate,
                                                    records: currentRecords,
                                                    summary: {
                                                        present: counts.present,
                                                        absent: counts.absent,
                                                        late: counts.late,
                                                        excused: counts.excused
                                                    },
                                                    observation: ''
                                                };
                                                handleExportPdf(virtualSession);
                                            }}
                                            disabled={attendance.size === 0}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 border border-blue-200 dark:border-blue-800 rounded-lg font-medium transition-colors shadow-sm"
                                        >
                                            <FileText className="w-5 h-5" />
                                            Exportar PDF
                                        </button>
                                        <button
                                            onClick={generateDrafts}
                                            disabled={counts.absent === 0}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
                                        >
                                            <Bell className="w-5 h-5" />
                                            Generar Borradores ({counts.absent})
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-8 text-center">
                                    <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                                    <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-1">
                                        Selecciona una clase
                                    </h3>
                                    <p className="text-gray-500 dark:text-gray-400">
                                        Selecciona una clase y fecha para registrar asistencia
                                    </p>
                                </div>
                            )}
                        </div>
                    )
                }

                {
                    activeTab === 'report' && (
                        <div className="space-y-6">
                            <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                    <div className="sm:col-span-1">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Clase
                                        </label>
                                        <select
                                            value={selectedClass}
                                            onChange={(e) => setSelectedClass(e.target.value)}
                                            className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500"
                                        >
                                            <option value="">Todas las Clases</option>
                                            {classes.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Desde
                                        </label>
                                        <input
                                            type="date"
                                            value={historyDateStart}
                                            onChange={(e) => setHistoryDateStart(e.target.value)}
                                            className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Hasta
                                        </label>
                                        <input
                                            type="date"
                                            value={historyDateEnd}
                                            onChange={(e) => setHistoryDateEnd(e.target.value)}
                                            className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <button
                                            onClick={loadHistory}
                                            disabled={historyLoading}
                                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
                                        >
                                            <RefreshCw className={`w-4 h-4 ${historyLoading ? 'animate-spin' : ''}`} />
                                            Ver Historial
                                        </button>
                                        <button
                                            onClick={() => setShowDeleteModal(true)}
                                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800/50 rounded-lg text-sm font-medium transition-colors"
                                        >
                                            <div className="w-4 h-4">🗑️</div>
                                            Borrar Avanzado
                                        </button>
                                        {historyRecords.length > 0 && (
                                            <button
                                                onClick={exportToCSV}
                                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800/50 rounded-lg text-sm font-medium transition-colors"
                                            >
                                                <Save className="w-4 h-4" />
                                                Exportar CSV
                                            </button>
                                        )}
                                        {groupedSessions.length > 0 && (
                                            <button
                                                onClick={handleExportHistoryPdf}
                                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800/50 rounded-lg text-sm font-medium transition-colors"
                                            >
                                                <FileText className="w-4 h-4" />
                                                Exportar PDF (Lote)
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t dark:border-gray-700">
                                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center mr-1 uppercase">
                                        Filtros Rápidos:
                                    </span>
                                    <button
                                        onClick={() => {
                                            const today = new Date().toISOString().split('T')[0];
                                            setHistoryDateStart(today);
                                            setHistoryDateEnd(today);
                                        }}
                                        className="text-xs px-2.5 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full text-gray-600 dark:text-gray-300 transition-colors"
                                    >
                                        Hoy
                                    </button>
                                    <button
                                        onClick={() => {
                                            const today = new Date();
                                            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                                            setHistoryDateStart(weekAgo.toISOString().split('T')[0]);
                                            setHistoryDateEnd(today.toISOString().split('T')[0]);
                                        }}
                                        className="text-xs px-2.5 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full text-gray-600 dark:text-gray-300 transition-colors"
                                    >
                                        Últimos 7 días
                                    </button>
                                    <button
                                        onClick={() => {
                                            const today = new Date();
                                            const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
                                            setHistoryDateStart(monthAgo.toISOString().split('T')[0]);
                                            setHistoryDateEnd(today.toISOString().split('T')[0]);
                                        }}
                                        className="text-xs px-2.5 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full text-gray-600 dark:text-gray-300 transition-colors"
                                    >
                                        Este mes
                                    </button>
                                </div>
                            </div>

                            {historyLoading ? (
                                <div className="flex items-center justify-center h-48">
                                    <RefreshCw className="w-8 h-8 animate-spin text-green-500" />
                                </div>
                            ) : groupedSessions.length > 0 ? (
                                <div className="space-y-4">
                                    {groupedSessions.map((session) => (
                                        <div key={session.id} className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 overflow-hidden shadow-sm transition-all">
                                            <div
                                                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750"
                                                onClick={() => toggleSessionExpand(session.id)}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                                                        <Users className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-gray-800 dark:text-gray-200">
                                                            {session.className}
                                                        </h4>
                                                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mt-1">
                                                            <Calendar className="w-4 h-4" />
                                                            {new Date(session.date + 'T12:00:00').toLocaleDateString('es-ES', {
                                                                weekday: 'long',
                                                                year: 'numeric',
                                                                month: 'long',
                                                                day: 'numeric'
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="mt-3 sm:mt-0 flex flex-wrap gap-2 text-xs font-medium">
                                                    <span className="px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-md">
                                                        {session.summary.present} Presentes
                                                    </span>
                                                    {session.summary.absent > 0 && (
                                                        <span className="px-2 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-md">
                                                            {session.summary.absent} Ausentes
                                                        </span>
                                                    )}
                                                    {session.summary.late > 0 && (
                                                        <span className="px-2 py-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-md">
                                                            {session.summary.late} Tardanzas
                                                        </span>
                                                    )}
                                                    <div className="text-gray-400 dark:text-gray-500 ml-2 transform transition-transform duration-200" style={{ transform: session.isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                                        ▼
                                                    </div>
                                                </div>
                                            </div>

                                            {session.isExpanded && (
                                                <div className="border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900/20 p-4">

                                                    {/* Actions Toolbar */}
                                                    <div className="flex justify-end mb-4">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); copyToWhatsApp(session); }}
                                                            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                                                        >
                                                            <Share2 className="w-4 h-4" />
                                                            Copiar para WhatsApp
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleExportPdf(session); }}
                                                            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                                                        >
                                                            <FileText className="w-4 h-4" />
                                                            Exportar PDF
                                                        </button>
                                                    </div>

                                                    {/* Session Observation */}
                                                    {session.observation && (
                                                        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/30 rounded-lg flex items-start gap-3">
                                                            <div className="mt-0.5">📝</div>
                                                            <div>
                                                                <h5 className="text-xs font-bold text-yellow-800 dark:text-yellow-500 uppercase tracking-wide mb-1">
                                                                    Observación de la Clase
                                                                </h5>
                                                                <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                                                                    "{session.observation}"
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Grouped Students */}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        {/* Presentes */}
                                                        {session.summary.present > 0 && (
                                                            <div className="bg-white dark:bg-gray-800 rounded-lg border border-green-100 dark:border-green-900/30 overflow-hidden">
                                                                <div className="bg-green-50 dark:bg-green-900/20 px-3 py-2 border-b border-green-100 dark:border-green-900/30 flex justify-between items-center">
                                                                    <h5 className="font-semibold text-green-700 dark:text-green-400 text-sm flex items-center gap-2">
                                                                        <CheckCircle className="w-4 h-4" /> Presentes
                                                                    </h5>
                                                                    <span className="text-xs font-bold bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 px-2 py-0.5 rounded-full">
                                                                        {session.summary.present}
                                                                    </span>
                                                                </div>
                                                                <ul className="divide-y dark:divide-gray-700/50">
                                                                    {session.records.filter(r => r.estado === 'presente').map(r => (
                                                                        <li key={r.id} className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100 flex justify-between">
                                                                            <span>{r.alumno_nombre || studentMap.get(r.alumno_id) || 'Estudiante sin nombre'}</span>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}

                                                        {/* Ausentes */}
                                                        {session.summary.absent > 0 && (
                                                            <div className="bg-white dark:bg-gray-800 rounded-lg border border-red-100 dark:border-red-900/30 overflow-hidden">
                                                                <div className="bg-red-50 dark:bg-red-900/20 px-3 py-2 border-b border-red-100 dark:border-red-900/30 flex justify-between items-center">
                                                                    <h5 className="font-semibold text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
                                                                        <XCircle className="w-4 h-4" /> Ausentes
                                                                    </h5>
                                                                    <span className="text-xs font-bold bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 px-2 py-0.5 rounded-full">
                                                                        {session.summary.absent}
                                                                    </span>
                                                                </div>
                                                                <ul className="divide-y dark:divide-gray-700/50">
                                                                    {session.records.filter(r => r.estado === 'ausente').map(r => (
                                                                        <li key={r.id} className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100 flex justify-between group relative">
                                                                            <span>{r.alumno_nombre || studentMap.get(r.alumno_id) || 'Estudiante sin nombre'}</span>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}

                                                        {/* Tardanzas */}
                                                        {session.summary.late > 0 && (
                                                            <div className="bg-white dark:bg-gray-800 rounded-lg border border-yellow-100 dark:border-yellow-900/30 overflow-hidden">
                                                                <div className="bg-yellow-50 dark:bg-yellow-900/20 px-3 py-2 border-b border-yellow-100 dark:border-yellow-900/30 flex justify-between items-center">
                                                                    <h5 className="font-semibold text-yellow-700 dark:text-yellow-400 text-sm flex items-center gap-2">
                                                                        <Clock className="w-4 h-4" /> Tardanzas
                                                                    </h5>
                                                                    <span className="text-xs font-bold bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 px-2 py-0.5 rounded-full">
                                                                        {session.summary.late}
                                                                    </span>
                                                                </div>
                                                                <ul className="divide-y dark:divide-gray-700/50">
                                                                    {session.records.filter(r => r.estado === 'tardanza').map(r => (
                                                                        <li key={r.id} className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                                                                            {r.alumno_nombre || studentMap.get(r.alumno_id) || 'Estudiante sin nombre'}
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}

                                                        {/* Justificados */}
                                                        {session.summary.excused > 0 && (
                                                            <div className="bg-white dark:bg-gray-800 rounded-lg border border-blue-100 dark:border-blue-900/30 overflow-hidden">
                                                                <div className="bg-blue-50 dark:bg-blue-900/20 px-3 py-2 border-b border-blue-100 dark:border-blue-900/30 flex justify-between items-center">
                                                                    <h5 className="font-semibold text-blue-700 dark:text-blue-400 text-sm flex items-center gap-2">
                                                                        <ClipboardCheck className="w-4 h-4" /> Justificados
                                                                    </h5>
                                                                    <span className="text-xs font-bold bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-full">
                                                                        {session.summary.excused}
                                                                    </span>
                                                                </div>
                                                                <ul className="divide-y dark:divide-gray-700/50">
                                                                    {session.records.filter(r => r.estado === 'justificado').map(r => (
                                                                        <li key={r.id} className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                                                                            {r.alumno_nombre || studentMap.get(r.alumno_id) || 'Estudiante sin nombre'}
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-12 text-center">
                                    <ClipboardCheck className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                                    <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
                                        No hay registros de asistencia
                                    </h3>
                                    <p className="text-gray-500 dark:text-gray-400">
                                        Ajusta los filtros o selecciona otra fecha para ver el historial.
                                    </p>
                                </div>
                            )}

                            {/* Delete Modal */}
                            {showDeleteModal && (
                                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
                                        <h3 className="text-xl font-bold text-red-600 mb-4 flex items-center gap-2">
                                            <div className="w-6 h-6">⚠️</div>
                                            Borrar Registros
                                        </h3>
                                        <p className="text-gray-600 dark:text-gray-300 mb-4 text-sm">
                                            Esta acción eliminará <strong>permanentemente</strong> los registros de asistencia en el rango seleccionado.
                                        </p>

                                        <div className="space-y-3 mb-6">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Desde</label>
                                                <input
                                                    type="date"
                                                    value={deleteDateStart}
                                                    onChange={e => setDeleteDateStart(e.target.value)}
                                                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hasta</label>
                                                <input
                                                    type="date"
                                                    value={deleteDateEnd}
                                                    onChange={e => setDeleteDateEnd(e.target.value)}
                                                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex gap-3 justify-end">
                                            <button
                                                onClick={() => setShowDeleteModal(false)}
                                                disabled={isDeleting}
                                                className="px-4 py-2 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                onClick={handleDeleteRange}
                                                disabled={isDeleting || !deleteDateStart || !deleteDateEnd}
                                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
                                            >
                                                {isDeleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Eliminar Definitivemente'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                }

            </div>
            {/* Print Template (Hidden unless printing) */}
            {printingSessions && (
                <div id="attendance-print-root" className="hidden print:block">
                    {printingSessions.map((session, index) => (
                        <div
                            key={`print-session-${index}-${session.className}-${session.date}`}
                            style={{ breakAfter: index < printingSessions.length - 1 ? 'page' : 'auto' }}
                        >
                            <AttendanceTemplate {...session} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
