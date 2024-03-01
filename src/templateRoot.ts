import { Part, PartChild } from './part.js';
import type { Updater } from './updater.js';

export class TemplateRoot extends PartChild {
  private _childNodes: ChildNode[];

  private _parts: Part[];

  constructor(childNodes: ChildNode[], parts: Part[]) {
    super();
    this._childNodes = childNodes;
    this._parts = parts;
  }

  get startNode(): ChildNode | null {
    return this._childNodes.length > 0 ? this._childNodes[0]! : null;
  }

  get endNode(): ChildNode | null {
    return this._childNodes.length > 0
      ? this._childNodes[this._childNodes.length - 1]!
      : null;
  }

  get childNodes(): ChildNode[] {
    return this._childNodes;
  }

  get parts(): Part[] {
    return this._parts;
  }

  mount(part: Part, _updater: Updater): void {
    const reference = part.node;
    const { parentNode } = reference;

    if (parentNode !== null) {
      for (let i = 0, l = this._childNodes.length; i < l; i++) {
        parentNode.insertBefore(this._childNodes[i]!, reference);
      }
    }
  }

  unmount(part: Part, updater: Updater): void {
    const { parentNode } = part.node;

    if (parentNode !== null) {
      for (let i = 0, l = this._childNodes.length; i < l; i++) {
        parentNode.removeChild(this._childNodes[i]!);
      }
    }

    for (let i = 0, l = this._parts.length; i < l; i++) {
      this._parts[i]!.disconnect(updater);
    }
  }

  commit(updater: Updater): void {
    for (let i = 0, l = this._parts.length; i < l; i++) {
      this._parts[i]!.commit(updater);
    }
  }
}
