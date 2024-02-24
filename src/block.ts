import { Hook } from './hook.js';
import { ChildPart, ChildValue } from './parts.js';
import type { ScopeInterface } from './scopeInterface.js';
import type { MountPoint, TemplateInterface } from './templateInterface.js';
import type { TemplateResult } from './templateResult.js';
import type { Renderable, Updater } from './updater.js';

export class Block<TProps, TContext>
  extends ChildValue
  implements Renderable<TContext>
{
  private readonly _type: (props: TProps, context: TContext) => TemplateResult;

  private readonly _parent: Renderable<TContext> | null;

  private _pendingProps: TProps;

  private _pendingMountPoint: MountPoint | null = null;

  private _memoizedMountPoint: MountPoint | null = null;

  private _memoizedProps: TProps;

  private _memoizedTemplate: TemplateInterface | null = null;

  private _memoizedValues: unknown[] = [];

  private _memoizedMountPoints: WeakMap<TemplateInterface, MountPoint> | null =
    null;

  private _mountPart: ChildPart | null = null;

  private _hooks: Hook[] = [];

  private _dirty = true;

  constructor(
    type: (props: TProps, context: TContext) => TemplateResult,
    props: TProps,
    parent: Renderable<TContext> | null = null,
  ) {
    super();
    this._type = type;
    this._pendingProps = props;
    this._memoizedProps = props;
    this._parent = parent;
  }

  get startNode(): ChildNode | null {
    return this._memoizedMountPoint?.children[0] ?? null;
  }

  get endNode(): ChildNode | null {
    if (this._memoizedMountPoint !== null) {
      const { children } = this._memoizedMountPoint;
      return children[children.length - 1]!;
    }
    return null;
  }

  get type(): (props: TProps, context: TContext) => TemplateResult {
    return this._type;
  }

  get props(): TProps {
    return this._memoizedProps;
  }

  get parent(): Renderable<TContext> | null {
    return this._parent;
  }

  get hooks(): Hook[] {
    return this._hooks;
  }

  get isDirty(): boolean {
    return this._dirty;
  }

  setProps(newProps: TProps): void {
    this._pendingProps = newProps;
  }

  forceUpdate(updater: Updater<TContext>): void {
    if (this._dirty || this._mountPart === null) {
      return;
    }

    this._dirty = true;

    updater.enqueueRenderable(this);
    updater.requestUpdate();
  }

  render(updater: Updater<TContext>, scope: ScopeInterface<TContext>): void {
    const previousNumberOfHooks = this._hooks.length;
    const render = this._type;
    const context = scope.createContext(this, this._hooks, updater);
    const { template, values } = render(this._pendingProps, context);

    if (this._memoizedMountPoint !== null) {
      if (this._hooks.length !== previousNumberOfHooks) {
        throw new Error(
          'Rendered different number of hooks than during the previous render.',
        );
      }

      if (this._memoizedTemplate !== template) {
        // The new template is different from the previous one. The previous
        // mount point is saved for future renders.
        if (this._memoizedMountPoints !== null) {
          // Since it is rare that different templates are returned, we defer
          // creating mount point caches.
          this._pendingMountPoint =
            this._memoizedMountPoints.get(template) ??
            template.mount(values, updater);
        } else {
          this._memoizedMountPoints = new WeakMap();
          this._pendingMountPoint = template.mount(values, updater);
        }

        // If the memoized mount point exists, the memoized template definitely
        // exists.
        this._memoizedMountPoints.set(
          this._memoizedTemplate!,
          this._memoizedMountPoint,
        );

        // The mount point has been changed, so reconnect to the part.
        this._mountPart!.setValue(this, updater);
        updater.enqueueMutationEffect(this._mountPart!);
      } else {
        template.patch(
          this._memoizedMountPoint.parts,
          this._memoizedValues,
          values,
          updater,
        );
      }
    } else {
      this._pendingMountPoint = template.mount(values, updater);
    }

    this._memoizedProps = this._pendingProps;
    this._memoizedTemplate = template;
    this._memoizedValues = values;
    this._dirty = false;
  }

  mount(part: ChildPart, _updater: Updater): void {
    if (this._pendingMountPoint !== null) {
      connectMountPoint(this._pendingMountPoint, part);
    }

    this._memoizedMountPoint = this._pendingMountPoint;
    this._mountPart = part;
  }

  unmount(_part: ChildPart, updater: Updater): void {
    for (let i = 0, l = this._hooks.length; i < l; i++) {
      const hook = this._hooks[i]!;
      if (hook.type === 'effect' || hook.type === 'layoutEffect') {
        hook.cleanup?.();
      }
    }

    if (this._memoizedMountPoint !== null) {
      disconnectMountPoint(this._memoizedMountPoint, updater);
    }

    this._mountPart = null;
  }

  update(part: ChildPart, updater: Updater): void {
    const oldMountPoint = this._memoizedMountPoint;
    const newMountPoint = this._pendingMountPoint;

    if (newMountPoint !== oldMountPoint) {
      if (oldMountPoint !== null) {
        disconnectMountPoint(oldMountPoint, updater);
      }

      if (newMountPoint !== null) {
        connectMountPoint(newMountPoint, part);
      }

      this._memoizedMountPoint = newMountPoint;
    }
  }
}

function connectMountPoint({ children }: MountPoint, part: ChildPart): void {
  const reference = part.endNode;
  const parent = reference.parentNode;

  if (parent !== null) {
    for (let i = 0, l = children.length; i < l; i++) {
      parent.insertBefore(children[i]!, reference);
    }
  }
}

function disconnectMountPoint(
  { children, parts }: MountPoint,
  updater: Updater,
): void {
  for (let i = 0, l = children.length; i < l; i++) {
    const node = children[i]!;
    node.remove();
  }

  for (let i = 0, l = parts.length; i < l; i++) {
    const part = parts[i]!;
    part.disconnect(updater);
  }
}
