import { LinkedList } from './linkedList.js';

export type Subscriber = () => void;

export type Subscription = () => void;

type UnwrapSignals<T> = T extends Array<any>
  ? { [P in keyof T]: UnwrapSignal<T[P]> }
  : never;

type UnwrapSignal<T> = T extends Signal<infer V> ? V : never;

export abstract class Signal<T> {
  abstract get value(): T;

  abstract get version(): number;

  abstract subscribe(subscriber: Subscriber): Subscription;

  map<TResult>(
    selector: (value: T) => TResult,
  ): ComputedSignal<TResult, [Signal<T>]> {
    return ComputedSignal.fromValues(selector, [this as Signal<T>]);
  }

  memoized(): MemoizedSignal<T> {
    return new MemoizedSignal(this);
  }
}

export class AtomSignal<T> extends Signal<T> {
  private readonly _subscribers = new LinkedList<Subscriber>();

  private _value: T;

  private _version = 1;

  constructor(initialValue: T) {
    super();
    this._value = initialValue;
  }

  get value(): T {
    return this._value;
  }

  set value(newValue: T) {
    this._value = newValue;
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

  get version(): number {
    return this._version;
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
  TDependencies extends Signal<any>[],
> extends Signal<TResult> {
  private readonly _factory: (...signals: TDependencies) => TResult;

  private readonly _dependencies: TDependencies;

  static fromValues<TResult, TDependencies extends Signal<any>[]>(
    factory: (...args: UnwrapSignals<TDependencies>) => TResult,
    dependencies: TDependencies,
  ): ComputedSignal<TResult, TDependencies> {
    return new ComputedSignal((...signals) => {
      const args = signals.map(
        (signal) => signal.value,
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
    const size = dependencies.length;

    let version = 1;

    for (let i = 0; i < size; i++) {
      version += dependencies[i]!.version;
    }

    return version - size;
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

export class MemoizedSignal<TResult> extends Signal<TResult> {
  private readonly _signal: Signal<TResult>;

  private _memoizedResult: TResult | null;

  private _memoizedVersion = 0; // 0 is indicated an uninitialized signal.

  constructor(
    signal: Signal<TResult>,
    initialResult: TResult | null = null,
    initialVersion = 0,
  ) {
    super();
    this._signal = signal;
    this._memoizedResult = initialResult;
    this._memoizedVersion = initialVersion;
  }

  get value(): TResult {
    const newVersion = this._signal.version;
    if (this._memoizedVersion < newVersion) {
      this._memoizedResult = this._signal.value;
      this._memoizedVersion = newVersion;
    }
    return this._memoizedResult!;
  }

  get version(): number {
    return this._signal.version;
  }

  subscribe(subscriber: Subscriber): Subscription {
    return this._signal.subscribe(subscriber);
  }
}
