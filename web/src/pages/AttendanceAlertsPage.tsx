/**
 * AttendanceAlertsPage
 * Configuration and monitoring for attendance alert automation
 * Mobile-first responsive design with modern layout patterns
 */

import { useState, useEffect } from 'react';
import { Bell, Settings, History, Activity, Play, TrendingUp } from 'lucide-react';
import { API_URL } from '../api/client';
import { InfoButton } from '../components/common/InfoButton';
import { usePageInfo } from '../hooks/useViewInfo';

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
    const pageInfo = usePageInfo('attendanceAlerts');

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


    const API_BASE = `${API_URL}/api`;

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
        <div className="min-h-screen max-h-screen overflow-y-auto bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
            {/* Main Container - Mobile-first responsive padding */}
            <div className="w-full px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8">
                <div className="max-w-6xl mx-auto">
                    {/* Header with Info Button - Responsive layout */}
                    <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Bell className="text-orange-500 w-6 h-6 sm:w-8 sm:h-8" />
                                Alertas de Asistencia
                            </h1>
                            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-2">
                                Sistema automático de notificaciones por ausencias
                            </p>
                        </div>
                        {pageInfo && <InfoButton {...pageInfo} />}
                    </div>

                    {/* Stats Cards - Responsive grid: 1 col mobile, 3 cols on md+ */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6">
                        {/* Total Alerts Card */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200">
                            <div className="flex items-center justify-between">
                                <div className="min-w-0">
                                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">Total Alertas</p>
                                    <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mt-1">
                                        {stats.totalAlerts}
                                    </p>
                                </div>
                                <Activity className="text-orange-500 w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 ml-2" />
                            </div>
                        </div>

                        {/* Last 24h Card */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200">
                            <div className="flex items-center justify-between">
                                <div className="min-w-0">
                                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">Últimas 24h</p>
                                    <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mt-1">
                                        {stats.last24h}
                                    </p>
                                </div>
                                <TrendingUp className="text-blue-500 w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 ml-2" />
                            </div>
                        </div>

                        {/* Last 7 Days Card */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200 sm:col-span-2 lg:col-span-1">
                            <div className="flex items-center justify-between">
                                <div className="min-w-0">
                                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">Últimos 7 días</p>
                                    <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mt-1">
                                        {stats.last7days}
                                    </p>
                                </div>
                                <History className="text-green-500 w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 ml-2" />
                            </div>
                        </div>
                    </div>

                    {/* Configuration Panel - Responsive with mobile scrolling */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-6 overflow-hidden">
                        {/* Panel Header */}
                        <div className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-900/10 px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                            <Settings className="text-orange-500 w-5 h-5 sm:w-6 sm:h-6" />
                            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                                Configuración
                            </h2>
                        </div>

                        {/* Panel Content */}
                        <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
                            {/* Enabled Toggle */}
                            <div className="flex items-center justify-between pb-4 sm:pb-5 border-b border-gray-100 dark:border-gray-700">
                                <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                                    <input
                                        type="checkbox"
                                        checked={config.enabled}
                                        onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                                        className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:ring-offset-0 dark:focus:ring-offset-gray-800 cursor-pointer"
                                    />
                                    <span className="text-sm sm:text-base text-gray-900 dark:text-white font-medium">
                                        Alertas Automáticas Habilitadas
                                    </span>
                                </label>
                                <span className={`ml-2 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap flex-shrink-0 ${config.enabled ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                                    {config.enabled ? '✓ Activo' : 'Inactivo'}
                                </span>
                            </div>

                            {/* Auto Send Toggle */}
                            <div className="flex items-center gap-3 pb-4 sm:pb-5 border-b border-gray-100 dark:border-gray-700">
                                <input
                                    type="checkbox"
                                    id="autoSend"
                                    checked={config.autoSend}
                                    onChange={(e) => setConfig({ ...config, autoSend: e.target.checked })}
                                    className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:ring-offset-0 dark:focus:ring-offset-gray-800 cursor-pointer"
                                />
                                <label htmlFor="autoSend" className="text-sm sm:text-base text-gray-900 dark:text-white cursor-pointer">
                                    Envío Automático <span className="text-gray-500 dark:text-gray-400">(sin aprobación manual)</span>
                                </label>
                            </div>

                            {/* Absence Threshold Slider */}
                            <div className="pb-4 sm:pb-5 border-b border-gray-100 dark:border-gray-700">
                                <label className="block mb-3 text-sm sm:text-base font-medium text-gray-900 dark:text-white">
                                    Umbral de Ausencias
                                </label>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                                    <input
                                        type="range"
                                        min="2"
                                        max="10"
                                        value={config.absenceThreshold}
                                        onChange={(e) => setConfig({ ...config, absenceThreshold: +e.target.value })}
                                        className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                                        aria-label="Umbral de ausencias"
                                    />
                                    <div className="flex items-center gap-2 sm:gap-3">
                                        <span className="text-2xl sm:text-3xl font-bold text-orange-500 tabular-nums w-12 text-right">
                                            {config.absenceThreshold}
                                        </span>
                                        <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                            ausencias
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Days to Analyze Slider */}
                            <div>
                                <label className="block mb-3 text-sm sm:text-base font-medium text-gray-900 dark:text-white">
                                    Período de Análisis
                                </label>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                                    <input
                                        type="range"
                                        min="3"
                                        max="30"
                                        value={config.daysToAnalyze}
                                        onChange={(e) => setConfig({ ...config, daysToAnalyze: +e.target.value })}
                                        className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                        aria-label="Período de análisis en días"
                                    />
                                    <div className="flex items-center gap-2 sm:gap-3">
                                        <span className="text-2xl sm:text-3xl font-bold text-blue-500 tabular-nums w-12 text-right">
                                            {config.daysToAnalyze}
                                        </span>
                                        <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                            días
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons - Responsive stack */}
                            <div className="pt-4 sm:pt-6 flex flex-col sm:flex-row gap-2 sm:gap-3">
                                <button
                                    onClick={saveConfig}
                                    disabled={saving}
                                    className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-2 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 text-sm sm:text-base"
                                >
                                    {saving ? 'Guardando...' : 'Guardar Configuración'}
                                </button>

                                <button
                                    onClick={triggerManualAnalysis}
                                    className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-colors duration-200 flex items-center justify-center gap-2 text-sm sm:text-base"
                                >
                                    <Play className="w-4 h-4" />
                                    Ejecutar Análisis Manual
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* History Panel - Responsive with horizontal scroll on mobile */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                        {/* Panel Header */}
                        <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/10 px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                            <History className="text-green-600 w-5 h-5 sm:w-6 sm:h-6" />
                            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                                Historial de Alertas <span className="text-gray-500 dark:text-gray-400 font-normal">({history.length})</span>
                            </h2>
                        </div>

                        {/* Panel Content */}
                        {history.length === 0 ? (
                            <div className="p-6 sm:p-8 text-center">
                                <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base">
                                    No hay alertas registradas
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto max-h-96 overflow-y-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                                        <tr>
                                            <th className="text-left px-4 sm:px-6 py-3 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                Fecha
                                            </th>
                                            <th className="text-left px-4 sm:px-6 py-3 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                Mensaje
                                            </th>
                                            <th className="text-left px-4 sm:px-6 py-3 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                Nivel
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {history.map((alert) => (
                                            <tr key={alert.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors duration-150">
                                                <td className="px-4 sm:px-6 py-3 text-xs sm:text-sm text-gray-900 dark:text-white whitespace-nowrap">
                                                    {new Date(alert.createdAt * 1000).toLocaleString('es-DO', {
                                                        month: 'short',
                                                        day: '2-digit',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </td>
                                                <td className="px-4 sm:px-6 py-3 text-xs sm:text-sm text-gray-900 dark:text-white">
                                                    <span className="line-clamp-2 sm:line-clamp-none">
                                                        {alert.message}
                                                    </span>
                                                </td>
                                                <td className="px-4 sm:px-6 py-3 text-xs sm:text-sm font-medium whitespace-nowrap">
                                                    <span className={`inline-flex px-2 sm:px-3 py-1 rounded-full text-xs font-semibold ${alert.level === 'Error'
                                                        ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                                        : alert.level === 'Warning'
                                                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
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
            </div>
        </div>
    );
};
