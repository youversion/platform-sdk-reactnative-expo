import { useYVAuth } from '@youversion/platform-react-native-expo-core'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import { Trans } from 'react-i18next'
import { useSdkTranslation } from '../i18n/use-sdk-translation'
import type { Theme } from '../lib/resolve-theme'
import { getTokens } from '../theme'
import { BibleAppLogo } from './bible-app-logo'
import { useSignOutGuard } from './use-sign-out-guard'

export type YouVersionAuthButtonProps = {
  background?: 'light' | 'dark'
  radius?: 'rounded' | 'rectangular'
  outline?: boolean
  mode?: 'auto' | 'signIn' | 'signOut'
  size?: 'default' | 'short' | 'icon'
  /** Override the button label. When omitted the SDK uses localized default strings. */
  text?: string
}

const light = getTokens('light')
const dark = getTokens('dark')

type AuthButtonScheme = {
  readonly fill: { readonly backgroundColor: string }
  readonly label: { readonly color: string }
  readonly outline: { readonly borderColor: string; readonly borderWidth: number }
}

const SCHEME = {
  light: StyleSheet.create({
    fill: { backgroundColor: light.background },
    label: { color: light.foreground },
    outline: { borderColor: light.border, borderWidth: 1 },
  }),
  dark: StyleSheet.create({
    fill: { backgroundColor: dark.background },
    label: { color: dark.foreground },
    outline: { borderColor: dark.border, borderWidth: 2 },
  }),
} satisfies Record<Theme, AuthButtonScheme>

export function YouVersionAuthButton({
  background = 'light',
  radius = 'rounded',
  outline = false,
  mode = 'auto',
  size = 'default',
  text,
}: YouVersionAuthButtonProps): ReactNode {
  const auth = useYVAuth()
  const { isAuthenticated, signIn } = auth
  const guardedSignOut = useSignOutGuard(auth)
  const { t, i18n } = useSdkTranslation()

  const scheme = SCHEME[background]
  const textStyle = scheme.label
  const boldComponent = <Text style={{ fontWeight: 'bold' }} />

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

  const unauthedButtonText = text ? (
    <Text style={textStyle}>{text}</Text>
  ) : size === 'short' ? (
    <Text style={textStyle}>{t('signIn')}</Text>
  ) : (
    <Trans
      i18n={i18n}
      i18nKey="signInWithYouVersion"
      parent={Text}
      style={textStyle}
      components={{ bold: boldComponent }}
    />
  )

  const authedButtonText = text ? (
    <Text style={textStyle}>{text}</Text>
  ) : size === 'short' ? (
    <Text style={textStyle}>{t('signOut')}</Text>
  ) : (
    <Trans
      i18n={i18n}
      i18nKey="signOutOfYouVersion"
      parent={Text}
      style={textStyle}
      components={{ bold: boldComponent }}
    />
  )

  return (
    <Pressable
      style={[
        styles.buttonContainer,
        scheme.fill,
        radius === 'rounded' ? styles.buttonRound : styles.buttonRectangle,
        outline ? scheme.outline : null,
        size === 'icon' && styles.iconButton,
      ]}
      onPress={() => {
        void authFunction()
      }}
    >
      <BibleAppLogo style={size !== 'icon' && styles.bibleAppLogo} />
      {size !== 'icon'
        ? mode === 'signOut' || (mode === 'auto' && isAuthenticated)
          ? authedButtonText
          : unauthedButtonText
        : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingInline: 18,
    paddingBlock: 8,
  },
  iconButton: {
    paddingInline: 12,
    paddingBlock: 12,
  },
  bibleAppLogo: {
    marginEnd: 16,
  },
  buttonRound: {
    borderRadius: 40,
  },
  buttonRectangle: {
    borderRadius: 8,
  },
})
