import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	completeSimple,
	getEnvApiKey,
	getModel,
	getModels,
	getProviders,
	streamSimple,
	Type,
} from "@mariozechner/pi-ai";

const app = express();
app.use(express.json({ limit: "2mb" }));

const PORT = Number(process.env.GEMINI_OS_SERVER_PORT || 8787);
const PREFERRED_MODEL = "gemini-3-flash-preview";
const DEFAULT_PROVIDER = "google";
const DEFAULT_MODEL = PREFERRED_MODEL;
const MAX_TOOL_TURNS = 5;
const PROJECT_AUTH_FILE = path.join(process.cwd(), "auth.json");
const CODEX_AUTH_FILE = path.join(process.env.HOME || "", ".codex", "auth.json");

const sessionCredentials = new Map();

const settingsAllowedKeys = [
	"detailLevel",
	"colorTheme",
	"speedMode",
	"enableAnimations",
	"maxHistoryLength",
	"isStatefulnessEnabled",
	"qualityAutoRetryEnabled",
	"customSystemPrompt",
	"googleSearchApiKey",
	"googleSearchCx",
	"providerId",
	"modelId",
	"toolTier",
];

function loadDotEnvFiles() {
	const baseDir = path.dirname(fileURLToPath(import.meta.url));
	const candidates = [".env.local", ".env"];
	for (const fileName of candidates) {
		const envPath = path.join(baseDir, fileName);
		if (!fs.existsSync(envPath)) continue;
		const source = fs.readFileSync(envPath, "utf8");
		for (const rawLine of source.split(/\r?\n/)) {
			const line = rawLine.trim();
			if (!line || line.startsWith("#")) continue;
			const sep = line.indexOf("=");
			if (sep <= 0) continue;
			const key = line.slice(0, sep).trim();
			if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
			if (process.env[key] !== undefined) continue;
			let value = line.slice(sep + 1).trim();
			if (
				(value.startsWith("\"") && value.endsWith("\"")) ||
				(value.startsWith("'") && value.endsWith("'"))
			) {
				value = value.slice(1, -1);
			}
			process.env[key] = value;
		}
	}
}

function normalizeToolTier(toolTier) {
	if (toolTier === "none" || toolTier === "standard" || toolTier === "experimental") {
		return toolTier;
	}
	return "standard";
}

function createApiError(status, code, message, details) {
	return { status, code, message, details };
}

function sendApiError(res, error) {
	res.status(error.status).json({
		ok: false,
		error: {
			code: error.code,
			message: error.message,
			details: error.details,
		},
	});
}

function listProviders() {
	try {
		const providers = getProviders();
		return Array.isArray(providers) ? providers : [DEFAULT_PROVIDER];
	} catch {
		return [DEFAULT_PROVIDER];
	}
}

function getModelsForProvider(providerId) {
	try {
		const models = getModels(providerId);
		return Array.isArray(models) ? models : [];
	} catch {
		return [];
	}
}

function tryGetModel(providerId, modelId) {
	try {
		const model = getModel(providerId, modelId);
		if (!model || model.id !== modelId) return undefined;
		return model;
	} catch {
		return undefined;
	}
}

function pickDefaultProvider(providers) {
	if (providers.includes(DEFAULT_PROVIDER)) return DEFAULT_PROVIDER;
	return providers[0] || DEFAULT_PROVIDER;
}

function normalizeProviderRuntimeError(message, providerId) {
	const safeMessage = String(message || "Model stream error.");
	if (providerId === "openai-codex" && /extract accountid from token/i.test(safeMessage)) {
		return "Invalid API key format for provider 'openai-codex'. Use a Codex account token, or switch provider to 'openai' for standard OpenAI API keys.";
	}
	return safeMessage;
}

function decodeJwtPayload(token) {
	if (typeof token !== "string") return null;
	const parts = token.split(".");
	if (parts.length !== 3) return null;
	try {
		const base64Url = parts[1];
		const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
		const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
		const json = Buffer.from(padded, "base64").toString("utf8");
		return JSON.parse(json);
	} catch {
		return null;
	}
}

function isEpochMsExpired(expiresAtMs) {
	if (typeof expiresAtMs !== "number" || !Number.isFinite(expiresAtMs)) return false;
	return Date.now() >= expiresAtMs - 30_000;
}

function isJwtExpired(token) {
	const payload = decodeJwtPayload(token);
	if (!payload || typeof payload.exp !== "number") return false;
	return Date.now() >= payload.exp * 1000 - 30_000;
}

