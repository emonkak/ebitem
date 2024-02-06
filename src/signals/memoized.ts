import { Signal, Subscriber, Subscription } from '../signal.js';

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
