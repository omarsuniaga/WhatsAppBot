/**
 * Conflict Resolution Page
 * UI for reviewing and resolving schedule conflicts
 */

import { useState, useEffect } from 'react';
import { AlertTriangle, X, Trash2, CheckCircle } from 'lucide-react';
import { deduplicateClasses, detectDuplicates } from '../scripts/deduplicateClasses';
import type { Clase } from '../services/firestore/clasesService';
import { InfoButton } from '../components/common/InfoButton';
import { usePageInfo } from '../hooks/useViewInfo';

interface DuplicateGroup {
    canonical: Clase;
    duplicates: Clase[];
    reason: string;
}

export const ConflictResolutionPage = () => {
    const [loading, setLoading] = useState(false);
    const pageInfo = usePageInfo('conflictResolution');
    const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
    const [resolving, setResolving] = useState(false);
    const [resolved, setResolved] = useState(false);

    useEffect(() => {
        loadDuplicates();
    }, []);

    const loadDuplicates = async () => {
        setLoading(true);
        try {
            const groups = await detectDuplicates();
            setDuplicateGroups(groups);
        } catch (error) {
            console.error('Error loading duplicates:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleResolveAll = async () => {
        if (!confirm(`¿Estás seguro de que quieres resolver ${duplicateGroups.length} grupos de duplicados? Esto eliminará ${duplicateGroups.reduce((sum, g) => sum + g.duplicates.length, 0)} clases duplicadas.`)) {
            return;
        }

        setResolving(true);
        try {
            await deduplicateClasses(false); // LIVE mode
            setResolved(true);
            setTimeout(() => {
                window.location.href = '/schedule';
            }, 2000);
        } catch (error) {
            console.error('Error resolving duplicates:', error);
            alert('Error al resolver duplicados. Ver consola para detalles.');
        } finally {
            setResolving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (resolved) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-green-50 dark:bg-green-900/20">
                <CheckCircle className="w-16 h-16 text-green-600 mb-4" />
                <h1 className="text-2xl font-bold text-green-900 dark:text-green-100 mb-2">
                    ¡Conflictos Resueltos!
                </h1>
                <p className="text-green-700 dark:text-green-300">
                    Redirigiendo al horario...
                </p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6 mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="w-8 h-8 text-red-600" />
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                                    Resolver Conflictos de Horario
                                </h1>
                                <p className="text-gray-600 dark:text-gray-400">
                                    {duplicateGroups.length} grupos de clases duplicadas detectados
                                </p>
                            </div>
                            {pageInfo.hasInfo && (
                                <InfoButton
                                    title={pageInfo.title}
                                    description={pageInfo.description}
                                    tips={pageInfo.tips}
                                />
                            )}
                        </div>
                        <button
                            onClick={() => window.history.back()}
                            className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {duplicateGroups.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-12 text-center">
                        <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                            No se encontraron conflictos
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400">
                            Todos los horarios están correctos
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Action Bar */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-4 mb-6">
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                    Total de duplicados a eliminar: <strong>{duplicateGroups.reduce((sum, g) => sum + g.duplicates.length, 0)}</strong>
                                </div>
                                <button
                                    onClick={handleResolveAll}
                                    disabled={resolving}
                                    className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    {resolving ? 'Resolviendo...' : 'Resolver Todos'}
                                </button>
                            </div>
                        </div>

                        {/* Duplicate Groups List */}
                        <div className="space-y-4 max-h-[calc(100vh-320px)] overflow-y-auto pr-2">
                            {duplicateGroups.map((group, index) => (
                                <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6">
                                    <div className="flex items-start gap-4">
                                        <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-1" />
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                                                Grupo {index + 1}: {group.reason}
                                            </h3>

                                            {/* Canonical Class */}
                                            <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                                <div className="text-sm text-green-700 dark:text-green-300 font-medium mb-1">
                                                    ✓ Clase a mantener
                                                </div>
                                                <div className="text-gray-900 dark:text-white font-medium">
                                                    {group.canonical.name || group.canonical.nombre}
                                                </div>
                                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                                    ID: {group.canonical.id}
                                                </div>
                                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                                    Alumnos: {(group.canonical.studentIds || group.canonical.alumno_ids || []).length}
                                                </div>
                                            </div>

                                            {/* Duplicate Classes */}
                                            <div className="space-y-2">
                                                <div className="text-sm text-red-700 dark:text-red-300 font-medium mb-2">
                                                    ✗ Clases a eliminar
                                                </div>
                                                {group.duplicates.map((dup) => (
                                                    <div key={dup.id} className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                                        <div className="text-gray-900 dark:text-white font-medium">
                                                            {dup.name || dup.nombre}
                                                        </div>
                                                        <div className="text-sm text-gray-600 dark:text-gray-400">
                                                            ID: {dup.id}
                                                        </div>
                                                        <div className="text-sm text-gray-600 dark:text-gray-400">
                                                            Alumnos: {(dup.studentIds || dup.alumno_ids || []).length} (serán fusionados)
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
