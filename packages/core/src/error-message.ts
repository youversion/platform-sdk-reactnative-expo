/**
 * Reads a message off a thrown Error.
 *
 * `catch` binds `unknown`; callers convert at the boundary with
 * `caught instanceof Error ? caught : new Error(String(caught))` so this
 * helper only ever sees an Error. One helper, one behaviour.
 */
export function toMessage(caught: Error): string {
  return caught.message
}
