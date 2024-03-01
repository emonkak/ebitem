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

  abstract mount(part: Part, updater: Updater): void;

  abstract unmount(part: Part, updater: Updater): void;

  abstract commit(updater: Updater<TContext>): void;
}

export function insertPart(part: Part, value: unknown, updater: Updater): void {
  if (isDirective(value)) {
    performDirective(value, part, updater);
  } else {
    if (!part.dirty) {
      updater.enqueueMutationEffect(part);
    }
    part.value = value;
  }
}

export function mountPart(part: Part, value: unknown, updater: Updater): void {
  if (isDirective(value)) {
    performDirective(value, part, updater);
  } else {
    part.value = value;
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
    if (!part.dirty) {
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
