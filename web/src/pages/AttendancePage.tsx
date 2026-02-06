
/**
 * AttendancePage - Daily attendance control
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    ClipboardCheck, Calendar, Users, CheckCircle, XCircle, Clock,
    RefreshCw, Bell, Save, LayoutDashboard
} from 'lucide-react';
import {
    clasesService,
    alumnosService,
    asistenciasService,
    Asistencia
} from '../services/firestore';
import { DashboardTab } from '../components/attendance/DashboardTab';

interface ClassGroup {
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
    status: 'present' | 'absent' | 'late' | 'excused';
    note?: string;
}

type TabType = 'dashboard' | 'today' | 'report' | 'rules';

export const AttendancePage = () => {
    // const navigate = useNavigate(); // Unused
    const [searchParams] = useSearchParams();
    const urlClassId = searchParams.get('classId');

    const [activeTab, setActiveTab] = useState<TabType>('dashboard');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [classes, setClasses] = useState<ClassGroup[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [attendance, setAttendance] = useState<Map<string, AttendanceRecord>>(new Map());
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // History state
    const [historyDateStart, setHistoryDateStart] = useState(
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    );
    const [historyDateEnd, setHistoryDateEnd] = useState(new Date().toISOString().split('T')[0]);
    const [historyRecords, setHistoryRecords] = useState<Asistencia[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

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
            const data = await clasesService.getAllClases();
            const mappedClasses = data.map((c: any) => ({
                id: c.id,
                name: c.nombre || c.name || 'Sin nombre',
                program: c.instrumento || c.instrument || '',
                level: (c as any).nivel || ''
            }));
            setClasses(mappedClasses);

            // Priority: URL Param > Existing Selection > First class
            if (urlClassId) {
                setSelectedClass(urlClassId);
            } else if (mappedClasses.length > 0 && !selectedClass) {
                setSelectedClass(mappedClasses[0].id);
            }
        } catch (err) {
            console.error('Error loading classes:', err);
        }
    };

    const loadStudentsForClass = async (classId: string) => {
        setLoading(true);
        try {
            const classDoc = await clasesService.getById(classId);
            if (!classDoc) {
                setStudents([]);
                return;
            }

            const studentIds = classDoc.studentIds || classDoc.alumno_ids || [];

            // Load each student details
            const studentDocs = await Promise.all(
                studentIds.map(id => alumnosService.getById(id))
            );

            const mappedStudents = studentDocs
                .filter((s): s is any => s !== null)
                .map((s: any) => ({
                    id: s.id,
                    firstName: s.nombre || '',
                    lastName: s.apellido || '',
                    program: s.instrumento || '',
                    instrument: s.instrumento || ''
                }));

            setStudents(mappedStudents);

            // Fetch existing attendance from Firestore
            const existingAttendance = await asistenciasService.query('clase_id', '==', classId);
            const dateFiltered = existingAttendance.filter(a => a.fecha === selectedDate);

            const newAttendance = new Map<string, AttendanceRecord>();

            // Initialize with defaults (presente)
            mappedStudents.forEach((student: any) => {
                newAttendance.set(student.id, { studentId: student.id, status: 'present' });
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
                const uiStatus = stateMap[record.estado] || 'present';
                newAttendance.set(record.alumno_id, {
                    studentId: record.alumno_id,
                    status: uiStatus,
                    note: record.observaciones
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

    const saveAttendance = async () => {
        if (!selectedClass || students.length === 0) return;

        setSaving(true);
        try {
            const classDoc = await clasesService.getById(selectedClass);
            const class_nombre = classDoc?.nombre || classDoc?.name || 'Clase';

            // Map UI status back to Firestore status
            const statusMap: Record<AttendanceRecord['status'], Asistencia['estado']> = {
                'present': 'presente',
                'absent': 'ausente',
                'late': 'tardanza',
                'excused': 'justificado'
            };

            // Process each record
            for (const student of students) {
                const record = attendance.get(student.id);
                if (!record) continue;

                // Find existing record to update or create new
                const existing = await asistenciasService.query('clase_id', '==', selectedClass);
                const match = existing.find(a => a.alumno_id === student.id && a.fecha === selectedDate);

                const attendanceData: Omit<Asistencia, 'id'> = {
                    alumno_id: student.id,
                    alumno_nombre: `${student.firstName} ${student.lastName}`,
                    clase_id: selectedClass,
                    clase_nombre: class_nombre,
                    fecha: selectedDate,
                    estado: statusMap[record.status],
                    observaciones: record.note,
                    activo: true
                };

                if (match) {
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

        alert(`Se generarán ${absentStudents.length} borradores de notificación.`);
    };

    const loadHistory = async () => {
        if (!selectedClass) return;
        setHistoryLoading(true);
        try {
            const records = await asistenciasService.getByDateRange(historyDateStart, historyDateEnd);
            // Filter by class manually as getByDateRange doesn't filter by class
            const filtered = records.filter(r => r.clase_id === selectedClass);
            setHistoryRecords(filtered);
        } catch (err) {
            console.error('Error loading history:', err);
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'report' && selectedClass) {
            loadHistory();
        }
    }, [activeTab, selectedClass, historyDateStart, historyDateEnd]);

    const getStatusCounts = () => {
        const counts = { present: 0, absent: 0, late: 0, excused: 0 };
        attendance.forEach(record => {
            counts[record.status]++;
        });
        return counts;
    };

    const counts = getStatusCounts();

    const tabs: { id: TabType; label: string; icon: any }[] = [
        { id: 'dashboard', label: 'Tablero', icon: LayoutDashboard },
        { id: 'today', label: 'Registrar', icon: Calendar },
        { id: 'report', label: 'Historial', icon: ClipboardCheck },
        { id: 'rules', label: 'Configuración', icon: Bell },
    ];

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6">
            <div className="max-w-5xl mx-auto">
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

                {activeTab === 'today' && (
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
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex items-end">
                                    <button
                                        onClick={() => loadStudentsForClass(selectedClass)}
                                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-gray-700 dark:text-gray-300 transition-colors"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                        Recargar
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-4 gap-3">
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
                        </div>

                        {loading ? (
                            <div className="flex items-center justify-center h-48">
                                <RefreshCw className="w-8 h-8 animate-spin text-green-500" />
                            </div>
                        ) : students.length > 0 ? (
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
                                            </div>
                                        );
                                    })}
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

                        {students.length > 0 && (
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
                                    onClick={generateDrafts}
                                    disabled={counts.absent === 0}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
                                >
                                    <Bell className="w-5 h-5" />
                                    Generar Borradores ({counts.absent})
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'report' && (
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
                                        <option value="">Seleccionar clase...</option>
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
                                <div className="flex items-end">
                                    <button
                                        onClick={loadHistory}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
                                    >
                                        <RefreshCw className={`w-4 h-4 ${historyLoading ? 'animate-spin' : ''}`} />
                                        Ver Historial
                                    </button>
                                </div>
                            </div>
                        </div>

                        {historyLoading ? (
                            <div className="flex items-center justify-center h-48">
                                <RefreshCw className="w-8 h-8 animate-spin text-green-500" />
                            </div>
                        ) : historyRecords.length > 0 ? (
                            <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 overflow-hidden shadow-sm">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 text-sm uppercase font-semibold">
                                            <tr>
                                                <th className="px-6 py-4">Fecha</th>
                                                <th className="px-6 py-4">Alumno</th>
                                                <th className="px-6 py-4">Estado</th>
                                                <th className="px-6 py-4">Observaciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y dark:divide-gray-700">
                                            {historyRecords.map((record) => (
                                                <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                                    <td className="px-6 py-4 text-sm dark:text-gray-300">
                                                        <div className="flex items-center gap-2">
                                                            <Calendar className="w-4 h-4 text-gray-400" />
                                                            {new Date(record.fecha + 'T12:00:00').toLocaleDateString('es-ES', {
                                                                day: '2-digit',
                                                                month: 'short',
                                                                year: 'numeric'
                                                            })}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                                            {record.alumno_nombre}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${record.estado === 'presente' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                            record.estado === 'ausente' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                                record.estado === 'tardanza' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                                                    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                            }`}>
                                                            {record.estado.toUpperCase()}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 italic">
                                                        {record.observaciones || '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-12 text-center">
                                <ClipboardCheck className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                                <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
                                    No hay registros de asistencia
                                </h3>
                                <p className="text-gray-500 dark:text-gray-400">
                                    Ajusta los filtros o selecciona otra clase para ver el historial.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'rules' && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-8 text-center">
                        <Bell className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
                            Automatizaciones
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-4">
                            Configura reglas para generar notificaciones automáticas.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
