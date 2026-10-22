import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ChecksUnavailable,
  WatcherQueryError,
  buildReviewThreads,
  mapRollupNode,
  orderStack,
  parseFastCheck,
  parsePullRequest,
  parseReviewPage,
  parseReviewThreadPage,
  resolveChecks,
  resolveContext,
  resolveReviewThreads,
} from "./github.ts";
import {
  fakeReader,
  failedCheck,
  passingCheck,
  pendingCheck,
} from "./fakes.test-helper.ts";
import { assertMatch } from "../match.test-helper.ts";
import { parsePrNumber } from "./types.ts";

const context = {
  owner: "owner",
  repo: "repo",
  number: parsePrNumber(42),
};

describe("checks fallback chain", () => {
  it("uses a non-empty fast-path result without a rollup query", async () => {
    const reader = fakeReader({
      fastPath: { kind: "checks", checks: [passingCheck("fast")] },
    });
    const read = await resolveChecks(reader, context);
    assert.equal(read.source, "gh-pr-checks");
    assert.deepStrictEqual(
      read.checks.map((check) => check.name),
      ["fast"]
    );
    assert.deepStrictEqual(reader.calls, ["checksFastPath"]);
  });

  it("paginates GraphQL when the fast path is unusable", async () => {
    const reader = fakeReader({
      fastPath: { kind: "unusable", exitCode: 8, stderr: "" },
      rollupPages: [
        { checks: [passingCheck("first")], endCursor: "next" },
        { checks: [failedCheck("second")], endCursor: null },
      ],
    });
    const read = await resolveChecks(reader, context);
    assert.equal(read.source, "graphql-rollup");
    assert.deepStrictEqual(
      read.checks.map((check) => check.name),
      ["first", "second"]
    );
    assert.deepStrictEqual(reader.calls, [
      "checksFastPath",
      "checkRollupPage:null",
      "checkRollupPage:next",
    ]);
  });

  it("falls back when valid fast-path JSON represented an empty list", async () => {
    const reader = fakeReader({
      fastPath: { kind: "checks", checks: [] },
      rollupPages: [{ checks: [pendingCheck("fallback")], endCursor: null }],
    });
    assert.equal(
      (await resolveChecks(reader, context)).checks[0].name,
      "fallback"
    );
    assert.deepStrictEqual(reader.calls, [
      "checksFastPath",
      "checkRollupPage:null",
    ]);
  });

  it("fails closed when both paths are empty", async () => {
    const reader = fakeReader({
      fastPath: {
        kind: "unusable",
        exitCode: 8,
        stderr: "credential cannot read checks",
      },
    });
    await assert.rejects(resolveChecks(reader, context), ChecksUnavailable);
    assert.deepStrictEqual(reader.calls, [
      "checksFastPath",
      "checkRollupPage:null",
    ]);
  });
});

describe("rollup node mapping", () => {
  it("maps terminal and non-terminal CheckRun states fail closed", () => {
    const cases = [
      ["IN_PROGRESS", null, "pending", "PENDING"],
      ["COMPLETED", "SUCCESS", "passed", "SUCCESS"],
      ["COMPLETED", "NEUTRAL", "skipped", "NEUTRAL"],
      ["COMPLETED", "SKIPPED", "skipped", "SKIPPED"],
      ["COMPLETED", "ACTION_REQUIRED", "failed", "ACTION_REQUIRED"],
      ["COMPLETED", "TIMED_OUT", "failed", "FAILURE"],
      ["COMPLETED", "FUTURE_VALUE", "failed", "FAILURE"],
    ] as const;
    for (const [status, conclusion, kind, reportedState] of cases) {
      assertMatch(
        mapRollupNode({
          __typename: "CheckRun",
          name: "ci",
          status,
          conclusion,
        }),
        { kind, reportedState }
      );
    }
  });

  it("classifies an approval-gate check by its state like any other check", () => {
    assertMatch(
      mapRollupNode({
        __typename: "CheckRun",
        name: "Approval Gate",
        status: "IN_PROGRESS",
        conclusion: null,
      }),
      { kind: "pending" }
    );
    assertMatch(
      mapRollupNode({
        __typename: "StatusContext",
        context: "Approval Gate",
        state: "PENDING",
      }),
      { kind: "pending" }
    );
  });

  it("classifies an action-required approval gate as a failed check", () => {
    assertMatch(
      mapRollupNode({
        __typename: "CheckRun",
        name: "Approval Gate",
        status: "COMPLETED",
        conclusion: "ACTION_REQUIRED",
        description: "1 of 2 policies",
      }),
      {
        kind: "failed",
        reportedState: "ACTION_REQUIRED",
      }
    );
  });

  it("classifies a fast-path action-required approval gate as a failed check", () => {
    assertMatch(
      parseFastCheck({
        name: "Approval Gate",
        state: "ACTION_REQUIRED",
        bucket: "fail",
      }),
      {
        kind: "failed",
        reportedState: "ACTION_REQUIRED",
      }
    );
    assertMatch(
      parseFastCheck({ name: "ci", state: "ACTION_REQUIRED", bucket: "fail" }),
      { kind: "failed", reportedState: "ACTION_REQUIRED" }
    );
  });

  it("maps StatusContext states and drops unknown typenames", () => {
    assertMatch(
      mapRollupNode({
        __typename: "StatusContext",
        context: "ci",
        state: "EXPECTED",
      }),
      { kind: "pending", reportedState: "PENDING" }
    );
    assertMatch(
      mapRollupNode({
        __typename: "StatusContext",
        context: "ci",
        state: "FUTURE_VALUE",
      }),
      { kind: "failed", reportedState: "FUTURE_VALUE" }
    );
    assert.equal(mapRollupNode({ __typename: "FutureNode" }), null);
  });
});

