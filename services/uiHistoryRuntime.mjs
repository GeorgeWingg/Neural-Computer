import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RETENTION_DAYS = 21;
const MIN_RETENTION_DAYS = 1;
const MAX_RETENTION_DAYS = 365;
const RETENTION_SWEEP_INTERVAL_MS = 60 * 60 * 1000;
const MAX_REVISION_NOTE_CHARS = 200;

function normalizeText(value) {
	if (typeof value === "string") return value.trim();
	if (value === null || value === undefined) return "";
	return String(value).trim();
}

function clampInt(value, { min = undefined, max = undefined, fallback = 0 } = {}) {
	let next = Number(value);
	if (!Number.isFinite(next)) next = fallback;
	if (Number.isFinite(min)) next = Math.max(min, next);
	if (Number.isFinite(max)) next = Math.min(max, next);
	return Math.floor(next);
}

function dayKeyUtc(date = new Date()) {
	const source = date instanceof Date ? date : new Date(date);
	const year = source.getUTCFullYear();
	const month = String(source.getUTCMonth() + 1).padStart(2, "0");
	const day = String(source.getUTCDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function sanitizeTimestampForFileName(isoTimestamp) {
	return normalizeText(isoTimestamp).replace(/[:.]/g, "-");
}

function formatRevisionToken(revision) {
	const normalized = clampInt(revision, { min: 1, max: 999_999, fallback: 1 });
	return String(normalized).padStart(6, "0");
}

function toOptionalNumber(value) {
	const numeric = Number(value);
	return Number.isFinite(numeric) ? numeric : undefined;
}

function normalizeInteractionMetadata(interaction) {
	const source = interaction && typeof interaction === "object" ? interaction : {};
	const traceId = normalizeText(source.traceId) || undefined;
	const interactionId = normalizeText(source.id) || undefined;
	const uiSessionId = normalizeText(source.uiSessionId) || undefined;
	const appContext = normalizeText(source.appContext) || undefined;
	const eventSeq = toOptionalNumber(source.eventSeq);
	return {
		traceId,
		interactionId,
		uiSessionId,
		appContext,
		eventSeq,
	};
}

function buildHistoryPaths(workspaceRoot, dayKey) {
	const canonicalWorkspaceRoot = path.resolve(normalizeText(workspaceRoot) || ".");
	const historyRoot = path.join(canonicalWorkspaceRoot, ".neural", "ui-history");
	const dayDir = path.join(historyRoot, dayKey);
	const snapshotsDir = path.join(dayDir, "snapshots");
	return {
		canonicalWorkspaceRoot,
		historyRoot,
		dayDir,
		snapshotsDir,
		eventsPath: path.join(dayDir, "events.jsonl"),
	};
}

function buildSnapshotRelativePath(dayKey, fileName) {
	return path.posix.join(".neural", "ui-history", dayKey, "snapshots", fileName);
}

async function pruneExpiredDayDirectories({ historyRoot, retentionDays, now }) {
	const nowDate = now instanceof Date ? now : new Date();
	const oldestKeptDayKey = dayKeyUtc(new Date(nowDate.getTime() - Math.max(0, retentionDays - 1) * DAY_MS));

	let entries = [];
	try {
		entries = await fs.readdir(historyRoot, { withFileTypes: true });
	} catch {
		return { removed: 0 };
	}

	let removed = 0;
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const dayKey = normalizeText(entry.name);
		if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) continue;
		if (dayKey >= oldestKeptDayKey) continue;
		// eslint-disable-next-line no-await-in-loop
		await fs.rm(path.join(historyRoot, dayKey), { recursive: true, force: true });
		removed += 1;
	}
	return { removed };
}

export function createUiHistoryRuntime(config = {}) {
	const enabled = config.enabled !== false;
	const retentionDays = clampInt(config.retentionDays, {
		min: MIN_RETENTION_DAYS,
		max: MAX_RETENTION_DAYS,
		fallback: DEFAULT_RETENTION_DAYS,
	});
	const logger = config.logger && typeof config.logger.warn === "function" ? config.logger : console;
	let retentionSweepInFlight = false;
	let lastRetentionSweepAtMs = 0;

	const maybeRunRetentionSweep = async (historyRoot, now) => {
		if (!enabled) return;
		const nowMs = now instanceof Date ? now.getTime() : Date.now();
		if (retentionSweepInFlight) return;
		if (nowMs - lastRetentionSweepAtMs < RETENTION_SWEEP_INTERVAL_MS) return;
		retentionSweepInFlight = true;
		lastRetentionSweepAtMs = nowMs;
		try {
			await pruneExpiredDayDirectories({
				historyRoot,
				retentionDays,
				now: now instanceof Date ? now : new Date(nowMs),
			});
		} catch (error) {
			logger.warn("[UiHistoryRuntime] retention sweep failed", error instanceof Error ? error.message : String(error));
		} finally {
			retentionSweepInFlight = false;
		}
	};

	const persistEmitScreenRevision = async ({
		workspaceRoot,
		html,
		revision,
		isFinal,
		revisionNote,
		appContext,
		toolCallId,
		sessionId,
		interaction,
		now,
	} = {}) => {
		if (!enabled) return { persisted: false, reason: "disabled" };
		const normalizedHtml = typeof html === "string" ? html : "";
		if (!normalizedHtml.trim()) return { persisted: false, reason: "empty_html" };

		const timestamp = now instanceof Date ? now : new Date();
		const timestampIso = timestamp.toISOString();
		const dayKey = dayKeyUtc(timestamp);
		const paths = buildHistoryPaths(workspaceRoot, dayKey);
		const normalizedRevision = clampInt(revision, { min: 1, max: 999_999, fallback: 1 });
		const htmlSha256 = crypto.createHash("sha256").update(normalizedHtml).digest("hex");
		const snapshotName = `${sanitizeTimestampForFileName(timestampIso)}_r${formatRevisionToken(
			normalizedRevision,
		)}_${htmlSha256.slice(0, 8)}.html`;
		const snapshotAbsolutePath = path.join(paths.snapshotsDir, snapshotName);
		const snapshotRelativePath = buildSnapshotRelativePath(dayKey, snapshotName);

		await fs.mkdir(paths.snapshotsDir, { recursive: true });
		await fs.writeFile(snapshotAbsolutePath, normalizedHtml, "utf8");

		const interactionMeta = normalizeInteractionMetadata(interaction);
		const normalizedRevisionNote = normalizeText(revisionNote).slice(0, MAX_REVISION_NOTE_CHARS) || undefined;
		const payload = {
			timestampIso,
			createdAtMs: timestamp.getTime(),
			event: "emit_screen_revision",
			sessionId: normalizeText(sessionId) || undefined,
			traceId: interactionMeta.traceId,
			interactionId: interactionMeta.interactionId,
			uiSessionId: interactionMeta.uiSessionId,
			eventSeq: interactionMeta.eventSeq,
			appContext: normalizeText(appContext) || interactionMeta.appContext || undefined,
			emitRevision: normalizedRevision,
			isFinal: Boolean(isFinal),
			revisionNote: normalizedRevisionNote,
			toolCallId: normalizeText(toolCallId) || undefined,
			htmlChars: normalizedHtml.length,
			htmlSha256,
			htmlPath: snapshotRelativePath,
		};

		await fs.appendFile(paths.eventsPath, `${JSON.stringify(payload)}\n`, "utf8");
		void maybeRunRetentionSweep(paths.historyRoot, timestamp);

		return {
			persisted: true,
			event: payload,
		};
	};

	return {
		enabled,
		retentionDays,
		persistEmitScreenRevision,
	};
}
