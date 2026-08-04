# 15. Data exchange returns to the app's `redirectUri`, because an app key has one callback URL

Date: 2026-07-29
Revised: 2026-08-04 — the original decision was disproven on device; see Context.

## Status

Accepted (supersedes the original "SDK-owned return scheme" decision of the same number)

## Context

Data exchange (YPE-3709 subtask 2) is YouVersion's just-in-time permission grant: a signed-in user who has not granted a permission is sent to a hosted consent page and returns with the grant, without signing out. On native the flow is `WebBrowser.openAuthSessionAsync(consentUrl, returnUrl)`.

This ADR originally set `returnUrl` to a hardcoded, SDK-owned `youversionauth://callback`, described as "emphatically **not** the app's OAuth `redirectUri`", and required Android consumers to add a second `scheme` entry to `app.json`. That was wrong, and the way it was wrong is worth recording.

**What was measured** (Android emulator, Pixel 6 Pro API 34, real app key, 2026-08-04):

| App key's registered callback URL | Consent page returned to                                                                | `requestPermissions` outcome |
| --------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------- |
| `yvp-rn-example://callback`       | `yvp-rn-example://callback?data_exchange_status=granted&granted_permissions=highlights` | `cancel`                     |
| both registered                   | `yvp-rn-example://callback?...`                                                         | `cancel`                     |
| `youversionauth://callback`       | `youversionauth://callback?...`                                                         | `granted`                    |

The hosted page returns to **whatever callback URL is registered for the app key**, not to a fixed scheme. With the SDK watching a different URL, the return never matched, `openAuthSessionAsync` reported `dismiss`, and a real approved grant was discarded as `cancel` — indistinguishable from the user declining.

**The constraint that settles it:** an app key has exactly one callback URL (confirmed with the API team). Sign-in already owns it. So a separate SDK-owned return URL cannot be registered alongside it, and registering one _instead_ breaks sign-in with `invalid_request: redirect_uri does not match registered callback URL` — also measured.

The original "matches the Swift SDK's `callbackURLScheme`" claim was uncited. Swift does use that string, but for **both** flows off one URL, which is the part that was missed:

```swift
// Users+SignIn.swift AND DataExchangeSession.swift
let redirectURL = URL(string: "youversionauth://callback")!
... callbackURLScheme: redirectURL.scheme!
```

Kotlin does the same (`DEFAULT_AUTH_CALLBACK = "youversionauth://callback"` in `YouVersionPlatformConfiguration`, used as `redirectUri` for sign-in, with `android:scheme="youversionauth"` in its sample app).

## Decision

`requestDataExchange` takes `redirectUri` and hands it to `openAuthSessionAsync`. The provider passes `config.redirectUri` — the same value sign-in uses. There is no SDK-owned return constant; `DATA_EXCHANGE_RETURN_URL` is deleted.

The example app and docs use `youversionauth://callback` as that single `redirectUri`, matching Swift and Kotlin, with `"scheme": "youversionauth"` in `app.json` so Android can route it.

`buildDataExchangeUrl(token, appKey, apiHost)` still takes no redirect parameter — the server reads the callback URL off the app key rather than off the request. That part of the original reasoning held.

## Consequences

- **Data exchange needs no consumer setup of its own.** Whatever sign-in already required is sufficient. The `app.json` `scheme` array, the "register `youversionauth` in addition to your own scheme" instruction, and the `Linking.createURL` ordering hazard all disappear with the second scheme.
- **`redirectUri` disagreeing with the registered callback URL fails silently**, and is now the single point where that can happen. The consent page opens, the user consents, and the outcome is `cancel` with the grant discarded. Consumers cannot distinguish it from a decline, so the docs name it as the first thing to check. This is the same silent-cancel cost the original ADR accepted, relocated to a place where sign-in fails loudly for the same misconfiguration — which makes it far easier to catch.
- **The scheme is shared across every app that integrates the SDK.** `youversionauth` is deliberately common, so two SDK-integrating apps on one Android device both register it and the OS shows an app chooser. Consumers who prefer their own scheme can use it for `redirectUri` instead — the SDK no longer cares which — at the cost of diverging from Swift and Kotlin.
- **Consumers who followed the previous instruction must remove the extra scheme entry** and rebuild. Leaving it registered is inert rather than harmful.
- **A config plugin is still unnecessary**, now for a stronger reason than before: there is no SDK-specific scheme to inject.
