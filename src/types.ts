export interface Updater<TContext = unknown> {
  get currentRenderable(): Renderable<TContext> | null;
  enqueueLayoutEffect(effect: Effect): void;
  enqueueMutationEffect(effect: Effect): void;
  enqueuePassiveEffect(effect: Effect): void;
  enqueueRenderable(renderable: Renderable<TContext>): void;
  scheduleUpdate(): void;
}

export interface Renderable<TContext = unknown> {
  get dirty(): boolean;
  get parent(): Renderable<TContext> | null;
  requestUpdate(updater: Updater<TContext>): void;
  render(updater: Updater<TContext>, scope: AbstractScope<TContext>): void;
}

export enum CommitMode {
  Mutation,
  Layout,
  Passive,
}

export interface Effect {
  commit(mode: CommitMode): void;
}

export interface AbstractScope<TContext = unknown> {
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
  ): AbstractTemplate;

  createSVGTemplate(
    tokens: ReadonlyArray<string>,
    values: unknown[],
  ): AbstractTemplate;
}

export interface AbstractTemplate {
  hydrate(values: unknown[], updater: Updater): AbstractTemplateRoot;
}

export interface AbstractTemplateRoot {
  get childNodes(): ChildNode[];
  update(values: unknown[], updater: Updater): void;
  mount(part: ChildNodePart): void;
  unmount(part: ChildNodePart): void;
  disconnect(): void;
}

export interface Binding<TValue, TContext = unknown> {
  get part(): Part;
  get startNode(): ChildNode;
  get endNode(): ChildNode;
  set value(newValue: TValue);
  get value(): TValue;
  bind(updater: Updater<TContext>): void;
  unbind(updater: Updater<TContext>): void;
  disconnect(): void;
}

export interface Directive<TContext = unknown> {
  [directiveTag](
    part: Part,
    updater: Updater<TContext>,
  ): Binding<ThisType<this>>;
}

export const directiveTag = Symbol('Directive');

export function isDirective(value: unknown): value is Directive<unknown> {
  return value !== null && typeof value === 'object' && directiveTag in value;
}

export type Part =
  | AttributePart
  | ChildNodePart
  | ElementPart
  | EventPart
  | NodePart
  | PropertyPart;

export enum PartType {
  Attribute,
  ChildNode,
  Element,
  Event,
  Node,
  Property,
}

export interface AttributePart {
  type: PartType.Attribute;
  node: Element;
  name: string;
}

export interface ChildNodePart {
  type: PartType.ChildNode;
  node: ChildNode;
}

export interface ElementPart {
  type: PartType.Element;
  node: Element;
}

export interface EventPart {
  type: PartType.Event;
  node: Element;
  name: string;
}

export interface PropertyPart {
  type: PartType.Property;
  node: Element;
  name: string;
}

export interface NodePart {
  type: PartType.Node;
  node: ChildNode;
}

export type Hook = EffectHook | MemoHook<any> | ReducerHook<any, any>;

export enum HookType {
  Effect,
  Memo,
  Reducer,
}

export interface EffectHook {
  type: HookType.Effect;
  callback: EffectCallback;
  cleanup: Cleanup | void;
  dependencies: unknown[] | undefined;
}

export interface MemoHook<TResult> {
  type: HookType.Memo;
  value: TResult;
  dependencies: unknown[] | undefined;
}

export interface ReducerHook<TState, TAction> {
  type: HookType.Reducer;
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
