const LOCAL_LOOPBACK_HOST = "127.0.0.1";
const ALLOWED_LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost"]);

function cleanText(value) {
	if (typeof value !== "string") return "";
	return value.trim();
}

export function normalizeServerHost(input) {
	const candidate = cleanText(input).toLowerCase();
	if (!candidate) return LOCAL_LOOPBACK_HOST;
	if (!ALLOWED_LOOPBACK_HOSTS.has(candidate)) return LOCAL_LOOPBACK_HOST;
	return candidate === "localhost" ? LOCAL_LOOPBACK_HOST : candidate;
}

export function isAllowedCorsOrigin(origin) {
	const value = cleanText(origin);
	if (!value) return false;

	if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(value)) {
		return true;
	}
	if (/^tauri:\/\/localhost$/i.test(value)) {
		return true;
	}
	if (/^https?:\/\/tauri\.localhost(:\d+)?$/i.test(value)) {
		return true;
	}
	return false;
}
