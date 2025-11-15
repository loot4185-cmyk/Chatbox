
import React, { useState, useEffect } from 'react';
import { useAuth, AuthProvider } from './hooks/useAuth';
import MainView from './components/views/MainView';
import ChatView from './components/views/ChatView';
import { User } from './types';
import { SpinnerIcon } from './components/ui/Icons';
import { handleSharedLink } from './services/firebaseService';

const AppContent: React.FC = () => {
    const { user, loading, addFriend } = useAuth();
    const [activeChatFriend, setActiveChatFriend] = useState<User | null>(null);

    useEffect(() => {
        const checkSharedLink = async () => {
            const friendId = handleSharedLink();
            if (friendId && user && friendId !== user.uid) {
                await addFriend(friendId);
                // Optionally show a notification
                alert(`Friend request sent to ${friendId}!`);
                // Clear URL params
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        };
        if (!loading && user) {
            checkSharedLink();
        }
    }, [loading, user, addFriend]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <SpinnerIcon className="w-12 h-12" />
            </div>
        );
    }

    if (!user) {
        return (
             <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                <SpinnerIcon className="w-12 h-12" />
                <p className="ml-4">Initializing session...</p>
            </div>
        );
    }

    return (
        <div className="w-full h-full overflow-hidden">
            {activeChatFriend ? (
                <ChatView 
                    currentUser={user} 
                    friend={activeChatFriend} 
                    onBack={() => setActiveChatFriend(null)} 
                />
            ) : (
                <MainView 
                    user={user} 
                    onStartChat={setActiveChatFriend} 
                />
            )}
        </div>
    );
};


const App: React.FC = () => {
    return (
        <AuthProvider>
            <div className="bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 h-screen font-sans flex flex-col items-center">
                <div className="w-full max-w-lg h-full md:h-[95vh] md:max-h-[800px] md:my-auto bg-white dark:bg-black md:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                    <AppContent />
                </div>
            </div>
        </AuthProvider>
    );
};

export default App;