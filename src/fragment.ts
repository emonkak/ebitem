import { ChildNodePart } from './part.js';
import type { Scope } from './scope.js';
import type { Template } from './template.js';
import type { TemplateRoot } from './templateRoot.js';
import { CommitMode, Effect, Renderable, Updater } from './updater.js';

const FragmentFlags = {
  NONE: 0,
  UPDATING: 1 << 0,
  MUTATING: 1 << 1,
  UNMOUNTING: 1 << 2,
  MOUNTED: 1 << 3,
};

export class Fragment implements Effect, Renderable {
  private readonly _template: Template;

  private readonly _part: ChildNodePart;

  private readonly _parent: Renderable | null;

  private _values: unknown[];

  private _root: TemplateRoot | null = null;

  private _flags = FragmentFlags.NONE;

  constructor(
    template: Template,
    values: unknown[],
    part: ChildNodePart = {
      type: 'childNode',
      node: document.createComment(''),
    },
    parent: Renderable | null = null,
  ) {
    this._template = template;
    this._values = values;
    this._part = part;
    this._parent = parent;
  }

  get template(): Template {
    return this._template;
  }

  get values(): unknown[] {
    return this._values;
  }

  get part(): ChildNodePart {
    return this._part;
  }

  get parent(): Renderable | null {
    return this._parent;
  }

  get dirty(): boolean {
    return !!(
      this._flags & FragmentFlags.UPDATING ||
      this._flags & FragmentFlags.UNMOUNTING
    );
  }

  get isMounted(): boolean {
    return !!(this._flags & FragmentFlags.MOUNTED);
  }

  get root(): TemplateRoot | null {
    return this._root;
  }

  set values(newValues: unknown[]) {
    this._values = newValues;
  }

  forceUpdate(updater: Updater): void {
    if (
      this._flags & FragmentFlags.UPDATING ||
      this._flags & FragmentFlags.UNMOUNTING
    ) {
      return;
    }

    this._flags |= FragmentFlags.UPDATING;

    updater.enqueueRenderable(this);
    updater.requestUpdate();
  }

  forceUnmount(updater: Updater): void {
    if (!(this._flags & FragmentFlags.MUTATING)) {
      updater.enqueueMutationEffect(this);
    }

    if (!(this._flags & FragmentFlags.UNMOUNTING)) {
      updater.enqueuePassiveEffect(this);
    }

    this._flags |= FragmentFlags.MUTATING | FragmentFlags.UNMOUNTING;
    this._flags &= ~FragmentFlags.UPDATING;
  }

  render(updater: Updater, _scope: Scope): void {
    if (!(this._flags & FragmentFlags.UPDATING)) {
      return;
    }

    if (this._root !== null) {
      this._root.patch(this._values, updater);
    } else {
      this._root = this._template.hydrate(this._values, updater);

      if (!(this._flags & FragmentFlags.MUTATING)) {
        updater.enqueueMutationEffect(this);
      }

      this._flags |= FragmentFlags.MUTATING;
    }

    this._flags &= ~FragmentFlags.UPDATING;
  }

  commit(mode: CommitMode): void {
    switch (mode) {
      case 'mutation':
        if (this._flags & FragmentFlags.UNMOUNTING) {
          this._root?.unmount(this._part);
          this._flags &= ~FragmentFlags.MOUNTED;
        } else {
          this._root?.mount(this._part);
          this._flags |= FragmentFlags.MOUNTED;
        }
        this._flags &= ~FragmentFlags.MUTATING;
        break;
      case 'passive':
        this._root?.disconnect();
        this._flags &= ~FragmentFlags.UNMOUNTING;
    }
  }

  disconnect(): void {
    this._root?.disconnect();
  }
}
