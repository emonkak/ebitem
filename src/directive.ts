import type { Part } from './part';
import type { Updater } from './updater';

export const directiveSymbol = Symbol();

export interface Directive {
  [directiveSymbol](part: Part, updater: Updater): void;
}

export function isDirective(value: unknown): value is Directive {
  return (
    typeof value === 'object' && value !== null && directiveSymbol in value
  );
}
