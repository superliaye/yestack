// Command-line parsing for watch-pr and orch on top of node:util parseArgs.
// It reproduces the commander contract the playbooks and tests rely on: the
// same error messages, the same check order, and the same help layout.
import { parseArgs } from "node:util";

export interface OptionSpec {
  readonly name: string;
  /** A value placeholder such as `<seconds>`. Absent for a boolean flag. */
  readonly placeholder?: string;
  readonly description: string;
  readonly required?: boolean;
  readonly env?: string;
  /** Shown in help as `(default: …)`. */
  readonly defaultText?: string;
  /** Throws InvalidArgumentError for a rejected value. */
  readonly validate?: (value: string) => void;
  /** Name of an option that cannot be given together with this one. */
  readonly conflicts?: string;
}

export interface ArgumentSpec {
  readonly name: string;
  readonly description?: string;
  readonly validate?: (value: string) => void;
}

export interface CommandSpec {
  readonly name: string;
  readonly description: string;
  readonly usage?: string;
  readonly options?: readonly OptionSpec[];
  readonly arguments?: readonly ArgumentSpec[];
  readonly commands?: readonly CommandSpec[];
}

export class InvalidArgumentError extends Error {}

export type ParseOutcome =
  | {
      readonly kind: "ok";
      /** Command names below the root, for example `["unit", "add"]`. */
      readonly path: readonly string[];
      readonly values: ReadonlyMap<string, string | true>;
      readonly args: readonly string[];
    }
  | { readonly kind: "help"; readonly text: string }
  | {
      readonly kind: "error";
      readonly message: string;
      /** Help for the command that rejected the input. */
      readonly help: string;
    };

const HELP_WIDTH = 80;
const MIN_WIDTH_TO_WRAP = 40;

const optionTerm = (option: OptionSpec): string =>
  option.placeholder === undefined
    ? `--${option.name}`
    : `--${option.name} ${option.placeholder}`;

function allOptions(
  command: CommandSpec,
  into: Map<string, "string" | "boolean">
): Map<string, "string" | "boolean"> {
  for (const option of command.options ?? [])
    into.set(
      option.name,
      option.placeholder === undefined ? "boolean" : "string"
    );
  for (const child of command.commands ?? []) allOptions(child, into);
  return into;
}

interface Failure {
  readonly depth: number;
  readonly message: string;
}

