/**
 * WhatsAppGroupsPage - WhatsApp Groups Management
 * Placeholder for future group management functionality
 */

import { Users } from 'lucide-react';

export const WhatsAppGroupsPage = () => {
    return (
        <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors">
            <div className="text-center p-8">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                </div>
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
                    Gestión de Grupos
                </h2>
                <p className="text-gray-500 dark:text-gray-400 max-w-md">
                    Próximamente podrás gestionar tus grupos de WhatsApp desde aquí.
                    Crea, edita y administra grupos fácilmente.
                </p>
            </div>
        </div>
    );
};
