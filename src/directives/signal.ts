import {
  BindValueOf,
  Binding,
  Directive,
  Part,
  createBinding,
  directiveTag,
  updateBinding,
} from '../part.js';
import type { Signal, Subscription } from '../signal.js';
import type { Updater } from '../updater.js';

export function signal<T>(value: Signal<T>): SignalDirective<T> {
  return new SignalDirective(value);
}

export class SignalDirective<T> implements Directive<Signal<T>> {
  private _signal: Signal<T>;

  constructor(signal: Signal<T>) {
    this._signal = signal;
  }

  [directiveTag](part: Part, updater: Updater): SignalBinding<T> {
    const binding = new SignalBinding<T>(part);

    binding.bind(this._signal, updater);

    return binding;
  }

  valueOf(): Signal<T> {
    return this._signal;
  }
}

export class SignalBinding<T> implements Binding<Signal<T>> {
  private readonly _part: Part;

  private _binding: Binding<BindValueOf<T>> | null = null;

  private _subscription: Subscription | null = null;

  private _value: T | null = null;

  constructor(part: Part) {
    this._part = part;
  }

  get part(): Part {
    return this.part;
  }

  get startNode(): ChildNode {
    return this._binding?.startNode ?? this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  bind(signal: Signal<T>, updater: Updater): void {
    this._subscription?.();

    const newValue = signal.value;

    if (this._binding !== null) {
      this._binding = updateBinding(
        this._binding,
        this._value,
        newValue,
        updater,
      );
    } else {
      this._binding = createBinding(this._part, newValue, updater);
    }

    this._subscription = signal.subscribe(() => {
      const newValue = signal.value;
      this._binding = updateBinding(
        this._binding!,
        this._value,
        newValue,
        updater,
      );
      this._value = newValue;
      updater.requestUpdate();
    });

    this._value = newValue;
  }

  unbind(updater: Updater) {
    this._subscription?.();
    this._subscription = null;
    this._binding?.unbind(updater);
    this._binding = null;
    this._value = null;
  }

  disconnect(): void {
    this._subscription?.();
    this._subscription = null;
    this._binding?.disconnect();
  }
}
