import type { Context } from './context';
import type { Part } from './types';

export const directiveSymbol = Symbol();

export interface Directive {
  [directiveSymbol](part: Part, context: Context): void;
}

export function isDirective(value: unknown): value is Directive {
  return (
    typeof value === 'object' && value !== null && directiveSymbol in value
  );
}
