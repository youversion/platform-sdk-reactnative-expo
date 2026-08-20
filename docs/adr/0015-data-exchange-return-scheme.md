# 15. Data exchange returns to the app's `redirectUri`

Date: 2026-07-29
Revised: 2026-08-04 — the original SDK-owned scheme was wrong on device.

## Status

Accepted — supersedes the original SDK-owned return scheme of the same number

An app key has exactly one callback URL. Sign-in already owns it. Data exchange must use that same `redirectUri`.

The first version of this ADR set a hardcoded `youversionauth://callback` and told Android apps to add a second scheme. That was wrong. The hosted page returns to the URL registered for the app key, not to a fixed scheme. When the SDK watched a different URL, `openAuthSessionAsync` reported `dismiss` and a real grant was discarded as `cancel`.

Measured on a Pixel 6 Pro API 34 with a real app key (2026-08-04):

| Registered callback    | Return reached the SDK                                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| App `redirectUri` only | Yes, when the SDK watched that same URI                                                                                |
| SDK-owned scheme only  | Yes for data exchange. Sign-in then failed with `invalid_request: redirect_uri does not match registered callback URL` |
| Both registered        | The page still returned to the app key URL. A watcher on the other scheme saw `cancel`                                 |

Swift and Kotlin already use one URL for both flows (`youversionauth://callback`). The example app matches that. Consumers can pass their own `redirectUri`. The SDK does not care which string it is. It must match the registered callback.

If the two disagree, the consent page opens, the user consents, and the outcome is `cancel`. Docs name that as the first check when grants do not stick.
