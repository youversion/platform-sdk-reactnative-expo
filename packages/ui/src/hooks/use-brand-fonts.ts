import { createContext, use } from 'react'

/** True once the bundled sans faces are registered. Published by `YouVersionProvider`. */
export const BrandFontsContext = createContext<boolean>(false)

export function useBrandFontsReady(): boolean {
  return use(BrandFontsContext)
}
