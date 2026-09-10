// jest-dom matcher types for vitest 5.
//
// `@testing-library/jest-dom` still ships its vitest augmentation against the
// vitest 4 shape (`interface Assertion<T = any>`); vitest 5 widened that to
// `interface Assertion<R extends void | Promise<void> = void, T = unknown>`.
// Declaration merging requires an identical type-parameter list, so the
// package's own augmentation silently stops applying (the mismatch itself is
// swallowed by `skipLibCheck`) and every `expect(el).toBeInTheDocument()` in a
// `.ts`/`.tsx` test fails `tsc` with TS2339.
//
// Re-declare the augmentation with vitest 5's arity, reusing jest-dom's own
// matcher interface so the matcher list stays in lockstep with the package.
// Delete this file once jest-dom ships vitest 5 types upstream.
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

declare module 'vitest' {
  interface Assertion<
    R extends void | Promise<void> = void,
    T = unknown,
  > extends TestingLibraryMatchers<T, R> {}
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<unknown, void> {}
}