describe("closed enum parsing", () => {
  const rawPullRequest = {
    mergeable: "MERGEABLE",
    mergeStateStatus: "CLEAN",
    reviewDecision: "APPROVED",
    headRefOid: "head",
    headRefName: "feature",
    baseRefName: "main",
    state: "OPEN",
    mergedAt: null,
    isDraft: false,
  };

  it("accepts mergeStateStatus CONFLICTING", () => {
    assert.equal(
      parsePullRequest(
        { ...rawPullRequest, mergeStateStatus: "CONFLICTING" },
        context
      ).mergeStateStatus,
      "CONFLICTING"
    );
  });

  it("reads gh's empty reviewDecision as no decision rather than a parse failure", () => {
    assert.equal(
      parsePullRequest({ ...rawPullRequest, reviewDecision: "" }, context)
        .reviewDecision,
      null
    );
  });

  it("still rejects an unknown reviewDecision", () => {
    assert.throws(
      () =>
        parsePullRequest(
          { ...rawPullRequest, reviewDecision: "MAYBE" },
          context
        ),
      WatcherQueryError
    );
  });

  it("rejects unknown enum values as retryable errors carrying the raw value", () => {
    try {
      parsePullRequest(
        { ...rawPullRequest, mergeStateStatus: "FUTURE_STATE" },
        context
      );
      throw new Error("expected parser to throw");
    } catch (error) {
      assert.ok(error instanceof WatcherQueryError);
      if (!(error instanceof WatcherQueryError)) throw error;
      assertMatch(error.failure, {
        kind: "missing-key",
        retryable: true,
        rawValue: '"FUTURE_STATE"',
      });
    }
  });
});

it("annotates review-bot threads with per-bot distinct review-pass counts", () => {
  const comment = (
    body: string,
    author: Record<string, unknown> | null,
    reviewId: string | null
  ) => ({
    body,
    createdAt: "now",
    path: "a.ts",
    line: 1,
    author,
    pullRequestReview: reviewId === null ? null : { id: reviewId },
  });
  const thread = (
    id: string,
    isResolved: boolean,
    body: ReturnType<typeof comment>
  ) => ({ id, isResolved, comments: { nodes: [body] } });
  const threadResponse = {
    data: {
      repository: {
        pullRequest: {
          reviewThreads: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: [
              thread(
                "one",
                false,
                comment(
                  "first finding",
                  { __typename: "Bot", login: "review-bot" },
                  "review-1"
                )
              ),
              thread(
                "two",
                false,
                comment(
                  "second bot finding",
                  { __typename: "User", login: "other-reviewer[bot]" },
                  "review-2"
                )
              ),
              thread(
                "resolved",
                true,
                comment(
                  "fixed finding",
                  { __typename: "Bot", login: "review-bot" },
                  "review-3"
                )
              ),
              thread(
                "human",
                false,
                comment(
                  "a person whose login mentions bots",
                  { __typename: "User", login: "robot-fan" },
                  "review-5"
                )
              ),
            ],
          },
        },
      },
    },
  };
  const reviewResponse = {
    data: {
      repository: {
        pullRequest: {
          reviews: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: [
              {
                id: "review-1",
                author: { __typename: "Bot", login: "review-bot" },
              },
              {
                id: "review-4",
                author: { __typename: "Bot", login: "review-bot" },
              },
              {
                id: "review-5",
                author: { __typename: "User", login: "robot-fan" },
              },
              { id: "review-6", author: null },
            ],
          },
        },
      },
    },
  };
  const threads = buildReviewThreads(
    parseReviewThreadPage(threadResponse).threads,
    parseReviewPage(reviewResponse).reviews
  );
  assert.equal(threads.length, 3);
  assert.deepStrictEqual(
    threads.map((item) => item.isReviewBot),
    [true, true, false]
  );
  assert.deepStrictEqual(
    threads.map((item) => item.reviewBotPasses),
    [3, 1, 0]
  );
});

