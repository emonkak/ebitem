import {
  type Binding,
  type Directive,
  directiveTag,
  ensureDirective,
  resolveBinding,
} from '../binding.js';
import type { Part, Updater } from '../types.js';
import { dependenciesAreChanged } from '../utils.js';

export function memo(value: unknown, dependencies?: unknown[]): MemoDirective {
  return new MemoDirective(value, dependencies);
}

export class MemoDirective implements Directive {
  private readonly _value: unknown;

  private readonly _dependencies: unknown[] | undefined;

  constructor(value: unknown, dependencies: unknown[] | undefined) {
    this._value = value;
    this._dependencies = dependencies;
  }

  get value(): unknown {
    return this._value;
  }

  get dependencies(): unknown[] | undefined {
    return this._dependencies;
  }

  [directiveTag](part: Part, updater: Updater): MemoBinding {
    return new MemoBinding(this, part, updater);
  }
}

export class MemoBinding implements Binding<unknown> {
  private _directive: MemoDirective;

  private _binding: Binding<unknown>;

  private readonly _part: Part;

  constructor(directive: MemoDirective, part: Part, updater: Updater) {
    this._directive = directive;
    this._binding = resolveBinding(directive, part, updater);
    this._part = part;
  }

  get part(): Part {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  get value(): MemoDirective {
    return this._directive;
  }

  bind(newValue: MemoDirective, updater: Updater): void {
    DEBUG: {
      ensureDirective(MemoDirective, newValue);
    }
    const oldDependencies = this._directive.dependencies;
    const newDependencies = newValue.dependencies;
    if (dependenciesAreChanged(oldDependencies, newDependencies)) {
      this._directive = newValue;
      this._binding.bind(newValue.value, updater);
    }
  }

  rebind(updater: Updater): void {
    this._binding.rebind(updater);
  }

  unbind(updater: Updater): void {
    this._directive = new MemoDirective(this._directive.value, undefined);
    this._binding.unbind(updater);
  }

  disconnect(): void {
    this._directive = new MemoDirective(this._directive.value, undefined);
    this._binding.disconnect();
  }
}