export function parseCommandLine(
  root: CommandSpec,
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>
): ParseOutcome {
  const config: Record<string, { type: "string" | "boolean"; short?: string }> =
    { help: { type: "boolean", short: "h" } };
  for (const [name, type] of allOptions(root, new Map()))
    config[name] = { type };
  const { tokens } = parseArgs({
    args: [...argv],
    options: config,
    strict: false,
    allowPositionals: true,
    tokens: true,
  });

  const path: CommandSpec[] = [root];
  const values = new Map<string, string | true>();
  const fromCli = new Set<string>();
  const operands: string[] = [];
  let unknown: string | null = null;
  let help = false;
  let terminated = false;
  const valueFailures: Failure[] = [];
  const failValue = (depth: number, message: string): void => {
    valueFailures.push({ depth, message });
  };

  for (const token of tokens) {
    const node = path[path.length - 1];
    if (token.kind === "option-terminator") {
      terminated = true;
      continue;
    }
    if (token.kind === "positional") {
      const child =
        unknown === null && !terminated && operands.length === 0
          ? node.commands?.find((command) => command.name === token.value)
          : undefined;
      if (child === undefined) operands.push(token.value);
      else path.push(child);
      continue;
    }
    const raw = argv[token.index] ?? token.rawName;
    if ((token.name === "help" || token.name === "h") && !token.inlineValue) {
      help = true;
      continue;
    }
    const global = root.options?.find((option) => option.name === token.name);
    const own = node.options?.find((option) => option.name === token.name);
    const spec = global ?? own;
    if (
      spec === undefined ||
      (spec.placeholder === undefined && token.inlineValue === true)
    ) {
      unknown ??= raw;
      continue;
    }
    const depth = global === undefined ? path.length - 1 : 0;
    if (spec.placeholder === undefined) {
      values.set(spec.name, true);
      fromCli.add(spec.name);
      continue;
    }
    if (token.value === undefined) {
      failValue(depth, `option '${optionTerm(spec)}' argument missing`);
      continue;
    }
    try {
      spec.validate?.(token.value);
      values.set(spec.name, token.value);
      fromCli.add(spec.name);
    } catch (error) {
      if (!(error instanceof InvalidArgumentError)) throw error;
      failValue(
        depth,
        `option '${optionTerm(spec)}' argument '${token.value}' is invalid. ${error.message}`
      );
    }
  }

  const node = path[path.length - 1];
  const fail = (depth: number, message: string): ParseOutcome => ({
    kind: "error",
    message: `error: ${message}`,
    help: helpText(path.slice(0, depth + 1)),
  });
  // Commander parses each level's options before it dispatches to the next,
  // so the shallowest level's first failure wins.
  const failure = valueFailures.reduce<Failure | null>(
    (best, item) => (best === null || item.depth < best.depth ? item : best),
    null
  );
  if (failure !== null) return fail(failure.depth, failure.message);
  if (help) return { kind: "help", text: helpText(path) };

  for (const command of path)
    for (const option of command.options ?? [])
      if (
        option.env !== undefined &&
        !values.has(option.name) &&
        env[option.env] !== undefined
      )
        values.set(option.name, env[option.env] ?? "");

  const deepest = path.length - 1;
  for (const option of node.options ?? [])
    if (option.required === true && !values.has(option.name))
      return fail(
        deepest,
        `required option '${optionTerm(option)}' not specified`
      );
  for (const option of node.options ?? []) {
    const other = node.options?.find((item) => item.name === option.conflicts);
    if (
      other !== undefined &&
      fromCli.has(option.name) &&
      fromCli.has(other.name)
    )
      return fail(
        deepest,
        `option '${optionTerm(option)}' cannot be used with option '${optionTerm(other)}'`
      );
  }
  if (unknown !== null) {
    const candidates = path
      .flatMap((command) => command.options ?? [])
      .map((option) => `--${option.name}`)
      .concat("--help");
    return fail(
      deepest,
      `unknown option '${unknown}'${unknown.startsWith("--") ? suggestSimilar(unknown, candidates) : ""}`
    );
  }

  const declared = node.arguments ?? [];
  const missing = declared[operands.length];
  if (missing !== undefined)
    return fail(deepest, `missing required argument '${missing.name}'`);
  if (operands.length > declared.length)
    return fail(
      deepest,
      `too many arguments${deepest === 0 ? "" : ` for '${node.name}'`}. Expected ${declared.length} argument${declared.length === 1 ? "" : "s"} but got ${operands.length}.`
    );
  for (const [index, argument] of declared.entries()) {
    try {
      argument.validate?.(operands[index]);
    } catch (error) {
      if (!(error instanceof InvalidArgumentError)) throw error;
      return fail(
        deepest,
        `command-argument value '${operands[index]}' is invalid for argument '${argument.name}'. ${error.message}`
      );
    }
  }

  return {
    kind: "ok",
    path: path.slice(1).map((command) => command.name),
    values,
    args: operands,
  };
}

function boxWrap(text: string, width: number): string {
  if (width < MIN_WIDTH_TO_WRAP) return text;
  const wrapped: string[] = [];
  for (const line of text.split(/\r\n|\n/)) {
    const chunks = line.match(/\s*\S+/g);
    if (chunks === null) {
      wrapped.push("");
      continue;
    }
    let current = chunks[0];
    for (const chunk of chunks.slice(1)) {
      if (current.length + chunk.length <= width) current += chunk;
      else {
        wrapped.push(current);
        current = chunk.trimStart();
      }
    }
    wrapped.push(current);
  }
  return wrapped.join("\n");
}

