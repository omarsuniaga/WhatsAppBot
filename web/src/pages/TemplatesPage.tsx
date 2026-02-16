/**
 * TemplatesPage - Manage message templates with AI Generator
 */

import { useState, useEffect } from 'react';
import {
    Mail, Plus, Edit2, Trash2, RefreshCw,
    Copy, AlertCircle, Search, Sparkles, HelpCircle, X
} from 'lucide-react';
import { aiApi } from '../api/client';

interface Template {
    id: string;
    name: string;
    code: string;
    body: string;
    variables: string[];
    category: string;
    description?: string;
    status?: string;
    useCount?: number;
    tags?: string[];
    createdAt?: string;
    updatedAt?: string;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/admin';

export const TemplatesPage = () => {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [showHelp, setShowHelp] = useState(false);

    const getAdminKey = () => localStorage.getItem('ADMIN_API_KEY') || 'dev-admin-key-123';

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE}/templates`, {
                headers: { 'x-admin-api-key': getAdminKey() }
            });
            const data = await response.json();
            if (data.success) {
                setTemplates(data.data || []);
            } else {
                throw new Error(data.error);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const saveTemplate = async (template: Partial<Template>) => {
        try {
            const isNew = !template.id;
            const url = isNew ? `${API_BASE}/templates` : `${API_BASE}/templates/${template.id}`;
            const method = isNew ? 'POST' : 'PUT';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-api-key': getAdminKey()
                },
                body: JSON.stringify(template)
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            await loadTemplates();
            setEditingTemplate(null);
            setIsCreating(false);
        } catch (err: any) {
            alert('Error: ' + err.message);
        }
    };

    const deleteTemplate = async (id: string) => {
        if (!confirm('¿Eliminar esta plantilla?')) return;

        try {
            const response = await fetch(`${API_BASE}/templates/${id}`, {
                method: 'DELETE',
                headers: { 'x-admin-api-key': getAdminKey() }
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error);
            }

            await loadTemplates();
        } catch (err: any) {
            alert('Error: ' + err.message);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const filteredTemplates = templates.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.body.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <Mail className="w-6 h-6 text-cyan-500" />
                        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                            Plantillas de Mensajes
                        </h1>
                        <button
                            onClick={() => setShowHelp(true)}
                            className="p-1 text-gray-400 hover:text-cyan-500 transition-colors"
                            title="Ayuda"
                        >
                            <HelpCircle className="w-5 h-5" />
                        </button>
                    </div>
                    <button
                        onClick={() => { setIsCreating(true); setEditingTemplate({ id: '', name: '', code: '', body: '', variables: [], category: 'reminder' }); }}
                        className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Nueva Plantilla
                    </button>
                </div>

                {/* Help Modal */}
                {showHelp && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowHelp(false)}>
                        <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-lg mx-4 p-6 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                                    <HelpCircle className="w-5 h-5 text-cyan-500" />
                                    Cómo usar las Plantillas
                                </h2>
                                <button onClick={() => setShowHelp(false)} className="text-gray-400 hover:text-gray-600">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-4 text-sm text-gray-600 dark:text-gray-300">
                                <div className="p-3 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg border border-cyan-200 dark:border-cyan-700">
                                    <h3 className="font-semibold text-cyan-800 dark:text-cyan-300 mb-1">📝 ¿Qué son las plantillas?</h3>
                                    <p>Las plantillas son mensajes predefinidos que puedes reutilizar para enviar a tus contactos, con variables dinámicas que se reemplazan automáticamente.</p>
                                </div>

                                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                                    <h3 className="font-semibold text-purple-800 dark:text-purple-300 mb-1">✨ Generación con IA</h3>
                                    <p>Usa el botón "Generar con IA" para crear plantillas automáticamente. Selecciona el propósito y tono, y la IA creará el mensaje por ti.</p>
                                </div>

                                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-2">📋 Campos importantes:</h3>
                                    <ul className="space-y-2">
                                        <li><strong className="text-cyan-600">Nombre:</strong> Nombre descriptivo para identificar la plantilla</li>
                                        <li><strong className="text-cyan-600">Código:</strong> Identificador único (ej: "recordatorio_piano"). <span className="text-amber-600 dark:text-amber-400">¡Debe ser único!</span></li>
                                        <li><strong className="text-cyan-600">Categoría:</strong> Tipo de mensaje (recordatorio, bienvenida, etc.)</li>
                                        <li><strong className="text-cyan-600">Mensaje:</strong> El contenido con variables</li>
                                    </ul>
                                </div>

                                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                                    <h3 className="font-semibold text-green-800 dark:text-green-300 mb-1">🔤 Variables dinámicas</h3>
                                    <p className="mb-2">Usa <code className="bg-white dark:bg-gray-700 px-1 rounded">{'{{nombre}}'}</code> para insertar datos que cambiarán por cada contacto:</p>
                                    <div className="flex flex-wrap gap-1">
                                        <span className="text-xs bg-green-100 dark:bg-green-800 px-2 py-0.5 rounded">{'{{nombre}}'}</span>
                                        <span className="text-xs bg-green-100 dark:bg-green-800 px-2 py-0.5 rounded">{'{{fecha}}'}</span>
                                        <span className="text-xs bg-green-100 dark:bg-green-800 px-2 py-0.5 rounded">{'{{hora}}'}</span>
                                        <span className="text-xs bg-green-100 dark:bg-green-800 px-2 py-0.5 rounded">{'{{instrumento}}'}</span>
                                    </div>
                                </div>

                                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
                                    <h3 className="font-semibold text-amber-800 dark:text-amber-300 mb-1">⚠️ Error "código ya existe"</h3>
                                    <p>Si ves este error, cambia el valor del campo "Código" a uno diferente antes de guardar.</p>
                                </div>
                            </div>

                            <button
                                onClick={() => setShowHelp(false)}
                                className="mt-6 w-full py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium transition-colors"
                            >
                                ¡Entendido!
                            </button>
                        </div>
                    </div>
                )}

                {/* Search */}
                <div className="relative mb-6">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar plantillas..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
                        <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                            <AlertCircle className="w-5 h-5" />
                            <span>{error}</span>
                        </div>
                    </div>
                )}

                {/* Loading */}
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <RefreshCw className="w-8 h-8 animate-spin text-cyan-500" />
                    </div>
                ) : (
                    <>
                        {/* Templates List */}
                        {filteredTemplates.length > 0 ? (
                            <div className="space-y-4">
                                {filteredTemplates.map((template) => (
                                    <div
                                        key={template.id}
                                        className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4"
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <h3 className="font-semibold text-gray-800 dark:text-gray-200">
                                                    {template.name}
                                                </h3>
                                                {template.category && (
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                                        {template.category}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => copyToClipboard(template.body)}
                                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                                    title="Copiar"
                                                >
                                                    <Copy className="w-4 h-4 text-gray-500" />
                                                </button>
                                                <button
                                                    onClick={() => setEditingTemplate(template)}
                                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                                    title="Editar"
                                                >
                                                    <Edit2 className="w-4 h-4 text-blue-500" />
                                                </button>
                                                <button
                                                    onClick={() => deleteTemplate(template.id)}
                                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="w-4 h-4 text-red-500" />
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap line-clamp-3">
                                            {template.body}
                                        </p>
                                        {template.variables.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-1">
                                                {template.variables.map((v) => (
                                                    <span
                                                        key={v}
                                                        className="px-2 py-0.5 text-xs bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 rounded"
                                                    >
                                                        {`{{${v}}}`}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-8 text-center">
                                <Mail className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-1">
                                    No hay plantillas
                                </h3>
                                <p className="text-gray-500 dark:text-gray-400">
                                    Crea tu primera plantilla para automatizar mensajes.
                                </p>
                            </div>
                        )}
                    </>
                )}

                {/* Edit Modal */}
                {editingTemplate && (
                    <TemplateEditModal
                        template={editingTemplate}
                        isNew={isCreating}
                        onSave={saveTemplate}
                        onClose={() => { setEditingTemplate(null); setIsCreating(false); }}
                    />
                )}
            </div>
        </div>
    );
};

const TemplateEditModal = ({
    template,
    isNew,
    onSave,
    onClose
}: {
    template: Template;
    isNew: boolean;
    onSave: (t: Partial<Template>) => void;
    onClose: () => void;
}) => {
    const [name, setName] = useState(template.name);
    const [code, setCode] = useState(template.code || '');
    const [body, setBody] = useState(template.body);
    const [category, setCategory] = useState(template.category || 'notification');
    const [description, setDescription] = useState(template.description || '');

    // AI state
    const [showAI, setShowAI] = useState(false);
    const [aiPurpose, setAiPurpose] = useState('recordatorio');
    const [aiTone, setAiTone] = useState('profesional');
    const [aiContext, setAiContext] = useState('');
    const [generatingAI, setGeneratingAI] = useState(false);

    const extractVariables = (text: string): string[] => {
        const regex = /{{\s*(\w+)\s*}}/g;
        const matches = text.match(regex) || [];
        const variables = matches.map(match => match.replace(/{{\s*|\s*}}/g, ''));
        return [...new Set(variables)];
    };

    const handleGenerateWithAI = async () => {
        setGeneratingAI(true);
        try {
            const response = await aiApi.generateTemplate({
                purpose: aiPurpose,
                tone: aiTone,
                additionalContext: aiContext,
                targetAudience: 'padres'
            });

            if (response.data?.success && response.data?.template) {
                setName(response.data.template.nombre);
                setBody(response.data.template.contenido);
                setCode(response.data.template.nombre.toLowerCase().replace(/\s+/g, '_'));
                setShowAI(false);
            }
        } catch (error) {
            alert('Error generando con IA: ' + error);
        } finally {
            setGeneratingAI(false);
        }
    };

    const handleGenerateVariation = async (tone: string) => {
        setGeneratingAI(true);
        try {
            const response = await aiApi.generateVariation({
                baseContent: body,
                baseName: name,
                newTone: tone,
                purpose: aiPurpose
            });

            if (response.data?.success && response.data?.variation) {
                setBody(response.data.variation.contenido);
                setName(response.data.variation.nombre);
            }
        } catch (error) {
            alert('Error generando variación: ' + error);
        } finally {
            setGeneratingAI(false);
        }
    };

    const handleSave = () => {
        if (!name.trim() || !code.trim() || !body.trim() || !category) {
            alert('Nombre, código, categoría y mensaje son requeridos');
            return;
        }
        onSave({
            id: isNew ? undefined : template.id,
            name: name.trim(),
            code: code.trim().toLowerCase().replace(/\s+/g, '_'),
            body: body.trim(),
            category,
            status: 'active',
            description: description.trim() || undefined,
            variables: extractVariables(body),
            tags: []
        });
    };

    const variables = extractVariables(body);
    const charCount = body.length;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                {/* Header with AI button */}
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                        {isNew ? 'Nueva Plantilla' : 'Editar Plantilla'}
                    </h2>
                    <button
                        onClick={() => setShowAI(!showAI)}
                        className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        <Sparkles className="w-4 h-4" />
                        {showAI ? 'Cerrar IA' : 'Generar con IA'}
                    </button>
                </div>

                {/* AI Assistant Panel */}
                {showAI && (
                    <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-700 rounded-lg">
                        <h5 className="font-medium text-sm mb-3 text-purple-900 dark:text-purple-200">✨ Generador de Plantillas con IA</h5>

                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Propósito</label>
                                    <select
                                        value={aiPurpose}
                                        onChange={(e) => setAiPurpose(e.target.value)}
                                        className="w-full px-2 py-1 text-sm border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                    >
                                        <option value="recordatorio">Recordatorio</option>
                                        <option value="bienvenida">Bienvenida</option>
                                        <option value="confirmacion">Confirmación</option>
                                        <option value="promocion">Promoción</option>
                                        <option value="personalizado">Personalizado</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Tono</label>
                                    <select
                                        value={aiTone}
                                        onChange={(e) => setAiTone(e.target.value)}
                                        className="w-full px-2 py-1 text-sm border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                    >
                                        <option value="formal">Formal</option>
                                        <option value="amigable">Amigable</option>
                                        <option value="profesional">Profesional</option>
                                        <option value="casual">Casual</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Contexto adicional (opcional)</label>
                                <input
                                    value={aiContext}
                                    onChange={(e) => setAiContext(e.target.value)}
                                    placeholder="Ej: para clase de piano los viernes"
                                    className="w-full px-2 py-1 text-sm border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                />
                            </div>

                            <button
                                onClick={handleGenerateWithAI}
                                disabled={generatingAI}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg font-medium disabled:opacity-50"
                            >
                                {generatingAI ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Generando...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4" />
                                        Generar Plantilla
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Variation Buttons */}
                {!showAI && body && (
                    <div className="mb-4 p-3 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/10 dark:to-blue-900/10 border border-purple-200 dark:border-purple-700 rounded-lg">
                        <p className="text-xs font-medium text-purple-900 dark:text-purple-200 mb-2">✨ Generar Variación</p>
                        <div className="flex gap-2 flex-wrap">
                            <button onClick={() => handleGenerateVariation('formal')} disabled={generatingAI} className="px-3 py-1 text-xs bg-white dark:bg-gray-700 border border-purple-200 dark:border-purple-600 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20 disabled:opacity-50">
                                📝 Más Formal
                            </button>
                            <button onClick={() => handleGenerateVariation('amigable')} disabled={generatingAI} className="px-3 py-1 text-xs bg-white dark:bg-gray-700 border border-purple-200 dark:border-purple-600 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20 disabled:opacity-50">
                                😊 Más Amigable
                            </button>
                            <button onClick={() => handleGenerateVariation('conciso')} disabled={generatingAI} className="px-3 py-1 text-xs bg-white dark:bg-gray-700 border border-purple-200 dark:border-purple-600 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20 disabled:opacity-50">
                                ⚡ Más Conciso
                            </button>
                        </div>
                    </div>
                )}

                {/* Form Fields */}
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Nombre *
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                placeholder="Ej: Notificación de ausencia"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Código * (único)
                            </label>
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
                                placeholder="Ej: absence_notify"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Categoría *
                            </label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            >
                                <option value="reminder">Recordatorio</option>
                                <option value="attendance">Asistencia</option>
                                <option value="announcement">Anuncio</option>
                                <option value="welcome">Bienvenida</option>
                                <option value="payment">Pago</option>
                                <option value="event">Evento</option>
                                <option value="general">General</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Descripción
                            </label>
                            <input
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                placeholder="Descripción breve"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Mensaje *
                        </label>
                        <textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            rows={6}
                            className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono text-sm"
                            placeholder="Usa {{variable}} para variables dinámicas"
                        />

                        {/* Character Counter */}
                        <div className="flex items-center justify-between mt-1">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Usa {'{{'}variable{'}}'} para datos dinámicos
                            </p>
                            <div className="flex items-center gap-2">
                                <span className={`text-xs font-medium ${charCount > 1000 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                    {charCount} / 1000
                                </span>
                                {charCount > 1000 && (
                                    <span className="text-red-600 dark:text-red-400 flex items-center gap-1 text-xs">
                                        <AlertCircle className="w-3 h-3" />
                                        Muy largo
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Variables Badge */}
                        {variables.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                                <span className="text-xs text-gray-600 dark:text-gray-400">Variables:</span>
                                {variables.map((v) => (
                                    <span key={v} className="text-xs bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 px-2 py-0.5 rounded">
                                        {`{{${v}}}`}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium"
                    >
                        Guardar
                    </button>
                </div>
            </div>
        </div>
    );
};
