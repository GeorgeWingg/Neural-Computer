const DEFAULT_MAX_HTML_CHARS = 240_000;
const DEFAULT_MAX_REVISION_NOTE_CHARS = 200;
const EMIT_SCREEN_OPS = new Set([
	"replace",
	"append_child",
	"prepend_child",
	"replace_node",
	"remove_node",
	"set_text",
	"set_attr",
]);
const VOID_ELEMENTS = new Set([
	"area",
	"base",
	"br",
	"col",
	"embed",
	"hr",
	"img",
	"input",
	"link",
	"meta",
	"param",
	"source",
	"track",
	"wbr",
]);

function normalizeString(value) {
	if (typeof value === "string") return value;
	if (value === null || value === undefined) return "";
	return String(value);
}

function escapeRegExp(value) {
	return normalizeString(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtmlText(value) {
	return normalizeString(value)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function escapeHtmlAttribute(value) {
	return escapeHtmlText(value).replace(/"/g, "&quot;");
}

function extractAttributeValue(attributesText, attributeName) {
	const pattern = new RegExp(
		`\\b${escapeRegExp(attributeName)}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\\\`]+))`,
		"i",
	);
	const match = normalizeString(attributesText).match(pattern);
	if (!match) return "";
	return normalizeString(match[1] ?? match[2] ?? match[3]).trim();
}

function normalizeEmitScreenOp(value) {
	const normalized = normalizeString(value).trim().toLowerCase();
	if (!normalized) return "replace";
	return normalized;
}

function findTagEnd(source, startIndex) {
	let quote = "";
	for (let index = startIndex + 1; index < source.length; index += 1) {
		const char = source[index];
		if (quote) {
			if (char === quote && source[index - 1] !== "\\") {
				quote = "";
			}
			continue;
		}
		if (char === '"' || char === "'") {
			quote = char;
			continue;
		}
		if (char === ">") return index;
	}
	return -1;
}

function parseTagAt(source, tagStart) {
	if (source.startsWith("<!--", tagStart)) {
		const commentEnd = source.indexOf("-->", tagStart + 4);
		const end = commentEnd >= 0 ? commentEnd + 2 : source.length - 1;
		return { kind: "comment", start: tagStart, end };
	}
	const tagEnd = findTagEnd(source, tagStart);
	if (tagEnd < 0) return null;
	const raw = source.slice(tagStart, tagEnd + 1);
	const nameMatch = raw.match(/^<\s*(\/?)\s*([A-Za-z][A-Za-z0-9:-]*)/);
	if (!nameMatch) {
		return {
			kind: "other",
			start: tagStart,
			end: tagEnd,
		};
	}
	const closing = Boolean(nameMatch[1]);
	const name = normalizeString(nameMatch[2]).toLowerCase();
	const selfClosing = !closing && (VOID_ELEMENTS.has(name) || /\/\s*>$/.test(raw));
	const attributesText = closing ? "" : raw.slice(nameMatch[0].length, raw.length - 1);
	return {
		kind: "tag",
		start: tagStart,
		end: tagEnd,
		raw,
		name,
		closing,
		selfClosing,
		attributesText,
		dataUiId: closing ? "" : extractAttributeValue(attributesText, "data-ui-id"),
	};
}

function locateNodeByDataUiId(html, targetId) {
	const source = normalizeString(html);
	const normalizedTargetId = normalizeString(targetId).trim();
	if (!normalizedTargetId) return null;
	const stack = [];
	const lowerSource = source.toLowerCase();
	let cursor = 0;

	while (cursor < source.length) {
		const nextTagStart = source.indexOf("<", cursor);
		if (nextTagStart < 0) break;
		const parsed = parseTagAt(source, nextTagStart);
		if (!parsed) {
			cursor = nextTagStart + 1;
			continue;
		}
		cursor = parsed.end + 1;
		if (parsed.kind !== "tag") continue;

		if (parsed.closing) {
			let openTag = null;
			while (stack.length > 0) {
				const candidate = stack.pop();
				if (candidate.name === parsed.name) {
					openTag = candidate;
					break;
				}
			}
			if (!openTag) continue;
			if (openTag.dataUiId !== normalizedTargetId) continue;
			return {
				targetId: normalizedTargetId,
				name: openTag.name,
				selfClosing: false,
				startTagStart: openTag.startTagStart,
				startTagEnd: openTag.startTagEnd,
				nodeStart: openTag.startTagStart,
				nodeEnd: parsed.end + 1,
				contentStart: openTag.startTagEnd + 1,
				contentEnd: parsed.start,
			};
		} else if (parsed.selfClosing) {
			if (parsed.dataUiId !== normalizedTargetId) continue;
			return {
				targetId: normalizedTargetId,
				name: parsed.name,
				selfClosing: true,
				startTagStart: parsed.start,
				startTagEnd: parsed.end,
				nodeStart: parsed.start,
				nodeEnd: parsed.end + 1,
				contentStart: parsed.end + 1,
				contentEnd: parsed.end + 1,
			};
		} else {
			if (parsed.name === "script" || parsed.name === "style") {
				const closeNeedle = `</${parsed.name}>`;
				const closeStart = lowerSource.indexOf(closeNeedle, parsed.end + 1);
				if (closeStart >= 0) {
					if (parsed.dataUiId === normalizedTargetId) {
						return {
							targetId: normalizedTargetId,
							name: parsed.name,
							selfClosing: false,
							startTagStart: parsed.start,
							startTagEnd: parsed.end,
							nodeStart: parsed.start,
							nodeEnd: closeStart + closeNeedle.length,
							contentStart: parsed.end + 1,
							contentEnd: closeStart,
						};
					}
					cursor = closeStart + closeNeedle.length;
					continue;
				}
			}
			stack.push({
				name: parsed.name,
				dataUiId: parsed.dataUiId,
				startTagStart: parsed.start,
				startTagEnd: parsed.end,
			});
		}
	}
	return null;
}

function setAttributeOnOpenTag(openTag, attrName, attrValue) {
	const normalizedAttrName = normalizeString(attrName).trim();
	if (!/^[A-Za-z_:][A-Za-z0-9:._-]*$/.test(normalizedAttrName)) {
		throw new Error(`Invalid attribute name '${normalizedAttrName}'.`);
	}
	const escapedValue = escapeHtmlAttribute(attrValue);
	const attrPattern = new RegExp(
		`(\\s${escapeRegExp(normalizedAttrName)}\\s*=\\s*)(?:"[^"]*"|'[^']*'|[^\\s>]+)`,
		"i",
	);
	if (attrPattern.test(openTag)) {
		return openTag.replace(attrPattern, `$1"${escapedValue}"`);
	}
	if (/\/\s*>$/.test(openTag)) {
		return openTag.replace(/\/\s*>$/, ` ${normalizedAttrName}="${escapedValue}" />`);
	}
	return openTag.replace(/\s*>$/, ` ${normalizedAttrName}="${escapedValue}">`);
}

function applyPatchOperation(html, payload) {
	const node = locateNodeByDataUiId(html, payload.targetId);
	if (!node) {
		throw new Error(`Target data-ui-id='${payload.targetId}' not found.`);
	}

	if (payload.op === "append_child") {
		if (node.selfClosing) throw new Error("append_child requires a non-void target element.");
		const nextHtml = `${html.slice(0, node.contentEnd)}${payload.htmlFragment}${html.slice(node.contentEnd)}`;
		return { nextHtml, summary: `append_child:${payload.targetId}` };
	}
	if (payload.op === "prepend_child") {
		if (node.selfClosing) throw new Error("prepend_child requires a non-void target element.");
		const nextHtml = `${html.slice(0, node.contentStart)}${payload.htmlFragment}${html.slice(node.contentStart)}`;
		return { nextHtml, summary: `prepend_child:${payload.targetId}` };
	}
	if (payload.op === "replace_node") {
		const nextHtml = `${html.slice(0, node.nodeStart)}${payload.htmlFragment}${html.slice(node.nodeEnd)}`;
		return { nextHtml, summary: `replace_node:${payload.targetId}` };
	}
	if (payload.op === "remove_node") {
		const nextHtml = `${html.slice(0, node.nodeStart)}${html.slice(node.nodeEnd)}`;
		return { nextHtml, summary: `remove_node:${payload.targetId}` };
	}
	if (payload.op === "set_text") {
		if (node.selfClosing) throw new Error("set_text requires a non-void target element.");
		const escapedText = escapeHtmlText(payload.text);
		const nextHtml = `${html.slice(0, node.contentStart)}${escapedText}${html.slice(node.contentEnd)}`;
		return { nextHtml, summary: `set_text:${payload.targetId}` };
	}
	if (payload.op === "set_attr") {
		const openTag = html.slice(node.startTagStart, node.startTagEnd + 1);
		const updatedOpenTag = setAttributeOnOpenTag(openTag, payload.attrName, payload.attrValue);
		const nextHtml = `${html.slice(0, node.startTagStart)}${updatedOpenTag}${html.slice(node.startTagEnd + 1)}`;
		return { nextHtml, summary: `set_attr:${payload.targetId}.${payload.attrName}` };
	}
	throw new Error(`Unsupported emit_screen patch op '${payload.op}'.`);
}

export function createRenderOutputState() {
	return {
		renderCount: 0,
		latestHtml: "",
		lastIsFinal: false,
	};
}

export function validateEmitScreenArgs(args, options = {}) {
	const source = args && typeof args === "object" ? args : {};
	const maxHtmlChars = Number.isFinite(options.maxHtmlChars)
		? Math.max(1_000, Math.floor(options.maxHtmlChars))
		: DEFAULT_MAX_HTML_CHARS;
	const maxRevisionNoteChars = Number.isFinite(options.maxRevisionNoteChars)
		? Math.max(32, Math.floor(options.maxRevisionNoteChars))
		: DEFAULT_MAX_REVISION_NOTE_CHARS;

	const op = normalizeEmitScreenOp(source.op);
	if (!EMIT_SCREEN_OPS.has(op)) {
		return {
			ok: false,
			error: `emit_screen op must be one of: ${Array.from(EMIT_SCREEN_OPS).join(", ")}.`,
		};
	}

	const appContext = normalizeString(source.appContext).trim();
	const revisionNoteSource = normalizeString(source.revisionNote).trim();
	const revisionNote = revisionNoteSource.slice(0, maxRevisionNoteChars);
	const isFinal = Boolean(source.isFinal);

	if (op === "replace") {
		const html = normalizeString(source.html);
		if (!html.trim()) {
			return { ok: false, error: "emit_screen replace requires a non-empty html field." };
		}
		if (html.length > maxHtmlChars) {
			return {
				ok: false,
				error: `emit_screen html exceeds max length (${maxHtmlChars} chars).`,
			};
		}
		return {
			ok: true,
			value: {
				op,
				html,
				appContext: appContext || undefined,
				revisionNote: revisionNote || undefined,
				isFinal,
			},
		};
	}

	const baseRevisionRaw = Number(source.baseRevision);
	const baseRevision =
		Number.isFinite(baseRevisionRaw) && baseRevisionRaw > 0 ? Math.floor(baseRevisionRaw) : 0;
	if (!baseRevision) {
		return {
			ok: false,
			error: "emit_screen patch operations require baseRevision (positive integer).",
		};
	}

	const targetId = normalizeString(source.targetId).trim();
	if (!targetId) {
		return {
			ok: false,
			error: "emit_screen patch operations require targetId (maps to data-ui-id).",
		};
	}

	const basePayload = {
		op,
		baseRevision,
		targetId,
		appContext: appContext || undefined,
		revisionNote: revisionNote || undefined,
		isFinal,
	};

	if (op === "append_child" || op === "prepend_child" || op === "replace_node") {
		const htmlFragment = normalizeString(source.htmlFragment);
		if (!htmlFragment.trim()) {
			return {
				ok: false,
				error: `emit_screen ${op} requires non-empty htmlFragment.`,
			};
		}
		if (htmlFragment.length > maxHtmlChars) {
			return {
				ok: false,
				error: `emit_screen htmlFragment exceeds max length (${maxHtmlChars} chars).`,
			};
		}
		return {
			ok: true,
			value: {
				...basePayload,
				htmlFragment,
			},
		};
	}

	if (op === "set_text") {
		if (typeof source.text !== "string") {
			return {
				ok: false,
				error: "emit_screen set_text requires text (string).",
			};
		}
		return {
			ok: true,
			value: {
				...basePayload,
				text: source.text,
			},
		};
	}

	if (op === "set_attr") {
		const attrName = normalizeString(source.attrName).trim();
		if (!attrName) {
			return {
				ok: false,
				error: "emit_screen set_attr requires attrName.",
			};
		}
		if (typeof source.attrValue !== "string") {
			return {
				ok: false,
				error: "emit_screen set_attr requires attrValue (string).",
			};
		}
		return {
			ok: true,
			value: {
				...basePayload,
				attrName,
				attrValue: source.attrValue,
			},
		};
	}

	// remove_node
	return {
		ok: true,
		value: basePayload,
	};
}

export function applyEmitScreen(state, payload, metadata = {}) {
	const previous = state && typeof state === "object" ? state : createRenderOutputState();
	const toolName = metadata.toolName || "emit_screen";
	const toolCallId = typeof metadata.toolCallId === "string" ? metadata.toolCallId : undefined;
	let nextHtml = previous.latestHtml;
	let operationSummary = payload.op || "replace";

	if (payload.op === "replace") {
		nextHtml = payload.html;
	} else {
		if (!previous.latestHtml.trim()) {
			return {
				ok: false,
				errorCode: "SCREEN_STATE_UNAVAILABLE",
				error: "emit_screen patch operation requires existing rendered HTML state.",
			};
		}
		if (Number(previous.renderCount || 0) !== Number(payload.baseRevision || 0)) {
			return {
				ok: false,
				errorCode: "REVISION_MISMATCH",
				error: `emit_screen baseRevision mismatch (expected ${previous.renderCount}, got ${payload.baseRevision}).`,
			};
		}
		try {
			const patched = applyPatchOperation(previous.latestHtml, payload);
			nextHtml = patched.nextHtml;
			operationSummary = patched.summary || payload.op;
		} catch (error) {
			return {
				ok: false,
				errorCode: "PATCH_APPLY_FAILED",
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	const revision = previous.renderCount + 1;
	const nextState = {
		renderCount: revision,
		latestHtml: nextHtml,
		lastIsFinal: Boolean(payload.isFinal),
	};

	const streamEvent = {
		type: "render_output",
		toolName,
		toolCallId,
		revision,
		html: nextHtml,
		isFinal: Boolean(payload.isFinal),
		appContext: payload.appContext,
		revisionNote: payload.revisionNote,
		op: payload.op || "replace",
		baseRevision: payload.baseRevision,
		targetId: payload.targetId,
	};

	const finalHint = payload.isFinal ? ", final" : "";
	const noteHint = payload.revisionNote ? ` note='${payload.revisionNote}'` : "";
	const toolResultText = `[emit_screen] revision ${revision} via ${operationSummary} (${nextHtml.length} chars${finalHint})${noteHint}`;

	return {
		ok: true,
		nextState,
		streamEvent,
		toolResultText,
	};
}
