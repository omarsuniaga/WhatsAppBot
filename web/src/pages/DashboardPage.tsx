/**
 * DashboardPage - Main Dashboard landing page
 * Displays stats, quick actions, and system status
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BookOpen, Ticket, Send, MessageSquare,
    CheckCircle, RefreshCw, Calendar,
    Clock, ClipboardList, GraduationCap, Bell, Plus,
    ChevronRight, Music, AlertTriangle, Zap, FileText,
    UserCheck, Building2, Mail, AlertCircle
} from 'lucide-react';
import { knowledgeApi, escalationApi, broadcastApi } from '../api/client';
import { analyticsApi } from '../api/adminSystem';

interface DashboardStats {
    knowledge: {
        totalFaqs: number;
        approvedFaqs: number;
        pendingFaqs: number;
    };
    escalation: {
        total: number;
        pending: number;
        resolved: number;
    };
    broadcast: {
        totalCampaigns: number;
        totalMessagesSent: number;
    };
}

export const DashboardPage = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [dailySummary, setDailySummary] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        setLoading(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            const [knowledgeRes, escalationRes, broadcastRes, summaryRes] = await Promise.all([
                knowledgeApi.getStats(),
                escalationApi.getStats(),
                broadcastApi.getStats(),
                analyticsApi.analyzeDay(today)
            ]);

            setStats({
                knowledge: knowledgeRes.data.data,
                escalation: escalationRes.data.data,
                broadcast: broadcastRes.data.data
            });
            setDailySummary(summaryRes.data);
        } catch (error) {
            console.error('Error loading dashboard stats:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-full overflow-y-auto p-3 sm:p-4 lg:p-6 bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
            <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 dark:text-gray-100 tracking-tight" style={{ fontSize: 'clamp(1.25rem, 1rem + 1vw, 1.875rem)' }}>
                            Dashboard
                        </h2>
                        <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">
                            Resumen del sistema de bot inteligente
                        </p>
                    </div>
                    <button
                        onClick={loadStats}
                        disabled={loading}
                        className="flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 w-full sm:w-auto transition-all active:scale-95 shadow-sm"
                        style={{ minHeight: '44px' }}
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        <span className="font-medium">Actualizar</span>
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-400" />
                    </div>
                ) : (
                    <>
                        {/* Daily Summary Section */}
                        {dailySummary && (
                            <section>
                                <div className="flex items-center gap-2 mb-4 px-1">
                                    <ClipboardList className="w-5 h-5 text-indigo-500" />
                                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                                        Resumen Diario <span className="text-gray-400 font-normal ml-1 text-sm">({new Date().toLocaleDateString()})</span>
                                    </h3>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
                                    <StatCard
                                        title="Clases Hoy"
                                        value={dailySummary.clasesToday}
                                        icon={Calendar}
                                        color="blue"
                                        subtitle={`${dailySummary.classesCompleted} completadas`}
                                    />
                                    <StatCard
                                        title="Asistencia Global"
                                        value={formatPercentage(dailySummary.overallPercentage)}
                                        icon={UserCheck}
                                        color={dailySummary.overallPercentage >= 90 ? 'green' : 'orange'}
                                        subtitle={`${dailySummary.totalPresent} alumnos presentes`}
                                    />
                                    <StatCard
                                        title="Ausencias"
                                        value={dailySummary.totalAbsent}
                                        icon={AlertCircle}
                                        color="red"
                                        subtitle={`${dailySummary.pendingJustifications?.length || 0} por justificar`}
                                        onClick={() => navigate('/attendance')}
                                    />
                                    <StatCard
                                        title="Discrepancias"
                                        value={0} // Placeholder until implemented in summary
                                        icon={AlertTriangle}
                                        color="yellow"
                                        subtitle="Requieren revisión"
                                    />
                                </div>
                            </section>
                        )}

                        {/* Bot Status Section */}
                        <section>
                            <div className="flex items-center gap-2 mb-4 px-1">
                                <MessageSquare className="w-5 h-5 text-purple-500" />
                                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Estado del Bot</h3>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
                                <StatCard
                                    title="FAQs Activas"
                                    value={stats?.knowledge.approvedFaqs || 0}
                                    icon={BookOpen}
                                    color="blue"
                                    subtitle={`${stats?.knowledge.pendingFaqs || 0} pendientes`}
                                    onClick={() => navigate('/knowledge')}
                                />
                                <StatCard
                                    title="Tickets Pendientes"
                                    value={stats?.escalation.pending || 0}
                                    icon={Ticket}
                                    color="orange"
                                    subtitle={`${stats?.escalation.resolved || 0} resueltos`}
                                    onClick={() => navigate('/tickets')}
                                />
                                <StatCard
                                    title="Mensajes Enviados"
                                    value={stats?.broadcast.totalMessagesSent || 0}
                                    icon={Send}
                                    color="green"
                                    subtitle={`${stats?.broadcast.totalCampaigns || 0} campañas`}
                                    onClick={() => navigate('/broadcast')}
                                />
                                <StatCard
                                    title="Total Tickets"
                                    value={stats?.escalation.total || 0}
                                    icon={MessageSquare}
                                    color="purple"
                                    subtitle="Histórico"
                                    onClick={() => navigate('/tickets')}
                                />
                            </div>
                        </section>

                        {/* Quick Actions - Gestión Institucional */}
                        <section className="bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 p-4 sm:p-6 shadow-sm">
                            <div className="flex items-center gap-2 mb-5">
                                <Building2 className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Gestión Institucional</h3>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
                                <QuickAction
                                    title="Asistencias"
                                    description="Control diario"
                                    icon={ClipboardList}
                                    color="green"
                                    onClick={() => navigate('/attendance')}
                                />
                                <QuickAction
                                    title="Alumnos"
                                    description="Registrar nuevos"
                                    icon={GraduationCap}
                                    color="blue"
                                    onClick={() => navigate('/students')}
                                />
                                <QuickAction
                                    title="Clases"
                                    description="Gestionar clases"
                                    icon={Music}
                                    color="purple"
                                    onClick={() => navigate('/classes')}
                                />
                                <QuickAction
                                    title="Horarios"
                                    description="Ver y editar"
                                    icon={Clock}
                                    color="orange"
                                    onClick={() => navigate('/schedules')}
                                />
                            </div>
                        </section>

                        {/* Automatizaciones Section */}
                        <section className="bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 p-4 sm:p-6 shadow-sm">
                            <div className="flex items-center gap-2 mb-5">
                                <Zap className="w-5 h-5 text-yellow-500" />
                                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Automatizaciones</h3>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
                                <QuickAction
                                    title="Borradores"
                                    description="Notificaciones ausencias"
                                    icon={FileText}
                                    color="yellow"
                                    onClick={() => navigate('/automations/absences')}
                                />
                                <QuickAction
                                    title="Plantillas"
                                    description="Mensajes predefinidos"
                                    icon={Mail}
                                    color="cyan"
                                    onClick={() => navigate('/templates')}
                                />
                                <QuickAction
                                    title="Contactos"
                                    description="Gestionar contactos"
                                    icon={UserCheck}
                                    color="indigo"
                                    onClick={() => navigate('/contacts')}
                                />
                                <QuickAction
                                    title="Profesores"
                                    description="Equipo docente"
                                    icon={Building2}
                                    color="teal"
                                    onClick={() => navigate('/teachers')}
                                />
                            </div>
                        </section>

                        {/* Events & Alerts Section */}
                        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                            {/* Events Calendar Section */}
                            <EventsSection onNavigate={() => navigate('/events')} />

                            {/* Pending Alerts Section */}
                            <AlertsSection
                                pendingCount={stats?.escalation.pending || 0}
                                onNavigate={() => navigate('/tickets')}
                            />
                        </section>
                    </>
                )}
            </div>
        </div>
    );
};

