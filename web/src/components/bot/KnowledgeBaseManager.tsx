import React, { useState, useEffect } from 'react';
import {
    Plus,
    Search,
    Edit2,
    Trash2,
    Loader2,
    BookOpen,
    CheckCircle,
    X,
    FolderPlus,
    FileText,
    Sparkles
} from 'lucide-react';
import { knowledgeApi, aiApi } from '../../api/client';
import { clsx } from 'clsx';

export const KnowledgeBaseManager = () => {
    const [categories, setCategories] = useState<any[]>([]);
    const [faqs, setFaqs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [isEditingCategory, setIsEditingCategory] = useState(false);
    const [isEditingFaq, setIsEditingFaq] = useState(false);
    const [currentCategory, setCurrentCategory] = useState<any>(null);
    const [currentFaq, setCurrentFaq] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [categoriesRes, faqsRes] = await Promise.all([
                knowledgeApi.getCategories(true),
                knowledgeApi.getFaqs()
            ]);

            if (categoriesRes.data.success) {
                setCategories(categoriesRes.data.data);
                if (categoriesRes.data.data.length > 0 && !activeCategory) {
                    setActiveCategory(categoriesRes.data.data[0].id);
                }
            }
            if (faqsRes.data.success) {
                setFaqs(faqsRes.data.data);
            }
        } catch (err) {
            setError('Error al cargar datos del cerebro');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentCategory?.name) return;

        setIsSaving(true);
        try {
            let res;
            if (currentCategory.id) {
                res = await knowledgeApi.updateCategory(currentCategory.id, currentCategory);
            } else {
                res = await knowledgeApi.addCategory(currentCategory);
            }

            if (res.data.success) {
                fetchData();
                setIsEditingCategory(false);
            }
        } catch (err) {
            setError('Error al guardar categoría');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveFaq = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentFaq?.question || !currentFaq?.answer) return;

        setIsSaving(true);
        try {
            let res;
            const payload = { ...currentFaq, category: activeCategory };
            if (currentFaq.id) {
                res = await knowledgeApi.updateFaq(currentFaq.id, payload);
            } else {
                res = await knowledgeApi.addFaq(payload);
            }

            if (res.data.success) {
                fetchData();
                setIsEditingFaq(false);
            }
        } catch (err) {
            setError('Error al guardar FAQ');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteCategory = async (id: string) => {
        if (!window.confirm('¿Eliminar esta categoría y todas sus preguntas?')) return;
        try {
            await knowledgeApi.deleteCategory(id);
            fetchData();
            if (activeCategory === id) setActiveCategory(null);
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteFaq = async (id: string) => {
        if (!window.confirm('¿Eliminar esta FAQ?')) return;
        try {
            await knowledgeApi.deleteFaq(id);
            fetchData();
        } catch (err) {
            console.error(err);
        }
    };

    const generateAIVariation = async () => {
        if (!currentFaq?.question) return;
        setIsGenerating(true);
        try {
            const res = await aiApi.generateVariation({ text: currentFaq.question });
            if (res.data.success) {
                setCurrentFaq((prev: any) => ({
                    ...prev,
                    question: res.data.variation || prev.question
                }));
            }
        } catch (err) {
            console.error('AI Error:', err);
        } finally {
            setIsGenerating(false);
        }
    };

    const filteredFaqs = faqs.filter(f =>
        f.category === activeCategory &&
        ((f.question || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (f.answer || '').toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
                <p className="text-gray-500">Cargando cerebro de conocimientos...</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in">
            {/* Sidebar Categories */}
            <div className="lg:col-span-1 space-y-4">
                <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Categorías</h4>
                    <button
                        onClick={() => {
                            setCurrentCategory({ name: '', description: '' });
                            setIsEditingCategory(true);
                        }}
                        className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 rounded-lg transition-colors"
                        title="Nueva Categoría"
                    >
                        <FolderPlus className="w-4 h-4" />
                    </button>
                </div>

                <div className="space-y-1">
                    {categories.map(cat => (
                        <div
                            key={cat.id}
                            className={clsx(
                                "group flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all cursor-pointer animate-fade-in-up",
                                activeCategory === cat.id
                                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-semibold shadow-sm overflow-hidden"
                                    : "hover:bg-gray-100 dark:hover:bg-[#111b21] text-gray-600 dark:text-[#8696a0]"
                            )}
                            onClick={() => setActiveCategory(cat.id)}
                        >
                            <span className="truncate">{cat.name}</span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setCurrentCategory(cat);
                                        setIsEditingCategory(true);
                                    }}
                                    className="p-1 hover:text-blue-500"
                                    aria-label={`Editar categoría ${cat.name}`}
                                >
                                    <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteCategory(cat.id);
                                    }}
                                    className="p-1 hover:text-red-500"
                                    aria-label={`Eliminar categoría ${cat.name}`}
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* FAQ List Area */}
            <div className="lg:col-span-3 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar en esta categoría..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#111b21] border border-gray-200 dark:border-[#374248] rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        />
                    </div>
                    <button
                        disabled={!activeCategory}
                        onClick={() => {
                            setCurrentFaq({ question: '', answer: '', approved: true });
                            setIsEditingFaq(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all text-sm font-bold shadow-lg shadow-blue-500/20 disabled:opacity-50"
                    >
                        <Plus className="w-4 h-4" />
                        Nueva Pregunta
                    </button>
                </div>

                {error && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/10 text-red-600 rounded-lg text-xs flex items-center gap-2">
                        <X className="w-4 h-4 cursor-pointer" onClick={() => setError(null)} />
                        {error}
                    </div>
                )}

                <div className="space-y-3">
                    {filteredFaqs.length === 0 ? (
                        <div className="p-12 text-center bg-gray-50 dark:bg-[#111b21] rounded-2xl border-2 border-dashed border-gray-200 dark:border-[#374248]">
                            <BookOpen className="w-12 h-12 text-gray-300 dark:text-[#374248] mx-auto mb-3" />
                            <p className="text-gray-500 dark:text-[#8696a0]">No hay preguntas en esta categoría</p>
                        </div>
                    ) : (
                        filteredFaqs.map((faq, idx) => (
                            <div
                                key={faq.id}
                                className="p-4 bg-white dark:bg-[#202c33] border border-gray-100 dark:border-[#374248] rounded-2xl hover:shadow-md transition-all group animate-fade-in-up"
                                style={{ animationDelay: `${idx * 50}ms` }}
                            >
                                <div className="flex justify-between items-start gap-4">
                                    <div className="space-y-1 flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-gray-800 dark:text-[#e9edef]">{faq.question}</p>
                                            {faq.approved && (
                                                <div className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded text-[10px] font-bold uppercase tracking-tighter">
                                                    Verificado
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-600 dark:text-[#8696a0] italic">"{faq.answer}"</p>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => {
                                                setCurrentFaq(faq);
                                                setIsEditingFaq(true);
                                            }}
                                            className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500 rounded-lg"
                                            aria-label="Editar FAQ"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteFaq(faq.id)}
                                            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded-lg"
                                            aria-label="Eliminar FAQ"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Category Modal */}
            {isEditingCategory && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fade-in">
                    <div className="bg-white dark:bg-[#111b21] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100 dark:border-[#374248] animate-scale-in">
                        <div className="bg-blue-600 p-4 flex items-center justify-between">
                            <h3 className="text-white font-bold flex items-center gap-2">
                                <FolderPlus className="w-5 h-5" />
                                {currentCategory?.id ? 'Editar Categoría' : 'Nueva Categoría'}
                            </h3>
                            <button onClick={() => setIsEditingCategory(false)} className="text-white/80 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveCategory} className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase">Nombre</label>
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    value={currentCategory?.name || ''}
                                    onChange={(e) => setCurrentCategory((prev: any) => ({ ...prev, name: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#2a3942] border border-gray-200 dark:border-[#374248] rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Ej: Ventas, Soporte, Reclutamiento"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                            >
                                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                                {currentCategory?.id ? 'Actualizar' : 'Crear'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* FAQ Modal */}
            {isEditingFaq && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fade-in">
                    <div className="bg-white dark:bg-[#111b21] rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-gray-100 dark:border-[#374248] animate-scale-in">
                        <div className="bg-blue-600 p-4 flex items-center justify-between">
                            <h3 className="text-white font-bold flex items-center gap-2">
                                <FileText className="w-5 h-5" />
                                {currentFaq?.id ? 'Editar Pregunta/Respuesta' : 'Nueva Pregunta/Respuesta'}
                            </h3>
                            <button onClick={() => setIsEditingFaq(false)} className="text-white/80 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveFaq} className="p-6 space-y-4">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Pregunta (Entrada del Usuario)</label>
                                    <button
                                        type="button"
                                        onClick={generateAIVariation}
                                        disabled={isGenerating || !currentFaq?.question}
                                        className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded transition-all disabled:opacity-40"
                                    >
                                        {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                        Optimizar con IA
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    required
                                    value={currentFaq?.question || ''}
                                    onChange={(e) => setCurrentFaq((prev: any) => ({ ...prev, question: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#2a3942] border border-gray-200 dark:border-[#374248] rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="¿Cuál es el precio del curso?"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase">Respuesta (Salida del Bot)</label>
                                <textarea
                                    required
                                    rows={4}
                                    value={currentFaq?.answer || ''}
                                    onChange={(e) => setCurrentFaq((prev: any) => ({ ...prev, answer: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#2a3942] border border-gray-200 dark:border-[#374248] rounded-xl outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                    placeholder="Escribe la respuesta detallada aquí..."
                                />
                            </div>

                            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#202c33] rounded-xl border border-gray-100 dark:border-[#374248]">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center text-green-600">
                                        <CheckCircle className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-800 dark:text-[#e9edef]">Auto-Verificado</p>
                                        <p className="text-[10px] text-gray-500">Publicar esta respuesta inmediatamente</p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={currentFaq?.approved || false}
                                        onChange={(e) => setCurrentFaq((prev: any) => ({ ...prev, approved: e.target.checked }))}
                                    />
                                    <div className="w-10 h-5 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:bg-green-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                                </label>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsEditingFaq(false)}
                                    className="flex-1 py-3 text-gray-600 font-bold hover:bg-gray-100 dark:hover:bg-[#202c33] rounded-xl transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                                >
                                    {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {currentFaq?.id ? 'Actualizar' : 'Guardar en el Cerebro'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
