import { useState, useEffect } from 'react';
import {
    Users, CheckCircle, AlertTriangle,
    Calendar, Clock, MessageCircle, RefreshCw
} from 'lucide-react';
import {
    clasesService,
    asistenciasService
} from '../../services/firestore';

interface DashboardStats {
    totalClassesToday: number;
    submittedCount: number;
    pendingCount: number;
    totalAbsencesToday: number;
    absenceRate: number;
}

interface PendingClass {
    id: string;
    name: string;
    teacherName: string;
    startTime: string;
    endTime: string;
}

interface StudentAbsenceRisk {
    studentId: string;
    studentName: string;
    className: string;
    absencesCount: number;
    lastAbsence: string;
}

export const DashboardTab = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<DashboardStats>({
        totalClassesToday: 0,
        submittedCount: 0,
        pendingCount: 0,
        totalAbsencesToday: 0,
        absenceRate: 0
    });

    const [pendingClasses, setPendingClasses] = useState<PendingClass[]>([]);
    const [riskStudents, setRiskStudents] = useState<StudentAbsenceRisk[]>([]);
    const [todayDate, setTodayDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        loadDashboard();
    }, []);

    const loadDashboard = async () => {
        setLoading(true);
        try {
            // 1. Get Today's Classes
            const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            // Note: Adjust timezone if needed, currently using local browser time
            const now = new Date();
            const dayName = days[now.getDay()];
            const dateStr = now.toISOString().split('T')[0];
            setTodayDate(dateStr);

            const todaysClasses = await clasesService.getClassesByDay(dayName);

            // 2. Get Today's Attendance
            // We fetch all attendance records for today to see which classes have submitted
            // Note: asistenciasService needs a query method or we use getByDateRange(today, today)
            const todaysAttendance = await asistenciasService.query('fecha', '==', dateStr);

            // Identify submitted classes ids
            const submittedClassIds = new Set(todaysAttendance.map(a => a.clase_id));

            // 3. Calculate Stats & Pending
            // Filter classes that effectively match today (sometimes getClassesByDay returns broader set if logic is loose)
            // But lets trust our service for now.

            const pending: PendingClass[] = [];
            todaysClasses.forEach(c => {
                if (!submittedClassIds.has(c.id)) {
                    // Extract time for sorting
                    let startTime = '00:00';
                    let endTime = '00:00';

                    if (c.schedule?.slots) {
                        const slot = c.schedule.slots.find(s => s.day === dayName);
                        if (slot) {
                            startTime = slot.startTime;
                            endTime = slot.endTime;
                        }
                    } else if (c.hora_inicio) {
                        startTime = c.hora_inicio;
                        endTime = c.hora_fin || '';
                    }

                    pending.push({
                        id: c.id,
                        name: c.name || c.nombre || 'Sin nombre',
                        teacherName: c.profesor_nombre || 'Sin asignar',
                        startTime,
                        endTime
                    });
                }
            });

            // Sort pending by time
            pending.sort((a, b) => a.startTime.localeCompare(b.startTime));

            // Calculate absences today
            const absencesToday = todaysAttendance.filter(a => a.estado === 'ausente').length;
            const totalRecords = todaysAttendance.length;
            const absenceRate = totalRecords > 0 ? (absencesToday / totalRecords) * 100 : 0;

            setStats({
                totalClassesToday: todaysClasses.length,
                submittedCount: submittedClassIds.size, // Unique classes submitted
                pendingCount: pending.length,
                totalAbsencesToday: absencesToday,
                absenceRate
            });
            setPendingClasses(pending);

            // 4. Calculate recurrent absences (Last 30 days)
            // This might be heavy, in a real app use a cloud function or specialized index
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const startStr = thirtyDaysAgo.toISOString().split('T')[0];

            const history = await asistenciasService.getByDateRange(startStr, dateStr);

            // Group absences by student
            const absencesByStudent: Record<string, { count: number, name: string, lastDate: string, className: string }> = {};

            history.filter(h => h.estado === 'ausente').forEach(h => {
                if (!absencesByStudent[h.alumno_id]) {
                    absencesByStudent[h.alumno_id] = {
                        count: 0,
                        name: h.alumno_nombre || 'Alumno',
                        lastDate: h.fecha,
                        className: h.clase_nombre || 'Clase'
                    };
                }
                absencesByStudent[h.alumno_id].count++;
                if (h.fecha > absencesByStudent[h.alumno_id].lastDate) {
                    absencesByStudent[h.alumno_id].lastDate = h.fecha;
                    absencesByStudent[h.alumno_id].className = h.clase_nombre || ''; // Update class to latest
                }
            });

            // Filter risk (e.g., >= 3 absences)
            const risks = Object.entries(absencesByStudent)
                .map(([id, data]) => ({
                    studentId: id,
                    studentName: data.name,
                    className: data.className,
                    absencesCount: data.count,
                    lastAbsence: data.lastDate
                }))
                .filter(r => r.absencesCount >= 3)
                .sort((a, b) => b.absencesCount - a.absencesCount)
                .slice(0, 10); // Top 10

            setRiskStudents(risks);

        } catch (error) {
            console.error('Error loading dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleWhatsAppReminder = (pc: PendingClass) => {
        // Logic to open WhatsApp pending
        // Ideally we would fetch the teacher's phone number here
        // For now, placeholder alert
        console.log('Sending reminder to:', pc.teacherName);
        window.alert(`Enviar recordatorio a ${pc.teacherName} por la clase ${pc.name}`);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 animate-spin text-green-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border dark:border-gray-700 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Clases Hoy</p>
                        <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{stats.totalClassesToday}</h3>
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <Calendar className="w-6 h-6 text-blue-500" />
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border dark:border-gray-700 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Reportadas</p>
                        <div className="flex items-end gap-2">
                            <h3 className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.submittedCount}</h3>
                            <span className="text-xs text-gray-400 mb-1">
                                {stats.totalClassesToday > 0
                                    ? Math.round((stats.submittedCount / stats.totalClassesToday) * 100)
                                    : 0}%
                            </span>
                        </div>
                    </div>
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <CheckCircle className="w-6 h-6 text-green-500" />
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border dark:border-gray-700 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Pendientes</p>
                        <h3 className="text-2xl font-bold text-orange-500">{stats.pendingCount}</h3>
                    </div>
                    <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                        <Clock className="w-6 h-6 text-orange-500" />
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border dark:border-gray-700 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Índice Ausentismo</p>
                        <h3 className="text-2xl font-bold text-red-500">{stats.absenceRate.toFixed(1)}%</h3>
                    </div>
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <AlertTriangle className="w-6 h-6 text-red-500" />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pending Classes List */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 flex justify-between items-center">
                        <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-orange-500" />
                            Pendientes de Asistencia
                        </h3>
                        <span className="text-xs font-medium px-2 py-1 bg-white dark:bg-gray-700 rounded border dark:border-gray-600 text-gray-500">
                            {todayDate}
                        </span>
                    </div>
                    <div className="flex-1 overflow-auto max-h-[350px]">
                        {pendingClasses.length > 0 ? (
                            <div className="divide-y dark:divide-gray-700">
                                {pendingClasses.map(pc => (
                                    <div key={pc.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors flex items-center justify-between group">
                                        <div>
                                            <div className="font-medium text-gray-800 dark:text-gray-200">{pc.name}</div>
                                            <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-2">
                                                <span>{pc.startTime} - {pc.endTime}</span>
                                                <span>•</span>
                                                <span className="text-indigo-600 dark:text-indigo-400">{pc.teacherName}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleWhatsAppReminder(pc)}
                                            className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Enviar recordatorio WhatsApp"
                                        >
                                            <MessageCircle className="w-5 h-5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                                <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-400 opacity-50" />
                                <p>¡Todo al día! No hay clases pendientes.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Risk Students List */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                        <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                            Ausencias Recurrentes (30 días)
                        </h3>
                    </div>
                    <div className="flex-1 overflow-auto max-h-[350px]">
                        {riskStudents.length > 0 ? (
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 font-medium">
                                    <tr>
                                        <th className="px-4 py-3">Alumno</th>
                                        <th className="px-4 py-3 text-center">Faltas</th>
                                        <th className="px-4 py-3 text-right">Más Reciente</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-gray-700">
                                    {riskStudents.map(student => (
                                        <tr key={student.studentId} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-gray-800 dark:text-gray-200">{student.studentName}</div>
                                                <div className="text-xs text-gray-500">{student.className}</div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-bold text-xs">
                                                    {student.absencesCount}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">
                                                {new Date(student.lastAbsence + 'T12:00:00').toLocaleDateString('es-ES', {
                                                    day: 'numeric', month: 'short'
                                                })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                                <Users className="w-12 h-12 mx-auto mb-2 text-gray-300 opacity-50" />
                                <p>No hay alumnos con 3+ faltas recientes.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
