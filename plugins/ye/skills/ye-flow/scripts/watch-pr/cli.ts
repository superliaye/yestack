import { setTimeout as delay } from "node:timers/promises";
import {
  type CommandSpec,
  InvalidArgumentError,
  parseCommandLine,
} from "../cli-args.ts";
import {
  GhGitHubReader,
  WatcherQueryError,
  discoverStack,
  resolveContext,
} from "./github.ts";
import {
  runQueued,
  runSimple,
  statusQueryVerdict,
  verdictFactory,
  type WatchClock,
} from "./policy.ts";
import { renderJson, renderPretty } from "./render.ts";
import type * as T from "./types.ts";
import { nonEmpty, parsePrNumber } from "./types.ts";
export interface CliOptions {
  readonly owner: string | null;
  readonly repo: string | null;
  readonly pr: T.PrNumber | null;
  readonly mode: T.WatchMode;
  readonly stackPrs: readonly T.PrNumber[];
  readonly statusOnly: boolean;
  readonly pretty: boolean;
  readonly polling: T.PollingOptions;
}
function positiveNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0)
    throw new InvalidArgumentError("must be greater than zero");
  return parsed;
}
function nonNegativeNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0)
    throw new InvalidArgumentError("must be zero or greater");
  return parsed;
}
function positiveInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0)
    throw new InvalidArgumentError("must be a positive integer");
  return parsed;
}
function prNumber(value: string): T.PrNumber {
  try {
    return parsePrNumber(Number(value.replace(/^#/, "")));
  } catch {
    throw new InvalidArgumentError("must be a positive integer");
  }
}
function stackPrList(value: string): T.NonEmpty<T.PrNumber> {
  const numbers = value.split(",").map((part) => prNumber(part.trim()));
  if (new Set(numbers).size !== numbers.length)
    throw new InvalidArgumentError("contains a duplicate PR");
  const parsed = nonEmpty(numbers);
  if (parsed === null) throw new InvalidArgumentError("cannot be empty");
  return parsed;
}
const PROGRAM: CommandSpec = {
  name: "watch-pr",
  description:
    "Watch one pull request, a connected stack, or an immutable queued stack.\nJSON (NDJSON while polling) is the default; --pretty renders human text.",
  options: [
    {
      name: "owner",
      placeholder: "<owner>",
      description: "GitHub repository owner",
    },
    {
      name: "repo",
      placeholder: "<repo>",
      description: "GitHub repository name",
    },
    {
      name: "pr",
      placeholder: "<number>",
      description: "pull request number",
      validate: prNumber,
    },
    {
      name: "stack",
      description: "watch the connected open stack",
      defaultText: "false",
      conflicts: "queued-stack",
    },
    {
      name: "queued-stack",
      description: "watch the captured stack until all PRs merge",
      defaultText: "false",
    },
    {
      name: "stack-prs",
      placeholder: "<n,...>",
      description: "frozen bottom-to-top queue (queued mode only)",
      validate: stackPrList,
    },
    {
      name: "interval",
      placeholder: "<seconds>",
      description: "poll interval",
      defaultText: "60",
      validate: positiveNumber,
    },
    {
      name: "sweep-interval",
      placeholder: "<seconds>",
      description: "whole-stack sweep interval",
      defaultText: "300",
      validate: positiveNumber,
    },
    {
      name: "timeout",
      placeholder: "<seconds>",
      description: "deadline; 0 disables it",
      defaultText: "0",
      validate: nonNegativeNumber,
    },
    {
      name: "max-query-errors",
      placeholder: "<count>",
      description: "consecutive query-error budget",
      defaultText: "5",
      validate: positiveInteger,
    },
    {
      name: "status-only",
      description: "print one status table and exit 0",
      defaultText: "false",
    },
    {
      name: "allow-draft",
      description: "do not treat a draft as a merge gate",
      defaultText: "false",
    },
    {
      name: "human-gates",
      placeholder: "<check,...>",
      description: "checks that wait on a human and never block a verdict",
    },
    {
      name: "pretty",
      description: "render human text instead of JSON",
      defaultText: "false",
    },
  ],
};
/** Thrown after usage output is written; carries the process exit status. */
class UsageExit extends Error {
  readonly exitCode: number;
  constructor(exitCode: number) {
    super(`usage exit ${exitCode}`);
    this.exitCode = exitCode;
  }
}
export function parseArgs(
  argv: readonly string[],
  io: Pick<CliRuntime, "stdout" | "stderr">
): CliOptions {
  const parsed = parseCommandLine(PROGRAM, argv, {});
  if (parsed.kind === "help") {
    io.stdout(parsed.text);
    throw new UsageExit(0);
  }
  if (parsed.kind === "error") {
    io.stderr(`${parsed.message}\n`);
    throw new UsageExit(1);
  }
  const text = (name: string): string | undefined => {
    const value = parsed.values.get(name);
    return typeof value === "string" ? value : undefined;
  };
  const flag = (name: string): boolean => parsed.values.get(name) === true;
  const number = (
    name: string,
    parse: (value: string) => number,
    fallback: number
  ) => {
    const value = text(name);
    return value === undefined ? fallback : parse(value);
  };
  const pr = text("pr");
  const stackPrs = text("stack-prs");
  const queuedStack = flag("queued-stack");
  if (stackPrs !== undefined && !queuedStack) {
    io.stderr("error: --stack-prs requires --queued-stack\n");
    throw new UsageExit(1);
  }
  return {
    owner: text("owner") ?? null,
    repo: text("repo") ?? null,
    pr: pr === undefined ? null : prNumber(pr),
    mode: queuedStack ? "queued-stack" : flag("stack") ? "stack" : "single",
    stackPrs: stackPrs === undefined ? [] : stackPrList(stackPrs),
    statusOnly: flag("status-only"),
    pretty: flag("pretty"),
    polling: {
      interval: number("interval", positiveNumber, 60),
      sweepInterval: number("sweep-interval", positiveNumber, 300),
      timeout: number("timeout", nonNegativeNumber, 0),
      maxQueryErrors: number("max-query-errors", positiveInteger, 5),
      allowDraft: flag("allow-draft"),
      humanGates: (text("human-gates") ?? "")
        .split(",")
        .map((name) => name.trim())
        .filter((name) => name !== ""),
    },
  };
}
export interface CliRuntime {
  readonly reader: T.GitHubReader;
  readonly clock: WatchClock;
  readonly stdout: (value: string) => void;
  readonly stderr: (value: string) => void;
}
function realRuntime(): CliRuntime {
  return {
    reader: new GhGitHubReader(),
    clock: {
      now: () => performance.now() / 1_000,
      observedAt: () => new Date().toISOString(),
      sleep: async (seconds) => {
        await delay(seconds * 1_000);
      },
    },
    stdout: (value) => process.stdout.write(value),
    stderr: (value) => process.stderr.write(value),
  };
}
export async function main(
  argv: readonly string[],
  runtime: CliRuntime = realRuntime()
): Promise<number> {
  let options: CliOptions;
  try {
    options = parseArgs(argv, runtime);
  } catch (error) {
    if (!(error instanceof UsageExit)) throw error;
    return error.exitCode === 0 ? 0 : 64;
  }
  const render = options.pretty ? renderPretty : renderJson;
  const emit = (verdict: T.ProgressVerdict): void =>
    runtime.stdout(render(verdict));
  let contexts: T.NonEmpty<T.PrContext>;
  try {
    const seed = await resolveContext({
      reader: runtime.reader,
      owner: options.owner,
      repo: options.repo,
      pr: options.pr ?? options.stackPrs[0] ?? null,
    });
    contexts =
      nonEmpty(options.stackPrs.map((number) => ({ ...seed, number }))) ??
      (options.mode === "single"
        ? [seed]
        : await discoverStack(runtime.reader, seed));
  } catch (error) {
    if (!(error instanceof WatcherQueryError)) throw error;
    const verdict = statusQueryVerdict(
      verdictFactory(runtime.clock, options.mode),
      1,
      error.failure
    );
    runtime.stdout(render(verdict));
    return verdict.exitCode;
  }
  const dependencies = { reader: runtime.reader, clock: runtime.clock, emit };
  const verdict =
    options.mode === "queued-stack" && !options.statusOnly
      ? await runQueued({ dependencies, contexts, options: options.polling })
      : await runSimple({
          dependencies,
          contexts,
          mode: options.mode,
          statusOnly: options.statusOnly,
          options: options.polling,
        });
  runtime.stdout(render(verdict));
  return verdict.exitCode;
}
