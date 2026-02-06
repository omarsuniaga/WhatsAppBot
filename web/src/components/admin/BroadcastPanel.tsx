/**
 * Broadcast Panel
 * Gestión de campañas de difusión masiva
 */

import { useState, useEffect } from 'react';
import { 
    Send, Users, Plus, Play, Pause, Trash2,
    FileText, RefreshCw, CheckCircle,
    AlertCircle, List, Upload
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
        <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-800 transition-colors">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 p-4 transition-colors">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Send className="w-6 h-6 text-whatsapp-green" />
                        <h2 className="text-xl font-semibold dark:text-white">Difusión Masiva</h2>
                    </div>
                    <button
                        onClick={loadData}
                        className="p-2 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        <RefreshCw className="w-5 h-5" />
                    </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-3 mb-4 dark:bg-gray-800">
                    <div className="bg-blue-50 rounded-lg p-3 text-center dark:bg-blue-900">
                        <p className="text-2xl font-bold dark:text-blue-200">{campaigns.length}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-100">Campañas</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 text-center dark:bg-green-600">
                        <p className="text-2xl font-bold dark:text-green-200">{lists.length}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-100">Listas</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3 text-center dark:bg-purple-900 ">
                        <p className="text-2xl font-bold text-purple-200">{totalContacts}</p>
                        <p className="text-xs text-gray-500 dark:text-purple-100">Contactos</p>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-3 text-center dark:bg-yellow-900  ">
                        <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-200">{stats?.totalMessagesSent || 0}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-100">Enviados</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b dark:border-gray-700">
                    <button
                        onClick={() => setActiveTab('campaigns')}
                        className={`px-4 py-2 border-b-2 ${
                            activeTab === 'campaigns' 
                                ? 'border-whatsapp-green text-whatsapp-green' 
                                : 'border-transparent text-gray-500'
                        }`}
                    >
                        <Send className="w-4 h-4 inline mr-2" />
                        Campañas
                    </button>
                    <button
                        onClick={() => setActiveTab('lists')}
                        className={`px-4 py-2 border-b-2 ${
                            activeTab === 'lists' 
                                ? 'border-whatsapp-green text-whatsapp-green' 
                                : 'border-transparent text-gray-500'
                        }`}
                    >
                        <Users className="w-4 h-4 inline mr-2" />
                        Listas de Contactos
                    </button>
                    <button
                        onClick={() => setActiveTab('templates')}
                        className={`px-4 py-2 border-b-2 ${
                            activeTab === 'templates' 
                                ? 'border-whatsapp-green text-whatsapp-green' 
                                : 'border-transparent text-gray-500'
                        }`}
                    >
                        <FileText className="w-4 h-4 inline mr-2" />
                        Plantillas
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <RefreshCw className="w-8 h-8 animate-spin text-whatsapp-green" />
                    </div>
                ) : (
                    <>
                        {/* Campaigns Tab */}
                        {activeTab === 'campaigns' && (
                            <div>
                                <div className="flex justify-end mb-4">
                                    <button
                                        onClick={() => setShowCampaignModal(true)}
                                        className="flex items-center gap-2 bg-whatsapp-green text-white px-4 py-2 rounded-lg hover:bg-whatsapp-dark"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Nueva Campaña
                                    </button>
                                </div>

                                {campaigns.length === 0 ? (
                                    <div className="text-center py-12">
                                        <Send className="w-16 h-16 text-gray-300 mx-auto mb-4 " />
                                        <p className="text-gray-500">No hay campañas creadas</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {campaigns.map(campaign => (
                                            <div key={campaign.id} className="bg-white rounded-lg border p-4 dark:bg-purple-950 dark:border-purple-700">
                                                <div className="flex items-start justify-between mb-3">
                                                    <div>
                                                        <h3 className="font-semibold  text-gray-800 dark:text-gray-200">{campaign.name}</h3>
                                                        <p className="text-sm text-gray-900 line-clamp-1 dark:text-gray-200">{campaign.message}</p>
                                                    </div>
                                                    <span className={`text-xs px-2 py-1 rounded ${statusColors[campaign.status]}`}>
                                                        {statusLabels[campaign.status]}
                                                    </span>
                                                </div>

                                                {/* Progress */}
                                                {campaign.status === 'running' && (
                                                    <div className="mb-3">
                                                        <div className="flex justify-between text-xs text-gray-500 mb-1 dark:text-white">
                                                            <span>Progreso</span>
                                                            <span>{campaign.sent} / {campaign.totalRecipients}</span>
                                                        </div>
                                                        <div className="w-full bg-gray-200 rounded-full h-2 mb-2 dark:bg-gray-700">
                                                            <div 
                                                                className="bg-whatsapp-green h-2 rounded-full transition-all"
                                                                style={{ width: `${(campaign.sent / campaign.totalRecipients) * 100}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Stats */}
                                                <div className="flex items-center gap-4 text-sm text-gray-500 mb-3 dark:text-gray-300">
                                                    <span className="flex items-center gap-1">
                                                        <Users className="w-4 h-4" />
                                                        {campaign.totalRecipients} destinatarios
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <CheckCircle className="w-4 h-4 text-green-500" />
                                                        {campaign.sent} enviados
                                                    </span>
                                                    {campaign.failed > 0 && (
                                                        <span className="flex items-center gap-1 text-red-500">
                                                            <AlertCircle className="w-4 h-4" />
                                                            {campaign.failed} fallidos
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Actions */}
                                                <div className="flex justify-end gap-2">
                                                    {campaign.status === 'draft' && (
                                                        <button
                                                            onClick={() => handleStartCampaign(campaign.id)}
                                                            className="flex items-center gap-1 px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                                                        >
                                                            <Play className="w-4 h-4" />
                                                            Iniciar
                                                        </button>
                                                    )}
                                                    {campaign.status === 'running' && (
                                                        <button
                                                            onClick={() => handlePauseCampaign(campaign.id)}
                                                            className="flex items-center gap-1 px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 text-sm"
                                                        >
                                                            <Pause className="w-4 h-4" />
                                                            Pausar
                                                        </button>
                                                    )}
                                                    {campaign.status === 'paused' && (
                                                        <button
                                                            onClick={() => handleStartCampaign(campaign.id)}
                                                            className="flex items-center gap-1 px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                                                        >
                                                            <Play className="w-4 h-4" />
                                                            Reanudar
                                                        </button>
                                                    )}
                                                    {campaign.status !== 'running' && (
                                                        <button
                                                            onClick={() => handleDeleteCampaign(campaign.id)}
                                                            className="flex items-center gap-1 px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                            Eliminar
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
                                <div className="flex justify-end mb-4">
                                    <button
                                        onClick={() => setShowListModal(true)}
                                        className="flex items-center gap-2 bg-whatsapp-green text-white px-4 py-2 rounded-lg hover:bg-whatsapp-dark"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Nueva Lista
                                    </button>
                                </div>

                                {lists.length === 0 ? (
                                    <div className="text-center py-12">
                                        <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                        <p className="text-gray-500">No hay listas de contactos</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-4">
                                        {lists.map(list => (
                                            <div key={list.id} className="bg-white rounded-lg border p-4">
                                                <div className="flex items-start justify-between mb-2">
                                                    <div>
                                                        <h3 className="font-semibold text-gray-800">{list.name}</h3>
                                                        {list.description && (
                                                            <p className="text-sm text-gray-500">{list.description}</p>
                                                        )}
                                                    </div>
                                                    <List className="w-5 h-5 text-gray-400" />
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-gray-500">
                                                        {list.contacts.length} contactos
                                                    </span>
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => setShowImportModal(list.id)}
                                                            className="p-1 text-blue-500 hover:bg-blue-50 rounded"
                                                            title="Importar contactos"
                                                        >
                                                            <Upload className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteList(list.id)}
                                                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                                                            title="Eliminar lista"
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
                                    <div className="text-center py-12">
                                        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                        <p className="text-gray-500">No hay plantillas creadas</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-4">
                                        {templates.map(template => (
                                            <div key={template.id} className="bg-white rounded-lg border p-4 dark:bg-gray-600 dark:border-gray-700">
                                                <h3 className="font-semibold text-gray-800 mb-2 dark:text-gray-200">{template.name}</h3>
                                                <p className="text-sm text-gray-600 line-clamp-3 mb-2 dark:text-gray-300">{template.content}</p>
                                                {template.variables.length > 0 && (
                                                    <div className="flex flex-wrap gap-1">
                                                        {template.variables.map((v, i) => (
                                                            <span key={i} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                                                {`{${v}}`}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Campaign Modal */}
            {showCampaignModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg w-full max-w-lg">
                        <div className="p-4 border-b">
                            <h3 className="text-lg font-semibold">Nueva Campaña</h3>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Nombre de la Campaña
                                </label>
                                <input
                                    type="text"
                                    value={campaignForm.name}
                                    onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-whatsapp-green"
                                    placeholder="Ej: Promoción Enero 2024"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Mensaje
                                </label>
                                <textarea
                                    value={campaignForm.message}
                                    onChange={(e) => setCampaignForm({ ...campaignForm, message: e.target.value })}
                                    rows={4}
                                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-whatsapp-green resize-none"
                                    placeholder="Hola {nombre}! Te traemos una promoción especial..."
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Usa {'{nombre}'} para personalizar con el nombre del contacto
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Listas de Contactos
                                </label>
                                <div className="space-y-2 max-h-32 overflow-y-auto">
                                    {lists.map(list => (
                                        <label key={list.id} className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={campaignForm.targetLists.includes(list.id)}
                                                onChange={(e) => {
                                                    const newLists = e.target.checked
                                                        ? [...campaignForm.targetLists, list.id]
                                                        : campaignForm.targetLists.filter(id => id !== list.id);
                                                    setCampaignForm({ ...campaignForm, targetLists: newLists });
                                                }}
                                                className="rounded"
                                            />
                                            <span className="text-sm">{list.name} ({list.contacts.length})</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t flex justify-end gap-2">
                            <button
                                onClick={() => setShowCampaignModal(false)}
                                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateCampaign}
                                disabled={!campaignForm.name || !campaignForm.message || campaignForm.targetLists.length === 0}
                                className="px-4 py-2 bg-whatsapp-green text-white rounded-lg hover:bg-whatsapp-dark disabled:opacity-50"
                            >
                                Crear Campaña
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* List Modal */}
            {showListModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg w-full max-w-md">
                        <div className="p-4 border-b">
                            <h3 className="text-lg font-semibold">Nueva Lista de Contactos</h3>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Nombre
                                </label>
                                <input
                                    type="text"
                                    value={listForm.name}
                                    onChange={(e) => setListForm({ ...listForm, name: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-whatsapp-green"
                                    placeholder="Ej: Clientes VIP"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Descripción (opcional)
                                </label>
                                <input
                                    type="text"
                                    value={listForm.description}
                                    onChange={(e) => setListForm({ ...listForm, description: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-whatsapp-green"
                                    placeholder="Clientes con compras mayores a $1000"
                                />
                            </div>
                        </div>
                        <div className="p-4 border-t flex justify-end gap-2">
                            <button
                                onClick={() => setShowListModal(false)}
                                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateList}
                                disabled={!listForm.name}
                                className="px-4 py-2 bg-whatsapp-green text-white rounded-lg hover:bg-whatsapp-dark disabled:opacity-50"
                            >
                                Crear Lista
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
