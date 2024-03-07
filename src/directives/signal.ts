import {
  BindValueOf,
  Binding,
  Directive,
  Part,
  createBinding,
  directiveTag,
  updateBinding,
} from '../part.js';
import type { Scope } from '../scope.js';
import type { Signal, Subscription } from '../signal.js';
import { Disconnect, Renderable, Updater } from '../updater.js';

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

  private _renderer: SignalRenderer<T> | null = null;

  private _subscription: Subscription | null = null;

  constructor(part: Part) {
    this._part = part;
  }

  get part(): Part {
    return this.part;
  }

  get startNode(): ChildNode {
    return this._renderer?.startNode ?? this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  bind(signal: Signal<T>, updater: Updater): void {
    if (this._renderer !== null && this._renderer.signal !== signal) {
      this._subscription?.();
      this._renderer.forceUnmount(updater);
      this._renderer = null;
    }

    if (this._renderer !== null) {
      this._renderer.forceUpdate(updater);
    } else {
      const newValue = signal.value;
      const binding = createBinding(this._part, newValue, updater);
      const renderer = new SignalRenderer(
        binding,
        signal,
        newValue,
        updater.currentRenderable,
      );

      this._subscription = signal.subscribe(() => {
        renderer.forceUpdate(updater);
      });
      this._renderer = renderer;
    }
  }

  unbind(updater: Updater) {
    this._subscription?.();
    this._subscription = null;
    this._renderer?.forceUpdate(updater);
  }

  disconnect(): void {
    this._subscription?.();
    this._subscription = null;
    this._renderer?.disconnect();
    this._renderer = null;
  }
}

class SignalRenderer<T> implements Renderable {
  private readonly _signal: Signal<T>;

  private readonly _parent: Renderable | null;

  private _binding: Binding<BindValueOf<T>>;

  private _value: T;

  private _dirty = false;

  constructor(
    binding: Binding<BindValueOf<T>>,
    signal: Signal<T>,
    initialValue: T,
    parent: Renderable | null,
  ) {
    this._binding = binding;
    this._signal = signal;
    this._value = initialValue;
    this._parent = parent;
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

  get signal(): Signal<T> {
    return this._signal;
  }

  get parent(): Renderable | null {
    return this._parent;
  }

  get dirty(): boolean {
    return this._dirty;
  }

  forceUpdate(updater: Updater): void {
    if (!this._dirty) {
      updater.enqueueRenderable(this);
      updater.requestUpdate();
      this._dirty = true;
    }
  }

  forceUnmount(updater: Updater): void {
    if (!this._dirty) {
      updater.enqueuePassiveEffect(new Disconnect(this._binding));
      this._dirty = true;
    }
  }

  render(updater: Updater, _scope: Scope): void {
    const newValue = this._signal.value;
    this._binding = updateBinding(
      this._binding!,
      this._value,
      newValue,
      updater,
    );
    this._value = newValue;
  }

  disconnect(): void {
    this._binding.disconnect();
  }
}
