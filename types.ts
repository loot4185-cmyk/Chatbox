
export interface User {
    uid: string;
    nickname: string;
    avatarUrl?: string;
    online: boolean;
    lastActive: Date;
    friends: Friend[];
    friendRequestsSent: string[]; // array of uids
    friendRequestsReceived: FriendRequest[];
    blocked: string[]; // array of uids
    typingIn?: string | null;
}

export interface Friend {
    uid: string;
    nickname: string;
    expiresAt: Date;
}

export interface FriendRequest {
    uid: string;
    nickname: string;
    // FIX: Added optional avatarUrl to FriendRequest to show requestor's avatar.
    avatarUrl?: string;
}

export type EphemeralType = 'viewOnce' | '10s';

export interface Message {
    id: string;
    senderId: string;
    text?: string;
    imageUrl?: string;
    audioUrl?: string;
    timestamp: Date;
    ephemeralType?: EphemeralType;
    viewedBy: string[];
}

export interface Chat {
    id: string;
    participants: string[];
    lastActivity: Date;
}