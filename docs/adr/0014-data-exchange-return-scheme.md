# 14. The data-exchange return scheme is registered by the consuming app, not a config plugin

Date: 2026-07-29

## Status

Accepted

## Context

Data exchange (YPE-3709 subtask 2) is YouVersion's just-in-time permission grant: a signed-in user who has not granted a permission is sent to a hosted consent page and returns with the grant, without signing out. On native the flow is `WebBrowser.openAuthSessionAsync(consentUrl, returnUrl)`.

The return URL is **`youversionauth://callback`** — hardcoded and SDK-owned. It matches the Swift SDK's `callbackURLScheme`, and it is why `buildDataExchangeUrl(token, appKey, apiHost)` takes no redirect parameter: the hosted page always returns to that scheme. It is emphatically **not** the app's OAuth `redirectUri`, which is app-owned and app-specific; the two are unrelated and neither can substitute for the other.

The platforms do not treat the scheme the same way:

- **iOS** needs nothing. `ASWebAuthenticationSession` is handed the callback scheme at call time and intercepts the redirect itself, without a manifest entry.
- **Android** needs the scheme registered. `expo-web-browser` resolves an auth session through a real deep link the app must be able to receive. With no `youversionauth` intent filter, the consent page's redirect goes nowhere: the browser sits there until the user dismisses it, and the session reports `{ type: 'dismiss' }` — which the SDK, correctly and indistinguishably, treats as a cancel.

So on Android the grant is unreachable — silently, and looking exactly like a user declining — unless something adds the intent filter. Two ways to do that:

1. **Document it.** Expo CNG already turns `app.json`'s `scheme` (a string **or an array**) into Android intent filters and iOS URL types. The consuming app adds one array entry.
2. **Ship an Expo config plugin** from `packages/core` that injects the intent filter during prebuild.

## Decision

Document it (option 1). The consuming app adds `youversionauth` to its `app.json` `scheme` array:

```json
{ "expo": { "scheme": ["your-app-scheme", "youversionauth"] } }
```

`apps/example/app.json` does exactly this, and the instruction is in the README's sign-in section and AGENTS.md.

The flow stays correct without it — the SDK never assumes the scheme is registered, and an unregistered Android build reports `cancel` rather than hanging forever or throwing.

Revisit the plugin if partner friction shows up. It is a strictly additive change: a plugin can be shipped later and the manual entry becomes redundant rather than wrong.

## Consequences

- **A one-line manifest change is traded against owning a build-time surface.** A config plugin runs inside every consumer's prebuild, has to be kept working across Expo SDK majors, and is invisible when it misbehaves. One array entry in `app.json` is a diff the partner can read, and it sits next to the `scheme` they already had to set for OAuth.
- **The Android failure mode is a silent `cancel`, which is the strongest argument for a plugin.** A partner who skips the instruction sees the consent sheet open and close, indistinguishable from the user declining, with nothing in the logs. This is a known and accepted cost — mitigated by documentation now, and by the plugin if it bites.
- **The scheme is shared across every app that integrates the SDK.** Unlike an app's OAuth scheme (where the README warns to pick something unique), `youversionauth` is deliberately common: two SDK-integrating apps on one device both register it and Android will show the app chooser. That is inherent to a server-known return scheme and is the same trade-off the Swift SDK makes.
- **Adding the scheme is a native change**, so consumers must rebuild the dev client (`npx expo prebuild --clean` + a native build) — a JS reload will not pick it up.
- **Turning `scheme` into an array changes what `Linking.createURL` returns**, which is a second-order cost of documenting rather than plugging. `resolveScheme` destructures `manifestSchemes` and uses the **first** entry, warning about the rest (`expo-linking/src/Schemes.ts`), so a partner who puts `youversionauth` first silently repoints their OAuth `redirectUri` at the SDK's return URL and breaks sign-in — a failure with no connection to the change they just made. The docs therefore tell consumers to pass `{ scheme }` to `Linking.createURL` explicitly, which both pins the redirect URI and silences the multi-scheme warning; the example app does the same. A config plugin would not have avoided this, since the array is what CNG consumes either way.
