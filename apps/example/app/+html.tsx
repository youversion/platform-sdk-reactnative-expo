import { ScrollViewStyleReset } from 'expo-router/html'
import type { PropsWithChildren, ReactNode } from 'react'

/**
 * Expo web NativeTabs leaves #root at 0 height (html/body 100% has no used
 * height). min-height: 100vh lets the example BibleCard paint under Metro.
 */
export default function Html({ children }: PropsWithChildren): ReactNode {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <ScrollViewStyleReset />
        <style>{'html,body,#root{height:100%;min-height:100vh}'}</style>
      </head>
      <body>{children}</body>
    </html>
  )
}
