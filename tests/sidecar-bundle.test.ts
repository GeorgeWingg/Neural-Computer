import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const isMac = process.platform === "darwin";

const maybeIt = isMac ? it : it.skip;
const activeChildren = new Set<ReturnType<typeof spawn>>();

function getBundlePaths() {
	const sidecarScript = path.join(repoRoot, "src-tauri", "sidecar", "server.bundle.cjs");
	const nodeBinary =
		process.arch === "arm64"
			? path.join(repoRoot, "src-tauri", "binaries", "neural-os-node-aarch64-apple-darwin")
			: path.join(repoRoot, "src-tauri", "binaries", "neural-os-node-x86_64-apple-darwin");
	return { sidecarScript, nodeBinary };
}

async function reservePort(): Promise<number> {
	return await new Promise((resolve, reject) => {
		const server = net.createServer();
		server.on("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			if (!address || typeof address === "string") {
				reject(new Error("failed to reserve ephemeral port"));
				return;
			}
			const port = address.port;
			server.close((error) => {
				if (error) reject(error);
				else resolve(port);
			});
		});
	});
}

async function waitForHealth(url: string, timeoutMs: number): Promise<any> {
	const startedAt = Date.now();
	let lastError: unknown = null;

	while (Date.now() - startedAt < timeoutMs) {
		try {
			const response = await fetch(url);
			if (!response.ok) {
				lastError = new Error(`HTTP ${response.status}`);
			} else {
				return await response.json();
			}
		} catch (error) {
			lastError = error;
		}
		await new Promise((resolve) => setTimeout(resolve, 120));
	}

	throw lastError instanceof Error
		? lastError
		: new Error("timed out waiting for sidecar /api/health");
}

async function terminateChild(child: ReturnType<typeof spawn>) {
	if (child.exitCode !== null) return;
	child.kill("SIGTERM");
	await new Promise<void>((resolve) => {
		const timer = setTimeout(() => {
			if (child.exitCode === null) child.kill("SIGKILL");
		}, 1000);
		child.once("exit", () => {
			clearTimeout(timer);
			resolve();
		});
	});
}

afterEach(async () => {
	await Promise.all(Array.from(activeChildren).map(async (child) => terminateChild(child)));
	activeChildren.clear();
});

describe("sidecar bundle smoke", () => {
	maybeIt("boots with bundled node binary and serves /api/health", async () => {
		const { sidecarScript, nodeBinary } = getBundlePaths();
		await fs.access(sidecarScript);
		await fs.access(nodeBinary);

		const port = await reservePort();
		const stdoutChunks: string[] = [];
		const stderrChunks: string[] = [];

		const child = spawn(nodeBinary, [sidecarScript], {
			cwd: repoRoot,
			env: {
				...process.env,
				NEURAL_OS_SERVER_PORT: String(port),
				NEURAL_COMPUTER_SERVER_PORT: String(port),
			},
			stdio: ["ignore", "pipe", "pipe"],
		});
		activeChildren.add(child);

		child.stdout?.on("data", (chunk) => stdoutChunks.push(String(chunk)));
		child.stderr?.on("data", (chunk) => stderrChunks.push(String(chunk)));

		if (child.exitCode !== null && child.exitCode !== 0) {
			throw new Error(
				`sidecar exited immediately with code ${child.exitCode}\nstdout:\n${stdoutChunks.join("")}\nstderr:\n${stderrChunks.join("")}`,
			);
		}

		let healthPayload: any = null;
		try {
			healthPayload = await waitForHealth(`http://127.0.0.1:${port}/api/health`, 8000);
		} catch (error) {
			const joinedStdout = stdoutChunks.join("");
			const joinedStderr = stderrChunks.join("");
			throw new Error(
				`sidecar did not become healthy: ${error instanceof Error ? error.message : String(error)}\nstdout:\n${joinedStdout}\nstderr:\n${joinedStderr}`,
			);
		}

		expect(healthPayload?.ok).toBe(true);
	}, 20_000);
});
