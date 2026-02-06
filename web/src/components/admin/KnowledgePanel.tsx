/**
 * Knowledge Base Panel
 * Gestión de FAQs y respuestas automáticas
 */

import { useState, useEffect } from 'react';
import { 
    BookOpen, Plus, Search, Edit2, Trash2, Check, X, 
    MessageSquare, RefreshCw,
    ChevronDown, ChevronRight
} from 'lucide-react';
import { knowledgeApi } from '../../api/client';

interface FAQ {
    id: string;
    category: string;
    questions: string[];
    answer: string;
    keywords: string[];
    approved: boolean;
    usageCount: number;
    createdBy: string;
}

interface Category {
    id: string;
    name: string;
    description: string;
    isActive: boolean;
}

export const KnowledgePanel = () => {
    const [faqs, setFaqs] = useState<FAQ[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
    const [expandedFaqs, setExpandedFaqs] = useState<Set<string>>(new Set());

    // Form state
    const [formData, setFormData] = useState({
        category: 'general',
        questions: [''],
        answer: '',
        keywords: ''
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [faqsRes, categoriesRes] = await Promise.all([
                knowledgeApi.getFaqs(),
                knowledgeApi.getCategories(true)
            ]);
            setFaqs(faqsRes.data.data || []);
            setCategories(categoriesRes.data.data || []);
        } catch (error) {
            console.error('Error loading knowledge base:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddFaq = async () => {
        try {
            const payload = {
                category: formData.category,
                questions: formData.questions.filter(q => q.trim()),
                answer: formData.answer,
                keywords: formData.keywords.split(',').map(k => k.trim()).filter(Boolean)
            };

            if (editingFaq) {
                await knowledgeApi.updateFaq(editingFaq.id, payload);
            } else {
                await knowledgeApi.addFaq(payload);
            }

            setShowAddModal(false);
            setEditingFaq(null);
            resetForm();
            loadData();
        } catch (error) {
            console.error('Error saving FAQ:', error);
        }
    };

    const handleDeleteFaq = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar esta FAQ?')) return;
        try {
            await knowledgeApi.deleteFaq(id);
            loadData();
        } catch (error) {
            console.error('Error deleting FAQ:', error);
        }
    };

    const handleApproveFaq = async (id: string) => {
        try {
            await knowledgeApi.approveFaq(id);
            loadData();
        } catch (error) {
            console.error('Error approving FAQ:', error);
        }
    };

    const resetForm = () => {
        setFormData({
            category: 'general',
            questions: [''],
            answer: '',
            keywords: ''
        });
    };

    const openEditModal = (faq: FAQ) => {
        setEditingFaq(faq);
        setFormData({
            category: faq.category,
            questions: faq.questions,
            answer: faq.answer,
            keywords: faq.keywords.join(', ')
        });
        setShowAddModal(true);
    };

    const toggleExpand = (id: string) => {
        const newExpanded = new Set(expandedFaqs);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedFaqs(newExpanded);
    };

    const filteredFaqs = faqs.filter(faq => {
        const matchesSearch = !searchQuery || 
            faq.questions.some(q => q.toLowerCase().includes(searchQuery.toLowerCase())) ||
            faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = !selectedCategory || faq.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const pendingFaqs = faqs.filter(f => !f.approved);

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 p-4 transition-colors">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <BookOpen className="w-6 h-6 text-whatsapp-green" />
                        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Base de Conocimiento</h2>
                        {pendingFaqs.length > 0 && (
                            <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded-full">
                                {pendingFaqs.length} pendientes
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={loadData}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 transition-colors"
                            title="Recargar"
                        >
                            <RefreshCw className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => {
                                resetForm();
                                setEditingFaq(null);
                                setShowAddModal(true);
                            }}
                            className="flex items-center gap-2 bg-whatsapp-green text-white px-4 py-2 rounded-lg hover:bg-whatsapp-dark"
                        >
                            <Plus className="w-4 h-4" />
                            Nueva FAQ
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                        <input
                            type="text"
                            placeholder="Buscar preguntas o respuestas..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:border-whatsapp-green bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                        />
                    </div>
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="px-4 py-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:border-whatsapp-green bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                    >
                        <option value="">Todas las categorías</option>
                        {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <RefreshCw className="w-8 h-8 animate-spin text-whatsapp-green" />
                    </div>
                ) : filteredFaqs.length === 0 ? (
                    <div className="text-center py-12">
                        <MessageSquare className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-500 dark:text-gray-400">No hay FAQs registradas</p>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="mt-4 text-whatsapp-green hover:underline"
                        >
                            Agregar primera FAQ
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredFaqs.map(faq => (
                            <div
                                key={faq.id}
                                className={`bg-white dark:bg-gray-800 rounded-lg border transition-colors ${!faq.approved ? 'border-orange-300 dark:border-orange-500/50' : 'border-gray-200 dark:border-gray-700'} overflow-hidden`}
                            >
                                <div
                                    className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                    onClick={() => toggleExpand(faq.id)}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-3">
                                            {expandedFaqs.has(faq.id) ? (
                                                <ChevronDown className="w-5 h-5 text-gray-400 dark:text-gray-500 mt-1" />
                                            ) : (
                                                <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500 mt-1" />
                                            )}
                                            <div>
                                                <p className="font-medium text-gray-800 dark:text-gray-100">
                                                    {faq.questions[0]}
                                                </p>
                                                {faq.questions.length > 1 && (
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                                        +{faq.questions.length - 1} variaciones
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded">
                                                {categories.find(c => c.id === faq.category)?.name || faq.category}
                                            </span>
                                            {!faq.approved && (
                                                <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2 py-1 rounded">
                                                    Pendiente
                                                </span>
                                            )}
                                            <span className="text-xs text-gray-400 dark:text-gray-500">
                                                {faq.usageCount} usos
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {expandedFaqs.has(faq.id) && (
                                    <div className="border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 transition-colors">
                                        <div className="mb-3">
                                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Respuesta:</p>
                                            <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{faq.answer}</p>
                                        </div>

                                        {faq.keywords.length > 0 && (
                                            <div className="mb-3">
                                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Keywords:</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {faq.keywords.map((kw, i) => (
                                                        <span key={i} className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-1 rounded">
                                                            {kw}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex justify-end gap-2 pt-2 border-t dark:border-gray-700">
                                            {!faq.approved && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleApproveFaq(faq.id);
                                                    }}
                                                    className="flex items-center gap-1 px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                                                >
                                                    <Check className="w-4 h-4" />
                                                    Aprobar
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openEditModal(faq);
                                                }}
                                                className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                                Editar
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteFaq(faq.id);
                                                }}
                                                className="flex items-center gap-1 px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                Eliminar
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto transition-colors">
                        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                                {editingFaq ? 'Editar FAQ' : 'Nueva FAQ'}
                            </h3>
                            <button
                                onClick={() => {
                                    setShowAddModal(false);
                                    setEditingFaq(null);
                                }}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Category */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Categoría
                                </label>
                                <select
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:border-whatsapp-green bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                                >
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Questions */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Preguntas (variaciones)
                                </label>
                                {formData.questions.map((q, idx) => (
                                    <div key={idx} className="flex gap-2 mb-2">
                                        <input
                                            type="text"
                                            value={q}
                                            onChange={(e) => {
                                                const newQuestions = [...formData.questions];
                                                newQuestions[idx] = e.target.value;
                                                setFormData({ ...formData, questions: newQuestions });
                                            }}
                                            placeholder={`Pregunta ${idx + 1}`}
                                            className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:border-whatsapp-green bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                                        />
                                        {formData.questions.length > 1 && (
                                            <button
                                                onClick={() => {
                                                    const newQuestions = formData.questions.filter((_, i) => i !== idx);
                                                    setFormData({ ...formData, questions: newQuestions });
                                                }}
                                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button
                                    onClick={() => setFormData({ ...formData, questions: [...formData.questions, ''] })}
                                    className="text-sm text-whatsapp-green hover:underline"
                                >
                                    + Agregar variación
                                </button>
                            </div>

                            {/* Answer */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Respuesta
                                </label>
                                <textarea
                                    value={formData.answer}
                                    onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                                    rows={4}
                                    placeholder="Escribe la respuesta..."
                                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:border-whatsapp-green resize-none bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                                />
                            </div>

                            {/* Keywords */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Keywords (separadas por coma)
                                </label>
                                <input
                                    type="text"
                                    value={formData.keywords}
                                    onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                                    placeholder="precio, costo, valor, cuanto"
                                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:border-whatsapp-green bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                                />
                            </div>
                        </div>

                        <div className="p-4 border-t dark:border-gray-700 flex justify-end gap-2">
                            <button
                                onClick={() => {
                                    setShowAddModal(false);
                                    setEditingFaq(null);
                                }}
                                className="px-4 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleAddFaq}
                                disabled={!formData.questions[0] || !formData.answer}
                                className="px-4 py-2 bg-whatsapp-green text-white rounded-lg hover:bg-whatsapp-dark disabled:opacity-50"
                            >
                                {editingFaq ? 'Guardar Cambios' : 'Crear FAQ'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default KnowledgePanel;
