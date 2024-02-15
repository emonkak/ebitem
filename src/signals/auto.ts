import {
  ComputedSignal,
  MemoizedSignal,
  Signal,
  Subscriber,
  Subscription,
} from '../signal.js';

export class AutoSignal<
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