function formatItem(term: string, width: number, description: string): string {
  const remaining = HELP_WIDTH - width - 4;
  const body =
    remaining < MIN_WIDTH_TO_WRAP || /\n[^\S\r\n]/.test(description)
      ? description
      : boxWrap(description, remaining).replace(
          /\n/g,
          `\n${" ".repeat(width + 2)}`
        );
  return `  ${term.padEnd(width)}  ${body.replace(/\n/g, "\n  ")}`;
}

function optionDescription(option: OptionSpec): string {
  const extra = [
    ...(option.defaultText === undefined
      ? []
      : [`default: ${option.defaultText}`]),
    ...(option.env === undefined ? [] : [`env: ${option.env}`]),
  ];
  return extra.length === 0
    ? option.description
    : `${option.description} (${extra.join(", ")})`;
}

function commandTerm(command: CommandSpec): string {
  return [
    command.name,
    ...((command.options ?? []).length > 0 ? ["[options]"] : []),
    ...(command.arguments ?? []).map((argument) => `<${argument.name}>`),
  ].join(" ");
}

export function helpText(path: readonly CommandSpec[]): string {
  const command = path[path.length - 1];
  const commands = command.commands ?? [];
  const declared = command.arguments ?? [];
  const usage =
    command.usage ??
    [
      "[options]",
      ...(commands.length > 0 ? ["[command]"] : []),
      ...declared.map((argument) => `<${argument.name}>`),
    ].join(" ");
  const options: [string, string][] = [
    ...(command.options ?? []).map((option): [string, string] => [
      optionTerm(option),
      optionDescription(option),
    ]),
    ["-h, --help", "display help for command"],
  ];
  const argumentRows: [string, string][] = declared.some(
    (argument) => argument.description !== undefined
  )
    ? declared.map((argument) => [argument.name, argument.description ?? ""])
    : [];
  const commandRows = commands.map((child): [string, string] => [
    commandTerm(child),
    child.description,
  ]);
  const width = Math.max(
    ...[...options, ...argumentRows, ...commandRows].map(
      ([term]) => term.length
    )
  );
  const section = (title: string, rows: readonly [string, string][]) =>
    rows.length === 0
      ? []
      : [
          `${title}:`,
          ...rows.map(([term, text]) => formatItem(term, width, text)),
          "",
        ];
  const lines = [
    `Usage: ${path.map((item) => item.name).join(" ")} ${usage}`,
    "",
    ...(command.description === ""
      ? []
      : [boxWrap(command.description, HELP_WIDTH), ""]),
    ...section("Arguments", argumentRows),
    ...section("Options", options),
    ...section("Commands", commandRows),
  ];
  return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}

const MAX_DISTANCE = 3;

function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > MAX_DISTANCE)
    return Math.max(a.length, b.length);
  const d: number[][] = [];
  for (let i = 0; i <= a.length; i++) d[i] = [i];
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let j = 1; j <= b.length; j++)
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[a.length][b.length];
}

function suggestSimilar(flag: string, candidates: readonly string[]): string {
  const word = flag.slice(2);
  let similar: string[] = [];
  let best = MAX_DISTANCE;
  for (const candidate of new Set(candidates.map((item) => item.slice(2)))) {
    if (candidate.length <= 1) continue;
    const distance = editDistance(word, candidate);
    const length = Math.max(word.length, candidate.length);
    if ((length - distance) / length <= 0.4) continue;
    if (distance < best) {
      best = distance;
      similar = [candidate];
    } else if (distance === best) similar.push(candidate);
  }
  similar.sort((a, b) => a.localeCompare(b));
  const flags = similar.map((candidate) => `--${candidate}`);
  if (flags.length > 1) return `\n(Did you mean one of ${flags.join(", ")}?)`;
  return flags.length === 1 ? `\n(Did you mean ${flags[0]}?)` : "";
}
