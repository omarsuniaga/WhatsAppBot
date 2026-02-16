/**
 * Sidebar - WhatsApp Web style navigation sidebar
 */
import { clsx } from 'clsx';
import {
    MessageSquare,
    Phone,
    CircleDot,
    Users,
    Settings,
    LogOut,
    LayoutDashboard,
    Bell
} from 'lucide-react';
import { statusApi } from '../../api/client';
import { GlobalBotSwitch } from '../bot';

type SidebarTab = 'chats' | 'calls' | 'status' | 'groups' | 'admin';

interface SidebarProps {
    activeTab: SidebarTab;
    onTabChange: (tab: SidebarTab) => void;
    onOpenAdmin?: () => void;
    onOpenSettings?: () => void;
    onOpenAlerts?: () => void;
    alertCount?: number;
}

export const Sidebar = ({ activeTab, onTabChange, onOpenAdmin, onOpenSettings, onOpenAlerts, alertCount = 0 }: SidebarProps) => {
    const handleLogout = async () => {
        if (confirm('¿Deseas cerrar sesión? Tendrás que escanear el QR nuevamente.')) {
            try {
                await statusApi.logout();
            } catch (error) {
                console.error('Logout error:', error);
            }
        }
    };

    const navItems: { id: SidebarTab; icon: any; label: string; onClick?: () => void }[] = [
        { id: 'chats', icon: MessageSquare, label: 'Chats' },
        { id: 'calls', icon: Phone, label: 'Llamadas' },
        { id: 'status', icon: CircleDot, label: 'Estados' },
        { id: 'groups', icon: Users, label: 'Comunidades' },
    ];

    return (
        <div className="w-[68px] bg-[#202c33] flex flex-col items-center py-3 flex-shrink-0">
            {/* Navigation items */}
            <div className="flex-1 flex flex-col items-center gap-1">
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => item.onClick ? item.onClick() : onTabChange(item.id)}
                        className={clsx(
                            'w-12 h-12 rounded-full flex items-center justify-center transition-colors relative group',
                            activeTab === item.id
                                ? 'bg-[#2a3942] text-white'
                                : 'text-[#aebac1] hover:bg-[#2a3942]'
                        )}
                        title={item.label}
                    >
                        <item.icon className="w-6 h-6" />
                        {/* Tooltip */}
                        <span className="absolute left-full ml-2 px-2 py-1 bg-[#3b4a54] text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                            {item.label}
                        </span>
                    </button>
                ))}
            </div>

            {/* Bottom items */}
            <div className="flex flex-col items-center gap-1 mt-auto">
                {/* Admin button */}
                {onOpenAdmin && (
                    <button
                        onClick={onOpenAdmin}
                        className="w-12 h-12 rounded-full flex items-center justify-center text-[#aebac1] hover:bg-[#2a3942] transition-colors relative group"
                        title="Panel de Administración"
                    >
                        <LayoutDashboard className="w-6 h-6" />
                        <span className="absolute left-full ml-2 px-2 py-1 bg-[#3b4a54] text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                            Admin
                        </span>
                    </button>
                )}

                {/* Alerts button */}
                {onOpenAlerts && (
                    <button
                        onClick={onOpenAlerts}
                        className="w-12 h-12 rounded-full flex items-center justify-center text-[#aebac1] hover:bg-[#2a3942] transition-colors relative group"
                        title="Alertas Pendientes"
                    >
                        <Bell className="w-6 h-6" />
                        {alertCount > 0 && (
                            <span className="absolute top-1 right-1 w-5 h-5 bg-[#00a884] text-white text-xs font-bold rounded-full flex items-center justify-center">
                                {alertCount > 9 ? '9+' : alertCount}
                            </span>
                        )}
                        <span className="absolute left-full ml-2 px-2 py-1 bg-[#3b4a54] text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                            Alertas {alertCount > 0 ? `(${alertCount})` : ''}
                        </span>
                    </button>
                )}

                {/* Global Bot Switch */}
                <div className="my-2">
                    <GlobalBotSwitch />
                </div>

                {/* Settings */}
                <button
                    onClick={onOpenSettings}
                    className="w-12 h-12 rounded-full flex items-center justify-center text-[#aebac1] hover:bg-[#2a3942] transition-colors relative group"
                    title="Configuración"
                >
                    <Settings className="w-6 h-6" />
                    <span className="absolute left-full ml-2 px-2 py-1 bg-[#3b4a54] text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                        Configuración
                    </span>
                </button>

                {/* Logout */}
                <button
                    onClick={handleLogout}
                    className="w-12 h-12 rounded-full flex items-center justify-center text-[#aebac1] hover:bg-[#2a3942] transition-colors relative group"
                    title="Cerrar sesión"
                >
                    <LogOut className="w-6 h-6" />
                    <span className="absolute left-full ml-2 px-2 py-1 bg-[#3b4a54] text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                        Cerrar sesión
                    </span>
                </button>
            </div>
        </div>
    );
};
