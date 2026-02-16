/**
 * TicketsPage - Support Tickets Management
 * Wraps the existing TicketsPanel component
 * Features responsive design and help system
 */

import { InfoButton } from '../components/common/InfoButton';
import { usePageInfo } from '../hooks/useViewInfo';
import { TicketsPanel } from '../components/admin/TicketsPanel';
import { Ticket } from 'lucide-react';

export const TicketsPage = () => {
    const pageInfo = usePageInfo('tickets');
    
    return (
        <div className="h-dvh flex flex-col bg-gray-50 dark:bg-gray-800">
            {/* Header with Info Button - Responsive */}
            <header 
                className="bg-white dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex-shrink-0"
                style={{
                    padding: 'clamp(0.75rem, 1vw, 1.25rem)',
                    minHeight: 'clamp(3.5rem, 8vw, 4rem)',
                }}
            >
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <Ticket className="w-6 h-6 sm:w-7 sm:h-7 text-whatsapp-green flex-shrink-0" />
                        <div className="min-w-0">
                            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100 truncate">
                                Tickets de Soporte
                            </h1>
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
                                Gestión de consultas y solicitudes
                            </p>
                        </div>
                    </div>
                    
                    {/* Info Button */}
                    {pageInfo.hasInfo && (
                        <div className="flex-shrink-0">
                            <InfoButton
                                title={pageInfo.title}
                                description={pageInfo.description}
                                tips={pageInfo.tips}
                            />
                        </div>
                    )}
                </div>
            </header>

            {/* Content - Responsive */}
            <main className="flex-1 min-h-0 overflow-hidden">
                <TicketsPanel />
            </main>
        </div>
    );
};
