#!/usr/bin/env node

import {
  type CommandSpec,
  InvalidArgumentError,
  helpText,
  parseCommandLine,
} from "../cli-args.ts";
import {
  NotFoundError,
  UsageError,
  openStore,
  parseVerdict,
  type Counts,
  type Frontier,
  type InboxPointer,
  type OpenGate,
  type StandingLine,
  type StatusReport,
  type Store,
  type Unit,
} from "./store.ts";

const DISPLAY_LIMIT = 4;

interface Io {
  readonly stdout: (value: string) => void;
  readonly stderr: (value: string) => void;
}

type Values = ReadonlyMap<string, string | true>;

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function positiveInteger(value: string): number {
  const parsed = Number(value);
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(parsed)) {
    throw new InvalidArgumentError("must be a positive integer");
  }
  return parsed;
}

function prList(value: string): readonly number[] {
  const parts = value.split(",");
  if (parts.some((part) => part.length === 0)) {
    throw new InvalidArgumentError("requires a comma-separated PR list");
  }
  return parts.map(positiveInteger);
}

function countLine(value: Counts): string {
  const entries = Object.entries(value);
  return entries.length === 0
    ? "none"
    : entries.map(([name, count]) => `${name}=${count}`).join(", ");
}

function unitLine(unit: Unit): string {
  return [
    unit.id,
    unit.track,
    unit.state,
    unit.branch,
    unit.pr,
    unit.sha,
    unit.brief,
  ].join("\t");
}

function pointerLine(pointer: InboxPointer): string {
  return [
    pointer.ts,
    pointer.agent,
    pointer.unit,
    pointer.status,
    pointer.report,
  ].join("\t");
}

function gateLine(gate: OpenGate): string {
  return [
    gate.id,
    gate.question,
    gate.options,
    gate.defaultAnswer,
  ].join("\t");
}

function compactRows<T>(
  rows: readonly T[],
  format: (row: T) => string,
  empty: string,
  limit: number | null = DISPLAY_LIMIT
): string {
  if (rows.length === 0) {
    return empty;
  }
  const visible = limit === null ? rows : rows.slice(0, limit);
  const lines = visible.map(format);
  if (limit !== null && rows.length > limit) {
    lines.push(`... ${rows.length - limit} more; use --json`);
  }
  return lines.join("\n");
}

function frontierLine(value: Frontier): string {
  const prs =
    value.prs.length === 0
      ? "none"
      : value.prs
          .map(
            (row) =>
              `${row.branches}#${row.pr}@${row.sha}:${row.state}`
          )
          .join(",");
  return `generation=${value.generation} prs=${prs} lowest-unmerged=${value.lowestUnmerged ?? "none"}`;
}

function statusLines(report: StatusReport): string {
  const visible = report.summary.openGateIds.slice(0, DISPLAY_LIMIT);
  const more =
    report.summary.openGateIds.length > DISPLAY_LIMIT
      ? `,+${report.summary.openGateIds.length - DISPLAY_LIMIT} more`
      : "";
  return [
    `counts: units=${report.units.length}; states=${countLine(report.summary.unitStates)}; ledger=${countLine(report.summary.ledgerVerdicts)}`,
    `changed: ${report.changed}`,
    `gates open: ${report.summary.openGateIds.length}${
      visible.length > 0 ? `; ids=${visible.join(",")}${more}` : ""
    }`,
  ].join("\n");
}

function emit<T>(
  io: Io,
  json: boolean,
  value: T,
  compact: (result: T) => string,
  jsonValue: (result: T) => unknown = (result) => result
): void {
  const rendered = json
    ? JSON.stringify(jsonValue(value), null, 2)
    : compact(value);
  io.stdout(rendered.endsWith("\n") ? rendered : `${rendered}\n`);
}

function text(values: Values, name: string): string | undefined {
  const value = values.get(name);
  return typeof value === "string" ? value : undefined;
}

function requiredText(values: Values, name: string): string {
  const value = text(values, name);
  if (value === undefined) {
    throw new Error(`--${name} was not parsed`);
  }
  return value;
}

