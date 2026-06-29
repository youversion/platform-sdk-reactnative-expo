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
