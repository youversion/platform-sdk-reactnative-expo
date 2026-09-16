import { useYVAuth } from '@youversion/platform-react-native-expo-core'
import type { ReactNode } from 'react'
import { Text as RNText } from 'react-native'
import { Trans } from 'react-i18next'
import { Button } from '../components/ui'
import { ThemeContext } from '../hooks'
import { useSdkTranslation } from '../i18n/use-sdk-translation'
import { getTokens } from '../theme'
import { sansFace } from '../theme/fonts'
import { BibleAppLogo } from './bible-app-logo'
import { useSignOutGuard } from './use-sign-out-guard'

export type YouVersionAuthButtonProps = {
  /** Forces the Button token scheme. Defaults to light. */
  background?: 'light' | 'dark'
  mode?: 'auto' | 'signIn' | 'signOut'
  /** Override the button label. When omitted the SDK uses localized default strings. */
  text?: string
}

export function YouVersionAuthButton({
  background = 'light',
  mode = 'auto',
  text,
}: YouVersionAuthButtonProps): ReactNode {
  const auth = useYVAuth()
  const { isAuthenticated, signIn } = auth
  const guardedSignOut = useSignOutGuard(auth)
  const { i18n } = useSdkTranslation()
  const tokens = getTokens(background)
  const boldComponent = <RNText style={sansFace(tokens.fontFamily.sans, 700)} />

  const authFunction = async () => {
    try {
      if (mode === 'auto') {
        if (isAuthenticated) {
          await guardedSignOut?.()
        } else {
          await signIn()
        }
      } else if (mode === 'signIn') {
        await signIn()
      } else {
        await guardedSignOut?.()
      }
    } catch (error) {
      console.error(error)
    }
  }

  const isSignOut = mode === 'signOut' || (mode === 'auto' && isAuthenticated)
  const i18nKey = isSignOut ? 'signOutOfYouVersion' : 'signInWithYouVersion'

  return (
    <ThemeContext.Provider value={background}>
      <Button
        onPress={() => {
          void authFunction()
        }}
      >
        <BibleAppLogo />
        {text ? (
          <Button.Text>{text}</Button.Text>
        ) : (
          <Trans
            i18n={i18n}
            i18nKey={i18nKey}
            parent={Button.Text}
            components={{ bold: boldComponent }}
          />
        )}
      </Button>
    </ThemeContext.Provider>
  )
}
