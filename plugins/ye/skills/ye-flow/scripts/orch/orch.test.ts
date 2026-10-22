import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { afterEach, describe, it } from "node:test";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  NotFoundError,
  UserError,
  openStore,
  parseVerdict,
  type OpenStoreOptions,
  type Store,
} from "./store.ts";
import {
  assertMatch,
  rejectsIncluding,
  throwsIncluding,
} from "../match.test-helper.ts";

const SCRIPT = join(import.meta.dirname, "orch.ts");
const directories: string[] = [];
const handles: Store[] = [];

interface RunResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

async function makeDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "orch-test-"));
  directories.push(directory);
  return directory;
}

function useStore(directory: string, options?: OpenStoreOptions): Store {
  const store = openStore(directory, options);
  handles.push(store);
  return store;
}

async function initializedStore(): Promise<{
  readonly directory: string;
  readonly store: Store;
}> {
  const directory = await makeDirectory();
  const store = useStore(directory);
  await store.init();
  return { directory, store };
}

function git({
  args,
  repo,
}: {
  args: readonly string[];
  repo: string;
}): string {
  const result = spawnSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

async function makeGitStack(directory: string): Promise<{
  readonly repo: string;
  readonly mergedSha: string;
  readonly closedSha: string;
  readonly openSha: string;
  readonly draftSha: string;
}> {
  const repo = join(directory, "repo");
  await mkdir(repo);
  git({ repo, args: ["init", "--initial-branch=main"] });
  git({ repo, args: ["config", "user.name", "Orch Test"] });
  git({ repo, args: ["config", "user.email", "orch@example.com"] });
  await writeFile(join(repo, "main.txt"), "main\n");
  git({ repo, args: ["add", "."] });
  git({ repo, args: ["commit", "-m", "main"] });

  const branches = [
    "stack/merged",
    "stack/closed",
    "stack/open",
    "stack/draft",
  ];
  for (const [index, branch] of branches.entries()) {
    git({ repo, args: ["checkout", "-b", branch] });
    await writeFile(join(repo, `stack-${index}.txt`), `${branch}\n`);
    git({ repo, args: ["add", "."] });
    git({ repo, args: ["commit", "-m", branch] });
  }
  git({ repo, args: ["checkout", "stack/open"] });

  return {
    repo,
    mergedSha: git({ repo, args: ["rev-parse", "stack/merged"] }),
    closedSha: git({ repo, args: ["rev-parse", "stack/closed"] }),
    openSha: git({ repo, args: ["rev-parse", "stack/open"] }),
    draftSha: git({ repo, args: ["rev-parse", "stack/draft"] }),
  };
}

type FixtureState = "open" | "draft" | "merged" | "closed";

function ghRows(
  prs: readonly {
    number: number;
    state: FixtureState;
    head: string;
    base: string;
  }[],
): string {
  return JSON.stringify(
    prs.map(({ number, state, head, base }) => ({
      number,
      state: state === "draft" ? "OPEN" : state.toUpperCase(),
      headRefName: head,
      baseRefName: base,
    })),
  );
}

async function withFakeGh<T>({
  directory,
  operation,
  currentRows,
}: {
  directory: string;
  operation: () => Promise<T>;
  currentRows?: string;
}): Promise<T> {
  const bin = join(directory, "bin");
  const outputPath = join(directory, "gh-output.txt");
  await mkdir(bin, { recursive: true });
  await writeFile(
    outputPath,
    `${
      currentRows ??
      ghRows([
        {
          number: 11,
          state: "open",
          head: "stack/open",
          base: "stack/closed",
        },
      ])
    }\n`,
  );
  const fields = "number,state,headRefName,baseRefName";
  const list = (filter: string, branch: string): string =>
    `pr list ${filter} ${branch} --state all --json ${fields}`;
  const fake = join(bin, "gh");
  await writeFile(
    fake,
    `#!/usr/bin/env bash
set -euo pipefail
if [ "$(pwd -P)" != "${realpathSync(join(directory, "repo"))}" ]; then
  printf 'gh ran outside the fixture repo: %s\\n' "$(pwd -P)" >&2
  exit 2
fi
case "$*" in
  "${list("--head", "stack/open")}")
    cat "${outputPath}"
    ;;
  "${list("--head", "stack/closed")}")
    printf '%s\\n' '${ghRows([{ number: 13, state: "closed", head: "stack/closed", base: "stack/merged" }])}'
    ;;
  "${list("--head", "stack/merged")}")
    printf '%s\\n' '${ghRows([{ number: 10, state: "merged", head: "stack/merged", base: "main" }])}'
    ;;
  "${list("--base", "stack/open")}")
    printf '%s\\n' '${ghRows([
      { number: 14, state: "draft", head: "stack/draft", base: "stack/open" },
      {
        number: 15,
        state: "closed",
        head: "stack/abandoned",
        base: "stack/open",
      },
    ])}'
    ;;
  "${list("--base", "stack/draft")}")
    printf '[]\\n'
    ;;
  *)
    printf 'unexpected gh arguments: %s\\n' "$*" >&2
    exit 2
    ;;
esac
`,
  );
  await chmod(fake, 0o755);

  const originalPath = process.env.PATH;
  process.env.PATH = `${bin}:${originalPath ?? ""}`;
  try {
    return await operation();
  } finally {
    if (originalPath === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = originalPath;
    }
  }
}

function runCli(
  args: readonly string[],
  env: Readonly<Record<string, string | undefined>> = process.env,
): RunResult {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], {
    env,
    encoding: "utf8",
  });
  return {
    code: result.status ?? -1,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

afterEach(async () => {
  for (const store of handles.splice(0).reverse()) {
    await store.close();
  }
  for (const directory of directories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

describe("Store", () => {
  it("initializes an idempotent plain-file store and releases its lock", async () => {
    const directory = await makeDirectory();
    const store = useStore(directory);

    assert.deepStrictEqual(await store.init(), { store: directory });
    const firstUnits = await readFile(join(directory, "units.tsv"), "utf8");
    const firstLedger = await readFile(join(directory, "ledger.tsv"), "utf8");

    assert.deepStrictEqual(await store.init(), { store: directory });
    assert.equal(
      await readFile(join(directory, "units.tsv"), "utf8"),
      firstUnits,
    );
    assert.equal(
      await readFile(join(directory, "ledger.tsv"), "utf8"),
      firstLedger,
    );
    assert.deepStrictEqual((await readdir(directory)).sort(), [
      ".orch.lock",
      "frontier.json",
      "gates.md",
      "inbox",
      "ledger.tsv",
      "preferences.md",
      "units.tsv",
    ]);

    await store.close();
    assert.ok(!(await readdir(directory)).includes(".orch.lock"));
  });

  it("composes unit add, set, get, list, and counts", async () => {
    const { store } = await initializedStore();

    assertMatch(
      await store.units.add({
        id: "u1",
        track: "build",
        brief: "briefs/u1.md",
      }),
      { id: "u1", state: "pending" },
    );
    assertMatch(await store.units.add({ id: "=SUM(A1)", track: "+build" }), {
      id: "'=SUM(A1)",
      track: "'+build",
    });

    const updated = await store.units.set({
      id: "u1",
      state: "done",
      branch: "feature/u1",
      pr: 184530,
      sha: "abc123",
    });
    assert.deepStrictEqual(updated, {
      id: "u1",
      track: "build",
      state: "done",
      branch: "feature/u1",
      pr: "184530",
      sha: "abc123",
      brief: "briefs/u1.md",
    });
    assert.deepStrictEqual(await store.units.get("u1"), updated);
    assert.deepStrictEqual(
      await store.units.list({ state: "done", track: "build" }),
      [updated],
    );
    assert.deepStrictEqual(await store.units.counts(), { done: 1, pending: 1 });
    await rejectsIncluding(
      store.units.add({ id: "u1", track: "build" }),
      "unit u1 already exists",
    );
    await assert.rejects(
      store.units.set({ id: "missing", state: "done" }),
      NotFoundError,
    );
  });

  it("records, replaces, checks, and summarizes typed ledger verdicts", async () => {
    const { store } = await initializedStore();

    try {
      await store.ledger.check({ pr: 184530, sha: "abc123" });
      throw new Error("expected ledger check to fail");
    } catch (error) {
      assert.ok(error instanceof NotFoundError);
      if (error instanceof NotFoundError) {
        assert.deepStrictEqual(error.output, {
          compact: "NOT-VERIFIED",
          json: {
            pr: "184530",
            sha: "abc123",
            verdict: "NOT-VERIFIED",
          },
        });
      }
    }
    throwsIncluding(() => parseVerdict("looks-good"), "verdict must be");

    const recorded = await store.ledger.record({
      pr: 184530,
      sha: "abc123",
      verdict: "unit-test-verified",
      evidence: "reports/verify.md",
      verifier: "lane-a",
    });
    assert.deepStrictEqual(
      await store.ledger.check({ pr: 184530, sha: "abc123" }),
      recorded,
    );
    assert.deepStrictEqual(await store.ledger.summary(), {
      "unit-test-verified": 1,
    });

    await store.ledger.record({
      pr: 184530,
      sha: "abc123",
      verdict: "live-ui-verified",
      evidence: "reports/live.md",
    });
    assert.deepStrictEqual(await store.ledger.summary(), {
      "live-ui-verified": 1,
    });
  });

  it("pushes, peeks, and atomically drains inbox pointers", async () => {
    const { directory, store } = await initializedStore();

    const first = await store.inbox.push({
      agent: "worker-1",
      unit: "u1",
      status: "done",
      report: "reports/u1.md",
    });
    assertMatch(first.pointer, { unit: "u1", status: "done" });
    assert.ok(first.filename.endsWith(".tsv"));
    await store.inbox.push({
      agent: "worker-2",
      unit: "u2",
      status: "failed",
    });

    assert.equal(await store.inbox.count(), 2);
    assert.equal((await store.inbox.peek()).length, 2);
    assert.equal(await store.inbox.count(), 2);
    assert.equal((await store.inbox.drain()).length, 2);
    assert.equal(await store.inbox.count(), 0);
    assert.deepStrictEqual(await readdir(join(directory, "inbox")), []);
    assert.deepStrictEqual(
      (await readdir(directory)).filter((name) =>
        name.startsWith(".inbox-drain-"),
      ),
      [],
    );
  });

  it("replaces a stale lock whose holder pid is dead", async () => {
    const { directory } = await initializedStore();
    const exited = spawnSync("true");
    await writeFile(join(directory, ".orch.lock"), `${exited.pid}\n`);

    const stale: string[] = [];
    const recovered = useStore(directory, {
      onStaleLock: (holder) => stale.push(holder),
    });
    assertMatch(await recovered.units.add({ id: "u1", track: "build" }), {
      id: "u1",
    });
    assert.deepStrictEqual(stale, [String(exited.pid)]);
    await recovered.close();
    assert.ok(!(await readdir(directory)).includes(".orch.lock"));
  });

  it("blocks a writer and steals the pid lock only with force", async () => {
    const { directory, store } = await initializedStore();
    await store.close();
    await writeFile(join(directory, ".orch.lock"), `${process.pid}\n`);

    const blocked = useStore(directory);
    await rejectsIncluding(
      blocked.units.add({ id: "u1", track: "build" }),
      `store lock held by pid ${process.pid}`,
    );

    const stolen: string[] = [];
    const forced = useStore(directory, {
      force: true,
      onLockStolen: (holder) => stolen.push(holder),
    });
    assertMatch(await forced.units.add({ id: "u1", track: "build" }), {
      id: "u1",
    });
    assert.deepStrictEqual(stolen, [String(process.pid)]);
    await forced.close();
    assert.ok(!(await readdir(directory)).includes(".orch.lock"));
  });

  it("parks gates, stores standing orders, and renders status", async () => {
    const { directory, store } = await initializedStore();
    await store.units.add({ id: "u1", track: "build" });
    assertMatch(
      await store.gates.park({
        id: "release",
        question: "Ship now?",
        options: "ship,wait",
        defaultAnswer: "wait",
      }),
      { kind: "open", id: "release" },
    );
    assert.deepStrictEqual(
      await store.standing.add({ line: "Never force push." }),
      { number: 1, line: "Never force push." },
    );

    const first = await store.status.render();
    assert.equal(first.changed, "first render");
    assert.deepStrictEqual(first.summary.openGateIds, ["release"]);
    assert.ok(
      (await readFile(join(directory, "status.md"), "utf8")).includes(
        "| release | open | Ship now? |",
      ),
    );
    assert.equal((await store.status.render()).changed, "no derived changes");

    assertMatch(await store.gates.resolve({ id: "release", answer: "ship" }), {
      kind: "resolved",
      answer: "ship",
    });
    assert.equal((await store.status.render()).changed, "open gates 1->0");
    assert.deepStrictEqual(await store.gates.list(), []);
    assert.deepStrictEqual(await store.standing.show(), [
      { number: 1, line: "Never force push." },
    ]);
  });

  it("resolves the ordered frontier from the gh base chain and validates an optional pin", async () => {
    const { directory, store } = await initializedStore();
    const stack = await makeGitStack(directory);

    await withFakeGh({
      directory,
      operation: async () => {
        assert.deepStrictEqual(await store.frontier.set({ repo: stack.repo }), {
          generation: 1,
          prs: [
            {
              pr: 10,
              branches: "stack/merged",
              sha: stack.mergedSha,
              state: "MERGED",
            },
            {
              pr: 13,
              branches: "stack/closed",
              sha: stack.closedSha,
              state: "CLOSED",
            },
            {
              pr: 11,
              branches: "stack/open",
              sha: stack.openSha,
              state: "OPEN",
            },
            {
              pr: 14,
              branches: "stack/draft",
              sha: stack.draftSha,
              state: "OPEN",
            },
          ],
          lowestUnmerged: 11,
        });
        assert.equal(
          (
            await store.frontier.set({
              repo: stack.repo,
              prs: [10, 13, 11, 14],
            })
          ).generation,
          2,
        );
        assert.equal((await store.frontier.show()).generation, 2);
        await rejectsIncluding(
          store.frontier.set({
            repo: stack.repo,
            prs: [10, 11, 12],
          }),
          "frontier pin mismatch: missing from resolved chain: 12; extra in resolved chain: 13,14",
        );
        await rejectsIncluding(
          store.frontier.set({
            repo: stack.repo,
            prs: [13, 10, 11, 14],
          }),
          "frontier pin mismatch: order differs: expected 13,10,11,14; resolved 10,13,11,14",
        );
        await rejectsIncluding(
          store.frontier.set({
            repo: stack.repo,
            prs: [10, 10],
          }),
          "--prs must not contain duplicates",
        );
      },
    });
  });

  it("rejects unparseable gh output loudly", async () => {
    const { directory, store } = await initializedStore();
    const stack = await makeGitStack(directory);

    await withFakeGh({
      directory,
      currentRows: "this line is not gh output",
      operation: async () => {
        await rejectsIncluding(
          store.frontier.set({ repo: stack.repo }),
          "gh pr list --head stack/open output is not valid JSON",
        );
      },
    });
  });

  it("names the missing pull request when a chain branch has none", async () => {
    const { directory, store } = await initializedStore();
    const stack = await makeGitStack(directory);

    await withFakeGh({
      directory,
      currentRows: "[]",
      operation: async () => {
        await rejectsIncluding(
          store.frontier.set({ repo: stack.repo }),
          "branch stack/open has no pull request; open one with gh pr create",
        );
      },
    });
  });

  it("rejects malformed TSV, verdict, frontier, and inbox data", async () => {
    const { directory, store } = await initializedStore();

    await writeFile(join(directory, "units.tsv"), "wrong\n");
    await rejectsIncluding(
      store.units.list(),
      "units.tsv has an invalid header",
    );
    await writeFile(
      join(directory, "units.tsv"),
      "id\ttrack\tstate\tbranch\tpr\tsha\tbrief\nshort\trow\n",
    );
    await rejectsIncluding(store.units.list(), "units.tsv has a malformed row");

    await writeFile(
      join(directory, "ledger.tsv"),
      "pr\tsha\tverdict\tevidence\tverifier\tts\n1\tsha\tinvalid\treport\tme\tnow\n",
    );
    await rejectsIncluding(
      store.ledger.summary(),
      "ledger.tsv has invalid verdict invalid",
    );

    await writeFile(join(directory, "frontier.json"), '{"generation":"1"}\n');
    await rejectsIncluding(
      store.frontier.show(),
      "frontier.json has an invalid shape",
    );

    await writeFile(join(directory, "inbox", "bad.tsv"), "too\tshort\n");
    await rejectsIncluding(
      store.inbox.peek(),
      "inbox pointer bad.tsv is malformed",
    );
  });

  it("rejects operations after close", async () => {
    const { store } = await initializedStore();
    await store.close();
    await rejectsIncluding(store.units.list(), "store is closed");
    await assert.rejects(store.status.render(), UserError);
  });
});

describe("orch CLI", () => {
  it("prints help and rejects invalid parsing with exit 1", async () => {
    const help = runCli(["--help"]);
    assert.equal(help.code, 0);
    assert.ok(help.stdout.includes("Commands:"));
    assert.ok(help.stdout.includes("unit"));
    assert.ok(help.stdout.includes("ledger"));

    const frontierHelp = runCli(["frontier", "set", "--help"]);
    assert.equal(frontierHelp.code, 0);
    assert.ok(frontierHelp.stdout.includes("--repo <dir>"));
    assert.ok(frontierHelp.stdout.includes("--prs <n,...>"));

    const directory = await makeDirectory();
    const invalid = runCli(["--store", directory, "unit", "add", "u1"]);
    assert.equal(invalid.code, 1);
    assert.ok(invalid.stderr.includes("required option '--track <track>'"));

    const unknownOption = runCli([
      "--store",
      directory,
      "frontier",
      "set",
      "--repo",
      directory,
      "--forge",
      "gh",
    ]);
    assert.equal(unknownOption.code, 1);
    assert.ok(unknownOption.stderr.includes("unknown option '--forge'"));
  });

  it("accepts ORCH_STORE and emits complete JSON", async () => {
    const directory = await makeDirectory();
    const env = { ...process.env, ORCH_STORE: directory };
    assert.equal(runCli(["init"], env).code, 0);

    const added = runCli(
      ["unit", "add", "u1", "--track", "build", "--json"],
      env,
    );
    assert.equal(added.code, 0);
    assert.deepStrictEqual(JSON.parse(added.stdout), {
      id: "u1",
      track: "build",
      state: "pending",
      branch: "",
      pr: "",
      sha: "",
      brief: "",
    });
  });

  it("maps user and not-found outcomes to the preserved exit codes", async () => {
    const directory = await makeDirectory();
    assert.equal(runCli(["--store", directory, "init"]).code, 0);

    const missingRepo = runCli(["--store", directory, "frontier", "set"]);
    assert.equal(missingRepo.code, 1);
    assert.ok(missingRepo.stderr.includes("set --repo <dir> or ORCH_REPO"));

    const userError = runCli([
      "--store",
      directory,
      "unit",
      "add",
      "",
      "--track",
      "build",
    ]);
    assert.equal(userError.code, 1);
    assert.ok(userError.stderr.includes("unit id must not be empty"));

    const missingUnit = runCli([
      "--store",
      directory,
      "unit",
      "get",
      "missing",
    ]);
    assert.equal(missingUnit.code, 2);
    assert.ok(missingUnit.stderr.includes("unit missing not found"));

    const missingLedger = runCli([
      "--store",
      directory,
      "--json",
      "ledger",
      "check",
      "184530",
      "abc123",
    ]);
    assert.equal(missingLedger.code, 2);
    assert.deepStrictEqual(JSON.parse(missingLedger.stdout), {
      pr: "184530",
      sha: "abc123",
      verdict: "NOT-VERIFIED",
    });
    assert.equal(missingLedger.stderr, "");
  });
});
