import { initBinding, updateBinding } from '../binding.js';
import { Binding, Directive, Part, Updater, directiveTag } from '../types.js';

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
    const factory = this._factory;
    const value = factory(this._key);
    const initialBinding = initBinding(part, value, updater);
    return new ChoiceBinding(initialBinding, this);
  }
}

export class ChoiceBinding<TKey, TValue>
  implements Binding<ChoiceDirective<TKey, TValue>>
{
  private _currentBinding: Binding<TValue>;

  private _currentKey: TKey;

  private _directive: ChoiceDirective<TKey, TValue>;

  private _cachedBindings: Map<TKey, Binding<TValue>> = new Map();

  constructor(
    initialBinding: Binding<TValue>,
    directive: ChoiceDirective<TKey, TValue>,
  ) {
    this._currentBinding = initialBinding;
    this._currentKey = directive.key;
    this._directive = directive;
  }

  get part(): Part {
    return this._currentBinding.part;
  }

  get startNode(): ChildNode {
    return this._currentBinding.startNode;
  }

  get endNode(): ChildNode {
    return this._currentBinding.endNode;
  }

  get value(): ChoiceDirective<TKey, TValue> {
    return this._directive;
  }

  set value(directive: ChoiceDirective<TKey, TValue>) {
    this._directive = directive;
  }

  bind(updater: Updater): void {
    const factory = this._directive.factory;
    const oldKey = this._currentKey;
    const newKey = this._directive.key;
    const newValue = factory(newKey);

    if (Object.is(oldKey, newKey)) {
      if (!Object.is(this._currentBinding.value, newValue)) {
        this._currentBinding = updateBinding(
          this._currentBinding,
          newValue,
          updater,
        );
      }
    } else {
      this._currentBinding.unbind(updater);
      this._cachedBindings.set(oldKey, this._currentBinding);

      const cachedBinding = this._cachedBindings.get(newKey);

      if (cachedBinding !== undefined) {
        this._currentBinding = updateBinding(cachedBinding, newValue, updater);
      } else {
        this._currentBinding = initBinding(
          this._currentBinding.part,
          newValue,
          updater,
        );
      }
      this._currentKey = newKey;
    }
  }

  unbind(updater: Updater): void {
    this._currentBinding.unbind(updater);

    for (const [key, binding] of this._cachedBindings) {
      if (key !== this._directive.key) {
        binding.disconnect();
      }
    }
  }

  disconnect(): void {
    for (const [key, binding] of this._cachedBindings) {
      if (key !== this._directive.key) {
        binding.disconnect();
      }
    }
  }
}
