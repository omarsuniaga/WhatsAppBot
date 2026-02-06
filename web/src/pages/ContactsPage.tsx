/**
 * ContactsPage - Manage contacts (guardians/representatives)
 */

import { useState, useEffect } from 'react';
import { 
    UserCheck, Plus, Edit2, Trash2, RefreshCw, 
    Phone, Search, AlertCircle, User, Users
} from 'lucide-react';

interface Contact {
    id: string;
    firstName: string;
    lastName: string;
    displayName?: string;
    phones: string[];
    preferredPhone?: string; // Added preferredPhone property
    email?: string;
    type?: string;
    status?: string;
    studentIds?: string[];
    studentName?: string; // For UI display
    notes?: string;
    tags?: string[];
    createdAt?: string;
}

const API_BASE = 'http://localhost:3001/api/admin';

export const ContactsPage = () => {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingContact, setEditingContact] = useState<Contact | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const getAdminKey = () => localStorage.getItem('ADMIN_API_KEY') || 'dev-admin-key-123';

    useEffect(() => {
        loadContacts();
    }, []);

    const loadContacts = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE}/contacts`, {
                headers: { 'x-admin-api-key': getAdminKey() }
            });
            const data = await response.json();
            if (data.success) {
                setContacts(data.data || []);
            } else {
                throw new Error(data.error);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const saveContact = async (contact: Partial<Contact>) => {
        try {
            const isNew = !contact.id;
            const url = isNew ? `${API_BASE}/contacts` : `${API_BASE}/contacts/${contact.id}`;
            const method = isNew ? 'POST' : 'PUT';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-api-key': getAdminKey()
                },
                body: JSON.stringify(contact)
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            await loadContacts();
            setEditingContact(null);
            setIsCreating(false);
        } catch (err: any) {
            alert('Error: ' + err.message);
        }
    };

    const deleteContact = async (id: string) => {
        if (!confirm('¿Eliminar este contacto?')) return;

        try {
            const response = await fetch(`${API_BASE}/contacts/${id}`, {
                method: 'DELETE',
                headers: { 'x-admin-api-key': getAdminKey() }
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error);
            }

            await loadContacts();
        } catch (err: any) {
            alert('Error: ' + err.message);
        }
    };

    const filteredContacts = contacts.filter(c => {
        const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
        const search = searchTerm.toLowerCase();
        return fullName.includes(search) ||
            c.phones?.some(p => p.includes(searchTerm)) ||
            c.studentName?.toLowerCase().includes(search);
    });

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <UserCheck className="w-6 h-6 text-indigo-500" />
                        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                            Contactos
                        </h1>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            ({contacts.length})
                        </span>
                    </div>
                    <button
                        onClick={() => { 
                            setIsCreating(true); 
                            setEditingContact({ id: '', firstName: '', lastName: '', phones: [] }); 
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Nuevo Contacto
                    </button>
                </div>

                {/* Search */}
                <div className="relative mb-6">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o teléfono..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
                        <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                            <AlertCircle className="w-5 h-5" />
                            <span>{error}</span>
                        </div>
                    </div>
                )}

                {/* Loading */}
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
                    </div>
                ) : (
                    <>
                        {/* Contacts Grid */}
                        {filteredContacts.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {filteredContacts.map((contact) => (
                                    <div 
                                        key={contact.id}
                                        className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4"
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                                                    <User className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-gray-800 dark:text-gray-200">
                                                        {contact.firstName} {contact.lastName}
                                                    </h3>
                                                    {contact.type && (
                                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                                            {contact.type === 'guardian' ? 'Representante' : contact.type}
                                                        </span>
                                                    )}
                                                    {contact.studentName && (
                                                        <span className="text-xs text-indigo-500 dark:text-indigo-400 block">
                                                            Alumno: {contact.studentName}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => setEditingContact(contact)}
                                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                                    title="Editar"
                                                >
                                                    <Edit2 className="w-4 h-4 text-blue-500" />
                                                </button>
                                                <button
                                                    onClick={() => deleteContact(contact.id)}
                                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="w-4 h-4 text-red-500" />
                                                </button>
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-1 mt-3">
                                            {contact.phones.map((phone, i) => (
                                                <div 
                                                    key={i}
                                                    className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
                                                >
                                                    <Phone className="w-3 h-3" />
                                                    <span>{phone}</span>
                                                    {phone === contact.preferredPhone && (
                                                        <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 rounded">
                                                            principal
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        {contact.notes && (
                                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2 line-clamp-2">
                                                {contact.notes}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-8 text-center">
                                <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-1">
                                    No hay contactos
                                </h3>
                                <p className="text-gray-500 dark:text-gray-400">
                                    Agrega contactos para enviar notificaciones a los representantes.
                                </p>
                            </div>
                        )}
                    </>
                )}

                {/* Edit Modal */}
                {editingContact && (
                    <ContactEditModal
                        contact={editingContact}
                        isNew={isCreating}
                        onSave={saveContact}
                        onClose={() => { setEditingContact(null); setIsCreating(false); }}
                    />
                )}
            </div>
        </div>
    );
};

const ContactEditModal = ({
    contact,
    isNew,
    onSave,
    onClose
}: {
    contact: Contact;
    isNew: boolean;
    onSave: (c: Partial<Contact>) => void;
    onClose: () => void;
}) => {
    const [firstName, setFirstName] = useState(contact.firstName);
    const [lastName, setLastName] = useState(contact.lastName);
    const [phonesText, setPhonesText] = useState(contact.phones?.join('\n') || '');
    const [email, setEmail] = useState(contact.email || '');
    const [type, setType] = useState(contact.type || 'guardian');
    const [studentName, setStudentName] = useState(contact.studentName || '');
    const [notes, setNotes] = useState(contact.notes || '');

    const handleSave = () => {
        if (!firstName.trim() || !lastName.trim()) {
            alert('Nombre y apellido son requeridos');
            return;
        }
        const phones = phonesText.split('\n').map(p => p.trim()).filter(Boolean);
        if (phones.length === 0) {
            alert('Al menos un teléfono es requerido');
            return;
        }

        onSave({
            id: isNew ? undefined : contact.id,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phones,
            email: email.trim() || undefined,
            type,
            studentName: studentName.trim() || undefined,
            notes: notes.trim() || undefined
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-lg mx-4 p-6">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                    {isNew ? 'Nuevo Contacto' : 'Editar Contacto'}
                </h2>
                
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Nombre *
                            </label>
                            <input
                                type="text"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="Ej: María"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Apellido *
                            </label>
                            <input
                                type="text"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="Ej: García"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Tipo de Contacto
                            </label>
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="guardian">Representante</option>
                                <option value="mother">Madre</option>
                                <option value="father">Padre</option>
                                <option value="tutor">Tutor</option>
                                <option value="other">Otro</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Nombre del Alumno
                            </label>
                            <input
                                type="text"
                                value={studentName}
                                onChange={(e) => setStudentName(e.target.value)}
                                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="Ej: Juan García"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Teléfonos * (uno por línea)
                        </label>
                        <textarea
                            value={phonesText}
                            onChange={(e) => setPhonesText(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                            placeholder="+18095551234&#10;+18095555678"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="contacto@ejemplo.com"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Notas
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Notas adicionales..."
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium"
                    >
                        Guardar
                    </button>
                </div>
            </div>
        </div>
    );
};
