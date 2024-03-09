import {
  Binding,
  Directive,
  createBinding,
  directiveTag,
  updateBinding,
} from '../binding.js';
import type { Signal, Subscription } from '../signal.js';
import type { Part, Updater } from '../types.js';

export function signal<T>(value: Signal<T>): SignalDirective<T> {
  return new SignalDirective(value);
}

export class SignalDirective<T> implements Directive<Signal<T>> {
  private _signal: Signal<T>;

  constructor(signal: Signal<T>) {
    this._signal = signal;
  }

  get signal(): Signal<T> {
    return this._signal;
  }

  [directiveTag](part: Part, updater: Updater): SignalBinding<T> {
    const innerBinding = createBinding(part, this._signal.value, updater);
    const binding = new SignalBinding(innerBinding, this);

    binding.init(updater);

    return binding;
  }
}

export class SignalBinding<T> implements Binding<SignalDirective<T>> {
  private _binding: Binding<T>;

  private _directive: SignalDirective<T>;

  private _subscription: Subscription | null = null;

  constructor(binding: Binding<T>, directive: SignalDirective<T>) {
    this._binding = binding;
    this._directive = directive;
  }

  get part(): Part {
    return this._binding.part;
  }

  get startNode(): ChildNode {
    return this._binding.startNode;
  }

  get endNode(): ChildNode {
    return this._binding.endNode;
  }

  get value(): SignalDirective<T> {
    return this._directive;
  }

  set value(directive: SignalDirective<T>) {
    this._directive = directive;
  }

  init(updater: Updater): void {
    if (this._subscription === null) {
      this._subscription = this._startSubscription(updater);
    }
  }

  bind(updater: Updater): void {
    const { signal } = this._directive;

    this._binding = updateBinding(this._binding, signal.value, updater);

    if (this._subscription === null) {
      this._subscription = this._startSubscription(updater);
    }
  }

  unbind(updater: Updater) {
    this._binding.unbind(updater);

    this._subscription?.();
    this._subscription = null;
  }

  disconnect(): void {
    this._binding.disconnect();
  }

  private _startSubscription(updater: Updater): Subscription {
    const { signal } = this._directive;
    const weakThis = new WeakRef(this);

    const subscription = signal.subscribe(() => {
      const that = weakThis.deref();

      if (that !== undefined) {
        // FIXME: The binding will be updated with the new value whether or not
        // the target is connected to the document. Is is just a performance
        // issue?
        that._binding = updateBinding(
          that._binding,
          that._directive.signal.value,
          updater,
        );
      } else {
        // The signal will be automatically unsubscribed when this
        // SignalBinding is garbage-collected.
        subscription();
      }
    });

    return subscription;
  }
}
