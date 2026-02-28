import * as crypto from 'crypto';

export function getGravatarUrl(email: string, size: number = 24): string {
    const trimmedEmail = email.trim().toLowerCase();
    const hash = crypto.createHash('md5').update(trimmedEmail).digest('hex');
    return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=retro`;
}
