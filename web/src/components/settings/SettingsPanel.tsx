/**
 * SettingsPanel - WhatsApp Web style settings panel
 */
import { useState, useRef } from 'react';
import { clsx } from 'clsx';
import {
    X,
    Search,
    Monitor,
    Key,
    Bell,
    Upload,
    Users,
    Database,
    Moon,
    Sun,
    Check,
    FileJson,
    Trash2,
    Plus,
    ChevronRight,
    Volume2,
    VolumeX,
    MessageSquare,
    Zap,
} from 'lucide-react';
import { useStore } from '../../store';
import { contactGroupApi } from '../../api/client';
import { GeminiConfigPanel } from './GeminiConfigPanel';
import { TriggerManagement } from './TriggerManagement';

type SettingsSection = 'general' | 'api' | 'notifications' | 'import' | 'groups' | 'data' | 'triggers';

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

// Storage keys
const STORAGE_KEYS = {
    THEME: 'app_theme',
    NOTIFICATIONS: 'app_notifications',
    SOUND: 'app_sound',
    GEMINI_KEY: 'gemini_api_key',
};

export const SettingsPanel = ({ isOpen, onClose }: SettingsPanelProps) => {
    const { contactGroups, setContactGroups } = useStore();
    const [activeSection, setActiveSection] = useState<SettingsSection | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Settings state
    const [theme, setTheme] = useState<'dark' | 'light'>(() => {
        return (localStorage.getItem(STORAGE_KEYS.THEME) as 'dark' | 'light') || 'dark';
    });
    const [notifications, setNotifications] = useState(() => {
        return localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) !== 'false';
    });
    const [sound, setSound] = useState(() => {
        return localStorage.getItem(STORAGE_KEYS.SOUND) !== 'false';
    });

    // Import state
    const [importedContacts, setImportedContacts] = useState<Array<{ name: string; phone: string }>>([]);
    const [importError, setImportError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Group creation state
    const [newGroupName, setNewGroupName] = useState('');
    const [selectedContactsForGroup, setSelectedContactsForGroup] = useState<Set<string>>(new Set());

    const sections: { id: SettingsSection; icon: any; label: string; description: string }[] = [
        { id: 'general', icon: Monitor, label: 'General', description: 'Tema, idioma y preferencias' },
        { id: 'api', icon: Key, label: 'API e IA', description: 'Configuración de Gemini y APIs' },
        { id: 'notifications', icon: Bell, label: 'Notificaciones', description: 'Sonidos y alertas' },
        { id: 'import', icon: Upload, label: 'Importar Contactos', description: 'Cargar contactos desde JSON' },
        { id: 'groups', icon: Users, label: 'Grupos de Contactos', description: 'Administrar grupos personalizados' },
        { id: 'triggers', icon: Zap, label: 'Triggers', description: 'Gestionar palabras clave de activación' },
        { id: 'data', icon: Database, label: 'Datos y Almacenamiento', description: 'Exportar y limpiar datos' },
    ];

    const filteredSections = sections.filter(s =>
        s.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Theme handler
    const handleThemeChange = (newTheme: 'dark' | 'light') => {
        setTheme(newTheme);
        localStorage.setItem(STORAGE_KEYS.THEME, newTheme);
        // Apply theme to document
        document.documentElement.classList.toggle('light-theme', newTheme === 'light');
    };

    // Notifications handler
    const handleNotificationsChange = (enabled: boolean) => {
        setNotifications(enabled);
        localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, String(enabled));
        if (enabled && 'Notification' in window) {
            Notification.requestPermission();
        }
    };

    // Sound handler
    const handleSoundChange = (enabled: boolean) => {
        setSound(enabled);
        localStorage.setItem(STORAGE_KEYS.SOUND, String(enabled));
    };

    // JSON Import handler
    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setImportError(null);
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const data = JSON.parse(content);

                // Validate structure
                if (Array.isArray(data)) {
                    const contacts = data.map((item: any) => ({
                        name: item.name || item.nombre || '',
                        phone: String(item.phone || item.telefono || item.number || item.numero || '').replace(/\D/g, ''),
                    })).filter(c => c.name && c.phone);

                    if (contacts.length === 0) {
                        setImportError('No se encontraron contactos válidos en el archivo');
                    } else {
                        setImportedContacts(contacts);
                    }
                } else {
                    setImportError('El archivo debe contener un array de contactos');
                }
            } catch (err) {
                setImportError('Error al parsear el archivo JSON');
            }
        };

        reader.onerror = () => {
            setImportError('Error al leer el archivo');
        };

        reader.readAsText(file);

        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Create group from imported contacts
    const handleCreateGroupFromImport = async () => {
        if (!newGroupName.trim() || selectedContactsForGroup.size === 0) return;

        const contacts = importedContacts
            .filter((_, index) => selectedContactsForGroup.has(String(index)))
            .map(c => ({
                jid: `${c.phone}@s.whatsapp.net`,
                name: c.name,
            }));

        try {
            const response = await contactGroupApi.createGroup({
                name: newGroupName.trim(),
                contacts,
            });

            if (response.data.success) {
                // Refresh groups
                const groupsResponse = await contactGroupApi.getGroups();
                if (groupsResponse.data.success) {
                    setContactGroups(groupsResponse.data.data || []);
                }
                setNewGroupName('');
                setSelectedContactsForGroup(new Set());
                setImportedContacts([]);
            }
        } catch (error) {
            console.error('Failed to create group:', error);
        }
    };

    // Delete group handler
    const handleDeleteGroup = async (groupId: string) => {
        if (!confirm('¿Estás seguro de eliminar este grupo?')) return;

        try {
            await contactGroupApi.deleteGroup(groupId);
            const response = await contactGroupApi.getGroups();
            if (response.data.success) {
                setContactGroups(response.data.data || []);
            }
        } catch (error) {
            console.error('Failed to delete group:', error);
        }
    };

    // Clear all data
    const handleClearAllData = () => {
        if (!confirm('¿Estás seguro? Esta acción eliminará todas las configuraciones guardadas.')) return;

        Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
        localStorage.removeItem('setup_wizard_data');
        window.location.reload();
    };

    // Export settings
    const handleExportSettings = () => {
        const settings = {
            theme,
            notifications,
            sound,
            exportDate: new Date().toISOString(),
        };
        const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'whatsapp-bot-settings.json';
        a.click();
        URL.revokeObjectURL(url);
    };

    if (!isOpen) return null;

    const renderSectionContent = () => {
        switch (activeSection) {
            case 'general':
                return (
                    <div className="p-4 space-y-6">
                        <h2 className="text-xl font-medium text-[#e9edef]">General</h2>

                        {/* Theme */}
                        <div className="space-y-3">
                            <label className="text-sm text-[#8696a0]">Tema de la aplicación</label>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => handleThemeChange('dark')}
                                    className={clsx(
                                        "flex-1 p-4 rounded-lg border-2 transition-colors flex flex-col items-center gap-2",
                                        theme === 'dark'
                                            ? "border-[#00a884] bg-[#00a884]/10"
                                            : "border-[#374248] hover:border-[#8696a0]"
                                    )}
                                >
                                    <Moon className="w-8 h-8 text-[#e9edef]" />
                                    <span className="text-sm text-[#e9edef]">Oscuro</span>
                                    {theme === 'dark' && <Check className="w-4 h-4 text-[#00a884]" />}
                                </button>
                                <button
                                    onClick={() => handleThemeChange('light')}
                                    className={clsx(
                                        "flex-1 p-4 rounded-lg border-2 transition-colors flex flex-col items-center gap-2",
                                        theme === 'light'
                                            ? "border-[#00a884] bg-[#00a884]/10"
                                            : "border-[#374248] hover:border-[#8696a0]"
                                    )}
                                >
                                    <Sun className="w-8 h-8 text-[#e9edef]" />
                                    <span className="text-sm text-[#e9edef]">Claro</span>
                                    {theme === 'light' && <Check className="w-4 h-4 text-[#00a884]" />}
                                </button>
                            </div>
                        </div>

                        {/* Language (placeholder) */}
                        <div className="space-y-3">
                            <label className="text-sm text-[#8696a0]">Idioma</label>
                            <select
                                className="w-full p-3 bg-[#2a3942] text-[#e9edef] rounded-lg border border-[#374248] focus:outline-none focus:border-[#00a884]"
                                defaultValue="es"
                            >
                                <option value="es">Español</option>
                                <option value="en">English</option>
                                <option value="pt">Português</option>
                            </select>
                        </div>
                    </div>
                );

            case 'api':
                return (
                    <div className="p-4">
                        <GeminiConfigPanel />
                    </div>
                );

            case 'triggers':
                return (
                    <div className="p-4">
                        <TriggerManagement />
                    </div>
                );

            case 'notifications':
                return (
                    <div className="p-4 space-y-6">
                        <h2 className="text-xl font-medium text-[#e9edef]">Notificaciones</h2>

                        {/* Desktop notifications */}
                        <div className="flex items-center justify-between p-4 bg-[#182229] rounded-lg">
                            <div className="flex items-center gap-3">
                                <Bell className="w-5 h-5 text-[#8696a0]" />
                                <div>
                                    <p className="text-sm text-[#e9edef]">Notificaciones de escritorio</p>
                                    <p className="text-xs text-[#8696a0]">Mostrar alertas de nuevos mensajes</p>
                                </div>
                            </div>
                            <button
                                onClick={() => handleNotificationsChange(!notifications)}
                                className={clsx(
                                    "w-12 h-6 rounded-full transition-colors relative",
                                    notifications ? "bg-[#00a884]" : "bg-[#374248]"
                                )}
                            >
                                <span
                                    className={clsx(
                                        "absolute top-1 w-4 h-4 bg-white rounded-full transition-transform",
                                        notifications ? "right-1" : "left-1"
                                    )}
                                />
                            </button>
                        </div>

                        {/* Sound */}
                        <div className="flex items-center justify-between p-4 bg-[#182229] rounded-lg">
                            <div className="flex items-center gap-3">
                                {sound ? <Volume2 className="w-5 h-5 text-[#8696a0]" /> : <VolumeX className="w-5 h-5 text-[#8696a0]" />}
                                <div>
                                    <p className="text-sm text-[#e9edef]">Sonidos</p>
                                    <p className="text-xs text-[#8696a0]">Reproducir sonido al recibir mensajes</p>
                                </div>
                            </div>
                            <button
                                onClick={() => handleSoundChange(!sound)}
                                className={clsx(
                                    "w-12 h-6 rounded-full transition-colors relative",
                                    sound ? "bg-[#00a884]" : "bg-[#374248]"
                                )}
                            >
                                <span
                                    className={clsx(
                                        "absolute top-1 w-4 h-4 bg-white rounded-full transition-transform",
                                        sound ? "right-1" : "left-1"
                                    )}
                                />
                            </button>
                        </div>

                        {/* Message preview */}
                        <div className="flex items-center justify-between p-4 bg-[#182229] rounded-lg">
                            <div className="flex items-center gap-3">
                                <MessageSquare className="w-5 h-5 text-[#8696a0]" />
                                <div>
                                    <p className="text-sm text-[#e9edef]">Vista previa del mensaje</p>
                                    <p className="text-xs text-[#8696a0]">Mostrar contenido en la notificación</p>
                                </div>
                            </div>
                            <button
                                className="w-12 h-6 rounded-full transition-colors relative bg-[#00a884]"
                            >
                                <span className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full" />
                            </button>
                        </div>
                    </div>
                );

            case 'import':
                return (
                    <div className="p-4 space-y-6">
                        <h2 className="text-xl font-medium text-[#e9edef]">Importar Contactos</h2>

                        {/* File upload */}
                        <div className="space-y-3">
                            <label className="text-sm text-[#8696a0]">Cargar archivo JSON</label>
                            <p className="text-xs text-[#8696a0]">
                                Formato esperado: <code className="bg-[#2a3942] px-1 rounded">[{`{"name": "...", "phone": "..."}`}]</code>
                            </p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".json"
                                onChange={handleFileImport}
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full p-4 border-2 border-dashed border-[#374248] rounded-lg hover:border-[#00a884] transition-colors flex flex-col items-center gap-2"
                            >
                                <FileJson className="w-8 h-8 text-[#8696a0]" />
                                <span className="text-sm text-[#e9edef]">Seleccionar archivo JSON</span>
                            </button>
                        </div>

                        {importError && (
                            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                                {importError}
                            </div>
                        )}

                        {/* Imported contacts preview */}
                        {importedContacts.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-[#e9edef]">
                                        {importedContacts.length} contactos encontrados
                                    </span>
                                    <button
                                        onClick={() => {
                                            const allSelected = importedContacts.every((_, i) => selectedContactsForGroup.has(String(i)));
                                            if (allSelected) {
                                                setSelectedContactsForGroup(new Set());
                                            } else {
                                                setSelectedContactsForGroup(new Set(importedContacts.map((_, i) => String(i))));
                                            }
                                        }}
                                        className="text-xs text-[#00a884] hover:underline"
                                    >
                                        {selectedContactsForGroup.size === importedContacts.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                                    </button>
                                </div>

                                <div className="max-h-48 overflow-y-auto space-y-1">
                                    {importedContacts.map((contact, index) => (
                                        <label
                                            key={index}
                                            className="flex items-center gap-3 p-2 hover:bg-[#2a3942] rounded cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedContactsForGroup.has(String(index))}
                                                onChange={(e) => {
                                                    const newSet = new Set(selectedContactsForGroup);
                                                    if (e.target.checked) {
                                                        newSet.add(String(index));
                                                    } else {
                                                        newSet.delete(String(index));
                                                    }
                                                    setSelectedContactsForGroup(newSet);
                                                }}
                                                className="w-4 h-4 rounded border-[#374248] text-[#00a884] focus:ring-[#00a884]"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-[#e9edef] truncate">{contact.name}</p>
                                                <p className="text-xs text-[#8696a0]">{contact.phone}</p>
                                            </div>
                                        </label>
                                    ))}
                                </div>

                                {/* Create group from selection */}
                                <div className="pt-3 border-t border-[#374248] space-y-3">
                                    <input
                                        type="text"
                                        value={newGroupName}
                                        onChange={(e) => setNewGroupName(e.target.value)}
                                        placeholder="Nombre del grupo..."
                                        className="w-full p-3 bg-[#2a3942] text-[#e9edef] rounded-lg border border-[#374248] focus:outline-none focus:border-[#00a884]"
                                    />
                                    <button
                                        onClick={handleCreateGroupFromImport}
                                        disabled={!newGroupName.trim() || selectedContactsForGroup.size === 0}
                                        className="w-full p-3 bg-[#00a884] text-white rounded-lg font-medium hover:bg-[#00906f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Crear grupo con {selectedContactsForGroup.size} contactos
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                );

            case 'groups':
                return (
                    <div className="p-4 space-y-6">
                        <h2 className="text-xl font-medium text-[#e9edef]">Grupos de Contactos</h2>

                        {contactGroups.length === 0 ? (
                            <div className="text-center py-8">
                                <Users className="w-12 h-12 text-[#8696a0] mx-auto mb-3" />
                                <p className="text-sm text-[#8696a0]">No hay grupos creados</p>
                                <p className="text-xs text-[#8696a0] mt-1">
                                    Importa contactos desde JSON para crear grupos
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {contactGroups.map((group) => (
                                    <div
                                        key={group.id}
                                        className="flex items-center justify-between p-3 bg-[#182229] rounded-lg"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-[#00a884] rounded-full flex items-center justify-center">
                                                <Users className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                                <p className="text-sm text-[#e9edef]">{group.name}</p>
                                                <p className="text-xs text-[#8696a0]">
                                                    {group.contacts.length} contactos
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteGroup(group.id)}
                                            className="p-2 text-red-400 hover:bg-red-500/20 rounded-full transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );

            case 'data':
                return (
                    <div className="p-4 space-y-6">
                        <h2 className="text-xl font-medium text-[#e9edef]">Datos y Almacenamiento</h2>

                        {/* Export settings */}
                        <button
                            onClick={handleExportSettings}
                            className="w-full p-4 bg-[#182229] rounded-lg flex items-center gap-3 hover:bg-[#2a3942] transition-colors"
                        >
                            <Database className="w-5 h-5 text-[#00a884]" />
                            <div className="flex-1 text-left">
                                <p className="text-sm text-[#e9edef]">Exportar configuración</p>
                                <p className="text-xs text-[#8696a0]">Descargar ajustes como JSON</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-[#8696a0]" />
                        </button>

                        {/* Clear all data */}
                        <button
                            onClick={handleClearAllData}
                            className="w-full p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3 hover:bg-red-500/20 transition-colors"
                        >
                            <Trash2 className="w-5 h-5 text-red-400" />
                            <div className="flex-1 text-left">
                                <p className="text-sm text-red-400">Eliminar todos los datos</p>
                                <p className="text-xs text-red-400/70">Esta acción no se puede deshacer</p>
                            </div>
                        </button>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="relative flex w-full max-w-2xl h-full bg-[#111b21] shadow-xl">
                {/* Sections list */}
                <div className={clsx(
                    "w-full md:w-80 flex flex-col border-r border-[#374248] transition-all",
                    activeSection ? "hidden md:flex" : "flex"
                )}>
                    {/* Header */}
                    <div className="h-14 px-4 flex items-center justify-between bg-[#202c33] flex-shrink-0">
                        <h1 className="text-xl font-medium text-white">Ajustes</h1>
                        <button
                            onClick={onClose}
                            className="p-2 text-[#aebac1] hover:bg-[#374248] rounded-full transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Search */}
                    <div className="px-3 py-2 bg-[#111b21]">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#8696a0]" />
                            <input
                                type="text"
                                placeholder="Buscar en los ajustes"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-[#202c33] text-[#d1d7db] placeholder-[#8696a0] border-none rounded-lg text-sm focus:outline-none"
                            />
                        </div>
                    </div>

                    {/* Sections */}
                    <div className="flex-1 overflow-y-auto">
                        {filteredSections.map((section) => (
                            <button
                                key={section.id}
                                onClick={() => setActiveSection(section.id)}
                                className={clsx(
                                    "w-full px-4 py-3 flex items-center gap-3 hover:bg-[#2a3942] transition-colors",
                                    activeSection === section.id && "bg-[#2a3942]"
                                )}
                            >
                                <div className="w-10 h-10 bg-[#374248] rounded-full flex items-center justify-center">
                                    <section.icon className="w-5 h-5 text-[#8696a0]" />
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="text-sm text-[#e9edef]">{section.label}</p>
                                    <p className="text-xs text-[#8696a0]">{section.description}</p>
                                </div>
                                <ChevronRight className="w-5 h-5 text-[#8696a0]" />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Section content */}
                <div className={clsx(
                    "flex-1 flex flex-col bg-[#0b141a]",
                    activeSection ? "flex" : "hidden md:flex"
                )}>
                    {activeSection ? (
                        <>
                            {/* Back button for mobile */}
                            <div className="md:hidden h-14 px-4 flex items-center bg-[#202c33]">
                                <button
                                    onClick={() => setActiveSection(null)}
                                    className="p-2 text-[#aebac1] hover:bg-[#374248] rounded-full transition-colors mr-2"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                                <span className="text-lg text-white">
                                    {sections.find(s => s.id === activeSection)?.label}
                                </span>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                {renderSectionContent()}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center">
                            <Monitor className="w-16 h-16 text-[#8696a0] mb-4" />
                            <p className="text-[#8696a0]">Ajustes</p>
                            <p className="text-sm text-[#8696a0] mt-1">
                                Selecciona una sección para configurar
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
