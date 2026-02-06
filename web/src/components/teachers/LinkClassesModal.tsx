import { useState, useEffect, useMemo } from 'react';
import { X, Search, Link as LinkIcon, AlertCircle, Check, Loader2 } from 'lucide-react';
import { Maestro, Clase, clasesService } from '../../services/firestore';

interface LinkClassesModalProps {
    teacher: Maestro;
    onClose: () => void;
    onSuccess: () => void;
}

export const LinkClassesModal = ({ teacher, onClose, onSuccess }: LinkClassesModalProps) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [allClasses, setAllClasses] = useState<Clase[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadClasses();
    }, []);

    const loadClasses = async () => {
        try {
            setLoading(true);
            // Load ALL classes to perform client-side matching validation
            // In a larger system, we might want to use a cloud function or specialized index
            const classes = await clasesService.getAll();
            setAllClasses(classes);

            // Auto-select suggestions based on name
            const suggestions = findSuggestions(classes);
            suggestions.forEach(c => setSelectedIds(prev => new Set(prev).add(c.id)));
        } catch (error) {
            console.error('Error loading classes:', error);
        } finally {
            setLoading(false);
        }
    };

    const normalize = (str: string) => str?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || '';

    const findSuggestions = (classes: Clase[]) => {
        if (!teacher.name) return [];
        const teacherNameParts = normalize(teacher.name).split(' ').filter(p => p.length > 2);

        return classes.filter(c => {
            // Skip if already assigned to THIS teacher (using UID)
            if (c.teacherId === teacher.id) return false;

            // Check if assigned to another UID (strict check, maybe careful here?)
            // if (c.teacherId && c.teacherId.length > 20 && c.teacherId !== teacher.id) return false;

            // const className = normalize(c.name || '');
            const classTeacherName = normalize(c.profesor_nombre || '');

            // Match if legacy teacher name contains part of the new teacher name
            const nameMatch = teacherNameParts.some(part => classTeacherName.includes(part));

            // Also match if class name contains teacher name (sometimes happens)
            // const contextMatch = teacherNameParts.some(part => className.includes(part));

            return nameMatch;
        });
    };

    const suggestions = useMemo(() => findSuggestions(allClasses), [allClasses, teacher]);

    const searchResults = useMemo(() => {
        if (!searchTerm) return [];
        const term = normalize(searchTerm);
        return allClasses.filter(c => {
            // Exclude already suggested ones to avoid duplication in UI if we were to show them separately
            // But here we might want to just search everything
            return (
                normalize(c.name || '').includes(term) ||
                normalize(c.profesor_nombre || '').includes(term) ||
                normalize(c.instrument || '').includes(term)
            );
        });
    }, [allClasses, searchTerm]);

    // Combined list for display: Suggestions at top, then search results
    // If search is empty, show suggestions. If search is active, show search results.
    const displayedClasses = useMemo(() => {
        if (searchTerm) return searchResults;
        return suggestions;
    }, [searchTerm, searchResults, suggestions]);

    const handleToggle = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const handleSave = async () => {
        if (selectedIds.size === 0) return;

        try {
            setSaving(true);
            await clasesService.assignTeacherToClasses(
                Array.from(selectedIds),
                teacher.id!, // Assuming teacher has ID/UID
                teacher.name
            );
            onSuccess();
        } catch (error) {
            console.error('Error linking classes:', error);
            // Could add toast here
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-0 max-w-2xl w-full shadow-2xl border dark:border-gray-700 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b dark:border-gray-700 flex justify-between items-start">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                            <LinkIcon className="w-5 h-5 text-teal-500" />
                            Vincular Clases
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Asignar clases existentes a <strong>{teacher.name}</strong>
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Search & Content */}
                <div className="p-6 flex-1 overflow-hidden flex flex-col">
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar clase por nombre, profesor anterior o instrumento..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto min-h-[300px] border dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/30">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                                <p>Buscando clases...</p>
                            </div>
                        ) : displayedClasses.length > 0 ? (
                            <div className="divide-y dark:divide-gray-700">
                                {!searchTerm && suggestions.length > 0 && (
                                    <div className="bg-teal-50 dark:bg-teal-900/20 px-4 py-2 text-xs font-bold text-teal-700 dark:text-teal-300 uppercase tracking-wider sticky top-0 backdrop-blur-sm">
                                        Sugerencias encontradas ({suggestions.length})
                                    </div>
                                )}
                                {displayedClasses.map(clase => (
                                    <div
                                        key={clase.id}
                                        className={`p-4 hover:bg-white dark:hover:bg-gray-700 transition-colors cursor-pointer flex items-center gap-4 ${selectedIds.has(clase.id) ? 'bg-teal-50 dark:bg-teal-900/10' : ''}`}
                                        onClick={() => handleToggle(clase.id)}
                                    >
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${selectedIds.has(clase.id) ? 'bg-teal-500 border-teal-500' : 'border-gray-300 dark:border-gray-600'}`}>
                                            {selectedIds.has(clase.id) && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-medium text-gray-900 dark:text-gray-100">{clase.name || clase.nombre || 'Clase sin nombre'}</h4>
                                            <div className="flex gap-4 text-xs text-gray-500 mt-1">
                                                <span>Prof. Actual: {clase.profesor_nombre || 'No asignado'}</span>
                                                <span>•</span>
                                                <span>{clase.instrument || clase.instrumento || 'Sin instrumento'}</span>
                                            </div>
                                        </div>
                                        {clase.teacherId === teacher.id && (
                                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Ya asignada</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8 text-center">
                                <AlertCircle className="w-10 h-10 mb-2 opacity-50" />
                                <p>No se encontraron clases {searchTerm ? 'con esa búsqueda' : 'sugeridas'}.</p>
                                {!searchTerm && <p className="text-sm mt-1">Intenta buscar por nombre específico.</p>}
                            </div>
                        )}
                    </div>

                    <div className="mt-2 text-xs text-gray-500 flex justify-between">
                        <span>{selectedIds.size} clases seleccionadas</span>
                        {!searchTerm && suggestions.length > 0 && <span>Se detectaron coincidencias por nombre</span>}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-2xl flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors font-medium"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || selectedIds.size === 0}
                        className="px-6 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg font-bold shadow-lg shadow-teal-500/20 disabled:opacity-50 disabled:shadow-none flex items-center gap-2 transition-all"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
                        {saving ? 'Vinculando...' : `Vincular ${selectedIds.size} Clases`}
                    </button>
                </div>
            </div>
        </div>
    );
};
