// This is a MOCKED Firebase service for demonstration purposes.
// In a real application, you would use the actual Firebase SDK.
import { User, Message, Chat, Friend, FriendRequest } from '../types';
import { FIRESTORE_COLLECTIONS, FRIENDSHIP_DURATION_DAYS } from '../constants';
import { getChatId as getChatIdUtil, generateAvatar } from '../utils/helpers';

// --- MOCK DATABASE ---
// FIX: Changed mockDb to use direct properties for 'users' and 'chats' to ensure correct type inference by TypeScript.
const mockDb = {
    users: new Map<string, User>(),
    chats: new Map<string, { chat: Chat, messages: Map<string, Message> }>(),
};

// --- MOCK REAL-TIME EMITTER ---
type Listener = (data: any) => void;
const listeners = new Map<string, Listener[]>();

const subscribe = (path: string, callback: Listener) => {
    if (!listeners.has(path)) {
        listeners.set(path, []);
    }
    listeners.get(path)?.push(callback);

    // Initial data fetch
    const [collection, docId] = path.split('/');
    if (collection === FIRESTORE_COLLECTIONS.USERS && docId) {
        callback({
            exists: () => mockDb.users.has(docId),
            data: () => mockDb.users.get(docId),
            id: docId
        });
    } else if (collection === FIRESTORE_COLLECTIONS.CHATS && docId) {
        const parts = path.split('/');
        if (parts.length === 4 && parts[2] === 'messages') { // messages subcollection
             const chatId = parts[1];
             // FIX: Added explicit types for sort and map callbacks to avoid errors with implicitly typed variables.
             const messages = Array.from(mockDb.chats.get(chatId)?.messages.values() || [])
                .sort((a: Message, b: Message) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
             callback(messages.map((msg: Message) => ({ data: () => msg, id: msg.id })));
        }
    }


    return () => {
        const pathListeners = listeners.get(path)?.filter(l => l !== callback);
        if(pathListeners) listeners.set(path, pathListeners);
    };
};

const notify = (path: string) => {
    const [collection, docId] = path.split('/');
    const docListeners = listeners.get(path);

    if(docListeners) {
        let data: any = null;
        let exists = false;
        if (collection === FIRESTORE_COLLECTIONS.USERS) {
            data = mockDb.users.get(docId);
            exists = !!data;
        }
        if (collection === FIRESTORE_COLLECTIONS.CHATS) {
            const parts = path.split('/');
            if(parts.length > 2) { // Is a message path
                const chatId = parts[1];
                 // FIX: Added explicit types for sort and map callbacks.
                 const messages = Array.from(mockDb.chats.get(chatId)?.messages.values() || [])
                    .sort((a: Message, b: Message) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                 listeners.get(`${FIRESTORE_COLLECTIONS.CHATS}/${chatId}/messages`)?.forEach(l => l(messages.map((msg: Message) => ({ data: () => msg, id: msg.id }))));
                 return;
            }
        }

        docListeners.forEach(l => l({
            exists: () => exists,
            data: () => data,
            id: docId,
        }));
    }
};


// --- MOCK AUTH ---
export const signInAnonymously = async (): Promise<{ uid: string }> => {
    let uid: string;
    do {
        uid = Math.floor(10000000 + Math.random() * 90000000).toString();
    } while (mockDb.users.has(uid)); // Ensure UID is unique in the mock DB
    return Promise.resolve({ uid });
};

// --- MOCK FIRESTORE ---
export const getUserDoc = async (uid: string): Promise<User | null> => {
    return Promise.resolve(mockDb.users.get(uid) || null);
};

export const createUserDoc = async (uid: string, nickname: string): Promise<User> => {
    const newUser: User = {
        uid,
        nickname,
        avatarUrl: generateAvatar(nickname),
        online: true,
        lastActive: new Date(),
        friends: [],
        friendRequestsSent: [],
        friendRequestsReceived: [],
        blocked: [],
    };
    mockDb.users.set(uid, newUser);
    notify(`${FIRESTORE_COLLECTIONS.USERS}/${uid}`);
    return Promise.resolve(newUser);
};

export const deleteUserDoc = async (uid: string): Promise<void> => {
    const userToDelete = mockDb.users.get(uid);
    if (!userToDelete) return;

    // Remove from friends' lists
    userToDelete.friends.forEach(friend => {
        const friendDoc = mockDb.users.get(friend.uid);
        if(friendDoc) {
            friendDoc.friends = friendDoc.friends.filter(f => f.uid !== uid);
            notify(`${FIRESTORE_COLLECTIONS.USERS}/${friend.uid}`);
        }
    });

    mockDb.users.delete(uid);
    return Promise.resolve();
};

export const updateUserDoc = async (uid: string, data: Partial<User>): Promise<void> => {
    const user = mockDb.users.get(uid);
    if (user) {
        Object.assign(user, data);
        mockDb.users.set(uid, user);
        notify(`${FIRESTORE_COLLECTIONS.USERS}/${uid}`);
    }
    return Promise.resolve();
};

export const onUserDocSnapshot = (uid: string, callback: (user: User | null) => void) => {
    return subscribe(`${FIRESTORE_COLLECTIONS.USERS}/${uid}`, (snapshot: any) => {
        callback(snapshot.exists() ? snapshot.data() : null);
    });
};

export const addFriendRequest = async (fromUser: User, toUid: string) => {
    const toUser = mockDb.users.get(toUid);
    if (!toUser || fromUser.uid === toUid) return;

    // Update sender
    if (!fromUser.friendRequestsSent.includes(toUid)) {
        fromUser.friendRequestsSent.push(toUid);
        updateUserDoc(fromUser.uid, { friendRequestsSent: fromUser.friendRequestsSent });
    }

    // Update receiver
    if (!toUser.friendRequestsReceived.some(req => req.uid === fromUser.uid)) {
        // FIX: Include avatarUrl when creating a friend request.
        toUser.friendRequestsReceived.push({ uid: fromUser.uid, nickname: fromUser.nickname, avatarUrl: fromUser.avatarUrl });
        updateUserDoc(toUid, { friendRequestsReceived: toUser.friendRequestsReceived });
    }
};

export const handleFriendRequest = async (currentUser: User, requestorUid: string, accept: boolean) => {
    const requestor = mockDb.users.get(requestorUid);
    if (!requestor) return;

    // Remove request from current user
    const updatedRequests = currentUser.friendRequestsReceived.filter(req => req.uid !== requestorUid);
    updateUserDoc(currentUser.uid, { friendRequestsReceived: updatedRequests });
    
    // Remove sent request from requestor
    const updatedSent = requestor.friendRequestsSent.filter(uid => uid !== currentUser.uid);
    updateUserDoc(requestorUid, { friendRequestsSent: updatedSent });

    if (accept) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + FRIENDSHIP_DURATION_DAYS);

        const newFriendForCurrentUser: Friend = { uid: requestor.uid, nickname: requestor.nickname, expiresAt };
        updateUserDoc(currentUser.uid, { friends: [...currentUser.friends, newFriendForCurrentUser] });

        const newFriendForRequestor: Friend = { uid: currentUser.uid, nickname: currentUser.nickname, expiresAt };
        updateUserDoc(requestorUid, { friends: [...requestor.friends, newFriendForRequestor] });
    }
};

