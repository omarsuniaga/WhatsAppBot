/**
 * FirestoreDiagnosticPage - Test Firestore collection connections
 * This page helps verify connectivity to all Firestore collections
 */

import { useState, useEffect } from 'react';
import {
    Database, CheckCircle2, XCircle, RefreshCw, AlertCircle, Loader2
} from 'lucide-react';

// Import all services
import {
    alumnosService,
    profesoresService,
    maestrosService,
    clasesService,
    emergencyClassesService,
    salonesService,
    asistenciasService,
    horariosService,
    observacionesService,
    contactosService,
    broadcastsService,
    templatesService,
    knowledgeService,
    ticketsService
} from '../services/firestore';

interface CollectionStatus {
    name: string;
    collection: string;
    status: 'pending' | 'loading' | 'success' | 'error';
    count?: number;
    error?: string;
    latency?: number;
}

export const FirestoreDiagnosticPage = () => {
    const [collections, setCollections] = useState<CollectionStatus[]>([
        { name: 'Alumnos', collection: 'ALUMNOS', status: 'pending' },
        { name: 'Profesores', collection: 'PROFESORES', status: 'pending' },
        { name: 'Maestros', collection: 'MAESTROS', status: 'pending' },
        { name: 'Clases', collection: 'CLASES', status: 'pending' },
        { name: 'Emergency Classes', collection: 'EMERGENCY_CLASSES', status: 'pending' },
        { name: 'Salones', collection: 'SALONES', status: 'pending' },
        { name: 'Asistencias', collection: 'ASISTENCIAS', status: 'pending' },
        { name: 'Horarios', collection: 'HORARIOS', status: 'pending' },
        { name: 'Observaciones', collection: 'OBSERVACIONES_UNIFICADAS', status: 'pending' },
        { name: 'Contactos', collection: 'CONTACTOS', status: 'pending' },
        { name: 'Broadcasts', collection: 'BROADCASTS', status: 'pending' },
        { name: 'Templates', collection: 'TEMPLATES', status: 'pending' },
        { name: 'Knowledge Base', collection: 'KNOWLEDGE_BASE', status: 'pending' },
        { name: 'Tickets', collection: 'TICKETS', status: 'pending' },
    ]);

    const [testing, setTesting] = useState(false);

    const updateCollection = (index: number, update: Partial<CollectionStatus>) => {
        setCollections(prev => {
            const newCollections = [...prev];
            newCollections[index] = { ...newCollections[index], ...update };
            return newCollections;
        });
    };

    const testCollection = async (index: number) => {
        updateCollection(index, { status: 'loading' });
        const start = Date.now();

        try {
            let data: any[] = [];

            switch (collections[index].collection) {
                case 'ALUMNOS':
                    data = await alumnosService.getAllStudents();
                    break;
                case 'PROFESORES':
                    data = await profesoresService.getAllProfesores();
                    break;
                case 'MAESTROS':
                    data = await maestrosService.getAllMaestros();
                    break;
                case 'CLASES':
                    data = await clasesService.getAllClases();
                    break;
                case 'EMERGENCY_CLASSES':
                    data = await emergencyClassesService.getAllEmergencyClasses();
                    break;
                case 'SALONES':
                    data = await salonesService.getAllSalones();
                    break;
                case 'ASISTENCIAS':
                    // Get today's date
                    const today = new Date().toISOString().split('T')[0];
                    data = await asistenciasService.getByDate(today);
                    break;
                case 'HORARIOS':
                    data = await horariosService.getAllHorarios();
                    break;
                case 'OBSERVACIONES_UNIFICADAS':
                    data = await observacionesService.getAllObservaciones();
                    break;
                case 'CONTACTOS':
                    data = await contactosService.getAllContactos();
                    break;
                case 'BROADCASTS':
                    data = await broadcastsService.getAllBroadcasts();
                    break;
                case 'TEMPLATES':
                    data = await templatesService.getAllTemplates();
                    break;
                case 'KNOWLEDGE_BASE':
                    data = await knowledgeService.getAllEntries();
                    break;
                case 'TICKETS':
                    data = await ticketsService.getAllTickets();
                    break;
            }

            const latency = Date.now() - start;
            updateCollection(index, {
                status: 'success',
                count: data.length,
                latency,
                error: undefined
            });
            return true;
        } catch (err: any) {
            const latency = Date.now() - start;
            console.error(`Error testing ${collections[index].collection}:`, err);
            updateCollection(index, {
                status: 'error',
                error: err.message || 'Unknown error',
                latency,
                count: undefined
            });
            return false;
        }
    };

    const runAllTests = async () => {
        setTesting(true);

        // Reset all to pending
        setCollections(prev => prev.map(c => ({ ...c, status: 'pending' as const })));

        // Test each collection sequentially
        for (let i = 0; i < collections.length; i++) {
            await testCollection(i);
            // Small delay between tests
            await new Promise(r => setTimeout(r, 100));
        }

        setTesting(false);
    };

    // Run tests on mount
    useEffect(() => {
        runAllTests();
    }, []);

    const successCount = collections.filter(c => c.status === 'success').length;
    const errorCount = collections.filter(c => c.status === 'error').length;
    const totalDocs = collections.reduce((sum, c) => sum + (c.count || 0), 0);

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <Database className="w-7 h-7 text-blue-500" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                                Diagnóstico Firestore
                            </h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Verificación de conexiones a colecciones
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={runAllTests}
                        disabled={testing}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
                    >
                        {testing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <RefreshCw className="w-4 h-4" />
                        )}
                        {testing ? 'Probando...' : 'Ejecutar Pruebas'}
                    </button>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 text-center">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {successCount}/{collections.length}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Conectadas</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 text-center">
                        <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                            {errorCount}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Errores</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 text-center">
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {totalDocs}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Documentos</div>
                    </div>
                </div>

                {/* Collection List */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 overflow-hidden">
                    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 font-medium text-sm text-gray-600 dark:text-gray-400">
                        <div>Colección</div>
                        <div className="text-center">Documentos</div>
                        <div className="text-center">Latencia</div>
                        <div className="text-center">Estado</div>
                    </div>

                    {collections.map((col) => (
                        <div
                            key={col.collection}
                            className="grid grid-cols-[1fr_auto_auto_auto] gap-4 p-3 border-t dark:border-gray-700 items-center"
                        >
                            <div>
                                <div className="font-medium text-gray-800 dark:text-gray-200">{col.name}</div>
                                <div className="text-xs text-gray-500 font-mono">{col.collection}</div>
                            </div>

                            <div className="text-center w-20">
                                {col.status === 'success' && (
                                    <span className="font-medium text-gray-800 dark:text-gray-200">
                                        {col.count}
                                    </span>
                                )}
                                {col.status === 'loading' && (
                                    <Loader2 className="w-4 h-4 animate-spin mx-auto text-blue-500" />
                                )}
                                {col.status === 'pending' && (
                                    <span className="text-gray-400">-</span>
                                )}
                                {col.status === 'error' && (
                                    <span className="text-red-500">-</span>
                                )}
                            </div>

                            <div className="text-center w-20">
                                {col.latency !== undefined && (
                                    <span className={`text-sm ${col.latency < 500 ? 'text-green-600' :
                                            col.latency < 2000 ? 'text-yellow-600' : 'text-red-600'
                                        }`}>
                                        {col.latency}ms
                                    </span>
                                )}
                            </div>

                            <div className="text-center w-20">
                                {col.status === 'success' && (
                                    <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto" />
                                )}
                                {col.status === 'loading' && (
                                    <Loader2 className="w-5 h-5 animate-spin text-blue-500 mx-auto" />
                                )}
                                {col.status === 'pending' && (
                                    <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600 mx-auto" />
                                )}
                                {col.status === 'error' && (
                                    <div className="flex items-center justify-center gap-1" title={col.error}>
                                        <XCircle className="w-5 h-5 text-red-500" />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Error Details */}
                {errorCount > 0 && (
                    <div className="mt-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 p-4">
                        <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-medium mb-2">
                            <AlertCircle className="w-5 h-5" />
                            Errores Detectados
                        </div>
                        <div className="space-y-2">
                            {collections.filter(c => c.status === 'error').map(col => (
                                <div key={col.collection} className="text-sm">
                                    <span className="font-mono text-red-600 dark:text-red-400">{col.collection}:</span>
                                    <span className="ml-2 text-red-700 dark:text-red-300">{col.error}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Success Message */}
                {successCount === collections.length && !testing && (
                    <div className="mt-6 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 p-4">
                        <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium">
                            <CheckCircle2 className="w-5 h-5" />
                            ¡Todas las colecciones están conectadas correctamente!
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
