export function checkBlacklistedTarget(target: string) {
	return ["genius.com", "127.0.0.1", "localhost", "[::1]"].find(v => target.includes(v));
}

export function isValidURL(target: string) {
	try {
		new URL(target);
		return true;
	} catch {
		return false;
	}
}
