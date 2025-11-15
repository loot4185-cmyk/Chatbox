export const formatTimeAgo = (date: Date, full: boolean = false): string => {
    const now = new Date();
    const seconds = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);

    if (!full) {
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + "y ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + "mo ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + "d ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + "h ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + "m ago";
        return Math.floor(seconds) + "s ago";
    }

    const diff = new Date(date).getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days > 1) return `${days} days`;
    const hours = Math.ceil(diff / (1000 * 60 * 60));
    return `${hours} hours`;
};

export const getChatId = (uid1: string, uid2: string): string => {
    return [uid1, uid2].sort().join('_');
};

export const generateAvatar = (name: string): string => {
    const getInitials = (name: string) => {
        if (!name) return '?';
        const initials = name.trim().split(' ').map(n => n[0]).join('').toUpperCase();
        return initials.slice(0, 2);
    };

    const hashString = (str: string) => {
        if (!str) return 0;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        return hash;
    };

    const intToRGB = (i: number) => {
        const c = (i & 0x00FFFFFF).toString(16).toUpperCase();
        return "00000".substring(0, 6 - c.length) + c;
    };

    const initials = getInitials(name);
    const bgColor = `#${intToRGB(hashString(name))}`;
    
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
            <rect width="128" height="128" fill="${bgColor}" />
            <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="64" fill="#FFFFFF" text-anchor="middle" dy=".3em">${initials}</text>
        </svg>
    `;

    // btoa is deprecated in Node but fine in browsers.
    return `data:image/svg+xml;base64,${btoa(svg)}`;
};