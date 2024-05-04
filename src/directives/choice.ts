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
    const factory = this._factory;
    const value = factory(this._key);
    const initialBinding = createBinding(value, part, updater);
    return new ChoiceBinding(this, initialBinding);
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
    directive: ChoiceDirective<TKey, TValue>,
    initialBinding: Binding<TValue>,
  ) {
    this._directive = directive;
    this._currentBinding = initialBinding;
    this._currentKey = directive.key;
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
      updateBinding(this._currentBinding, newValue, updater);
    } else {
      this._currentBinding.unbind(updater);
      this._cachedBindings.set(oldKey, this._currentBinding);

      const cachedBinding = this._cachedBindings.get(newKey);

      if (cachedBinding !== undefined) {
        this._currentBinding.value = newValue;
        this._currentBinding.bind(updater);
      } else {
        this._currentBinding = createBinding(
          newValue,
          this._currentBinding.part,
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
