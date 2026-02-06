/**
 * TemplatesPage - Manage message templates
 */

import { useState, useEffect } from 'react';
import { 
    Mail, Plus, Edit2, Trash2, RefreshCw, 
    Copy, AlertCircle, Search
} from 'lucide-react';

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

const API_BASE = 'http://localhost:3001/api/admin';

export const TemplatesPage = () => {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
    const [isCreating, setIsCreating] = useState(false);

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
                    </div>
                    <button
                        onClick={() => { setIsCreating(true); setEditingTemplate({ id: '', name: '', code: '', body: '', variables: [], category: 'notification' }); }}
                        className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Nueva Plantilla
                    </button>
                </div>

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

    const extractVariables = (text: string): string[] => {
        const regex = /{{\s*(\w+)\s*}}/g;
        const matches = text.match(regex) || [];
        const variables = matches.map(match => match.replace(/{{\s*|\s*}}/g, ''));
        return [...new Set(variables)];
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
            description: description.trim() || undefined,
            variables: extractVariables(body)
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-lg mx-4 p-6">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                    {isNew ? 'Nueva Plantilla' : 'Editar Plantilla'}
                </h2>
                
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
                                <option value="notification">Notificación</option>
                                <option value="attendance">Asistencia</option>
                                <option value="reminder">Recordatorio</option>
                                <option value="welcome">Bienvenida</option>
                                <option value="other">Otro</option>
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
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Variables detectadas: {extractVariables(body).join(', ') || 'ninguna'}
                        </p>
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
