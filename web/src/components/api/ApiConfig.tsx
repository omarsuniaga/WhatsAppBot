import { useState } from 'react';
import { 
    Webhook, 
    Plus, 
    Edit2, 
    Trash2, 
    Copy, 
    CheckCircle, 
    XCircle, 
    AlertCircle,
    Key,
    Globe,
    Shield,
    Activity,
    Clock,
    Eye,
    EyeOff,
    RefreshCw,
    TestTube
} from 'lucide-react';

interface ApiEndpoint {
    id: string;
    name: string;
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    description: string;
    status: 'active' | 'inactive' | 'error';
    lastCalled: string;
    callCount: number;
    authentication: 'none' | 'api_key' | 'bearer_token';
    headers: Record<string, string>;
    parameters: ApiParameter[];
}

interface ApiParameter {
    name: string;
    type: 'string' | 'number' | 'boolean';
    required: boolean;
    description: string;
    defaultValue?: string;
}

interface WebhookConfig {
    id: string;
    name: string;
    url: string;
    events: string[];
    secret: string;
    status: 'active' | 'inactive';
    retryCount: number;
    timeout: number;
    lastTriggered: string;
    successCount: number;
    failureCount: number;
}

interface ApiKey {
    id: string;
    name: string;
    key: string;
    permissions: string[];
    status: 'active' | 'expired' | 'revoked';
    createdAt: string;
    expiresAt?: string;
    lastUsed: string;
    usageCount: number;
}

