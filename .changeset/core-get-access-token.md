---
'@youversion/platform-react-native-expo-core': patch
---

Fix a token endpoint outage presenting to the user as a revoked permission. When the access token was expired and the refresh failed for a reason that was not a revocation — a 5xx, a timeout, a captive portal — the highlight write went out with the expired token anyway. It came back 401, the 401 classified as `auth`, and `useHighlightPermissionFlow` reads `auth` as a stale grant, so a valid `highlights` grant was invalidated and the user was asked to consent again. The re-consent then minted with the same expired token, 401'd in turn, and dead-ended as `not-permitted` — which the docs describe as an app-key setting, not anything the user can act on.

The cause is that `refreshToken` swallows failure by design, to keep the retention policy: a transient failure must not sign anyone out. It returns nothing, so a caller reading the token afterwards could not tell a refresh that worked from one that did not.

Add `getAccessToken()` to the auth context, exported through `useYVAuth()` and typed as `AccessTokenResult`. It runs the same leeway-gated, single-flight refresh as `ensureFreshToken()`, then reports the outcome: `{ status: 'ok', token }`, or `{ status: 'unavailable', reason: 'signed-out' | 'refresh-failed' }`. It never rejects, it makes no network call when there is no refresh token to spend, and concurrent callers join one refresh and all receive the new token. `refresh-failed` leaves the tokens in storage — the session is intact and the user stays signed in, which is the existing policy and not something to change.

`useHighlights` sources its write token from it. A `refresh-failed` now settles as a `transient` outcome **without issuing the request**, so the false `auth` can no longer be manufactured; `signed-out` maps to `not-signed-in` as before. Nothing else moves: `isAuthenticated` still means "has a session", so an offline user with a retained session still renders as signed in, and `ensureFreshToken()` stays for callers that only want the refresh side effect.
