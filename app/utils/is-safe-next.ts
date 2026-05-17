const SAFE_NEXT_PATTERN = /^\/join\/[A-Z0-9]{6}$/

export function isSafeNext(value: unknown): value is string {
  return typeof value === 'string' && SAFE_NEXT_PATTERN.test(value)
}
