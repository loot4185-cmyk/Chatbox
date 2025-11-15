import React, { useState, useMemo, useRef } from 'react';
import { User } from '../../types';
import { UsersIcon, UserPlusIcon, SettingsIcon, QrCodeIcon, Share2Icon, RefreshCwIcon, SortAscIcon, ClockIcon, SearchIcon, ChevronDownIcon } from '../ui/Icons';
import { useAuth } from '../../hooks/useAuth';
import Modal from '../ui/Modal';
import { formatTimeAgo } from '../../utils/helpers';
import * as firebase from '../../services/firebaseService';

type Tab = 'friends' | 'requests' | 'settings';
type FriendSort = 'lastActive' | 'alphabetical';

// FIX: Added placeholder components that were missing.
const RequestsList: React.FC<{ user: User }> = ({ user }) => (
    <div className="p-4 text-center text-gray-400">Friend requests will appear here.</div>
);
const Settings: React.FC<{ user: User }> = ({ user }) => (
    <div className="p-4 text-center text-gray-400">Settings will be available here.</div>
);
const BottomNav: React.FC<{ activeTab: Tab, setActiveTab: (tab: Tab) => void }> = ({ activeTab, setActiveTab }) => {
    const navItems = [
        { tab: 'friends' as Tab, icon: UsersIcon, label: 'Friends' },
        { tab: 'requests' as Tab, icon: UserPlusIcon, label: 'Requests' },
        { tab: 'settings' as Tab, icon: SettingsIcon, label: 'Settings' },
    ];

    return (
        <nav className="flex justify-around items-center p-1 border-t border-gray-700 bg-gray-800">
            {navItems.map(({ tab, icon: Icon, label }) => (
                <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex flex-col items-center justify-center w-full py-2 px-1 rounded-md transition-colors ${
                        activeTab === tab ? 'text-teal-400' : 'text-gray-400 hover:bg-gray-700'
                    }`}
                >
                    <Icon className="w-6 h-6 mb-1" />
                    <span className="text-xs font-medium">{label}</span>
                </button>
            ))}
        </nav>
    );
};


const MainView: React.FC<{ user: User, onStartChat: (friend: User) => void }> = ({ user, onStartChat }) => {
    const [activeTab, setActiveTab] = useState<Tab>('friends');

    return (
        <div className="flex flex-col h-full bg-gray-900">
            <div className="flex-grow overflow-y-auto">
                {activeTab === 'friends' && <FriendsList user={user} onStartChat={onStartChat} />}
                {activeTab === 'requests' && <RequestsList user={user} />}
                {activeTab === 'settings' && <Settings user={user} />}
            </div>
            <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>
    );
};

// Sub-components for each tab

const FriendsList: React.FC<{ user: User, onStartChat: (friend: User) => void }> = ({ user, onStartChat }) => {
    const [sort, setSort] = useState<FriendSort>('lastActive');
    const [search, setSearch] = useState('');
    const [friendsData, setFriendsData] = useState<User[]>([]);

    React.useEffect(() => {
        const unsubscribes = user.friends.map(friend => 
            firebase.onUserDocSnapshot(friend.uid, (friendUser) => {
                if (friendUser) {
                    setFriendsData(prev => {
                        const existing = prev.find(f => f.uid === friendUser.uid);
                        if(existing) {
                            return prev.map(f => f.uid === friendUser.uid ? friendUser : f);
                        }
                        return [...prev, friendUser];
                    });
                }
            })
        );
        return () => unsubscribes.forEach(unsub => unsub());
    }, [user.friends]);

    const sortedAndFilteredFriends = useMemo(() => {
        const onlineFriends = friendsData.filter(f => f.online);
        const offlineFriends = friendsData.filter(f => !f.online);

        const sortFn = (a: User, b: User) => {
            if (sort === 'alphabetical') return a.nickname.localeCompare(b.nickname);
            if (a.lastActive && b.lastActive) {
                return b.lastActive.getTime() - a.lastActive.getTime();
            }
            return 0;
        };

        return [...onlineFriends.sort(sortFn), ...offlineFriends.sort(sortFn)]
            .filter(f => f.nickname.toLowerCase().includes(search.toLowerCase()));
    }, [friendsData, sort, search]);
    
    // FIX: Completed the FriendsList component implementation.
    const renew = (friendUid: string) => {
        firebase.renewFriendship(user, friendUid);
    };

    return (
        <div className="h-full">
            <div className="p-3 sticky top-0 bg-gray-900 z-10 border-b border-gray-800">
                <div className="relative">
                    <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search friends"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-gray-800 rounded-full pl-10 pr-4 py-2 focus:outline-none text-white placeholder-gray-500"
                    />
                </div>
            </div>
            <ul className="divide-y divide-gray-800">
                {sortedAndFilteredFriends.map(friend => (
                     <li key={friend.uid} onClick={() => onStartChat(friend)} className="p-3 flex items-center cursor-pointer hover:bg-gray-800 transition-colors">
                        <div className="relative">
                            <img src={`https://picsum.photos/seed/${friend.uid}/48/48`} alt={friend.nickname} className="w-12 h-12 rounded-full" />
                            {friend.online && <span className="absolute bottom-0 right-0 block h-3.5 w-3.5 rounded-full bg-green-500 ring-2 ring-gray-900"></span>}
                        </div>
                        <div className="ml-4 flex-grow">
                            <p className="font-semibold">{friend.nickname}</p>
                            <p className="text-sm text-gray-400">{friend.online ? 'Online' : `Active ${formatTimeAgo(friend.lastActive)}`}</p>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default MainView;
