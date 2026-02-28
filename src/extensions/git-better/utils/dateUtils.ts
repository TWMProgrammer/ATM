export function timeAgo(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

    let interval = seconds / 31536000;
    if (interval > 1) {return Math.floor(interval) + ' years ago';}
    
    interval = seconds / 2592000;
    if (interval > 1) {return Math.floor(interval) + ' months ago';}
    
    interval = seconds / 86400;
    if (interval > 1) {return Math.floor(interval) + ' days ago';}
    
    interval = seconds / 3600;
    if (interval > 1) {return Math.floor(interval) + ' hours ago';}
    
    interval = seconds / 60;
    if (interval > 1) {return Math.floor(interval) + ' minutes ago';}
    
    return 'just now';
}

export function formatDate(date: Date): string {
    return date.toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
    });
}
