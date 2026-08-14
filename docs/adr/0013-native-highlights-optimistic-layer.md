# 13. Native highlights own optimistic paint, and remove entries retire on a different color

Date: 2026-07-27

## Status

Accepted

Native is the only optimistic layer. The Web SDK reader is a controlled view. It paints what native passes. If native does not own mid-write paint, nothing does.

The paint math lives in `packages/core/src/highlights/optimistic.ts`. It is a port of the web highlights machine. One rule diverges.

Web never retires a remove overlay. That stops a stale GET from painting the color that was just deleted ("vapor"). The cost is unbounded: a new color from another device stays invisible until the user leaves the chapter.

We keep the vapor fix and drop most of that cost. If the server reports a *different* color, the remove entry retires. That color cannot be an echo of the deletion. It is newer data. The remaining failure needs the server two steps behind (green → yellow → remove, then a GET that still reports green).

`shouldRetire` is one named function for that reason. Revert to web behavior with `return false` in the remove branch. Tests pin both directions, because each side reads like a bug.

[ADR 0018](0018-highlight-write-queue.md) retired the in-memory ownership tokens. The guarantee remains: a settling write touches only entries that still ask for what it sent. The queue entry carries that desired state, so a value comparison replaces the token.
