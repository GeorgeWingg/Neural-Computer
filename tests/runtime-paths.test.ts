import { describe, expect, it } from "vitest";
import {
	resolvePathAgainstRuntimeRoot,
	resolvePathListAgainstRuntimeRoot,
	resolveRuntimePaths,
} from "../services/runtimePaths.mjs";

describe("runtime path resolution", () => {
	it("derives packaged runtime root from sidecar entry script path", () => {
		const runtime = resolveRuntimePaths({
			cwd: "/tmp/cwd",
			homeDir: "/Users/tester",
			entryScriptPath: "/Applications/Neural OS.app/Contents/Resources/sidecar/server.bundle.cjs",
			env: { HOME: "/Users/tester" },
		});

		expect(runtime.runtimeRoot).toBe("/Applications/Neural OS.app/Contents/Resources");
		expect(runtime.defaultWorkspaceRoot).toBe(
			"/Applications/Neural OS.app/Contents/Resources/workspace",
		);
		expect(runtime.bundledSkillsDir).toBe("/Applications/Neural OS.app/Contents/Resources/skills");
		expect(runtime.projectAuthFile).toBe("/Applications/Neural OS.app/Contents/Resources/auth.json");
	});

	it("uses explicit runtime root override when provided", () => {
		const runtime = resolveRuntimePaths({
			cwd: "/tmp/cwd",
			entryScriptPath: "/tmp/cwd/server.mjs",
			env: {
				NEURAL_OS_RUNTIME_ROOT: "/opt/neural-runtime",
			},
		});

		expect(runtime.runtimeRoot).toBe("/opt/neural-runtime");
		expect(runtime.defaultWorkspaceRoot).toBe("/opt/neural-runtime/workspace");
	});

	it("includes home and workspace roots in default policy roots", () => {
		const runtime = resolveRuntimePaths({
			cwd: "/repo/project",
			homeDir: "/Users/tester",
			entryScriptPath: "/repo/project/server.mjs",
			env: { HOME: "/Users/tester" },
		});

		expect(runtime.policyDefaultRoots).toContain("/Users/tester");
		expect(runtime.policyDefaultRoots).toContain("/Users/tester/Downloads");
		expect(runtime.policyDefaultRoots).toContain("/Users/tester/workspace");
		expect(runtime.policyDefaultRoots).toContain("/repo/project");
	});

	it("resolves relative path inputs against runtime root", () => {
		expect(resolvePathAgainstRuntimeRoot("./workspace", "/opt/neural")).toBe("/opt/neural/workspace");
		expect(resolvePathAgainstRuntimeRoot("/tmp/workspace", "/opt/neural")).toBe("/tmp/workspace");
	});

	it("normalizes path lists against runtime root and deduplicates", () => {
		const resolved = resolvePathListAgainstRuntimeRoot(
			["./workspace", "/tmp/custom", "./workspace", "  "],
			"/opt/neural",
		);
		expect(resolved).toEqual(["/opt/neural/workspace", "/tmp/custom"]);
	});
});
