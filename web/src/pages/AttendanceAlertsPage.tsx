/**
 * AttendanceAlertsPage
 * Configuration and monitoring for attendance alert automation
 */

import { useState, useEffect } from 'react';
import { Bell, Settings, History, Activity, Play, TrendingUp } from 'lucide-react';

interface AlertConfig {
    enabled: boolean;
    absenceThreshold: number;
    daysToAnalyze: number;
    autoSend: boolean;
    templateId?: string;
    notifyGuardians: boolean;
}

interface AlertStats {
    totalAlerts: number;
    last24h: number;
    last7days: number;
}

interface AlertHistory {
    id: string;
    type: string;
    level: string;
    message: string;
    entityType?: string;
    entityId?: string;
    createdAt: number;
    data?: any;
}

export const AttendanceAlertsPage = () => {
    const [config, setConfig] = useState<AlertConfig>({
        enabled: true,
        absenceThreshold: 3,
        daysToAnalyze: 7,
        autoSend: false,
        notifyGuardians: true
    });

    const [stats, setStats] = useState<AlertStats>({
        totalAlerts: 0,
        last24h: 0,
        last7days: 0
    });

    const [history, setHistory] = useState<AlertHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const API_BASE = 'http://localhost:3002/api';

    // Load initial data
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);

            // Load config
            const configRes = await fetch(`${API_BASE}/automation/alerts/config`);
            const configData = await configRes.json();
            if (configData.success) {
                setConfig(configData.data);
            }

            // Load stats
            const statsRes = await fetch(`${API_BASE}/automation/alerts/stats`);
            const statsData = await statsRes.json();
            if (statsData.success) {
                setStats(statsData.data);
            }

            // Load history
            const historyRes = await fetch(`${API_BASE}/automation/alerts/history`);
            const historyData = await historyRes.json();
            if (historyData.success) {
                setHistory(historyData.data.slice(0, 10)); // Last 10
            }
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveConfig = async () => {
        try {
            setSaving(true);
            const res = await fetch(`${API_BASE}/automation/alerts/config`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });

            const data = await res.json();
            if (data.success) {
                alert('✅ Configuración guardada correctamente!');
                await loadData();
            } else {
                alert('❌ Error al guardar: ' + data.error);
            }
        } catch (error: any) {
            alert('❌ Error: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const triggerManualAnalysis = async () => {
        try {
            const res = await fetch(`${API_BASE}/automation/alerts/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    days: config.daysToAnalyze,
                    threshold: config.absenceThreshold
                })
            });

            const data = await res.json();
            if (data.success) {
                alert(`✅ Análisis completado!\n\nEstudiantes analizados: ${data.data.summary.studentsAnalyzed}\nAlertas generadas: ${data.data.summary.draftsGenerated}`);
                await loadData();
            }
        } catch (error: any) {
            alert('❌ Error: ' + error.message);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-gray-500">Cargando...</div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Bell className="text-orange-500" />
                    Alertas de Asistencia
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                    Sistema automático de notificaciones por ausencias
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Total Alertas</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalAlerts}</p>
                        </div>
                        <Activity className="text-orange-500" size={32} />
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Últimas 24h</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.last24h}</p>
                        </div>
                        <TrendingUp className="text-blue-500" size={32} />
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Últimos 7 días</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.last7days}</p>
                        </div>
                        <History className="text-green-500" size={32} />
                    </div>
                </div>
            </div>

            {/* Configuration Panel */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6 border border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Settings className="text-orange-500" />
                    Configuración
                </h2>

                <div className="space-y-4">
                    {/* Enabled Toggle */}
                    <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={config.enabled}
                                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                                className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                            />
                            <span className="text-gray-900 dark:text-white font-medium">
                                Alertas Automáticas Habilitadas
                            </span>
                        </label>
                        <span className={`px-3 py-1 rounded-full text-sm ${config.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {config.enabled ? 'Activo' : 'Inactivo'}
                        </span>
                    </div>

                    {/* Auto Send Toggle */}
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={config.autoSend}
                            onChange={(e) => setConfig({ ...config, autoSend: e.target.checked })}
                            className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                        />
                        <span className="text-gray-900 dark:text-white">
                            Envío Automático (sin aprobación manual)
                        </span>
                    </div>

                    {/* Threshold */}
                    <div>
                        <label className="block mb-2 text-gray-900 dark:text-white">
                            Umbral de Ausencias
                        </label>
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                min="2"
                                max="10"
                                value={config.absenceThreshold}
                                onChange={(e) => setConfig({ ...config, absenceThreshold: +e.target.value })}
                                className="flex-1"
                            />
                            <span className="text-2xl font-bold text-orange-500 w-12 text-center">
                                {config.absenceThreshold}
                            </span>
                            <span className="text-gray-600 dark:text-gray-400">ausencias</span>
                        </div>
                    </div>

                    {/* Days to Analyze */}
                    <div>
                        <label className="block mb-2 text-gray-900 dark:text-white">
                            Período de Análisis
                        </label>
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                min="3"
                                max="30"
                                value={config.daysToAnalyze}
                                onChange={(e) => setConfig({ ...config, daysToAnalyze: +e.target.value })}
                                className="flex-1"
                            />
                            <span className="text-2xl font-bold text-blue-500 w-12 text-center">
                                {config.daysToAnalyze}
                            </span>
                            <span className="text-gray-600 dark:text-gray-400">días</span>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-4">
                        <button
                            onClick={saveConfig}
                            disabled={saving}
                            className="bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? 'Guardando...' : 'Guardar Configuración'}
                        </button>

                        <button
                            onClick={triggerManualAnalysis}
                            className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 flex items-center gap-2"
                        >
                            <Play size={16} />
                            Ejecutar Análisis Manual
                        </button>
                    </div>
                </div>
            </div>

            {/* History Panel */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <History className="text-orange-500" />
                    Historial de Alertas ({history.length})
                </h2>

                {history.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No hay alertas registradas</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="border-b border-gray-200 dark:border-gray-700">
                                <tr>
                                    <th className="text-left p-3 text-gray-600 dark:text-gray-400 font-medium">Fecha</th>
                                    <th className="text-left p-3 text-gray-600 dark:text-gray-400 font-medium">Mensaje</th>
                                    <th className="text-left p-3 text-gray-600 dark:text-gray-400 font-medium">Nivel</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((alert) => (
                                    <tr key={alert.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="p-3 text-gray-900 dark:text-white">
                                            {new Date(alert.createdAt * 1000).toLocaleString('es-DO')}
                                        </td>
                                        <td className="p-3 text-gray-900 dark:text-white">
                                            {alert.message}
                                        </td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 rounded text-sm ${alert.level === 'Error' ? 'bg-red-100 text-red-800' :
                                                    alert.level === 'Warning' ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-blue-100 text-blue-800'
                                                }`}>
                                                {alert.level}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
