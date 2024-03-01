import { disconnectDirective } from '../directive.js';
import { NodeRoot } from '../nodeRoot.js';
import { Part, PartChild } from '../part.js';
import type { Updater } from '../updater.js';

export class ChildPart implements Part {
  protected readonly _markerNode: Comment;

  private _memoizedValue: PartChild | null = null;

  private _pendingValue: PartChild | null = null;

  private _dirty = false;

  constructor(markerNode: Comment) {
    this._markerNode = markerNode;
  }

  get node(): Comment {
    return this._markerNode;
  }

  get startNode(): ChildNode {
    return this._memoizedValue instanceof PartChild
      ? this._memoizedValue.startNode ?? this._markerNode
      : this._markerNode;
  }

  get endNode(): ChildNode {
    return this._memoizedValue instanceof PartChild
      ? this._memoizedValue.endNode ?? this._markerNode
      : this._markerNode;
  }

  get value(): PartChild | null {
    return this._memoizedValue;
  }

  get dirty(): boolean {
    return this._dirty;
  }

  set value(newValue: unknown) {
    if (newValue == null) {
      this._pendingValue = null;
    } else if (newValue instanceof PartChild) {
      this._pendingValue = newValue;
    } else {
      const nodeRoot =
        this._memoizedValue instanceof NodeRoot
          ? this._memoizedValue
          : new NodeRoot(document.createTextNode(''));
      nodeRoot.value = newValue;
      this._pendingValue = nodeRoot;
    }
    this._dirty = true;
  }

  commit(updater: Updater): void {
    const oldValue = this._memoizedValue;
    const newValue = this._pendingValue;

    if (oldValue !== newValue) {
      oldValue?.unmount(this, updater);
      newValue?.mount(this, updater);
    }

    newValue?.commit(updater);

    this._memoizedValue = newValue;
    this._dirty = true;
  }

  disconnect(updater: Updater): void {
    disconnectDirective(this, updater);

    this._memoizedValue?.unmount(this, updater);
    this._pendingValue = null;
    this._memoizedValue = null;
    this._dirty = false;
  }
}