function readJsonFile(filePath) {
	try {
		if (!filePath || !fs.existsSync(filePath)) return null;
		const raw = fs.readFileSync(filePath, "utf8");
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

function getCodexTokenFromProjectAuthFile() {
	const data = readJsonFile(PROJECT_AUTH_FILE);
	if (!data || typeof data !== "object") return undefined;
	const oauthCredentials = data["openai-codex"];
	if (!oauthCredentials || typeof oauthCredentials !== "object") return undefined;
	const access = typeof oauthCredentials.access === "string" ? oauthCredentials.access.trim() : "";
	if (!access) return undefined;
	if (isEpochMsExpired(oauthCredentials.expires)) return undefined;
	return access;
}

function getCodexTokenFromCodexAuthFile() {
	const data = readJsonFile(CODEX_AUTH_FILE);
	if (!data || typeof data !== "object") return undefined;
	const access = typeof data?.tokens?.access_token === "string" ? data.tokens.access_token.trim() : "";
	if (!access) return undefined;
	if (isJwtExpired(access)) return undefined;
	return access;
}

function getCodexOauthToken() {
	return getCodexTokenFromProjectAuthFile() || getCodexTokenFromCodexAuthFile();
}

function looksLikeCodexOauthToken(token) {
	if (typeof token !== "string") return false;
	const payload = decodeJwtPayload(token);
	if (!payload || typeof payload !== "object") return false;
	const authClaim = payload["https://api.openai.com/auth"];
	if (!authClaim || typeof authClaim !== "object") return false;
	const accountId = authClaim.chatgpt_account_id;
	return typeof accountId === "string" && accountId.length > 0;
}

function normalizeLlmConfig(llmConfig) {
	const providers = listProviders();
	const fallbackProvider = pickDefaultProvider(providers);
	const hasProvider = typeof llmConfig?.providerId === "string" && llmConfig.providerId.trim().length > 0;
	const requestedProvider = hasProvider ? llmConfig.providerId.trim() : fallbackProvider;

	if (!providers.includes(requestedProvider)) {
		return {
			error: createApiError(400, "INVALID_PROVIDER", `Provider '${requestedProvider}' is not supported.`, {
				requestedProvider,
				availableProviders: providers,
			}),
		};
	}

	const models = getModelsForProvider(requestedProvider);
	if (!models.length) {
		return {
			error: createApiError(
				400,
				"PROVIDER_HAS_NO_MODELS",
				`Provider '${requestedProvider}' has no available models in this runtime.`,
				{ requestedProvider },
			),
		};
	}

	const hasModel = typeof llmConfig?.modelId === "string" && llmConfig.modelId.trim().length > 0;
	const requestedModel = hasModel ? llmConfig.modelId.trim() : "";
	let model = hasModel ? tryGetModel(requestedProvider, requestedModel) : undefined;

	if (!model && hasModel) {
		return {
			error: createApiError(
				400,
				"INVALID_MODEL",
				`Model '${requestedModel}' is not available for provider '${requestedProvider}'.`,
				{
					requestedProvider,
					requestedModel,
					availableModels: models.map((entry) => entry.id),
				},
			),
		};
	}

	if (!model) {
		model =
			tryGetModel(requestedProvider, DEFAULT_MODEL) ||
			models[0] ||
			tryGetModel(DEFAULT_PROVIDER, DEFAULT_MODEL) ||
			getModelsForProvider(DEFAULT_PROVIDER)[0];
	}

	if (!model) {
		return {
			error: createApiError(
				500,
				"NO_RESOLVABLE_MODEL",
				"No model could be resolved from the current provider catalog.",
				{
					requestedProvider,
					requestedModel: requestedModel || null,
				},
			),
		};
	}

	return {
		value: {
			providerId: requestedProvider,
			modelId: model.id,
			toolTier: normalizeToolTier(llmConfig?.toolTier),
		},
		model,
	};
}

function getCatalogProviders() {
	return listProviders()
		.map((providerId) => {
			const models = getModelsForProvider(providerId).map((model) => ({
				id: model.id,
				name: model.name || model.id,
				api: model.api,
				reasoning: model.reasoning,
				input: model.input,
			}));
			if (!models.length) return null;
			return { providerId, models };
		})
		.filter(Boolean);
}

function getGoogleFallbackApiKey() {
	const candidates = [
		process.env.GEMINI_API_KEY,
		process.env.GOOGLE_API_KEY,
		process.env.GOOGLE_GENERATIVE_AI_API_KEY,
		process.env.GOOGLE_AI_API_KEY,
	];
	for (const candidate of candidates) {
		if (candidate && String(candidate).trim()) return String(candidate).trim();
	}
	return undefined;
}

loadDotEnvFiles();

const googleSearchTool = {
	name: "google_search",
	description: "Search the web with Google Custom Search and return top results.",
	parameters: Type.Object({
		query: Type.String({ description: "Search query" }),
		count: Type.Optional(Type.Number({ description: "Maximum number of results", minimum: 1, maximum: 10 })),
	}),
};

const defaultSettingsSchema = {
	version: "1.0.0",
	title: "Gemini OS Settings",
	description: "Configure model behavior, personalization, and tool policy.",
	generatedBy: "fallback_settings_skill",
	sections: [
		{
			id: "experience",
			title: "Experience",
			fields: [
				{ key: "detailLevel", label: "Detail Level", control: "select" },
				{ key: "colorTheme", label: "Color Theme", control: "select" },
				{ key: "speedMode", label: "Speed Mode", control: "select" },
					{ key: "enableAnimations", label: "Enable Animations", control: "toggle" },
					{ key: "maxHistoryLength", label: "Interaction History Length", control: "number", min: 0, max: 10 },
					{ key: "isStatefulnessEnabled", label: "Statefulness", control: "toggle" },
					{ key: "qualityAutoRetryEnabled", label: "Auto Retry On Low Quality", control: "toggle" },
				],
			},
		{
			id: "model",
			title: "Model Runtime",
			fields: [
				{ key: "providerId", label: "Provider", control: "select" },
				{ key: "modelId", label: "Model", control: "select" },
				{ key: "toolTier", label: "Tool Access Tier", control: "select" },
			],
		},
		{
			id: "advanced",
			title: "Advanced",
			fields: [
				{ key: "googleSearchApiKey", label: "Google Search API Key", control: "password" },
				{ key: "googleSearchCx", label: "Google Search CX", control: "text" },
				{ key: "customSystemPrompt", label: "Custom System Prompt", control: "textarea" },
			],
		},
	],
};

function getSessionStore(sessionId) {
	if (!sessionCredentials.has(sessionId)) {
		sessionCredentials.set(sessionId, {});
	}
	return sessionCredentials.get(sessionId);
}

function resolveApiKey(sessionId, providerId) {
	const normalizedProvider = providerId || DEFAULT_PROVIDER;
	const store = sessionId ? sessionCredentials.get(sessionId) || {} : {};
	const fromSession = store[normalizedProvider];
	if (fromSession && String(fromSession).trim()) {
		const candidate = String(fromSession).trim();
		if (normalizedProvider !== "openai-codex" || looksLikeCodexOauthToken(candidate)) {
			return candidate;
		}
	}
	if (normalizedProvider === "openai-codex") {
		const fromCodexOauth = getCodexOauthToken();
		if (fromCodexOauth) return fromCodexOauth;
	}
	const fromPiEnv = getEnvApiKey(normalizedProvider);
	if (fromPiEnv && String(fromPiEnv).trim()) return String(fromPiEnv).trim();
	if (normalizedProvider === "google") return getGoogleFallbackApiKey();
	return undefined;
}

function resolveModel(providerId, modelId) {
	return (
		tryGetModel(providerId, modelId) ||
		tryGetModel(providerId, DEFAULT_MODEL) ||
		tryGetModel(DEFAULT_PROVIDER, DEFAULT_MODEL) ||
		getModelsForProvider(DEFAULT_PROVIDER)[0] ||
		getModel(DEFAULT_PROVIDER, DEFAULT_MODEL)
	);
}

function reasoningFromSpeed(speedMode) {
	if (speedMode === "fast") return "minimal";
	if (speedMode === "quality") return "high";
	return "medium";
}

function writeChunk(res, payload) {
	res.write(`${JSON.stringify(payload)}\n`);
}

function extractTextBlocks(message) {
	if (!message || !Array.isArray(message.content)) return "";
	return message.content
		.filter((block) => block.type === "text")
		.map((block) => block.text)
		.join("");
}

function extractJsonObject(text) {
	if (!text) return null;
	const fenceMatch = text.match(/```json\s*([\s\S]*?)```/i);
	if (fenceMatch && fenceMatch[1]) {
		try {
			return JSON.parse(fenceMatch[1].trim());
		} catch {
			// Keep trying with brace parser below.
		}
	}

	const start = text.indexOf("{");
	if (start < 0) return null;

	let depth = 0;
	let inString = false;
	let escape = false;
	for (let i = start; i < text.length; i += 1) {
		const ch = text[i];
		if (inString) {
			if (escape) {
				escape = false;
			} else if (ch === "\\") {
				escape = true;
			} else if (ch === "\"") {
				inString = false;
			}
			continue;
		}

		if (ch === "\"") {
			inString = true;
			continue;
		}
		if (ch === "{") depth += 1;
		if (ch === "}") depth -= 1;
		if (depth === 0) {
			const candidate = text.slice(start, i + 1);
			try {
				return JSON.parse(candidate);
			} catch {
				return null;
			}
		}
	}

	return null;
}

function validateSettingsSchema(schema) {
	if (!schema || typeof schema !== "object") return false;
	if (!Array.isArray(schema.sections)) return false;

	for (const section of schema.sections) {
		if (!section || typeof section !== "object") return false;
		if (!Array.isArray(section.fields)) return false;
		for (const field of section.fields) {
			if (!field || typeof field !== "object") return false;
			if (!settingsAllowedKeys.includes(field.key)) return false;
			if (typeof field.label !== "string" || !field.label.trim()) return false;
			if (typeof field.control !== "string") return false;
		}
	}
	return true;
}

function buildSettingsSkillPrompt({ styleConfig, llmConfig }) {
	return [
		"You are `render_settings_skill` for Gemini OS.",
		"Output ONLY valid JSON. No markdown. No comments.",
		"Generate a settings schema describing sections and fields for the host to render.",
		`Allowed field keys: ${settingsAllowedKeys.join(", ")}`,
		"Rules:",
		"- Include every important field at least once.",
		"- Use concise labels and practical ordering.",
		"- Avoid fake hardware/system diagnostics content.",
		"- Keep it configuration-focused.",
		"",
		"Current settings snapshot:",
		JSON.stringify({ styleConfig, llmConfig }, null, 2),
		"",
		"Return JSON in this shape:",
		JSON.stringify(defaultSettingsSchema, null, 2),
	].join("\n");
}

async function runGoogleSearch(query, apiKey, cx, count = 5) {
	if (!apiKey || !cx) {
		return { ok: false, message: "Google Search API key or CX missing in settings." };
	}

	const url = new URL("https://www.googleapis.com/customsearch/v1");
	url.searchParams.append("key", apiKey);
	url.searchParams.append("cx", cx);
	url.searchParams.append("q", query);
	url.searchParams.append("num", String(Math.max(1, Math.min(10, Number(count) || 5))));
	url.searchParams.append("safe", "active");

	try {
		const response = await fetch(url.toString());
		if (!response.ok) {
			return { ok: false, message: `Google Search API error (${response.status}).` };
		}
		const data = await response.json();
		const items = Array.isArray(data.items)
			? data.items.map((item) => ({
					title: item.title || "",
					link: item.link || "",
					snippet: item.snippet || "",
				}))
			: [];
		return { ok: true, items };
	} catch (error) {
		return { ok: false, message: `Google Search failed: ${error instanceof Error ? error.message : String(error)}` };
	}
}

app.get("/api/health", (_req, res) => {
	const providers = listProviders();
	res.json({
		ok: true,
		mode: "pi-runtime",
		defaultModel: DEFAULT_MODEL,
		provider: DEFAULT_PROVIDER,
		availableProviders: providers,
		hasDefaultProviderApiKey: Boolean(resolveApiKey(undefined, DEFAULT_PROVIDER)),
		hasCodexOauthToken: Boolean(getCodexOauthToken()),
	});
});

app.get("/api/llm/catalog", (_req, res) => {
	const providers = getCatalogProviders();

	const fallbackProviders = providers.length
		? providers
		: [
				{
					providerId: DEFAULT_PROVIDER,
					models: [
						{
							id: DEFAULT_MODEL,
							name: DEFAULT_MODEL,
							api: "unknown",
							reasoning: true,
							input: ["text"],
						},
					],
				},
			];

	res.json({
		providers: fallbackProviders,
		defaults: {
			providerId: DEFAULT_PROVIDER,
			modelId: DEFAULT_MODEL,
		},
	});
});

app.post("/api/credentials/set", (req, res) => {
	const { sessionId, providerId, apiKey } = req.body || {};
	if (!sessionId || !providerId || !apiKey) {
		sendApiError(
			res,
			createApiError(400, "INVALID_CREDENTIAL_REQUEST", "sessionId, providerId, and apiKey are required.", {
				required: ["sessionId", "providerId", "apiKey"],
			}),
		);
		return;
	}
	const requestedProvider = String(providerId).trim();
	const providers = listProviders();
	if (!providers.includes(requestedProvider)) {
		sendApiError(
			res,
			createApiError(400, "INVALID_PROVIDER", `Provider '${requestedProvider}' is not supported.`, {
				requestedProvider,
				availableProviders: providers,
			}),
		);
		return;
	}
	const normalizedProvider = requestedProvider;
	const store = getSessionStore(sessionId);
	store[normalizedProvider] = String(apiKey).trim();
	res.json({
		ok: true,
		providerId: normalizedProvider,
	});
});

app.post("/api/credentials/remove", (req, res) => {
	const { sessionId, providerId } = req.body || {};
	if (!sessionId || !providerId) {
		sendApiError(
			res,
			createApiError(400, "INVALID_CREDENTIAL_REQUEST", "sessionId and providerId are required.", {
				required: ["sessionId", "providerId"],
			}),
		);
		return;
	}
	const requestedProvider = String(providerId).trim();
	const providers = listProviders();
	if (!providers.includes(requestedProvider)) {
		sendApiError(
			res,
			createApiError(400, "INVALID_PROVIDER", `Provider '${requestedProvider}' is not supported.`, {
				requestedProvider,
				availableProviders: providers,
			}),
		);
		return;
	}
	const normalizedProvider = requestedProvider;
	const store = getSessionStore(sessionId);
	delete store[normalizedProvider];
	res.json({ ok: true, providerId: normalizedProvider });
});

app.post("/api/settings/schema", async (req, res) => {
	const {
		sessionId,
		llmConfig = { providerId: DEFAULT_PROVIDER, modelId: DEFAULT_MODEL },
		styleConfig = {},
	} = req.body || {};

	const resolvedLlm = normalizeLlmConfig(llmConfig);
	if (resolvedLlm.error) {
		sendApiError(res, resolvedLlm.error);
		return;
	}
	const normalizedLlmConfig = resolvedLlm.value;
	const model = resolvedLlm.model || resolveModel(normalizedLlmConfig.providerId, normalizedLlmConfig.modelId);
	const apiKey = resolveApiKey(sessionId, model.provider);
	if (!apiKey) {
		res.json({
			ok: true,
			schema: {
				...defaultSettingsSchema,
				description: "API key not configured. Showing fallback settings schema.",
			},
		});
		return;
	}

	try {
		const prompt = buildSettingsSkillPrompt({ styleConfig, llmConfig: normalizedLlmConfig });
		const response = await completeSimple(
			model,
			{
				messages: [{ role: "user", content: prompt, timestamp: Date.now() }],
			},
			{
				apiKey,
				reasoning: "low",
				maxTokens: 4096,
			},
		);

		const text = extractTextBlocks(response);
		const parsed = extractJsonObject(text);
		const isValid = validateSettingsSchema(parsed);

		if (!isValid) {
			res.json({
				ok: true,
				schema: {
					...defaultSettingsSchema,
					description: "Model produced invalid settings schema. Using fallback.",
				},
			});
			return;
		}

		res.json({
			ok: true,
			schema: {
				...parsed,
				generatedBy: `${model.provider}/${model.id}`,
			},
		});
	} catch (error) {
		res.json({
			ok: true,
			schema: {
				...defaultSettingsSchema,
				description: `Settings skill fallback due to error: ${error instanceof Error ? error.message : String(error)}`,
			},
		});
	}
});

app.post("/api/llm/stream", async (req, res) => {
	const {
		sessionId,
		llmConfig = { providerId: DEFAULT_PROVIDER, modelId: DEFAULT_MODEL, toolTier: "standard" },
		systemPrompt = "",
		userMessage = "",
		speedMode = "balanced",
		googleSearchApiKey,
		googleSearchCx,
	} = req.body || {};

	const resolvedLlm = normalizeLlmConfig(llmConfig);
	if (resolvedLlm.error) {
		sendApiError(res, resolvedLlm.error);
		return;
	}
	const normalizedLlmConfig = resolvedLlm.value;
	const model = resolvedLlm.model || resolveModel(normalizedLlmConfig.providerId, normalizedLlmConfig.modelId);
	const apiKey = resolveApiKey(sessionId, model.provider);
	if (!apiKey) {
		const missingKeyHint =
			model.provider === "openai-codex"
				? "Authenticate with Codex (so ~/.codex/auth.json has tokens.access_token), or save a Codex token in Settings -> Provider Credentials."
				: "Save a provider API key in Settings -> Provider Credentials.";
		sendApiError(
			res,
			createApiError(400, "MISSING_API_KEY", `No API key configured for provider '${model.provider}'.`, {
				providerId: model.provider,
				hint: missingKeyHint,
			}),
		);
		return;
	}

	res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
	res.setHeader("Cache-Control", "no-cache, no-transform");
	res.setHeader("Connection", "keep-alive");
	res.flushHeaders();

	const controller = new AbortController();
	const abortStream = () => controller.abort();
	req.on("aborted", abortStream);
	res.on("close", () => {
		if (!res.writableEnded) abortStream();
	});

	const context = {
		systemPrompt,
		messages: [{ role: "user", content: userMessage, timestamp: Date.now() }],
		tools: normalizedLlmConfig.toolTier === "none" ? undefined : [googleSearchTool],
	};

	try {
		for (let turn = 0; turn < MAX_TOOL_TURNS; turn += 1) {
			const stream = streamSimple(model, context, {
				apiKey,
				reasoning: reasoningFromSpeed(speedMode),
				signal: controller.signal,
				maxTokens: 8192,
			});

			for await (const event of stream) {
				if (event.type === "text_delta") {
					writeChunk(res, { type: "chunk", chunk: event.delta });
				} else if (event.type === "thinking_delta") {
					writeChunk(res, { type: "thought", text: event.delta });
				} else if (event.type === "toolcall_start") {
					writeChunk(res, { type: "thought", text: "[System] Resolving tool call..." });
				} else if (event.type === "error") {
					writeChunk(res, {
						type: "error",
						error: normalizeProviderRuntimeError(event.error.errorMessage || "Model stream error.", model.provider),
					});
				}
			}

			const finalMessage = await stream.result();
			context.messages.push(finalMessage);

			if (finalMessage.stopReason !== "toolUse") {
				writeChunk(res, { type: "done" });
				res.end();
				return;
			}

			const toolCalls = finalMessage.content.filter((part) => part.type === "toolCall");
			if (!toolCalls.length) {
				writeChunk(res, { type: "done" });
				res.end();
				return;
			}

			for (const toolCall of toolCalls) {
				let toolText = "";
				let isError = false;
				if (toolCall.name === "google_search") {
					if (normalizedLlmConfig.toolTier === "none") {
						isError = true;
						toolText = "Tool access disabled by tool tier policy.";
					} else {
						const query = String(toolCall.arguments?.query || "").trim();
						const count = Number(toolCall.arguments?.count || 5);
						const result = await runGoogleSearch(query, googleSearchApiKey, googleSearchCx, count);
						if (!result.ok) {
							isError = true;
							toolText = result.message;
						} else {
							toolText = JSON.stringify(result.items, null, 2);
						}
					}
				} else {
					isError = true;
					toolText = `Unknown tool '${toolCall.name}'.`;
				}

				writeChunk(res, {
					type: "thought",
					text: `[System] Tool ${toolCall.name} completed${isError ? " with error" : ""}.`,
				});

				context.messages.push({
					role: "toolResult",
					toolCallId: toolCall.id,
					toolName: toolCall.name,
					content: [{ type: "text", text: toolText }],
					isError,
					timestamp: Date.now(),
				});
			}
		}

		writeChunk(res, { type: "error", error: "Tool loop exceeded max turns." });
		res.end();
	} catch (error) {
		writeChunk(res, {
			type: "error",
			error: normalizeProviderRuntimeError(error instanceof Error ? error.message : String(error), model.provider),
		});
		res.end();
	}
});

app.use((err, _req, res, _next) => {
	console.error("[gemini-os] unhandled server error", err);
	if (res.headersSent) return;
	sendApiError(
		res,
		createApiError(500, "INTERNAL_SERVER_ERROR", "Unexpected server error.", {
			detail: err instanceof Error ? err.message : String(err),
		}),
	);
});

app.listen(PORT, () => {
	console.log(`[gemini-os] server listening on http://localhost:${PORT}`);
});
