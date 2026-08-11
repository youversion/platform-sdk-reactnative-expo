/**
 * Writes that have not reached the server, persisted until they do. See ADR 0017.
 *
 * Storage, plus a notification for the one change no one else can see (see
 * {@link onWritesDropped}). Eligibility belongs to the write path, and the drain
 * belongs to the provider.
 */

import { z } from 'zod'

import { mmkvStorage } from '../storage/mmkv-storage'
import {
  highlightQueueKey,
  highlightQueueUserPrefix,
  MMKV_HIGHLIGHT_QUEUE_KEY_PREFIX,
  type HighlightScope,
  type QueuedWrites,
  type ServerColors,
} from './constants'

/** Never mutate a returned map — a miss returns this shared instance. */
const EMPTY: QueuedWrites = Object.freeze({})

/** `null` is a removed highlight, on either side of an entry. */
const colorSchema = z.union([z.string().regex(/^[0-9a-f]{6}$/i), z.null()])

const queuedWritesSchema = z.record(
  z.string().regex(/^\d+$/),
  z.object({ local: colorSchema, server: colorSchema }),
)

function normalizeColor(color: string | null): string | null {
  return color === null ? null : color.toLowerCase()
}

/** Reads a scope's unsent writes. A corrupt payload reads as empty; never throws. */
export function getQueuedWrites(userId: string | null, scope: HighlightScope): QueuedWrites {
  if (!userId) {
    return EMPTY
  }

  try {
    const raw = mmkvStorage.getString(highlightQueueKey(userId, scope))
    if (raw == null) {
      return EMPTY
    }
    const parsed = queuedWritesSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) {
      return EMPTY
    }

    const queued: QueuedWrites = {}
    for (const [verse, entry] of Object.entries(parsed.data)) {
      const verseNumber = Number(verse)
      if (!Number.isInteger(verseNumber) || verseNumber < 1) {
        continue
      }
      queued[verseNumber] = {
        local: normalizeColor(entry.local),
        server: normalizeColor(entry.server),
      }
    }
    return queued
  } catch {
    return EMPTY
  }
}

/**
 * Every scope this user has unsent writes for. The drain's only way to find a
 * chapter after a relaunch, where nothing in memory remembers one.
 */
export function listQueuedScopes(userId: string | null): HighlightScope[] {
  if (!userId) {
    return []
  }

  const prefix = highlightQueueUserPrefix(userId)
  try {
    return mmkvStorage
      .getAllKeys()
      .filter((key) => key.startsWith(prefix))
      .flatMap((key) => {
        const scope = parseScopeSuffix(key.slice(prefix.length))
        return scope === null ? [] : [scope]
      })
  } catch {
    return []
  }
}

/**
 * Does this user have writes the server has not taken yet?
 *
 * Read at the moment sign-out is offered, not subscribed to. The answer is only
 * ever needed on that one gesture, and it is a plain key scan — a store and a
 * subscription would buy nothing but a value nobody watches.
 *
 * Any key under the user's prefix counts, including one whose scope suffix
 * {@link listQueuedScopes} would reject. The drain cannot send that entry, which
 * makes it more certain to be lost on sign-out, not less.
 */
export function hasQueuedHighlightWrites(userId: string | null): boolean {
  if (!userId) {
    return false
  }

  const prefix = highlightQueueUserPrefix(userId)
  try {
    return mmkvStorage.getAllKeys().some((key) => key.startsWith(prefix))
  } catch {
    return false
  }
}

/** `111.JHN.3` — the tail of a queue key. Book codes and chapters carry no dots. */
function parseScopeSuffix(suffix: string): HighlightScope | null {
  const parts = suffix.split('.')
  if (parts.length !== 3) {
    return null
  }
  const [versionIdRaw, book, chapter] = parts
  if (!versionIdRaw || !book || !chapter || !/^\d+$/.test(versionIdRaw)) {
    return null
  }
  return { versionId: Number(versionIdRaw), book, chapter }
}

function persist(userId: string, scope: HighlightScope, queued: QueuedWrites): void {
  const key = highlightQueueKey(userId, scope)
  if (Object.keys(queued).length === 0) {
    mmkvStorage.remove(key)
    return
  }
  mmkvStorage.set(key, JSON.stringify(queued))
}

