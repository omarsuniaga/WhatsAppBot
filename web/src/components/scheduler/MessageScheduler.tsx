import { useState } from 'react';
import { 
    Clock, 
    Plus, 
    Calendar, 
    MessageSquare, 
    Send, 
    Edit2, 
    Trash2, 
    Pause,
    CheckCircle,
    XCircle,
    AlertCircle,
    Users,
    Repeat,
    Bell,
    Zap
} from 'lucide-react';

interface ScheduledMessage {
    id: string;
    name: string;
    message: string;
    recipients: string[];
    scheduledDate: string;
    scheduledTime: string;
    status: 'pending' | 'sent' | 'failed' | 'cancelled';
    recurring?: {
        type: 'daily' | 'weekly' | 'monthly';
        interval: number;
        endDate?: string;
    };
    template?: boolean;
    createdAt: string;
}

interface Template {
    id: string;
    name: string;
    content: string;
    variables: string[];
    category: string;
    usageCount: number;
}

export const MessageScheduler = () => {
    const [activeTab, setActiveTab] = useState<'scheduled' | 'templates'>('scheduled');
    

    const scheduledMessages: ScheduledMessage[] = [
        {
            id: '1',
            name: 'Recordatorio de Reunión',
            message: 'Hola {name}, te recordamos tu reunión mañana a las {time}. ¡No faltes!',
            recipients: ['+5491123456789', '+5491134567890'],
            scheduledDate: '2024-01-27',
            scheduledTime: '09:00',
            status: 'pending',
            createdAt: '2024-01-26 10:30'
        },
        {
            id: '2',
            name: 'Promoción Semanal',
            message: '🎉 ¡Oferta especial! 20% de descuento en todos nuestros productos. Usa el código SAVE20',
            recipients: ['group_vip_clients', 'group_newsletter'],
            scheduledDate: '2024-01-28',
            scheduledTime: '18:00',
            status: 'pending',
            recurring: {
                type: 'weekly',
                interval: 1
            },
            createdAt: '2024-01-25 15:20'
        },
        {
            id: '3',
            name: 'Mensaje de Bienvenida',
            message: '¡Bienvenido! Gracias por unirte a nuestra comunidad.',
            recipients: ['new_subscribers'],
            scheduledDate: '2024-01-25',
            scheduledTime: '12:00',
            status: 'sent',
            createdAt: '2024-01-24 14:10'
        }
    ];

    const templates: Template[] = [
        {
            id: '1',
            name: 'Bienvenida',
            content: '¡Hola {name}! Bienvenido a nuestro servicio. Estamos aquí para ayudarte.',
            variables: ['name'],
            category: 'General',
            usageCount: 45
        },
        {
            id: '2',
            name: 'Confirmación Pedido',
            content: 'Tu pedido #{order_id} ha sido confirmado. Entrega estimada: {delivery_date}',
            variables: ['order_id', 'delivery_date'],
            category: 'Ventas',
            usageCount: 128
        },
        {
            id: '3',
            name: 'Recordatorio Cita',
            content: 'Recordatorio: Tienes una cita el {date} a las {time}. Dirección: {address}',
            variables: ['date', 'time', 'address'],
            category: 'Citas',
            usageCount: 67
        }
    ];

    const getStatusIcon = (status: ScheduledMessage['status']) => {
        switch (status) {
            case 'pending': return <Clock className="w-4 h-4 text-orange-600" />;
            case 'sent': return <CheckCircle className="w-4 h-4 text-green-600" />;
            case 'failed': return <XCircle className="w-4 h-4 text-red-600" />;
            case 'cancelled': return <AlertCircle className="w-4 h-4 text-gray-600" />;
            default: return <Clock className="w-4 h-4 text-gray-600" />;
        }
    };

    const getStatusText = (status: ScheduledMessage['status']) => {
        switch (status) {
            case 'pending': return 'Pendiente';
            case 'sent': return 'Enviado';
            case 'failed': return 'Fallido';
            case 'cancelled': return 'Cancelado';
            default: return 'Desconocido';
        }
    };

    const getStatusColor = (status: ScheduledMessage['status']) => {
        switch (status) {
            case 'pending': return 'text-orange-600 bg-orange-100';
            case 'sent': return 'text-green-600 bg-green-100';
            case 'failed': return 'text-red-600 bg-red-100';
            case 'cancelled': return 'text-gray-600 bg-gray-100';
            default: return 'text-gray-600 bg-gray-100';
        }
    };

    const formatRecipients = (recipients: string[]) => {
        if (recipients.length === 1) return recipients[0];
        return `${recipients.length} destinatarios`;
    };

    

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Programador de Mensajes</h1>
                    <p className="text-gray-600 mt-1">Programa y automatiza el envío de mensajes</p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 bg-whatsapp-green text-white rounded-lg hover:bg-whatsapp-dark transition-colors">
                    <Plus className="w-4 h-4" />
                    Nuevo Mensaje
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                            <Clock className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Pendientes</p>
                            <p className="text-xl font-bold text-gray-900">
                                {scheduledMessages.filter(m => m.status === 'pending').length}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Enviados</p>
                            <p className="text-xl font-bold text-gray-900">
                                {scheduledMessages.filter(m => m.status === 'sent').length}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Users className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Destinatarios</p>
                            <p className="text-xl font-bold text-gray-900">
                                {scheduledMessages.reduce((acc, msg) => acc + msg.recipients.length, 0)}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <Repeat className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Recurrentes</p>
                            <p className="text-xl font-bold text-gray-900">
                                {scheduledMessages.filter(m => m.recurring).length}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-lg border border-gray-200">
                <div className="border-b border-gray-200">
                    <div className="flex">
                        <button
                            onClick={() => setActiveTab('scheduled')}
                            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                                activeTab === 'scheduled'
                                    ? 'border-whatsapp-green text-whatsapp-green'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            Mensajes Programados
                        </button>
                        <button
                            onClick={() => setActiveTab('templates')}
                            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                                activeTab === 'templates'
                                    ? 'border-whatsapp-green text-whatsapp-green'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            Plantillas
                        </button>
                    </div>
                </div>

                {/* Content */}
                {activeTab === 'scheduled' ? (
                    <div className="divide-y divide-gray-200">
                        {scheduledMessages.map((message) => (
                            <div key={message.id} className="p-4 hover:bg-gray-50 transition-colors">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="font-semibold text-gray-900">{message.name}</h3>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(message.status)}`}>
                                                {getStatusIcon(message.status)}
                                                <span className="ml-1">{getStatusText(message.status)}</span>
                                            </span>
                                            {message.recurring && (
                                                <span className="px-2 py-1 bg-purple-100 text-purple-600 rounded-full text-xs font-medium">
                                                    <Repeat className="w-3 h-3 inline mr-1" />
                                                    Recurrente
                                                </span>
                                            )}
                                        </div>
                                        
                                        <p className="text-sm text-gray-700 mb-3 line-clamp-2">{message.message}</p>
                                        
                                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                                            <div className="flex items-center gap-1">
                                                <Calendar className="w-4 h-4" />
                                                <span>{message.scheduledDate} a las {message.scheduledTime}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Users className="w-4 h-4" />
                                                <span>{formatRecipients(message.recipients)}</span>
                                            </div>
                                            {message.recurring && (
                                                <div className="flex items-center gap-1">
                                                    <Bell className="w-4 h-4" />
                                                    <span>
                                                        {message.recurring.type === 'daily' && 'Diario'}
                                                        {message.recurring.type === 'weekly' && 'Semanal'}
                                                        {message.recurring.type === 'monthly' && 'Mensual'}
                                                        {message.recurring.interval > 1 && ` (${message.recurring.interval})`}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 ml-4">
                                        {message.status === 'failed' && (
                                            <button
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Reenviar"
                                            >
                                                <Send className="w-4 h-4" />
                                            </button>
                                        )}
                                        {message.status === 'pending' && (
                                            <button
                                                className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                                title="Cancelar"
                                            >
                                                <Pause className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
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
                ) : (
                    <div className="divide-y divide-gray-200">
                        {templates.map((template) => (
                            <div key={template.id} className="p-4 hover:bg-gray-50 transition-colors">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="font-semibold text-gray-900">{template.name}</h3>
                                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                                                {template.category}
                                            </span>
                                        </div>
                                        
                                        <p className="text-sm text-gray-700 mb-3">{template.content}</p>
                                        
                                        <div className="flex items-center gap-4 text-sm text-gray-600">
                                            <div className="flex items-center gap-1">
                                                <Zap className="w-4 h-4" />
                                                <span>{template.usageCount} usos</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <MessageSquare className="w-4 h-4" />
                                                <span>{template.variables.length} variables</span>
                                            </div>
                                            {template.variables.length > 0 && (
                                                <div className="flex items-center gap-1">
                                                    <span className="text-xs">
                                                        Variables: {template.variables.join(', ')}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 ml-4">
                                        <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button className="p-2 text-whatsapp-green hover:bg-whatsapp-green/10 rounded-lg transition-colors" title="Usar plantilla">
                                            <Send className="w-4 h-4" />
                                        </button>
                                        <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};