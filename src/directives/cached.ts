import {
  BindValueOf,
  Binding,
  Directive,
  Part,
  checkAndUpdateBinding,
  createBinding,
  directiveTag,
  updateBinding,
} from '../part.js';
import type { Updater } from '../updater.js';

export function cached<TKey, TValue>(
  key: TKey,
  factory: (key: TKey) => TValue,
): CachedDirective<TKey, TValue> {
  return new CachedDirective(key, factory);
}

export class CachedDirective<TKey, TValue>
  implements Directive<CachedDirective<TKey, TValue>>
{
  private readonly _key: TKey;

  private readonly _factory: (key: TKey) => unknown;

  constructor(key: TKey, factory: (key: TKey) => unknown) {
    this._key = key;
    this._factory = factory;
  }

  get key(): TKey {
    return this._key;
  }

  get factory(): (key: TKey) => unknown {
    return this._factory;
  }

  [directiveTag](part: Part, updater: Updater): CachedBinding<TKey, TValue> {
    const binding = new CachedBinding<TKey, TValue>(part);

    binding.bind(this, updater);

    return binding;
  }

  valueOf(): this {
    return this;
  }
}

export class CachedBinding<TKey, TValue>
  implements Binding<CachedDirective<TKey, TValue>>
{
  private readonly _part: Part;

  private _cachedBindings: Map<
    TKey,
    { binding: Binding<BindValueOf<TValue>>; value: unknown }
  > = new Map();

  private _key: TKey | null = null;

  constructor(part: Part) {
    this._part = part;
  }

  get part(): Part {
    return this._part;
  }

  get startNode(): ChildNode {
    if (this._key !== null) {
      return (
        this._cachedBindings.get(this._key)?.binding?.startNode ??
        this._part.node
      );
    } else {
      return this._part.node;
    }
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  bind(
    { key, factory }: CachedDirective<TKey, TValue>,
    updater: Updater,
  ): void {
    if (!Object.is(key, this._key) && this._key !== null) {
      const oldBinding = this._cachedBindings.get(this._key);
      oldBinding?.binding.unbind(updater);
    }

    const cachedBinding = this._cachedBindings.get(key);
    const newValue = factory(key);

    let newBinding;

    if (cachedBinding !== undefined) {
      const { binding, value: oldValue } = cachedBinding;
      const updateBindingFn = Object.is(key, this._key)
        ? checkAndUpdateBinding
        : updateBinding;
      newBinding = updateBindingFn(binding, oldValue, newValue, updater);
    } else {
      newBinding = createBinding(this._part, newValue, updater);
    }

    this._cachedBindings.set(key, { binding: newBinding, value: newValue });
    this._key = key;
  }

  unbind(updater: Updater): void {
    this._cachedBindings.forEach(({ binding }, key) => {
      if (this._key === key) {
        binding.unbind(updater);
      } else {
        binding.disconnect();
      }
    });
  }

  disconnect(): void {
    this._cachedBindings.forEach(({ binding }) => {
      binding.disconnect();
    });
  }
}
