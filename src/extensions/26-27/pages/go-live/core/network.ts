'use strict';

import * as os from 'os';

// ======================================
// GO LIVE — NETWORK HELPERS | MARK: NETWORK
// ======================================
//
// Replaces the old `ips` dependency: the first non-internal IPv4 address is
// all we need to show a "reachable on your LAN" URL in the status bar tooltip.

/** First non-internal IPv4 address, or undefined when only loopback exists. */
export function getLanAddress(): string | undefined {
	const interfaces = os.networkInterfaces();
	for (const name of Object.keys(interfaces)) {
		for (const net of interfaces[name] ?? []) {
			// Node <18 typed `family` as a string ('IPv4'); newer versions use the
			// number 4. Accept both so the helper works across engines.
			const isIPv4 = net.family === 'IPv4' || (net.family as unknown as number) === 4;
			if (isIPv4 && !net.internal) {
				return net.address;
			}
		}
	}
	return undefined;
}

/** True for hosts that only accept loopback connections. */
export function isLoopbackHost(host: string): boolean {
	return host === '127.0.0.1' || host === 'localhost' || host === '::1';
}
