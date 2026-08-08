---
'@youversion/platform-react-native-expo-core': minor
---

Queued highlight writes now land on their own. A highlight parked while offline reaches the user's account as soon as service returns — no user action, nothing on screen changing at the moment it does — where previously it waited for the next successful write to the same verse.

**`expo-network` is a new required peer dependency of core.** It is autolinked, so upgrading into this version means installing it _and_ rebuilding the dev client; a JS-only reload leaves a `Cannot find native module 'ExpoNetwork'` redbox.

```bash
npx expo install expo-network
```

The drain is owned by core's `YouVersionProvider` and is inert with no auth configured, no signed-in user, or no access token. A write made in John 3 lands while the reader is in Romans 8, and lands even if the user never returns to John 3. It wakes on provider mount, on a token change, on the app returning to the foreground, on the rising edge of connectivity, and on a successful highlights fetch; otherwise each parked verse retries on its own widening, capped backoff that resets when it lands. Any of those wake-ups retires the pending wait, so a write deep into its backoff goes out the moment service returns rather than sitting out the rest of it. Connectivity is a trigger, never a gate — a wrong or missing connectivity answer costs a delayed attempt, never a skipped one.

No public API changes: no new exports, and no existing type or outcome changes meaning. A write that reports `{ status: 'queued' }` simply stops being permanent.

Not yet included: a definitive 401/403 is retried rather than dropped, and the queue is not purged on sign-out.
