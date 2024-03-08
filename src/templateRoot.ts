import { Binding, Part, updateBinding } from './part.js';
import type { Updater } from './updater.js';

export class TemplateRoot {
  private readonly _bindings: Binding<unknown>[];

  private readonly _childNodes: ChildNode[];

  constructor(bindings: Binding<unknown>[], childNodes: ChildNode[]) {
    this._bindings = bindings;
    this._childNodes = childNodes;
  }

  get childNodes(): ChildNode[] {
    return this._childNodes;
  }

  get bindings(): Binding<unknown>[] {
    return this._bindings;
  }

  patch(newValues: unknown[], updater: Updater): void {
    for (let i = 0, l = this._bindings.length; i < l; i++) {
      this._bindings[i] = updateBinding(
        this._bindings[i]!,
        newValues[i],
        updater,
      );
    }
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
