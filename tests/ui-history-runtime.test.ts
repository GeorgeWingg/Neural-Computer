import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createUiHistoryRuntime } from "../services/uiHistoryRuntime.mjs";

const tempRoots = [];

async function makeTempRoot() {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "neural-computer-ui-history-"));
	tempRoots.push(root);
	return root;
}

async function waitFor(check, options = {}) {
	const timeoutMs = Number.isFinite(options.timeoutMs) ? Number(options.timeoutMs) : 2_000;
	const intervalMs = Number.isFinite(options.intervalMs) ? Number(options.intervalMs) : 25;
	const startedAt = Date.now();

	for (;;) {
		try {
			// eslint-disable-next-line no-await-in-loop
			await check();
			return;
		} catch (error) {
			if (Date.now() - startedAt >= timeoutMs) throw error;
			// eslint-disable-next-line no-await-in-loop
			await new Promise((resolve) => setTimeout(resolve, intervalMs));
		}
	}
}

afterEach(async () => {
	await Promise.all(
		tempRoots.splice(0, tempRoots.length).map(async (root) => {
			await fs.rm(root, { recursive: true, force: true });
		}),
	);
});

describe("ui history runtime", () => {
	it("persists emit_screen revisions into day buckets with timeline metadata", async () => {
		const workspaceRoot = await makeTempRoot();
		const runtime = createUiHistoryRuntime({ retentionDays: 14 });
		const now = new Date("2026-02-17T12:34:56.789Z");

		const result = await runtime.persistEmitScreenRevision({
			workspaceRoot,
			html: "<div>hello ui history</div>",
			revision: 3,
			isFinal: true,
			revisionNote: "final pass",
			appContext: "desktop_env",
			toolCallId: "tool_123",
			sessionId: "session_abc",
			interaction: {
				id: "interaction_1",
				traceId: "trace_1",
				uiSessionId: "ui_session_1",
				eventSeq: 12,
			},
			now,
		});

		expect(result.persisted).toBe(true);
		expect(result.event.emitRevision).toBe(3);
		expect(result.event.timestampIso).toBe("2026-02-17T12:34:56.789Z");
		expect(result.event.htmlPath).toContain(".neural/ui-history/2026-02-17/snapshots/");

		const snapshotPath = path.join(workspaceRoot, result.event.htmlPath);
		const snapshot = await fs.readFile(snapshotPath, "utf8");
		expect(snapshot).toBe("<div>hello ui history</div>");

		const eventsPath = path.join(workspaceRoot, ".neural", "ui-history", "2026-02-17", "events.jsonl");
		const eventsJsonl = await fs.readFile(eventsPath, "utf8");
		const rows = eventsJsonl
			.split("\n")
			.map((row) => row.trim())
			.filter(Boolean)
			.map((row) => JSON.parse(row));
		expect(rows).toHaveLength(1);
		expect(rows[0].interactionId).toBe("interaction_1");
		expect(rows[0].traceId).toBe("trace_1");
		expect(rows[0].appContext).toBe("desktop_env");
		expect(rows[0].isFinal).toBe(true);
	});

	it("prunes day folders older than retention window", async () => {
		const workspaceRoot = await makeTempRoot();
		const historyRoot = path.join(workspaceRoot, ".neural", "ui-history");
		await fs.mkdir(path.join(historyRoot, "2026-02-10"), { recursive: true });
		await fs.mkdir(path.join(historyRoot, "2026-02-16"), { recursive: true });
		await fs.mkdir(path.join(historyRoot, "invalid-folder"), { recursive: true });

		const runtime = createUiHistoryRuntime({ retentionDays: 2 });
		await runtime.persistEmitScreenRevision({
			workspaceRoot,
			html: "<div>retain recent folders</div>",
			revision: 1,
			now: new Date("2026-02-17T08:00:00.000Z"),
		});

		await waitFor(async () => {
			await fs.access(path.join(historyRoot, "2026-02-16"));
			await fs.access(path.join(historyRoot, "2026-02-17"));
			await fs.access(path.join(historyRoot, "invalid-folder"));
			let oldExists = true;
			try {
				await fs.access(path.join(historyRoot, "2026-02-10"));
			} catch {
				oldExists = false;
			}
			expect(oldExists).toBe(false);
		});
	});

	it("skips persistence when html is empty", async () => {
		const workspaceRoot = await makeTempRoot();
		const runtime = createUiHistoryRuntime({ retentionDays: 7 });
		const result = await runtime.persistEmitScreenRevision({
			workspaceRoot,
			html: "   ",
			revision: 2,
		});

		expect(result).toEqual({
			persisted: false,
			reason: "empty_html",
		});

		let hasHistoryRoot = true;
		try {
			await fs.access(path.join(workspaceRoot, ".neural", "ui-history"));
		} catch {
			hasHistoryRoot = false;
		}
		expect(hasHistoryRoot).toBe(false);
	});
});
