import { useState } from 'react';
import { 
    Users, 
    UserPlus, 
    Search, 
    Filter,
    MoreVertical,
    MessageSquare,
    Tag,
    Star,
    Ban,
    Edit2,
    Trash2,
    Download,
    Upload
} from 'lucide-react';

interface Contact {
    id: string;
    name: string;
    phone: string;
    email?: string;
    avatar?: string;
    status: 'active' | 'inactive' | 'blocked';
    lastMessage: string;
    lastActivity: string;
    totalMessages: number;
    tags: string[];
    isFavorite: boolean;
    notes?: string;
}

interface Group {
    id: string;
    name: string;
    description: string;
    memberCount: number;
    isBroadcast: boolean;
    createdAt: string;
    lastActivity: string;
    members: string[];
}

export const ContactManager = () => {
    const [activeTab, setActiveTab] = useState<'contacts' | 'groups'>('contacts');
    const [searchTerm, setSearchTerm] = useState('');


    const contacts: Contact[] = [
        {
            id: '1',
            name: 'Juan Pérez',
            phone: '+5491123456789',
            email: 'juan.perez@email.com',
            status: 'active',
            lastMessage: 'Hola, necesito información sobre productos',
            lastActivity: '2024-01-26 10:30',
            totalMessages: 24,
            tags: ['cliente', 'vip'],
            isFavorite: true,
            notes: 'Cliente interesado en productos premium'
        },
        {
            id: '2',
            name: 'María García',
            phone: '+5491134567890',
            status: 'active',
            lastMessage: 'Gracias por la ayuda',
            lastActivity: '2024-01-26 09:15',
            totalMessages: 12,
            tags: ['nuevo'],
            isFavorite: false
        },
        {
            id: '3',
            name: 'Carlos Rodríguez',
            phone: '+5491145678901',
            email: 'carlos.r@email.com',
            status: 'blocked',
            lastMessage: 'Mensaje spam',
            lastActivity: '2024-01-24 14:20',
            totalMessages: 3,
            tags: ['spam'],
            isFavorite: false
        }
    ];

    const groups: Group[] = [
        {
            id: '1',
            name: 'Clientes VIP',
            description: 'Clientes premium y frecuentes',
            memberCount: 45,
            isBroadcast: false,
            createdAt: '2024-01-10',
            lastActivity: '2024-01-26 11:00',
            members: ['1', '2', '3']
        },
        {
            id: '2',
            name: 'Newsletter',
            description: 'Lista de difusión de promociones',
            memberCount: 234,
            isBroadcast: true,
            createdAt: '2024-01-05',
            lastActivity: '2024-01-25 16:30',
            members: ['1', '2']
        }
    ];

    const getStatusColor = (status: Contact['status']) => {
        switch (status) {
            case 'active': return 'text-green-600 bg-green-100';
            case 'inactive': return 'text-gray-600 bg-gray-100';
            case 'blocked': return 'text-red-600 bg-red-100';
            default: return 'text-gray-600 bg-gray-100';
        }
    };

    const getStatusText = (status: Contact['status']) => {
        switch (status) {
            case 'active': return 'Activo';
            case 'inactive': return 'Inactivo';
            case 'blocked': return 'Bloqueado';
            default: return 'Desconocido';
        }
    };

    const filteredContacts = contacts.filter(contact =>
        contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.phone.includes(searchTerm) ||
        contact.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const filteredGroups = groups.filter(group =>
        group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        group.description.toLowerCase().includes(searchTerm.toLowerCase())
    );



    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Gestión de Contactos</h1>
                    <p className="text-gray-600 mt-1">Administra tus contactos y grupos de WhatsApp</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        <Upload className="w-4 h-4" />
                        Importar
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        <Download className="w-4 h-4" />
                        Exportar
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-whatsapp-green text-white rounded-lg hover:bg-whatsapp-dark transition-colors">
                        <UserPlus className="w-4 h-4" />
                        Nuevo Contacto
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Users className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Total Contactos</p>
                            <p className="text-xl font-bold text-gray-900">{contacts.length}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <MessageSquare className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Activos</p>
                            <p className="text-xl font-bold text-gray-900">
                                {contacts.filter(c => c.status === 'active').length}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <Star className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Favoritos</p>
                            <p className="text-xl font-bold text-gray-900">
                                {contacts.filter(c => c.isFavorite).length}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                            <Tag className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Grupos</p>
                            <p className="text-xl font-bold text-gray-900">{groups.length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-lg border border-gray-200">
                <div className="border-b border-gray-200">
                    <div className="flex">
                        <button
                            onClick={() => setActiveTab('contacts')}
                            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                                activeTab === 'contacts'
                                    ? 'border-whatsapp-green text-whatsapp-green'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            Contactos
                        </button>
                        <button
                            onClick={() => setActiveTab('groups')}
                            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                                activeTab === 'groups'
                                    ? 'border-whatsapp-green text-whatsapp-green'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            Grupos
                        </button>
                    </div>
                </div>

                {/* Search and Filter */}
                <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center gap-4">
                        <div className="flex-1 relative">
                            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                            <input
                                type="text"
                                placeholder={`Buscar ${activeTab === 'contacts' ? 'contactos' : 'grupos'}...`}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent"
                            />
                        </div>
                        <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                            <Filter className="w-4 h-4" />
                            Filtros
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                    {activeTab === 'contacts' ? (
                        <>
                            {filteredContacts.map((contact) => (
                                <div key={contact.id} className="p-4 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="relative">
                                                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                                                    <Users className="w-6 h-6 text-gray-500" />
                                                </div>
                                                <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                                                    contact.status === 'active' ? 'bg-green-500' :
                                                    contact.status === 'inactive' ? 'bg-gray-400' : 'bg-red-500'
                                                }`} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold text-gray-900">{contact.name}</h3>
                                                    {contact.isFavorite && <Star className="w-4 h-4 text-yellow-500 fill-current" />}
                                                </div>
                                                <p className="text-sm text-gray-600">{contact.phone}</p>
                                                <p className="text-xs text-gray-500 mt-1">{contact.lastMessage}</p>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(contact.status)}`}>
                                                        {getStatusText(contact.status)}
                                                    </span>
                                                    {contact.tags.map((tag) => (
                                                        <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm text-gray-500">{contact.lastActivity}</p>
                                            <p className="text-xs text-gray-400 mt-1">{contact.totalMessages} mensajes</p>
                                            <div className="flex items-center gap-1 mt-2">
                                                <button className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors">
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    className="p-1 text-yellow-600 hover:bg-yellow-50 rounded transition-colors"
                                                >
                                                    <Star className={`w-4 h-4 ${contact.isFavorite ? 'fill-current' : ''}`} />
                                                </button>
                                                <button className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors">
                                                    <Ban className="w-4 h-4" />
                                                </button>
                                                <button
                                                    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </>
                    ) : (
                        <>
                            {filteredGroups.map((group) => (
                                <div key={group.id} className="p-4 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-whatsapp-green/10 rounded-lg flex items-center justify-center">
                                                <Users className="w-6 h-6 text-whatsapp-green" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold text-gray-900">{group.name}</h3>
                                                    {group.isBroadcast && (
                                                        <span className="px-2 py-1 bg-blue-100 text-blue-600 rounded-full text-xs font-medium">
                                                            Difusión
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-gray-600">{group.description}</p>
                                                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                                    <span>{group.memberCount} miembros</span>
                                                    <span>Creado: {group.createdAt}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm text-gray-500">{group.lastActivity}</p>
                                            <div className="flex items-center gap-1 mt-2">
                                                <button className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors">
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button className="p-1 text-gray-600 hover:bg-gray-50 rounded transition-colors">
                                                    <MoreVertical className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};