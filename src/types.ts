export interface Updater<TContext = unknown> {
  get currentRenderable(): Renderable<TContext> | null;
  enqueueLayoutEffect(effect: Effect): void;
  enqueueMutationEffect(effect: Effect): void;
  enqueuePassiveEffect(effect: Effect): void;
  enqueueRenderable(renderable: Renderable<TContext>): void;
  requestUpdate(): void;
}

export interface Renderable<TContext = unknown> {
  get dirty(): boolean;
  get parent(): Renderable<TContext> | null;
  forceUpdate(updater: Updater<TContext>): void;
  render(updater: Updater<TContext>, scope: Scope<TContext>): void;
}

export type CommitMode = 'mutation' | 'layout' | 'passive';

export interface Effect {
  commit(mode: CommitMode): void;
}

export interface Scope<TContext = unknown> {
  getVariable(key: PropertyKey, renderable: Renderable<TContext>): unknown;

  setVariable(
    key: PropertyKey,
    value: unknown,
    renderable: Renderable<TContext>,
  ): void;

  createContext(
    renderable: Renderable<TContext>,
    hooks: Hook[],
    updater: Updater<TContext>,
  ): TContext;

  createHTMLTemplate(
    tokens: ReadonlyArray<string>,
    values: unknown[],
  ): Template;

  createSVGTemplate(tokens: ReadonlyArray<string>, values: unknown[]): Template;
}

export interface Template {
  hydrate(values: unknown[], updater: Updater): TemplateRoot;
}

export interface TemplateRoot {
  get childNodes(): ChildNode[];
  patch(values: unknown[], updater: Updater): void;
  mount(part: ChildNodePart): void;
  unmount(part: ChildNodePart): void;
  disconnect(): void;
}

export type Part =
  | AttributePart
  | ChildNodePart
  | ElementPart
  | EventPart
  | NodePart
  | PropertyPart;

export type NamedPart = AttributePart | EventPart | PropertyPart;

export interface AttributePart {
  type: 'attribute';
  node: Element;
  name: string;
}

export interface ChildNodePart {
  type: 'childNode';
  node: ChildNode;
}

export interface ElementPart {
  type: 'element';
  node: Element;
}

export interface EventPart {
  type: 'event';
  node: Element;
  name: string;
}

export interface PropertyPart {
  type: 'property';
  node: Element;
  name: string;
}

export interface NodePart {
  type: 'node';
  node: ChildNode;
}

export type Hook = EffectHook | MemoHook | ReducerHook;

export interface EffectHook {
  type: 'effect';
  callback: EffectCallback;
  cleanup: Cleanup | void;
  dependencies: unknown[] | undefined;
}

export interface MemoHook<T = any> {
  type: 'memo';
  value: T;
  dependencies: unknown[] | undefined;
}

export interface ReducerHook<TState = any, TAction = any> {
  type: 'reducer';
  dispatch: (action: TAction) => void;
  state: TState;
}

export type Cleanup = () => void;

export type EffectCallback = () => Cleanup | void;

export type Ref<T> = RefCallback<T> | RefObject<T>;

export type RefCallback<T> = (value: T) => void;

export interface RefObject<T> {
  current: T;
}
