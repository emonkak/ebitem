import { mountPart, updatePart } from './part.js';
import { ChildPart, ChildValue, SpreadPart, SpreadProps } from './parts.js';
import type { ScopeInterface } from './scopeInterface.js';
import type { Renderable, Updater } from './updater.js';

const SlotFlag = {
  DIRTY: 0b1,
  MOUNTED: 0b10,
};

interface MountState {
  element: Element;
  spreadPart: SpreadPart;
  childPart: ChildPart;
}

export class Slot<TContext> extends ChildValue implements Renderable<TContext> {
  private readonly _type: string;

  private readonly _parent: Renderable<TContext> | null;

  private _memoizedProps: SpreadProps;

  private _memoizedValue: unknown;

  private _pendingProps: SpreadProps;

  private _pendingValue: unknown;

  private _flags = SlotFlag.DIRTY;

  private _mountState: MountState | null = null;

  constructor(
    type: string,
    props: SpreadProps,
    value: unknown,
    parent: Renderable<TContext> | null,
  ) {
    super();
    this._type = type;
    this._memoizedProps = props;
    this._memoizedValue = value;
    this._pendingProps = props;
    this._pendingValue = value;
    this._parent = parent;
  }

  get endNode(): ChildNode | null {
    return this._mountState?.element ?? null;
  }

  get isDirty(): boolean {
    return (this._flags && SlotFlag.DIRTY) !== 0;
  }

  get parent(): Renderable<TContext> | null {
    return this._parent;
  }

  get props(): SpreadProps {
    return this._memoizedProps;
  }

  get startNode(): ChildNode | null {
    return this._mountState?.element ?? null;
  }

  get type(): string {
    return this._type;
  }

  get value(): unknown {
    return this._memoizedValue;
  }

  setProps(newProps: SpreadProps): void {
    this._pendingProps = newProps;
  }

  setValue(newValue: unknown): void {
    this._pendingValue = newValue;
  }

  forceUpdate(updater: Updater<TContext>): void {
    if (
      (this._flags & SlotFlag.MOUNTED) === 0 ||
      (this._flags & SlotFlag.DIRTY) !== 0
    ) {
      return;
    }

    this._flags |= SlotFlag.DIRTY;
    updater.enqueueRenderable(this);
    updater.requestUpdate();
  }

  render(updater: Updater<TContext>, _scope: ScopeInterface<TContext>): void {
    if (this._mountState !== null) {
      const { childPart, spreadPart } = this._mountState;
      updatePart(spreadPart, this._pendingProps, this._memoizedProps, updater);
      updatePart(childPart, this._pendingValue, this._memoizedValue, updater);
    } else {
      const element = document.createElement(this._type);
      const marker = document.createComment('');
      const childPart = new ChildPart(marker);
      const spreadPart = new SpreadPart(element);

      element.appendChild(marker);

      mountPart(spreadPart, this._pendingProps, updater);
      mountPart(childPart, this._pendingValue, updater);

      this._mountState = {
        element,
        childPart,
        spreadPart,
      };
    }

    this._flags &= ~SlotFlag.DIRTY;
    this._memoizedProps = this._pendingProps;
    this._memoizedValue = this._pendingValue;
  }

  mount(part: ChildPart, _updater: Updater): void {
    if (this._mountState !== null) {
      part.endNode.parentNode?.insertBefore(
        this._mountState.element,
        part.endNode,
      );
    }

    this._flags |= SlotFlag.MOUNTED;
  }

  unmount(_part: ChildPart, updater: Updater): void {
    if (this._mountState !== null) {
      const { spreadPart, childPart, element } = this._mountState;
      childPart.disconnect(updater);
      spreadPart.disconnect(updater);
      element.remove();
      this._mountState = null;
    }

    this._flags &= ~SlotFlag.MOUNTED;
  }

  update(_part: ChildPart, _updater: Updater): void {}
}
