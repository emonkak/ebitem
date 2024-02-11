import { LinkedList } from '../linkedList.js';
import { Signal, Subscriber, Subscription } from '../signal.js';

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
