import { isDirective, performDirective } from './directive.js';
import type { Effect, Updater } from './updater.js';

export interface Part<TContext = unknown> extends Effect<TContext> {
  get node(): ChildNode;
  get value(): unknown;
  set value(newValue: unknown);
  get dirty(): boolean;
  disconnect(updater: Updater<TContext>): void;
}

export abstract class PartChild<TContext = unknown> {
  abstract get startNode(): ChildNode | null;

  abstract get endNode(): ChildNode | null;

  abstract mount(part: Part<TContext>, updater: Updater<TContext>): void;

  abstract unmount(part: Part<TContext>, updater: Updater<TContext>): void;
}

export function mountPart(part: Part, value: unknown, updater: Updater): void {
  if (isDirective(value)) {
    performDirective(value, part, updater);
  } else {
    part.value = value;
    updater.enqueueMutationEffect(part);
  }
}

export function removePart(part: Part, updater: Updater): void {
  updater.enqueueMutationEffect(new DisconnectPart(part));
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
    performDirective(newValue, part, updater);
  } else {
    const fresh = !part.dirty;
    part.value = newValue;
    if (fresh && part.dirty) {
      updater.enqueueMutationEffect(part);
    }
    part.value = newValue;
  }
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