function optionalInteger(values: Values, name: string): number | undefined {
  const value = text(values, name);
  return value === undefined ? undefined : positiveInteger(value);
}

function storeDirectory(values: Values): string {
  const value = text(values, "store");
  if (value === undefined || value.trim().length === 0) {
    throw new UsageError("set --store <dir> or ORCH_STORE");
  }
  return value;
}

function frontierRepo(values: Values): string {
  const value = text(values, "repo");
  if (value === undefined || value.trim().length === 0) {
    throw new UsageError("set --repo <dir> or ORCH_REPO");
  }
  return value;
}

async function runStore<T>(
  values: Values,
  io: Io,
  operation: (store: Store) => Promise<T>,
  compact: (result: T) => string,
  jsonValue?: (result: T) => unknown
): Promise<void> {
  const store = openStore(storeDirectory(values), {
    force: values.get("force") === true,
    onLockStolen: (holder) =>
      io.stderr(`stealing store lock held by pid ${holder}\n`),
    onStaleLock: (holder) =>
      io.stderr(`replacing stale store lock (pid ${holder} is dead)\n`),
  });
  try {
    const result = await operation(store);
    emit(io, values.get("json") === true, result, compact, jsonValue);
  } finally {
    await store.close();
  }
}

function requireSubcommand(values: Values): never {
  storeDirectory(values);
  throw new UsageError("a valid command is required");
}

const pr = {
  name: "pr",
  description: "pull request number",
  validate: positiveInteger,
};
const sha = { name: "sha", description: "commit SHA" };

const PROGRAM: CommandSpec = {
  name: "orch",
  description: "Plain-file orchestrate bookkeeping",
  usage: "[--store <dir>] [--json] [--force] <command>",
  options: [
    {
      name: "store",
      placeholder: "<dir>",
      description: "store directory (or ORCH_STORE)",
      env: "ORCH_STORE",
    },
    {
      name: "json",
      description: "print complete rows as JSON",
      defaultText: "false",
    },
    {
      name: "force",
      description: "steal an existing store lock",
      defaultText: "false",
    },
  ],
  commands: [
    { name: "init", description: "initialize the store" },
    {
      name: "unit",
      description: "manage work units",
      commands: [
        {
          name: "add",
          description: "add a unit",
          arguments: [{ name: "id" }],
          options: [
            {
              name: "track",
              placeholder: "<track>",
              description: "unit track",
              required: true,
            },
            { name: "brief", placeholder: "<path>", description: "brief path" },
          ],
        },
        {
          name: "set",
          description: "update a unit",
          arguments: [{ name: "id" }],
          options: [
            {
              name: "state",
              placeholder: "<state>",
              description: "unit state",
              required: true,
            },
            {
              name: "branch",
              placeholder: "<branch>",
              description: "branch name",
            },
            {
              name: "pr",
              placeholder: "<number>",
              description: "pull request number",
              validate: positiveInteger,
            },
            { name: "sha", placeholder: "<sha>", description: "commit SHA" },
          ],
        },
        { name: "get", description: "get a unit", arguments: [{ name: "id" }] },
        {
          name: "list",
          description: "list units",
          options: [
            {
              name: "state",
              placeholder: "<state>",
              description: "filter by state",
            },
            {
              name: "track",
              placeholder: "<track>",
              description: "filter by track",
            },
          ],
        },
        { name: "counts", description: "count units by state" },
      ],
    },
    {
      name: "ledger",
      description: "manage verification records",
      commands: [
        {
          name: "record",
          description: "record a verification verdict",
          arguments: [
            pr,
            sha,
            {
              name: "verdict",
              description: "verification verdict",
              validate: parseVerdict,
            },
          ],
          options: [
            {
              name: "evidence",
              placeholder: "<path>",
              description: "evidence path",
              required: true,
            },
            {
              name: "verifier",
              placeholder: "<name>",
              description: "verifier name",
            },
          ],
        },
        {
          name: "check",
          description: "check a verification verdict",
          arguments: [pr, sha],
        },
        { name: "summary", description: "count verification verdicts" },
      ],
    },
    {
      name: "inbox",
      description: "manage agent pointers",
      commands: [
        {
          name: "push",
          description: "push an inbox pointer",
          arguments: [{ name: "agent" }, { name: "unit" }, { name: "status" }],
          options: [
            {
              name: "report",
              placeholder: "<path>",
              description: "report path",
            },
          ],
        },
        {
          name: "drain",
          description: "drain inbox pointers",
          options: [
            {
              name: "peek",
              description: "read without draining",
              defaultText: "false",
            },
          ],
        },
        { name: "count", description: "count inbox pointers" },
      ],
    },
    {
      name: "gate",
      description: "manage decision gates",
      commands: [
        {
          name: "park",
          description: "park a decision gate",
          arguments: [{ name: "id" }],
          options: [
            {
              name: "question",
              placeholder: "<question>",
              description: "gate question",
              required: true,
            },
            {
              name: "options",
              placeholder: "<options>",
              description: "gate options",
              required: true,
            },
            {
              name: "default",
              placeholder: "<answer>",
              description: "default answer",
              required: true,
            },
          ],
        },
        { name: "list", description: "list open decision gates" },
        {
          name: "resolve",
          description: "resolve a decision gate",
          arguments: [{ name: "id" }],
          options: [
            {
              name: "answer",
              placeholder: "<answer>",
              description: "chosen answer",
              required: true,
            },
          ],
        },
      ],
    },
    {
      name: "frontier",
      description: "manage the stack frontier",
      commands: [
        {
          name: "set",
          description:
            "resolve the pull request base chain and set the frontier",
          options: [
            {
              name: "repo",
              placeholder: "<dir>",
              description: "repository directory (or ORCH_REPO)",
              env: "ORCH_REPO",
            },
            {
              name: "prs",
              placeholder: "<n,...>",
              description: "optional expected pull request order pin",
              validate: prList,
            },
          ],
        },
        { name: "show", description: "show the frontier" },
      ],
    },
    { name: "status", description: "render status.md and print a summary" },
    {
      name: "standing",
      description: "manage standing orders",
      commands: [
        { name: "show", description: "show standing orders" },
        {
          name: "add",
          description: "add a standing order",
          arguments: [{ name: "line" }],
        },
      ],
    },
  ],
};

