import type { Hook } from './hook.js';
import type { ChildNodePart } from './part.js';
import type { TaskPriority } from './scheduler.js';

export interface Updater<TContext = unknown> {
  getCurrentComponent(): Component<TContext> | null;
  getCurrentPriority(): TaskPriority;
  isUpdating(): boolean;
  waitForUpdate(): Promise<void>;
  enqueueComponent(component: Component<TContext>): void;
  enqueueLayoutEffect(effect: Effect): void;
  enqueueMutationEffect(effect: Effect): void;
  enqueuePassiveEffect(effect: Effect): void;
  scheduleUpdate(): void;
}

export interface Component<TContext = unknown> {
  get dirty(): boolean;
  get parent(): Component<TContext> | null;
  get priority(): TaskPriority;
  render(scope: Scope<TContext>, updater: Updater<TContext>): void;
  requestUpdate(updater: Updater<TContext>, priority: TaskPriority): void;
}

export interface Scope<TContext> {
  getVariable(key: PropertyKey, component: Component<TContext>): unknown;
  setVariable(
    key: PropertyKey,
    value: unknown,
    component: Component<TContext>,
  ): void;
  startContext(
    component: Component<TContext>,
    hooks: Hook[],
    updater: Updater<TContext>,
  ): TContext;
  finishContext(context: TContext): void;
  createHTMLTemplate(
    tokens: ReadonlyArray<string>,
    data: unknown[],
  ): Template<unknown[], TContext>;
  createSVGTemplate(
    tokens: ReadonlyArray<string>,
    data: unknown[],
  ): Template<unknown[], TContext>;
}

export interface Template<TData, TContext = unknown> {
  hydrate(
    data: TData,
    updater: Updater<TContext>,
  ): TemplateFragment<TData, TContext>;
  sameTemplate(other: Template<TData, TContext>): boolean;
}

export interface TemplateFragment<TData, TContext = unknown> {
  get startNode(): ChildNode | null;
  get endNode(): ChildNode | null;
  update(data: TData, updater: Updater<TContext>): void;
  detach(part: ChildNodePart, updater: Updater): void;
  mount(part: ChildNodePart): void;
  unmount(part: ChildNodePart): void;
  disconnect(): void;
}

export interface Effect {
  commit(): void;
}