describe("review thread pagination", () => {
  const thread = (id: string, resolved = false) => ({
    id,
    firstComment: {
      authorLogin: "someone",
      authorIsBot: false,
      body: "please fix",
      path: "a.ts",
      line: 1,
      createdAt: "now",
    },
    reviewId: null,
    resolved,
  });

  it("keeps walking pages until the cursor is exhausted", async () => {
    const reader = fakeReader({
      threadPages: [
        { threads: [thread("one")], endCursor: "next" },
        { threads: [thread("two")], endCursor: "last" },
        { threads: [thread("three")], endCursor: null },
      ],
    });
    const threads = await resolveReviewThreads(reader, context);
    assert.deepStrictEqual(
      threads.map((item) => item.id),
      ["one", "two", "three"]
    );
    assert.deepStrictEqual(reader.calls, [
      "reviewThreadPage:null",
      "reviewThreadPage:next",
      "reviewThreadPage:last",
    ]);
  });

  it("sees an unresolved thread that sits past the first page", async () => {
    const reader = fakeReader({
      threadPages: [
        { threads: [thread("early", true)], endCursor: "next" },
        { threads: [thread("late")], endCursor: null },
      ],
    });
    const threads = await resolveReviewThreads(reader, context);
    assert.deepStrictEqual(
      threads.map((item) => item.id),
      ["late"]
    );
  });

  it("stops after a single page when the cursor is exhausted", async () => {
    const reader = fakeReader({
      threadPages: [{ threads: [thread("only")], endCursor: null }],
    });
    assert.equal((await resolveReviewThreads(reader, context)).length, 1);
    assert.deepStrictEqual(reader.calls, ["reviewThreadPage:null"]);
  });

  it("counts review-bot passes across every page", async () => {
    const bot = (id: string, reviewId: string) => ({
      id,
      firstComment: {
        authorLogin: "review-bot",
        authorIsBot: true,
        body: "finding",
        path: "a.ts",
        line: 1,
        createdAt: "now",
      },
      reviewId,
      resolved: false,
    });
    const reader = fakeReader({
      threadPages: [
        { threads: [bot("one", "review-1")], endCursor: "next" },
        { threads: [bot("two", "review-2")], endCursor: null },
      ],
    });
    const threads = await resolveReviewThreads(reader, context);
    assert.deepStrictEqual(
      threads.map((item) => item.reviewBotPasses),
      [2, 2]
    );
  });

  it("counts a review bot's clean reviews across review pages", async () => {
    const review = (id: string) => ({
      id,
      authorLogin: "review-bot[bot]",
      authorIsBot: true,
    });
    const reader = fakeReader({
      threadPages: [
        {
          threads: [
            {
              id: "one",
              firstComment: {
                authorLogin: "review-bot",
                authorIsBot: true,
                body: "finding",
                path: "a.ts",
                line: 1,
                createdAt: "now",
              },
              reviewId: "review-1",
              resolved: false,
            },
          ],
          endCursor: null,
        },
      ],
      reviewPages: [
        { reviews: [review("review-1")], endCursor: "next" },
        { reviews: [review("review-2")], endCursor: null },
      ],
    });
    const threads = await resolveReviewThreads(reader, context);
    assert.deepStrictEqual(
      threads.map((item) => item.reviewBotPasses),
      [2]
    );
    assert.deepStrictEqual(reader.calls, [
      "reviewThreadPage:null",
      "reviewPage:null",
      "reviewPage:next",
    ]);
  });

  it("drops resolved threads from later pages too", async () => {
    const reader = fakeReader({
      threadPages: [
        { threads: [thread("one")], endCursor: "next" },
        { threads: [thread("two", true)], endCursor: null },
      ],
    });
    assert.deepStrictEqual(
      (await resolveReviewThreads(reader, context)).map((item) => item.id),
      ["one"]
    );
  });

  it("rejects a page that omits pageInfo instead of assuming one page", async () => {
    const response = {
      data: {
        repository: {
          pullRequest: { reviewThreads: { nodes: [] } },
        },
      },
    };
    assert.throws(() => parseReviewThreadPage(response), WatcherQueryError);
  });
});

describe("context and stack discovery", () => {
  it("returns a fully explicit context without any reader call", async () => {
    const reader = fakeReader();
    assert.deepStrictEqual(
      await resolveContext({
        reader,
        owner: "explicit",
        repo: "repo",
        pr: context.number,
      }),
      { owner: "explicit", repo: "repo", number: context.number }
    );
    assert.deepStrictEqual(reader.calls, []);
  });

  it("uses the local origin before currentPr for an explicit number", async () => {
    const reader = fakeReader({ origin: { owner: "local", repo: "checkout" } });
    assert.deepStrictEqual(
      await resolveContext({
        reader,
        owner: null,
        repo: null,
        pr: context.number,
      }),
      { owner: "local", repo: "checkout", number: context.number }
    );
    assert.deepStrictEqual(reader.calls, ["originRepo"]);
  });

  it("orders the connected stack bottom-to-top", () => {
    const ordered = orderStack(context, [
      {
        number: parsePrNumber(41),
        headRefName: "base-feature",
        baseRefName: "main",
      },
      {
        number: context.number,
        headRefName: "feature",
        baseRefName: "base-feature",
      },
      {
        number: parsePrNumber(43),
        headRefName: "upstack",
        baseRefName: "feature",
      },
    ]);
    assert.deepStrictEqual(
      ordered.map((item) => Number(item.number)),
      [41, 42, 43]
    );
  });
});
