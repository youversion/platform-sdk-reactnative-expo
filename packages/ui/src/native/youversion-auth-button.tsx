import { useYVAuth } from '@youversion/platform-react-native-expo-core'
import { Pressable, StyleSheet, Text } from 'react-native'
import { BibleAppLogo } from './bible-app-logo'

type YouVersionAuthButtonProps = {
  background?: 'light' | 'dark'
  radius?: 'rounded' | 'rectangular'
  outline?: boolean
  mode?: 'auto' | 'signIn' | 'signOut'
  size?: 'default' | 'short' | 'icon'
  text?: string
}

export function YouVersionAuthButton({
  background = 'light',
  radius = 'rounded',
  outline = false,
  mode = 'auto',
  size = 'default',
  text,
}: YouVersionAuthButtonProps) {
  const { isAuthenticated, signOut, signIn } = useYVAuth()

  const authFunction = async () => {
    try {
      if (mode === 'auto') {
        await (isAuthenticated ? signOut() : signIn())
      } else {
        await (mode === 'signIn' ? signIn() : signOut())
      }
    } catch (error) {
      console.error(error)
    }
  }

  const unauthedButtonText = text ? (
    <Text style={background === 'dark' ? styles.buttonTextDark : styles.buttonTextLight}>
      {text}
    </Text>
  ) : size === 'short' ? (
    <Text style={background === 'dark' ? styles.buttonTextDark : styles.buttonTextLight}>
      Sign in
    </Text>
  ) : (
    <Text style={background === 'dark' ? styles.buttonTextDark : styles.buttonTextLight}>
      Sign in with <Text style={{ fontWeight: 'bold' }}>YouVersion</Text>
    </Text>
  )

  const authedButtonText = text ? (
    <Text style={background === 'dark' ? styles.buttonTextDark : styles.buttonTextLight}>
      {text}
    </Text>
  ) : size === 'short' ? (
    <Text style={background === 'dark' ? styles.buttonTextDark : styles.buttonTextLight}>
      Sign Out
    </Text>
  ) : (
    <Text style={background === 'dark' ? styles.buttonTextDark : styles.buttonTextLight}>
      Sign out of <Text style={{ fontWeight: 'bold' }}>YouVersion</Text>
    </Text>
  )

  return (
    <Pressable
      style={[
        styles.buttonContainer,
        background === 'dark' ? styles.buttonDark : styles.buttonLight,
        radius === 'rounded' ? styles.buttonRound : styles.buttonRectangle,
        outline
          ? background === 'light'
            ? styles.buttonOutlineLight
            : styles.buttonOutlineDark
          : null,
        size === 'icon' && styles.iconButton,
      ]}
      onPress={authFunction}
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
  buttonOutlineLight: {
    borderColor: '#dddbdb',
    borderWidth: 1,
  },
  buttonOutlineDark: {
    borderColor: '#474545',
    borderWidth: 2,
  },
  buttonLight: {
    backgroundColor: '#fff',
  },
  buttonDark: {
    backgroundColor: '#000',
  },
  buttonRound: {
    borderRadius: 40,
  },
  buttonRectangle: {
    borderRadius: 8,
  },
  buttonTextDark: {
    color: '#fff',
  },
  buttonTextLight: {
    color: '#000',
  },
})
