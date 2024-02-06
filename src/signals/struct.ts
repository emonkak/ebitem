import { Signal, Subscriber, Subscription } from '../signal.js';

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
    const size = keys.length;

    let version = 1;

    for (let i = 0; i < size; i++) {
      version += value[keys[i]!].version;
    }

    return version - size;
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