type Handler = (
  values: Values,
  args: readonly string[],
  io: Io
) => Promise<void>;

const HANDLERS: Readonly<Record<string, Handler>> = {
  init: (values, _args, io) =>
    runStore(
      values,
      io,
      (store) => store.init(),
      (result) => `initialized ${result.store}`
    ),
  "unit add": (values, [id], io) =>
    runStore(
      values,
      io,
      (store) =>
        store.units.add({
          id,
          track: requiredText(values, "track"),
          brief: text(values, "brief"),
        }),
      unitLine
    ),
  "unit set": (values, [id], io) =>
    runStore(
      values,
      io,
      (store) =>
        store.units.set({
          id,
          state: requiredText(values, "state"),
          branch: text(values, "branch"),
          pr: optionalInteger(values, "pr"),
          sha: text(values, "sha"),
        }),
      unitLine
    ),
  "unit get": (values, [id], io) =>
    runStore(values, io, (store) => store.units.get(id), unitLine),
  "unit list": (values, _args, io) =>
    runStore(
      values,
      io,
      (store) =>
        store.units.list({
          state: text(values, "state"),
          track: text(values, "track"),
        }),
      (rows) => compactRows(rows, unitLine, "(no units)")
    ),
  "unit counts": (values, _args, io) =>
    runStore(values, io, (store) => store.units.counts(), countLine),
  "ledger record": (values, [prArg, shaArg, verdict], io) =>
    runStore(
      values,
      io,
      (store) =>
        store.ledger.record({
          pr: positiveInteger(prArg),
          sha: shaArg,
          verdict: parseVerdict(verdict),
          evidence: requiredText(values, "evidence"),
          verifier: text(values, "verifier"),
        }),
      (row) => `${row.pr}\t${row.sha}\t${row.verdict}`
    ),
  "ledger check": (values, [prArg, shaArg], io) =>
    runStore(
      values,
      io,
      (store) =>
        store.ledger.check({ pr: positiveInteger(prArg), sha: shaArg }),
      (row) => row.verdict
    ),
  "ledger summary": (values, _args, io) =>
    runStore(values, io, (store) => store.ledger.summary(), countLine),
  "inbox push": (values, [agent, unitId, status], io) =>
    runStore(
      values,
      io,
      (store) =>
        store.inbox.push({
          agent,
          unit: unitId,
          status,
          report: text(values, "report"),
        }),
      (result) =>
        `${result.pointer.unit}\t${result.pointer.status}\t${result.filename}`,
      (result) => result.pointer
    ),
  "inbox drain": (values, _args, io) =>
    runStore(
      values,
      io,
      (store) =>
        values.get("peek") === true ? store.inbox.peek() : store.inbox.drain(),
      (rows) => compactRows(rows, pointerLine, "(empty)", null)
    ),
  "inbox count": (values, _args, io) =>
    runStore(
      values,
      io,
      (store) => store.inbox.count(),
      String,
      (count) => ({ count })
    ),
  "gate park": (values, [id], io) =>
    runStore(
      values,
      io,
      (store) =>
        store.gates.park({
          id,
          question: requiredText(values, "question"),
          options: requiredText(values, "options"),
          defaultAnswer: requiredText(values, "default"),
        }),
      (result) => `${result.id}\topen`
    ),
  "gate list": (values, _args, io) =>
    runStore(
      values,
      io,
      (store) => store.gates.list(),
      (rows) => compactRows(rows, gateLine, "(no open gates)")
    ),
  "gate resolve": (values, [id], io) =>
    runStore(
      values,
      io,
      (store) =>
        store.gates.resolve({ id, answer: requiredText(values, "answer") }),
      (result) => `${result.id}\tresolved\t${result.answer}`
    ),
  "frontier set": (values, _args, io) => {
    const prs = text(values, "prs");
    return runStore(
      values,
      io,
      (store) =>
        store.frontier.set({
          repo: frontierRepo(values),
          prs: prs === undefined ? undefined : prList(prs),
        }),
      frontierLine
    );
  },
  "frontier show": (values, _args, io) =>
    runStore(values, io, (store) => store.frontier.show(), frontierLine),
  status: (values, _args, io) =>
    runStore(values, io, (store) => store.status.render(), statusLines),
  "standing show": (values, _args, io) =>
    runStore(
      values,
      io,
      (store) => store.standing.show(),
      (rows) =>
        compactRows(
          rows,
          (item: StandingLine) => `${item.number}. ${item.line}`,
          "(no standing orders)"
        )
    ),
  "standing add": (values, [line], io) =>
    runStore(
      values,
      io,
      (store) => store.standing.add({ line }),
      (item) => `${item.number}. ${item.line}`
    ),
};