export const renewFriendship = async (currentUser: User, friendUid: string) => {
    const friend = mockDb.users.get(friendUid);
    if (!friend) return;
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + FRIENDSHIP_DURATION_DAYS);

    const updatedCurrentUserFriends = currentUser.friends.map(f => f.uid === friendUid ? {...f, expiresAt} : f);
    updateUserDoc(currentUser.uid, { friends: updatedCurrentUserFriends });

    const updatedFriendFriends = friend.friends.map(f => f.uid === currentUser.uid ? {...f, expiresAt} : f);
    updateUserDoc(friend.uid, { friends: updatedFriendFriends });
};


// --- CHAT MOCKS ---
export const onMessagesSnapshot = (chatId: string, callback: (messages: Message[]) => void) => {
     return subscribe(`${FIRESTORE_COLLECTIONS.CHATS}/${chatId}/messages`, (snapshots: any[]) => {
        const messages = snapshots.map(snap => snap.data() as Message);
        callback(messages);
    });
};

export const addMessage = async (chatId: string, message: Omit<Message, 'id'>) => {
    if (!mockDb.chats.has(chatId)) {
        const participants = chatId.split('_');
        mockDb.chats.set(chatId, {
            chat: { id: chatId, participants, lastActivity: new Date() },
            messages: new Map(),
        });
    }
    const chatData = mockDb.chats.get(chatId)!;
    const newMessage: Message = { ...message, id: `msg_${Date.now()}` };
    chatData.messages.set(newMessage.id, newMessage);
    chatData.chat.lastActivity = new Date();

    notify(`${FIRESTORE_COLLECTIONS.CHATS}/${chatId}/messages/${newMessage.id}`);
};

export const deleteMessage = async (chatId: string, messageId: string) => {
    const chatData = mockDb.chats.get(chatId);
    if (chatData?.messages.has(messageId)) {
        chatData.messages.delete(messageId);
        notify(`${FIRESTORE_COLLECTIONS.CHATS}/${chatId}/messages/${messageId}`);
    }
};

export const deleteChatHistory = async (chatId: string) => {
    const chatData = mockDb.chats.get(chatId);
    if(chatData) {
        chatData.messages.clear();
        notify(`${FIRESTORE_COLLECTIONS.CHATS}/${chatId}/messages/all`);
    }
};

export const getChatDoc = async (chatId: string): Promise<Chat | null> => {
    return Promise.resolve(mockDb.chats.get(chatId)?.chat || null);
};


// --- UTILS ---
export const handleSharedLink = (): string | null => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('addId');
};

export const findUserByUid = async (uid: string): Promise<User | null> => {
    // In a real app, this would be a query. Here we just get from the map.
    return Promise.resolve(mockDb.users.get(uid) || null);
};