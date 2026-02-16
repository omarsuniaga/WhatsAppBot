import { useState, useEffect } from 'react';
import {
    Users, CheckCircle, AlertTriangle,
    Calendar, Clock, MessageCircle, RefreshCw, TrendingDown,
    X, ChevronRight, HelpCircle
} from 'lucide-react';
import {
    XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, AreaChart, Area, Legend
} from 'recharts';
import { clasesService, asistenciasService, maestrosService, broadcastsService, contactosService } from '../../services/firestore';
import { Maestro } from '../../services/firestore/maestrosService';
import { messageApi } from '../../api/client';

type FilterPeriod = 'today' | 'week' | 'month' | 'custom';

interface DashboardStats {
    totalClassesToday: number;
    submittedCount: number;
    pendingCount: number;
    totalAbsencesToday: number;
    absenceRate: number;
}

interface MonthlyStats {
    presentRate: number;
    absentRate: number;
    lateRate: number;
    justifiedRate: number;
    totalRecords: number;
}

interface PendingClass {
    id: string;
    name: string;
    teacherName: string;
    teacherId?: string;
    teacherPhone?: string;
    startTime: string;
    endTime: string;
}

interface StudentAbsenceRisk {
    studentId: string;
    studentName: string;
    className: string;
    absencesCount: number;
    lastAbsence: string;
    trend?: string[];
}

interface HelpInfo {
    title: string;
    description: string;
    details?: string[];
    icon?: any;
    color?: string;
}

