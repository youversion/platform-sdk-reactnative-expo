# YouVersion SDK Demo

A demo app showcasing `@youversion/platform-react-native-expo-ui` components.

## Setup

```bash
cp .env.example .env
# Add your YouVersion App Key (EXPO_PUBLIC_YOUVERSION_APP_KEY) to .env
pnpm install

# Build the dev client (first run only — Expo Go is not supported)
pnpm build:ios       # or: pnpm build:android

# Subsequent runs
pnpm start
```

Get an App Key from the [YouVersion Platform Developer Console](https://platform.youversion.com).

For **Sign in with YouVersion**, also register `yvp-rn-example://callback` as a Callback URI in the console for your App Key.

## React SDK Components Used

- **Bible Reader** — Full interactive Bible reader with chapter/version navigation
- **Verse of the Day** — Daily verse card
- **Bible Card** — Embeddable Bible passage card
- **Sign in with YouVersion Button** — Authentication with YouVersion

## Troubleshooting

If the dev client won't build or start, or you see peer-dependency version warnings — usually after a fresh install or an Expo SDK bump — your packages are likely out of sync with the SDK. Realign them to the versions Expo expects, then rebuild:

```bash
pnpm fix:deps          # runs: expo install --fix
pnpm build:ios         # or: pnpm build:android
```

`expo install --fix` only realigns versions of packages already in `package.json`; it does not add missing peer dependencies. Run it any time you change the Expo SDK version.
