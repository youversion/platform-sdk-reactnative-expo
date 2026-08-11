/**
 * The two things only the write path knows and the drain needs to hear.
 *
 * Not a queue subscription: queue-first writes persist an entry for every tap,
 * so observing storage would wake the drain on writes a mounted hook is already
 * sending. These fire only when the drain has something to do.
 */

/**
 * `service-reached` — a request just came back, so the network is up; try
 * everything due, now. `write-parked` — a write is owed; start the backoff loop
 * rather than waiting on a foreground, which may never come.
 */
export type DrainSignal = 'service-reached' | 'write-parked'

export type DrainSignalListener = (signal: DrainSignal) => void

const listeners = new Set<DrainSignalListener>()

export function onDrainSignal(listener: DrainSignalListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function notifyDrain(signal: DrainSignal): void {
  for (const listener of [...listeners]) {
    listener(signal)
  }
}
