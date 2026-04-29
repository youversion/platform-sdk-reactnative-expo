export type DomError =
  | {
      message: string
      name?: string
      status?: number
      code?: string
    }
  | null
  | undefined

/**
 * Expo DOM components run in a separate JS runtime (WebView) on native platforms.
 * Props crossing the native <-> DOM boundary are marshalled over an async JSON bridge.
 *
 * `Error` objects are not reliably serializable across that bridge (prototype is lost,
 * non-enumerable fields like `message` can be dropped, and complex errors can break
 * marshaling entirely). Passing raw `Error` instances is a common source of subtle bugs
 * where the DOM component receives `{}` or unexpected shapes.
 *
 * To keep the bridge stable, we send a small, serializable error DTO (`DomError`) and
 * reconstruct an `Error` inside the DOM component runtime when a web-only API expects it.
 */
export function toWebError(domError: DomError): Error | undefined {
  if (domError == null) return undefined

  const err = new Error(domError.message)
  if (domError.name != null) err.name = domError.name
  if (domError.status != null) Object.assign(err, { status: domError.status })
  if (domError.code != null) Object.assign(err, { code: domError.code })
  return err
}

