import { Part, PartChild } from './part.js';
import type { Updater } from './updater.js';

export class Text extends PartChild {
  private _node: CharacterData;

  private _pendingValue: unknown = null;

  private _memoizedValue: unknown = null;

  constructor(node: CharacterData) {
    super();
    this._node = node;
  }

  get startNode(): CharacterData {
    return this._node;
  }

  get endNode(): CharacterData {
    return this._node;
  }

  get node(): CharacterData {
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
    this._node.data =
      this._pendingValue == null ? '' : this._pendingValue.toString();
    this._memoizedValue = this._pendingValue;
  }
}
