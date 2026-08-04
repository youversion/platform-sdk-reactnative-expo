/**
 * Reads a message off an unknown throw.
 *
 * `catch` binds `unknown`, and every non-throwing flow in this package has to
 * turn that into a `message` string for its failure outcome. Doing it inline
 * each time drifts: one site drops the `String` fallback, another stringifies an
 * Error to `[object Object]`. One helper, one behaviour.
 */
export function toMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught)
}
