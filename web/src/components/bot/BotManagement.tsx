import { useState } from 'react';
import { 
    Bot, 
    Plus, 
    Edit2, 
    Trash2, 
    Power, 
    MessageCircle,
    Brain,
    Zap,
    AlertCircle
} from 'lucide-react';

interface BotConfig {
    id: string;
    name: string;
    description: string;
    status: 'active' | 'inactive' | 'error';
    aiEnabled: boolean;
    responseDelay: number;
    autoReply: boolean;
    keywords: string[];
    createdAt: string;
    lastActivity: string;
}

export const BotManagement = () => {
    const [bots, setBots] = useState<BotConfig[]>([
        {
            id: '1',
            name: 'Asistente Principal',
            description: 'Bot principal para atención al cliente',
            status: 'active',
            aiEnabled: true,
            responseDelay: 2,
            autoReply: true,
            keywords: ['hola', 'ayuda', 'información', 'precio'],
            createdAt: '2024-01-15',
            lastActivity: '2024-01-26 10:30'
        },
        {
            id: '2',
            name: 'Bot de Ventas',
            description: 'Especializado en procesos de ventas',
            status: 'inactive',
            aiEnabled: false,
            responseDelay: 5,
            autoReply: true,
            keywords: ['comprar', 'venta', 'pedido', 'producto'],
            createdAt: '2024-01-20',
            lastActivity: '2024-01-25 15:45'
        }
    ]);



    const getStatusColor = (status: BotConfig['status']) => {
        switch (status) {
            case 'active': return 'text-green-600 bg-green-100';
            case 'inactive': return 'text-gray-600 bg-gray-100';
            case 'error': return 'text-red-600 bg-red-100';
            default: return 'text-gray-600 bg-gray-100';
        }
    };

    const getStatusText = (status: BotConfig['status']) => {
        switch (status) {
            case 'active': return 'Activo';
            case 'inactive': return 'Inactivo';
            case 'error': return 'Error';
            default: return 'Desconocido';
        }
    };

    const toggleBotStatus = (botId: string) => {
        setBots(bots.map(bot => 
            bot.id === botId 
                ? { ...bot, status: bot.status === 'active' ? 'inactive' : 'active' }
                : bot
        ));
    };

    const deleteBot = (botId: string) => {
        if (confirm('¿Estás seguro de eliminar este bot?')) {
            setBots(bots.filter(bot => bot.id !== botId));
        }
    };

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Gestión de Bots</h1>
                    <p className="text-gray-600 mt-1">Administra tus bots de WhatsApp y sus configuraciones</p>
                </div>
                <button
                    className="flex items-center gap-2 px-4 py-2 bg-whatsapp-green text-white rounded-lg hover:bg-whatsapp-dark transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Nuevo Bot
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <Bot className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Total Bots</p>
                            <p className="text-xl font-bold text-gray-900">{bots.length}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Power className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Activos</p>
                            <p className="text-xl font-bold text-gray-900">
                                {bots.filter(b => b.status === 'active').length}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <Brain className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Con IA</p>
                            <p className="text-xl font-bold text-gray-900">
                                {bots.filter(b => b.aiEnabled).length}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                            <Zap className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Auto Respuesta</p>
                            <p className="text-xl font-bold text-gray-900">
                                {bots.filter(b => b.autoReply).length}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bots List */}
            <div className="bg-white rounded-lg border border-gray-200">
                <div className="p-4 border-b border-gray-200">
                    <h2 className="font-semibold text-gray-900">Bots Configurados</h2>
                </div>
                <div className="divide-y divide-gray-200">
                    {bots.map((bot) => (
                        <div key={bot.id} className="p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-10 h-10 bg-whatsapp-green/10 rounded-lg flex items-center justify-center">
                                            <Bot className="w-5 h-5 text-whatsapp-green" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-900">{bot.name}</h3>
                                            <p className="text-sm text-gray-600">{bot.description}</p>
                                        </div>
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(bot.status)}`}>
                                            {getStatusText(bot.status)}
                                        </span>
                                    </div>
                                    
                                    <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
                                        <div className="flex items-center gap-1">
                                            <Brain className="w-4 h-4" />
                                            IA: {bot.aiEnabled ? 'Sí' : 'No'}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <MessageCircle className="w-4 h-4" />
                                            Auto: {bot.autoReply ? 'Sí' : 'No'}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Zap className="w-4 h-4" />
                                            {bot.responseDelay}s delay
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <AlertCircle className="w-4 h-4" />
                                            {bot.keywords.length} keywords
                                        </div>
                                    </div>

                                    <div className="mt-2">
                                        <p className="text-xs text-gray-500">
                                            Última actividad: {bot.lastActivity}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 ml-4">
                                    <button
                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="Editar"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => toggleBotStatus(bot.id)}
                                        className={`p-2 rounded-lg transition-colors ${
                                            bot.status === 'active' 
                                                ? 'text-orange-600 hover:bg-orange-50' 
                                                : 'text-green-600 hover:bg-green-50'
                                        }`}
                                        title={bot.status === 'active' ? 'Desactivar' : 'Activar'}
                                    >
                                        <Power className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => deleteBot(bot.id)}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Eliminar"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Empty State */}
            {bots.length === 0 && (
                <div className="text-center py-12">
                    <Bot className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No hay bots configurados</h3>
                    <p className="text-gray-600 mb-4">Crea tu primer bot para empezar a automatizar tus respuestas</p>
                    <button
                        className="px-4 py-2 bg-whatsapp-green text-white rounded-lg hover:bg-whatsapp-dark transition-colors"
                    >
                        Crear Primer Bot
                    </button>
                </div>
            )}
        </div>
    );
};