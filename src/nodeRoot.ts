import { Part, PartChild } from './part.js';
import type { Updater } from './updater.js';

export class NodeRoot<TNode extends ChildNode> extends PartChild {
  private _node: TNode;

  private _pendingValue: unknown = null;

  private _memoizedValue: unknown = null;

  constructor(node: TNode) {
    super();
    this._node = node;
  }

  get startNode(): TNode {
    return this._node;
  }

  get endNode(): TNode {
    return this._node;
  }

  get node(): TNode {
    return this._node;
  }

  get value(): unknown {
    return this._memoizedValue;
  }

  set value(newValue: unknown) {
    this._pendingValue = newValue;
  }

  mount(part: Part, _updater: Updater): void {
    const reference = part.node;
    reference.parentNode?.insertBefore(this._node, reference);
  }

  unmount(part: Part, _updater: Updater): void {
    part.node.parentNode?.removeChild(this._node);
  }

  commit(_updater: Updater): void {
    this._node.nodeValue =
      this._pendingValue == null ? null : this._pendingValue.toString();
    this._memoizedValue = this._pendingValue;
  }
}
