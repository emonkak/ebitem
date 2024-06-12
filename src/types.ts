import type { Hook } from './hook.js';
import type { ChildNodePart } from './part.js';
import type { TaskPriority } from './scheduler.js';

export interface RenderingEngine<TContext> {
  flushEffects(effects: Effect[], mode: EffectMode): void;
  getHTMLTemplate(
    tokens: ReadonlyArray<string>,
    data: unknown[],
  ): Template<unknown[], TContext>;
  getSVGTemplate(
    tokens: ReadonlyArray<string>,
    data: unknown[],
  ): Template<unknown[], TContext>;
  getVariable(key: PropertyKey, component: Component<TContext>): unknown;
  renderBlock<TProps, TData>(
    block: Block<TProps, TData, TContext>,
    props: TProps,
    hooks: Hook[],
    component: Component<TContext>,
    updater: Updater<TContext>,
  ): TemplateResult<TData, TContext>;
  setVariable(
    key: PropertyKey,
    value: unknown,
    component: Component<TContext>,
  ): void;
}

export interface Updater<TContext = unknown> {
  getCurrentComponent(): Component<TContext> | null;
  getCurrentPriority(): TaskPriority;
  isScheduled(): boolean;
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
  shouldUpdate(): boolean;
  update(engine: RenderingEngine<TContext>, updater: Updater<TContext>): void;
  requestUpdate(priority: TaskPriority, updater: Updater<TContext>): void;
}

export type Block<TProps, TData, TContext> = (
  props: TProps,
  context: TContext,
) => TemplateResult<TData, TContext>;

export interface Template<TData, TContext = unknown> {
  hydrate(
    data: TData,
    updater: Updater<TContext>,
  ): TemplateFragment<TData, TContext>;
  isSameTemplate(other: Template<TData, TContext>): boolean;
}

export interface TemplateFragment<TData, TContext = unknown> {
  get startNode(): ChildNode | null;
  get endNode(): ChildNode | null;
  bind(data: TData, updater: Updater<TContext>): void;
  unbind(updater: Updater): void;
  mount(part: ChildNodePart): void;
  unmount(part: ChildNodePart): void;
  disconnect(): void;
}

export interface TemplateResult<TData, TContext> {
  get template(): Template<TData, TContext>;
  get data(): TData;
}

export interface Effect {
  commit(mode: EffectMode): void;
}

export type EffectMode = 'mutation' | 'layout' | 'passive';
