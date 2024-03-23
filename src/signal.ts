import {
  Binding,
  Directive,
  createBinding,
  directiveTag,
  updateBinding,
} from './binding.js';
import { Context, UsableObject, usableTag } from './context.js';
import { LinkedList } from './linkedList.js';
import type { Part, Updater } from './types.js';

export type Subscriber = () => void;

export type Subscription = () => void;

type UnwrapSignals<T> = T extends any[]
  ? {
      [P in keyof T]: T[P] extends Signal<infer Value> ? Value : never;
    }
  : never;

export abstract class Signal<T> implements Directive, UsableObject<void> {
  abstract get value(): T;

  abstract get version(): number;

  abstract subscribe(subscriber: Subscriber): Subscription;

  map<TResult>(
    selector: (value: T) => TResult,
  ): ComputedSignal<TResult, [Signal<T>]> {
    return ComputedSignal.compose(selector, [this as Signal<T>]);
  }

  memoized(): MemoizedSignal<T> {
    return new MemoizedSignal(this);
  }

  toJSON(): T {
    return this.value;
  }

  valueOf(): T {
    return this.value;
  }

  [usableTag](context: Context): void {
    context.useEffect(
      () =>
        this.subscribe(() => {
          context.requestUpdate();
        }),
      [this],
    );
  }

  [directiveTag](part: Part, updater: Updater): SignalBinding<T> {
    const innerBinding = createBinding(part, this.value, updater);
    const binding = new SignalBinding(innerBinding, this);

    binding.init(updater);

    return binding;
  }
}

export class SignalBinding<T> implements Binding<Signal<T>> {
  private _binding: Binding<T>;

  private _signal: Signal<T>;

  private _subscription: Subscription | null = null;

  constructor(binding: Binding<T>, signal: Signal<T>) {
    this._binding = binding;
    this._signal = signal;
  }

  get part(): Part {
    return this._binding.part;
  }

  get startNode(): ChildNode {
    return this._binding.startNode;
  }

  get endNode(): ChildNode {
    return this._binding.endNode;
  }

  get value(): Signal<T> {
    return this._signal;
  }

  set value(newSignal: Signal<T>) {
    this._signal = newSignal;
  }

  init(updater: Updater): void {
    if (this._subscription === null) {
      this._subscription = this._startSubscription(updater);
    }
  }

  bind(updater: Updater): void {
    if (this._subscription === null) {
      this._binding = updateBinding(this._binding, this._signal.value, updater);
      this._subscription = this._startSubscription(updater);
    }
  }

  unbind(updater: Updater) {
    this._binding.unbind(updater);

    this._subscription?.();
    this._subscription = null;
  }

  disconnect(): void {
    this._binding.disconnect();
  }

  private _startSubscription(updater: Updater): Subscription {
    const weakThis = new WeakRef(this);

    const subscription = this._signal.subscribe(() => {
      const that = weakThis.deref();

      if (that !== undefined) {
        // FIXME: The binding will be updated with a new value whether or not
        // the target is connected to the document. Is is just a performance
        // issue?
        that._binding = updateBinding(
          that._binding,
          that._signal.value,
          updater,
        );
      } else {
        // The signal will be automatically unsubscribed when this instance is
        // garbage-collected.
        subscription();
      }
    });

    return subscription;
  }
}

export class AtomSignal<T> extends Signal<Readonly<T>> {
  private readonly _subscribers = new LinkedList<Subscriber>();

  private _value: T;

  private _version = 1;

  constructor(initialValue: T) {
    super();
    this._value = initialValue;
  }

  get value(): Readonly<T> {
    return this._value;
  }

  set value(newValue: T) {
    this._value = newValue;
    this._notify();
  }

  get version(): number {
    return this._version;
  }

  mutate(callback: (value: T) => void | boolean): boolean {
    const value = this._value;
    const result = callback(value) ?? true;
    if (result) {
      this._notify();
    }
    return result;
  }

  subscribe(subscriber: Subscriber): Subscription {
    const node = this._subscribers.pushBack(subscriber);
    return () => {
      this._subscribers.remove(node);
    };
  }

  update(callback: (value: Readonly<T>) => T): T {
    const newValue = callback(this._value);
    this._value = newValue;
    this._notify();
    return newValue;
  }

  private _notify(): void {
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
}

export class ComputedSignal<
  TResult,
  const TDependencies extends Signal<any>[],
> extends Signal<TResult> {
  private readonly _factory: (...signals: TDependencies) => TResult;

  private readonly _dependencies: TDependencies;

  static compose<TResult, const TDependencies extends Signal<any>[]>(
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
    const factory = this._factory;
    return factory(...this._dependencies);
  }

  get version(): number {
    const dependencies = this._dependencies;

    let version = 1;

    for (let i = 0, l = dependencies.length; i < l; i++) {
      version += dependencies[i]!.version - 1;
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

export class MemoizedSignal<T> extends Signal<T> {
  private readonly _signal: Signal<T>;

  private _memoizedValue: T | null = null;

  private _memoizedVersion = 0; // 0 is indicated an uninitialized signal.

  constructor(signal: Signal<T>) {
    super();
    this._signal = signal;
  }

  get value(): T {
    const newVersion = this._signal.version;
    if (this._memoizedVersion < newVersion) {
      this._memoizedValue = this._signal.value;
      this._memoizedVersion = newVersion;
    }
    return this._memoizedValue!;
  }

  get version(): number {
    return this._signal.version;
  }

  subscribe(subscriber: Subscriber): Subscription {
    return this._signal.subscribe(subscriber);
  }
}
