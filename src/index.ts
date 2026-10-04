/**
 * The package's public surface. This module is a placeholder: replace it with
 * the first real one, and keep the shape it demonstrates. Pure functions here,
 * side effects at the edge, and a `*.test.ts` beside every file.
 */

export type Tone = 'formal' | 'casual';

export interface Greeting {
  readonly name: string;
  readonly tone: Tone;
}

/**
 * The greeting for `name` in `tone`. A `switch` over a union with no `default`:
 * a new tone fails to compile here until it is handled, which is what
 * `@typescript-eslint/switch-exhaustiveness-check` is on for.
 */
export function greet({ name, tone }: Greeting): string {
  switch (tone) {
    case 'formal':
      return `Good day, ${name}.`;
    case 'casual':
      return `Hi, ${name}!`;
  }
}
