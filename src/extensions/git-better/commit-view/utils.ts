import * as crypto from 'crypto';

export function timeAgo(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    const intervals: [number, string][] = [
        [31536000, 'years'], [2592000, 'months'], [86400, 'days'],
        [3600, 'hours'], [60, 'minutes']
    ];
    for (const [sec, name] of intervals) {
        const count = Math.floor(seconds / sec);
        if (count >= 1) { return `${count} ${name} ago`; }
    }
    return 'just now';
}

export function formatDate(date: Date): string {
    return date.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true });
}

export function debounce<A extends any[]>(f: (...args: A) => void, delay: number): (...args: A) => void {
    let timeoutId: NodeJS.Timeout | undefined;
    return (...args: A) => {
        if (timeoutId) { clearTimeout(timeoutId); }
        timeoutId = setTimeout(() => f(...args), delay);
    };
}

export function getGravatarUrl(email: string, size: number = 24): string {
    const hash = crypto.createHash('md5').update(email.trim().toLowerCase()).digest('hex');
    return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=retro`;
}
