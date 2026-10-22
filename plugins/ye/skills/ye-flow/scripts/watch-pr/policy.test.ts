import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertMatch, rejectsIncluding } from "../match.test-helper.ts";
import { WatcherQueryError } from "./github.ts";
import {
  applyQueueSnapshot,
  assessGitHubMerge,
  classifyPr,
  createQueueState,
  evaluateQueue,
  planQueue,
  queryBackoffSeconds,
  readSnapshot,
  runQueued,
  selectTierMajorStackDecision,
} from "./policy.ts";
import {
  fakeReader,
  failedCheck,
  passingCheck,
  pendingCheck,
} from "./fakes.test-helper.ts";
import type {
  Check,
  GitHubReader,
  NonEmpty,
  PollingOptions,
  PrContext,
  ProgressVerdict,
  PullRequestFacts,
  RollupState,
} from "./types.ts";
import { parsePrNumber } from "./types.ts";

const context = (number: number): PrContext => ({
  owner: "owner",
  repo: "repo",
  number: parsePrNumber(number),
});
const options = {
  interval: 10,
  sweepInterval: 300,
  timeout: 0,
  maxQueryErrors: 5,
  allowDraft: false,
  humanGates: [],
} satisfies PollingOptions;

describe("readiness truth table", () => {
  it("covers every specified row and every UNKNOWN rollup value", () => {
    const cases: readonly [
      PullRequestFacts["mergeStateStatus"],
      RollupState,
      "allowed" | "refused",
    ][] = [
      ["BLOCKED", "FAILURE", "refused"],
      ["BLOCKED", "ERROR", "refused"],
      ["BLOCKED", "PENDING", "allowed"],
      ["UNSTABLE", "FAILURE", "allowed"],
      ["UNKNOWN", "ERROR", "allowed"],
      ["UNKNOWN", "EXPECTED", "allowed"],
      ["UNKNOWN", "FAILURE", "allowed"],
      ["UNKNOWN", "PENDING", "allowed"],
      ["UNKNOWN", "SUCCESS", "allowed"],
      ["UNKNOWN", null, "allowed"],
      ["CLEAN", "SUCCESS", "allowed"],
    ];
    for (const [mergeStateStatus, headRollupState, expected] of cases) {
      assert.equal(
        assessGitHubMerge({ mergeStateStatus, headRollupState }).kind,
        expected
      );
    }
  });

  it("turns a clean visible list plus GitHub refusal into an explicit CI blocker", async () => {
    const reader = fakeReader({
      facts: { mergeStateStatus: "BLOCKED" },
      fastPath: { kind: "checks", checks: [passingCheck()] },
      commitRollups: [{ oid: "head", state: "FAILURE" }],
    });
    const snapshot = await readSnapshot({
      reader,
      context: context(1),
      pendingHistory: "include",
      allowDraft: false,
      humanGates: [],
    });
    assert.equal(snapshot.kind, "open");
    if (snapshot.kind !== "open") throw new Error("expected open snapshot");
    assert.equal(snapshot.ci.kind, "ci-github-rejected");
    assertMatch(classifyPr(snapshot), {
      kind: "blocker",
      blocker: { kind: "failing-checks" },
    });
  });
});

describe("snapshot query planning", () => {
  it("does not query commit rollups while queued checks are pending", async () => {
    const reader = fakeReader({
      fastPath: { kind: "checks", checks: [pendingCheck()] },
    });
    const snapshot = await readSnapshot({
      reader,
      context: context(2),
      pendingHistory: "omit",
      allowDraft: false,
      humanGates: [],
    });
    assert.equal(snapshot.kind, "open");
    if (snapshot.kind !== "open") throw new Error("expected open snapshot");
    assert.equal(snapshot.ci.kind, "ci-pending");
    assert.deepStrictEqual(reader.calls, [
      "pullRequest",
      "reviewThreadPage:null",
      "checksFastPath",
    ]);
  });

  it("queries rollups for settled and failed lists", async () => {
    const settled = fakeReader();
    await readSnapshot({
      reader: settled,
      context: context(3),
      pendingHistory: "omit",
      allowDraft: false,
      humanGates: [],
    });
    assert.ok(settled.calls.includes("commitRollups"));

    const failed = fakeReader({
      fastPath: { kind: "checks", checks: [failedCheck()] },
    });
    await readSnapshot({
      reader: failed,
      context: context(4),
      pendingHistory: "omit",
      allowDraft: false,
      humanGates: [],
    });
    assert.ok(failed.calls.includes("commitRollups"));
  });

  it("short-circuits merged rows before threads and checks", async () => {
    const reader = fakeReader({
      facts: { state: "MERGED", mergedAt: "2026-07-26T00:00:00Z" },
    });
    assert.equal(
      (
        await readSnapshot({
          reader,
          context: context(5),
          pendingHistory: "include",
          allowDraft: false,
          humanGates: [],
        })
      ).kind,
      "merged"
    );
    assert.deepStrictEqual(reader.calls, ["pullRequest"]);
  });
});

