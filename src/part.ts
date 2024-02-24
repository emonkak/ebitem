import { directiveSymbol, isDirective } from './directive.js';
import type { Effect, Updater } from './updater.js';

export interface Part extends Effect {
  get node(): ChildNode;
  setValue(newValue: unknown, updater: Updater): void;
  disconnect(updater: Updater): void;
}

export class DisconnectPart implements Effect {
  private readonly _part: Part;

  constructor(part: Part) {
    this._part = part;
  }

  commit(updater: Updater): void {
    this._part.disconnect(updater);
  }
}

export function mountPart(part: Part, value: unknown, updater: Updater): void {
  if (isDirective(value)) {
    value[directiveSymbol](part, updater);
  } else {
    part.setValue(value, updater);
    updater.enqueueMutationEffect(part);
  }
}

export function updatePart(
  part: Part,
  oldValue: unknown,
  newValue: unknown,
  updater: Updater,
): void {
  if (Object.is(oldValue, newValue)) {
    return;
  }
  if (isDirective(newValue)) {
    newValue[directiveSymbol](part, updater);
  } else {
    part.setValue(newValue, updater);
    updater.enqueueMutationEffect(part);
  }
}
