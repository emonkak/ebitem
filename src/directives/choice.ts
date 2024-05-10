import {
  Binding,
  Directive,
  Part,
  createBinding,
  directiveTag,
  updateBinding,
} from '../binding.js';
import type { Updater } from '../updater.js';

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

  [directiveTag](part: Part, updater: Updater): ChoiceBinding<TKey, TValue> {
    const binding = new ChoiceBinding(this, part);

    binding.bind(updater);

    return binding;
  }
}

export class ChoiceBinding<TKey, TValue>
  implements Binding<ChoiceDirective<TKey, TValue>>
{
  private readonly _part: Part;

  private _value: ChoiceDirective<TKey, TValue>;

  private _currentKey: TKey | null = null;

  private _currentBinding: Binding<TValue> | null = null;

  private _cachedBindings: Map<TKey, Binding<TValue>> = new Map();

  constructor(value: ChoiceDirective<TKey, TValue>, part: Part) {
    this._value = value;
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
    return this._value;
  }

  set value(newValue: ChoiceDirective<TKey, TValue>) {
    this._value = newValue;
  }

  bind(updater: Updater): void {
    const { key: newKey, factory } = this._value;
    const newValue = factory(newKey);

    if (this._currentBinding !== null) {
      if (Object.is(this._currentKey, newKey)) {
        updateBinding(this._currentBinding, newValue, updater);
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
    if (this._currentBinding !== null) {
      this._currentKey = null;
      this._currentBinding?.unbind(updater);
      this._currentBinding = null;
    }
  }

  disconnect(): void {
    if (this._currentBinding !== null) {
      this._currentKey = null;
      this._currentBinding?.disconnect();
      this._currentBinding = null;
    }
  }

  private _getBindingFromCache(
    newKey: TKey,
    newValue: TValue,
    updater: Updater,
  ): Binding<TValue> {
    const cachedBinding = this._cachedBindings.get(newKey);
    if (cachedBinding !== undefined) {
      cachedBinding.value = newValue;
      cachedBinding.bind(updater);
      return cachedBinding;
    } else {
      return createBinding(newValue, this._part, updater);
    }
  }
}
