import { describe, expect, it } from "vitest";
import { isAllowedCorsOrigin, normalizeServerHost } from "../services/serverNetworkPolicy.mjs";

describe("server network policy", () => {
	it("normalizes host to loopback-only values", () => {
		expect(normalizeServerHost("127.0.0.1")).toBe("127.0.0.1");
		expect(normalizeServerHost("localhost")).toBe("127.0.0.1");
		expect(normalizeServerHost("0.0.0.0")).toBe("127.0.0.1");
		expect(normalizeServerHost("")).toBe("127.0.0.1");
	});

	it("allows localhost web origins", () => {
		expect(isAllowedCorsOrigin("http://localhost:3000")).toBe(true);
		expect(isAllowedCorsOrigin("http://127.0.0.1:5173")).toBe(true);
		expect(isAllowedCorsOrigin("https://localhost")).toBe(true);
	});

	it("allows tauri runtime origins", () => {
		expect(isAllowedCorsOrigin("tauri://localhost")).toBe(true);
		expect(isAllowedCorsOrigin("https://tauri.localhost")).toBe(true);
	});

	it("rejects non-local origins", () => {
		expect(isAllowedCorsOrigin("https://example.com")).toBe(false);
		expect(isAllowedCorsOrigin("http://192.168.1.10:3000")).toBe(false);
		expect(isAllowedCorsOrigin("")).toBe(false);
	});
});
