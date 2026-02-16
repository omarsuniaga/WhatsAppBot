import React, { useState, useEffect } from 'react';
import {
    Plus,
    Search,
    Edit2,
    Trash2,
    Loader2,
    Hash,
    Layers,
    AlertCircle
} from 'lucide-react';
import { triggerApi, knowledgeApi, Trigger } from '../../api/client';
import { clsx } from 'clsx';

export const TriggerManager = () => {
    const [triggers, setTriggers] = useState<Trigger[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [currentTrigger, setCurrentTrigger] = useState<Partial<Trigger> | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [triggersRes, categoriesRes] = await Promise.all([
                triggerApi.getAll(),
                knowledgeApi.getCategories()
            ]);

            if (triggersRes.data.success) {
                setTriggers(triggersRes.data.data);
            }
            if (categoriesRes.data.success) {
                setCategories(categoriesRes.data.data);
            }
        } catch (err) {
            setError('Error al cargar datos');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggle = async (id: string) => {
        try {
            const res = await triggerApi.toggle(id);
            if (res.data.success) {
                setTriggers(prev => prev.map(t => t.id === id ? res.data.data : t));
            }
        } catch (err) {
            console.error('Error toggling trigger:', err);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('¿Estás seguro de eliminar este trigger?')) return;
        try {
            const res = await triggerApi.delete(id);
            if (res.data.success) {
                setTriggers(prev => prev.filter(t => t.id !== id));
            }
        } catch (err) {
            console.error('Error deleting trigger:', err);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentTrigger?.keyword) return;

        setIsSaving(true);
        try {
            let res;
            if (currentTrigger.id) {
                res = await triggerApi.update(currentTrigger.id, currentTrigger);
            } else {
                res = await triggerApi.create(currentTrigger as any);
            }

            if (res.data.success) {
                fetchData();
                setIsEditing(false);
                setCurrentTrigger(null);
            }
        } catch (err) {
            setError('Error al guardar el trigger');
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const filteredTriggers = triggers.filter(t => {
        const matchesSearch = (t.keyword || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = filterCategory === 'all' || t.category === filterCategory;
        return matchesSearch && matchesCategory;
    });

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-whatsapp-green mb-4" />
                <p className="text-gray-500 dark:text-[#8696a0]">Cargando triggers...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar palabras clave..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#202c33] border border-gray-200 dark:border-[#374248] rounded-xl focus:ring-2 focus:ring-whatsapp-green outline-none transition-all text-sm shadow-sm"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="px-3 py-2 bg-white dark:bg-[#202c33] border border-gray-200 dark:border-[#374248] rounded-xl text-sm outline-none focus:ring-2 focus:ring-whatsapp-green cursor-pointer hover:border-whatsapp-green/50 transition-colors"
                    >
                        <option value="all">Todas las categorías</option>
                        {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                    <button
                        onClick={() => {
                            setCurrentTrigger({
                                keyword: '',
                                matchType: 'contains',
                                caseSensitive: false,
                                enabled: true,
                                priority: 1,
                                category: categories[0]?.id || 'general'
                            });
                            setIsEditing(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-whatsapp-green text-white rounded-xl hover:bg-green-600 transition-all text-sm font-bold shadow-lg shadow-green-500/20 active:scale-95"
                        aria-label="Crear nuevo trigger"
                    >
                        <Plus className="w-4 h-4" />
                        Nuevo Trigger
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-xl flex items-center gap-3 text-red-700 dark:text-red-400 animate-fade-in-up">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm">{error}</p>
                </div>
            )}

            {/* List */}
            <div className="bg-white dark:bg-[#202c33] rounded-2xl border border-gray-100 dark:border-[#374248] overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 dark:bg-[#111b21] text-xs font-bold text-gray-500 dark:text-[#8696a0] uppercase tracking-wider">
                            <th className="px-6 py-4">Palabra Clave</th>
                            <th className="px-6 py-4">Tipo</th>
                            <th className="px-6 py-4">Categoría / Acción</th>
                            <th className="px-6 py-4">Estado</th>
                            <th className="px-6 py-4 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-[#374248]">
                        {filteredTriggers.length === 0 ? (
                            <tr className="animate-fade-in">
                                <td colSpan={5} className="px-6 py-12 text-center">
                                    <div className="flex flex-col items-center opacity-40">
                                        <Hash className="w-12 h-12 mb-2" />
                                        <p className="text-sm">No se encontraron triggers</p>
                                        {(searchTerm || filterCategory !== 'all') && (
                                            <button
                                                onClick={() => { setSearchTerm(''); setFilterCategory('all'); }}
                                                className="mt-2 text-whatsapp-green font-bold text-xs hover:underline"
                                            >
                                                Limpiar filtros
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filteredTriggers.map((trigger, idx) => (
                                <tr
                                    key={trigger.id}
                                    className="hover:bg-gray-50 dark:hover:bg-[#111b21]/50 transition-colors group animate-fade-in-up"
                                    style={{ animationDelay: `${idx * 50}ms` }}
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-whatsapp-green/10 flex items-center justify-center text-whatsapp-green font-mono text-xs shadow-inner">
                                                #
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-800 dark:text-[#e9edef]">{trigger.keyword}</p>
                                                {trigger.description && <p className="text-xs text-gray-500 dark:text-[#8696a0]">{trigger.description}</p>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 bg-gray-100 dark:bg-[#111b21] text-gray-600 dark:text-[#8696a0] rounded text-[10px] font-bold uppercase">
                                            {trigger.matchType}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <Layers className="w-3 h-3 text-blue-500" />
                                            <span className="text-sm text-gray-600 dark:text-[#e9edef]">
                                                {categories.find(c => c.id === trigger.category)?.name || trigger.category || 'General'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => handleToggle(trigger.id)}
                                            className={clsx(
                                                "flex items-center gap-2 px-2 py-1 rounded-full text-[10px] font-bold transition-all",
                                                trigger.enabled
                                                    ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                                                    : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                                            )}
                                        >
                                            <div className={clsx("w-1.5 h-1.5 rounded-full", trigger.enabled ? "bg-green-500" : "bg-gray-400")} />
                                            {trigger.enabled ? 'ACTIVO' : 'INACTIVO'}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => {
                                                    setCurrentTrigger(trigger);
                                                    setIsEditing(true);
                                                }}
                                                className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500 rounded-lg transition-colors"
                                                title="Editar"
                                                aria-label={`Editar trigger ${trigger.keyword}`}
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(trigger.id)}
                                                className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded-lg transition-colors"
                                                title="Eliminar"
                                                aria-label={`Eliminar trigger ${trigger.keyword}`}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Edit/Create Modal */}
            {isEditing && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fade-in">
                    <div className="bg-white dark:bg-[#111b21] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 dark:border-[#374248] animate-scale-in">
                        <div className="bg-whatsapp-green p-4 flex items-center justify-between">
                            <h3 className="text-white font-bold flex items-center gap-2">
                                <Plus className="w-5 h-5" />
                                {currentTrigger?.id ? 'Editar Trigger' : 'Nuevo Trigger'}
                            </h3>
                            <button onClick={() => setIsEditing(false)} className="text-white/80 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase">Palabra Clave</label>
                                <input
                                    type="text"
                                    required
                                    value={currentTrigger?.keyword || ''}
                                    onChange={(e) => setCurrentTrigger(prev => ({ ...prev, keyword: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#2a3942] border border-gray-200 dark:border-[#374248] rounded-xl outline-none focus:ring-2 focus:ring-whatsapp-green"
                                    placeholder="Ej: precio, clases, horario"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Tipo de Coincidencia</label>
                                    <select
                                        value={currentTrigger?.matchType || 'contains'}
                                        onChange={(e) => setCurrentTrigger(prev => ({ ...prev, matchType: e.target.value as any }))}
                                        className="w-full px-3 py-2.5 bg-gray-50 dark:bg-[#2a3942] border border-gray-200 dark:border-[#374248] rounded-xl outline-none"
                                    >
                                        <option value="contains">Contiene</option>
                                        <option value="exact">Exacta</option>
                                        <option value="startsWith">Empieza con</option>
                                        <option value="regex">Regex</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Prioridad</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="10"
                                        value={currentTrigger?.priority || 1}
                                        onChange={(e) => setCurrentTrigger(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                                        className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#2a3942] border border-gray-200 dark:border-[#374248] rounded-xl outline-none"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase">Categoría / Respuesta</label>
                                <select
                                    value={currentTrigger?.category || 'general'}
                                    onChange={(e) => setCurrentTrigger(prev => ({ ...prev, category: e.target.value }))}
                                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-[#2a3942] border border-gray-200 dark:border-[#374248] rounded-xl outline-none"
                                >
                                    {categories.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#202c33] rounded-xl border border-gray-100 dark:border-[#374248]">
                                <span className="text-sm font-medium text-gray-700 dark:text-[#e9edef]">Distinguir Mayúsculas</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={currentTrigger?.caseSensitive || false}
                                        onChange={(e) => setCurrentTrigger(prev => ({ ...prev, caseSensitive: e.target.checked }))}
                                    />
                                    <div className="w-10 h-5 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:bg-whatsapp-green after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                                </label>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsEditing(false)}
                                    className="flex-1 py-3 text-gray-600 dark:text-[#8696a0] font-bold hover:bg-gray-100 dark:hover:bg-[#202c33] rounded-xl transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="flex-1 py-3 bg-whatsapp-green text-white font-bold rounded-xl hover:bg-green-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {currentTrigger?.id ? 'Actualizar' : 'Crear'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const X = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
);
