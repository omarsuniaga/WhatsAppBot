import { useState, useEffect } from 'react';
import { ChatList } from '../components/chat/ChatList';
import { ChatView } from '../components/chat/ChatView';
import { Sidebar } from '../components/common/Sidebar';
import { SettingsPanel } from '../components/settings/SettingsPanel';
import { AlertPanel } from '../components/alerts';
import { useStore } from '../store';

interface ChatPageProps {
    onOpenAdmin?: () => void;
}

export const ChatPage = ({ onOpenAdmin }: ChatPageProps) => {
    const { setActiveChat } = useStore();
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [showChatOnMobile, setShowChatOnMobile] = useState(false);
    const [activeTab, setActiveTab] = useState<'chats' | 'calls' | 'status' | 'groups' | 'admin'>('chats');
    const [showSettings, setShowSettings] = useState(false);
    const [showAlerts, setShowAlerts] = useState(false);
    const [alertCount, setAlertCount] = useState(0);

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
        <div className="h-screen flex bg-white dark:bg-[#111b21] transition-colors">
            {/* Sidebar - Hidden on mobile */}
            {!isMobile && (
                <Sidebar 
                    activeTab={activeTab} 
                    onTabChange={setActiveTab}
                    onOpenAdmin={onOpenAdmin}
                    onOpenSettings={() => setShowSettings(true)}
                    onOpenAlerts={() => setShowAlerts(true)}
                    alertCount={alertCount}
                />
            )}

            {/* Settings Panel */}
            <SettingsPanel 
                isOpen={showSettings} 
                onClose={() => setShowSettings(false)} 
            />

            {/* Alerts Panel */}
            <AlertPanel 
                isOpen={showAlerts} 
                onClose={() => setShowAlerts(false)}
                onAlertCountChange={setAlertCount}
            />

            {/* Main content area */}
            <div className="flex-1 flex overflow-hidden">
                {/* ChatList panel */}
                <div className={`
                    ${isMobile 
                        ? (showChatOnMobile ? 'hidden' : 'w-full') 
                        : 'w-[400px] min-w-[300px] max-w-[500px]'
                    }
                    flex-shrink-0 transition-all duration-200 border-r border-[#222d34]
                `}>
                    <ChatList onSelectChat={handleSelectChat} />
                </div>
                
                {/* ChatView panel */}
                <div className={`
                    ${isMobile 
                        ? (showChatOnMobile ? 'w-full' : 'hidden') 
                        : 'flex-1'
                    }
                    transition-all duration-200
                `}>
                    <ChatView 
                        onBack={isMobile ? handleBackToList : undefined}
                        showBackButton={isMobile && showChatOnMobile}
                    />
                </div>
            </div>
        </div>
    );
};
