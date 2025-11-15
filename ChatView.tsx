
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, Message, EphemeralType } from '../../types';
// FIX: Removed MicIcon as it is not exported from Icons.tsx and was unused.
import { ChevronLeftIcon, SendIcon, EyeIcon, ClockIcon, PaperclipIcon, XIcon } from '../ui/Icons';
import * as firebase from '../../services/firebaseService';
import { getChatId } from '../../utils/helpers';
import { CHAT_INACTIVITY_HOURS } from '../../constants';

const ChatView: React.FC<{ currentUser: User; friend: User; onBack: () => void; }> = ({ currentUser, friend, onBack }) => {
    const chatId = getChatId(currentUser.uid, friend.uid);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [ephemeral, setEphemeral] = useState<EphemeralType | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isTyping, setIsTyping] = useState(false);
    const endOfMessagesRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const checkAndWipeInactiveChat = async () => {
            const chatDoc = await firebase.getChatDoc(chatId);
            if(chatDoc) {
                const hoursSinceActive = (new Date().getTime() - chatDoc.lastActivity.getTime()) / (1000 * 60 * 60);
                if(hoursSinceActive > CHAT_INACTIVITY_HOURS) {
                    await firebase.deleteChatHistory(chatId);
                }
            }
        };
        checkAndWipeInactiveChat();

        const unsub = firebase.onMessagesSnapshot(chatId, (newMessages) => {
            setMessages(newMessages);
        });
        return unsub;
    }, [chatId]);

    useEffect(() => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        // FIX: Replaced NodeJS.Timeout with ReturnType<typeof setTimeout> for browser compatibility.
        let timeoutId: ReturnType<typeof setTimeout>;
        const updateTypingStatus = async (typing: boolean) => {
            if (currentUser.typingIn !== (typing ? chatId : null)) {
                 await firebase.updateUserDoc(currentUser.uid, { typingIn: typing ? chatId : null });
            }
        };

        if (newMessage.length > 0) {
            updateTypingStatus(true);
        } else {
            timeoutId = setTimeout(() => updateTypingStatus(false), 2000);
        }
        
        return () => clearTimeout(timeoutId);
    }, [newMessage, currentUser.uid, currentUser.typingIn, chatId]);

    useEffect(() => {
        if (friend.typingIn === chatId) setIsTyping(true);
        else setIsTyping(false);
    }, [friend.typingIn, chatId]);


    const handleSendMessage = async () => {
        if (!newMessage.trim() && !imagePreview) return;

        const messageData: Omit<Message, 'id'> = {
            senderId: currentUser.uid,
            timestamp: new Date(),
            viewedBy: [],
            ephemeralType: ephemeral ?? undefined,
        };

        if(imagePreview) {
            messageData.imageUrl = imagePreview;
        } else {
            messageData.text = newMessage;
        }

        await firebase.addMessage(chatId, messageData);

        setNewMessage('');
        setEphemeral(null);
        setImagePreview(null);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
                // Ephemeral media is always view-once
                setEphemeral('viewOnce');
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-800">
            <header className="flex items-center p-3 border-b border-gray-700 bg-gray-900 sticky top-0 z-10">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-700"><ChevronLeftIcon className="w-6 h-6" /></button>
                <img src={`https://picsum.photos/seed/${friend.uid}/40/40`} alt={friend.nickname} className="w-10 h-10 rounded-full ml-2" />
                <div className="ml-3">
                    <h2 className="font-semibold text-lg">{friend.nickname}</h2>
                    <p className="text-xs text-gray-400">{isTyping ? 'typing...' : friend.online ? 'Online' : 'Offline'}</p>
                </div>
            </header>

            <main className="flex-grow p-4 overflow-y-auto space-y-4">
                {messages.map(msg => <ChatMessage key={msg.id} message={msg} isCurrentUser={msg.senderId === currentUser.uid} chatId={chatId} />)}
                <div ref={endOfMessagesRef} />
            </main>
            
            {imagePreview && (
                 <div className="p-2 border-t border-gray-700">
                    <div className="relative w-24 h-24">
                        <img src={imagePreview} alt="" className="w-full h-full object-cover rounded-md" />
                        <button onClick={() => {setImagePreview(null); setEphemeral(null);}} className="absolute -top-1 -right-1 bg-gray-900 rounded-full p-0.5"><XIcon className="w-4 h-4"/></button>
                    </div>
                 </div>
            )}

            <footer className="p-3 border-t border-gray-700 bg-gray-900">
                <div className="flex items-center gap-2 bg-gray-800 rounded-full px-4 py-2">
                    <div className="flex gap-1">
                        <button onClick={() => setEphemeral(e => e === 'viewOnce' ? null : 'viewOnce')} className={`p-2 rounded-full ${ephemeral === 'viewOnce' ? 'bg-teal-500 text-white' : 'text-gray-400 hover:bg-gray-700'}`}><EyeIcon className="w-5 h-5"/></button>
                        <button onClick={() => setEphemeral(e => e === '10s' ? null : '10s')} className={`p-2 rounded-full ${ephemeral === '10s' ? 'bg-teal-500 text-white' : 'text-gray-400 hover:bg-gray-700'}`}><ClockIcon className="w-5 h-5" /></button>
                        <label className="p-2 rounded-full text-gray-400 hover:bg-gray-700 cursor-pointer"><PaperclipIcon className="w-5 h-5"/><input type="file" accept="image/*" className="hidden" onChange={handleFileChange}/></label>
                    </div>
                    <input type="text" placeholder="Type a message..." value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} className="flex-grow bg-transparent focus:outline-none text-white px-2" disabled={!!imagePreview}/>
                    <button onClick={handleSendMessage} className="p-3 bg-teal-600 rounded-full hover:bg-teal-700 transition-colors"><SendIcon className="w-5 h-5 text-white" /></button>
                </div>
            </footer>
        </div>
    );
};

