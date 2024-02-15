import type { Part } from './part.js';
import type { Updater } from './updater.js';

export interface Directive {
  [directiveSymbol](part: Part, updater: Updater): void;
}

export const directiveSymbol = Symbol('Directive');

export function isDirective(value: unknown): value is Directive {
  return (
    typeof value === 'object' && value !== null && directiveSymbol in value
  );
}
