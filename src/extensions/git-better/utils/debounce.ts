export function debounce<A extends any[]>(
    f: (...args: A) => void,
    delay: number
): (...args: A) => void {
    let timeoutId: NodeJS.Timeout | undefined;

    return (...args: A) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => f(...args), delay);
    };
}
