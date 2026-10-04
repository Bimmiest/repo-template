import { describe, expect, it } from 'vitest';
import { greet } from './index.ts';

describe('greet', () => {
  it('addresses a formal greeting by name', () => {
    expect(greet({ name: 'Ada', tone: 'formal' })).toBe('Good day, Ada.');
  });

  it('keeps a casual greeting short', () => {
    expect(greet({ name: 'Ada', tone: 'casual' })).toBe('Hi, Ada!');
  });
});
