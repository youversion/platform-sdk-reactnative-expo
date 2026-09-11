import { createContext, use, useMemo } from 'react'
import type { ReactNode } from 'react'
import { Image, StyleSheet, View } from 'react-native'
import type { ImageProps, ViewProps } from 'react-native'

import { useTokens } from '../../hooks'
import { sansFace } from '../../theme/fonts'
import { PersonIcon } from './person-icon'
import { Text } from './text'

/** Fits inside the 32px avatar with the 2px fallback border. */
const FALLBACK_PERSON_ICON_SIZE = 20

/** Web `size-8`. The signed-in toolbar button is 36 and centers this. */
const AVATAR_SIZE = 32

type AvatarContextValue = {
  readonly size: number
}

const AvatarContext = createContext<AvatarContextValue | null>(null)

function useAvatarContext(): AvatarContextValue {
  const context = use(AvatarContext)
  if (context === null) {
    throw new Error('Avatar.Image and Avatar.Fallback must be rendered inside <Avatar>')
  }
  return context
}

/** "Cam Anderson" → "CA", "Cher" → "C". Same rule as the web ProfileAvatar. */
function initialsFromName(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0)
  const first = words[0]
  if (first === undefined) {
    return ''
  }
  const last = words[words.length - 1]
  if (words.length === 1 || last === undefined) {
    return first.charAt(0).toUpperCase()
  }
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
}

export type AvatarProps = ViewProps

function AvatarRoot({ style, ...props }: AvatarProps): ReactNode {
  const tokens = useTokens()
  const context = useMemo(() => ({ size: AVATAR_SIZE }), [])

  return (
    <AvatarContext.Provider value={context}>
      <View
        {...props}
        style={[
          {
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            borderRadius: tokens.radius.full,
            overflow: 'hidden',
            backgroundColor: tokens.background,
          },
          style,
        ]}
      />
    </AvatarContext.Provider>
  )
}

export type AvatarImageProps = Omit<ImageProps, 'source'> & {
  uri: string
}

function AvatarImage({ uri, style, ...props }: AvatarImageProps): ReactNode {
  const { size } = useAvatarContext()
  if (uri.length === 0) {
    return null
  }

  return (
    <Image
      accessibilityRole="image"
      {...props}
      source={{ uri }}
      resizeMode="cover"
      style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
    />
  )
}

export type AvatarFallbackProps = ViewProps & {
  name?: string
}

function AvatarFallback({ name, style, ...props }: AvatarFallbackProps): ReactNode {
  useAvatarContext()
  const tokens = useTokens()
  const trimmed = name?.trim() ?? ''
  let initials = ''
  if (trimmed.length > 0) {
    initials = initialsFromName(trimmed)
  }

  let label = null
  if (initials.length > 0) {
    label = (
      <Text
        variant="body"
        style={[
          styles.initials,
          {
            color: tokens.foreground,
            ...sansFace(tokens.fontFamily.sans, 700),
          },
        ]}
      >
        {initials}
      </Text>
    )
  } else {
    label = (
      <PersonIcon
        color={tokens.foreground}
        size={FALLBACK_PERSON_ICON_SIZE}
        testID="avatar-fallback-person"
      />
    )
  }

  return (
    <View
      {...props}
      style={[
        StyleSheet.absoluteFill,
        styles.fallback,
        {
          backgroundColor: tokens.background,
          borderWidth: 2,
          borderColor: tokens.foreground,
          borderRadius: tokens.radius.full,
        },
        style,
      ]}
    >
      {label}
    </View>
  )
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
})

/** Themed avatar primitive. Internal — see UI Primitives in AGENTS.md. */
export const Avatar = Object.assign(AvatarRoot, {
  Image: AvatarImage,
  Fallback: AvatarFallback,
})
