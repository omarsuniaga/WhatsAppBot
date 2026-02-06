/**
 * AdminLayout - Main layout wrapper for the Admin Panel
 * Provides sidebar navigation and content area with dark/light mode support
 */

import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, BookOpen, Ticket, Send, Settings,
    MessageSquare, ArrowLeft, Menu, X, Sun, Moon,
    GraduationCap, Users, DoorOpen, Calendar, BookMarked, Bell, LogOut,
    ShieldAlert
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

interface AdminLayoutProps {
    onBack?: () => void;
}

export const AdminLayout = ({ onBack }: AdminLayoutProps) => {
    const location = useLocation();
    const { theme, toggleTheme } = useTheme();
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (!mobile) setSidebarOpen(false);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleNavClick = () => {
        if (isMobile) setSidebarOpen(false);
    };

    const menuItems = [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/whatsapp/chats', label: 'Gestión WhatsApp', icon: MessageSquare },
        { path: '/knowledge', label: 'Base de Conocimiento', icon: BookOpen },
        { path: '/tickets', label: 'Tickets de Soporte', icon: Ticket },
        { path: '/broadcast', label: 'Difusión Masiva', icon: Send },
        { path: '/settings', label: 'Configuración', icon: Settings },
    ];

    const institutionalItems = [
        { path: '/students', label: 'Alumnos', icon: GraduationCap },
        { path: '/teachers', label: 'Profesores', icon: Users },
        { path: '/classes', label: 'Clases', icon: BookMarked },
        { path: '/rooms', label: 'Salones', icon: DoorOpen },
        { path: '/schedule', label: 'Horarios', icon: Calendar },
        { path: '/attendance/control', label: 'Control Asistencias', icon: ShieldAlert },
    ];

    const automationItems = [
        { path: '/automations/alerts', label: 'Alertas de Asistencia', icon: Bell },
    ];

    const isActiveRoute = (path: string) => {
        if (path === '/whatsapp/chats') {
            return location.pathname.startsWith('/whatsapp');
        }
        return location.pathname === path;
    };

    return (
        <div className="h-screen flex flex-col md:flex-row bg-gray-100 dark:bg-gray-900 transition-colors">
            {/* Mobile Header */}
            {isMobile && (
                <div className="h-14 bg-white dark:bg-gray-800 border-b dark:border-gray-700 flex items-center justify-between px-4 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        {onBack && (
                            <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                                <ArrowLeft className="w-5 h-5 dark:text-gray-200" />
                            </button>
                        )}
                        <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">Admin Panel</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleTheme}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
                        >
                            {theme === 'dark' ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-gray-600" />}
                        </button>
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                        >
                            {sidebarOpen ? <X className="w-5 h-5 dark:text-gray-200" /> : <Menu className="w-5 h-5 dark:text-gray-200" />}
                        </button>
                    </div>
                </div>
            )}

            {/* Sidebar */}
            <div className={`
                ${isMobile
                    ? `fixed inset-0 z-50 ${sidebarOpen ? 'block' : 'hidden'}`
                    : 'w-64 flex-shrink-0'
                }
            `}>
                {/* Overlay for mobile */}
                {isMobile && sidebarOpen && (
                    <div
                        className="absolute inset-0 bg-black/50"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* Sidebar Content */}
                <div className={`
                    ${isMobile
                        ? 'absolute left-0 top-0 h-full w-72 bg-white dark:bg-gray-800 shadow-xl'
                        : 'h-full bg-white dark:bg-gray-800 border-r dark:border-gray-700'
                    }
                    flex flex-col transition-colors
                `}>
                    {/* Header */}
                    <div className="p-4 border-b dark:border-gray-700">
                        <div className="flex items-center gap-2">
                            {!isMobile && onBack && (
                                <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                                    <ArrowLeft className="w-5 h-5 dark:text-gray-200" />
                                </button>
                            )}
                            {isMobile && (
                                <button onClick={() => setSidebarOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                                    <X className="w-5 h-5 dark:text-gray-200" />
                                </button>
                            )}
                            <div className="flex-1">
                                <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">Admin Panel</h1>
                                <p className="text-xs text-gray-500 dark:text-gray-400">WhatsApp Bot Manager</p>
                            </div>
                            {/* Theme Toggle - Desktop */}
                            {!isMobile && (
                                <button
                                    onClick={toggleTheme}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                    title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
                                >
                                    {theme === 'dark' ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-gray-600" />}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 p-4 overflow-y-auto">
                        <ul className="space-y-1">
                            {menuItems.map(item => (
                                <li key={item.path}>
                                    <NavLink
                                        to={item.path}
                                        onClick={handleNavClick}
                                        className={`w-full flex items-center justify-between px-3 py-3 rounded-lg transition-colors ${isActiveRoute(item.path)
                                            ? 'bg-whatsapp-green text-white'
                                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <item.icon className="w-5 h-5" />
                                            <span className="text-sm font-medium">{item.label}</span>
                                        </div>
                                    </NavLink>
                                </li>
                            ))}
                        </ul>

                        {/* Institutional Section */}
                        <div className="mt-6">
                            <h3 className="px-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                                Gestión Institucional
                            </h3>
                            <ul className="space-y-1">
                                {institutionalItems.map(item => (
                                    <li key={item.path}>
                                        <NavLink
                                            to={item.path}
                                            onClick={handleNavClick}
                                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${location.pathname === item.path
                                                ? 'bg-blue-500 text-white'
                                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <item.icon className="w-5 h-5" />
                                                <span className="text-sm font-medium">{item.label}</span>
                                            </div>
                                        </NavLink>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Automations Section */}
                        <div className="mt-6">
                            <h3 className="px-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                                Automatizaciones
                            </h3>
                            <ul className="space-y-1">
                                {automationItems.map(item => (
                                    <li key={item.path}>
                                        <NavLink
                                            to={item.path}
                                            onClick={handleNavClick}
                                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${location.pathname === item.path
                                                ? 'bg-orange-500 text-white'
                                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <item.icon className="w-5 h-5" />
                                                <span className="text-sm font-medium">{item.label}</span>
                                            </div>
                                        </NavLink>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </nav>

                    {/* Footer */}
                    <div className="p-4 border-t dark:border-gray-700 space-y-3">
                        {/* User Info */}
                        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Usuario</p>
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                                {useAuth().currentUser?.email || 'Usuario'}
                            </p>
                        </div>

                        {/* Logout Button */}
                        <button
                            onClick={() => {
                                if (window.confirm('¿Estás seguro de cerrar sesión?')) {
                                    useAuth().logout();
                                }
                            }}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all"
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="text-sm font-medium">Cerrar Sesión</span>
                        </button>

                        <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                            WhatsApp Bot v1.0
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden bg-gray-100 dark:bg-gray-900 transition-colors">
                <Outlet />
            </div>
        </div>
    );
};