const ChatMessage: React.FC<{ message: Message; isCurrentUser: boolean; chatId: string }> = ({ message, isCurrentUser, chatId }) => {
    const hasBeenViewed = useRef(false);

    const deleteSelf = useCallback(() => {
        firebase.deleteMessage(chatId, message.id);
    }, [chatId, message.id]);

    useEffect(() => {
        if (!isCurrentUser && !hasBeenViewed.current) {
            if (message.ephemeralType === 'viewOnce') {
                hasBeenViewed.current = true;
                setTimeout(deleteSelf, 1000); // give a moment to see
            } else if (message.ephemeralType === '10s') {
                hasBeenViewed.current = true;
                setTimeout(deleteSelf, 10000);
            }
        }
    }, [isCurrentUser, message.ephemeralType, deleteSelf]);
    
    const alignment = isCurrentUser ? 'justify-end' : 'justify-start';
    const bgColor = isCurrentUser ? 'bg-teal-600' : 'bg-gray-700';
    const ephemeralIcon = message.ephemeralType === 'viewOnce' ? <EyeIcon className="w-3 h-3 inline-block mr-1"/> : message.ephemeralType === '10s' ? <ClockIcon className="w-3 h-3 inline-block mr-1"/> : null;
    
    return (
        <div className={`flex ${alignment}`}>
            <div className={`px-4 py-2 rounded-2xl max-w-xs md:max-w-md ${bgColor}`}>
                {message.imageUrl ? (
                     <img src={message.imageUrl} alt="sent image" className="max-w-full h-auto rounded-lg" />
                ) : (
                    <p className="text-white break-words">{message.text}</p>
                )}
                <div className="text-xs text-gray-300 mt-1 text-right flex items-center justify-end">
                    {ephemeralIcon}
                    {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
            </div>
        </div>
    );
};

export default ChatView;