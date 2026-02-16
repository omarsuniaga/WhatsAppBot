/**
 * WhatsAppChatsPage - WhatsApp Chat Manager
 * Displays ChatList + ChatView for managing WhatsApp conversations
 */

import { useState, useEffect } from 'react';
import { ChatList } from '../../components/chat/ChatList';
import { ChatView } from '../../components/chat/ChatView';
import { useStore } from '../../store';

export const WhatsAppChatsPage = () => {
    const { setActiveChat } = useStore();
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [showChatOnMobile, setShowChatOnMobile] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (!mobile) setShowChatOnMobile(false);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleSelectChat = (jid: string) => {
        setActiveChat(jid);
        if (isMobile) setShowChatOnMobile(true);
    };

    const handleBackToList = () => {
        setShowChatOnMobile(false);
    };

    return (
        <div className="h-full flex flex-col md:flex-row overflow-hidden bg-white dark:bg-[#111b21] transition-colors">
            {/* ChatList panel - Responsive width and independent scroll */}
            <div className={`
                ${isMobile
                    ? (showChatOnMobile ? 'hidden' : 'w-full')
                    : 'w-full md:w-96 lg:w-[400px] xl:w-[420px]'
                }
                flex-shrink-0 h-full overflow-y-auto border-r border-gray-200 dark:border-[#222d34] transition-all duration-200
            `}>
                <ChatList onSelectChat={handleSelectChat} />
            </div>

            {/* ChatView panel - Flexible width and independent scroll */}
            <div className={`
                ${isMobile
                    ? (showChatOnMobile ? 'w-full' : 'hidden')
                    : 'flex-1'
                }
                h-full overflow-y-auto bg-gray-50 dark:bg-[#0b141a] transition-all duration-200
            `}>
                <ChatView
                    onBack={isMobile ? handleBackToList : undefined}
                    showBackButton={isMobile && showChatOnMobile}
                />
            </div>
        </div>
    );
};
