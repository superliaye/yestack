import assert from "node:assert/strict";

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Keep only the parts of `actual` that `expected` names, so deepStrictEqual
// reports a readable diff. Arrays keep their full length.
function project(actual: unknown, expected: unknown): unknown {
  if (Array.isArray(expected) && Array.isArray(actual))
    return actual.length === expected.length
      ? actual.map((item, index) => project(item, expected[index]))
      : actual;
  if (isPlainRecord(expected) && isPlainRecord(actual)) {
    const projected: Record<string, unknown> = {};
    for (const key of Object.keys(expected))
      if (key in actual) projected[key] = project(actual[key], expected[key]);
    return projected;
  }
  return actual;
}

/** Asserts that `actual` contains `expected`: object keys are a subset, arrays match in full. */
export function assertMatch(actual: unknown, expected: unknown): void {
  assert.deepStrictEqual(project(actual, expected), expected);
}

const includes = (text: string) => (error: unknown) =>
  error instanceof Error && error.message.includes(text);

export function throwsIncluding(run: () => unknown, text: string): void {
  assert.throws(run, includes(text));
}

export async function rejectsIncluding(
  promise: Promise<unknown>,
  text: string
): Promise<void> {
  await assert.rejects(promise, includes(text));
}
