import type { YouVersionImage } from '@youversion/platform-react-native-expo-core'
import { useTokens } from '@youversion/platform-react-native-expo-ui'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import { imageAspect, renditionUrl, selectionFor } from '../lib/image-library'
import { VerseImage } from './verse-image'

const VISIBLE = 3
const INSET_X = 24
const INSET_Y = 20

// SwiftUI's `.easeOut` curve and timings, so the shuffle reads the same as the Swift sample.
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1)
const SHUFFLE = { duration: 200, easing: EASE_OUT }
const RETURN = { duration: 300, easing: EASE_OUT }
// UIKit's normal deceleration projection; a flick counts toward the threshold like SwiftUI's
// `predictedEndTranslation`.
const FLICK_PROJECTION = 0.5

type Size = { width: number; height: number }

// Swift's `.aspectRatio(contentMode: .fit)`: the card fits the inset stage on both axes.
function fitCard(stage: Size, aspect: number): Size & { left: number; top: number } {
  const boxWidth = Math.max(0, stage.width - INSET_X * 2)
  const boxHeight = Math.max(0, stage.height - INSET_Y * 2)
  const width = Math.min(boxWidth, boxHeight * aspect)
  const height = width / aspect
  return {
    width,
    height,
    left: INSET_X + (boxWidth - width) / 2,
    top: INSET_Y + (boxHeight - height) / 2,
  }
}

type Direction = -1 | 1

type Flight = {
  token: number
  phase: 'leaving' | 'returning'
  direction: Direction
}

