/**
 * Broadcast Panel
 * Gestión de campañas de difusión masiva
 */

import { useState, useEffect } from 'react';
import {
    Send, Users, Plus, Play, Pause, Trash2,
    FileText, RefreshCw, CheckCircle,
    AlertCircle, List, Upload, Sparkles
} from 'lucide-react';
import { broadcastApi } from '../../api/client';
import { ContactImporter } from './ContactImporter';
import { templatesService } from '../../services/firestore';
import { aiApi, GenerateTemplateRequest, GenerateVariationRequest } from '../../api/aiApi';

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
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any>(null);

    // Modals
    const [showCampaignModal, setShowCampaignModal] = useState(false);
    const [showListModal, setShowListModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState<string | null>(null);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

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

    const [templateForm, setTemplateForm] = useState({
        nombre: '',
        contenido: '',
        categoria: 'general',
        tipo: 'texto' as 'texto' | 'imagen' | 'documento',
        etiquetas: [] as string[],
        activo: true
    });

    // AI Assistant state
    const [showAIAssistant, setShowAIAssistant] = useState(false);
    const [aiPurpose, setAiPurpose] = useState('recordatorio');
    const [aiTone, setAiTone] = useState('profesional');
    const [aiContext, setAiContext] = useState('');
    const [generatingAI, setGeneratingAI] = useState(false);

    // Preview state
    const [showPreview, setShowPreview] = useState(false);
    const [previewValues, setPreviewValues] = useState<Record<string, string>>({});

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [campaignsRes, listsRes, statsRes] = await Promise.all([
                broadcastApi.getCampaigns(),
                broadcastApi.getLists(),
                broadcastApi.getStats()
            ]);
            setCampaigns(campaignsRes.data.data || []);
            setLists(listsRes.data.data || []);
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

    const handleCreateTemplate = async () => {
        try {
            // Detectar variables en el contenido
            const variables = extractVariables(templateForm.contenido);

            if (editingTemplate) {
                // Editar plantilla existente
                await templatesService.update(editingTemplate.id, {
                    nombre: templateForm.nombre,
                    contenido: templateForm.contenido,
                    categoria: templateForm.categoria,
                    tipo: templateForm.tipo,
                    etiquetas: templateForm.etiquetas,
                    variables,
                    activo: templateForm.activo
                });
            } else {
                // Crear nueva plantilla
                await templatesService.create({
                    nombre: templateForm.nombre,
                    contenido: templateForm.contenido,
                    categoria: templateForm.categoria,
                    tipo: templateForm.tipo,
                    etiquetas: templateForm.etiquetas,
                    variables,
                    activo: templateForm.activo,
                    uso_count: 0
                });
            }

            setShowTemplateModal(false);
            setEditingTemplate(null);
            resetTemplateForm();
            loadData();
        } catch (error) {
            console.error('Error saving template:', error);
        }
    };

    const resetTemplateForm = () => {
        setTemplateForm({
            nombre: '',
            contenido: '',
            categoria: 'general',
            tipo: 'texto',
            etiquetas: [],
            activo: true
        });
    };

    // Extraer variables del contenido (ej: {{nombre}}, {{fecha}})
    const extractVariables = (content: string): string[] => {
        const regex = /\{\{(\w+)\}\}/g;
        const variables: string[] = [];
        let match;
        while ((match = regex.exec(content)) !== null) {
            if (!variables.includes(match[1])) {
                variables.push(match[1]);
            }
        }
        return variables;
    };

    // Get example value for a variable
    const getExampleValue = (variable: string): string => {
        const examples: Record<string, string> = {
            nombre: 'Juan Pérez',
            apellido: 'Rodríguez',
            fecha: '15 de Mayo',
            hora: '3:00 PM',
            instrumento: 'Piano',
            profesor: 'Prof. María García',
            salon: 'Salón 101',
            alumno: 'Carlos',
            clase: 'Violín Nivel 2',
            evento: 'Recital de Primavera',
            dia: 'Viernes',
            precio: '$500'
        };
        return examples[variable.toLowerCase()] || 'Ejemplo';
    };

    // Render preview with variables replaced
    const renderPreview = (content: string, values: Record<string, string>): string => {
        let preview = content;
        const variables = extractVariables(content);

        variables.forEach(variable => {
            const value = values[variable] || getExampleValue(variable);
            const regex = new RegExp(`\\{\\{${variable}\\}\\}`, 'g');
            preview = preview.replace(regex, value);
        });

        return preview;
    };

    // Generar plantilla con IA
    const handleGenerateWithAI = async () => {
        setGeneratingAI(true);
        try {
            const request: GenerateTemplateRequest = {
                purpose: aiPurpose,
                tone: aiTone,
                additionalContext: aiContext,
                targetAudience: 'padres'
            };

            const response = await aiApi.generateTemplate(request);

            if (response.success && response.template) {
                // Auto-llenar formulario con plantilla generada
                setTemplateForm({
                    ...templateForm,
                    nombre: response.template.nombre,
                    contenido: response.template.contenido,
                    categoria: response.template.categoria
                });

                // Cerrar asistente
                setShowAIAssistant(false);

                // Mostrar éxito
                alert('Usé IA para generar la plantilla. Puedes editarla antes de guardar.');
            }
        } catch (error) {
            console.error('Error generating template with AI:', error);
            alert('Error al generar plantilla con IA. Intenta de nuevo.');
        } finally {
            setGeneratingAI(false);
        }
    };

    // Generar variación de plantilla con IA
    const handleGenerateVariation = async (tone: string) => {
        setGeneratingAI(true);
        try {
            const request: GenerateVariationRequest = {
                baseContent: templateForm.contenido,
                baseName: templateForm.nombre,
                newTone: tone,
                purpose: aiPurpose
            };

            const response = await aiApi.generateVariation(request);

            if (response.success && response.variation) {
                // Auto-llenar formulario con variación
                setTemplateForm({
                    ...templateForm,
                    nombre: response.variation.nombre,
                    contenido: response.variation.contenido
                });

                // Mostrar qué cambió
                if (response.variation.cambios) {
                    alert(`✨ Variación generada: ${response.variation.cambios}`);
                }
            }
        } catch (error) {
            console.error('Error generating variation:', error);
            alert('Error al generar variación. Intenta de nuevo.');
        } finally {
            setGeneratingAI(false);
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
                        className={`px-4 py-2 border-b-2 ${activeTab === 'campaigns'
                            ? 'border-whatsapp-green text-whatsapp-green'
                            : 'border-transparent text-gray-500'
                            }`}
                    >
                        <Send className="w-4 h-4 inline mr-2" />
                        Campañas
                    </button>
                    <button
                        onClick={() => setActiveTab('lists')}
                        className={`px-4 py-2 border-b-2 ${activeTab === 'lists'
                            ? 'border-whatsapp-green text-whatsapp-green'
                            : 'border-transparent text-gray-500'
                            }`}
                    >
                        <Users className="w-4 h-4 inline mr-2" />
                        Listas de Contactos
                    </button>
                    <button
                        onClick={() => setActiveTab('templates')}
                        className={`px-4 py-2 border-b-2 ${activeTab === 'templates'
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

                        {/* Templates Tab - Redirects to /templates page */}
                        {activeTab === 'templates' && (
                            <div className="h-full flex items-center justify-center">
                                <div className="text-center max-w-md">
                                    <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
                                        Gestión de Plantillas
                                    </h3>
                                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                                        La gestión de plantillas se ha movido a una página dedicada para una mejor experiencia.
                                    </p>
                                    <a
                                        href="/templates"
                                        className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium transition-colors"
                                    >
                                        <FileText className="w-5 h-5" />
                                        Ir a Plantillas
                                    </a>
                                </div>
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

            {/* Template Modal */}
            {showTemplateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-4 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10 flex items-center justify-between">
                            <h3 className="text-lg font-semibold dark:text-white">
                                {editingTemplate ? 'Editar Plantilla' : 'Nueva Plantilla'}
                            </h3>
                            <button
                                onClick={() => setShowAIAssistant(!showAIAssistant)}
                                className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                            >
                                <Sparkles className="w-4 h-4" />
                                {showAIAssistant ? 'Ocultar IA' : 'Generar con IA'}
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* AI Assistant Panel */}
                            {showAIAssistant && (
                                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-4 space-y-3 animate-in slide-in-from-top">
                                    <h4 className="font-semibold text-purple-900 dark:text-purple-200 flex items-center gap-2">
                                        <Sparkles className="w-5 h-5" />
                                        Asistente de IA
                                    </h4>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Propósito
                                            </label>
                                            <select
                                                value={aiPurpose}
                                                onChange={(e) => setAiPurpose(e.target.value)}
                                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:border-purple-500 dark:bg-gray-700 dark:text-white text-sm"
                                            >
                                                <option value="recordatorio">Recordatorio de Evento</option>
                                                <option value="bienvenida">Bienvenida</option>
                                                <option value="confirmacion">Confirmación de Asistencia</option>
                                                <option value="promocion">Promoción/Invitación</option>
                                                <option value="personalizado">Personalizado</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Tono
                                            </label>
                                            <select
                                                value={aiTone}
                                                onChange={(e) => setAiTone(e.target.value)}
                                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:border-purple-500 dark:bg-gray-700 dark:text-white text-sm"
                                            >
                                                <option value="formal">Formal</option>
                                                <option value="amigable">Amigable</option>
                                                <option value="profesional">Profesional</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Contexto Adicional (opcional)
                                        </label>
                                        <textarea
                                            value={aiContext}
                                            onChange={(e) => setAiContext(e.target.value)}
                                            rows={2}
                                            className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:border-purple-500 resize-none dark:bg-gray-700 dark:text-white text-sm"
                                            placeholder="Ej: Menciona que es el primer recital del año y que habrá refrigerio..."
                                        />
                                    </div>

                                    <button
                                        onClick={handleGenerateWithAI}
                                        disabled={generatingAI}
                                        className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                                    >
                                        {generatingAI ? (
                                            <>
                                                <RefreshCw className="w-4 h-4 animate-spin" />
                                                Generando con IA...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-4 h-4" />
                                                Generar Plantilla
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}

                            {/* Variation Buttons - Show after template is generated */}
                            {!showAIAssistant && templateForm.contenido && (
                                <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/10 dark:to-blue-900/10 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <h5 className="font-medium text-sm text-purple-900 dark:text-purple-200">
                                                ✨ Generar Variación
                                            </h5>
                                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                                Obtén versiones diferentes manteniendo el mismo mensaje
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 flex-wrap">
                                        <button
                                            onClick={() => handleGenerateVariation('formal')}
                                            disabled={generatingAI}
                                            className="flex items-center gap-1 px-3 py-2 bg-white dark:bg-gray-700 border border-purple-200 dark:border-purple-600 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 disabled:opacity-50 text-sm transition-colors"
                                        >
                                            📝 Más Formal
                                        </button>
                                        <button
                                            onClick={() => handleGenerateVariation('amigable')}
                                            disabled={generatingAI}
                                            className="flex items-center gap-1 px-3 py-2 bg-white dark:bg-gray-700 border border-purple-200 dark:border-purple-600 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 disabled:opacity-50 text-sm transition-colors"
                                        >
                                            😊 Más Amigable
                                        </button>
                                        <button
                                            onClick={() => handleGenerateVariation('conciso')}
                                            disabled={generatingAI}
                                            className="flex items-center gap-1 px-3 py-2 bg-white dark:bg-gray-700 border border-purple-200 dark:border-purple-600 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 disabled:opacity-50 text-sm transition-colors"
                                        >
                                            ⚡ Más Conciso
                                        </button>
                                        <button
                                            onClick={() => handleGenerateVariation('profesional')}
                                            disabled={generatingAI}
                                            className="flex items-center gap-1 px-3 py-2 bg-white dark:bg-gray-700 border border-purple-200 dark:border-purple-600 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 disabled:opacity-50 text-sm transition-colors"
                                        >
                                            💼 Profesional
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Nombre
                                </label>
                                <input
                                    type="text"
                                    value={templateForm.nombre}
                                    onChange={(e) => setTemplateForm({ ...templateForm, nombre: e.target.value })}
                                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:border-whatsapp-green dark:bg-gray-700 dark:text-white"
                                    placeholder="Ej: Bienvenida a Nuevos Clientes"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Contenido del Mensaje
                                </label>
                                <textarea
                                    value={templateForm.contenido}
                                    onChange={(e) => setTemplateForm({ ...templateForm, contenido: e.target.value })}
                                    rows={6}
                                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:border-whatsapp-green resize-none dark:bg-gray-700 dark:text-white"
                                    placeholder="Hola {{nombre}}! Bienvenido a nuestro servicio..."
                                />

                                {/* Character Counter & Helper */}
                                <div className="flex items-center justify-between mt-1">
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Usa {'{{'}variable{'}}'} para datos dinám icos
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-medium ${templateForm.contenido.length > 1000 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                            {templateForm.contenido.length} / 1000
                                        </span>
                                        {templateForm.contenido.length > 1000 && (
                                            <span className="text-red-600 dark:text-red-400 flex items-center gap-1 text-xs">
                                                <AlertCircle className="w-3 h-3" />
                                                Muy largo
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Variables Badge */}
                                {extractVariables(templateForm.contenido).length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        <span className="text-xs text-gray-600 dark:text-gray-400">Variables detectadas:</span>
                                        {extractVariables(templateForm.contenido).map((v, i) => (
                                            <span key={i} className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200 px-2 py-1 rounded">
                                                {'{{'}{v}{'}}'}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Preview Component */}
                                {templateForm.contenido && (
                                    <div className="mt-4 p-4 bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/20 rounded-lg border border-gray-200 dark:border-gray-700">
                                        <div className=" flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-whatsapp-green flex items-center justify-center">
                                                    <span className="text-white text-xs">👁️</span>
                                                </div>
                                                <div>
                                                    <h5 className="font-medium text-sm text-gray-900 dark:text-white">Preview del Mensaje</h5>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">Cómo verá el mensaje el destinatario</p>
                                                </div>
                                            </div>
                                            {extractVariables(templateForm.contenido).length > 0 && (
                                                <button
                                                    onClick={() => setShowPreview(!showPreview)}
                                                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                                >
                                                    {showPreview ? 'Editar valores' : 'Personalizar valores'}
                                                </button>
                                            )}
                                        </div>

                                        {/* Editable Preview Values */}
                                        {showPreview && extractVariables(templateForm.contenido).length > 0 && (
                                            <div className="mb-3 p-3 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 space-y-2">
                                                <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Valores de ejemplo:</p>
                                                {extractVariables(templateForm.contenido).map(v => (
                                                    <div key={v} className="flex gap-2 items-center">
                                                        <label className="text-xs font-mono w-24 text-gray-600 dark:text-gray-400">
                                                            {'{{'}{v}{'}}'}:
                                                        </label>
                                                        <input
                                                            value={previewValues[v] || ''}
                                                            onChange={(e) => setPreviewValues({
                                                                ...previewValues,
                                                                [v]: e.target.value
                                                            })}
                                                            placeholder={getExampleValue(v)}
                                                            className="flex-1 text-xs px-2 py-1 border dark:border-gray-600 rounded focus:outline-none focus:border-blue-500 dark:bg-gray-600 dark:text-white"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Rendered Preview */}
                                        <div className="bg-white dark:bg-gray-700 p-3 rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm">
                                            <p className="text-sm whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-relaxed">
                                                {renderPreview(templateForm.contenido, previewValues)}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Categoría
                                    </label>
                                    <select
                                        value={templateForm.categoria}
                                        onChange={(e) => setTemplateForm({ ...templateForm, categoria: e.target.value })}
                                        className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:border-whatsapp-green dark:bg-gray-700 dark:text-white"
                                    >
                                        <option value="general">General</option>
                                        <option value="ventas">Ventas</option>
                                        <option value="soporte">Soporte</option>
                                        <option value="marketing">Marketing</option>
                                        <option value="recordatorios">Recordatorios</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Tipo
                                    </label>
                                    <select
                                        value={templateForm.tipo}
                                        onChange={(e) => setTemplateForm({ ...templateForm, tipo: e.target.value as any })}
                                        className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:border-whatsapp-green dark:bg-gray-700 dark:text-white"
                                    >
                                        <option value="texto">Texto</option>
                                        <option value="imagen">Imagen</option>
                                        <option value="documento">Documento</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t dark:border-gray-700 flex justify-end gap-2">
                            <button
                                onClick={() => {
                                    setShowTemplateModal(false);
                                    setEditingTemplate(null);
                                    resetTemplateForm();
                                }}
                                className="px-4 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateTemplate}
                                disabled={!templateForm.nombre || !templateForm.contenido}
                                className="px-4 py-2 bg-whatsapp-green text-white rounded-lg hover:bg-whatsapp-dark disabled:opacity-50"
                            >
                                {editingTemplate ? 'Guardar Cambios' : 'Crear Plantilla'}
                            </button>
                        </div>
                    </div>
                </div>
            )
            }
        </div >
    );
};

export default BroadcastPanel;
