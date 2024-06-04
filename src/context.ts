import { TemplateDirective } from './directives/template.js';
import {
  Cleanup,
  EffectCallback,
  EffectHook,
  Hook,
  HookType,
  MemoHook,
  ReducerHook,
  RefObject,
  Usable,
  ensureHookType,
  usableTag,
} from './hook.js';
import type { TaskPriority } from './scheduler.js';
import { ElementData, ElementTemplate } from './template/elementTemplate.js';
import { ChildNodeTemplate, TextTemplate } from './template/valueTemplate.js';
import type {
  Component,
  Effect,
  TemplateProvider,
  Updater,
  VariableProvider,
} from './types.js';
import { dependenciesAreChanged } from './utils.js';

export type InitialState<TState> = TState extends Function
  ? () => TState
  : (() => TState) | TState;

export type NewState<TState> = TState extends Function
  ? (prevState: TState) => TState
  : ((prevState: TState) => TState) | TState;

export class Context {
  private readonly _component: Component<Context>;

  private readonly _hooks: Hook[];

  private readonly _scope: TemplateProvider<Context> &
    VariableProvider<Context>;

  private readonly _updater: Updater<Context>;

  private _hookIndex = 0;

  constructor(
    component: Component<Context>,
    hooks: Hook[],
    scope: TemplateProvider<Context> & VariableProvider<Context>,
    updater: Updater<Context>,
  ) {
    this._component = component;
    this._hooks = hooks;
    this._scope = scope;
    this._updater = updater;
  }

  childNode<T>(value: T): TemplateDirective<T, Context> {
    const template = ChildNodeTemplate.instance;
    return new TemplateDirective(template, value);
  }

  element<TElementValue, TChildNodeValue>(
    type: string,
    elementValue: TElementValue,
    childNodeValue: TChildNodeValue,
  ): TemplateDirective<ElementData<TElementValue, TChildNodeValue>, Context> {
    const template = new ElementTemplate<TElementValue, TChildNodeValue>(type);
    return new TemplateDirective(template, { elementValue, childNodeValue });
  }

  getContextValue<T>(key: PropertyKey): T | undefined {
    let component: Component<Context> | null = this._component;
    do {
      const value = this._scope.getVariable(key, component);
      if (value !== undefined) {
        return value as T;
      }
    } while ((component = component.parent));
    return undefined;
  }

  html(
    tokens: ReadonlyArray<string>,
    ...data: unknown[]
  ): TemplateDirective<unknown[], Context> {
    const template = this._scope.createHTMLTemplate(tokens, data);
    return new TemplateDirective(template, data);
  }

  requestUpdate(): void {
    this._component.requestUpdate(
      this._updater,
      this._updater.getCurrentPriority(),
    );
  }

  setContextValue(key: PropertyKey, value: unknown): void {
    this._scope.setVariable(key, value, this._component);
  }

  svg(
    tokens: ReadonlyArray<string>,
    ...data: unknown[]
  ): TemplateDirective<unknown[], Context> {
    const template = this._scope.createSVGTemplate(tokens, data);
    return new TemplateDirective(template, data);
  }

  text<T>(value: T): TemplateDirective<T, Context> {
    const template = TextTemplate.instance;
    return new TemplateDirective(template, value);
  }

  use<TResult>(usable: Usable<TResult, Context>): TResult {
    return typeof usable === 'function'
      ? usable(this)
      : usable[usableTag](this);
  }

  useCallback<TCallback extends Function>(
    callback: TCallback,
    dependencies: unknown[],
  ): TCallback {
    return this.useMemo(() => callback, dependencies);
  }

  useDeferredValue<TValue>(value: TValue, initialValue?: TValue): TValue {
    const [deferredValue, setDeferredValue] = this.useState<TValue>(
      (() => initialValue ?? value) as InitialState<TValue>,
      'background',
    );

    this.useEffect(() => {
      setDeferredValue((() => value) as NewState<TValue>);
    }, [value]);

    return deferredValue;
  }

  useEffect(callback: EffectCallback, dependencies?: unknown[]): void {
    const currentHook = this._hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<EffectHook>(HookType.Effect, currentHook);

      if (dependenciesAreChanged(currentHook.dependencies, dependencies)) {
        this._updater.enqueuePassiveEffect(
          new InvokeEffectHook(currentHook, callback),
        );
      }

      currentHook.dependencies = dependencies;
    } else {
      const hook: EffectHook = {
        type: HookType.Effect,
        dependencies,
        cleanup: undefined,
      };
      this._hooks.push(hook);
      this._updater.enqueuePassiveEffect(new InvokeEffectHook(hook, callback));
    }