/**
 * Records the end state `verses` should reach — a color, or `null` to remove.
 *
 * `currentColors` seeds `server` for a verse with no entry yet. Pass what is on
 * screen: with no entry, nothing about that verse is unconfirmed, so the painted
 * color *is* what the server last gave us.
 */
export function enqueueWrites(input: {
  userId: string
  scope: HighlightScope
  verses: readonly number[]
  color: string | null
  currentColors: ServerColors
}): QueuedWrites {
  const { userId, scope, verses, color, currentColors } = input
  const local = normalizeColor(color)
  const queued: QueuedWrites = { ...getQueuedWrites(userId, scope) }

  for (const verse of verses) {
    const existing = queued[verse]
    const server = existing === undefined ? (currentColors[verse] ?? null) : existing.server
    if (local === server) {
      delete queued[verse]
    } else {
      queued[verse] = { local, server }
    }
  }

  persist(userId, scope, queued)
  return queued
}

/**
 * Drops the entries a settled write is responsible for, reporting each one's
 * `server` state so a rejected write can be reverted.
 *
 * Only entries still asking for `color` are dropped. A verse the user has since
 * re-tapped holds a different intent, and the settling write — which knows
 * nothing about it — must not retire or revert it. Two taps of the same color
 * need no such guard: they ask for the same thing, so either may retire it.
 */
export function dropWrites(input: {
  userId: string
  scope: HighlightScope
  verses: readonly number[]
  color: string | null
}): { restored: ServerColors; cleared: number[] } {
  const { userId, scope, verses, color } = input
  const local = normalizeColor(color)
  const queued: QueuedWrites = { ...getQueuedWrites(userId, scope) }
  const restored: ServerColors = {}
  const cleared: number[] = []
  let changed = false

  for (const verse of verses) {
    const entry = queued[verse]
    if (entry === undefined || entry.local !== local) {
      continue
    }
    if (entry.server === null) {
      cleared.push(verse)
    } else {
      restored[verse] = entry.server
    }
    delete queued[verse]
    changed = true
  }

  if (changed) {
    persist(userId, scope, queued)
  }
  return { restored, cleared }
}

export type DroppedWrites = {
  userId: string
  scope: HighlightScope
  restored: ServerColors
  cleared: number[]
}

const dropListeners = new Set<(dropped: DroppedWrites) => void>()

/** Subscribes to {@link dropRejectedWrites}. Returns an unsubscribe. */
export function onWritesDropped(listener: (dropped: DroppedWrites) => void): () => void {
  dropListeners.add(listener)
  return () => {
    dropListeners.delete(listener)
  }
}

/**
 * {@link dropWrites}, plus an announcement of what to un-paint. Only the drain
 * needs it: a settling write already owns its own paint, while a drop takes back
 * paint a mounted reader is still showing (ADR 0017).
 */
export function dropRejectedWrites(input: {
  userId: string
  scope: HighlightScope
  verses: readonly number[]
  color: string | null
}): { restored: ServerColors; cleared: number[] } {
  const dropped = dropWrites(input)
  if (Object.keys(dropped.restored).length === 0 && dropped.cleared.length === 0) {
    return dropped
  }

  const event: DroppedWrites = { userId: input.userId, scope: input.scope, ...dropped }
  for (const listener of [...dropListeners]) {
    listener(event)
  }
  return dropped
}

/**
 * Drops every unsent write on the device — sign-out's job, alongside the
 * highlights cache. Every user's entries, not just the current one's: only a
 * departure can leave an entry under somebody else's id.
 *
 * Never throws: sign-out purges before it clears the tokens, so an unreadable
 * store costs a surviving entry, not a user who is still signed in.
 */
export function clearHighlightQueue(): void {
  try {
    for (const key of mmkvStorage.getAllKeys()) {
      if (key.startsWith(MMKV_HIGHLIGHT_QUEUE_KEY_PREFIX)) {
        mmkvStorage.remove(key)
      }
    }
  } catch {
    // Purge failed; sign-out continues.
  }
}
