# Get started with hinqa on the Expo SDK

This note is for Dustin. It is the first step for using hinqa against this React Native Expo SDK, aimed at comparing Bible text formatting later.

A spike on 2026-10-30 could not install hinqa or capture a screenshot. The commands and the stop point are below. Do not add a second test corpus to this repository.

## What hinqa is

Hinqa is YouVersion's internal QA tool. Joel Bell owns it. The engine is Python 3.12 or newer. Chat tools go through an MCP server named `hinqa-mcp`. Web runs use Playwright. iOS and Android runs use Appium.

Hinqa keeps the engine in [youversion/hinqa](https://github.com/youversion/hinqa). Each product keeps its own tests in a separate automation repository. Those tests are data files, not scripts. A flow is one journey. A test case is one claim along that journey. PageStore (`pages.yaml`) is the only list of locators the runner is allowed to use.

The platform overview is the Notion page [Hinqa, AI-Powered QE Platform](https://app.notion.com/p/35ff1f2d1b92815a8ebfe492c37a9583), last edited 2026-10-13.

## Where the Expo tests already live

This SDK already has an automation repository, `youversion/platform-sdk-reactnative-expo_automation`. [YPE-3643](https://lifechurch.atlassian.net/browse/YPE-3643) records the bootstrap. The corpus that grew out of that work is in [platform-sdk-reactnative-expo_automation pull request 1](https://github.com/youversion/platform-sdk-reactnative-expo_automation/pull/1).

This SDK repository does not store flows. It only asks that automation repository to build or run.

- `.github/workflows/browserstack-pr-build.yml` dispatches `build-rn-app.yml` with `target: app-live`. An approved collaborator comments `/app-live`, `/app-live-ios`, or `/app-live-android` on a pull request.
- Open pull request [platform-sdk-reactnative-expo#253](https://github.com/youversion/platform-sdk-reactnative-expo/pull/253) would dispatch `browserstack-manual.yml` with `target: app-automate` for iOS, then Android, on the Version Packages pull request. That check is not on `main` yet.

A new `hinqa onboard --platform web` inside this SDK would create a second corpus. Leave that for a later decision. The first useful action is to open the automation repository and run one flow that is already there.

## What this spike verified

Ran on this cloud machine on 2026-10-30.

| Check | Result |
| --- | --- |
| `python3 --version` | `Python 3.12.3` |
| `node -v` | `v22.23.4` |
| `pnpm -v` | `11.11.0` |
| `gh repo view youversion/hinqa` | `Could not resolve to a Repository with the name 'youversion/hinqa'` |
| GitHub API `GET /repos/youversion/hinqa` with this workspace token | HTTP 404, body `Not Found` |
| Same check for `platform-sdk-reactnative-expo_automation` and `Automation_YV_Platform_Web` | Same not-found result |
| `python3 -m pip install --dry-run 'hinqa[browser]'` | `No matching distribution found for hinqa[browser]` |
| `https://pypi.org/pypi/hinqa/json` | HTTP 404 |
| `OP_SERVICE_ACCOUNT_TOKEN` | unset |
| `OPENROUTER_API_KEY` | unset |
| `apps/example/.env` | missing. Only `.env.example` is present. |
| Expo web, then a hinqa flow | not started. Install never got past the 404. |

The named hinqa docs were not readable from here. That includes `README.md`, `docs/getting-started/package-lifecycle.md`, `docs/getting-started/setup-and-troubleshooting.md`, `hinqa/mcp/README.md`, `hinqa/agents/browser/README.md`, `hinqa/agents/mobile/README.md`, and `docs/reference/standards/06-Locators-Mobile.md`. `scripts/fetch_hinqa_release.py` is inside that same private repo, so the wheel fetch could not be run either.

No screenshot was saved. There is nothing to attach.

## Local setup

You need a GitHub account that can read `youversion/hinqa` and `youversion/platform-sdk-reactnative-expo_automation`. This cloud agent's token cannot.

1. Clone `https://github.com/youversion/hinqa`.
2. Read these files in the clone, in this order. `README.md`, `docs/getting-started/package-lifecycle.md`, `docs/getting-started/setup-and-troubleshooting.md`, `hinqa/mcp/README.md`, `hinqa/agents/browser/README.md`. For a device run, also read `hinqa/agents/mobile/README.md` and `docs/reference/standards/06-Locators-Mobile.md`.
3. Install hinqa the way those docs say. Public PyPI has no `hinqa` package. The wheel script to look for is `scripts/fetch_hinqa_release.py`. Platform Web's older workflows installed `hinqa[browser]` from a git URL. [YPE-5987](https://lifechurch.atlassian.net/browse/YPE-5987) says those workflows should point at `youversion/hinqa`, not a personal fork.
4. Install the Playwright browser only if the setup doc says the `browser` extra does not do it for you.
5. Clone `https://github.com/youversion/platform-sdk-reactnative-expo_automation` next to this SDK. Run the first flow from that repo. Its README should name the runner command. This spike could not open that README.

`OP_SERVICE_ACCOUNT_TOKEN` is the 1Password service account hinqa uses to type test-account passwords. A logged-out reader screenshot does not need it. `OPENROUTER_API_KEY` is not required for an ordinary run. A visual check can still call a vision model. [YPE-6020](https://lifechurch.atlassian.net/browse/YPE-6020) records one local run that called OpenRouter and got HTTP 402 because that account had no credit.

The example app in this repo starts with `pnpm web` inside `apps/example`. That script runs `expo start --web`. Copy `apps/example/.env.example` to `apps/example/.env` and set `EXPO_PUBLIC_YOUVERSION_APP_KEY`. Without that key the app shows "Missing app key" and does not mount the reader. This repository's `package.json` asks for Node 24 or newer. The cloud machine had Node 22.23.4, so do not treat this VM as a place to start the example until Node is upgraded.

The example reader is `BibleReader` with `defaultVersionId={3034}` in `apps/example/app/(tabs)/index.tsx`.

## Cloud agent setup

A cloud agent on this repository can edit this SDK. It cannot see hinqa today.

The GitHub credential is the Cursor GitHub App for `youversion/platform-sdk-reactnative-expo` only. Calls to the hinqa repo and the automation repo return not found. There is no iOS simulator, no Android emulator, and no device. `OP_SERVICE_ACCOUNT_TOKEN` and `OPENROUTER_API_KEY` are unset, and neither one is the thing blocking the first screenshot. The block is repository access.

To let a later cloud agent finish the proof, install that GitHub App on `youversion/hinqa` and `youversion/platform-sdk-reactnative-expo_automation` with read access. Then give the agent Node 24 or newer and an `EXPO_PUBLIC_YOUVERSION_APP_KEY` if the proof is Expo web.

## Run the first flow

Do this in the automation repository after you can clone it.

1. Find a flow whose journey opens the Bible reader. Prefer one that already passes in that repo's nightly, if the README names one.
2. If that flow is a web flow, start this example with `pnpm web` and point the flow at that URL. Confirm the environment name in the automation repo's `environments.yaml` before you invent a new one.
3. If that flow is an iOS or Android flow, run it the way the automation README says. The release check in pull request 253 uses BrowserStack App Automate, one platform at a time, eight workers. A laptop with no simulator should use that path, or App Live from a `/app-live` comment, not a local emulator.
4. Keep the screenshot the run writes. That file is the evidence. Do not commit a new corpus into this SDK as part of the same change.

`getting-started` inside hinqa was wrong once. [YPE-3369](https://lifechurch.atlassian.net/browse/YPE-3369) says `docs/getting-started/README.md` still taught a retired grouping model and said auth was unimplemented. If the clone's getting-started page disagrees with `flows.yaml` and the runner, trust the runner.

## Bible text visual comparison

The visual checks in the tickets below judge a screenshot with a vision model. This spike did not find a stored pixel-baseline diff in those tickets. The hinqa repo itself was not readable, so a baseline tool could still exist there.

[YPE-4066](https://lifechurch.atlassian.net/browse/YPE-4066) is done. It added one step, `assert_visual`, for web and mobile. The flow names an element and an English expected sentence. The runner takes a screenshot, crops to that element when it has bounds, and asks a vision model for `true`, `false`, or `uncertain`. `uncertain`, a missing image, or a model error must not pass. The result is supposed to keep the full screenshot, the crop, the expected sentence, the model name, and the verdict. Use this when the claim is something a DOM or accessibility read can fake, such as "the verse text is white." Do not use `assert_visible` for color.

[YPE-6359](https://lifechurch.atlassian.net/browse/YPE-6359) is still in Discovery as of 2026-10-30. It asks for a same-run before and after image, with digests, for font size and line spacing on the same passage. That is the closer match for comparing formatting. It is not a shipped step yet. Product images stay in the product repo, which for us is the automation repository.

[YPE-5977](https://lifechurch.atlassian.net/browse/YPE-5977) is the shared proof contract those tickets sit under. Read it before writing a formatting claim. A vision model can say the type looks larger. It cannot, by itself, prove a pixel match between the DOM reader and a future native text view.

Practical order for the formatting work:

1. Capture one screenshot of the current DOM reader on a fixed passage, version, theme, and viewport. That is the reference, even before any assert step exists.
2. When native `BibleTextView` exists, capture the same passage with the same settings.
3. Compare those two images with `assert_visual` only for a claim you can say in a sentence, such as "the verse text is black on white." For size and spacing, wait for the YPE-6359 before/after path, or compare the two files by eye and keep both images with the result.

## Hybrid WebView on device

The real reader target is a native app. Scripture today is an Expo DOM component inside a WebView. The phone side of hinqa is Appium, not Playwright.

What the RN adopt actually used, from YPE-3643:

- Locators that resolved were XPath, written `xpath_global::` with two colons. One colon makes hinqa treat the rest as a literal XPath and return no match.
- `resource_id::` misses bare React testIDs. Those IDs do not have the Android `package:id/` prefix. The XPath that worked looks like `//*[@resource-id='native-sheet-content']`.
- `accessibility id::` reads Android `content-desc` only. Many labels are on the `text` attribute. The XPath that worked looks like `//*[@text='Change Bible version']`.
- Dump the screen only after the DOM component has hydrated. An early `page_source` on this app produced a false theory that accessibility labels were missing.
- Sheets in this SDK do not all have Cancel. The fallback in that ticket is swipe down, then a tap on the backdrop (`content-desc="Bottom sheet backdrop"`).

Appium can see extra contexts. [YPE-3502](https://lifechurch.atlassian.net/browse/YPE-3502) added a check of `d.contexts` for `WEBVIEW_*` and `SafariViewController`. Switching into that web context was the wrong fix for the iOS sign-in sheet. [YPE-3838](https://lifechurch.atlassian.net/browse/YPE-3838) and [YPE-3840](https://lifechurch.atlassian.net/browse/YPE-3840) say that sheet is in the native tree. This spike did not find a ticket that says the Bible reader DOM is driven by switching into the WebView context. The RN corpus was built against the native tree. Whether verse text is in that tree, or only inside the WebView, is still an open live question. Answer it with one probe on a running build. Do not guess from source.

## Open questions

- The hinqa getting-started docs and `scripts/fetch_hinqa_release.py` were not read. The install commands above stop at "follow the clone."
- Nobody on this machine confirmed that the automation repo has a web environment for Expo web. The release path we can see is iOS and Android on BrowserStack.
- Verse text inside the DOM WebView may be invisible to Appium's native tree. That decides whether a formatting check is an XPath assert, a WebView-context assert, or a screenshot assert.
- `assert_visual` needs a vision provider. A cloud agent with no key will get a non-pass, which is correct, and will not produce a formatting diff.
- YPE-6359 is not done. Do not write the font and line-spacing comparison as if that step exists.
- Pull request 253 is open. Merging it is a release-check decision, separate from this spike.

## Recommended next step

Grant read access to `youversion/hinqa` and `youversion/platform-sdk-reactnative-expo_automation`. In the automation repo, run one existing reader flow and save one screenshot of the verse text. Do not generate a corpus in this SDK until that screenshot exists and you still need a flow the automation repo does not have.
