import { useState, useEffect, useMemo } from 'react';
import { X, Search, GitMerge, ArrowRight, AlertTriangle, Loader2 } from 'lucide-react';
import { Maestro, maestrosService, clasesService, Clase } from '../../services/firestore';

interface MergeTeachersModalProps {
    targetTeacher: Maestro;
    onClose: () => void;
    onSuccess: () => void;
}

export const MergeTeachersModal = ({ targetTeacher, onClose, onSuccess }: MergeTeachersModalProps) => {
    const [step, setStep] = useState<'select' | 'confirm'>('select');
    const [loading, setLoading] = useState(false);
    const [merging, setMerging] = useState(false);
    const [allTeachers, setAllTeachers] = useState<Maestro[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [sourceTeacher, setSourceTeacher] = useState<Maestro | null>(null);
    const [sourceClasses, setSourceClasses] = useState<Clase[]>([]);

    useEffect(() => {
        loadTeachers();
    }, []);

    useEffect(() => {
        if (sourceTeacher) {
            loadSourceClasses(sourceTeacher.id!);
        }
    }, [sourceTeacher]);

    const loadTeachers = async () => {
        try {
            setLoading(true);
            const teachers = await maestrosService.getAllMaestros();
            // Exclude the target teacher itself
            setAllTeachers(teachers.filter(t => t.id !== targetTeacher.id));
        } catch (error) {
            console.error('Error loading teachers:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadSourceClasses = async (teacherId: string) => {
        try {
            const classes = await clasesService.getByTeacher(teacherId);
            setSourceClasses(classes);
        } catch (error) {
            console.error('Error loading source classes:', error);
        }
    };

    const normalize = (str: string) => str?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || '';

    const suggestions = useMemo(() => {
        if (!targetTeacher.name) return [];
        const targetParts = normalize(targetTeacher.name).split(' ').filter(p => p.length > 2);

        return allTeachers.filter(t => {
            const name = normalize(t.name || '');
            return targetParts.some(part => name.includes(part));
        });
    }, [allTeachers, targetTeacher]);

    const displayedTeachers = useMemo(() => {
        if (searchTerm) {
            const term = normalize(searchTerm);
            return allTeachers.filter(t =>
                normalize(t.name || '').includes(term) ||
                normalize(t.email || '').includes(term)
            );
        }
        return suggestions;
    }, [allTeachers, searchTerm, suggestions]);

    const handleMerge = async () => {
        if (!sourceTeacher || !targetTeacher) return;

        setMerging(true);
        try {
            // 1. Prepare Merged Data (Copy missing fields from Source to Target)
            const updates: Partial<Maestro> = {};

            if (!targetTeacher.biography && sourceTeacher.biography) updates.biography = sourceTeacher.biography;
            if (!targetTeacher.phone && sourceTeacher.phone) updates.phone = sourceTeacher.phone;
            if (!targetTeacher.address && sourceTeacher.address) updates.address = sourceTeacher.address;
            if (!targetTeacher.primaryInstrument && sourceTeacher.primaryInstrument) updates.primaryInstrument = sourceTeacher.primaryInstrument;
            if (!targetTeacher.photoURL && sourceTeacher.photoURL) updates.photoURL = sourceTeacher.photoURL;

            // Merge arrays (simple concatenation + unique)
            if (sourceTeacher.specialties?.length) {
                const existing = new Set(targetTeacher.specialties || []);
                sourceTeacher.specialties.forEach(s => existing.add(s));
                updates.specialties = Array.from(existing);
            }

            // 2. Update Target Teacher
            if (Object.keys(updates).length > 0) {
                await maestrosService.update(targetTeacher.id!, updates);
            }

            // 3. Move Classes
            if (sourceClasses.length > 0) {
                await clasesService.assignTeacherToClasses(
                    sourceClasses.map(c => c.id),
                    targetTeacher.id!,
                    targetTeacher.name
                );
            }

            // 4. Delete/Archive Source Teacher
            // We delete it to prevent confusion properly
            await maestrosService.delete(sourceTeacher.id!);

            onSuccess();
        } catch (error) {
            console.error('Error merging teachers:', error);
            alert('Error al fusionar. Revisa la consola.');
        } finally {
            setMerging(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full shadow-2xl border dark:border-gray-700 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b dark:border-gray-700 flex justify-between items-start">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                            <GitMerge className="w-5 h-5 text-indigo-500" />
                            Fusionar Maestros
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Transfiere datos y clases de un perfil duplicado a <strong>{targetTeacher.name}</strong>
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto">
                    {step === 'select' ? (
                        <>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Selecciona el perfil duplicado (Origen)
                                </label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Buscar por nombre..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="border dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/30 min-h-[200px] max-h-[300px] overflow-y-auto">
                                {loading ? (
                                    <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
                                ) : displayedTeachers.length > 0 ? (
                                    <div className="divide-y dark:divide-gray-700">
                                        {!searchTerm && suggestions.length > 0 && (
                                            <div className="bg-indigo-50 dark:bg-indigo-900/20 px-4 py-2 text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider sticky top-0 backdrop-blur-sm">
                                                Posibles Duplicados
                                            </div>
                                        )}
                                        {displayedTeachers.map(t => (
                                            <div
                                                key={t.id}
                                                onClick={() => {
                                                    setSourceTeacher(t);
                                                    setStep('confirm');
                                                }}
                                                className="p-4 hover:bg-white dark:hover:bg-gray-700 cursor-pointer transition-colors flex justify-between items-center group"
                                            >
                                                <div>
                                                    <div className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                        {t.name}
                                                    </div>
                                                    <div className="text-xs text-gray-500 mt-0.5">
                                                        {t.email || 'Sin email'} • {t.phone || 'Sin teléfono'}
                                                    </div>
                                                </div>
                                                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-500" />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-8 text-center text-gray-400">
                                        No se encontraron maestros.
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex items-center gap-4 p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/30 rounded-lg text-yellow-800 dark:text-yellow-200">
                                <AlertTriangle className="w-6 h-6 flex-shrink-0" />
                                <div className="text-sm">
                                    <p className="font-bold mb-1">Confirmar Fusión</p>
                                    <p>Esta acción moverá todas las clases y datos del perfil de origen al de destino, y luego <strong>eliminará permanentemente</strong> el perfil de origen.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-[1fr,auto,1fr] gap-4 items-center">
                                {/* Source */}
                                <div className="border dark:border-gray-700 rounded-xl p-4 bg-gray-50 dark:bg-gray-800/50 opacity-70">
                                    <div className="text-xs font-bold text-red-500 uppercase tracking-wider mb-2">Origen (Se eliminará)</div>
                                    <div className="font-bold text-gray-800 dark:text-gray-200 text-lg">{sourceTeacher?.name}</div>
                                    <div className="text-sm text-gray-500 mt-2 space-y-1">
                                        <div>{sourceTeacher?.biography ? '✅ Tiene Biografía' : '❌ Sin Biografía'}</div>
                                        <div>{sourceTeacher?.phone || 'Sin teléfono'}</div>
                                    </div>
                                    <div className="mt-4 inline-block px-3 py-1 bg-white dark:bg-gray-700 rounded-lg shadow-sm font-medium text-sm">
                                        {sourceClasses.length} Clases
                                    </div>
                                </div>

                                <ArrowRight className="w-6 h-6 text-gray-400" />

                                {/* Target */}
                                <div className="border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 bg-indigo-50 dark:bg-indigo-900/10">
                                    <div className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-2">Destino (Se conservará)</div>
                                    <div className="font-bold text-gray-800 dark:text-gray-200 text-lg">{targetTeacher.name}</div>
                                    <div className="text-sm text-gray-500 mt-2 space-y-1">
                                        <div className={!targetTeacher.biography && sourceTeacher?.biography ? 'text-green-600 font-bold' : ''}>
                                            {!targetTeacher.biography && sourceTeacher?.biography ? '+ Recibirá Biografía' : 'Mantiene su info'}
                                        </div>
                                        <div className={!targetTeacher.phone && sourceTeacher?.phone ? 'text-green-600 font-bold' : ''}>
                                            {!targetTeacher.phone && sourceTeacher?.phone ? `+ ${sourceTeacher.phone}` : (targetTeacher.phone || 'Sin teléfono')}
                                        </div>
                                    </div>
                                    <div className="mt-4 inline-block px-3 py-1 bg-white dark:bg-gray-700 rounded-lg shadow-sm font-medium text-sm text-indigo-600 dark:text-indigo-400">
                                        + {sourceClasses.length} Clases nuevas
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-2xl flex justify-between">
                    {step === 'confirm' ? (
                        <button
                            onClick={() => setStep('select')}
                            disabled={merging}
                            className="px-4 py-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                            Atrás
                        </button>
                    ) : (
                        <div /> /* Spacer */
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            disabled={merging}
                            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors font-medium"
                        >
                            Cancelar
                        </button>
                        {step === 'confirm' && (
                            <button
                                onClick={handleMerge}
                                disabled={merging}
                                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-lg shadow-indigo-500/20 disabled:opacity-50 flex items-center gap-2"
                            >
                                {merging ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitMerge className="w-4 h-4" />}
                                {merging ? 'Fusionando...' : 'Confirmar Fusión'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
