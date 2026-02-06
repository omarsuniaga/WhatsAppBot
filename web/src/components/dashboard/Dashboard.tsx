import { useState } from 'react';
import { 
    Bot, 
    MessageSquare, 
    BarChart3, 
    Users, 
    Settings, 
    Clock,
    Webhook,
    Menu,
    X
} from 'lucide-react';

type NavigationItem = {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    component: React.ComponentType;
};

const navigationItems: NavigationItem[] = [
    { id: 'chat', label: 'Chat', icon: MessageSquare, component: () => <div>Chat Component</div> },
    { id: 'bots', label: 'Bots', icon: Bot, component: () => <div>Bot Management</div> },
    { id: 'flow', label: 'Flujo', icon: MessageSquare, component: () => <div>Flow Builder</div> },
    { id: 'analytics', label: 'Análisis', icon: BarChart3, component: () => <div>Analytics</div> },
    { id: 'contacts', label: 'Contactos', icon: Users, component: () => <div>Contact Manager</div> },
    { id: 'scheduler', label: 'Programador', icon: Clock, component: () => <div>Message Scheduler</div> },
    { id: 'api', label: 'API', icon: Webhook, component: () => <div>API Config</div> },
    { id: 'settings', label: 'Configuración', icon: Settings, component: () => <div>Configuración</div> },
];

export const Dashboard = () => {
    const [activeTab, setActiveTab] = useState('chat');
    const [sidebarOpen, setSidebarOpen] = useState(true);

    const ActiveComponent = navigationItems.find(item => item.id === activeTab)?.component || (() => <div>Chat</div>);

    return (
        <div className="h-screen flex bg-gray-50">
            {/* Sidebar */}
            <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-gray-200 transition-all duration-300 flex flex-col`}>
                {/* Header */}
                <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <div className={`flex items-center gap-3 ${!sidebarOpen && 'justify-center'}`}>
                            <div className="w-8 h-8 bg-whatsapp-green rounded-lg flex items-center justify-center">
                                <Bot className="w-5 h-5 text-white" />
                            </div>
                            {sidebarOpen && (
                                <div>
                                    <h1 className="font-bold text-gray-900">WhatsApp Bot</h1>
                                    <p className="text-xs text-gray-500">Panel de Control</p>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-2">
                    <ul className="space-y-1">
                        {navigationItems.map((item) => {
                            const Icon = item.icon;
                            return (
                                <li key={item.id}>
                                    <button
                                        onClick={() => setActiveTab(item.id)}
                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                                            activeTab === item.id
                                                ? 'bg-whatsapp-green text-white'
                                                : 'text-gray-700 hover:bg-gray-100'
                                        }`}
                                    >
                                        <Icon className="w-5 h-5 flex-shrink-0" />
                                        {sidebarOpen && (
                                            <span className="text-sm font-medium">{item.label}</span>
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-xs text-gray-600">Conectado</span>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col">
                <ActiveComponent />
            </div>
        </div>
    );
};