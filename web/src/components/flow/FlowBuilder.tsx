import { useState } from 'react';
import { 
    GitBranch, 
    MessageSquare, 
    Plus, 
    Trash2, 
    Edit2, 
    Play, 
    Pause,
    Settings,
    Save,
    ArrowRight,
    Circle,
    Square,
    Diamond
} from 'lucide-react';

interface FlowNode {
    id: string;
    type: 'message' | 'condition' | 'action' | 'ai_response';
    title: string;
    content: string;
    position: { x: number; y: number };
    connections: string[];
}

interface Flow {
    id: string;
    name: string;
    description: string;
    status: 'active' | 'inactive' | 'draft';
    nodes: FlowNode[];
    createdAt: string;
    lastModified: string;
}

export const FlowBuilder = () => {
    const [flows, setFlows] = useState<Flow[]>([
        {
            id: '1',
            name: 'Flujo de Bienvenida',
            description: 'Mensaje de bienvenida para nuevos contactos',
            status: 'active',
            nodes: [
                {
                    id: 'start',
                    type: 'message',
                    title: 'Mensaje Inicial',
                    content: '¡Hola! Bienvenido a nuestro servicio.',
                    position: { x: 100, y: 100 },
                    connections: ['condition1']
                },
                {
                    id: 'condition1',
                    type: 'condition',
                    title: '¿Necesita ayuda?',
                    content: 'El usuario necesita ayuda adicional',
                    position: { x: 300, y: 100 },
                    connections: ['ai_response1']
                },
                {
                    id: 'ai_response1',
                    type: 'ai_response',
                    title: 'Respuesta IA',
                    content: 'Respuesta generada por IA',
                    position: { x: 500, y: 100 },
                    connections: []
                }
            ],
            createdAt: '2024-01-20',
            lastModified: '2024-01-26 10:30'
        },
        {
            id: '2',
            name: 'Flujo de Ventas',
            description: 'Proceso automatizado de ventas',
            status: 'draft',
            nodes: [],
            createdAt: '2024-01-22',
            lastModified: '2024-01-25 15:45'
        }
    ]);

    const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    const getNodeIcon = (type: FlowNode['type']) => {
        switch (type) {
            case 'message': return <MessageSquare className="w-4 h-4" />;
            case 'condition': return <Diamond className="w-4 h-4" />;
            case 'action': return <Square className="w-4 h-4" />;
            case 'ai_response': return <Circle className="w-4 h-4" />;
            default: return <Circle className="w-4 h-4" />;
        }
    };

    const getNodeColor = (type: FlowNode['type']) => {
        switch (type) {
            case 'message': return 'bg-blue-100 text-blue-600 border-blue-300';
            case 'condition': return 'bg-yellow-100 text-yellow-600 border-yellow-300';
            case 'action': return 'bg-green-100 text-green-600 border-green-300';
            case 'ai_response': return 'bg-purple-100 text-purple-600 border-purple-300';
            default: return 'bg-gray-100 text-gray-600 border-gray-300';
        }
    };

    const getStatusColor = (status: Flow['status']) => {
        switch (status) {
            case 'active': return 'text-green-600 bg-green-100';
            case 'inactive': return 'text-gray-600 bg-gray-100';
            case 'draft': return 'text-orange-600 bg-orange-100';
            default: return 'text-gray-600 bg-gray-100';
        }
    };

    const getStatusText = (status: Flow['status']) => {
        switch (status) {
            case 'active': return 'Activo';
            case 'inactive': return 'Inactivo';
            case 'draft': return 'Borrador';
            default: return 'Desconocido';
        }
    };

    const toggleFlowStatus = (flowId: string) => {
        setFlows(flows.map(flow => 
            flow.id === flowId 
                ? { ...flow, status: flow.status === 'active' ? 'inactive' : 'active' }
                : flow
        ));
    };

    const deleteFlow = (flowId: string) => {
        if (confirm('¿Estás seguro de eliminar este flujo?')) {
            setFlows(flows.filter(flow => flow.id !== flowId));
        }
    };

    const createNewFlow = () => {
        const newFlow: Flow = {
            id: Date.now().toString(),
            name: 'Nuevo Flujo',
            description: 'Descripción del nuevo flujo',
            status: 'draft',
            nodes: [],
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString()
        };
        setFlows([...flows, newFlow]);
        setSelectedFlow(newFlow);
        setIsEditing(true);
    };

    return (
        <div className="p-6 h-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Constructor de Flujos</h1>
                    <p className="text-gray-600 mt-1">Diseña y gestiona tus flujos de conversación automatizados</p>
                </div>
                <button
                    onClick={createNewFlow}
                    className="flex items-center gap-2 px-4 py-2 bg-whatsapp-green text-white rounded-lg hover:bg-whatsapp-dark transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Nuevo Flujo
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                {/* Flow List */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-lg border border-gray-200 h-full">
                        <div className="p-4 border-b border-gray-200">
                            <h2 className="font-semibold text-gray-900">Flujos Disponibles</h2>
                        </div>
                        <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                            {flows.map((flow) => (
                                <div
                                    key={flow.id}
                                    className={`p-4 cursor-pointer transition-colors ${
                                        selectedFlow?.id === flow.id ? 'bg-whatsapp-green/10' : 'hover:bg-gray-50'
                                    }`}
                                    onClick={() => setSelectedFlow(flow)}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <h3 className="font-medium text-gray-900">{flow.name}</h3>
                                            <p className="text-sm text-gray-600">{flow.description}</p>
                                        </div>
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(flow.status)}`}>
                                            {getStatusText(flow.status)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4 text-xs text-gray-500">
                                            <span>{flow.nodes.length} nodos</span>
                                            <span>Modificado: {flow.lastModified.split('T')[0]}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleFlowStatus(flow.id);
                                                }}
                                                className={`p-1 rounded transition-colors ${
                                                    flow.status === 'active' 
                                                        ? 'text-orange-600 hover:bg-orange-50' 
                                                        : 'text-green-600 hover:bg-green-50'
                                                }`}
                                            >
                                                {flow.status === 'active' ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteFlow(flow.id);
                                                }}
                                                className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Flow Editor */}
                <div className="lg:col-span-2">
                    {selectedFlow ? (
                        <div className="bg-white rounded-lg border border-gray-200 h-full">
                            <div className="p-4 border-b border-gray-200">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="font-semibold text-gray-900">{selectedFlow.name}</h2>
                                        <p className="text-sm text-gray-600">{selectedFlow.description}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setIsEditing(!isEditing)}
                                            className={`p-2 rounded-lg transition-colors ${
                                                isEditing 
                                                    ? 'bg-whatsapp-green text-white' 
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                        >
                                            {isEditing ? <Save className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                                        </button>
                                        <button className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                                            <Settings className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6">
                                {selectedFlow.nodes.length > 0 ? (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                                            <GitBranch className="w-4 h-4" />
                                            <span>Nodos del flujo</span>
                                        </div>
                                        {selectedFlow.nodes.map((node) => (
                                            <div key={node.id} className="flex items-center gap-4">
                                                <div className={`p-3 rounded-lg border ${getNodeColor(node.type)}`}>
                                                    {getNodeIcon(node.type)}
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="font-medium text-gray-900">{node.title}</h4>
                                                    <p className="text-sm text-gray-600">{node.content}</p>
                                                </div>
                                                {node.connections.length > 0 && (
                                                    <ArrowRight className="w-5 h-5 text-gray-400" />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12">
                                        <GitBranch className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                        <h3 className="text-lg font-medium text-gray-900 mb-2">Flujo vacío</h3>
                                        <p className="text-gray-600 mb-4">Comienza a añadir nodos para crear tu flujo de conversación</p>
                                        <button className="px-4 py-2 bg-whatsapp-green text-white rounded-lg hover:bg-whatsapp-dark transition-colors">
                                            Añadir Primer Nodo
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-lg border border-gray-200 h-full flex items-center justify-center">
                            <div className="text-center">
                                <GitBranch className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">Selecciona un flujo</h3>
                                <p className="text-gray-600">Elige un flujo de la lista para comenzar a editarlo</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};