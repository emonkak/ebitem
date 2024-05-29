import {
  Binding,
  Directive,
  directiveTag,
  ensureDirective,
  resolveBinding,
} from '../binding.js';
import type { Part } from '../part.js';
import type { Updater } from '../types.js';

export function choice<TKey, TValue>(
  key: TKey,
  factory: (key: TKey) => TValue,
): ChoiceDirective<TKey, TValue> {
  return new ChoiceDirective(key, factory);
}

export class ChoiceDirective<TKey, TValue> implements Directive {
  private readonly _key: TKey;

  private readonly _factory: (key: TKey) => TValue;

  constructor(key: TKey, factory: (key: TKey) => TValue) {
    this._key = key;
    this._factory = factory;
  }

  get key(): TKey {
    return this._key;
  }

  get factory(): (key: TKey) => TValue {
    return this._factory;
  }

  [directiveTag](part: Part, _updater: Updater): ChoiceBinding<TKey, TValue> {
    return new ChoiceBinding(this, part);
  }
}

export class ChoiceBinding<TKey, TValue>
  implements Binding<ChoiceDirective<TKey, TValue>>
{
  private _directive: ChoiceDirective<TKey, TValue>;

  private readonly _part: Part;

  private _currentKey: TKey | null = null;

  private _currentBinding: Binding<TValue> | null = null;

  private _cachedBindings: Map<TKey, Binding<TValue>> = new Map();

  constructor(directive: ChoiceDirective<TKey, TValue>, part: Part) {
    this._directive = directive;
    this._part = part;
  }

  get part(): Part {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._currentBinding?.startNode ?? this._part.node;
  }

  get endNode(): ChildNode {
    return this._currentBinding?.endNode ?? this._part.node;
  }

  get value(): ChoiceDirective<TKey, TValue> {
    return this._directive;
  }

  bind(newValue: ChoiceDirective<TKey, TValue>, updater: Updater): void {
    DEBUG: {
      ensureDirective(ChoiceDirective, newValue);
    }
    const oldValue = this._directive;
    if (
      oldValue.key !== newValue.key ||
      oldValue.factory !== newValue.factory
    ) {
      this._directive = newValue;
      this.rebind(updater);
    }
  }

  rebind(updater: Updater): void {
    const { key: newKey, factory } = this._directive;
    const newValue = factory(newKey);

    if (this._currentBinding !== null) {
      if (Object.is(this._currentKey, newKey)) {
        this._currentBinding.bind(newValue, updater);
      } else {
        this._currentBinding.unbind(updater);
        // Remenber the old binding for future updates.
        this._cachedBindings.set(
          this._currentKey as TKey,
          this._currentBinding,
        );
        this._currentBinding = this._getBindingFromCache(
          newKey,
          newValue,
          updater,
        );
      }
    } else {
      this._currentBinding = this._getBindingFromCache(
        newKey,
        newValue,
        updater,
      );
    }

    this._currentKey = newKey;
  }

  unbind(updater: Updater): void {
    this._currentBinding?.unbind(updater);
  }

  disconnect(): void {
    this._currentBinding?.disconnect();
  }

  private _getBindingFromCache(
    newKey: TKey,
    newValue: TValue,
    updater: Updater,
  ): Binding<TValue> {
    const cachedBinding = this._cachedBindings.get(newKey);
    if (cachedBinding !== undefined) {
      cachedBinding.bind(newValue, updater);
      return cachedBinding;
    } else {
      const binding = resolveBinding(newValue, this._part, updater);
      binding.rebind(updater);
      return binding;
    }
  }
}
