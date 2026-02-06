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
        <div className="h-full overflow-y-auto p-3 sm:p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">Dashboard</h2>
                        <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">Resumen del sistema de bot inteligente</p>
                    </div>
                    <button
                        onClick={loadStats}
                        disabled={loading}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 w-full sm:w-auto transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        <span>Actualizar</span>
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <RefreshCw className="w-8 h-8 animate-spin text-whatsapp-green" />
                    </div>
                ) : (
                    <>
                        {/* Daily Summary Section (New) */}
                        {dailySummary && (
                            <div className="mb-8">
                                <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100 flex items-center gap-2">
                                    <ClipboardList className="w-5 h-5 text-indigo-500" />
                                    Resumen Diario ({new Date().toLocaleDateString()})
                                </h3>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
                            </div>
                        )}

                        <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">Estado del Bot</h3>
                        {/* Stats Cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
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

                        {/* Quick Actions - Gestión Institucional */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 sm:p-6 mb-6 transition-colors">
                            <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">Gestión Institucional</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
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
                        </div>

                        {/* Automatizaciones Section */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 sm:p-6 mb-6 transition-colors">
                            <div className="flex items-center gap-2 mb-4">
                                <Zap className="w-5 h-5 text-yellow-500" />
                                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Automatizaciones</h3>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
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
                        </div>

                        {/* Events & Alerts Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Events Calendar Section */}
                            <EventsSection onNavigate={() => navigate('/events')} />

                            {/* Pending Alerts Section */}
                            <AlertsSection
                                pendingCount={stats?.escalation.pending || 0}
                                onNavigate={() => navigate('/tickets')}
                            />
                        </div>
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
    };

    return (
        <div
            onClick={onClick}
            className={`bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 transition-colors ${onClick ? 'cursor-pointer hover:shadow-md dark:hover:bg-gray-750' : ''}`}
        >
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">{title}</span>
                <div className={`p-2 rounded-lg ${colors[color]}`}>
                    <Icon className="w-4 h-4" />
                </div>
            </div>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{value.toLocaleString()}</p>
            {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtitle}</p>}
        </div>
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
        blue: 'bg-blue-500 hover:bg-blue-600',
        green: 'bg-green-500 hover:bg-green-600',
        orange: 'bg-orange-500 hover:bg-orange-600',
        purple: 'bg-purple-500 hover:bg-purple-600',
        yellow: 'bg-yellow-500 hover:bg-yellow-600',
        cyan: 'bg-cyan-500 hover:bg-cyan-600',
        indigo: 'bg-indigo-500 hover:bg-indigo-600',
        teal: 'bg-teal-500 hover:bg-teal-600',
    };

    return (
        <button
            onClick={onClick}
            className={`relative p-4 rounded-lg text-white text-left transition-colors ${colors[color]}`}
        >
            <Icon className="w-6 h-6 mb-2" />
            <p className="font-semibold text-sm sm:text-base">{title}</p>
            <p className="text-xs sm:text-sm opacity-80">{description}</p>
            {badge !== undefined && badge > 0 && (
                <span className="absolute top-2 right-2 bg-white text-gray-800 text-xs px-2 py-1 rounded-full font-bold">
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
            rehearsal: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
            concert: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800',
            meeting: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800',
        };
        return colors[type] || colors.meeting;
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 sm:p-6 transition-colors">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-purple-500" />
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Eventos del Mes</h3>
                </div>
                <button
                    onClick={onNavigate}
                    className="flex items-center gap-1 text-sm text-purple-600 dark:text-purple-400 hover:underline"
                >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Nuevo evento</span>
                </button>
            </div>

            <div className="space-y-3">
                {events.map(event => (
                    <div
                        key={event.id}
                        className={`p-3 rounded-lg border ${getEventColor(event.type)} cursor-pointer hover:opacity-80 transition-opacity`}
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="font-medium text-sm">{event.title}</p>
                                <p className="text-xs mt-1 opacity-75">{event.date} • {event.time}</p>
                            </div>
                            <Bell className="w-4 h-4 opacity-50" />
                        </div>
                    </div>
                ))}
            </div>

            <button
                onClick={onNavigate}
                className="w-full mt-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 flex items-center justify-center gap-1 transition-colors"
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
        <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 sm:p-6 transition-colors">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Respuestas Pendientes</h3>
                    {pendingCount > 0 && (
                        <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                            {pendingCount}
                        </span>
                    )}
                </div>
            </div>

            <div className="space-y-2">
                {alerts.slice(0, 3).map(alert => (
                    <div
                        key={alert.id}
                        onClick={onNavigate}
                        className={`p-3 rounded-r-lg cursor-pointer hover:opacity-80 transition-opacity ${getPriorityStyle(alert.priority)}`}
                    >
                        <p className="font-medium text-sm text-gray-800 dark:text-gray-200 line-clamp-1">{alert.message}</p>
                        <div className="flex items-center justify-between mt-1">
                            <p className="text-xs text-gray-500 dark:text-gray-400">{alert.chat}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">{alert.time}</p>
                        </div>
                    </div>
                ))}
            </div>

            {alerts.length === 0 ? (
                <div className="text-center py-6">
                    <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">¡Todo al día!</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">No hay respuestas pendientes</p>
                </div>
            ) : (
                <button
                    onClick={onNavigate}
                    className="w-full mt-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 flex items-center justify-center gap-1 transition-colors"
                >
                    Ver todos los tickets
                    <ChevronRight className="w-4 h-4" />
                </button>
            )}
        </div>
    );
};
