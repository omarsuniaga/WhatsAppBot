/**
 * AttendanceControlPage - Professional Management Dashboard
 * Monitors compliance, identifies critical students, and tracks attendance trends.
 */

import { useState, useEffect, useMemo } from 'react';
import {
    ClipboardCheck,
    AlertCircle,
    CheckCircle,
    XCircle,
    Clock,
    MessageSquare,
    Download,
    RefreshCw,
    Bell,
    ChevronRight,
    TrendingUp,
    ShieldAlert
} from 'lucide-react';
import {
    clasesService,
    asistenciasService,
    contactosService,
    Clase,
    Asistencia
} from '../services/firestore';
import { messageApi } from '../api/client';

type FilterPeriod = 'today' | 'week' | 'month' | 'custom';

export const AttendanceControlPage = () => {
    // Data state
    const [classes, setClasses] = useState<Clase[]>([]);
    const [attendances, setAttendances] = useState<Asistencia[]>([]);

    // UI state
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [period, setPeriod] = useState<FilterPeriod>('today');
    const [contacts, setContacts] = useState<any[]>([]);
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    // Load initial data
    const loadData = async () => {
        setLoading(true);
        try {
            const [cData, aData, coData] = await Promise.all([
                clasesService.getAllClases(true),
                asistenciasService.getByDateRange(startDate, endDate),
                contactosService.getAllContactos()
            ]);
            setClasses(cData);
            setAttendances(aData);
            setContacts(coData);
        } catch (err) {
            console.error('Error loading attendance data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
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
                const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
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

    // Computed Stats
    const stats = useMemo(() => {
        const totalPossible = attendances.length || 1;
        const presentCount = attendances.filter(a => a.estado === 'presente').length;
        const absentCount = attendances.filter(a => a.estado === 'ausente').length;
        const lateCount = attendances.filter(a => a.estado === 'tardanza').length;
        const justifiedCount = attendances.filter(a => a.estado === 'justificado').length;

        // Compliance check for "Today"
        const isToday = startDate === endDate && startDate === new Date().toISOString().split('T')[0];
        let pendingReports = 0;

        if (isToday) {
            // Very simplified: check if classes scheduled for today have any attendance
            const todayName = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][new Date().getDay()];
            const classesToday = classes.filter(c =>
                c.schedule?.slots?.some(s => s.day === todayName)
            );

            const attendedClassIds = new Set(attendances.map(a => a.clase_id));
            const pending = classesToday.filter(c => !attendedClassIds.has(c.id));
            pendingReports = pending.length;

            return {
                rate: Math.round(((presentCount + justifiedCount) / totalPossible) * 100),
                absences: absentCount,
                late: lateCount,
                justified: justifiedCount,
                pendingReports,
                pendingList: pending.map(c => ({
                    id: c.id,
                    name: c.nombre || 'Sin nombre',
                    teacher: c.profesor_nombre || 'Sin asignar',
                    room: c.salon_nombre || 'Sin salón',
                    teacher_jid: c.profesor_jid // Assuming JID is available in class data
                }))
            };
        }

        return {
            rate: Math.round(((presentCount + justifiedCount) / totalPossible) * 100),
            absences: absentCount,
            late: lateCount,
            justified: justifiedCount,
            pendingReports,
            pendingList: []
        };
    }, [attendances, classes, startDate, endDate]);

    // Critical Alumnos (Threshold > 3 absences in the period)
    const criticalStudents = useMemo(() => {
        const studentStats = new Map<string, { name: string, absences: number, student_jid?: string }>();

        attendances.filter(a => a.estado === 'ausente').forEach(a => {
            const current = studentStats.get(a.alumno_id) || { name: a.alumno_nombre || 'Sin nombre', absences: 0, student_jid: a.alumno_jid };
            current.absences += 1;
            studentStats.set(a.alumno_id, current);
        });

        return Array.from(studentStats.entries())
            .map(([id, stats]) => ({ id, ...stats }))
            .filter(s => s.absences >= 3)
            .sort((a, b) => b.absences - a.absences);
    }, [attendances]);

    // Action Handlers
    const alertParent = async (s: any) => {
        setActionLoading(s.id);
        try {
            const message = `*ALERTA DE ASISTENCIA*\n\nEstimado representante de *${s.name}*, le informamos que el alumno ha acumulado *${s.absences} inasistencias* en el periodo actual. Por favor, comuníquese con la administración.`;

            // Lookup student contact to find JID
            const contact = contacts.find(c => c.alumno_id === s.id || c.whatsapp === s.student_jid || c.nombre === s.name);
            const targetJid = contact?.jid || s.student_jid || '59170000000@s.whatsapp.net';

            await messageApi.sendText(targetJid, message);
            alert(`✅ Mensaje enviado a los padres de ${s.name}`);
        } catch (err) {
            console.error('Error alerting parent:', err);
            alert('❌ No se pudo enviar el mensaje');
        } finally {
            setActionLoading(null);
        }
    };

    const remindTeacher = async (cl: any) => {
        setActionLoading(cl.id);
        try {
            const message = `*RECORDATORIO DE ASISTENCIA*\n\nHola *${cl.teacher}*, no hemos recibido el reporte de asistencia de la clase *${cl.name}* de hoy. Por favor complete el registro a la brevedad.`;

            // Lookup teacher contact
            const contact = contacts.find(co => co.tipo === 'profesor' && (co.nombre === cl.teacher || co.id === cl.profesor_id));
            const targetJid = contact?.jid || cl.teacher_jid || '59170000000@s.whatsapp.net';

            await messageApi.sendText(targetJid, message);
            alert(`✅ Recordatorio enviado a ${cl.teacher}`);
        } catch (err) {
            console.error('Error reminding teacher:', err);
            alert('❌ No se pudo enviar el mensaje');
        } finally {
            setActionLoading(null);
        }
    };

    const toggleJustified = async (asistencia: Asistencia) => {
        try {
            const newStatus = asistencia.estado === 'justificado' ? 'ausente' : 'justificado';
            await asistenciasService.update(asistencia.id, {
                estado: newStatus as any,
                justificacion: newStatus === 'justificado' ? 'Justificado vía WhatsApp' : ''
            });
            await loadData();
        } catch (err) {
            console.error('Error toggling justification:', err);
        }
    };

    const exportToCSV = () => {
        const headers = ['Fecha', 'Clase', 'Alumno', 'Estado', 'Observaciones'];
        const rows = attendances.map(a => [
            a.fecha,
            a.clase_nombre || 'N/A',
            a.alumno_nombre || 'N/A',
            a.estado,
            a.observaciones || ''
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `reporte_asistencia_${startDate}_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading && attendances.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <RefreshCw className="w-10 h-10 animate-spin text-indigo-500" />
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                        <ShieldAlert className="w-6 h-6 text-indigo-500" />
                        Control de Asistencias
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Supervisión de cumplimiento y seguimiento de ausencias
                    </p>
                </div>

                <div className="flex bg-white dark:bg-gray-800 p-1 rounded-xl border dark:border-gray-700 shadow-sm">
                    {(['today', 'week', 'month', 'custom'] as const).map((p) => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${period === p
                                ? 'bg-indigo-600 text-white shadow-lg'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                                }`}
                        >
                            {p.charAt(0).toUpperCase() + p.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Custom Range Filter */}
            {period === 'custom' && (
                <div className="flex items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700 animate-in slide-in-from-top duration-300">
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">Inicio</label>
                        <input
                            type="date"
                            className="bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded px-2 py-1 text-sm"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">Fin</label>
                        <input
                            type="date"
                            className="bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded px-2 py-1 text-sm"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={loadData}
                        className="ml-auto p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            )}

            {/* Top Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title="Tasa de Asistencia"
                    value={`${stats.rate}%`}
                    icon={<ClipboardCheck className="w-5 h-5 text-green-500" />}
                    trend={stats.rate > 90 ? "Excelente" : "Requiere atención"}
                    color="green"
                />
                <MetricCard
                    title="Inasistencias"
                    value={stats.absences}
                    icon={<XCircle className="w-5 h-5 text-red-500" />}
                    trend={`${stats.justified} justificadas`}
                    color="red"
                />
                <MetricCard
                    title="Tardanzas"
                    value={stats.late}
                    icon={<Clock className="w-5 h-5 text-amber-500" />}
                    trend="Meta: < 5%"
                    color="amber"
                />
                <MetricCard
                    title="Reportes Pendientes"
                    value={stats.pendingReports}
                    icon={<AlertCircle className="w-5 h-5 text-indigo-500" />}
                    trend="Clases hoy"
                    color="indigo"
                    highlight={stats.pendingReports > 0}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Critical Students Alert */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 overflow-hidden shadow-sm">
                        <div className="p-4 border-b dark:border-gray-700 bg-red-50/50 dark:bg-red-900/10 flex items-center justify-between">
                            <h3 className="font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                                <Bell className="w-4 h-4" />
                                Alumnos en Riesgo
                            </h3>
                            <span className="bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300 text-xs font-bold px-2 py-1 rounded-full">
                                {criticalStudents.length} críticos
                            </span>
                        </div>
                        <div className="p-0 max-h-[400px] overflow-y-auto">
                            {criticalStudents.length > 0 ? (
                                <div className="divide-y dark:divide-gray-700">
                                    {criticalStudents.map((s) => (
                                        <div key={s.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                            <div>
                                                <p className="font-semibold text-gray-800 dark:text-gray-200">{s.name}</p>
                                                <p className="text-xs text-red-500 font-medium">{s.absences} faltas en el periodo</p>
                                            </div>
                                            <button
                                                className={`p-2 rounded-lg transition-all ${actionLoading === s.id
                                                        ? 'bg-gray-100 animate-pulse'
                                                        : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200'
                                                    }`}
                                                title="Alertar a padres (WhatsApp)"
                                                onClick={() => alertParent(s)}
                                                disabled={actionLoading === s.id}
                                            >
                                                {actionLoading === s.id
                                                    ? <RefreshCw className="w-4 h-4 animate-spin" />
                                                    : <MessageSquare className="w-4 h-4" />
                                                }
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-gray-500">
                                    <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-20 text-green-500" />
                                    <p className="text-sm">No hay alumnos críticos detectados</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Quick Justification Management */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 p-6 shadow-sm">
                        <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-indigo-500" />
                            Acciones Rápidas
                        </h3>
                        <div className="space-y-3">
                            <ActionButton
                                label="Exportar Reporte Excel"
                                icon={<Download className="w-4 h-4" />}
                                onClick={exportToCSV}
                            />
                            <ActionButton
                                label="Gestionar Justificativos"
                                icon={<RefreshCw className="w-4 h-4" />}
                                onClick={() => alert('Abriendo sección de justificativos...')}
                            />
                        </div>
                    </div>
                </div>

                {/* Main Observations Feed / Recent Activity */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Pending Reports Alert Section */}
                    {stats.pendingReports > 0 && (
                        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
                            <h4 className="text-amber-800 dark:text-amber-400 font-bold flex items-center gap-2 mb-3">
                                <AlertCircle className="w-4 h-4" />
                                Reportes Pendientes de Hoy ({stats.pendingReports})
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {stats.pendingList.map((c: any) => (
                                    <div key={c.id} className="bg-white dark:bg-gray-800 border dark:border-gray-700 p-3 rounded-xl flex items-center justify-between shadow-sm">
                                        <div>
                                            <p className="font-bold text-gray-800 dark:text-gray-200 text-sm">{c.name}</p>
                                            <p className="text-xs text-gray-500">{c.teacher}</p>
                                        </div>
                                        <button
                                            onClick={() => remindTeacher(c)}
                                            className={`p-2 rounded-lg transition-all ${actionLoading === c.id
                                                    ? 'bg-gray-100 animate-pulse'
                                                    : 'text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
                                                }`}
                                            title="Recordar al profesor"
                                            disabled={actionLoading === c.id}
                                        >
                                            {actionLoading === c.id
                                                ? <RefreshCw className="w-4 h-4 animate-spin" />
                                                : <Bell className="w-4 h-4" />
                                            }
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 shadow-sm flex flex-col h-full">
                        <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
                            <h3 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-indigo-500" />
                                Feed de Observaciones
                            </h3>
                            <button className="text-xs text-indigo-500 font-bold hover:underline">Ver todo</button>
                        </div>
                        <div className="flex-1 overflow-y-auto max-h-[600px]">
                            {attendances.some(a => a.observaciones) ? (
                                <div className="divide-y dark:divide-gray-700">
                                    {attendances.filter(a => a.observaciones).sort((a, b) => b.fecha.localeCompare(a.fecha)).map((a) => (
                                        <div key={a.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors">
                                            <div className="flex items-center justify-between mb-2">
                                                <div>
                                                    <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">{a.clase_nombre}</span>
                                                    <h4 className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{a.alumno_nombre}</h4>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => toggleJustified(a)}
                                                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${a.estado === 'justificado'
                                                            ? 'bg-green-100 text-green-700 border-green-200'
                                                            : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-green-50'
                                                            }`}
                                                    >
                                                        {a.estado === 'justificado' ? 'JUSTIFICADO' : 'JUSTIFICAR?'}
                                                    </button>
                                                    <span className="text-[10px] text-gray-400 font-medium">{a.fecha}</span>
                                                </div>
                                            </div>
                                            <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/30 p-3 rounded-xl italic">
                                                "{a.observaciones}"
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-12 text-center text-gray-500">
                                    <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-10" />
                                    <p>No se han registrado observaciones en este periodo</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Internal Components
const MetricCard = ({ title, value, icon, trend, color, highlight = false }: any) => {
    const colors: any = {
        green: 'bg-green-500',
        red: 'bg-red-500',
        amber: 'bg-amber-500',
        indigo: 'bg-indigo-500'
    };

    return (
        <div className={`bg-white dark:bg-gray-800 p-5 rounded-2xl border dark:border-gray-700 shadow-sm transition-all hover:shadow-md ${highlight ? 'ring-2 ring-indigo-500' : ''}`}>
            <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-xl bg-opacity-10 ${colors[color]} bg-opacity-20`}>
                    {icon}
                </div>
                <span className="text-2xl font-bold text-gray-800 dark:text-gray-100">{value}</span>
            </div>
            <p className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-1">{title}</p>
            <div className="flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full ${colors[color]}`} />
                <span className="text-xs font-medium text-gray-400">{trend}</span>
            </div>
        </div>
    );
};

const ActionButton = ({ label, icon, onClick }: any) => (
    <button
        onClick={onClick}
        className="w-full flex items-center justify-between p-3 rounded-xl border dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-all font-medium text-gray-700 dark:text-gray-300 text-sm"
    >
        <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-500">
                {icon}
            </div>
            {label}
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400" />
    </button>
);
