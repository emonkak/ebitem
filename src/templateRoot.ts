import { Binding, Part, checkAndUpdateBinding } from './part.js';
import type { Updater } from './updater.js';

export class TemplateRoot {
  private _bindings: Binding<unknown>[];

  private _values: unknown[];

  private _childNodes: ChildNode[];

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

  patch(newValues: unknown[], updater: Updater): void {
    for (let i = 0, l = this._bindings.length; i < l; i++) {
      this._bindings[i] = checkAndUpdateBinding(
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
  }

  unmount(_part: Part): void {
    for (let i = 0, l = this._childNodes.length; i < l; i++) {
      this._childNodes[i]!.remove();
    }
  }

  disconnect(): void {
    for (let i = 0, l = this._bindings.length; i < l; i++) {
      this._bindings[i]!.disconnect();
    }
  }
}
