import { useState } from 'react';
import { 
    BarChart3, 
    MessageSquare, 
    Users, 
    Clock,
    Calendar,
    Download,
    Activity,
    ArrowUp,
    ArrowDown,
    Minus
} from 'lucide-react';

interface AnalyticsData {
    totalMessages: number;
    totalUsers: number;
    activeBots: number;
    responseRate: number;
    averageResponseTime: number;
    messagesToday: number;
    messagesThisWeek: number;
    messagesThisMonth: number;
}

interface DailyStats {
    date: string;
    messages: number;
    users: number;
    botResponses: number;
}

interface TopBot {
    id: string;
    name: string;
    messages: number;
    responses: number;
    responseRate: number;
    trend: 'up' | 'down' | 'stable';
}

export const Analytics = () => {
    const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
    const [selectedMetric, setSelectedMetric] = useState<'messages' | 'users' | 'responses'>('messages');

    const analyticsData: AnalyticsData = {
        totalMessages: 15420,
        totalUsers: 2847,
        activeBots: 3,
        responseRate: 87.5,
        averageResponseTime: 2.3,
        messagesToday: 342,
        messagesThisWeek: 2147,
        messagesThisMonth: 8934
    };

    const dailyStats: DailyStats[] = [
        { date: '2024-01-20', messages: 287, users: 45, botResponses: 251 },
        { date: '2024-01-21', messages: 342, users: 52, botResponses: 298 },
        { date: '2024-01-22', messages: 298, users: 41, botResponses: 267 },
        { date: '2024-01-23', messages: 412, users: 63, botResponses: 361 },
        { date: '2024-01-24', messages: 367, users: 58, botResponses: 324 },
        { date: '2024-01-25', messages: 389, users: 61, botResponses: 342 },
        { date: '2024-01-26', messages: 342, users: 54, botResponses: 301 }
    ];

    const topBots: TopBot[] = [
        {
            id: '1',
            name: 'Asistente Principal',
            messages: 8934,
            responses: 7821,
            responseRate: 87.5,
            trend: 'up'
        },
        {
            id: '2',
            name: 'Bot de Ventas',
            messages: 4521,
            responses: 3876,
            responseRate: 85.7,
            trend: 'stable'
        },
        {
            id: '3',
            name: 'Bot de Soporte',
            messages: 1965,
            responses: 1823,
            responseRate: 92.8,
            trend: 'up'
        }
    ];

    const getTrendIcon = (trend: TopBot['trend']) => {
        switch (trend) {
            case 'up': return <ArrowUp className="w-4 h-4 text-green-600" />;
            case 'down': return <ArrowDown className="w-4 h-4 text-red-600" />;
            case 'stable': return <Minus className="w-4 h-4 text-gray-600" />;
            default: return <Minus className="w-4 h-4 text-gray-600" />;
        }
    };

    const formatNumber = (num: number) => {
        return new Intl.NumberFormat('es-ES').format(num);
    };

    const formatPercentage = (num: number) => {
        return `${num.toFixed(1)}%`;
    };

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Análisis y Estadísticas</h1>
                    <p className="text-gray-600 mt-1">Monitorea el rendimiento de tus bots y conversaciones</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-white rounded-lg border border-gray-200">
                        <button
                            onClick={() => setTimeRange('7d')}
                            className={`px-3 py-2 text-sm font-medium rounded-l-lg transition-colors ${
                                timeRange === '7d' 
                                    ? 'bg-whatsapp-green text-white' 
                                    : 'text-gray-700 hover:bg-gray-100'
                            }`}
                        >
                            7 días
                        </button>
                        <button
                            onClick={() => setTimeRange('30d')}
                            className={`px-3 py-2 text-sm font-medium transition-colors ${
                                timeRange === '30d' 
                                    ? 'bg-whatsapp-green text-white' 
                                    : 'text-gray-700 hover:bg-gray-100'
                            }`}
                        >
                            30 días
                        </button>
                        <button
                            onClick={() => setTimeRange('90d')}
                            className={`px-3 py-2 text-sm font-medium rounded-r-lg transition-colors ${
                                timeRange === '90d' 
                                    ? 'bg-whatsapp-green text-white' 
                                    : 'text-gray-700 hover:bg-gray-100'
                            }`}
                        >
                            90 días
                        </button>
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        <Download className="w-4 h-4" />
                        Exportar
                    </button>
                </div>
            </div>

            {/* Main Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-6 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                            <MessageSquare className="w-6 h-6 text-blue-600" />
                        </div>
                        <span className="text-sm text-green-600 font-medium">+12.5%</span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">{formatNumber(analyticsData.totalMessages)}</h3>
                    <p className="text-sm text-gray-600">Mensajes totales</p>
                </div>

                <div className="bg-white p-6 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                            <Users className="w-6 h-6 text-green-600" />
                        </div>
                        <span className="text-sm text-green-600 font-medium">+8.3%</span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">{formatNumber(analyticsData.totalUsers)}</h3>
                    <p className="text-sm text-gray-600">Usuarios únicos</p>
                </div>

                <div className="bg-white p-6 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                            <Activity className="w-6 h-6 text-purple-600" />
                        </div>
                        <span className="text-sm text-red-600 font-medium">-2.1%</span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">{formatPercentage(analyticsData.responseRate)}</h3>
                    <p className="text-sm text-gray-600">Tasa de respuesta</p>
                </div>

                <div className="bg-white p-6 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                            <Clock className="w-6 h-6 text-orange-600" />
                        </div>
                        <span className="text-sm text-green-600 font-medium">-0.8s</span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">{analyticsData.averageResponseTime}s</h3>
                    <p className="text-sm text-gray-600">Tiempo promedio</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-lg border border-gray-200">
                        <div className="p-4 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                                <h2 className="font-semibold text-gray-900">Actividad Diaria</h2>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setSelectedMetric('messages')}
                                        className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                                            selectedMetric === 'messages'
                                                ? 'bg-whatsapp-green text-white'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                    >
                                        Mensajes
                                    </button>
                                    <button
                                        onClick={() => setSelectedMetric('users')}
                                        className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                                            selectedMetric === 'users'
                                                ? 'bg-whatsapp-green text-white'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                    >
                                        Usuarios
                                    </button>
                                    <button
                                        onClick={() => setSelectedMetric('responses')}
                                        className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                                            selectedMetric === 'responses'
                                                ? 'bg-whatsapp-green text-white'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                    >
                                        Respuestas
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                                <div className="text-center">
                                    <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                    <p className="text-gray-600">Gráfico de actividad</p>
                                    <p className="text-sm text-gray-500 mt-1">
                                        {selectedMetric === 'messages' && 'Mensajes enviados por día'}
                                        {selectedMetric === 'users' && 'Usuarios activos por día'}
                                        {selectedMetric === 'responses' && 'Respuestas del bot por día'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Top Bots */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-lg border border-gray-200">
                        <div className="p-4 border-b border-gray-200">
                            <h2 className="font-semibold text-gray-900">Bots Más Activos</h2>
                        </div>
                        <div className="divide-y divide-gray-200">
                            {topBots.map((bot, index) => (
                                <div key={bot.id} className="p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-whatsapp-green/10 rounded-lg flex items-center justify-center">
                                                <span className="text-sm font-bold text-whatsapp-green">{index + 1}</span>
                                            </div>
                                            <div>
                                                <h4 className="font-medium text-gray-900">{bot.name}</h4>
                                                <p className="text-sm text-gray-600">{formatNumber(bot.messages)} mensajes</p>
                                            </div>
                                        </div>
                                        {getTrendIcon(bot.trend)}
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600">Tasa de respuesta</span>
                                        <span className="font-medium text-gray-900">{formatPercentage(bot.responseRate)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Activity */}
            <div className="mt-6">
                <div className="bg-white rounded-lg border border-gray-200">
                    <div className="p-4 border-b border-gray-200">
                        <h2 className="font-semibold text-gray-900">Actividad Reciente</h2>
                    </div>
                    <div className="divide-y divide-gray-200">
                        {dailyStats.slice(0, 5).map((stat) => (
                            <div key={stat.date} className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                                            <Calendar className="w-5 h-5 text-gray-600" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">
                                                {new Date(stat.date).toLocaleDateString('es-ES', { 
                                                    weekday: 'long', 
                                                    year: 'numeric', 
                                                    month: 'long', 
                                                    day: 'numeric' 
                                                })}
                                            </p>
                                            <p className="text-sm text-gray-600">
                                                {formatNumber(stat.messages)} mensajes • {formatNumber(stat.users)} usuarios
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-medium text-gray-900">{formatNumber(stat.botResponses)}</p>
                                        <p className="text-sm text-gray-600">respuestas</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};