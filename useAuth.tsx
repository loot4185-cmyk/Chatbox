
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User } from '../types';
import { LOCAL_STORAGE_USER_ID_KEY, LOCAL_STORAGE_NICKNAME_HISTORY_KEY } from '../constants';
import * as firebase from '../services/firebaseService';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    resetIdentity: () => Promise<void>;
    updateNickname: (newNickname: string) => Promise<void>;
    updateAvatar: (avatarUrl: string) => Promise<void>;
    nicknameHistory: string[];
    addFriend: (friendId: string) => Promise<void>;
    acceptFriend: (friendId: string) => Promise<void>;
    declineFriend: (friendId: string) => Promise<void>;
    theme: 'light' | 'dark';
    toggleTheme: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [nicknameHistory, setNicknameHistory] = useState<string[]>([]);
    const [unsubscribe, setUnsubscribe] = useState<(() => void) | null>(null);
    const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('theme') as 'light' | 'dark') || 'dark');

    useEffect(() => {
        document.documentElement.className = theme;
        localStorage.setItem('theme', theme);
    }, [theme]);
    
    const toggleTheme = () => {
        setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
    };
    
    useEffect(() => {
        const storedHistory = localStorage.getItem(LOCAL_STORAGE_NICKNAME_HISTORY_KEY);
        if (storedHistory) {
            setNicknameHistory(JSON.parse(storedHistory));
        }
    }, []);

    const manageNicknameHistory = (nickname: string) => {
        setNicknameHistory(prev => {
            const newHistory = [nickname, ...prev.filter(n => n !== nickname)].slice(0, 3);
            localStorage.setItem(LOCAL_STORAGE_NICKNAME_HISTORY_KEY, JSON.stringify(newHistory));
            return newHistory;
        });
    };

    const initializeSession = useCallback(async (existingUid?: string | null) => {
        setLoading(true);

        if (unsubscribe) unsubscribe();

        let uid = existingUid;
        let userDoc: User | null = null;

        if (uid) {
            userDoc = await firebase.getUserDoc(uid);
        }

        if (!userDoc) {
            const { uid: newUid } = await firebase.signInAnonymously();
            uid = newUid;
            const randomNickname = `User${Math.floor(1000 + Math.random() * 9000)}`;
            userDoc = await firebase.createUserDoc(uid, randomNickname);
            localStorage.setItem(LOCAL_STORAGE_USER_ID_KEY, uid);
            manageNicknameHistory(randomNickname);
        }

        if (uid) {
            const unsub = firebase.onUserDocSnapshot(uid, (updatedUser) => {
                setUser(updatedUser);
            });
            setUnsubscribe(() => unsub);
        }

        setUser(userDoc);
        setLoading(false);
    }, [unsubscribe]);
    
    useEffect(() => {
        const storedUid = localStorage.getItem(LOCAL_STORAGE_USER_ID_KEY);
        initializeSession(storedUid);
        
        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const resetIdentity = async () => {
        setLoading(true);
        const oldUid = user?.uid;

        if (oldUid) {
            await firebase.deleteUserDoc(oldUid);
        }

        localStorage.removeItem(LOCAL_STORAGE_USER_ID_KEY);
        await initializeSession();
    };

    const updateNickname = async (newNickname: string) => {
        if (user && newNickname) {
            await firebase.updateUserDoc(user.uid, { nickname: newNickname });
            manageNicknameHistory(newNickname);
        }
    };

    const updateAvatar = async (avatarUrl: string) => {
        if (user) {
            await firebase.updateUserDoc(user.uid, { avatarUrl });
        }
    };
    
    const addFriend = async (friendId: string) => {
        if (user) {
            await firebase.addFriendRequest(user, friendId);
        }
    };
    
    const acceptFriend = async (friendId: string) => {
        if (user) {
            await firebase.handleFriendRequest(user, friendId, true);
        }
    };
    
    const declineFriend = async (friendId: string) => {
        if (user) {
            await firebase.handleFriendRequest(user, friendId, false);
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, resetIdentity, updateNickname, nicknameHistory, addFriend, acceptFriend, declineFriend, theme, toggleTheme, updateAvatar }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};