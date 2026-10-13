# YPE-6043 — Audio playback package

Research for [YPE-6043](https://lifechurch.atlassian.net/browse/YPE-6043). This is a package recommendation, not an architecture decision. The web spike is [YPE-6042](https://lifechurch.atlassian.net/browse/YPE-6042).

## Recommendation

Use [`expo-audio`](https://docs.expo.dev/versions/v57.0.0/sdk/audio) `57.0.5` as a peer of `@youversion/platform-react-native-expo-ui`.

Host apps install it the same way they install `expo-font` and `expo-clipboard`. The SDK owns one player and the verse clock. App developers call our reader, not `expo-audio`.

`57.0.5` is the `sdk-57` release on npm (published 2026-09-11). The example app should pin that exact version. The published peer range should stay `>=57.0.0 <58.0.0`, matching the other Expo modules in this repo.

## What the player has to do

The audio API gives us an MP3 URL and a list of verses: a USFM reference plus the start and end time inside that file. Whichever reader layout ships first, playback is the same job:

- Load an MP3 from a URL.
- Start at a verse time, and sometimes stop at another verse time.
- Move the on-screen verse as playback moves, without redrawing the whole reader on every tick.

## Why expo-audio

This repo is Expo SDK 57 (`expo` `57.0.23`, React Native `0.86.3` in `apps/example`). `expo-audio` is the audio library in that SDK. It plays on Android, iOS, and web.

The pieces we need are already on `AudioPlayer`:

- A remote URL, including request headers if a file is not public. ([`AudioSource`](https://docs.expo.dev/versions/v57.0.0/sdk/audio/#audiosource))
- `seekTo(seconds)` so we can start at a verse. Times are in seconds, same as a typical timing file.
- `play`, `pause`, `replace` for the next chapter, and `playbackRate` if a speed control shows up later.
- `preload` so the next chapter can be ready before the current one ends.
- Status events with `currentTime`, `duration`, `isLoaded`, `isBuffering`, and `didJustFinish`. The default tick is 500ms. `updateInterval: 200` is enough for verse changes. Verses last seconds, so we do not need a word-level clock. ([`AudioPlayerOptions`](https://docs.expo.dev/versions/v57.0.0/sdk/audio/#audioplayeroptions))
- `useAudioPlaylist` if we later queue chapters with gapless transitions. A single chapter player is enough for the first slice.
- Lock screen metadata and background playback, behind a config plugin and `setAudioModeAsync({ shouldPlayInBackground: true, interruptionMode: 'doNotMix' })`. On Android, sustained background playback also needs `setActiveForLockScreen`. Without that, Android stops the audio after about 3 minutes. ([Background playback](https://docs.expo.dev/versions/v57.0.0/sdk/audio/#playing-audio-in-the-background))

`playsInSilentMode` defaults to `true`, so Bible audio still plays when the ringer is off.

Support is the main reason to pick it. It ships on Expo's release train, uses the New Architecture, and follows the peer pattern this SDK already documents in the root `README.md`. A host that is already on Expo 57 runs `npx expo install expo-audio` and rebuilds the dev client when native config changes.

## Where it should live

Put the peer on the UI package. Core stays responsible for fetching the URL and the timing list, once that API exists. Core should not import a player.

Own the player above the reader screen. `useAudioPlayer` releases the player when its component unmounts. A mini player that survives navigation needs `createAudioPlayer`, and an explicit `release()` when the provider goes away. Expo documents that split: the hook for a screen, `createAudioPlayer` when the player outlives the screen.

Verse sync stays in our code:

1. On each status tick, find the verse whose start/end contains `currentTime`.
2. Publish a new USFM reference only when it changes.
3. Scripture still renders in the Expo DOM webview. Send the active reference across that bridge when it changes. Do not send every tick.

There is no "play from this time until that time" method. We seek to the start, then pause when `currentTime` passes the end. That is reliable while the app is open. A 200ms tick can run a fraction of a second past the verse end. In the background, JavaScript can wake late, so a "stop at this verse" can run long. Playing until the file ends does not have that problem: the player reports `didJustFinish` itself.

`downloadFirst` saves the whole file to a temp directory before play. The OS may delete it. Use normal streaming for chapter audio. Raise `preferredForwardBufferDuration` only if seeks stall. That option maps to `AVPlayerItem` on iOS and ExoPlayer's load control on Android.

## Host app setup

Foreground playback needs the package installed. It does not need the config plugin.

Background playback and the lock screen need a new native build. The plugin's `recordAudioAndroid` defaults to `true`, and the iOS microphone string is on unless we turn it off. A Bible player should not ask for the microphone.

```json
[
  "expo-audio",
  {
    "microphonePermission": false,
    "recordAudioAndroid": false,
    "enableBackgroundRecording": false,
    "enableBackgroundPlayback": true
  }
]
```

Set `enableBackgroundPlayback` to `false` if the first release stays in the foreground. Turning it on later is another dev-client rebuild for every host app, so that choice belongs in the first integration, not a follow-up.

Headphones unplugged stops playback. That is the OS behavior `expo-audio` documents, and we should leave it.

## Other packages

### expo-av

`expo-av` was deprecated in SDK 53 and removed in SDK 55. This repo is on SDK 57. New audio work goes to `expo-audio`. [SDK 54 changelog](https://expo.dev/changelog/sdk-54), [SDK 55 upgrade notes](https://expo.dev/blog/upgrading-to-sdk-55).

### react-native-track-player

Version 5 is the New Architecture player (background audio, Android Auto, caching). Commercial use needs a paid license, including use inside a company. The license also forbids redistributing it or building a competing product with it. That is a poor fit for an Apache-2.0 SDK that other apps install. [Project README](https://github.com/doublesymmetry/react-native-track-player), [license.txt](https://github.com/doublesymmetry/react-native-track-player/blob/main/license.txt).

Version 4 stays Apache-2.0. Its maintainers do not use Expo, and SDK 53 already needed patches to compile. This repo is on SDK 57 and React Native 0.86. We would be carrying those patches. [Expo guide](https://doublesymmetry.github.io/react-native-track-player/docs/next/guides/with-expo), [SDK 53 issue](https://github.com/doublesymmetry/react-native-track-player/issues/2472).

Come back to this only if a later phase needs CarPlay, Android Auto, or a real offline cache. `expo-audio` does not offer those.

### react-native-audio-api

This is a Web Audio graph for generating and processing sound (Software Mansion, MIT). Their roadmap still lists a simple play/buffer API and lock-screen controls as future work. Chapter MP3s plus a verse timing list do not need an audio graph. [README](https://github.com/software-mansion/react-native-audio-api).

### Audio inside the scripture webview

The reader paints scripture through Expo DOM. The player should stay native. WebView audio is a weak background player, and it goes away when that webview goes away. The native reader chrome, and any lyrics view we build in React Native, can share one native clock.

## Still open

These do not change the package. They change how much of it we turn on, and what we publish.

- Which of the three Figma layouts ships first. The player is the same for all three. [Design](https://www.figma.com/design/temXvWs3FR8DZdM8C17ajf/YVP---Reader-SDK-Design-v2?node-id=3640-1906&m=dev).
- Whether "play this verse" must stop on time while the app is backgrounded.
- Whether lock screen and background audio are in the first release. That decides the config plugin before the first consumer rebuild.
- Whether MP3 URLs are already signed, or whether we must send headers.
- Whether offline audio is in scope. That is a cache, not a player.
- How much of the reader becomes public. Keep the player private at first. A later public surface can be small: play, pause, and "seek to this USFM reference."
