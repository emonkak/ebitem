import { Slab } from './slab';

// 0 is reserved to indicate an uninitialized signal.
let globalVersionCounter = 1;

export type Subscriber = () => void;

export type Subscription = () => void;

type WrapSignals<T> = T extends Array<any>
  ? { [P in keyof T]: Signal<T[P]> }
  : never;

export abstract class Signal<T> {
  abstract get value(): T;

  abstract get version(): number;

  abstract subscribe(_subscriber: Subscriber): Subscription;

  map<TResult>(selector: (value: T) => TResult): ProjectedSignal<T, TResult> {
    return new ProjectedSignal(this, selector);
  }

  memoized(): MemoizedSignal<(value: T) => T> {
    return new MemoizedSignal((value) => value, [this]);
  }
}

export class AtomSignal<T> extends Signal<T> {
  private readonly _subscribers: Slab<Subscriber> = new Slab();

  private _value: T;

  private _version: number;

  constructor(initialValue: T) {
    super();
    this._value = initialValue;
    this._version = globalVersionCounter;
  }

  get value(): T {
    return this._value;
  }

  set value(newValue: T) {
    this._value = newValue;
    this._version = ++globalVersionCounter;

    const subscribers = this._subscribers.values();

    for (let i = 0, l = subscribers.length; i < l; i++) {
      subscribers[i]!();
    }
  }

  get version(): number {
    return this._version;
  }

  subscribe(subscriber: Subscriber): Subscription {
    const slot = this._subscribers.insert(subscriber);
    return () => {
      this._subscribers.remove(slot);
    };
  }
}

export class ProjectedSignal<TValue, TResult> extends Signal<TResult> {
  private readonly _signal: Signal<TValue>;

  private readonly _selector: (value: TValue) => TResult;

  constructor(signal: Signal<TValue>, selector: (value: TValue) => TResult) {
    super();
    this._signal = signal;
    this._selector = selector;
  }

  get value(): TResult {
    const selector = this._selector;
    return selector(this._signal.value);
  }

  get version(): number {
    return this._signal.version;
  }

  subscribe(subscriber: Subscriber): Subscription {
    return this._signal.subscribe(subscriber);
  }
}

export class MemoizedSignal<
  TFactory extends (...args: any[]) => any,
> extends Signal<ReturnType<TFactory>> {
  private readonly _factory: TFactory;

  private readonly _dependencies: WrapSignals<Parameters<TFactory>>;

  private _memoizedVersion = 0;

  private _memoizedResult: ReturnType<TFactory> | null = null;

  constructor(
    factory: TFactory,
    dependencies: WrapSignals<Parameters<TFactory>>,
  ) {
    super();
    this._factory = factory;
    this._dependencies = dependencies;
  }

  get value(): ReturnType<TFactory> {
    const newVersion = this.version;
    if (this._memoizedVersion < newVersion) {
      const memoizedFn = this._factory;
      const newValues = this._dependencies.map(
        (dependency) => dependency.value,
      );
      this._memoizedVersion = newVersion;
      this._memoizedResult = memoizedFn(...newValues);
    }
    return this._memoizedResult!;
  }

  get version(): number {
    return this._dependencies.reduce(
      (version, dependency) => Math.max(version, dependency.version),
      0,
    );
  }

  subscribe(subscriber: () => void): Subscription {
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
