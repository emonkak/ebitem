import type { Context } from './context';
import { Directive, directiveSymbol } from './directive';
import { AttributePart, AttributeValue, ChildPart, ChildValue } from './part';
import type { Part } from './types';

// 0 is reserved to indicate an uninitialized signal.
let globalVersionCounter = 1;

type Subscriber = () => void;

type Subscription = () => void;

type MapSignal<T> = T extends Array<any>
  ? { [P in keyof T]: Signal<T[P]> }
  : never;

export abstract class Signal<T> implements Directive {
  abstract get value(): T;

  abstract get version(): number;

  abstract subscribe(_subscriber: Subscriber): Subscription;

  [directiveSymbol](part: Part, context: Context): void {
    if (part instanceof AttributePart) {
      if (part.value instanceof SignalAttribute && part.value.signal === this) {
        return;
      }

      part.setValue(new SignalAttribute(this));

      context.pushMutationEffect(part);
    } else if (part instanceof ChildPart) {
      if (part.value instanceof SignalChild && part.value.signal === this) {
        return;
      }

      part.setValue(new SignalChild(this));

      context.pushMutationEffect(part);
    }

    throw new Error(
      '"Signal" directive must be used in an attribute or an arbitrary child.',
    );
  }

  map<TResult>(selector: (value: T) => TResult): ProjectedSignal<T, TResult> {
    return new ProjectedSignal(this, selector);
  }

  memoized(): MemoizedSignal<(value: T) => T> {
    return new MemoizedSignal((value) => value, [this]);
  }
}

export class AtomSignal<T> extends Signal<T> {
  private readonly _subscribers: Subscriber[] = [];

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
    for (let i = 0, l = this._subscribers.length; i < l; i++) {
      this._subscribers[i]!();
      this._version = ++globalVersionCounter;
    }
  }

  get version(): number {
    return this._version;
  }

  subscribe(subscriber: Subscriber): Subscription {
    this._subscribers.push(subscriber);
    return () => {
      const i = this._subscribers.indexOf(subscriber);
      if (i >= 0) {
        this._subscribers.splice(i, 1);
      }
    };
  }
}

export class ProjectedSignal<TValue, TResult> extends Signal<TResult> {
  private readonly _signal: Signal<TValue>;

  private readonly _selectorFn: (value: TValue) => TResult;

  constructor(signal: Signal<TValue>, selectorFn: (value: TValue) => TResult) {
    super();
    this._signal = signal;
    this._selectorFn = selectorFn;
  }

  get value(): TResult {
    const selectorFn = this._selectorFn;
    return selectorFn(this._signal.value);
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

  private readonly _dependencies: MapSignal<Parameters<TFactory>>;

  private _memoizedVersion = 0;

  private _memoizedResult: ReturnType<TFactory> | null = null;

  constructor(
    factory: TFactory,
    dependencies: MapSignal<Parameters<TFactory>>,
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

class SignalChild<T> extends ChildValue {
  private readonly _signal: Signal<T>;

  private _value: ChildValue;

  private _subscription: Subscription | null = null;

  constructor(signal: Signal<T>) {
    super();
    this._signal = signal;
    this._value = ChildValue.upgrade(signal.value, null);
  }

  get signal(): Signal<T> {
    return this._signal;
  }

  get startNode(): ChildNode | null {
    return this._value.startNode;
  }

  get endNode(): ChildNode | null {
    return this._value.endNode;
  }

  mount(part: ChildPart, context: Context): void {
    this._subscription = this._signal.subscribe(() => {
      this._value = ChildValue.upgrade(this._signal.value, this._value);
      context.pushMutationEffect(part);
      context.requestMutations();
    });
  }

  unmount(_part: ChildPart, _context: Context): void {
    if (this._subscription) {
      this._subscription();
      this._subscription = null;
    }
  }

  update(part: ChildPart, context: Context): void {
    this._value.update(part, context);
  }
}

class SignalAttribute<T> extends AttributeValue {
  private readonly _signal: Signal<T>;

  private _value: AttributeValue;

  private _subscription: Subscription | null = null;

  constructor(signal: Signal<T>) {
    super();
    this._signal = signal;
    this._value = AttributeValue.upgrade(signal.value, null);
  }

  get signal(): Signal<T> {
    return this._signal;
  }

  mount(part: AttributePart, context: Context): void {
    this._subscription = this._signal.subscribe(() => {
      this._value = AttributeValue.upgrade(this._signal.value, this._value);
      context.pushMutationEffect(part);
      context.requestMutations();
    });
  }

  unmount(_part: AttributePart, _context: Context): void {
    if (this._subscription) {
      this._subscription();
      this._subscription = null;
    }
  }

  update(part: AttributePart, context: Context): void {
    this._value.update(part, context);
  }
}
