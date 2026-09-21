import { useYVAuth } from '@youversion/platform-react-native-expo-core'
import type { ReactNode } from 'react'
import { Trans } from 'react-i18next'
import { Button, Text } from '../components/ui'
import { ThemeContext, useTheme, useTokens } from '../hooks'
import { useSdkTranslation } from '../i18n/use-sdk-translation'
import { sansFace } from '../theme/fonts'
import { BibleAppLogo } from './bible-app-logo'
import { useSignOutGuard } from './use-sign-out-guard'

export type YouVersionAuthButtonProps = {
  /** Forces the light or dark token scheme. Defaults to light. */
  background?: 'light' | 'dark'
  mode?: 'auto' | 'signIn' | 'signOut'
  /** Override the button label. When omitted the SDK uses localized default strings. */
  text?: string
}

type AuthButtonI18nKey = 'signInWithYouVersion' | 'signOutOfYouVersion'

type AuthButtonLabelProps = {
  i18nKey: AuthButtonI18nKey
  text?: string
}

function AuthButtonLabel({ i18nKey, text }: AuthButtonLabelProps): ReactNode {
  const { i18n } = useSdkTranslation()
  const tokens = useTokens()

  if (text) {
    return text
  }

  return (
    <Trans
      i18n={i18n}
      i18nKey={i18nKey}
      components={{
        bold: (
          <Text
            style={{
              ...tokens.typography.sm,
              ...sansFace(tokens.fontFamily.sans, 700),
            }}
          />
        ),
      }}
    />
  )
}

type AuthButtonSurfaceProps = {
  i18nKey: AuthButtonI18nKey
  text?: string
  onPress: () => void
}

function AuthButtonSurface({ i18nKey, text, onPress }: AuthButtonSurfaceProps): ReactNode {
  const tokens = useTokens()
  const theme = useTheme()
  const outlineWidth = { light: 1, dark: 2 }[theme]

  return (
    <Button
      // Pin fill and outline. Button default primary is red in dark and hides the logo.
      style={{
        backgroundColor: tokens.background,
        borderColor: tokens.border,
        borderWidth: outlineWidth,
        minHeight: 36,
        height: 'auto',
      }}
      onPress={onPress}
    >
      <BibleAppLogo />
      <Button.Text numberOfLines={2} style={{ color: tokens.foreground }}>
        <AuthButtonLabel i18nKey={i18nKey} text={text} />
      </Button.Text>
    </Button>
  )
}

export function YouVersionAuthButton({
  background = 'light',
  mode = 'auto',
  text,
}: YouVersionAuthButtonProps): ReactNode {
  const auth = useYVAuth()
  const { isAuthenticated, signIn } = auth
  const guardedSignOut = useSignOutGuard(auth)

  const isSignOut = mode === 'signOut' || (mode === 'auto' && isAuthenticated)
  const i18nKey = isSignOut ? 'signOutOfYouVersion' : 'signInWithYouVersion'

  const authFunction = async () => {
    try {
      if (isSignOut) {
        await guardedSignOut?.()
      } else {
        await signIn()
      }
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <ThemeContext.Provider value={background}>
      <AuthButtonSurface
        i18nKey={i18nKey}
        text={text}
        onPress={() => {
          void authFunction()
        }}
      />
    </ThemeContext.Provider>
  )
}
