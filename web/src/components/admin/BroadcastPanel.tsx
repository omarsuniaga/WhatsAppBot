/**
 * Broadcast Panel
 * Gestión de campañas de difusión masiva
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Send, Users, Plus, Play, Pause, Trash2,
    FileText, RefreshCw, CheckCircle,
    AlertCircle, List, Upload, ArrowRight, Sparkles
} from 'lucide-react';
import { broadcastApi } from '../../api/client';
import { ContactImporter } from './ContactImporter';

interface ContactList {
    id: string;
    name: string;
    description?: string;
    contacts: any[];
    isActive: boolean;
}

interface Campaign {
    id: string;
    name: string;
    message: string;
    status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed';
    totalRecipients: number;
    sent: number;
    delivered: number;
    failed: number;
    createdAt: string;
    completedAt?: string;
}

interface Template {
    id: string;
    name: string;
    content: string;
    category: string;
    variables: string[];
}

const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    scheduled: 'bg-blue-100 text-blue-700',
    running: 'bg-yellow-100 text-yellow-700',
    paused: 'bg-orange-100 text-orange-700',
    completed: 'bg-green-100 text-green-700'
};

const statusLabels: Record<string, string> = {
    draft: 'Borrador',
    scheduled: 'Programada',
    running: 'En Curso',
    paused: 'Pausada',
    completed: 'Completada'
};

export const BroadcastPanel = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'campaigns' | 'lists' | 'templates'>('campaigns');
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [lists, setLists] = useState<ContactList[]>([]);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any>(null);

    // Modals
    const [showCampaignModal, setShowCampaignModal] = useState(false);
    const [showListModal, setShowListModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState<string | null>(null);

    // Form data
    const [campaignForm, setCampaignForm] = useState({
        name: '',
        message: '',
        targetLists: [] as string[],
        delayBetweenMessages: 3000,
        personalizeMessage: true
    });

    const [listForm, setListForm] = useState({
        name: '',
        description: ''
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [campaignsRes, listsRes, templatesRes, statsRes] = await Promise.all([
                broadcastApi.getCampaigns(),
                broadcastApi.getLists(),
                broadcastApi.getTemplates(),
                broadcastApi.getStats()
            ]);
            setCampaigns(campaignsRes.data.data || []);
            setLists(listsRes.data.data || []);
            setTemplates(templatesRes.data.data || []);
            setStats(statsRes.data.data);
        } catch (error) {
            console.error('Error loading broadcast data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateCampaign = async () => {
        try {
            await broadcastApi.createCampaign(campaignForm);
            setShowCampaignModal(false);
            setCampaignForm({
                name: '',
                message: '',
                targetLists: [],
                delayBetweenMessages: 3000,
                personalizeMessage: true
            });
            loadData();
        } catch (error) {
            console.error('Error creating campaign:', error);
        }
    };

    const handleStartCampaign = async (id: string) => {
        try {
            await broadcastApi.startCampaign(id);
            loadData();
        } catch (error: any) {
            console.error('Error starting campaign:', error);
            loadData();
            const message = error?.response?.data?.error || 'Error al iniciar la campaña';
            alert(message);
        }
    };

    const handlePauseCampaign = async (id: string) => {
        try {
            await broadcastApi.pauseCampaign(id);
            loadData();
        } catch (error: any) {
            console.error('Error pausing campaign:', error);
            // Refresh data to sync UI with actual campaign state
            loadData();
            const message = error?.response?.data?.error || 'Error al pausar la campaña';
            alert(message);
        }
    };

    const handleDeleteCampaign = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar esta campaña?')) return;
        try {
            await broadcastApi.deleteCampaign(id);
            loadData();
        } catch (error) {
            console.error('Error deleting campaign:', error);
        }
    };

    const handleCreateList = async () => {
        try {
            await broadcastApi.createList(listForm);
            setShowListModal(false);
            setListForm({ name: '', description: '' });
            loadData();
        } catch (error) {
            console.error('Error creating list:', error);
        }
    };

    const handleDeleteList = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar esta lista?')) return;
        try {
            await broadcastApi.deleteList(id);
            loadData();
        } catch (error) {
            console.error('Error deleting list:', error);
        }
    };

    const totalContacts = lists.reduce((sum, list) => sum + list.contacts.length, 0);

    return (
        <div
            className="h-full w-full flex flex-col bg-gray-50 dark:bg-gray-800 transition-colors"
            role="region"
            aria-label="Gestor de campañas de difusión"
        >
            {/* Header - Responsive */}
            <header
                className="bg-white dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex-shrink-0"
                style={{
                    padding: 'clamp(0.75rem, 1vw, 1rem)',
                }}
            >
                <div className="flex items-center justify-between gap-2 mb-clamp">
                    <div className="flex items-center gap-2 min-w-0">
                        <Send className="w-5 h-5 sm:w-6 sm:h-6 text-whatsapp-green flex-shrink-0" />
                        <h3 className="font-semibold text-gray-800 dark:text-gray-100 truncate text-sm sm:text-base">
                            Difusión Masiva
                        </h3>
                    </div>
                    <button
                        onClick={loadData}
                        className="p-2 sm:p-2.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors flex-shrink-0"
                        aria-label="Actualizar datos"
                        title="Actualizar"
                    >
                        <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                </div>

                {/* Stats Grid - Responsive columns */}
                <div
                    className="grid gap-2 mb-3 sm:mb-4"
                    style={{
                        gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))',
                    }}
                >
                    <div className="bg-blue-50 dark:bg-blue-900 rounded-lg p-2 sm:p-2.5 text-center">
                        <p className="text-lg sm:text-2xl font-bold dark:text-blue-200">{campaigns.length}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-300">Campañas</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-700 rounded-lg p-2 sm:p-2.5 text-center">
                        <p className="text-lg sm:text-2xl font-bold dark:text-green-200">{lists.length}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-300">Listas</p>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900 rounded-lg p-2 sm:p-2.5 text-center">
                        <p className="text-lg sm:text-2xl font-bold text-purple-600 dark:text-purple-200">{totalContacts}</p>
                        <p className="text-xs text-gray-600 dark:text-purple-200">Contactos</p>
                    </div>
                    <div className="bg-yellow-50 dark:bg-yellow-900 rounded-lg p-2 sm:p-2.5 text-center">
                        <p className="text-lg sm:text-2xl font-bold text-yellow-600 dark:text-yellow-200">{stats?.totalMessagesSent || 0}</p>
                        <p className="text-xs text-gray-600 dark:text-yellow-200">Enviados</p>
                    </div>
                </div>

                {/* Tabs - Responsive sizing */}
                <nav
                    className="flex border-b border-gray-200 dark:border-gray-600 gap-1 overflow-x-auto"
                    role="tablist"
                    aria-label="Secciones de broadcast"
                >
                    <button
                        onClick={() => setActiveTab('campaigns')}
                        className={`px-3 sm:px-4 py-2 border-b-2 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'campaigns'
                            ? 'border-whatsapp-green text-whatsapp-green'
                            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                        role="tab"
                        aria-selected={activeTab === 'campaigns'}
                    >
                        <Send className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Campañas</span>
                        <span className="sm:hidden">Camp.</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('lists')}
                        className={`px-3 sm:px-4 py-2 border-b-2 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'lists'
                            ? 'border-whatsapp-green text-whatsapp-green'
                            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                        role="tab"
                        aria-selected={activeTab === 'lists'}
                    >
                        <Users className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Listas</span>
                        <span className="sm:hidden">Ltas.</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('templates')}
                        className={`px-3 sm:px-4 py-2 border-b-2 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'templates'
                            ? 'border-whatsapp-green text-whatsapp-green'
                            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                        role="tab"
                        aria-selected={activeTab === 'templates'}
                    >
                        <FileText className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Plantillas</span>
                        <span className="sm:hidden">Plant.</span>
                    </button>
                </nav>
            </header>

            {/* Content - Responsive padding */}
            <main
                className="flex-1 overflow-y-auto"
                role="tabpanel"
                style={{
                    padding: 'clamp(0.75rem, 1vw, 1rem)',
                }}
            >
                {loading ? (
                    <div className="flex items-center justify-center h-32 sm:h-48">
                        <div className="flex flex-col items-center gap-2">
                            <RefreshCw className="w-8 h-8 sm:w-10 sm:h-10 animate-spin text-whatsapp-green" />
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Cargando...</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Campaigns Tab */}
                        {activeTab === 'campaigns' && (
                            <div>
                                <div className="flex justify-end mb-3 sm:mb-4">
                                    <button
                                        onClick={() => setShowCampaignModal(true)}
                                        className="flex items-center gap-1 sm:gap-2 bg-whatsapp-green text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg hover:bg-whatsapp-dark text-xs sm:text-sm font-medium transition-colors active:scale-95"
                                        aria-label="Crear nueva campaña"
                                    >
                                        <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                                        <span>Nueva</span>
                                    </button>
                                </div>

                                {campaigns.length === 0 ? (
                                    <div className="text-center py-8 sm:py-12">
                                        <Send className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-3 sm:mb-4" />
                                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">No hay campañas creadas</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2 sm:space-y-3">
                                        {campaigns.map(campaign => (
                                            <div key={campaign.id} className="bg-white dark:bg-purple-950 rounded-lg border border-gray-200 dark:border-purple-700 p-3 sm:p-4">
                                                <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
                                                    <div className="min-w-0 flex-1">
                                                        <h3 className="font-semibold text-sm sm:text-base text-gray-800 dark:text-gray-200 truncate">{campaign.name}</h3>
                                                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 line-clamp-1">{campaign.message}</p>
                                                    </div>
                                                    <span className={`text-xs px-2 py-1 rounded whitespace-nowrap flex-shrink-0 ${statusColors[campaign.status]}`}>
                                                        {statusLabels[campaign.status]}
                                                    </span>
                                                </div>

                                                {/* Progress */}
                                                {campaign.status === 'running' && (
                                                    <div className="mb-2 sm:mb-3">
                                                        <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                                                            <span className="font-medium">Progreso</span>
                                                            <span>{campaign.sent} / {campaign.totalRecipients}</span>
                                                        </div>
                                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                            <div
                                                                className="bg-whatsapp-green h-2 rounded-full transition-all"
                                                                style={{ width: `${(campaign.sent / campaign.totalRecipients) * 100}%` }}
                                                                role="progressbar"
                                                                aria-valuenow={Math.round((campaign.sent / campaign.totalRecipients) * 100)}
                                                                aria-valuemin={0}
                                                                aria-valuemax={100}
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Stats - Responsive layout */}
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2 sm:mb-3">
                                                    <div className="flex flex-col items-center gap-0.5">
                                                        <Users className="w-4 h-4" />
                                                        <span className="font-medium text-gray-800 dark:text-gray-200">{campaign.totalRecipients}</span>
                                                        <span className="text-xs">Dest.</span>
                                                    </div>
                                                    <div className="flex flex-col items-center gap-0.5">
                                                        <CheckCircle className="w-4 h-4 text-green-500" />
                                                        <span className="font-medium text-gray-800 dark:text-gray-200">{campaign.sent}</span>
                                                        <span className="text-xs">Env.</span>
                                                    </div>
                                                    {campaign.failed > 0 && (
                                                        <div className="flex flex-col items-center gap-0.5 text-red-600 dark:text-red-400">
                                                            <AlertCircle className="w-4 h-4" />
                                                            <span className="font-medium">{campaign.failed}</span>
                                                            <span className="text-xs">Errores</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Actions - Responsive buttons */}
                                                <div className="flex justify-end gap-1 sm:gap-2 flex-wrap">
                                                    {campaign.status === 'draft' && (
                                                        <button
                                                            onClick={() => handleStartCampaign(campaign.id)}
                                                            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-green-500 hover:bg-green-600 text-white rounded text-xs sm:text-sm font-medium transition-colors active:scale-95"
                                                            aria-label="Iniciar campaña"
                                                        >
                                                            <Play className="w-3 h-3 sm:w-4 sm:h-4" />
                                                            <span className="hidden sm:inline">Iniciar</span>
                                                            <span className="sm:hidden">Ini</span>
                                                        </button>
                                                    )}
                                                    {campaign.status === 'running' && (
                                                        <button
                                                            onClick={() => handlePauseCampaign(campaign.id)}
                                                            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-orange-500 hover:bg-orange-600 text-white rounded text-xs sm:text-sm font-medium transition-colors active:scale-95"
                                                            aria-label="Pausar campaña"
                                                        >
                                                            <Pause className="w-3 h-3 sm:w-4 sm:h-4" />
                                                            <span className="hidden sm:inline">Pausar</span>
                                                            <span className="sm:hidden">Pau</span>
                                                        </button>
                                                    )}
                                                    {campaign.status === 'paused' && (
                                                        <button
                                                            onClick={() => handleStartCampaign(campaign.id)}
                                                            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-green-500 hover:bg-green-600 text-white rounded text-xs sm:text-sm font-medium transition-colors active:scale-95"
                                                            aria-label="Reanudar campaña"
                                                        >
                                                            <Play className="w-3 h-3 sm:w-4 sm:h-4" />
                                                            <span className="hidden sm:inline">Reanudar</span>
                                                            <span className="sm:hidden">Ren</span>
                                                        </button>
                                                    )}
                                                    {campaign.status !== 'running' && (
                                                        <button
                                                            onClick={() => handleDeleteCampaign(campaign.id)}
                                                            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-red-500 hover:bg-red-600 text-white rounded text-xs sm:text-sm font-medium transition-colors active:scale-95"
                                                            aria-label="Eliminar campaña"
                                                        >
                                                            <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                                                            <span className="hidden sm:inline">Eliminar</span>
                                                            <span className="sm:hidden">Del</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Lists Tab */}
                        {activeTab === 'lists' && (
                            <div>
                                <div className="flex justify-end mb-3 sm:mb-4">
                                    <button
                                        onClick={() => setShowListModal(true)}
                                        className="flex items-center gap-1 sm:gap-2 bg-whatsapp-green text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg hover:bg-whatsapp-dark text-xs sm:text-sm font-medium transition-colors active:scale-95"
                                        aria-label="Crear nueva lista"
                                    >
                                        <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                                        <span>Nueva</span>
                                    </button>
                                </div>

                                {lists.length === 0 ? (
                                    <div className="text-center py-8 sm:py-12">
                                        <Users className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-3 sm:mb-4" />
                                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">No hay listas de contactos</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                        {lists.map(list => (
                                            <div key={list.id} className="bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-3 sm:p-4">
                                                <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
                                                    <div className="min-w-0 flex-1">
                                                        <h3 className="font-semibold text-sm sm:text-base text-gray-800 dark:text-gray-100 truncate">{list.name}</h3>
                                                        {list.description && (
                                                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 line-clamp-1">{list.description}</p>
                                                        )}
                                                    </div>
                                                    <List className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" />
                                                </div>
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-xs sm:text-sm text-gray-499 dark:text-gray-400 font-medium">
                                                        {list.contacts.length} contactos
                                                    </span>
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => setShowImportModal(list.id)}
                                                            className="p-2 sm:p-2.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                                            title="Importar contactos"
                                                            aria-label={`Importar contactos a ${list.name}`}
                                                        >
                                                            <Upload className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteList(list.id)}
                                                            className="p-2 sm:p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                            title="Eliminar lista"
                                                            aria-label={`Eliminar lista ${list.name}`}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Templates Tab */}
                        {activeTab === 'templates' && (
                            <div>
                                {templates.length === 0 ? (
                                    <div className="text-center py-8 sm:py-12 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                                        <FileText className="w-12 h-12 sm:w-16 sm:h-16 text-purple-300 mx-auto mb-3 sm:mb-4" />
                                        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4">Crea y gestiona plantillas de mensajes</p>
                                        <button
                                            onClick={() => navigate('/templates')}
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg font-medium transition-colors"
                                        >
                                            <Sparkles className="w-4 h-4" />
                                            Ir a Plantillas
                                            <ArrowRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3 sm:space-y-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="font-semibold text-gray-800 dark:text-gray-100">Plantillas disponibles</h3>
                                            <button
                                                onClick={() => navigate('/templates')}
                                                className="inline-flex items-center gap-2 px-3 py-1 text-xs sm:text-sm bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-lg transition-colors"
                                            >
                                                <Sparkles className="w-3 h-3" />
                                                Gestionar Plantillas
                                                <ArrowRight className="w-3 h-3" />
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                            {templates.map(template => (
                                                <div key={template.id} className="bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-3 sm:p-4">
                                                    <h3 className="font-semibold text-sm sm:text-base text-gray-800 dark:text-gray-100 mb-2">{template.name}</h3>
                                                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 line-clamp-3 mb-2">{template.content}</p>
                                                    {template.variables.length > 0 && (
                                                        <div className="flex flex-wrap gap-1">
                                                            {template.variables.map((v, i) => (
                                                                <span key={i} className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 px-2 py-0.5 rounded font-medium">
                                                                    {`{${v}}`}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </main>

            {/* Campaign Modal - Responsive */}
            {showCampaignModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-700 rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-600 sticky top-0 bg-white dark:bg-gray-700">
                            <h3 className="text-base sm:text-lg font-semibold dark:text-gray-100">Nueva Campaña</h3>
                        </div>
                        <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                            <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Nombre de la Campaña
                                </label>
                                <input
                                    type="text"
                                    value={campaignForm.name}
                                    onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green dark:bg-gray-600 dark:text-gray-100 text-sm"
                                    placeholder="Ej: Promoción Enero 2024"
                                />
                            </div>
                            <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Mensaje
                                </label>
                                <textarea
                                    value={campaignForm.message}
                                    onChange={(e) => setCampaignForm({ ...campaignForm, message: e.target.value })}
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green dark:bg-gray-600 dark:text-gray-100 resize-none text-sm"
                                    placeholder="Hola {nombre}! Te traemos una promoción especial..."
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Usa {'{nombre}'} para personalizar
                                </p>
                            </div>
                            <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Listas de Contactos
                                </label>
                                <div className="space-y-1.5 max-h-32 overflow-y-auto bg-gray-50 dark:bg-gray-600 rounded p-2">
                                    {lists.map(list => (
                                        <label key={list.id} className="flex items-center gap-2 cursor-pointer text-xs sm:text-sm">
                                            <input
                                                type="checkbox"
                                                checked={campaignForm.targetLists.includes(list.id)}
                                                onChange={(e) => {
                                                    const newLists = e.target.checked
                                                        ? [...campaignForm.targetLists, list.id]
                                                        : campaignForm.targetLists.filter(id => id !== list.id);
                                                    setCampaignForm({ ...campaignForm, targetLists: newLists });
                                                }}
                                                className="rounded w-4 h-4 cursor-pointer"
                                            />
                                            <span className="dark:text-gray-200">{list.name} ({list.contacts.length})</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="p-3 sm:p-4 border-t border-gray-200 dark:border-gray-600 flex justify-end gap-2 sticky bottom-0 bg-white dark:bg-gray-700">
                            <button
                                onClick={() => setShowCampaignModal(false)}
                                className="px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 text-sm font-medium transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateCampaign}
                                disabled={!campaignForm.name || !campaignForm.message || campaignForm.targetLists.length === 0}
                                className="px-3 sm:px-4 py-2 bg-whatsapp-green text-white rounded-lg hover:bg-whatsapp-dark disabled:opacity-50 text-sm font-medium transition-colors"
                            >
                                Crear
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* List Modal - Responsive */}
            {showListModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-700 rounded-lg w-full max-w-md">
                        <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-600">
                            <h3 className="text-base sm:text-lg font-semibold dark:text-gray-100">Nueva Lista de Contactos</h3>
                        </div>
                        <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                            <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Nombre
                                </label>
                                <input
                                    type="text"
                                    value={listForm.name}
                                    onChange={(e) => setListForm({ ...listForm, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green dark:bg-gray-600 dark:text-gray-100 text-sm"
                                    placeholder="Ej: Clientes VIP"
                                />
                            </div>
                            <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Descripción (opcional)
                                </label>
                                <input
                                    type="text"
                                    value={listForm.description}
                                    onChange={(e) => setListForm({ ...listForm, description: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green dark:bg-gray-600 dark:text-gray-100 text-sm"
                                    placeholder="Descripción corta"
                                />
                            </div>
                        </div>
                        <div className="p-3 sm:p-4 border-t border-gray-200 dark:border-gray-600 flex justify-end gap-2">
                            <button
                                onClick={() => setShowListModal(false)}
                                className="px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 text-sm font-medium transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateList}
                                disabled={!listForm.name}
                                className="px-3 sm:px-4 py-2 bg-whatsapp-green text-white rounded-lg hover:bg-whatsapp-dark disabled:opacity-50 text-sm font-medium transition-colors"
                            >
                                Crear
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Contact Importer Modal */}
            {showImportModal && (
                <ContactImporter
                    listId={showImportModal}
                    onImportComplete={(result) => {
                        console.log('Import completed:', result);
                        loadData();
                    }}
                    onClose={() => setShowImportModal(null)}
                />
            )}
        </div>
    );
};

export default BroadcastPanel;
