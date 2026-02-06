/**
 * Knowledge Base Panel - Improved Version
 * Gestión completa de FAQs con tabs, import/export, y búsqueda avanzada
 */

import { useState, useEffect } from 'react';
import {
    BookOpen, Plus, Search, Edit2, Trash2, Check, X,
    MessageSquare, Tag, RefreshCw, Download, Upload,
    ChevronDown, ChevronRight, BarChart3, Save
} from 'lucide-react';
import { knowledgeApi } from '../../api/client';
import { HighlightedText } from '../common/HighlightedText';
import { MarkdownPreview } from '../common/MarkdownPreview';
import { AIVariationGenerator } from './AIVariationGenerator';

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

type TabType = 'faqs' | 'categories' | 'import-export' | 'stats';

export const KnowledgePanelImproved = () => {
    // State
    const [activeTab, setActiveTab] = useState<TabType>('faqs');
    const [faqs, setFaqs] = useState<FAQ[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
    const [expandedFaqs, setExpandedFaqs] = useState<Set<string>>(new Set());
    const [importText, setImportText] = useState('');

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

    const handleExportJSON = async () => {
        try {
            const response = await fetch('http://localhost:3001/api/knowledge/export', {
                headers: { 'x-admin-api-key': localStorage.getItem('ADMIN_API_KEY') || 'dev-admin-key-123' }
            });
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'knowledge-base.json';
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exporting:', error);
        }
    };

    const handleExportMarkdown = () => {
        const markdown = faqs.map(faq =>
            `## ${faq.questions[0]}\n\n**Categoría:** ${categories.find(c => c.id === faq.category)?.name || faq.category}\n\n${faq.answer}\n\n**Keywords:** ${faq.keywords.join(', ')}\n\n---\n`
        ).join('\n');

        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'knowledge-base.md';
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImportJSON = async () => {
        if (!importText.trim()) return;
        try {
            const data = JSON.parse(importText);
            await fetch('http://localhost:3001/api/knowledge/import', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-api-key': localStorage.getItem('ADMIN_API_KEY') || 'dev-admin-key-123'
                },
                body: JSON.stringify({ data })
            });
            setImportText('');
            setActiveTab('faqs');
            loadData();
        } catch (error) {
            console.error('Error importing:', error);
            alert('Error al importar. Verifica que el JSON sea válido.');
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
    const categoryStats = categories.map(cat => ({
        ...cat,
        count: faqs.filter(f => f.category === cat.id).length,
        views: faqs.filter(f => f.category === cat.id).reduce((sum, f) => sum + f.usageCount, 0)
    }));

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                        <BookOpen className="w-7 h-7 text-orange-500" />
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Base de Conocimiento</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {faqs.length} FAQs · {pendingFaqs.length} pendientes de aprobación
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={loadData}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300"
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
                            className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600"
                        >
                            <Plus className="w-4 h-4" />
                            <span className="hidden sm:inline">Nueva FAQ</span>
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                    {([
                        { key: 'faqs', label: 'Preguntas', icon: MessageSquare },
                        { key: 'categories', label: 'Categorías', icon: Tag },
                        { key: 'import-export', label: 'Import/Export', icon: Upload },
                        { key: 'stats', label: 'Estadísticas', icon: BarChart3 },
                    ] as const).map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === tab.key
                                ? 'bg-white dark:bg-gray-700 text-orange-600 dark:text-orange-400 shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
                    </div>
                ) : activeTab === 'faqs' ? (
                    <div className="space-y-4">
                        {/* Filters */}
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar preguntas o respuestas..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                                />
                            </div>
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="px-4 py-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                            >
                                <option value="">Todas las categorías</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* FAQ List */}
                        {filteredFaqs.length === 0 ? (
                            <div className="text-center py-12">
                                <MessageSquare className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                                <p className="text-gray-500 dark:text-gray-400">No se encontraron FAQs</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {filteredFaqs.map(faq => (
                                    <div
                                        key={faq.id}
                                        className={`bg-white dark:bg-gray-800 rounded-lg border transition-colors ${!faq.approved ? 'border-orange-300 dark:border-orange-500/50' : 'border-gray-200 dark:border-gray-700'
                                            }`}
                                    >
                                        <div
                                            className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                                            onClick={() => toggleExpand(faq.id)}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-start gap-3 flex-1">
                                                    {expandedFaqs.has(faq.id) ? (
                                                        <ChevronDown className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                                                    ) : (
                                                        <ChevronRight className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                                                    )}
                                                    <div className="flex-1">
                                                        <p className="font-medium text-gray-800 dark:text-gray-100">
                                                            <HighlightedText
                                                                text={faq.questions[0]}
                                                                searchQuery={searchQuery}
                                                            />
                                                        </p>
                                                        {faq.questions.length > 1 && (
                                                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                                                +{faq.questions.length - 1} variaciones
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 ml-4">
                                                    <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded">
                                                        {categories.find(c => c.id === faq.category)?.name || faq.category}
                                                    </span>
                                                    {!faq.approved && (
                                                        <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2 py-1 rounded">
                                                            Pendiente
                                                        </span>
                                                    )}
                                                    <span className="text-xs text-gray-400">
                                                        {faq.usageCount} vistas
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {expandedFaqs.has(faq.id) && (
                                            <div className="border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
                                                <div className="mb-3">
                                                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Respuesta:</p>
                                                    <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                                                        <HighlightedText
                                                            text={faq.answer}
                                                            searchQuery={searchQuery}
                                                        />
                                                    </p>
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
                ) : activeTab === 'categories' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {categoryStats.map(cat => (
                            <div
                                key={cat.id}
                                className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-6 hover:shadow-lg transition-shadow cursor-pointer"
                                onClick={() => {
                                    setSelectedCategory(cat.id);
                                    setActiveTab('faqs');
                                }}
                            >
                                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
                                    {cat.name}
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                    {cat.description}
                                </p>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500 dark:text-gray-400">
                                        {cat.count} FAQs
                                    </span>
                                    <span className="text-orange-600 dark:text-orange-400">
                                        {cat.views} vistas
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : activeTab === 'import-export' ? (
                    <div className="space-y-6">
                        {/* Export */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                                <Download className="w-5 h-5 text-orange-500" /> Exportar
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400 mb-4">
                                Descarga todas las preguntas frecuentes en el formato seleccionado.
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleExportJSON}
                                    className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                                >
                                    Descargar JSON ({faqs.length} FAQs)
                                </button>
                                <button
                                    onClick={handleExportMarkdown}
                                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                                >
                                    Descargar Markdown
                                </button>
                            </div>
                        </div>

                        {/* Import */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                                <Upload className="w-5 h-5 text-orange-500" /> Importar
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400 mb-4">
                                Pega el contenido JSON exportado previamente para importar FAQs.
                            </p>
                            <textarea
                                value={importText}
                                onChange={(e) => setImportText(e.target.value)}
                                rows={8}
                                placeholder='{"faqs": [...], "categories": [...]}'
                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-mono text-sm mb-4"
                            />
                            <button
                                onClick={handleImportJSON}
                                disabled={!importText.trim()}
                                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Importar
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Stats Tab */
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-6">
                                <h4 className="text-sm text-gray-500 dark:text-gray-400 mb-2">Total FAQs</h4>
                                <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">{faqs.length}</p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-6">
                                <h4 className="text-sm text-gray-500 dark:text-gray-400 mb-2">Aprobadas</h4>
                                <p className="text-3xl font-bold text-green-600">{faqs.filter(f => f.approved).length}</p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-6">
                                <h4 className="text-sm text-gray-500 dark:text-gray-400 mb-2">Total Vistas</h4>
                                <p className="text-3xl font-bold text-orange-600">{faqs.reduce((sum, f) => sum + f.usageCount, 0)}</p>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Top 10 FAQs Más Vistas</h3>
                            <div className="space-y-2">
                                {[...faqs]
                                    .sort((a, b) => b.usageCount - a.usageCount)
                                    .slice(0, 10)
                                    .map((faq, idx) => (
                                        <div key={faq.id} className="flex items-center justify-between py-2 border-b dark:border-gray-700 last:border-0">
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-bold text-gray-400 w-6">{idx + 1}</span>
                                                <span className="text-gray-800 dark:text-gray-200">{faq.questions[0]}</span>
                                            </div>
                                            <span className="text-sm text-orange-600 dark:text-orange-400">{faq.usageCount} vistas</span>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800">
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
                                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
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
                                            className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
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

                                <div className="flex justify-between items-center">
                                    <button
                                        onClick={() => setFormData({ ...formData, questions: [...formData.questions, ''] })}
                                        className="text-sm text-orange-600 dark:text-orange-400 hover:underline"
                                    >
                                        + Agregar variación manual
                                    </button>
                                </div>

                                {/* AI Variation Generator */}
                                {formData.questions[0] && (
                                    <AIVariationGenerator
                                        baseQuestion={formData.questions[0]}
                                        onSelect={(variations) => {
                                            const newQuestions = [...formData.questions, ...variations];
                                            setFormData({ ...formData, questions: newQuestions });
                                        }}
                                    />
                                )}
                            </div>

                            {/* Answer with Markdown Preview */}
                            <MarkdownPreview
                                content={formData.answer}
                                onChange={(value) => setFormData({ ...formData, answer: value })}
                                rows={6}
                                placeholder="Escribe la respuesta... Soporta Markdown"
                            />

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
                                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                                />
                            </div>
                        </div>

                        <div className="p-4 border-t dark:border-gray-700 flex justify-end gap-2 sticky bottom-0 bg-white dark:bg-gray-800">
                            <button
                                onClick={() => {
                                    setShowAddModal(false);
                                    setEditingFaq(null);
                                }}
                                className="px-4 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleAddFaq}
                                disabled={!formData.questions[0] || !formData.answer}
                                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <Save className="w-4 h-4" />
                                {editingFaq ? 'Guardar Cambios' : 'Crear FAQ'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default KnowledgePanelImproved;