function handleError(error: unknown, values: Values, io: Io): number {
  if (error instanceof NotFoundError) {
    const output = error.output;
    if (output === undefined) {
      io.stderr(`error: ${error.message}\n`);
    } else {
      emit(io, values.get("json") === true, output.json, () => output.compact);
    }
    return 2;
  }
  io.stderr(`error: ${message(error)}\n`);
  if (error instanceof UsageError) {
    io.stderr(helpText([PROGRAM]));
  }
  return 1;
}

export async function main(
  argv: readonly string[],
  io: Io = {
    stdout: (value) => process.stdout.write(value),
    stderr: (value) => process.stderr.write(value),
  }
): Promise<number> {
  let values: Values = new Map();
  try {
    const parsed = parseCommandLine(PROGRAM, argv, process.env);
    if (parsed.kind === "help") {
      io.stdout(parsed.text);
      return 0;
    }
    if (parsed.kind === "error") {
      io.stderr(`${parsed.message}\n\n${parsed.help}`);
      return 1;
    }
    values = parsed.values;
    const handler = HANDLERS[parsed.path.join(" ")];
    if (handler === undefined) {
      requireSubcommand(values);
    }
    await handler(values, parsed.args, io);
    return 0;
  } catch (error) {
    return handleError(error, values, io);
  }
}

if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2));
}
