/**
 * Admin Dashboard
 * Panel principal de administración con navegación entre módulos
 */

import { useState, useEffect } from 'react';
import { 
    LayoutDashboard, BookOpen, Ticket, Send, Settings,
    MessageSquare, AlertCircle, CheckCircle,
    ArrowLeft, RefreshCw, Wand2, Menu, X
} from 'lucide-react';
import { KnowledgePanel } from './KnowledgePanel';
import { TicketsPanel } from './TicketsPanel';
import { BroadcastPanel } from './BroadcastPanel';
import { SetupWizard } from './SetupWizard';
import { knowledgeApi, escalationApi, broadcastApi } from '../../api/client';
import { 
    useLocalStorage, 
    STORAGE_KEYS, 
    DEFAULT_CONFIGS,
    KnowledgeConfig,
    EscalationConfig,
    BroadcastConfig
} from '../../hooks/useLocalStorage';

type ActivePanel = 'dashboard' | 'knowledge' | 'tickets' | 'broadcast' | 'settings';

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

interface AdminDashboardProps {
    onBack?: () => void;
}

export const AdminDashboard = ({ onBack }: AdminDashboardProps) => {
    // Persistir panel activo en localStorage
    const [activePanel, setActivePanel] = useLocalStorage<ActivePanel>(STORAGE_KEYS.ADMIN_ACTIVE_PANEL, 'dashboard');
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [showWizard, setShowWizard] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (!mobile) setSidebarOpen(false);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handlePanelChange = (panel: ActivePanel) => {
        setActivePanel(panel);
        if (isMobile) setSidebarOpen(false);
    };

    useEffect(() => {
        if (activePanel === 'dashboard') {
            loadStats();
        }
    }, [activePanel]);

    const loadStats = async () => {
        setLoading(true);
        try {
            const [knowledgeRes, escalationRes, broadcastRes] = await Promise.all([
                knowledgeApi.getStats(),
                escalationApi.getStats(),
                broadcastApi.getStats()
            ]);

            setStats({
                knowledge: knowledgeRes.data.data,
                escalation: escalationRes.data.data,
                broadcast: broadcastRes.data.data
            });
        } catch (error) {
            console.error('Error loading dashboard stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'knowledge', label: 'Base de Conocimiento', icon: BookOpen, badge: stats?.knowledge.pendingFaqs },
        { id: 'tickets', label: 'Tickets de Soporte', icon: Ticket, badge: stats?.escalation.pending },
        { id: 'broadcast', label: 'Difusión Masiva', icon: Send },
        { id: 'settings', label: 'Configuración', icon: Settings },
    ];

    return (
        <div className="h-screen flex flex-col md:flex-row bg-gray-100">
            {/* Mobile Header */}
            {isMobile && (
                <div className="h-14 bg-white border-b flex items-center justify-between px-4 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        {onBack && (
                            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg">
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                        )}
                        <h1 className="text-lg font-bold text-gray-800">Admin Panel</h1>
                    </div>
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>
            )}

            {/* Sidebar - Desktop: siempre visible, Móvil: overlay */}
            <div className={`
                ${isMobile 
                    ? `fixed inset-0 z-50 ${sidebarOpen ? 'block' : 'hidden'}` 
                    : 'w-64 flex-shrink-0'
                }
            `}>
                {/* Overlay para móvil */}
                {isMobile && sidebarOpen && (
                    <div 
                        className="absolute inset-0 bg-black/50"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}
                
                {/* Sidebar Content */}
                <div className={`
                    ${isMobile 
                        ? 'absolute left-0 top-0 h-full w-72 bg-white shadow-xl' 
                        : 'h-full bg-white border-r'
                    }
                    flex flex-col
                `}>
                    {/* Header */}
                    <div className="p-4 border-b">
                        <div className="flex items-center gap-2">
                            {!isMobile && onBack && (
                                <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg">
                                    <ArrowLeft className="w-5 h-5" />
                                </button>
                            )}
                            {isMobile && (
                                <button onClick={() => setSidebarOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                                    <X className="w-5 h-5" />
                                </button>
                            )}
                            <div>
                                <h1 className="text-lg font-bold text-gray-800">Admin Panel</h1>
                                <p className="text-xs text-gray-500">WhatsApp Bot Manager</p>
                            </div>
                        </div>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 p-4 overflow-y-auto">
                        <ul className="space-y-1">
                            {menuItems.map(item => (
                                <li key={item.id}>
                                    <button
                                        onClick={() => handlePanelChange(item.id as ActivePanel)}
                                        className={`w-full flex items-center justify-between px-3 py-3 rounded-lg transition-colors ${
                                            activePanel === item.id
                                                ? 'bg-whatsapp-green text-white'
                                                : 'text-gray-700 hover:bg-gray-100'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <item.icon className="w-5 h-5" />
                                            <span className="text-sm font-medium">{item.label}</span>
                                        </div>
                                        {item.badge !== undefined && item.badge > 0 && (
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                                                activePanel === item.id
                                                    ? 'bg-white/20 text-white'
                                                    : 'bg-red-500 text-white'
                                            }`}>
                                                {item.badge}
                                            </span>
                                        )}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    {/* Footer */}
                    <div className="p-4 border-t space-y-3">
                        <button
                            onClick={() => { setShowWizard(true); setSidebarOpen(false); }}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all"
                        >
                            <Wand2 className="w-4 h-4" />
                            <span className="text-sm font-medium">Asistente de Configuración</span>
                        </button>
                        <div className="text-xs text-gray-500 text-center">
                            WhatsApp Bot v1.0
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden">
                {activePanel === 'dashboard' && (
                    <DashboardHome 
                        stats={stats} 
                        loading={loading} 
                        onRefresh={loadStats} 
                        onNavigate={(panel: ActivePanel) => setActivePanel(panel)}
                    />
                )}
                {activePanel === 'knowledge' && <KnowledgePanel />}
                {activePanel === 'tickets' && <TicketsPanel />}
                {activePanel === 'broadcast' && <BroadcastPanel />}
                {activePanel === 'settings' && <SettingsPanel />}
            </div>

            {/* Setup Wizard */}
            {showWizard && (
                <SetupWizard
                    onComplete={() => {
                        setShowWizard(false);
                        loadStats();
                    }}
                    onSkip={() => setShowWizard(false)}
                />
            )}
        </div>
    );
};

// Dashboard Home Component
const DashboardHome = ({ 
    stats, 
    loading, 
    onRefresh,
    onNavigate
}: { 
    stats: DashboardStats | null; 
    loading: boolean;
    onRefresh: () => void;
    onNavigate?: (panel: ActivePanel) => void;
}) => {
    return (
        <div className="h-full overflow-y-auto p-3 sm:p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Dashboard</h2>
                        <p className="text-sm sm:text-base text-gray-500">Resumen del sistema de bot inteligente</p>
                    </div>
                    <button
                        onClick={onRefresh}
                        disabled={loading}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 w-full sm:w-auto"
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
                        {/* Stats Cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                            <StatCard
                                title="FAQs Activas"
                                value={stats?.knowledge.approvedFaqs || 0}
                                icon={BookOpen}
                                color="blue"
                                subtitle={`${stats?.knowledge.pendingFaqs || 0} pendientes`}
                                onClick={() => onNavigate?.('knowledge')}
                            />
                            <StatCard
                                title="Tickets Pendientes"
                                value={stats?.escalation.pending || 0}
                                icon={Ticket}
                                color="orange"
                                subtitle={`${stats?.escalation.resolved || 0} resueltos`}
                                onClick={() => onNavigate?.('tickets')}
                            />
                            <StatCard
                                title="Mensajes Enviados"
                                value={stats?.broadcast.totalMessagesSent || 0}
                                icon={Send}
                                color="green"
                                subtitle={`${stats?.broadcast.totalCampaigns || 0} campañas`}
                                onClick={() => onNavigate?.('broadcast')}
                            />
                            <StatCard
                                title="Total Tickets"
                                value={stats?.escalation.total || 0}
                                icon={MessageSquare}
                                color="purple"
                                subtitle="Histórico"
                                onClick={() => onNavigate?.('tickets')}
                            />
                        </div>

                        {/* Quick Actions */}
                        <div className="bg-white rounded-lg border p-4 sm:p-6 mb-6">
                            <h3 className="text-lg font-semibold mb-4">Acciones Rápidas</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                                <QuickAction
                                    title="Agregar FAQ"
                                    description="Añade una nueva pregunta frecuente"
                                    icon={BookOpen}
                                    color="blue"
                                    onClick={() => onNavigate?.('knowledge')}
                                />
                                <QuickAction
                                    title="Nueva Campaña"
                                    description="Crea una campaña de difusión"
                                    icon={Send}
                                    color="green"
                                    onClick={() => onNavigate?.('broadcast')}
                                />
                                <QuickAction
                                    title="Ver Tickets"
                                    description="Gestiona tickets pendientes"
                                    icon={Ticket}
                                    color="orange"
                                    badge={stats?.escalation.pending}
                                    onClick={() => onNavigate?.('tickets')}
                                />
                            </div>
                        </div>

                        {/* System Status */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="bg-white rounded-lg border p-4 sm:p-6">
                                <h3 className="text-lg font-semibold mb-4">Estado del Sistema</h3>
                                <div className="space-y-3">
                                    <StatusItem label="Bot WhatsApp" status="active" />
                                    <StatusItem label="Respuestas Automáticas" status="active" />
                                    <StatusItem label="Sistema de Tickets" status="active" />
                                    <StatusItem label="Difusión Masiva" status="active" />
                                </div>
                            </div>

                            <div className="bg-white rounded-lg border p-4 sm:p-6">
                                <h3 className="text-lg font-semibold mb-4">Actividad Reciente</h3>
                                <div className="space-y-3">
                                    <ActivityItem
                                        icon={CheckCircle}
                                        text="Sistema iniciado correctamente"
                                        time="Hace 5 min"
                                        color="green"
                                    />
                                    <ActivityItem
                                        icon={MessageSquare}
                                        text="Respuesta automática enviada"
                                        time="Hace 10 min"
                                        color="blue"
                                    />
                                    <ActivityItem
                                        icon={AlertCircle}
                                        text="Nuevo ticket creado"
                                        time="Hace 15 min"
                                        color="orange"
                                    />
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

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
    value: number; 
    icon: any; 
    color: string;
    subtitle?: string;
    onClick?: () => void;
}) => {
    const colors: Record<string, string> = {
        blue: 'bg-blue-50 text-blue-600',
        green: 'bg-green-50 text-green-600',
        orange: 'bg-orange-50 text-orange-600',
        purple: 'bg-purple-50 text-purple-600',
    };

    return (
        <div 
            onClick={onClick}
            className={`bg-white rounded-lg border p-4 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
        >
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">{title}</span>
                <div className={`p-2 rounded-lg ${colors[color]}`}>
                    <Icon className="w-4 h-4" />
                </div>
            </div>
            <p className="text-2xl font-bold text-gray-800">{value.toLocaleString()}</p>
            {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
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
    };

    return (
        <button 
            onClick={onClick}
            className={`relative p-4 rounded-lg text-white text-left transition-colors ${colors[color]}`}
        >
            <Icon className="w-6 h-6 mb-2" />
            <p className="font-semibold">{title}</p>
            <p className="text-sm opacity-80">{description}</p>
            {badge !== undefined && badge > 0 && (
                <span className="absolute top-2 right-2 bg-white text-gray-800 text-xs px-2 py-1 rounded-full font-bold">
                    {badge}
                </span>
            )}
        </button>
    );
};

// Status Item Component
const StatusItem = ({ label, status }: { label: string; status: 'active' | 'inactive' | 'warning' }) => {
    const colors = {
        active: 'bg-green-500',
        inactive: 'bg-gray-400',
        warning: 'bg-yellow-500'
    };

    return (
        <div className="flex items-center justify-between">
            <span className="text-gray-600">{label}</span>
            <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${colors[status]}`} />
                <span className="text-sm text-gray-500 capitalize">{status === 'active' ? 'Activo' : status}</span>
            </div>
        </div>
    );
};

// Activity Item Component
const ActivityItem = ({ 
    icon: Icon, 
    text, 
    time, 
    color 
}: { 
    icon: any; 
    text: string; 
    time: string; 
    color: string;
}) => {
    const colors: Record<string, string> = {
        green: 'text-green-500',
        blue: 'text-blue-500',
        orange: 'text-orange-500',
    };

    return (
        <div className="flex items-start gap-3">
            <Icon className={`w-5 h-5 mt-0.5 ${colors[color]}`} />
            <div className="flex-1">
                <p className="text-sm text-gray-700">{text}</p>
                <p className="text-xs text-gray-400">{time}</p>
            </div>
        </div>
    );
};

// Settings Panel Component
const SettingsPanel = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
    
    // Usar localStorage para persistir configuraciones
    const [knowledgeConfig, setKnowledgeConfig] = useLocalStorage<KnowledgeConfig>(
        STORAGE_KEYS.KNOWLEDGE_CONFIG, 
        DEFAULT_CONFIGS.knowledge
    );

    const [escalationConfig, setEscalationConfig] = useLocalStorage<EscalationConfig>(
        STORAGE_KEYS.ESCALATION_CONFIG, 
        DEFAULT_CONFIGS.escalation
    );

    const [broadcastConfig, setBroadcastConfig] = useLocalStorage<BroadcastConfig>(
        STORAGE_KEYS.BROADCAST_CONFIG, 
        DEFAULT_CONFIGS.broadcast
    );

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        setLoading(true);
        try {
            const [knowledgeRes, escalationRes, broadcastRes] = await Promise.all([
                knowledgeApi.getConfig(),
                escalationApi.getConfig(),
                broadcastApi.getConfig()
            ]);

            // Merge con valores del servidor (servidor tiene prioridad si existe)
            if (knowledgeRes.data.success && knowledgeRes.data.data) {
                const serverData = knowledgeRes.data.data;
                setKnowledgeConfig(prev => ({ ...prev, ...serverData }));
            }
            if (escalationRes.data.success && escalationRes.data.data) {
                const serverData = escalationRes.data.data;
                setEscalationConfig(prev => ({ ...prev, ...serverData }));
            }
            if (broadcastRes.data.success && broadcastRes.data.data) {
                const serverData = broadcastRes.data.data;
                setBroadcastConfig(prev => ({ ...prev, ...serverData }));
            }
        } catch (error) {
            console.error('Error loading config from server, using local values:', error);
            // Si falla la carga del servidor, ya tenemos valores en localStorage
        } finally {
            setLoading(false);
        }
    };

    const saveConfig = async () => {
        setSaving(true);
        setMessage(null);
        try {
            await Promise.all([
                knowledgeApi.updateConfig(knowledgeConfig),
                escalationApi.updateConfig(escalationConfig),
                broadcastApi.updateConfig(broadcastConfig)
            ]);
            setMessage({ type: 'success', text: 'Configuración guardada exitosamente' });
        } catch (error) {
            console.error('Error saving config:', error);
            setMessage({ type: 'error', text: 'Error al guardar la configuración' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <RefreshCw className="w-8 h-8 animate-spin text-whatsapp-green" />
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto p-3 sm:p-6">
            <div className="max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Configuración</h2>
                    <button
                        onClick={loadConfig}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                        title="Recargar configuración"
                    >
                        <RefreshCw className="w-5 h-5" />
                    </button>
                </div>

                {message && (
                    <div className={`mb-4 p-3 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {message.text}
                    </div>
                )}
                
                <div className="space-y-6">
                    {/* Knowledge Base Config */}
                    <div className="bg-white rounded-lg border p-4 sm:p-6">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-blue-500" />
                            Base de Conocimiento
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Nombre del Negocio
                                </label>
                                <input
                                    type="text"
                                    value={knowledgeConfig.businessName}
                                    onChange={(e) => setKnowledgeConfig(prev => ({ ...prev, businessName: e.target.value }))}
                                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-whatsapp-green"
                                    placeholder="Mi Empresa"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Descripción del Negocio
                                </label>
                                <textarea
                                    value={knowledgeConfig.businessDescription}
                                    onChange={(e) => setKnowledgeConfig(prev => ({ ...prev, businessDescription: e.target.value }))}
                                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-whatsapp-green"
                                    rows={2}
                                    placeholder="Describe tu negocio..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Tono de Respuestas
                                </label>
                                <select 
                                    value={knowledgeConfig.toneStyle}
                                    onChange={(e) => setKnowledgeConfig(prev => ({ ...prev, toneStyle: e.target.value }))}
                                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-whatsapp-green"
                                >
                                    <option value="professional">Profesional</option>
                                    <option value="friendly">Amigable</option>
                                    <option value="formal">Formal</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Confianza para Responder
                                    </label>
                                    <input
                                        type="number"
                                        step="0.05"
                                        min="0"
                                        max="1"
                                        value={knowledgeConfig.minConfidenceToRespond}
                                        onChange={(e) => setKnowledgeConfig(prev => ({ ...prev, minConfidenceToRespond: parseFloat(e.target.value) }))}
                                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-whatsapp-green"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Confianza para Confirmar
                                    </label>
                                    <input
                                        type="number"
                                        step="0.05"
                                        min="0"
                                        max="1"
                                        value={knowledgeConfig.minConfidenceToConfirm}
                                        onChange={(e) => setKnowledgeConfig(prev => ({ ...prev, minConfidenceToConfirm: parseFloat(e.target.value) }))}
                                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-whatsapp-green"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium">Aprendizaje Automático</p>
                                    <p className="text-sm text-gray-500">Aprender de conversaciones exitosas</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer" 
                                        checked={knowledgeConfig.enableAutoLearn}
                                        onChange={(e) => setKnowledgeConfig(prev => ({ ...prev, enableAutoLearn: e.target.checked }))}
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-whatsapp-green"></div>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Escalation Config */}
                    <div className="bg-white rounded-lg border p-4 sm:p-6">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Ticket className="w-5 h-5 text-orange-500" />
                            Sistema de Escalación
                        </h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium">Asignación Automática</p>
                                    <p className="text-sm text-gray-500">Asignar tickets automáticamente a admins</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer" 
                                        checked={escalationConfig.autoAssign}
                                        onChange={(e) => setEscalationConfig(prev => ({ ...prev, autoAssign: e.target.checked }))}
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-whatsapp-green"></div>
                                </label>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Recordatorio (minutos)
                                    </label>
                                    <input
                                        type="number"
                                        value={escalationConfig.reminderInterval}
                                        onChange={(e) => setEscalationConfig(prev => ({ ...prev, reminderInterval: parseInt(e.target.value) }))}
                                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-whatsapp-green"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Tickets máx. por Admin
                                    </label>
                                    <input
                                        type="number"
                                        value={escalationConfig.maxTicketsPerAdmin}
                                        onChange={(e) => setEscalationConfig(prev => ({ ...prev, maxTicketsPerAdmin: parseInt(e.target.value) }))}
                                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-whatsapp-green"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Broadcast Config */}
                    <div className="bg-white rounded-lg border p-4 sm:p-6">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Send className="w-5 h-5 text-green-500" />
                            Difusión Masiva
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Delay entre Mensajes (ms)
                                </label>
                                <input
                                    type="number"
                                    value={broadcastConfig.messageDelay}
                                    onChange={(e) => setBroadcastConfig(prev => ({ ...prev, messageDelay: parseInt(e.target.value) }))}
                                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-whatsapp-green"
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium">Randomizar Delay</p>
                                    <p className="text-sm text-gray-500">Variar el tiempo entre mensajes</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer" 
                                        checked={broadcastConfig.randomizeDelay}
                                        onChange={(e) => setBroadcastConfig(prev => ({ ...prev, randomizeDelay: e.target.checked }))}
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-whatsapp-green"></div>
                                </label>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Horario Permitido
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="time"
                                        value={broadcastConfig.startHour}
                                        onChange={(e) => setBroadcastConfig(prev => ({ ...prev, startHour: e.target.value }))}
                                        className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:border-whatsapp-green"
                                    />
                                    <span className="self-center">a</span>
                                    <input
                                        type="time"
                                        value={broadcastConfig.endHour}
                                        onChange={(e) => setBroadcastConfig(prev => ({ ...prev, endHour: e.target.value }))}
                                        className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:border-whatsapp-green"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Save Button */}
                    <div className="flex flex-col sm:flex-row justify-end gap-3">
                        <button 
                            onClick={loadConfig}
                            className="px-6 py-2 border rounded-lg hover:bg-gray-50 order-2 sm:order-1"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={saveConfig}
                            disabled={saving}
                            className="px-6 py-2 bg-whatsapp-green text-white rounded-lg hover:bg-whatsapp-dark disabled:opacity-50 flex items-center justify-center gap-2 order-1 sm:order-2"
                        >
                            {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                            Guardar Configuración
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