it("scans stacks tier-major so an upstack conflict outranks frontier CI", async () => {
  const frontier = await readSnapshot({
    reader: fakeReader({
      fastPath: { kind: "checks", checks: [failedCheck()] },
      commitRollups: [{ oid: "head", state: "FAILURE" }],
    }),
    context: context(10),
    pendingHistory: "omit",
    allowDraft: false,
    humanGates: [],
  });
  const upstack = await readSnapshot({
    reader: fakeReader({ facts: { mergeable: "CONFLICTING" } }),
    context: context(11),
    pendingHistory: "omit",
    allowDraft: false,
    humanGates: [],
  });
  const decision = selectTierMajorStackDecision([frontier, upstack]);
  assertMatch(decision, {
    kind: "blocker",
    blocker: { kind: "merge-conflicts", pr: { number: 11 } },
  });
});

it("attributes a stack wait to the PR whose checks are pending, not the bottom", async () => {
  const readyBottom = await readSnapshot({
    reader: fakeReader(),
    context: context(20),
    pendingHistory: "omit",
    allowDraft: false,
    humanGates: [],
  });
  const pendingUpstack = await readSnapshot({
    reader: fakeReader({
      fastPath: { kind: "checks", checks: [pendingCheck("upstack-build")] },
    }),
    context: context(21),
    pendingHistory: "omit",
    allowDraft: false,
    humanGates: [],
  });
  const decision = selectTierMajorStackDecision([readyBottom, pendingUpstack]);
  assertMatch(decision, {
    kind: "waiting",
    frontier: { number: 21 },
    pending: [{ name: "upstack-build" }],
  });
});

it("waits on a draft while checks are pending, then reports the draft gate", async () => {
  const pending = await readSnapshot({
    reader: fakeReader({
      facts: { isDraft: true },
      fastPath: { kind: "checks", checks: [pendingCheck()] },
    }),
    context: context(12),
    pendingHistory: "omit",
    allowDraft: false,
    humanGates: [],
  });
  assert.equal(classifyPr(pending).kind, "waiting");

  const settled = await readSnapshot({
    reader: fakeReader({ facts: { isDraft: true } }),
    context: context(12),
    pendingHistory: "omit",
    allowDraft: false,
    humanGates: [],
  });
  assertMatch(classifyPr(settled), {
    kind: "blocker",
    blocker: { kind: "merge-gate", reason: "draft-pr" },
  });
});

it("ignores only the checks named as human gates", async () => {
  const checks: NonEmpty<Check> = [
    passingCheck(),
    pendingCheck("Approval Gate"),
    failedCheck("Owner Approval"),
  ];
  const gated = await readSnapshot({
    reader: fakeReader({ fastPath: { kind: "checks", checks } }),
    context: context(13),
    pendingHistory: "omit",
    allowDraft: false,
    humanGates: ["Approval Gate", "Owner Approval"],
  });
  assert.equal(classifyPr(gated).kind, "ready");

  const ungated = await readSnapshot({
    reader: fakeReader({ fastPath: { kind: "checks", checks } }),
    context: context(13),
    pendingHistory: "omit",
    allowDraft: false,
    humanGates: ["Approval Gate"],
  });
  assertMatch(classifyPr(ungated), {
    kind: "blocker",
    blocker: { kind: "failing-checks" },
  });
});