// Helper for StatCard
const formatPercentage = (value: number) => `${value}%`;

// Stat Card Component
const StatCard = ({
    title,
    value,
    icon: Icon,
    color,
    subtitle,
    onClick
}: {
    title: string;
    value: number | string;
    icon: any;
    color: string;
    subtitle?: string;
    onClick?: () => void;
}) => {
    const colors: Record<string, string> = {
        blue: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
        green: 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400',
        orange: 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
        purple: 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
        red: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400',
        yellow: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
    };

    return (
        <button
            onClick={onClick}
            className={`w-full text-left bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-5 transition-all outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${onClick ? 'cursor-pointer hover:shadow-lg hover:-translate-y-0.5 dark:hover:bg-gray-750' : 'cursor-default'}`}
        >
            <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</span>
                <div className={`p-2.5 rounded-lg ${colors[color] || colors.blue}`}>
                    <Icon className="w-5 h-5" />
                </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{value.toLocaleString()}</p>
            {subtitle && <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mt-2">{subtitle}</p>}
        </button>
    );
};

// Quick Action Component
const QuickAction = ({
    title,
    description,
    icon: Icon,
    color,
    badge,
    onClick
}: {
    title: string;
    description: string;
    icon: any;
    color: string;
    badge?: number;
    onClick?: () => void;
}) => {
    const colors: Record<string, string> = {
        blue: 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700',
        green: 'bg-green-500 hover:bg-green-600 active:bg-green-700',
        orange: 'bg-orange-500 hover:bg-orange-600 active:bg-orange-700',
        purple: 'bg-purple-500 hover:bg-purple-600 active:bg-purple-700',
        yellow: 'bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700',
        cyan: 'bg-cyan-500 hover:bg-cyan-600 active:bg-cyan-700',
        indigo: 'bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700',
        teal: 'bg-teal-500 hover:bg-teal-600 active:bg-teal-700',
    };

    return (
        <button
            onClick={onClick}
            className={`group relative p-4 rounded-xl text-white text-left transition-all shadow-sm hover:shadow-md outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 focus:ring-${color}-500 ${colors[color]}`}
            style={{ minHeight: '120px' }}
        >
            <div className="absolute top-4 right-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-300">
                <Icon className="w-12 h-12" />
            </div>
            <div className="relative z-10 flex flex-col h-full justify-between">
                <div className="p-2 bg-white/20 rounded-lg w-fit backdrop-blur-sm mb-3">
                    <Icon className="w-6 h-6" />
                </div>
                <div>
                    <p className="font-bold text-base sm:text-lg leading-tight mb-1">{title}</p>
                    <p className="text-xs sm:text-sm text-white/90 font-medium">{description}</p>
                </div>
            </div>
            {badge !== undefined && badge > 0 && (
                <span className="absolute top-3 right-3 bg-white text-gray-900 text-xs px-2 py-1 rounded-full font-bold shadow-sm">
                    {badge}
                </span>
            )}
        </button>
    );
};

// Events Section Component - Calendario de actividades del mes
const EventsSection = ({ onNavigate }: { onNavigate: () => void }) => {
    const [events] = useState([
        { id: 1, title: 'Ensayo General Orquesta', date: '28 Ene', time: '4:00 PM', type: 'rehearsal' },
        { id: 2, title: 'Concierto de Inicio de Año', date: '02 Feb', time: '6:00 PM', type: 'concert' },
        { id: 3, title: 'Reunión de Padres - Iniciación', date: '05 Feb', time: '5:00 PM', type: 'meeting' },
    ]);

    const getEventColor = (type: string) => {
        const colors: Record<string, string> = {
            rehearsal: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-l-4 border-l-blue-500',
            concert: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-l-4 border-l-purple-500',
            meeting: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-l-4 border-l-green-500',
        };
        return colors[type] || colors.meeting;
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 p-5 sm:p-6 shadow-sm h-full flex flex-col">
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                        <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Eventos del Mes</h3>
                </div>
                <button
                    onClick={onNavigate}
                    className="flex items-center gap-1 text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors p-2 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg"
                >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Nuevo</span>
                </button>
            </div>

            <div className="space-y-3 flex-1">
                {events.map(event => (
                    <div
                        key={event.id}
                        className={`p-4 rounded-lg border-t border-b border-r border-transparent ${getEventColor(event.type)} cursor-pointer hover:shadow-sm transition-all`}
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="font-semibold text-sm">{event.title}</p>
                                <p className="text-xs mt-1 opacity-80 font-medium flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {event.date} • {event.time}
                                </p>
                            </div>
                            <Bell className="w-4 h-4 opacity-50" />
                        </div>
                    </div>
                ))}
            </div>

            <button
                onClick={onNavigate}
                className="w-full mt-5 py-2.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 flex items-center justify-center gap-1 transition-all rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750"
            >
                Ver calendario completo
                <ChevronRight className="w-4 h-4" />
            </button>
        </div>
    );
};

// Alerts Section Component - Sistema de alertas y respuestas pendientes
const AlertsSection = ({
    pendingCount,
    onNavigate
}: {
    pendingCount: number;
    onNavigate: () => void;
}) => {
    const [alerts] = useState([
        { id: 1, message: 'Consulta sobre horario de clases de violín', chat: 'María García', time: 'Hace 10 min', priority: 'high' },
        { id: 2, message: '¿Cuándo es el próximo concierto?', chat: 'Grupo Orquesta Juvenil', time: 'Hace 25 min', priority: 'normal' },
        { id: 3, message: 'Solicitud de información de inscripción', chat: '+1 809 555 1234', time: 'Hace 1 hora', priority: 'normal' },
    ]);

    const getPriorityStyle = (priority: string) => {
        if (priority === 'high') {
            return 'border-l-4 border-l-red-500 bg-red-50 dark:bg-red-900/20';
        }
        return 'border-l-4 border-l-orange-400 bg-orange-50 dark:bg-orange-900/20';
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 p-5 sm:p-6 shadow-sm h-full flex flex-col">
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                        <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Respuestas Pendientes</h3>
                    {pendingCount > 0 && (
                        <span className="bg-red-500 text-white text-xs px-2.5 py-0.5 rounded-full font-bold shadow-sm">
                            {pendingCount}
                        </span>
                    )}
                </div>
            </div>

            <div className="space-y-3 flex-1">
                {alerts.slice(0, 3).map(alert => (
                    <div
                        key={alert.id}
                        onClick={onNavigate}
                        className={`p-4 rounded-r-lg cursor-pointer hover:shadow-sm transition-all ${getPriorityStyle(alert.priority)}`}
                    >
                        <p className="font-semibold text-sm text-gray-800 dark:text-gray-100 line-clamp-1">{alert.message}</p>
                        <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">
                                    {alert.chat.charAt(0)}
                                </div>
                                <p className="text-xs font-medium text-gray-600 dark:text-gray-300">{alert.chat}</p>
                            </div>
                            <p className="text-xs text-gray-400 dark:text-gray-500">{alert.time}</p>
                        </div>
                    </div>
                ))}
            </div>

            {alerts.length === 0 ? (
                <div className="text-center py-8 flex-1 flex flex-col justify-center">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                    <p className="text-base font-medium text-gray-800 dark:text-gray-200">¡Todo al día!</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">No hay respuestas pendientes</p>
                </div>
            ) : (
                <button
                    onClick={onNavigate}
                    className="w-full mt-5 py-2.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 flex items-center justify-center gap-1 transition-all rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750"
                >
                    Ver todos los tickets
                    <ChevronRight className="w-4 h-4" />
                </button>
            )}
        </div>
    );
};