type Flights = Readonly<Record<string, Flight>>

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
  // Several cards can be in flight at once, so a quick second swipe shuffles instead of waiting.
  const [flights, setFlights] = useState<Flights>({})
  const [reduceMotion, setReduceMotion] = useState(false)
  const [stage, setStage] = useState<Size>({ width: 280, height: 280 / 0.85 })
  const flightToken = useRef(0)
  const imagesRef = useRef(images)
  const selectedRef = useRef(selectedId)
  const mounted = useRef(false)
  imagesRef.current = images
  selectedRef.current = selectedId

  useEffect(() => {
    mounted.current = true
  }, [])

  const validId = selectionFor(images, selectedId)
  if (validId !== selectedId) setSelectedId(validId)
  const staleFlights = Object.keys(flights).filter((id) => !images.some((image) => image.id === id))
  if (staleFlights.length > 0) setFlights(withoutFlights(flights, staleFlights))

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

  // Warm the card that enters the stack next so a shuffle never waits on the network.
  useEffect(() => {
    const index = images.findIndex((image) => image.id === validId)
    if (index < 0 || images.length <= VISIBLE) return
    const upcoming = images[(index + VISIBLE) % images.length]
    if (upcoming) void Image.prefetch(renditionUrl(upcoming.image_url, 'card')).catch(() => {})
  }, [images, validId])

  const shuffle = useCallback(
    (direction: Direction) => {
      const items = imagesRef.current
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
        setFlights({})
        setSelectedId(next.id)
        return
      }
      const token = flightToken.current + 1
      flightToken.current = token
      setFlights((cur) => ({
        ...withoutFlights(cur, [next.id]),
        [current.id]: { token, phase: 'leaving', direction },
      }))
      setSelectedId(next.id)
    },
    [onOpen, reduceMotion],
  )

  const onLeave = useCallback((imageId: string, token: number) => {
    setFlights((cur) => {
      const flight = cur[imageId]
      if (flight?.token !== token || flight.phase !== 'leaving') return cur
      return { ...cur, [imageId]: { ...flight, phase: 'returning' } }
    })
  }, [])

  const onReturned = useCallback((imageId: string, token: number) => {
    setFlights((cur) => (cur[imageId]?.token === token ? withoutFlights(cur, [imageId]) : cur))
  }, [])

  const selected = images.find((image) => image.id === validId) ?? null
  const selectedIndex = images.findIndex((image) => image.id === validId)

  return (
    <View style={styles.wrap}>
      <View
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout
          setStage({ width, height })
        }}
        style={styles.stage}
      >
        {images.map((image, index) => {
          const depth = depthOf(image.id, images, validId)
          const cardFlight = flights[image.id] ?? null
          if (depth >= VISIBLE && cardFlight === null) return null
          return (
            <StackCard
              key={image.id}
              appear={mounted.current}
              depth={depth}
              flight={cardFlight}
              image={image}
              isTop={depth === 0}
              alone={images.length < 2}
              onLeave={onLeave}
              onOpen={onOpen}
              onReturned={onReturned}
              onShuffle={shuffle}
              restAngle={index % 2 === 0 ? 4 : -5}
              stage={stage}
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

function withoutFlights(flights: Flights, ids: readonly string[]): Flights {
  if (!ids.some((id) => id in flights)) return flights
  return Object.fromEntries(Object.entries(flights).filter(([id]) => !ids.includes(id)))
}

function positionLabel(count: number, selectedIndex: number): string {
  if (count === 0) return 'No images'
  const position = `${selectedIndex + 1} of ${count}`
  if (count === 1) return position
  return `${position} · Swipe for more`
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
  // A lone card has nothing to shuffle to, so a throw opens it and springs back.
  alone: boolean
  flight: Flight | null
  stage: Size
  // The tilt follows the image, not its depth, so a card keeps its angle as it moves up.
  restAngle: number
  // Fade in when the card joins an already-mounted stack, like a SwiftUI insertion.
  appear: boolean
  onOpen: (image: YouVersionImage) => void
  onShuffle: (direction: Direction) => void
  onLeave: (imageId: string, token: number) => void
  onReturned: (imageId: string, token: number) => void
}

function StackCard({
  image,
  depth,
  isTop,
  alone,
  flight,
  stage,
  restAngle,
  appear,
  onOpen,
  onShuffle,
  onLeave,
  onReturned,
}: StackCardProps) {
  const frame = fitCard(stage, imageAspect(image.aspect_ratio))
  const width = stage.width
  const phase = flight?.phase ?? 'idle'
  const direction = flight?.direction ?? -1
  const token = flight?.token ?? 0
  const stackDepth = phase === 'leaving' ? 0 : Math.min(depth, VISIBLE - 1)

  // `x`/`y` are the drag or flight offset; `pose` is the stack depth and `top` blends the
  // tilt from the resting angle to the drag angle. All four ease, so no part of a shuffle snaps.
  const x = useSharedValue(0)
  const y = useSharedValue(0)
  const pose = useSharedValue(stackDepth)
  const top = useSharedValue(isTop ? 1 : 0)
  const opacity = useSharedValue(appear ? 0 : 1)

  const onLeaveRef = useRef(onLeave)
  const onReturnedRef = useRef(onReturned)
  onLeaveRef.current = onLeave
  onReturnedRef.current = onReturned
  const signalLeave = useCallback(() => {
    onLeaveRef.current(image.id, token)
  }, [image.id, token])
  const signalReturn = useCallback(() => {
    onReturnedRef.current(image.id, token)
  }, [image.id, token])

  useEffect(() => {
    if (phase === 'leaving') {
      pose.value = withTiming(0, SHUFFLE)
      top.value = withTiming(1, SHUFFLE)
      opacity.value = withTiming(1, SHUFFLE)
      x.value = withTiming(direction * (width + INSET_X), SHUFFLE, (finished) => {
        if (finished) runOnJS(signalLeave)()
      })
      y.value = withTiming(12, SHUFFLE)
      return
    }
    if (phase === 'returning') {
      pose.value = withTiming(stackDepth, RETURN)
      top.value = withTiming(0, RETURN)
      opacity.value = withTiming(depth >= VISIBLE ? 0 : 1, RETURN)
      x.value = withTiming(0, RETURN, (finished) => {
        if (finished) runOnJS(signalReturn)()
      })
      y.value = withTiming(0, RETURN)
      return
    }
    pose.value = withTiming(stackDepth, SHUFFLE)
    top.value = withTiming(isTop ? 1 : 0, SHUFFLE)
    opacity.value = withTiming(1, SHUFFLE)
    x.value = 0
    y.value = 0
  }, [
    depth,
    direction,
    isTop,
    opacity,
    phase,
    pose,
    signalLeave,
    signalReturn,
    stackDepth,
    top,
    width,
    x,
    y,
  ])

  const animatedStyle = useAnimatedStyle(() => {
    const angle = restAngle * (1 - top.value) + (x.value / 24) * top.value
    return {
      opacity: opacity.value,
      transform: [
        { translateX: x.value + interpolate(pose.value, [0, 1, 2], [0, 7, -6]) },
        { translateY: y.value + pose.value * 6 },
        { rotate: `${angle}deg` },
        { scale: 1 - pose.value * 0.035 },
      ],
    }
  }, [restAngle])

  // Leaving cards ride above the stack; returning cards slide in under it, newest lowest.
  const layer =
    phase === 'leaving'
      ? { zIndex: 100 + token, elevation: 12 }
      : phase === 'returning'
        ? { zIndex: -token, elevation: 0 }
        : { zIndex: VISIBLE - depth, elevation: isTop ? 12 : 4 }

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
      const projected = event.translationX + event.velocityX * FLICK_PROJECTION
      if (horizontal && Math.abs(projected) > width * 0.25) {
        runOnJS(onShuffle)(projected < 0 ? -1 : 1)
        if (!alone) return
      }
      x.value = withSpring(0, { duration: 300, dampingRatio: 1 })
      y.value = withSpring(0, { duration: 300, dampingRatio: 1 })
    })

  // A tap opens the full-screen viewer; only a swipe shuffles.
  const tap = Gesture.Tap()
    .enabled(isTop && phase === 'idle')
    .onEnd(() => {
      runOnJS(onOpen)(image)
    })

  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <Animated.View
        accessibilityElementsHidden={!isTop}
        pointerEvents={isTop && phase === 'idle' ? 'auto' : 'none'}
        style={[
          styles.card,
          styles.shadow,
          frame,
          layer,
          { shadowColor: tokens.foreground },
          animatedStyle,
        ]}
      >
        <VerseImage
          frame="natural"
          image={image}
          presentation={phase === 'leaving' || depth === 0 ? 'standard' : 'decorative'}
          size="card"
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
    position: 'absolute',
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
