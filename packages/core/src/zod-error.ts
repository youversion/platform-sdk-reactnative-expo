export function isZodError(caught: Error): boolean {
  return caught.name === 'ZodError' || caught.name === '$ZodError'
}