    this._hookIndex++;
  }

  useEvent<THandler extends (...args: any[]) => any>(
    handler: THandler,
  ): (
    this: ThisType<THandler>,
    ...args: Parameters<THandler>
  ) => ReturnType<THandler> {
    const handlerRef = this.useRef<THandler | null>(null);

    this.useLayoutEffect(() => {
      handlerRef.current = handler;
    });

    return this.useCallback(function (
      this: ThisType<THandler>,
      ...args: Parameters<THandler>
    ) {
      const currentHandler = handlerRef.current!;
      return currentHandler.call(this, args);
    }, []);
  }

  useLayoutEffect(callback: EffectCallback, dependencies?: unknown[]): void {
    const currentHook = this._hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<EffectHook>(HookType.Effect, currentHook);

      if (dependenciesAreChanged(currentHook.dependencies, dependencies)) {
        this._updater.enqueueLayoutEffect(
          new InvokeEffectHook(currentHook, callback),
        );
      }

      currentHook.dependencies = dependencies;
    } else {
      const hook: EffectHook = {
        type: HookType.Effect,
        dependencies,
        cleanup: undefined,
      };
      this._hooks.push(hook);
      this._updater.enqueueLayoutEffect(new InvokeEffectHook(hook, callback));
    }

    this._hookIndex++;
  }

  useMemo<TResult>(factory: () => TResult, dependencies: unknown[]): TResult {
    let currentHook = this._hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<MemoHook<TResult>>(HookType.Memo, currentHook);

      if (dependenciesAreChanged(currentHook.dependencies, dependencies)) {
        currentHook.value = factory();
        currentHook.dependencies = dependencies;
      }
    } else {
      currentHook = {
        type: HookType.Memo,
        value: factory(),
        dependencies,
      };
      this._hooks.push(currentHook);
    }

    this._hookIndex++;

    return currentHook.value;
  }

  useReducer<TState, TAction>(
    reducer: (state: TState, action: TAction) => TState,
    initialState: InitialState<TState>,
    priority?: TaskPriority,
  ): [TState, (action: TAction) => void] {
    let currentHook = this._hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<ReducerHook<TState, TAction>>(
        HookType.Reducer,
        currentHook,
      );
    } else {
      const hook: ReducerHook<TState, TAction> = {
        type: HookType.Reducer,
        state:
          typeof initialState === 'function' ? initialState() : initialState,
        dispatch: (action: TAction) => {
          const nextState = reducer(hook.state, action);
          if (!Object.is(hook.state, nextState)) {
            hook.state = nextState;
            this._component.requestUpdate(
              this._updater,
              priority ?? this._updater.getCurrentPriority(),
            );
          }
        },
      };
      currentHook = hook;
      this._hooks.push(hook);
    }

    this._hookIndex++;

    return [currentHook.state, currentHook.dispatch];
  }

  useRef<T>(initialValue: T): RefObject<T> {
    return this.useMemo(() => ({ current: initialValue }), []);
  }

  useState<TState>(
    initialState: InitialState<TState>,
    priority?: TaskPriority,
  ): [TState, (newState: NewState<TState>) => void] {
    return this.useReducer(
      (state, action) =>
        typeof action === 'function' ? action(state) : action,
      initialState,
      priority,
    );
  }

  useSyncEnternalStore<T>(
    subscribe: (subscruber: () => void) => Cleanup | void,
    getSnapshot: () => T,
    priority?: TaskPriority,
  ): T {
    this.useEffect(
      () =>
        subscribe(() => {
          this._component.requestUpdate(
            this._updater,
            priority ?? this._updater.getCurrentPriority(),
          );
        }),
      [subscribe, priority],
    );
    return getSnapshot();
  }
}

class InvokeEffectHook implements Effect {
  private readonly _hook: EffectHook;

  private readonly _callback: () => void;

  constructor(hook: EffectHook, callback: () => void) {
    this._hook = hook;
    this._callback = callback;
  }

  commit(): void {
    if (this._hook.cleanup !== undefined) {
      this._hook.cleanup();
      this._hook.cleanup = undefined;
    }

    const callback = this._callback;

    this._hook.cleanup = callback();
  }
}