describe("queued-stack cadence", () => {
  async function openSnapshot(pr: PrContext) {
    return readSnapshot({
      reader: fakeReader(),
      context: pr,
      pendingHistory: "omit",
      allowDraft: false,
      humanGates: [],
    });
  }

  it("drops a sweep head only after its snapshot succeeds", async () => {
    const queue = [
      context(20),
      context(21),
      context(22),
    ] satisfies NonEmpty<PrContext>;
    let state = createQueueState(queue, 0);
    const first = await openSnapshot(queue[0]);
    state = applyQueueSnapshot(state, first, 0, options).state;
    assertMatch(state.work, {
      kind: "whole-stack-sweep",
      remaining: [{ number: 21 }, { number: 22 }],
    });
    const second = await openSnapshot(queue[1]);
    state = applyQueueSnapshot(state, second, 60, options).state;
    assertMatch(state.work, {
      kind: "whole-stack-sweep",
      remaining: [{ number: 22 }],
    });
  });

  it("resumes the sweep at the PR whose read failed", async () => {
    const middle = context(21);
    const base = fakeReader();
    let failNext = true;
    const timeline: string[] = [];
    const reader = {
      ...base,
      async pullRequest(pr: PrContext) {
        if (pr.number === middle.number && failNext) {
          failNext = false;
          timeline.push(`fail:${pr.number}`);
          throw new WatcherQueryError({
            kind: "command-exit",
            retryable: true,
            detail: "rate limited",
            code: 1,
          });
        }
        timeline.push(`read:${pr.number}`);
        return base.pullRequest(pr);
      },
    } satisfies GitHubReader;
    let now = 0;
    let sleeps = 0;
    const running = runQueued({
      dependencies: {
        reader,
        clock: {
          now: () => now,
          observedAt: () => "2026-07-26T00:00:00.000Z",
          async sleep(seconds) {
            timeline.push("sleep");
            now += seconds;
            sleeps += 1;
            if (sleeps === 2) throw new Error("stop after resume proof");
          },
        },
        emit(verdict) {
          timeline.push(`emit:${verdict.kind}`);
        },
      },
      contexts: [context(20), middle, context(22)],
      options,
    });
    await rejectsIncluding(running, "stop after resume proof");
    assert.deepStrictEqual(timeline, [
      "emit:QUEUE",
      "read:20",
      "fail:21",
      "emit:RETRY",
      "sleep",
      "read:21",
      "read:22",
      "emit:STATUS",
      "emit:WAITING",
      "sleep",
    ]);
  });

  it("emits a completed sweep only after its final successful snapshot", async () => {
    const queue = [context(30), context(31)] satisfies NonEmpty<PrContext>;
    let state = createQueueState(queue, 0);
    const first = applyQueueSnapshot(
      state,
      await openSnapshot(queue[0]),
      0,
      options
    );
    assert.equal(first.completedSweepRows, null);
    state = first.state;
    const second = applyQueueSnapshot(
      state,
      await openSnapshot(queue[1]),
      5,
      options
    );
    assert.deepStrictEqual(
      second.completedSweepRows?.map((row) => Number(row.context.number)),
      [30, 31]
    );
    assert.equal(second.state.nextSweepAt, 305);
  });

  it("ADVANCE continues directly to the new frontier without sleeping", async () => {
    const one = context(40);
    const two = context(41);
    const base = fakeReader();
    const reads = new Map<number, number>();
    const timeline: string[] = [];
    const reader = {
      ...base,
      async pullRequest(pr: PrContext) {
        timeline.push(`read:${pr.number}`);
        const facts = await base.pullRequest(pr);
        const count = (reads.get(pr.number) ?? 0) + 1;
        reads.set(pr.number, count);
        return pr.number === one.number && count > 1
          ? {
              ...facts,
              state: "MERGED" as const,
              mergedAt: "2026-07-26T00:00:00Z",
            }
          : facts;
      },
    } satisfies GitHubReader;
    let now = 0;
    let sleeps = 0;
    const emitted: ProgressVerdict[] = [];
    const running = runQueued({
      dependencies: {
        reader,
        clock: {
          now: () => now,
          observedAt: () => "2026-07-26T00:00:00.000Z",
          async sleep(seconds) {
            timeline.push("sleep");
            now += seconds;
            sleeps += 1;
            if (sleeps === 2) throw new Error("stop after advance proof");
          },
        },
        emit(verdict) {
          emitted.push(verdict);
          timeline.push(`emit:${verdict.kind}`);
        },
      },
      contexts: [one, two],
      options,
    });
    await rejectsIncluding(running, "stop after advance proof");
    assert.equal(
      emitted.some((event) => event.kind === "ADVANCE"),
      true
    );
    const firstSleep = timeline.indexOf("sleep");
    assert.deepStrictEqual(timeline.slice(firstSleep, firstSleep + 5), [
      "sleep",
      "read:40",
      "emit:ADVANCE",
      "read:41",
      "emit:WAITING",
    ]);
  });

  it("deduplicates identical waits and schedules the next due sweep", async () => {
    const queue = [context(50)] satisfies NonEmpty<PrContext>;
    let state = createQueueState(queue, 0);
    state = applyQueueSnapshot(
      state,
      await openSnapshot(queue[0]),
      0,
      options
    ).state;
    const first = evaluateQueue(state, 0, options);
    assert.equal(first.kind, "waiting");
    if (first.kind !== "waiting") throw new Error("expected waiting");
    assert.equal(first.emit, true);
    const second = evaluateQueue(first.state, 10, options);
    assert.equal(second.kind, "waiting");
    if (second.kind !== "waiting") throw new Error("expected waiting");
    assert.equal(second.emit, false);
    assert.equal(planQueue(second.state, 300).work?.kind, "whole-stack-sweep");
  });
});

it("uses the specified retry floor and cap", () => {
  assert.equal(queryBackoffSeconds(1, 1), 60);
  assert.equal(queryBackoffSeconds(1, 2), 120);
  assert.equal(queryBackoffSeconds(60, 4), 300);
});
