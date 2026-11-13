import { createRequire } from "node:module";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { LoggerEvent } from "babel-plugin-react-compiler";

type Babel = typeof import("@babel/core");

const root = process.cwd();
const require = createRequire(`${root}/`);

const readFirstExisting = (relativePaths: string[]): string => {
  for (const relativePath of relativePaths) {
    try {
      return readFileSync(resolve(root, relativePath), "utf8");
    } catch {
      // try the next candidate
    }
  }
  throw new Error(`Missing one of: ${relativePaths.join(", ")}`);
};

/**
 * A component the compiler has something to memoize. Written against the JSX
 * runtime directly so the probe needs no JSX parsing of its own.
 */
const FIXTURE = `import { jsx as _jsx } from 'react/jsx-runtime';
export function CompilerProbe(props) {
	const doubled = props.items.map((item) => item * 2);
	return _jsx('div', { children: doubled.length });
}
`;

/** A hook the compiler must reject, so a silent logger cannot pass the gate. */
const BAILOUT_FIXTURE = `import { useState } from 'react';
export function useCompilerProbe(load) {
	const [seed] = useState(0);
	let value = seed;
	try {
		value = load();
	} finally {
		value += 1;
	}
	return [value].map((item) => item * 2);
}
`;

const loadBabel = (): Babel => {
  try {
    require.resolve("babel-plugin-react-compiler");
    return require("@babel/core") as Babel;
  } catch {
    throw new Error(
      "React Compiler check failed: babel-plugin-react-compiler or @babel/core is not resolvable from this app.",
    );
  }
};

const assertCompilerTransforms = (babel: Babel): void => {
  const output =
    babel.transformSync(FIXTURE, {
      babelrc: false,
      configFile: false,
      filename: "compiler-probe.js",
      plugins: [["babel-plugin-react-compiler", { compilationMode: "all" }]],
    })?.code ?? "";

  // The compiler rewrites memoized components to pull a cache from the runtime.
  if (!output.includes("react/compiler-runtime") || !/_c\(\d+\)/.test(output)) {
    throw new Error(
      "React Compiler check failed: the plugin ran but produced no memo cache. " +
        "Expected `react/compiler-runtime` and a `_c(n)` cache in the output.",
    );
  }
};

type CompileReport = { compiled: number; failures: string[] };

const parserPluginsFor = (filename: string): ("jsx" | "typescript")[] => {
  if (filename.endsWith(".tsx")) {
    return ["typescript", "jsx"];
  }
  if (filename.endsWith(".ts")) {
    return ["typescript"];
  }
  return ["jsx"];
};

/** Compiles one file the way babel-preset-expo does in a release build. */
const compileFile = (
  babel: Babel,
  code: string,
  filename: string,
): CompileReport => {
  const report: CompileReport = { compiled: 0, failures: [] };
  const logEvent = (_file: string | null, event: LoggerEvent): void => {
    const line = "fnLoc" in event ? (event.fnLoc?.start.line ?? 0) : 0;
    switch (event.kind) {
      case "CompileSuccess":
        report.compiled += 1;
        return;
      case "CompileError":
        report.failures.push(`${filename}:${line} ${event.detail.reason}`);
        return;
      case "PipelineError":
        report.failures.push(`${filename}:${line} ${event.data}`);
        return;
      case "CompileDiagnostic":
      case "CompileSkip":
      case "Timing":
      case "AutoDepsDecorations":
      case "AutoDepsEligible":
        return;
      default:
        event satisfies never;
    }
  };

  babel.transformSync(code, {
    babelrc: false,
    configFile: false,
    code: false,
    filename,
    parserOpts: { plugins: parserPluginsFor(filename) },
    plugins: [
      [
        "babel-plugin-react-compiler",
        {
          target: "19",
          panicThreshold: "none",
          customOptOutDirectives: ["widget", "use no memo", "use no forget"],
          logger: { logEvent },
        },
      ],
    ],
  });

  return report;
};

const assertLoggerCatchesBailout = (babel: Babel): void => {
  const report = compileFile(babel, BAILOUT_FIXTURE, "use-compiler-probe.js");
  if (report.failures.length === 0) {
    throw new Error(
      "React Compiler check failed: a known bailout produced no CompileError event, so app files cannot be checked.",
    );
  }
};

const isAppSource = (relativePath: string): boolean =>
  /\.tsx?$/.test(relativePath) &&
  !relativePath.endsWith(".d.ts") &&
  !/\.(test|spec)\.tsx?$/.test(relativePath) &&
  !relativePath.startsWith("test/");

const compileAppSources = (babel: Babel): CompileReport => {
  const srcDir = resolve(root, "src");
  const files = readdirSync(srcDir, { recursive: true, encoding: "utf8" })
    .filter(isAppSource)
    .sort();

  const total: CompileReport = { compiled: 0, failures: [] };
  for (const file of files) {
    const filename = join("src", file);
    const report = compileFile(
      babel,
      readFileSync(resolve(root, filename), "utf8"),
      filename,
    );
    total.compiled += report.compiled;
    total.failures.push(...report.failures);
  }
  return total;
};

const appConfig = readFirstExisting(["app.config.ts", "app.config.js"]);
if (!/reactCompiler:\s*true/.test(appConfig)) {
  throw new Error(
    "React Compiler check failed: keep experiments.reactCompiler = true in app.config.",
  );
}

const babel = loadBabel();
assertCompilerTransforms(babel);
assertLoggerCatchesBailout(babel);

const { compiled, failures } = compileAppSources(babel);
if (failures.length > 0) {
  throw new Error(
    `React Compiler check failed: the compiler skipped ${failures.length} function(s) in src:\n${failures.join("\n")}`,
  );
}
if (compiled === 0) {
  throw new Error(
    "React Compiler check failed: no component or hook in src compiled. Check the parser setup.",
  );
}

process.stdout.write(
  `React Compiler: plugin transforms, app config enables it, ${compiled} components and hooks in src compile without a bailout\n`,
);
