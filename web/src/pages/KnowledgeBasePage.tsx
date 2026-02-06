/**
 * KnowledgeBasePage - FAQ and Knowledge Base Management
 */

import { useState, useEffect } from 'react';
import { 
    BookOpen, Search, Plus, Edit2, Trash2, Upload, Download,
    ChevronDown, ChevronRight, Save, FileText, RefreshCw
} from 'lucide-react';

interface FAQ {
    id: string;
    question: string;
    answer: string;
    category: string;
    keywords: string[];
    createdAt: string;
    updatedAt: string;
}

interface Category {
    name: string;
    count: number;
}

const API_BASE = 'http://localhost:3001/api/admin';

type TabType = 'faqs' | 'import-export' | 'search';

export const KnowledgeBasePage = () => {
    const [activeTab, setActiveTab] = useState<TabType>('faqs');
    const [faqs, setFaqs] = useState<FAQ[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [expandedFaqs, setExpandedFaqs] = useState<Set<string>>(new Set());
    const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [importText, setImportText] = useState('');

    const getAdminKey = () => localStorage.getItem('ADMIN_API_KEY') || 'dev-admin-key-123';

    // Demo data
    const demoFaqs: FAQ[] = [
        { id: '1', question: '¿Cuáles son los horarios de clases?', answer: 'Las clases se imparten de lunes a sábado. Los horarios específicos dependen del programa y nivel. Consulta el calendario de tu grupo.', category: 'Horarios', keywords: ['horario', 'clase', 'hora'], createdAt: '2024-01-15', updatedAt: '2024-01-15' },
        { id: '2', question: '¿Cómo puedo inscribir a mi hijo?', answer: 'Para inscribir a tu hijo, acércate a nuestras oficinas con acta de nacimiento, comprobante de domicilio y una fotografía. También puedes iniciar el proceso en línea.', category: 'Inscripciones', keywords: ['inscripción', 'inscribir', 'registro'], createdAt: '2024-01-15', updatedAt: '2024-01-15' },
        { id: '3', question: '¿Cuál es el costo de la colegiatura?', answer: 'El programa es gratuito. Solo se solicita una cuota de recuperación mensual de $200 que cubre materiales y mantenimiento.', category: 'Costos', keywords: ['costo', 'precio', 'pago', 'colegiatura'], createdAt: '2024-01-15', updatedAt: '2024-01-15' },
        { id: '4', question: '¿Qué instrumentos pueden aprender?', answer: 'Ofrecemos: violín, viola, violonchelo, contrabajo, flauta, clarinete, trompeta, trombón, percusiones y canto coral.', category: 'Programas', keywords: ['instrumento', 'violín', 'flauta', 'música'], createdAt: '2024-01-15', updatedAt: '2024-01-15' },
        { id: '5', question: '¿A partir de qué edad pueden inscribirse?', answer: 'Aceptamos niños desde los 4 años en el programa de iniciación musical. Para instrumentos específicos, generalmente a partir de los 6-7 años.', category: 'Inscripciones', keywords: ['edad', 'años', 'niño', 'pequeño'], createdAt: '2024-01-15', updatedAt: '2024-01-15' },
    ];

    useEffect(() => {
        loadFaqs();
    }, []);

    const loadFaqs = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/knowledge-base`, {
                headers: { 'x-admin-api-key': getAdminKey() }
            });
            const data = await response.json();
            if (data.success && data.data?.length > 0) {
                setFaqs(data.data);
            } else {
                setFaqs(demoFaqs);
            }
        } catch (err) {
            console.error('Error loading FAQs:', err);
            setFaqs(demoFaqs);
        } finally {
            setLoading(false);
        }
    };

    const categories: Category[] = Array.from(
        new Set(faqs.map(f => f.category))
    ).map(name => ({
        name,
        count: faqs.filter(f => f.category === name).length
    }));

    const filteredFaqs = faqs.filter(faq => {
        const matchesSearch = !searchQuery || 
            faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
            faq.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
            faq.keywords.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesCategory = !selectedCategory || faq.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const toggleExpanded = (id: string) => {
        setExpandedFaqs(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSaveFaq = async (faq: Partial<FAQ>) => {
        try {
            if (editingFaq) {
                // Update existing
                const updated = { ...editingFaq, ...faq, updatedAt: new Date().toISOString() };
                setFaqs(prev => prev.map(f => f.id === editingFaq.id ? updated as FAQ : f));
            } else {
                // Create new
                const newFaq: FAQ = {
                    id: Date.now().toString(),
                    question: faq.question || '',
                    answer: faq.answer || '',
                    category: faq.category || 'General',
                    keywords: faq.keywords || [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                setFaqs(prev => [...prev, newFaq]);
            }
            setEditingFaq(null);
            setIsCreating(false);
        } catch (err) {
            console.error('Error saving FAQ:', err);
        }
    };

    const handleDeleteFaq = async (id: string) => {
        if (!confirm('¿Eliminar esta pregunta frecuente?')) return;
        setFaqs(prev => prev.filter(f => f.id !== id));
    };

    const handleExport = () => {
        const markdown = faqs.map(faq => 
            `## ${faq.question}\n\n**Categoría:** ${faq.category}\n\n${faq.answer}\n\n---\n`
        ).join('\n');
        
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'knowledge-base.md';
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImport = () => {
        if (!importText.trim()) return;
        
        // Parse markdown format
        const sections = importText.split('---').filter(s => s.trim());
        const newFaqs: FAQ[] = sections.map((section, i) => {
            const lines = section.trim().split('\n').filter(l => l.trim());
            const question = lines[0]?.replace(/^##\s*/, '') || `Pregunta ${i + 1}`;
            const categoryMatch = section.match(/\*\*Categoría:\*\*\s*(.+)/);
            const category = categoryMatch?.[1]?.trim() || 'Importado';
            const answerLines = lines.filter(l => !l.startsWith('##') && !l.includes('**Categoría:**'));
            const answer = answerLines.join('\n').trim() || 'Sin respuesta';
            
            return {
                id: `imported-${Date.now()}-${i}`,
                question,
                answer,
                category,
                keywords: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
        });
        
        setFaqs(prev => [...prev, ...newFaqs]);
        setImportText('');
        setActiveTab('faqs');
    };

    const FAQEditor = ({ faq, onSave, onCancel }: { faq?: FAQ; onSave: (f: Partial<FAQ>) => void; onCancel: () => void }) => {
        const [question, setQuestion] = useState(faq?.question || '');
        const [answer, setAnswer] = useState(faq?.answer || '');
        const [category, setCategory] = useState(faq?.category || '');
        const [keywordsText, setKeywordsText] = useState(faq?.keywords?.join(', ') || '');

        return (
            <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pregunta</label>
                    <input
                        type="text"
                        value={question}
                        onChange={e => setQuestion(e.target.value)}
                        className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                        placeholder="¿Cuál es tu pregunta?"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Respuesta</label>
                    <textarea
                        value={answer}
                        onChange={e => setAnswer(e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                        placeholder="Escribe la respuesta..."
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoría</label>
                        <input
                            type="text"
                            value={category}
                            onChange={e => setCategory(e.target.value)}
                            className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                            placeholder="General"
                            list="categories"
                        />
                        <datalist id="categories">
                            {categories.map(c => <option key={c.name} value={c.name} />)}
                        </datalist>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Palabras clave</label>
                        <input
                            type="text"
                            value={keywordsText}
                            onChange={e => setKeywordsText(e.target.value)}
                            className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                            placeholder="palabra1, palabra2"
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-2">
                    <button onClick={onCancel} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                        Cancelar
                    </button>
                    <button
                        onClick={() => onSave({ question, answer, category: category || 'General', keywords: keywordsText.split(',').map(k => k.trim()).filter(Boolean) })}
                        className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" /> Guardar
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <BookOpen className="w-7 h-7 text-orange-500" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Base de Conocimientos</h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Gestiona FAQs y respuestas automáticas</p>
                        </div>
                    </div>
                    <button
                        onClick={() => { setIsCreating(true); setEditingFaq(null); setActiveTab('faqs'); }}
                        className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> Nueva Pregunta
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 mb-6">
                    {([
                        { key: 'faqs', label: 'Preguntas Frecuentes', icon: FileText },
                        { key: 'import-export', label: 'Importar/Exportar', icon: Upload },
                        { key: 'search', label: 'Búsqueda', icon: Search },
                    ] as const).map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                                activeTab === tab.key
                                    ? 'bg-white dark:bg-gray-700 text-orange-600 dark:text-orange-400 shadow-sm'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                            }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="flex items-center justify-center h-48">
                        <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
                    </div>
                ) : activeTab === 'faqs' ? (
                    <div className="space-y-4">
                        {/* Filters */}
                        <div className="flex flex-wrap gap-4">
                            <div className="flex-1 min-w-[200px]">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        placeholder="Buscar preguntas..."
                                        className="w-full pl-10 pr-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                    />
                                </div>
                            </div>
                            <select
                                value={selectedCategory}
                                onChange={e => setSelectedCategory(e.target.value)}
                                className="px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                            >
                                <option value="">Todas las categorías</option>
                                {categories.map(c => (
                                    <option key={c.name} value={c.name}>{c.name} ({c.count})</option>
                                ))}
                            </select>
                        </div>

                        {/* New FAQ Form */}
                        {isCreating && (
                            <FAQEditor onSave={handleSaveFaq} onCancel={() => setIsCreating(false)} />
                        )}

                        {/* FAQ List */}
                        <div className="space-y-2">
                            {filteredFaqs.map(faq => (
                                <div key={faq.id} className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 overflow-hidden">
                                    {editingFaq?.id === faq.id ? (
                                        <div className="p-4">
                                            <FAQEditor faq={faq} onSave={handleSaveFaq} onCancel={() => setEditingFaq(null)} />
                                        </div>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => toggleExpanded(faq.id)}
                                                className="w-full p-4 flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
                                            >
                                                {expandedFaqs.has(faq.id) ? (
                                                    <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                                ) : (
                                                    <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                                )}
                                                <div className="flex-1">
                                                    <h3 className="font-medium text-gray-800 dark:text-gray-200">{faq.question}</h3>
                                                    <span className="text-xs text-orange-600 dark:text-orange-400">{faq.category}</span>
                                                </div>
                                                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                                    <button
                                                        onClick={() => setEditingFaq(faq)}
                                                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteFaq(faq.id)}
                                                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </button>
                                            {expandedFaqs.has(faq.id) && (
                                                <div className="px-4 pb-4 pl-12">
                                                    <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{faq.answer}</p>
                                                    {faq.keywords.length > 0 && (
                                                        <div className="mt-2 flex flex-wrap gap-1">
                                                            {faq.keywords.map((kw, i) => (
                                                                <span key={i} className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                                                                    {kw}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            ))}
                            {filteredFaqs.length === 0 && (
                                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                                    No se encontraron preguntas frecuentes
                                </div>
                            )}
                        </div>
                    </div>
                ) : activeTab === 'import-export' ? (
                    <div className="space-y-6">
                        {/* Export */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                                <Download className="w-5 h-5 text-orange-500" /> Exportar
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400 mb-4">
                                Descarga todas las preguntas frecuentes en formato Markdown.
                            </p>
                            <button
                                onClick={handleExport}
                                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                            >
                                Descargar .md ({faqs.length} preguntas)
                            </button>
                        </div>

                        {/* Import */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                                <Upload className="w-5 h-5 text-orange-500" /> Importar
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400 mb-4">
                                Pega contenido en formato Markdown para importar nuevas preguntas.
                            </p>
                            <textarea
                                value={importText}
                                onChange={e => setImportText(e.target.value)}
                                rows={8}
                                placeholder="## ¿Pregunta ejemplo?

**Categoría:** General

Respuesta de ejemplo aquí.

---"
                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-mono text-sm mb-4"
                            />
                            <button
                                onClick={handleImport}
                                disabled={!importText.trim()}
                                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Importar
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Search Tab */
                    <div className="space-y-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
                                Probar Búsqueda de Conocimiento
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400 mb-4">
                                Simula cómo el bot buscaría respuestas en la base de conocimientos.
                            </p>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Escribe una pregunta de usuario..."
                                    className="w-full pl-12 pr-4 py-3 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-lg"
                                />
                            </div>
                        </div>

                        {searchQuery && (
                            <div className="space-y-2">
                                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                    Resultados ({filteredFaqs.length})
                                </h4>
                                {filteredFaqs.slice(0, 5).map(faq => (
                                    <div key={faq.id} className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
                                        <h4 className="font-medium text-gray-800 dark:text-gray-200">{faq.question}</h4>
                                        <p className="text-gray-600 dark:text-gray-400 mt-2">{faq.answer}</p>
                                        <span className="inline-block mt-2 text-xs text-orange-600 dark:text-orange-400">{faq.category}</span>
                                    </div>
                                ))}
                                {filteredFaqs.length === 0 && (
                                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-yellow-800 dark:text-yellow-200">
                                        No se encontraron coincidencias. El bot podría usar IA para generar una respuesta.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
