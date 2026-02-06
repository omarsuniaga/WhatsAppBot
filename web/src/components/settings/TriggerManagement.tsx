/**
 * TriggerManagement - Manage bot activation keywords/triggers
 */
import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import {
    Plus,
    Edit,
    Trash2,
    ChevronDown,
    ChevronUp,
    Power,
    CheckCircle,
    AlertCircle,
    Send,
    BarChart3,
    Zap,
} from 'lucide-react';
import { triggerApi, Trigger } from '../../api/client';

interface FormData {
    keyword: string;
    matchType: 'exact' | 'contains' | 'startsWith' | 'regex';
    caseSensitive: boolean;
    enabled: boolean;
    description: string;
    category: string;
    priority: number;
}

const INITIAL_FORM: FormData = {
    keyword: '',
    matchType: 'exact',
    caseSensitive: false,
    enabled: true,
    description: '',
    category: '',
    priority: 0,
};

export const TriggerManagement = () => {
    const [triggers, setTriggers] = useState<Trigger[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<FormData>(INITIAL_FORM);

    // Config state
    const [config, setConfig] = useState<any>(null);
    const [testMessage, setTestMessage] = useState('');
    const [testResult, setTestResult] = useState<any>(null);
    const [stats, setStats] = useState<any>(null);

    // Expanded items
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Load data on mount
    useEffect(() => {
        loadTriggers();
        loadConfig();
        loadStats();
    }, []);

    const loadTriggers = async () => {
        try {
            setLoading(true);
            const response = await triggerApi.getAll();
            setTriggers(response.data.data || []);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Error loading triggers');
        } finally {
            setLoading(false);
        }
    };

    const loadConfig = async () => {
        try {
            const response = await triggerApi.getConfig();
            setConfig(response.data.data);
        } catch (err) {
            console.error('Error loading config:', err);
        }
    };

    const loadStats = async () => {
        try {
            const response = await triggerApi.getStats();
            setStats(response.data.data);
        } catch (err) {
            console.error('Error loading stats:', err);
        }
    };

    const handleSaveSuccessMessage = (msg: string) => {
        setSuccess(msg);
        setTimeout(() => setSuccess(null), 3000);
    };

    const handleAddTrigger = async () => {
        if (!formData.keyword.trim()) {
            setError('Keyword es requerido');
            return;
        }

        try {
            setLoading(true);
            if (editingId) {
                await triggerApi.update(editingId, formData);
                handleSaveSuccessMessage('Trigger actualizado');
            } else {
                await triggerApi.create(formData as any);
                handleSaveSuccessMessage('Trigger creado');
            }
            setFormData(INITIAL_FORM);
            setEditingId(null);
            setShowForm(false);
            await loadTriggers();
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Error saving trigger');
        } finally {
            setLoading(false);
        }
    };

    const handleEditTrigger = (trigger: Trigger) => {
        setFormData({
            keyword: trigger.keyword,
            matchType: trigger.matchType,
            caseSensitive: trigger.caseSensitive,
            enabled: trigger.enabled,
            description: trigger.description || '',
            category: trigger.category || '',
            priority: trigger.priority,
        });
        setEditingId(trigger.id);
        setShowForm(true);
        setExpandedId(null);
    };

    const handleDeleteTrigger = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este trigger?')) return;

        try {
            setLoading(true);
            await triggerApi.delete(id);
            handleSaveSuccessMessage('Trigger eliminado');
            await loadTriggers();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Error deleting trigger');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleTrigger = async (id: string) => {
        try {
            setLoading(true);
            await triggerApi.toggle(id);
            await loadTriggers();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Error toggling trigger');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleListener = async () => {
        try {
            setLoading(true);
            await triggerApi.toggleListener(!config?.listenerEnabled);
            await loadConfig();
            handleSaveSuccessMessage(
                `Listener ${!config?.listenerEnabled ? 'activado' : 'desactivado'}`
            );
        } catch (err: any) {
            setError(err.response?.data?.message || 'Error toggling listener');
        } finally {
            setLoading(false);
        }
    };

    const handleBulkEnable = async () => {
        try {
            setLoading(true);
            await triggerApi.enableAll();
            handleSaveSuccessMessage('Todos los triggers activados');
            await loadTriggers();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Error enabling triggers');
        } finally {
            setLoading(false);
        }
    };

    const handleBulkDisable = async () => {
        try {
            setLoading(true);
            await triggerApi.disableAll();
            handleSaveSuccessMessage('Todos los triggers desactivados');
            await loadTriggers();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Error disabling triggers');
        } finally {
            setLoading(false);
        }
    };

    const handleTestMessage = async () => {
        if (!testMessage.trim()) {
            setError('Ingresa un mensaje para probar');
            return;
        }

        try {
            setLoading(true);
            const response = await triggerApi.testMessage(testMessage);
            setTestResult(response.data.data);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Error testing message');
        } finally {
            setLoading(false);
        }
    };

    const handleExportTriggers = async () => {
        try {
            const response = await triggerApi.exportTriggers();
            const blob = new Blob([JSON.stringify(response.data.data, null, 2)], {
                type: 'application/json',
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `triggers-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            handleSaveSuccessMessage('Triggers exportados');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Error exporting triggers');
        }
    };

    const activeTriggers = triggers.filter(t => t.enabled);
    const inactiveTriggers = triggers.filter(t => !t.enabled);

    return (
        <div className="p-4 space-y-6 max-w-2xl">
            <img
                src="/img/trigger_icon.svg"
                alt="Triggers"
                className="w-8 h-8"
            />
            <h2 className="text-xl font-medium text-[#e9edef]">Gestión de Triggers</h2>

            {/* Messages */}
            {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                </div>
            )}
            {success && (
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    {success}
                </div>
            )}

            {/* Stats Card */}
            {stats && (
                <div className="bg-[#182229] rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <BarChart3 className="w-4 h-4 text-[#00a884]" />
                        <span className="text-sm text-[#8696a0]">Estadísticas</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <p className="text-2xl font-bold text-[#e9edef]">{stats.total}</p>
                            <p className="text-xs text-[#8696a0]">Total</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-green-400">{stats.active}</p>
                            <p className="text-xs text-[#8696a0]">Activos</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-[#8696a0]">{stats.inactive}</p>
                            <p className="text-xs text-[#8696a0]">Inactivos</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Global Controls */}
            <div className="space-y-2">
                <label className="text-sm text-[#8696a0]">Controles Globales</label>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={handleBulkEnable}
                        disabled={loading}
                        className="p-2 bg-[#182229] rounded-lg text-sm text-[#e9edef] hover:bg-[#2a3942] transition-colors disabled:opacity-50"
                    >
                        Activar todos
                    </button>
                    <button
                        onClick={handleBulkDisable}
                        disabled={loading}
                        className="p-2 bg-[#182229] rounded-lg text-sm text-[#e9edef] hover:bg-[#2a3942] transition-colors disabled:opacity-50"
                    >
                        Desactivar todos
                    </button>
                    <button
                        onClick={handleExportTriggers}
                        disabled={loading}
                        className="p-2 bg-[#182229] rounded-lg text-sm text-[#e9edef] hover:bg-[#2a3942] transition-colors disabled:opacity-50 col-span-2"
                    >
                        Exportar triggers
                    </button>
                </div>
            </div>

            {/* Listener Toggle */}
            {config && (
                <div className="flex items-center justify-between p-4 bg-[#182229] rounded-lg">
                    <div className="flex items-center gap-3">
                        <Zap className="w-5 h-5 text-[#8696a0]" />
                        <div>
                            <p className="text-sm text-[#e9edef]">Listener de triggers</p>
                            <p className="text-xs text-[#8696a0]">
                                {config.listenerEnabled ? 'Activo' : 'Inactivo'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleToggleListener}
                        disabled={loading}
                        className={clsx(
                            "w-12 h-6 rounded-full transition-colors relative",
                            config.listenerEnabled ? "bg-[#00a884]" : "bg-[#374248]",
                            loading && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        <span
                            className={clsx(
                                "absolute top-1 w-4 h-4 bg-white rounded-full transition-transform",
                                config.listenerEnabled ? "right-1" : "left-1"
                            )}
                        />
                    </button>
                </div>
            )}

            {/* Test Message Section */}
            <div className="bg-[#182229] rounded-lg p-4 space-y-3">
                <label className="text-sm text-[#8696a0]">Probar Triggers</label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={testMessage}
                        onChange={(e) => setTestMessage(e.target.value)}
                        placeholder="Ingresa un mensaje para probar..."
                        className="flex-1 p-3 bg-[#2a3942] text-[#e9edef] rounded-lg border border-[#374248] focus:outline-none focus:border-[#00a884] text-sm"
                    />
                    <button
                        onClick={handleTestMessage}
                        disabled={loading}
                        className="p-3 bg-[#00a884] text-white rounded-lg hover:bg-[#00906f] transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>

                {testResult && (
                    <div className="bg-[#0b141a] rounded p-3 space-y-2">
                        <p className="text-xs text-[#8696a0]">Resultados:</p>
                        {testResult.matched.length > 0 ? (
                            <div className="space-y-1">
                                {testResult.matched.map((trigger: any) => (
                                    <div key={trigger.id} className="text-xs bg-green-500/10 border border-green-500/30 p-2 rounded text-green-400">
                                        ✓ {trigger.keyword} ({trigger.matchType})
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-[#8696a0]">Sin coincidencias</p>
                        )}
                    </div>
                )}
            </div>

            {/* Add/Edit Form */}
            {showForm && (
                <div className="bg-[#182229] rounded-lg p-4 space-y-3">
                    <input
                        type="text"
                        value={formData.keyword}
                        onChange={(e) => setFormData({ ...formData, keyword: e.target.value })}
                        placeholder="Keyword (ej: 'hola', 'ayuda')"
                        className="w-full p-3 bg-[#2a3942] text-[#e9edef] rounded-lg border border-[#374248] focus:outline-none focus:border-[#00a884]"
                    />

                    <div className="grid grid-cols-2 gap-3">
                        <select
                            value={formData.matchType}
                            onChange={(e) => setFormData({ ...formData, matchType: e.target.value as any })}
                            className="p-3 bg-[#2a3942] text-[#e9edef] rounded-lg border border-[#374248] focus:outline-none focus:border-[#00a884]"
                        >
                            <option value="exact">Exacto</option>
                            <option value="contains">Contiene</option>
                            <option value="startsWith">Comienza con</option>
                            <option value="regex">Regex</option>
                        </select>
                        <input
                            type="number"
                            value={formData.priority}
                            onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                            placeholder="Prioridad"
                            className="p-3 bg-[#2a3942] text-[#e9edef] rounded-lg border border-[#374248] focus:outline-none focus:border-[#00a884]"
                        />
                    </div>

                    <input
                        type="text"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        placeholder="Categoría (opcional)"
                        className="w-full p-3 bg-[#2a3942] text-[#e9edef] rounded-lg border border-[#374248] focus:outline-none focus:border-[#00a884]"
                    />

                    <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Descripción (opcional)"
                        className="w-full p-3 bg-[#2a3942] text-[#e9edef] rounded-lg border border-[#374248] focus:outline-none focus:border-[#00a884] h-20 resize-none"
                    />

                    <label className="flex items-center gap-2 text-sm text-[#e9edef]">
                        <input
                            type="checkbox"
                            checked={formData.caseSensitive}
                            onChange={(e) => setFormData({ ...formData, caseSensitive: e.target.checked })}
                            className="w-4 h-4 rounded border-[#374248] text-[#00a884]"
                        />
                        Distinguir mayúsculas
                    </label>

                    <label className="flex items-center gap-2 text-sm text-[#e9edef]">
                        <input
                            type="checkbox"
                            checked={formData.enabled}
                            onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                            className="w-4 h-4 rounded border-[#374248] text-[#00a884]"
                        />
                        Habilitado
                    </label>

                    <div className="flex gap-2">
                        <button
                            onClick={handleAddTrigger}
                            disabled={loading}
                            className="flex-1 p-3 bg-[#00a884] text-white rounded-lg font-medium hover:bg-[#00906f] transition-colors disabled:opacity-50"
                        >
                            {editingId ? 'Actualizar' : 'Crear'} Trigger
                        </button>
                        <button
                            onClick={() => {
                                setShowForm(false);
                                setEditingId(null);
                                setFormData(INITIAL_FORM);
                            }}
                            className="flex-1 p-3 bg-[#374248] text-[#e9edef] rounded-lg font-medium hover:bg-[#2a3942] transition-colors"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* Add Trigger Button */}
            {!showForm && (
                <button
                    onClick={() => {
                        setShowForm(true);
                        setEditingId(null);
                        setFormData(INITIAL_FORM);
                    }}
                    disabled={loading}
                    className="w-full p-3 bg-[#00a884] text-white rounded-lg font-medium hover:bg-[#00906f] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Nuevo Trigger
                </button>
            )}

            {/* Triggers List */}
            <div className="space-y-3">
                {/* Active Triggers */}
                {activeTriggers.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-xs text-[#8696a0] px-1">
                            Activos ({activeTriggers.length})
                        </p>
                        {activeTriggers.map((trigger) => (
                            <TriggersItem
                                key={trigger.id}
                                trigger={trigger}
                                isExpanded={expandedId === trigger.id}
                                onExpand={() => setExpandedId(expandedId === trigger.id ? null : trigger.id)}
                                onEdit={() => handleEditTrigger(trigger)}
                                onDelete={() => handleDeleteTrigger(trigger.id)}
                                onToggle={() => handleToggleTrigger(trigger.id)}
                                loading={loading}
                            />
                        ))}
                    </div>
                )}

                {/* Inactive Triggers */}
                {inactiveTriggers.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-xs text-[#8696a0] px-1">
                            Inactivos ({inactiveTriggers.length})
                        </p>
                        {inactiveTriggers.map((trigger) => (
                            <TriggersItem
                                key={trigger.id}
                                trigger={trigger}
                                isExpanded={expandedId === trigger.id}
                                onExpand={() => setExpandedId(expandedId === trigger.id ? null : trigger.id)}
                                onEdit={() => handleEditTrigger(trigger)}
                                onDelete={() => handleDeleteTrigger(trigger.id)}
                                onToggle={() => handleToggleTrigger(trigger.id)}
                                loading={loading}
                            />
                        ))}
                    </div>
                )}

                {/* Empty State */}
                {triggers.length === 0 && !showForm && (
                    <div className="text-center py-8">
                        <Zap className="w-12 h-12 text-[#8696a0] mx-auto mb-3 opacity-50" />
                        <p className="text-sm text-[#8696a0]">No hay triggers creados</p>
                        <p className="text-xs text-[#8696a0] mt-1">
                            Crea uno para activar acciones automáticas
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

// Helper component for trigger item
interface TriggersItemProps {
    trigger: Trigger;
    isExpanded: boolean;
    onExpand: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onToggle: () => void;
    loading: boolean;
}

const TriggersItem = ({
    trigger,
    isExpanded,
    onExpand,
    onEdit,
    onDelete,
    onToggle,
    loading,
}: TriggersItemProps) => {
    return (
        <div className="bg-[#182229] rounded-lg overflow-hidden">
            <button
                onClick={onExpand}
                className="w-full p-3 flex items-center justify-between hover:bg-[#2a3942] transition-colors"
            >
                <div className="flex items-center gap-3 flex-1 text-left">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggle();
                        }}
                        disabled={loading}
                        className="flex-shrink-0"
                    >
                        <Power
                            className={clsx(
                                "w-4 h-4 transition-colors",
                                trigger.enabled ? "text-[#00a884]" : "text-[#8696a0]"
                            )}
                        />
                    </button>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <p className="font-medium text-[#e9edef] truncate">
                                {trigger.keyword}
                            </p>
                            <span className="text-xs bg-[#2a3942] text-[#8696a0] px-2 py-1 rounded flex-shrink-0">
                                {trigger.matchType}
                            </span>
                        </div>
                        {trigger.category && (
                            <p className="text-xs text-[#8696a0]">{trigger.category}</p>
                        )}
                    </div>
                    <span className="text-xs text-[#8696a0] flex-shrink-0">
                        P:{trigger.priority}
                    </span>
                </div>
                {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-[#8696a0]" />
                ) : (
                    <ChevronDown className="w-4 h-4 text-[#8696a0]" />
                )}
            </button>

            {isExpanded && (
                <div className="bg-[#0b141a] p-3 border-t border-[#374248] space-y-2">
                    {trigger.description && (
                        <p className="text-xs text-[#8696a0]">{trigger.description}</p>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-xs text-[#8696a0]">
                        <div>
                            <span className="text-[#aebac1]">Sensible a mayúsculas:</span>{' '}
                            {trigger.caseSensitive ? 'Sí' : 'No'}
                        </div>
                        <div>
                            <span className="text-[#aebac1]">Prioridad:</span> {trigger.priority}
                        </div>
                    </div>

                    <div className="text-xs text-[#8696a0]">
                        <span className="text-[#aebac1]">Creado:</span>{' '}
                        {new Date(trigger.createdAt).toLocaleDateString()}
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={onEdit}
                            className="flex-1 p-2 bg-[#374248] text-[#e9edef] rounded text-sm hover:bg-[#2a3942] transition-colors flex items-center justify-center gap-1"
                        >
                            <Edit className="w-3 h-3" />
                            Editar
                        </button>
                        <button
                            onClick={onDelete}
                            className="flex-1 p-2 bg-red-500/20 text-red-400 rounded text-sm hover:bg-red-500/30 transition-colors flex items-center justify-center gap-1"
                        >
                            <Trash2 className="w-3 h-3" />
                            Eliminar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
