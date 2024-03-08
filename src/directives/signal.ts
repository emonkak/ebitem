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
    const { signal } = this._directive;

    this._subscription?.();
    this._subscription = signal.subscribe(() => {
      this._binding = updateBinding(this._binding, signal.value, updater);
    });
  }

  bind(updater: Updater): void {
    const { signal } = this._directive;

    this._subscription?.();
    this._subscription = signal.subscribe(() => {
      this._binding = updateBinding(this._binding, signal.value, updater);
    });

    this._binding = updateBinding(this._binding, signal.value, updater);
  }

  unbind(updater: Updater) {
    this._subscription?.();
    this._subscription = null;

    this._binding.unbind(updater);
  }

  disconnect(): void {
    this._subscription?.();
    this._subscription = null;

    this._binding.disconnect();
  }
}
