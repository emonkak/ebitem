import { disconnectDirective } from '../directive.js';
import type { Part } from '../part.js';
import type { Updater } from '../updater.js';

export class NodePart implements Part {
  private readonly _node: ChildNode;

  private _pendingValue: unknown | null = null;

  private _memoizedValue: unknown | null = null;

  private _dirty = false;

  constructor(node: ChildNode) {
    this._node = node;
  }

  get node(): ChildNode {
    return this._node;
  }

  get value(): unknown {
    return this._memoizedValue;
  }

  set value(newValue: unknown) {
    this._pendingValue = newValue;
    this._dirty = true;
  }

  get dirty(): boolean {
    return this._dirty;
  }

  commit(_updater: Updater): void {
    const newValue = this._pendingValue;

    this._node.nodeValue = newValue == null ? null : newValue.toString();

    this._memoizedValue = newValue;
    this._dirty = false;
  }

  disconnect(updater: Updater): void {
    disconnectDirective(this, updater);
  }
}
