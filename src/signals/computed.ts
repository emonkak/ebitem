import { Signal, Subscriber, Subscription } from '../signal.js';

type UnwrapSignals<T> = T extends Array<any>
  ? { [P in keyof T]: UnwrapSignal<T[P]> }
  : never;

type UnwrapSignal<T> = T extends Signal<infer V> ? V : never;

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
