import { LinkedList } from './linkedList.js';

export type Subscriber = () => void;

export type Subscription = () => void;

type UnwrapSignals<T> = T extends { [P in keyof T]: Signal<any> }
  ? { [P in keyof T]: UnwrapSignal<T[P]> }
  : never;

type UnwrapSignal<T> = T extends Signal<infer V> ? V : never;

export function array<T>(elements: T[]): ArraySignal<T> {
  return new ArraySignal(elements);
}

export function atom<T>(value: T): AtomSignal<T> {
  return new AtomSignal(value);
}

export function struct<TStruct extends { [P in keyof TStruct]: Signal<any> }>(
  struct: TStruct,
): StructSignal<TStruct> {
  return new StructSignal(struct);
}

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

  valueOf(): T {
    return this.value;
  }
}

export class ArraySignal<T> extends Signal<ReadonlyArray<T>> {
  private readonly _subscribers = new LinkedList<Subscriber>();

  private _elements: T[];

  private _version = 1;

  constructor(initialElements: T[]) {
    super();
    this._elements = initialElements;
  }

  get value(): ReadonlyArray<T> {
    return this._elements;
  }

  set value(newElements: T[]) {
    this._elements = newElements;
    this._notifyChange();
  }

  get version(): number {
    return this._version;
  }

  mutate(mutateFn: (elements: T[]) => boolean | void): void {
    let hasChanged = false;
    const proxy = new Proxy(this._elements, {
      set(
        target: T[],
        property: string | symbol,
        value: any,
        receiver: any,
      ): boolean {
        const result = Reflect.set(target, property, value, receiver);
        if (result) {
          hasChanged = true;
        }
        return result;
      },
      deleteProperty(target: T[], property: string | symbol): boolean {
        const result = Reflect.deleteProperty(target, property);
        if (result) {
          hasChanged = true;
        }
        return result;
      },
    });
    const result = mutateFn(proxy);
    if (result ?? hasChanged) {
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
    factory: (...values: UnwrapSignals<TDependencies>) => TResult,
    dependencies: TDependencies,
  ): ComputedSignal<TResult, TDependencies> {
    return new ComputedSignal((...dependencies) => {
      const values = dependencies.map(
        (dependency) => dependency.value,
      ) as UnwrapSignals<TDependencies>;
      return factory(...values);
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

  private _memoizedValue: T | null;

  private _memoizedVersion = 0; // 0 is indicated an uninitialized signal.

  constructor(
    signal: Signal<T>,
    initialValue: T | null = null,
    initialVersion = 0,
  ) {
    super();
    this._signal = signal;
    this._memoizedValue = initialValue;
    this._memoizedVersion = initialVersion;
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

export class StructSignal<
  TStruct extends { [P in keyof TStruct]: Signal<any> },
> extends Signal<TStruct> {
  private readonly _struct: TStruct;

  constructor(struct: TStruct) {
    super();
    this._struct = struct;
  }

  get value(): Readonly<TStruct> {
    return this._struct;
  }

  get version(): number {
    const struct = this._struct;
    const keys = Object.keys(struct) as (keyof TStruct)[];

    let version = 1;

    for (let i = 0, l = keys.length; i < l; i++) {
      version += struct[keys[i]!].version - 1;
    }

    return version;
  }

  flatten(): UnwrapSignals<TStruct> {
    const flattenStruct = {} as UnwrapSignals<TStruct>;
    const keys = Object.keys(this._struct) as (keyof TStruct)[];

    for (let i = 0, l = keys.length; i < l; i++) {
      const key = keys[i]!;
      flattenStruct[key] = this._struct[key].value;
    }

    return flattenStruct;
  }

  subscribe(subscriber: Subscriber): Subscription {
    const struct = this._struct;
    const keys = Object.keys(struct) as (keyof TStruct)[];
    const subscriptions = new Array(keys.length);

    for (let i = 0, l = keys.length; i < l; i++) {
      const key = keys[i]!;
      subscriptions[i] = struct[key].subscribe(subscriber);
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
  TState extends object,
> extends Signal<TResult> {
  private readonly _factory: (source: TState) => TResult;

  private readonly _state: TState;

  private _signal: MemoizedSignal<TResult> | null = null;

  constructor(factory: (state: TState) => TResult, state: TState) {
    super();
    this._factory = factory;
    this._state = state;
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
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        if (value instanceof Signal) {
          // Do not analyze nested signals.
          dependencies.add(value);
          return value;
        }
        return typeof value === 'object' ? new Proxy(value, handler) : value;
      },
    };
    const proxy = new Proxy(this._state, handler);
    const initialResult = this._factory(proxy);
    const signal = new ComputedSignal<TResult, Signal<unknown>[]>(
      () => this._factory(this._state),
      Array.from(dependencies),
    );
    return new MemoizedSignal(signal, initialResult, signal.version);
  }
}
