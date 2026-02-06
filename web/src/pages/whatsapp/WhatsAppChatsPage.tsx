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
        <div className="h-full flex bg-white dark:bg-[#111b21] transition-colors">
            {/* ChatList panel */}
            <div className={`
                ${isMobile 
                    ? (showChatOnMobile ? 'hidden' : 'w-full') 
                    : 'w-[400px] min-w-[300px] max-w-[500px]'
                }
                flex-shrink-0 transition-all duration-200 border-r border-gray-200 dark:border-[#222d34]
            `}>
                <ChatList onSelectChat={handleSelectChat} />
            </div>
            
            {/* ChatView panel */}
            <div className={`
                ${isMobile 
                    ? (showChatOnMobile ? 'w-full' : 'hidden') 
                    : 'flex-1'
                }
                transition-all duration-200 bg-gray-50 dark:bg-[#0b141a]
            `}>
                <ChatView 
                    onBack={isMobile ? handleBackToList : undefined}
                    showBackButton={isMobile && showChatOnMobile}
                />
            </div>
        </div>
    );
};
