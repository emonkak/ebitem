import {
  Binding,
  Directive,
  directiveTag,
  ensureDirective,
  resolveBinding,
} from './binding.js';
import { Context } from './context.js';
import { UsableObject, usableTag } from './hook.js';
import { LinkedList } from './linkedList.js';
import type { Part } from './part.js';
import type { Updater } from './types.js';

export type Subscriber = () => void;

export type Subscription = () => void;

type UnwrapSignals<T> = T extends any[]
  ? {
      [P in keyof T]: T[P] extends Signal<infer Value> ? Value : never;
    }
  : never;

export abstract class Signal<T> implements Directive, UsableObject<T, Context> {
  abstract get value(): T;

  abstract get version(): number;

  abstract subscribe(subscriber: Subscriber): Subscription;

  map<TResult>(
    selector: (value: T) => TResult,
  ): ComputedSignal<TResult, [Signal<T>]> {
    return ComputedSignal.lift(selector, [this as Signal<T>]);
  }

  toJSON(): T {
    return this.value;
  }

  valueOf(): T {
    return this.value;
  }

  [directiveTag](part: Part, updater: Updater): SignalBinding<T> {
    return new SignalBinding(this, part, updater);
  }

  [usableTag](context: Context): T {
    context.useEffect(
      () =>
        this.subscribe(() => {
          context.requestUpdate();
        }),
      [this],
    );
    return this.value;
  }
}

export class SignalBinding<T> implements Binding<Signal<T>> {
  private readonly _valueBinding: Binding<T>;

  private _signal: Signal<T>;

  private _subscription: Subscription | null = null;

  constructor(signal: Signal<T>, part: Part, updater: Updater) {
    this._signal = signal;
    this._valueBinding = resolveBinding(signal.value, part, updater);
  }

  get part(): Part {
    return this._valueBinding.part;
  }

  get startNode(): ChildNode {
    return this._valueBinding.startNode;
  }

  get endNode(): ChildNode {
    return this._valueBinding.endNode;
  }

  get value(): Signal<T> {
    return this._signal;
  }

  get valueBinding(): Binding<T> {
    return this._valueBinding;
  }

  bind(newValue: Signal<T>, updater: Updater) {
    DEBUG: {
      ensureDirective(Signal, newValue);
    }
    if (this._signal !== newValue) {
      this._signal = newValue;
      this._subscription?.();
      this._subscription = null;
    }
    this._valueBinding.bind(newValue.value, updater);
    this._subscription ??= this._subscribeSignal(newValue, updater);
  }

  rebind(updater: Updater): void {
    this._valueBinding.rebind(updater);
    this._subscription ??= this._subscribeSignal(this._signal, updater);
  }

  unbind(updater: Updater): void {
    this._valueBinding.unbind(updater);
    this._subscription?.();
    this._subscription = null;
  }

  disconnect(): void {
    this._valueBinding.disconnect();
    this._subscription?.();
    this._subscription = null;
  }

  private _subscribeSignal(signal: Signal<T>, updater: Updater): Subscription {
    return signal.subscribe(() => {
      this._valueBinding.bind(signal.value, updater);
      updater.scheduleUpdate();
    });
  }
}

export class AtomSignal<T> extends Signal<T> {
  private readonly _subscribers = new LinkedList<Subscriber>();

  private _value: T;

  private _version = 0;

  constructor(initialValue: T) {
    super();
    this._value = initialValue;
  }

  get value(): T {
    return this._value;
  }

  set value(newValue: T) {
    this._value = newValue;
    this.forceUpdate();
  }

  get version(): number {
    return this._version;
  }

  forceUpdate() {
    this._version += 1;

    for (
      let node = this._subscribers.front();
      node !== null;
      node = node.next
    ) {
      const subscriber = node.value;
      subscriber();
    }
  }

  setUntrackedValue(newValue: T): void {
    this._value = newValue;
  }

  subscribe(subscriber: Subscriber): Subscription {
    const node = this._subscribers.pushBack(subscriber);
    return () => {
      this._subscribers.remove(node);
    };
  }
}

export class ComputedSignal<
  TResult,
  const TDependencies extends Signal<any>[],
> extends Signal<TResult> {
  private readonly _factory: (...signals: TDependencies) => TResult;

  private readonly _dependencies: TDependencies;

  private _memoizedValue: TResult | null = null;

  private _memoizedVersion = -1; // -1 is indicated an uninitialized signal.

  static lift<TResult, const TDependencies extends Signal<any>[]>(
    factory: (...signals: UnwrapSignals<TDependencies>) => TResult,
    dependencies: TDependencies,
  ): ComputedSignal<TResult, TDependencies> {
    return new ComputedSignal((...dependencies) => {
      const args = dependencies.map(
        (dependency) => dependency.value,
      ) as UnwrapSignals<TDependencies>;
      return factory(...args);
    }, dependencies);
  }

  constructor(
    factory: (...signals: TDependencies) => TResult,
    dependencies: TDependencies,
  ) {
    super();
    this._factory = factory;
    this._dependencies = dependencies;
  }

  get value(): TResult {
    const newVersion = this.version;
    if (this._memoizedVersion < newVersion) {
      const factory = this._factory;
      this._memoizedVersion = newVersion;
      this._memoizedValue = factory(...this._dependencies);
    }
    return this._memoizedValue!;
  }

  get version(): number {
    const dependencies = this._dependencies;

    let version = 0;

    for (let i = 0, l = dependencies.length; i < l; i++) {
      version += dependencies[i]!.version;
    }

    return version;
  }

  subscribe(subscriber: Subscriber): Subscription {
    const subscriptions = this._dependencies.map((dependency) =>
      dependency.subscribe(subscriber),
    );
    return () => {
      for (let i = 0, l = subscriptions.length; i < l; i++) {
        subscriptions[i]!();
      }
    };
  }
}
