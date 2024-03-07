import { Binding, Part, updateBinding } from './part.js';
import type { Updater } from './updater.js';

export class TemplateRoot {
  private readonly _bindings: Binding<unknown>[];

  private readonly _childNodes: ChildNode[];

  private _values: unknown[];

  private _isMounted = false;

  constructor(
    bindings: Binding<unknown>[],
    values: unknown[],
    childNodes: ChildNode[],
  ) {
    this._bindings = bindings;
    this._values = values;
    this._childNodes = childNodes;
  }

  get childNodes(): ChildNode[] {
    return this._childNodes;
  }

  get bindings(): Binding<unknown>[] {
    return this._bindings;
  }

  get values(): Binding<unknown>[] {
    return this._bindings;
  }

  get isMounted(): boolean {
    return this._isMounted;
  }

  patch(newValues: unknown[], updater: Updater): void {
    for (let i = 0, l = this._bindings.length; i < l; i++) {
      this._bindings[i] = updateBinding(
        this._bindings[i]!,
        this._values[i],
        newValues[i],
        updater,
      );
    }
    this._values = newValues;
  }

  mount(part: Part): void {
    const reference = part.node;

    for (let i = 0, l = this._childNodes.length; i < l; i++) {
      reference.before(this._childNodes[i]!);
    }

    this._isMounted = true;
  }

  unmount(_part: Part): void {
    for (let i = 0, l = this._childNodes.length; i < l; i++) {
      this._childNodes[i]!.remove();
    }

    this._isMounted = false;
  }

  disconnect(): void {
    for (let i = 0, l = this._bindings.length; i < l; i++) {
      this._bindings[i]!.disconnect();
    }
  }
}
