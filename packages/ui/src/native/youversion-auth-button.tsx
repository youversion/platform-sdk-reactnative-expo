import { useYVAuth } from '@youversion/platform-react-native-expo-core'
import { Pressable, Text } from 'react-native'

type YouVersionAuthButtonProps = {
  mode?: 'auto' | 'signIn' | 'signOut'
}

export function YouVersionAuthButton({ mode = 'auto' }: YouVersionAuthButtonProps) {
  const { isAuthenticated, signOut, signIn } = useYVAuth()

  const authFunction = () => {
    if (mode == 'auto') {
      return isAuthenticated ? signOut : signIn
    } else {
      return mode === 'signIn' ? signIn : signOut
    }
  }

  return (
    <Pressable onPress={authFunction}>
      {isAuthenticated || mode === 'signOut' ? <Text>Sign Out</Text> : <Text>Sign In</Text>}
    </Pressable>
  )
}
