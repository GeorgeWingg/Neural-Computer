import path from "node:path";

function cleanPathInput(value) {
	if (typeof value !== "string") return "";
	return value.trim();
}

function uniqAbsolutePaths(paths) {
	const seen = new Set();
	const result = [];
	for (const entry of paths) {
		const cleaned = cleanPathInput(entry);
		if (!cleaned) continue;
		const absolute = path.resolve(cleaned);
		if (seen.has(absolute)) continue;
		seen.add(absolute);
		result.push(absolute);
	}
	return result;
}

function resolveRuntimeRootFromEntryScript(entryScriptPath, fallbackCwd) {
	const cleanedEntry = cleanPathInput(entryScriptPath);
	if (!cleanedEntry) {
		return path.resolve(fallbackCwd);
	}
	const absoluteEntry = path.resolve(cleanedEntry);
	const entryDir = path.dirname(absoluteEntry);
	if (path.basename(entryDir) === "sidecar") {
		return path.dirname(entryDir);
	}
	return entryDir;
}

function readRuntimeRootOverride(env) {
	if (!env || typeof env !== "object") return "";
	return (
		cleanPathInput(env.NEURAL_OS_RUNTIME_ROOT) ||
		cleanPathInput(env.NEURAL_COMPUTER_RUNTIME_ROOT) ||
		cleanPathInput(env.GEMINI_OS_RUNTIME_ROOT)
	);
}

function resolvePolicyDefaultRoots({ runtimeRoot, cwd, homeDir }) {
	return uniqAbsolutePaths([
		homeDir,
		path.join(homeDir || "", "Downloads"),
		path.join(homeDir || "", "Desktop"),
		path.join(homeDir || "", "Documents"),
		path.join(homeDir || "", "workspace"),
		runtimeRoot,
		cwd,
	]);
}

export function resolveRuntimePaths(options = {}) {
	const env = options.env || process.env;
	const cwd = path.resolve(cleanPathInput(options.cwd) || process.cwd());
	const homeDir = cleanPathInput(options.homeDir) || cleanPathInput(env.HOME);
	const entryScript =
		cleanPathInput(options.entryScriptPath) ||
		cleanPathInput(options?.argv?.[1]) ||
		cleanPathInput(process?.argv?.[1]);
	const runtimeRootOverride = readRuntimeRootOverride(env);
	const runtimeRoot = runtimeRootOverride
		? path.resolve(runtimeRootOverride)
		: resolveRuntimeRootFromEntryScript(entryScript, cwd);

	const defaultWorkspaceRoot = path.resolve(runtimeRoot, "workspace");
	const bundledSkillsDir = path.resolve(runtimeRoot, "skills");
	const projectAuthFile = path.resolve(runtimeRoot, "auth.json");
	const policyDefaultRoots = resolvePolicyDefaultRoots({
		runtimeRoot,
		cwd,
		homeDir: homeDir ? path.resolve(homeDir) : "",
	});

	return {
		runtimeRoot,
		cwd,
		homeDir: homeDir ? path.resolve(homeDir) : "",
		defaultWorkspaceRoot,
		bundledSkillsDir,
		projectAuthFile,
		policyDefaultRoots,
	};
}

export function resolvePathAgainstRuntimeRoot(inputPath, runtimeRoot) {
	const cleaned = cleanPathInput(inputPath);
	if (!cleaned) return "";
	if (path.isAbsolute(cleaned)) return path.resolve(cleaned);
	return path.resolve(runtimeRoot, cleaned);
}

export function resolvePathListAgainstRuntimeRoot(paths, runtimeRoot) {
	if (!Array.isArray(paths)) return [];
	return uniqAbsolutePaths(paths.map((entry) => resolvePathAgainstRuntimeRoot(entry, runtimeRoot)));
}
