// Server actions report failures by returning them, not by throwing.
//
// A production build redacts the message of anything a server action throws —
// the client only ever sees a generic "an error occurred" — so a thrown
// validation message never reaches the person who needs to read it. Returning
// the message keeps it intact.

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Runs a mutation, turning anything it throws into a readable result. Use it
 * to wrap the body of every server action that a form waits on.
 */
export async function attempt<T>(work: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (cause) {
    return { ok: false, error: describe(cause) };
  }
}

function describe(cause: unknown): string {
  if (cause instanceof Error && cause.message) return cause.message;
  return "Something went wrong saving that. Try again.";
}

/** Throws on failure — for callers that would rather use try/catch. */
export function unwrap<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new Error(result.error);
  return result.data;
}
