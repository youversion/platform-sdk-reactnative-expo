type OutsideNativeScopeProps = {
  accessibilityLabel: string
  headerTitle: string
}

function OutsideNativeScopeHost(_props: OutsideNativeScopeProps) {
  return null
}

/** Outside packages/ui/src/native — production i18n scope must not flag this file. */
export function OutsideNativeScopeFixture() {
  return (
    <OutsideNativeScopeHost accessibilityLabel="Outside native scope" headerTitle="Not localized" />
  )
}
