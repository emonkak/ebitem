import { directiveSymbol, isDirective } from './directive';
import type { Effect, Updater } from './updater';

export interface Part extends Effect {
  get node(): ChildNode;
  setValue(newValue: unknown): void;
  disconnect(updater: Updater): void;
}

export function mountPart(part: Part, value: unknown, updater: Updater): void {
  if (isDirective(value)) {
    value[directiveSymbol](part, updater);
  } else {
    part.setValue(value);
    updater.pushMutationEffect(part);
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
    part.setValue(newValue);
    updater.pushMutationEffect(part);
  }
}
