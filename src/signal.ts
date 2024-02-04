import { LinkedList } from './linkedList.js';

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
      node.value();
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

  private _memoizedVersion = 0; // 0 is indicated an uninitialized signal

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
    // The version number is started from 1.
    return this._dependencies.reduce(
      (version, dependency) => version + dependency.version,
      1 - this._dependencies.length,
    );
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