export const DashboardTab = () => {
    // Core States
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<DashboardStats>({
        totalClassesToday: 0,
        submittedCount: 0,
        pendingCount: 0,
        totalAbsencesToday: 0,
        absenceRate: 0
    });

    const [monthlyStats, setMonthlyStats] = useState<MonthlyStats>({
        presentRate: 0,
        absentRate: 0,
        lateRate: 0,
        justifiedRate: 0,
        totalRecords: 0
    });

    const [pendingClasses, setPendingClasses] = useState<PendingClass[]>([]);
    const [riskStudents, setRiskStudents] = useState<StudentAbsenceRisk[]>([]);
    const [peakAbsenceDay, setPeakAbsenceDay] = useState<{ day: string; count: number }>({ day: '-', count: 0 });
    const [trendData, setTrendData] = useState<any[]>([]);
    const [showHelp, setShowHelp] = useState<HelpInfo | null>(null);

    // Period selection (from Professional Control)
    const [period, setPeriod] = useState<FilterPeriod>('today');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [contacts, setContacts] = useState<any[]>([]);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [activeObservations, setActiveObservations] = useState<any[]>([]);

    // Feature States
    const [maestros, setMaestros] = useState<Maestro[]>([]);
    const [showAssignModal, setShowAssignModal] = useState<PendingClass | null>(null);
    const [showReminderModal, setShowReminderModal] = useState<PendingClass | null>(null);
    const [reminderText, setReminderText] = useState('');
    const [schedulingDate, setSchedulingDate] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const helpContent: Record<string, HelpInfo> = {
        clasesHoy: {
            title: "Clases Hoy",
            description: "Total de sesiones programadas para el día de hoy según el calendario institucional.",
            details: ["Incluye todas las secciones y materias activas.", "Se actualiza automáticamente cada día."],
            icon: Calendar,
            color: "text-blue-500"
        },
        reportadas: {
            title: "Reportadas",
            description: "Cantidad de clases que ya cuentan con un reporte de asistencia enviado por el profesor.",
            details: ["Indica que la lista ya fue procesada.", "Es la base para el cálculo de cumplimiento."],
            icon: CheckCircle,
            color: "text-green-500"
        },
        pendientes: {
            title: "Pendientes",
            description: "Clases que ya han iniciado o terminado pero aún no tienen el reporte de asistencia cargado.",
            details: ["Requiere atención del personal administrativo.", "Puedes enviar recordatorios por WhatsApp desde la lista inferior."],
            icon: Clock,
            color: "text-orange-500"
        },
        diaCritico: {
            title: "Día Crítico",
            description: "El día de la semana con mayor volumen de ausencias acumuladas en los últimos 30 días.",
            details: ["Ayuda a detectar patrones de deserción semanal.", "Basado en faltas reales registradas."],
            icon: TrendingDown,
            color: "text-red-500"
        },
        tendencia: {
            title: "Tendencia de Asistencia",
            description: "Visualización histórica de los 4 estados principales a lo largo del último mes.",
            details: [
                "Verde: Alumnos presentes.",
                "Rojo: Ausencias totales.",
                "Naranja: Llegadas tarde.",
                "Azul: Justificaciones aprobadas."
            ],
            icon: Users,
            color: "text-indigo-500"
        },
        cumplimiento: {
            title: "Cumplimiento de Reportes",
            description: "Porcentaje de eficiencia de los profesores en el envío de sus listas de asistencia diaria.",
            details: ["Meta ideal: > 95%.", "Calculado sobre el total de clases que ya debieron reportar."],
            icon: CheckCircle,
            color: "text-green-600"
        },
        distribucion: {
            title: "Distribución Mensual",
            description: "Desglose porcentual del total de registros individuales del mes.",
            details: ["Permite ver la salud general de la institución.", "Incluye registros de reportes tanto individuales como masivos."],
            icon: RefreshCw,
            color: "text-emerald-500"
        }
    };

    useEffect(() => {
        loadDashboard();
    }, [startDate, endDate]);

    // Update dates based on period
    useEffect(() => {
        const today = new Date();
        const yyyyMmDd = (d: Date) => d.toISOString().split('T')[0];

        switch (period) {
            case 'today':
                setStartDate(yyyyMmDd(today));
                setEndDate(yyyyMmDd(today));
                break;
            case 'week': {
                const day = today.getDay();
                const diff = today.getDate() - day + (day === 0 ? -6 : 1);
                const monday = new Date(today.setDate(diff));
                setStartDate(yyyyMmDd(monday));
                setEndDate(yyyyMmDd(new Date()));
                break;
            }
            case 'month': {
                const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                setStartDate(yyyyMmDd(firstDay));
                setEndDate(yyyyMmDd(new Date()));
                break;
            }
        }
    }, [period]);

    const loadDashboard = async () => {
        setLoading(true);
        try {
            // 1. Context & Setup
            const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            const today = new Date();
            const realTodayStr = today.toLocaleDateString('en-CA');
            const dayNameToday = days[today.getDay()];

            // 2. Data Fetching
            const [allClasses, rangeAttendance, allContacts, activeMaestros] = await Promise.all([
                clasesService.getAllClases(true),
                asistenciasService.getByDateRange(startDate, endDate),
                contactosService.getAllContactos(),
                maestrosService.getActiveTeachers()
            ]);

            setContacts(allContacts);
            setMaestros(activeMaestros);

            // 3. Today's Context (for Pending & Absences Today)
            const todaysAttendance = rangeAttendance.filter(a => a.fecha === realTodayStr);
            const todaysClasses = allClasses.filter((c: any) => {
                if (c.schedule?.slots) return c.schedule.slots.some((s: any) => s.day === dayNameToday);
                if (c.dias) return c.dias.includes(dayNameToday);
                if (c.dia) return c.dia === dayNameToday;
                if (c.fechas) return c.fechas.includes(realTodayStr);
                return false;
            });

            // Identify submitted classes ids for Today
            const submittedClassIds = new Set(todaysAttendance.map((a: any) => a.clase_id || a.classId));

            // Calculate Pending Today
            const pending: PendingClass[] = [];
            todaysClasses.forEach((c: any) => {
                if (!submittedClassIds.has(c.id)) {
                    let startTime = '00:00';
                    let endTime = '00:00';

                    if (c.schedule?.slots) {
                        const slot = c.schedule.slots.find((s: any) => s.day === dayNameToday);
                        if (slot) {
                            startTime = slot.startTime;
                            endTime = slot.endTime;
                        }
                    } else if (c.hora_inicio) {
                        startTime = c.hora_inicio;
                        endTime = c.hora_fin || '';
                    }

                    const pc: PendingClass = {
                        id: c.id,
                        name: c.name || c.nombre || 'Sin nombre',
                        teacherName: c.profesor_nombre || c.maestroNombre || 'Sin asignar',
                        teacherId: c.teacherId || c.profesor_id,
                        startTime,
                        endTime
                    };

                    // Attach teacher phone
                    if (pc.teacherId) {
                        const m = activeMaestros.find(m => m.id === pc.teacherId);
                        if (m) pc.teacherPhone = m.phone;
                    }

                    pending.push(pc);
                }
            });
            pending.sort((a, b) => a.startTime.localeCompare(b.startTime));
            setPendingClasses(pending);

            // 4. Global Stats for SELECTED RANGE
            const totalAbsencesInRange = rangeAttendance.filter((a: any) =>
                a.estado === 'ausente' || a.status === 'absent' || a.estado === 'absent'
            ).length;
            const totalRecordsInRange = rangeAttendance.length;
            const absenceRateInRange = totalRecordsInRange > 0 ? (totalAbsencesInRange / totalRecordsInRange) * 100 : 0;

            setStats({
                totalClassesToday: todaysClasses.length, // Keep today's context for these specific KPIs
                submittedCount: submittedClassIds.size,
                pendingCount: pending.length,
                totalAbsencesToday: totalAbsencesInRange, // This now reflects the RANGE sum
                absenceRate: absenceRateInRange
            });

            // 5. Distribution for SELECTED RANGE
            if (totalRecordsInRange > 0) {
                const present = rangeAttendance.filter(h => h.estado === 'presente' || (h as any).status === 'present').length;
                const absent = rangeAttendance.filter(h => h.estado === 'ausente' || (h as any).status === 'absent').length;
                const late = rangeAttendance.filter(h => h.estado === 'tardanza' || (h as any).status === 'late').length;
                const justified = rangeAttendance.filter(h => h.estado === 'justificado' || (h as any).status === 'justified').length;

                setMonthlyStats({
                    presentRate: (present / totalRecordsInRange) * 100,
                    absentRate: (absent / totalRecordsInRange) * 100,
                    lateRate: (late / totalRecordsInRange) * 100,
                    justifiedRate: (justified / totalRecordsInRange) * 100,
                    totalRecords: totalRecordsInRange
                });
            }

            // 6. History for Trends (Always show last 30 days regardless of filter to maintain context)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const startHistoryStr = thirtyDaysAgo.toLocaleDateString('en-CA');
            const history = await asistenciasService.getByDateRange(startHistoryStr, realTodayStr);

            // Monthly breakdown
            const mTotal = history.length;
            if (mTotal > 0) {
                const present = history.filter(h => h.estado === 'presente' || (h as any).status === 'present').length;
                const absent = history.filter(h => h.estado === 'ausente' || (h as any).status === 'absent').length;
                const late = history.filter(h => h.estado === 'tardanza' || (h as any).status === 'late').length;
                const justified = history.filter(h => h.estado === 'justificado' || (h as any).status === 'justified').length;

                setMonthlyStats({
                    presentRate: (present / mTotal) * 100,
                    absentRate: (absent / mTotal) * 100,
                    lateRate: (late / mTotal) * 100,
                    justifiedRate: (justified / mTotal) * 100,
                    totalRecords: mTotal
                });
            }

            // Group absences by student
            const absencesByStudent: Record<string, { count: number, name: string, lastDate: string, className: string }> = {};

            history.filter((h: any) =>
                h.estado === 'ausente' || h.status === 'absent' || h.estado === 'absent'
            ).forEach((h: any) => {
                const studentId = h.alumno_id || h.studentId;
                if (!studentId) return;
                if (!absencesByStudent[studentId]) {
                    absencesByStudent[studentId] = {
                        count: 0,
                        name: h.alumno_nombre || h.studentName || 'Alumno',
                        lastDate: h.fecha,
                        className: h.clase_nombre || h.className || 'Clase'
                    };
                }
                absencesByStudent[studentId].count++;
                if (h.fecha > absencesByStudent[studentId].lastDate) {
                    absencesByStudent[studentId].lastDate = h.fecha;
                    absencesByStudent[studentId].className = h.clase_nombre || h.className || '';
                }
            });

            // Filter risk (>= 3 absences)
            const risks = Object.entries(absencesByStudent)
                .map(([id, data]) => ({
                    studentId: id,
                    studentName: data.name,
                    className: data.className,
                    absencesCount: data.count,
                    lastAbsence: data.lastDate,
                    trend: history
                        .filter(h => h.alumno_id === id)
                        .slice(0, 5)
                        .map(h => h.estado)
                        .reverse()
                }))
                .filter(r => r.absencesCount >= 3)
                .sort((a, b) => b.absencesCount - a.absencesCount)
                .slice(0, 10);

            setRiskStudents(risks);

            // 5. Calculate Peak Absence Day
            const dayAbsences: Record<string, number> = {};
            history.filter(h =>
                h.estado === 'ausente' || (h as any).status === 'absent' || (h as any).estado === 'absent'
            ).forEach(h => {
                const day = new Date(h.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long' });
                // Capitalize first letter
                const capitalizedDay = day.charAt(0).toUpperCase() + day.slice(1);
                dayAbsences[capitalizedDay] = (dayAbsences[capitalizedDay] || 0) + 1;
            });

            const peak = Object.entries(dayAbsences).sort((a, b) => b[1] - a[1])[0];
            if (peak) {
                setPeakAbsenceDay({ day: peak[0], count: peak[1] });
            }

            // 6. Calculate 30-day trend for ALL statuses
            const trend = [];
            for (let i = 29; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dStr = d.toLocaleDateString('en-CA');

                const dayRecords = history.filter((h: any) => h.fecha === dStr);

                const presentCount = dayRecords.filter(h => h.estado === 'presente' || (h as any).status === 'present').length;
                const absentCount = dayRecords.filter(h => h.estado === 'ausente' || (h as any).status === 'absent').length;
                const lateCount = dayRecords.filter(h => h.estado === 'tardanza' || (h as any).status === 'late' || (h as any).estado === 'tarde').length;
                const justifiedCount = dayRecords.filter(h => h.estado === 'justificado' || (h as any).status === 'justified').length;

                trend.push({
                    name: d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
                    presentes: presentCount,
                    ausencias: absentCount,
                    tardanzas: lateCount,
                    justificados: justifiedCount
                });
            }
            setTrendData(trend);

            // 7. Extract Observations for the Feed (dedup by class+date+text)
            const observationMap = new Map<string, any>();

            rangeAttendance.forEach((a: any) => {
                const observationText = (a.observaciones || '').trim();
                if (!observationText) return;

                const classId = a.clase_id || a.classId || 'sin-clase';
                const className = a.clase_nombre || a.className || 'Clase';
                const date = a.fecha || '';
                const studentId = a.alumno_id || a.studentId || '';
                const studentName = a.alumno_nombre || a.studentName || 'Alumno';

                const observationKey = `${classId}|${date}|${observationText.toLowerCase()}`;

                if (!observationMap.has(observationKey)) {
                    observationMap.set(observationKey, {
                        id: a.id || observationKey,
                        observationKey,
                        fecha: date,
                        clase_id: classId,
                        clase_nombre: className,
                        observaciones: observationText,
                        alumno_id: studentId,
                        alumno_nombre: studentName,
                        studentCount: 1
                    });
                    return;
                }

                const existing = observationMap.get(observationKey);
                existing.studentCount += 1;
            });

            const observations = Array.from(observationMap.values())
                .sort((a, b) => b.fecha.localeCompare(a.fecha))
                .slice(0, 15); // Limit to top 15 grouped observations

            setActiveObservations(observations);

        } catch (error) {
            console.error('Error loading dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleWhatsAppReminder = (pc: PendingClass) => {
        if (!pc.teacherId || pc.teacherName === 'Sin asignar') {
            setShowAssignModal(pc);
            return;
        }

        const message = `Hola ${pc.teacherName.split(' ')[0]}, espero que estés bien. 👋\n\nTe escribo para recordarte que aún no hemos recibido el reporte de asistencia de tu clase "${pc.name}" (${pc.startTime}).\n\nPor favor, asegúrate de registrarla en la plataforma lo antes posible. ¡Gracias! ✨`;

        setReminderText(message);
        setShowReminderModal(pc);
    };

    const handleAssignTeacher = async (maestro: Maestro) => {
        if (!showAssignModal) return;

        try {
            await clasesService.assignTeacherToClasses([showAssignModal.id], maestro.id!, maestro.name);
            setShowAssignModal(null);
            loadDashboard(); // Refresh
        } catch (error) {
            console.error('Error assigning teacher:', error);
            alert('Error al asignar maestro');
        }
    };

    const handleSendReminder = async (isScheduled: boolean) => {
        if (!showReminderModal) return;

        try {
            const broadcastData: any = {
                nombre: `Recordatorio: ${showReminderModal.name}`,
                mensaje: reminderText,
                destinatarios: [showReminderModal.teacherPhone || ''],
                estado: isScheduled ? 'programado' : 'enviando',
                tipo: 'texto',
                creado_por: 'Sistema Dashboard'
            };

            if (isScheduled && schedulingDate) {
                broadcastData.fecha_programada = new Date(schedulingDate);
            }

            await broadcastsService.create(broadcastData);
            setShowReminderModal(null);
            alert(isScheduled ? 'Mensaje programado con éxito' : 'Mensaje puesto en cola de envío');
        } catch (error) {
            console.error('Error sending reminder:', error);
            alert('Error al procesar el envío');
        }
    };

    const handleAlertParent = async (s: any) => {
        setActionLoading(s.studentId);
        try {
            const message = `*ALERTA DE ASISTENCIA*\n\nEstimado representante de *${s.studentName}*, le informamos que el alumno ha acumulado *${s.absencesCount} inasistencias* en el periodo del *${startDate}* al *${endDate}*. Por favor, comuníquese con la administración para coordinar su regularización.`;

            // Lookup student contact to find JID or phone
            const contact = contacts.find(c => c.alumno_id === s.studentId || c.nombre === s.studentName);
            const target = contact?.whatsapp || contact?.phone || '59170000000'; // Fallback

            await messageApi.sendText(target, message);
            alert(`✅ Mensaje enviado a los padres de ${s.studentName}`);
        } catch (err) {
            console.error('Error alerting parent:', err);
            alert('❌ No se pudo enviar el mensaje');
        } finally {
            setActionLoading(null);
        }
    };

    const today = new Date();
    const realTodayStr = today.toLocaleDateString('en-CA');
    const isTodayInRange = realTodayStr >= startDate && realTodayStr <= endDate;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 animate-spin text-green-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header & Period Selection (from Professional Control) */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                <div>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                        Análisis del Periodo: {startDate} al {endDate}
                    </p>
                </div>

                <div className="flex bg-white dark:bg-gray-800 p-1 rounded-xl border dark:border-gray-700 shadow-sm self-end">
                    {(['today', 'week', 'month', 'custom'] as const).map((p) => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${period === p
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                                }`}
                        >
                            {p === 'today' ? 'Hoy' : p === 'week' ? 'Semana' : p === 'month' ? 'Mes' : 'Personalizado'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Custom Range Filter */}
            {period === 'custom' && (
                <div className="flex items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700 animate-in slide-in-from-top duration-300">
                    <div className="flex items-center gap-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Inicio</label>
                        <input
                            type="date"
                            className="bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded px-2 py-1 text-xs dark:text-gray-200"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Fin</label>
                        <input
                            type="date"
                            className="bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded px-2 py-1 text-xs dark:text-gray-200"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={loadDashboard}
                        className="ml-auto p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-200"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border dark:border-gray-700 shadow-sm flex items-center justify-between group">
                    <div>
                        <div className="flex items-center gap-1.5 mb-1">
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Clases Hoy</p>
                            <button onClick={() => setShowHelp(helpContent.clasesHoy)} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-blue-500">
                                <HelpCircle className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{stats.totalClassesToday}</h3>
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <Calendar className="w-6 h-6 text-blue-500" />
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border dark:border-gray-700 shadow-sm flex items-center justify-between group">
                    <div>
                        <div className="flex items-center gap-1.5 mb-1">
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Reportadas</p>
                            <button onClick={() => setShowHelp(helpContent.reportadas)} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-green-500">
                                <HelpCircle className="w-3.5 h-3.5" />
                            </button>
                        </div>
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

                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border dark:border-gray-700 shadow-sm flex items-center justify-between group">
                    <div>
                        <div className="flex items-center gap-1.5 mb-1">
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Pendientes</p>
                            <button onClick={() => setShowHelp(helpContent.pendientes)} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-orange-500">
                                <HelpCircle className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <h3 className="text-2xl font-bold text-orange-500">{stats.pendingCount}</h3>
                    </div>
                    <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                        <Clock className="w-6 h-6 text-orange-500" />
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border dark:border-gray-700 shadow-sm flex items-center justify-between group">
                    <div>
                        <div className="flex items-center gap-1.5 mb-1">
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Día Crítico</p>
                            <button onClick={() => setShowHelp(helpContent.diaCritico)} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500">
                                <HelpCircle className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">{peakAbsenceDay.day}</h3>
                            <span className="text-xs text-red-500 font-medium">({peakAbsenceDay.count} aus.)</span>
                        </div>
                    </div>
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <TrendingDown className="w-6 h-6 text-red-500" />
                    </div>
                </div>
            </div>

            {/* Visual Charts Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border dark:border-gray-700 shadow-sm flex flex-col group">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tendencia de Asistencia (30 días)</h3>
                        <button onClick={() => setShowHelp(helpContent.tendencia)} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-indigo-500">
                            <HelpCircle className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="w-full">
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={trendData}>
                                <defs>
                                    <linearGradient id="colorPres" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorAus" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                                    minTickGap={20}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#fff',
                                        borderRadius: '8px',
                                        border: 'none',
                                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                    }}
                                />
                                <Legend verticalAlign="top" height={36} iconType="circle" />
                                <Area
                                    type="monotone"
                                    dataKey="presentes"
                                    name="Presentes"
                                    stroke="#22c55e"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorPres)"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="ausencias"
                                    name="Ausentes"
                                    stroke="#ef4444"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorAus)"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="tardanzas"
                                    name="Tardanzas"
                                    stroke="#f59e0b"
                                    strokeWidth={2}
                                    fill="transparent"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="justificados"
                                    name="Justif."
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                    fill="transparent"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border dark:border-gray-700 shadow-sm group">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cumplimiento de Reportes</h3>
                        <button onClick={() => setShowHelp(helpContent.cumplimiento)} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-green-500">
                            <HelpCircle className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex items-center justify-around">
                        <div className="relative w-32 h-32">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle
                                    cx="64"
                                    cy="64"
                                    r="58"
                                    stroke="currentColor"
                                    strokeWidth="12"
                                    fill="transparent"
                                    className="text-gray-100 dark:text-gray-700"
                                />
                                <circle
                                    cx="64"
                                    cy="64"
                                    r="58"
                                    stroke="currentColor"
                                    strokeWidth="12"
                                    fill="transparent"
                                    strokeDasharray={364.4}
                                    strokeDashoffset={364.4 * (1 - (stats.totalClassesToday > 0 ? stats.submittedCount / stats.totalClassesToday : 0))}
                                    className="text-green-500 transition-all duration-1000 ease-out"
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                <span className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                                    {stats.totalClassesToday > 0
                                        ? Math.round((stats.submittedCount / stats.totalClassesToday) * 100)
                                        : 0}%
                                </span>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                <span className="text-sm text-gray-600 dark:text-gray-400">Enviados: <span className="font-bold">{stats.submittedCount}</span></span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                                <span className="text-sm text-gray-600 dark:text-gray-400">Pendientes: <span className="font-bold">{stats.pendingCount}</span></span>
                            </div>
                            <div className="mt-2 pt-2 border-t dark:border-gray-700">
                                <p className="text-xs text-gray-400">Total clases hoy: {stats.totalClassesToday}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border dark:border-gray-700 shadow-sm group">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Distribución Mensual (30 días)</h3>
                        <button onClick={() => setShowHelp(helpContent.distribucion)} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-emerald-500">
                            <HelpCircle className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="space-y-4">
                        {/* Presentes */}
                        <div>
                            <div className="flex justify-between items-end mb-1">
                                <span className="text-xs font-semibold text-gray-500">Presentes</span>
                                <span className="text-sm font-bold text-green-500">{monthlyStats.presentRate.toFixed(1)}%</span>
                            </div>
                            <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500 rounded-full" style={{ width: `${monthlyStats.presentRate}%` }}></div>
                            </div>
                        </div>
                        {/* Ausentes */}
                        <div>
                            <div className="flex justify-between items-end mb-1">
                                <span className="text-xs font-semibold text-gray-500">Ausentes</span>
                                <span className="text-sm font-bold text-red-500">{monthlyStats.absentRate.toFixed(1)}%</span>
                            </div>
                            <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div className="h-full bg-red-500 rounded-full" style={{ width: `${monthlyStats.absentRate}%` }}></div>
                            </div>
                        </div>
                        {/* Tardanzas */}
                        <div>
                            <div className="flex justify-between items-end mb-1">
                                <span className="text-xs font-semibold text-gray-500">Tardanzas</span>
                                <span className="text-sm font-bold text-orange-500">{monthlyStats.lateRate.toFixed(1)}%</span>
                            </div>
                            <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div className="h-full bg-orange-500 rounded-full" style={{ width: `${monthlyStats.lateRate}%` }}></div>
                            </div>
                        </div>
                        {/* Justificados */}
                        <div>
                            <div className="flex justify-between items-end mb-1">
                                <span className="text-xs font-semibold text-gray-500">Justificados</span>
                                <span className="text-sm font-bold text-blue-500">{monthlyStats.justifiedRate.toFixed(1)}%</span>
                            </div>
                            <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${monthlyStats.justifiedRate}%` }}></div>
                            </div>
                        </div>
                        <div className="pt-2 text-center">
                            <p className="text-[10px] text-gray-400">Basado en {monthlyStats.totalRecords} registros del mes</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pending Classes List - Only shown if range includes Today */}
                <div className={`bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm overflow-hidden flex flex-col ${!isTodayInRange ? 'opacity-50 grayscale' : ''}`}>
                    <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 flex justify-between items-center">
                        <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-orange-500" />
                            Pendientes de Asistencia Hoy
                        </h3>
                        <span className="text-xs font-medium px-2 py-1 bg-white dark:bg-gray-700 rounded border dark:border-gray-600 text-gray-500">
                            {realTodayStr}
                        </span>
                    </div>
                    {!isTodayInRange && (
                        <div className="absolute inset-0 z-10 bg-white/40 dark:bg-gray-800/40 flex items-center justify-center p-4 text-center">
                            <p className="text-sm font-bold text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 p-3 rounded-lg border shadow-lg">
                                Solo disponible para el periodo "Hoy"
                            </p>
                        </div>
                    )}
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
                                                <button
                                                    onClick={() => !pc.teacherId && setShowAssignModal(pc)}
                                                    className={`${!pc.teacherId ? 'text-red-500 hover:underline' : 'text-indigo-600 dark:text-indigo-400'}`}
                                                >
                                                    {pc.teacherName}
                                                </button>
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
                    <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 flex justify-between items-center">
                        <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                            Ausencias Recurrentes
                        </h3>
                        <span className="text-[10px] font-bold text-gray-400 uppercase">
                            {startDate} - {endDate}
                        </span>
                    </div>
                    <div className="flex-1 overflow-auto max-h-[350px]">
                        {riskStudents.length > 0 ? (
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 font-medium">
                                    <tr>
                                        <th className="px-4 py-3">Alumno</th>
                                        <th className="px-4 py-3 text-center">Faltas</th>
                                        <th className="px-4 py-3 text-right">Acción</th>
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
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-bold text-xs">
                                                        {student.absencesCount}
                                                    </span>
                                                    <div className="flex gap-0.5">
                                                        {student.trend?.map((status, i) => (
                                                            <div
                                                                key={i}
                                                                className={`w-1.5 h-1.5 rounded-full ${status === 'presente' ? 'bg-green-400' :
                                                                    status === 'ausente' ? 'bg-red-400' : 'bg-gray-300'
                                                                    }`}
                                                                title={status}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => handleAlertParent(student)}
                                                    className={`p-2 rounded-lg transition-all ${actionLoading === student.studentId
                                                        ? 'bg-gray-100 animate-pulse'
                                                        : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                                                        }`}
                                                    title="Alertar a padres (WhatsApp)"
                                                    disabled={actionLoading === student.studentId}
                                                >
                                                    {actionLoading === student.studentId
                                                        ? <RefreshCw className="w-4 h-4 animate-spin" />
                                                        : <MessageCircle className="w-5 h-5" />
                                                    }
                                                </button>
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

            {/* Observations Feed (from Professional Control) */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm overflow-hidden animate-in slide-in-from-bottom duration-500">
                <div className="p-4 border-b dark:border-gray-700 bg-indigo-50/30 dark:bg-indigo-900/10 flex items-center justify-between">
                    <h3 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        <MessageCircle className="w-5 h-5 text-indigo-500" />
                        Feed de Observaciones y Novedades
                    </h3>
                    <span className="text-xs text-gray-400 font-medium">Periodo seleccionado</span>
                </div>
                <div className="p-0 max-h-[400px] overflow-y-auto">
                    {activeObservations.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x dark:divide-gray-700">
                            {activeObservations.map((obs, idx) => (
                                <div key={`${obs.observationKey || obs.id || 'obs'}-${idx}`} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors flex flex-col justify-between">
                                    <div className="mb-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider truncate max-w-[120px]">
                                                {obs.clase_nombre || 'Clase'}
                                            </span>
                                            <span className="text-[10px] text-gray-400 font-medium">
                                                {obs.fecha}
                                            </span>
                                        </div>
                                        <h4 className="font-semibold text-gray-800 dark:text-gray-100 text-sm mb-2 italic">
                                            "{obs.observaciones}"
                                        </h4>
                                    </div>
                                    <div className="flex items-center gap-2 mt-auto pt-2 border-t dark:border-gray-700">
                                        <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-500">
                                            {(obs.alumno_nombre || 'A').charAt(0)}
                                        </div>
                                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate">
                                            {obs.studentCount > 1 ? `${obs.studentCount} alumnos` : (obs.alumno_nombre || 'Alumno')}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-12 text-center text-gray-500">
                            <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-10" />
                            <p>No se han registrado observaciones en este periodo</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Help Modal */}
            {showHelp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className={`p-6 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 border-b dark:border-gray-700 flex justify-between items-start`}>
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl bg-white dark:bg-gray-700 shadow-sm`}>
                                    <showHelp.icon className={`w-6 h-6 ${showHelp.color}`} />
                                </div>
                                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">{showHelp.title}</h3>
                            </div>
                            <button
                                onClick={() => setShowHelp(null)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-lg">
                                {showHelp.description}
                            </p>
                            {showHelp.details && (
                                <div className="space-y-3 pt-2">
                                    {showHelp.details.map((detail, i) => (
                                        <div key={i} className="flex items-start gap-3">
                                            <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500" />
                                            <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">{detail}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 flex justify-end">
                            <button
                                onClick={() => setShowHelp(null)}
                                className="px-6 py-2 bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl font-semibold hover:opacity-90 transition-opacity"
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Teacher Assignment Modal */}
            {showAssignModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 italic">Asignar Maestro a: <span className="text-indigo-500 not-italic">{showAssignModal.name}</span></h3>
                            <button onClick={() => setShowAssignModal(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                        <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                            <input
                                type="text"
                                placeholder="Buscar maestro..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full px-4 py-2 rounded-xl border dark:border-gray-600 dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <div className="overflow-y-auto flex-1 p-2">
                            {maestros
                                .filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                .map(m => (
                                    <button
                                        key={m.id}
                                        onClick={() => handleAssignTeacher(m)}
                                        className="w-full text-left p-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-colors flex items-center gap-3 group"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center font-bold text-indigo-500">
                                            {m.name.charAt(0)}
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-semibold text-gray-800 dark:text-gray-100 group-hover:text-indigo-600 transition-colors">{m.name}</div>
                                            <div className="text-xs text-gray-500 italic">{m.primaryInstrument || 'Multidisciplinario'}</div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 transition-colors" />
                                    </button>
                                ))}
                        </div>
                    </div>
                </div>
            )}

            {/* WhatsApp Preview Modal */}
            {showReminderModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
                        <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center bg-green-50 dark:bg-green-900/10">
                            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                                <MessageCircle className="w-6 h-6" />
                                <h3 className="text-xl font-bold">Enviar Recordatorio</h3>
                            </div>
                            <button onClick={() => setShowReminderModal(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Mensaje para {showReminderModal.teacherName}</label>
                                <textarea
                                    value={reminderText}
                                    onChange={(e) => setReminderText(e.target.value)}
                                    rows={6}
                                    className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-green-500 outline-none resize-none"
                                />
                            </div>

                            <div className="p-4 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/30">
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-sm font-semibold text-orange-700 dark:text-orange-400 flex items-center gap-2">
                                        <Clock className="w-4 h-4" />
                                        Programar Envío (Opcional)
                                    </label>
                                    {schedulingDate && (
                                        <button onClick={() => setSchedulingDate('')} className="text-[10px] text-orange-500 hover:underline">Limpiar</button>
                                    )}
                                </div>
                                <input
                                    type="datetime-local"
                                    value={schedulingDate}
                                    onChange={(e) => setSchedulingDate(e.target.value)}
                                    className="w-full bg-white dark:bg-gray-800 p-2 rounded-lg border dark:border-gray-600 text-sm outline-none focus:ring-2 focus:ring-orange-500"
                                />
                                <p className="text-[10px] text-orange-600/70 mt-2 font-medium">Si no programas una fecha, el mensaje se pondrá en cola para envío inmediato.</p>
                            </div>
                        </div>
                        <div className="p-6 bg-gray-50 dark:bg-gray-900/50 flex gap-3">
                            <button
                                onClick={() => setShowReminderModal(null)}
                                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => handleSendReminder(!!schedulingDate)}
                                className={`flex-1 px-4 py-3 rounded-xl flex items-center justify-center gap-2 font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95 ${schedulingDate ? 'bg-orange-500 shadow-orange-500/20' : 'bg-green-500 shadow-green-500/20'}`}
                            >
                                {schedulingDate ? <Clock className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
                                {schedulingDate ? 'Programar' : 'Enviar Ahora'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
