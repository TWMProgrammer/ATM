const form = document.querySelector<HTMLFormElement>('#browser-search-form');
const input = document.querySelector<HTMLInputElement>('#browser-search-input');

form?.addEventListener('submit', (event) => {
	event.preventDefault();

	const query = input?.value.trim();
	if (!query) { return; }

	const target = query.includes('.') && !query.includes(' ')
		? normalizeUrl(query)
		: `https://www.google.com/search?q=${encodeURIComponent(query)}`;

	input!.value = target;
});

function normalizeUrl(value: string): string {
	if (/^https?:\/\//i.test(value)) {
		return value;
	}

	return `https://${value}`;
}
