import type { YouVersionImage } from '@youversion/platform-react-native-expo-core'
import { useTokens } from '@youversion/platform-react-native-expo-ui'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { selectionFor } from '../_lib/image-library'
import { VerseImage } from './verse-image'

const VISIBLE = 3

type Direction = -1 | 1

type Flight = {
  token: number
  imageId: string
  phase: 'leaving' | 'returning'
  direction: Direction
}

type VerseImageStackProps = {
  images: readonly YouVersionImage[]
  onOpen: (image: YouVersionImage) => void
  onSelectionChange: (image: YouVersionImage) => void
}

function depthOf(
  id: string,
  images: readonly YouVersionImage[],
  selectedId: string | null,
): number {
  if (images.length === 0) return 0
  const index = images.findIndex((image) => image.id === id)
  const selectedIndex = images.findIndex((image) => image.id === selectedId)
  if (index < 0) return 0
  const origin = selectedIndex < 0 ? 0 : selectedIndex
  return (index - origin + images.length) % images.length
}

export function VerseImageStack({ images, onOpen, onSelectionChange }: VerseImageStackProps) {
  const tokens = useTokens()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [flight, setFlight] = useState<Flight | null>(null)
  const [reduceMotion, setReduceMotion] = useState(false)
  const [width, setWidth] = useState(280)
  const flightToken = useRef(0)
  const imagesRef = useRef(images)
  const selectedRef = useRef(selectedId)
  imagesRef.current = images
  selectedRef.current = selectedId

  const validId = selectionFor(images, selectedId)
  if (validId !== selectedId) setSelectedId(validId)
  if (flight !== null && !images.some((image) => image.id === flight.imageId)) setFlight(null)

  useEffect(() => {
    let current = true
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (current) setReduceMotion(enabled)
    })
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setReduceMotion(enabled)
    })
    return () => {
      current = false
      subscription.remove()
    }
  }, [])

  useEffect(() => {
    const selected = images.find((image) => image.id === validId)
    if (selected) onSelectionChange(selected)
  }, [images, onSelectionChange, validId])

  const shuffle = useCallback(
    (direction: Direction) => {
      const items = imagesRef.current
      if (flight !== null) return
      if (items.length < 2) {
        const only = items[0]
        if (only) onOpen(only)
        return
      }
      const selected = selectionFor(items, selectedRef.current)
      const selectedIndex = items.findIndex((image) => image.id === selected)
      const current = items[selectedIndex]
      const next = items[(selectedIndex + 1) % items.length]
      if (current === undefined || next === undefined) return
      if (reduceMotion) {
        setSelectedId(next.id)
        return
      }
      const token = flightToken.current + 1
      flightToken.current = token
      setFlight({ token, imageId: current.id, phase: 'leaving', direction })
      setSelectedId(next.id)
    },
    [flight, onOpen, reduceMotion],
  )

  const onLeave = useCallback((token: number) => {
    const items = imagesRef.current
    setFlight((current) => {
      if (current === null || current.token !== token || current.phase !== 'leaving') return current
      const depth = depthOf(current.imageId, items, selectedRef.current)
      if (depth >= VISIBLE) return null
      return { ...current, phase: 'returning' }
    })
  }, [])

  const onReturned = useCallback((token: number) => {
    setFlight((current) => {
      if (current === null || current.token !== token) return current
      return null
    })
  }, [])

  const selected = images.find((image) => image.id === validId) ?? null
  const selectedIndex = images.findIndex((image) => image.id === validId)

  return (
    <View style={styles.wrap}>
      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={styles.stage}>
        {images.map((image) => {
          const depth = depthOf(image.id, images, validId)
          const cardFlight = flight?.imageId === image.id ? flight : null
          if (depth >= VISIBLE && cardFlight === null) return null
          return (
            <StackCard
              key={image.id}
              depth={depth}
              flight={cardFlight}
              image={image}
              isTop={depth === 0}
              onLeave={onLeave}
              onReturned={onReturned}
              onShuffle={shuffle}
              width={width}
            />
          )
        })}
      </View>
      <View style={styles.dots}>
        {indicatorImages(images, selectedIndex).map((image) => (
          <View
            key={image.id}
            style={[
              styles.dot,
              {
                backgroundColor: image.id === validId ? tokens.foreground : tokens.mutedForeground,
                opacity: image.id === validId ? 1 : 0.35,
              },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.position, { color: tokens.mutedForeground }]}>
        {positionLabel(images.length, selectedIndex)}
      </Text>
      {selected === null ? null : (
        <Pressable
          accessibilityLabel="View image"
          accessibilityRole="button"
          onPress={() => onOpen(selected)}
          style={[styles.view, { borderColor: tokens.border, borderRadius: tokens.radius.full }]}
        >
          <Text style={[styles.viewLabel, { color: tokens.foreground }]}>View image</Text>
        </Pressable>
      )}
    </View>
  )
}

function positionLabel(count: number, selectedIndex: number): string {
  if (count === 0) return 'No images'
  const position = `${selectedIndex + 1} of ${count}`
  if (count === 1) return position
  return `${position} · Tap or swipe for more`
}

function indicatorImages(
  images: readonly YouVersionImage[],
  selectedIndex: number,
): readonly YouVersionImage[] {
  if (images.length === 0) return []
  const window = Math.min(7, images.length)
  const origin = Math.max(0, Math.min(selectedIndex - 3, images.length - window))
  return images.slice(origin, origin + window)
}

type StackCardProps = {
  image: YouVersionImage
  depth: number
  isTop: boolean
  flight: Flight | null
  width: number
  onShuffle: (direction: Direction) => void
  onLeave: (token: number) => void
  onReturned: (token: number) => void
}

function StackCard({
  image,
  depth,
  isTop,
  flight,
  width,
  onShuffle,
  onLeave,
  onReturned,
}: StackCardProps) {
  const x = useSharedValue(0)
  const y = useSharedValue(0)
  const phase = flight?.phase ?? 'idle'
  const direction = flight?.direction ?? -1
  const token = flight?.token ?? 0
  const onLeaveRef = useRef(onLeave)
  const onReturnedRef = useRef(onReturned)
  onLeaveRef.current = onLeave
  onReturnedRef.current = onReturned

  const signalLeave = useCallback(() => {
    onLeaveRef.current(token)
  }, [token])
  const signalReturn = useCallback(() => {
    onReturnedRef.current(token)
  }, [token])

  const stackDepth = Math.min(depth, VISIBLE - 1)
  const restX = stackDepth === 1 ? 7 : -stackDepth * 3
  const restY = stackDepth * 6

  useEffect(() => {
    if (phase !== 'leaving') return
    x.value = withTiming(
      direction * (width + 24),
      { duration: 200, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(signalLeave)()
      },
    )
    y.value = withTiming(12, { duration: 200 })
  }, [direction, phase, signalLeave, width, x, y])

  useEffect(() => {
    if (phase !== 'returning') return
    x.value = withTiming(restX, { duration: 300, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(signalReturn)()
    })
    y.value = withTiming(restY, { duration: 300 })
  }, [phase, restX, restY, signalReturn, x, y])

  useEffect(() => {
    if (phase === 'idle' && isTop) {
      x.value = 0
      y.value = 0
    }
  }, [isTop, phase, x, y])

  const animatedStyle = useAnimatedStyle(() => {
    const dragging = isTop && phase === 'idle'
    if (phase === 'leaving' || dragging) {
      return {
        zIndex: phase === 'leaving' ? 30 : 20,
        elevation: 12,
        opacity: 1,
        transform: [
          { translateX: x.value },
          { translateY: y.value },
          { rotate: `${x.value / 24}deg` },
          { scale: 1 },
        ],
      }
    }
    const hidden = phase === 'returning' && depth >= VISIBLE
    const offsetX = phase === 'returning' ? x.value : restX
    const offsetY = phase === 'returning' ? y.value : restY
    const angle = depth % 2 === 0 ? 4 : -5
    return {
      zIndex: phase === 'returning' ? -1 : 10 - depth,
      elevation: phase === 'returning' ? 0 : 4,
      opacity: hidden ? 0 : 1,
      transform: [
        { translateX: offsetX },
        { translateY: offsetY },
        { rotate: `${angle}deg` },
        { scale: 1 - stackDepth * 0.035 },
      ],
    }
  }, [depth, isTop, phase, restX, restY, stackDepth])

  const tokens = useTokens()
  const pan = Gesture.Pan()
    .enabled(isTop && phase === 'idle')
    .activeOffsetX([-16, 16])
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      if (Math.abs(event.translationX) <= Math.abs(event.translationY)) return
      x.value = event.translationX
      y.value = event.translationY * 0.15
    })
    .onEnd((event) => {
      const horizontal = Math.abs(event.translationX) > Math.abs(event.translationY)
      const farEnough = Math.abs(event.translationX) > width * 0.25
      if (horizontal && farEnough) {
        const nextDirection = event.translationX < 0 ? -1 : 1
        runOnJS(onShuffle)(nextDirection)
        return
      }
      x.value = withTiming(0, { duration: 200 })
      y.value = withTiming(0, { duration: 200 })
    })

  const tap = Gesture.Tap()
    .enabled(isTop && phase === 'idle')
    .onEnd(() => {
      runOnJS(onShuffle)(-1)
    })

  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <Animated.View
        accessibilityElementsHidden={!isTop}
        pointerEvents={isTop ? 'auto' : 'none'}
        style={[styles.card, styles.shadow, { shadowColor: tokens.foreground }, animatedStyle]}
      >
        <VerseImage
          frame="natural"
          image={image}
          presentation={phase === 'leaving' || depth === 0 ? 'standard' : 'decorative'}
          size={depth === 0 ? 'card' : 'thumb'}
        />
      </Animated.View>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: 16,
  },
  stage: {
    aspectRatio: 0.85,
  },
  card: {
    bottom: 20,
    left: 24,
    position: 'absolute',
    right: 24,
    top: 20,
  },
  shadow: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  dots: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  dot: {
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  position: {
    fontSize: 13,
    textAlign: 'center',
  },
  view: {
    alignSelf: 'center',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  viewLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
})
