import { LinkedList } from './linkedList.js';

export type Subscriber = () => void;

export type Subscription = () => void;

type UnwrapSignals<T> = T extends Array<any>
  ? { [P in keyof T]: UnwrapSignal<T[P]> }
  : never;

type UnwrapSignal<T> = T extends Signal<infer V> ? V : never;

const MUTABLE_ARRAY_METHODS: {
  [P in keyof Omit<Array<any>, keyof ReadonlyArray<any>>]: P;
} = {
  copyWithin: 'copyWithin',
  fill: 'fill',
  pop: 'pop',
  push: 'push',
  reverse: 'reverse',
  shift: 'shift',
  sort: 'sort',
  splice: 'splice',
  unshift: 'unshift',
};

export abstract class Signal<T> {
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
}

export class ArraySignal<T> extends Signal<T[]> {
  private readonly _subscribers = new LinkedList<Subscriber>();

  private _values: T[];

  private _version = 1;

  private _isMutating = false;

  constructor(initialValues: T[]) {
    super();
    this._values = initialValues;
  }

  get value(): T[] {
    return new Proxy(this._values, {
      get: (target: T[], p: string | symbol, _receiver: any): any => {
        if (p in MUTABLE_ARRAY_METHODS) {
          return (...args: any[]): any => {
            this._isMutating = true;
            try {
              const result = (target[p as any] as Function)(...args);
              this._notifyChange();
              return result;
            } finally {
              this._isMutating = false;
            }
          };
        }
        return target[p as keyof T[]];
      },
      set: (
        target: T[],
        p: string | symbol,
        newValue: any,
        _receiver: any,
      ): boolean => {
        target[p as any] = newValue;
        if (!this._isMutating) {
          this._notifyChange();
        }
        return true;
      },
      deleteProperty: (target: T[], p: string | symbol): boolean => {
        delete target[p as keyof T[]];
        if (!this._isMutating) {
          this._notifyChange();
        }
        return true;
      },
    });
  }

  set value(newValues: T[]) {
    this._values = newValues;
    this._notifyChange();
  }

  get version(): number {
    return this._version;
  }

  batch(update: (values: T[]) => boolean): void {
    if (update(this._values)) {
      this._notifyChange();
    }
  }

  subscribe(subscriber: Subscriber): Subscription {
    const node = this._subscribers.pushBack(subscriber);
    return () => {
      this._subscribers.remove(node);
    };
  }

  private _notifyChange(): void {
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

  static compose<TResult, TDependencies extends Signal<any>[]>(
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

  private _memoizedResult: T | null;

  private _memoizedVersion = 0; // 0 is indicated an uninitialized signal.

  constructor(
    signal: Signal<T>,
    initialResult: T | null = null,
    initialVersion = 0,
  ) {
    super();
    this._signal = signal;
    this._memoizedResult = initialResult;
    this._memoizedVersion = initialVersion;
  }

  get value(): T {
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

export class StructSignal<
  T extends { [P in keyof T]: Signal<any> },
> extends Signal<T> {
  private readonly _value: T;

  constructor(value: T) {
    super();
    this._value = value;
  }

  get value(): T {
    return this._value;
  }

  get version(): number {
    const value = this._value;
    const keys = Object.keys(value) as (keyof T)[];

    let version = 1;

    for (let i = 0, l = keys.length; i < l; i++) {
      version += value[keys[i]!].version - 1;
    }

    return version;
  }

  subscribe(subscriber: Subscriber): Subscription {
    const value = this._value;
    const keys = Object.keys(value) as (keyof T)[];
    const subscriptions = new Array(keys.length);

    for (let i = 0, l = keys.length; i < l; i++) {
      const key = keys[i]!;
      subscriptions[i] = value[key].subscribe(subscriber);
    }

    return () => {
      for (let i = 0, l = subscriptions.length; i < l; i++) {
        subscriptions[i]();
      }
    };
  }
}

export class TrackingSignal<
  TResult,
  TObject extends object,
> extends Signal<TResult> {
  private readonly _factory: (source: TObject) => TResult;

  private readonly _object: TObject;

  private _signal: MemoizedSignal<TResult> | null = null;

  constructor(factory: (object: TObject) => TResult, object: TObject) {
    super();
    this._factory = factory;
    this._object = object;
  }

  get value(): TResult {
    if (this._signal === null) {
      this._signal = this._initSignal();
    }
    return this._signal.value;
  }

  get version(): number {
    if (this._signal === null) {
      this._signal = this._initSignal();
    }
    return this._signal.version;
  }

  subscribe(subscriber: Subscriber): Subscription {
    if (this._signal === null) {
      this._signal = this._initSignal();
    }
    return this._signal.subscribe(subscriber);
  }

  private _initSignal(): MemoizedSignal<TResult> {
    const dependencies = new Set<Signal<unknown>>();
    const handler: ProxyHandler<any> = {
      get(target, property, _receiver) {
        const value = target[property];
        if (value instanceof Signal) {
          // Do not analyze nested signals.
          dependencies.add(value);
          return value;
        }
        return typeof value === 'object' ? new Proxy(value, handler) : value;
      },
    };
    const object = new Proxy(this._object, handler);
    const initialResult = this._factory(object);
    const innerSignal = new ComputedSignal<TResult, Signal<unknown>[]>(
      () => this._factory(this._object),
      Array.from(dependencies),
    );
    return new MemoizedSignal(innerSignal, initialResult, innerSignal.version);
  }
}