export const ApiConfig = () => {
    const [activeTab, setActiveTab] = useState<'endpoints' | 'webhooks' | 'keys'>('endpoints');
    const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

    const apiEndpoints: ApiEndpoint[] = [
        {
            id: '1',
            name: 'Enviar Mensaje',
            url: '/api/messages/send',
            method: 'POST',
            description: 'Envía un mensaje a través del bot',
            status: 'active',
            lastCalled: '2024-01-26 10:30:00',
            callCount: 1247,
            authentication: 'api_key',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer YOUR_API_KEY'
            },
            parameters: [
                {
                    name: 'to',
                    type: 'string',
                    required: true,
                    description: 'Número de teléfono del destinatario'
                },
                {
                    name: 'message',
                    type: 'string',
                    required: true,
                    description: 'Contenido del mensaje'
                }
            ]
        },
        {
            id: '2',
            name: 'Obtener Contactos',
            url: '/api/contacts',
            method: 'GET',
            description: 'Lista todos los contactos',
            status: 'active',
            lastCalled: '2024-01-26 09:15:00',
            callCount: 342,
            authentication: 'api_key',
            headers: {
                'Authorization': 'Bearer YOUR_API_KEY'
            },
            parameters: [
                {
                    name: 'limit',
                    type: 'number',
                    required: false,
                    description: 'Número máximo de resultados',
                    defaultValue: '50'
                }
            ]
        }
    ];

    const webhooks: WebhookConfig[] = [
        {
            id: '1',
            name: 'Webhook de Mensajes',
            url: 'https://tu-app.com/webhook/whatsapp',
            events: ['message.received', 'message.sent', 'message.failed'],
            secret: 'wh_webhook_secret_123',
            status: 'active',
            retryCount: 3,
            timeout: 30000,
            lastTriggered: '2024-01-26 10:25:00',
            successCount: 892,
            failureCount: 12
        },
        {
            id: '2',
            name: 'Webhook de Estado',
            url: 'https://tu-app.com/webhook/status',
            events: ['connection.status', 'bot.status'],
            secret: 'status_webhook_secret_456',
            status: 'inactive',
            retryCount: 2,
            timeout: 15000,
            lastTriggered: '2024-01-25 18:30:00',
            successCount: 156,
            failureCount: 3
        }
    ];

    const apiKeys: ApiKey[] = [
        {
            id: '1',
            name: 'Clave Principal',
            key: 'wh_api_1234567890abcdef',
            permissions: ['messages:send', 'messages:read', 'contacts:read'],
            status: 'active',
            createdAt: '2024-01-10',
            lastUsed: '2024-01-26 10:30:00',
            usageCount: 1589
        },
        {
            id: '2',
            name: 'Clave de Solo Lectura',
            key: 'wh_read_0987654321fedcba',
            permissions: ['messages:read', 'contacts:read'],
            status: 'active',
            createdAt: '2024-01-15',
            lastUsed: '2024-01-26 09:45:00',
            usageCount: 234
        }
    ];

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'active': return <CheckCircle className="w-4 h-4 text-green-600" />;
            case 'inactive': return <XCircle className="w-4 h-4 text-gray-600" />;
            case 'error': return <AlertCircle className="w-4 h-4 text-red-600" />;
            case 'expired': return <Clock className="w-4 h-4 text-orange-600" />;
            case 'revoked': return <Shield className="w-4 h-4 text-red-600" />;
            default: return <AlertCircle className="w-4 h-4 text-gray-600" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'text-green-600 bg-green-100';
            case 'inactive': return 'text-gray-600 bg-gray-100';
            case 'error': return 'text-red-600 bg-red-100';
            case 'expired': return 'text-orange-600 bg-orange-100';
            case 'revoked': return 'text-red-600 bg-red-100';
            default: return 'text-gray-600 bg-gray-100';
        }
    };

    const getMethodColor = (method: string) => {
        switch (method) {
            case 'GET': return 'bg-blue-100 text-blue-600';
            case 'POST': return 'bg-green-100 text-green-600';
            case 'PUT': return 'bg-orange-100 text-orange-600';
            case 'DELETE': return 'bg-red-100 text-red-600';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    const toggleSecretVisibility = (id: string) => {
        setShowSecrets(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const regenerateKey = (id: string) => {
        // TODO: Implement key regeneration logic
        console.log('Regenerating key for:', id);
    };

    

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Configuración API</h1>
                    <p className="text-gray-600 mt-1">Gestiona endpoints, webhooks y claves de API</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        <TestTube className="w-4 h-4" />
                        Probar API
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-whatsapp-green text-white rounded-lg hover:bg-whatsapp-dark transition-colors">
                        <Plus className="w-4 h-4" />
                        Nuevo Endpoint
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Globe className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Endpoints</p>
                            <p className="text-xl font-bold text-gray-900">{apiEndpoints.length}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <Webhook className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Webhooks</p>
                            <p className="text-xl font-bold text-gray-900">{webhooks.length}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <Key className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">API Keys</p>
                            <p className="text-xl font-bold text-gray-900">{apiKeys.length}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                            <Activity className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Llamadas Hoy</p>
                            <p className="text-xl font-bold text-gray-900">
                                {apiEndpoints.reduce((acc, ep) => acc + ep.callCount, 0)}
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
                            onClick={() => setActiveTab('endpoints')}
                            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                                activeTab === 'endpoints'
                                    ? 'border-whatsapp-green text-whatsapp-green'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            Endpoints
                        </button>
                        <button
                            onClick={() => setActiveTab('webhooks')}
                            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                                activeTab === 'webhooks'
                                    ? 'border-whatsapp-green text-whatsapp-green'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            Webhooks
                        </button>
                        <button
                            onClick={() => setActiveTab('keys')}
                            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                                activeTab === 'keys'
                                    ? 'border-whatsapp-green text-whatsapp-green'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            API Keys
                        </button>
                    </div>
                </div>

                {/* Content */}
                {activeTab === 'endpoints' && (
                    <div className="divide-y divide-gray-200">
                        {apiEndpoints.map((endpoint) => (
                            <div key={endpoint.id} className="p-4">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="font-semibold text-gray-900">{endpoint.name}</h3>
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${getMethodColor(endpoint.method)}`}>
                                                {endpoint.method}
                                            </span>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(endpoint.status)}`}>
                                                {getStatusIcon(endpoint.status)}
                                                <span className="ml-1">{endpoint.status}</span>
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600 mb-2">{endpoint.description}</p>
                                        <code className="text-sm bg-gray-100 px-2 py-1 rounded">{endpoint.url}</code>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                                            <Copy className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                    <div>
                                        <span className="text-gray-600">Llamadas:</span>
                                        <span className="ml-2 font-medium">{endpoint.callCount}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Última llamada:</span>
                                        <span className="ml-2 font-medium">{endpoint.lastCalled}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Autenticación:</span>
                                        <span className="ml-2 font-medium">{endpoint.authentication}</span>
                                    </div>
                                </div>

                                {endpoint.parameters.length > 0 && (
                                    <div className="mt-3">
                                        <h4 className="text-sm font-medium text-gray-700 mb-2">Parámetros:</h4>
                                        <div className="space-y-1">
                                            {endpoint.parameters.map((param) => (
                                                <div key={param.name} className="flex items-center gap-2 text-sm">
                                                    <code className="bg-gray-100 px-2 py-0.5 rounded">{param.name}</code>
                                                    <span className="text-gray-600">({param.type})</span>
                                                    {param.required && <span className="text-red-600">*</span>}
                                                    <span className="text-gray-500">- {param.description}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'webhooks' && (
                    <div className="divide-y divide-gray-200">
                        {webhooks.map((webhook) => (
                            <div key={webhook.id} className="p-4">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="font-semibold text-gray-900">{webhook.name}</h3>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(webhook.status)}`}>
                                                {getStatusIcon(webhook.status)}
                                                <span className="ml-1">{webhook.status}</span>
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600 mb-2">URL: {webhook.url}</p>
                                        <div className="flex flex-wrap gap-2">
                                            {webhook.events.map((event) => (
                                                <span key={event} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                                                    {event}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                        <span className="text-gray-600">Secret:</span>
                                        <div className="flex items-center gap-1 mt-1">
                                            <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">
                                                {showSecrets[webhook.id] ? webhook.secret : '••••••••••••'}
                                            </code>
                                            <button
                                                onClick={() => toggleSecretVisibility(webhook.id)}
                                                className="text-gray-500 hover:text-gray-700"
                                            >
                                                {showSecrets[webhook.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Exitosos:</span>
                                        <span className="ml-2 font-medium text-green-600">{webhook.successCount}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Fallidos:</span>
                                        <span className="ml-2 font-medium text-red-600">{webhook.failureCount}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Último trigger:</span>
                                        <span className="ml-2 font-medium">{webhook.lastTriggered}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'keys' && (
                    <div className="divide-y divide-gray-200">
                        {apiKeys.map((apiKey) => (
                            <div key={apiKey.id} className="p-4">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="font-semibold text-gray-900">{apiKey.name}</h3>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(apiKey.status)}`}>
                                                {getStatusIcon(apiKey.status)}
                                                <span className="ml-1">{apiKey.status}</span>
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                                                {showSecrets[apiKey.id] ? apiKey.key : '••••••••••••••••••••'}
                                            </code>
                                            <button
                                                onClick={() => toggleSecretVisibility(apiKey.id)}
                                                className="text-gray-500 hover:text-gray-700"
                                            >
                                                {showSecrets[apiKey.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                            <button
                                                onClick={() => copyToClipboard(apiKey.key)}
                                                className="text-gray-500 hover:text-gray-700"
                                            >
                                                <Copy className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {apiKey.permissions.map((permission) => (
                                                <span key={permission} className="px-2 py-1 bg-blue-100 text-blue-600 rounded text-xs">
                                                    {permission}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => regenerateKey(apiKey.id)}
                                            className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                            title="Regenerar clave"
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                        </button>
                                        <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                        <span className="text-gray-600">Creada:</span>
                                        <span className="ml-2 font-medium">{apiKey.createdAt}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Último uso:</span>
                                        <span className="ml-2 font-medium">{apiKey.lastUsed}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Usos totales:</span>
                                        <span className="ml-2 font-medium">{apiKey.usageCount}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Expira:</span>
                                        <span className="ml-2 font-medium">
                                            {apiKey.expiresAt || 'Nunca'}
                                        </span>
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