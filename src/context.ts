import { TemplateDirective } from './directives/template.js';
import type { AbstractScope } from './scope.js';
import type { Effect, Renderable, UpdatePriority, Updater } from './updater.js';

export type Hook = EffectHook | MemoHook<any> | ReducerHook<any, any>;

export enum HookType {
  Effect,
  Memo,
  Reducer,
}

export interface EffectHook {
  type: HookType.Effect;
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

export type Usable<TResult> = UsableCallback<TResult> | UsableObject<TResult>;

export type UsableCallback<TResult> = (context: Context) => TResult;

export interface UsableObject<TResult> {
  [usableTag](context: Context): TResult;
}

export const usableTag = Symbol('Usable');

export type Cleanup = () => void;

export type EffectCallback = () => Cleanup | void;

export type Ref<T> = RefCallback<T> | RefObject<T>;

export type RefCallback<T> = (value: T) => void;

export interface RefObject<T> {
  current: T;
}

export type InitialState<TState> = (() => TState) | TState extends Function
  ? never
  : TState;

export type NewState<TState> =
  | ((prevState: TState) => TState)
  | TState extends Function
  ? never
  : TState;

export class Context {
  private readonly _renderable: Renderable<Context>;

  private readonly _hooks: Hook[];

  private readonly _updater: Updater<Context>;

  private readonly _scope: AbstractScope<Context>;

  private _hookIndex = 0;

  constructor(
    renderable: Renderable<Context>,
    hooks: Hook[],
    updater: Updater<Context>,
    scope: AbstractScope<Context>,
  ) {
    this._renderable = renderable;
    this._hooks = hooks;
    this._updater = updater;
    this._scope = scope;
  }

  getContextValue<T>(key: PropertyKey): T | undefined {
    let renderable: Renderable<Context> | null = this._renderable;
    do {
      const value = this._scope.getVariable(key, renderable);
      if (value !== undefined) {
        return value as T;
      }
    } while ((renderable = renderable.parent));
    return undefined;
  }

  html(tokens: ReadonlyArray<string>, ...values: unknown[]): TemplateDirective {
    const template = this._scope.createHTMLTemplate(tokens, values);
    return new TemplateDirective(template, values);
  }

  requestUpdate(): void {
    this._renderable.requestUpdate(
      this._updater,
      this._updater.currentPriority,
    );
  }

  setContextValue(key: PropertyKey, value: unknown): void {
    this._scope.setVariable(key, value, this._renderable);
  }

  svg(tokens: ReadonlyArray<string>, ...values: unknown[]): TemplateDirective {
    const template = this._scope.createSVGTemplate(tokens, values);
    return new TemplateDirective(template, values);
  }

  use<TResult>(usable: Usable<TResult>): TResult {
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
      const newHook: EffectHook = {
        type: HookType.Effect,
        dependencies,
        cleanup: undefined,
      };
      this._hooks.push(newHook);
      this._updater.enqueuePassiveEffect(
        new InvokeEffectHook(newHook, callback),
      );
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
      const newHook: EffectHook = {
        type: HookType.Effect,
        dependencies,
        cleanup: undefined,
      };
      this._hooks.push(newHook);
      this._updater.enqueueLayoutEffect(
        new InvokeEffectHook(newHook, callback),
      );
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
  ): [TState, (action: TAction, priority?: UpdatePriority) => void] {
    let currentHook = this._hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<ReducerHook<TState, TAction>>(
        HookType.Reducer,
        currentHook,
      );
    } else {
      const newHook: ReducerHook<TState, TAction> = {
        type: HookType.Reducer,
        state:
          typeof initialState === 'function' ? initialState() : initialState,
        dispatch: (action: TAction, priority?: UpdatePriority) => {
          const nextState = reducer(newHook.state, action);
          if (!Object.is(newHook.state, nextState)) {
            newHook.state = nextState;
            this._renderable.requestUpdate(
              this._updater,
              priority ?? this._updater.currentPriority,
            );
          }
        },
      };
      currentHook = newHook;
      this._hooks.push(newHook);
    }

    this._hookIndex++;

    return [currentHook.state, currentHook.dispatch];
  }

  useRef<T>(initialValue: T): RefObject<T> {
    return this.useMemo(() => ({ current: initialValue }), []);
  }

  useState<TState>(
    initialState: InitialState<TState>,
  ): [TState, (newState: NewState<TState>, priority?: UpdatePriority) => void] {
    return this.useReducer(
      (state, action) =>
        typeof action === 'function' ? action(state) : action,
      initialState,
    );
  }

  useSyncEnternalStore<T>(
    subscribe: (subscruber: () => void) => Cleanup | void,
    getSnapshot: () => T,
    priority?: UpdatePriority,
  ): T {
    this.useEffect(
      () =>
        subscribe(() => {
          this._renderable.requestUpdate(
            this._updater,
            priority ?? this._updater.currentPriority,
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

function dependenciesAreChanged(
  oldDependencies: unknown[] | undefined,
  newDependencies: unknown[] | undefined,
): boolean {
  return (
    oldDependencies === undefined ||
    newDependencies === undefined ||
    oldDependencies.length !== newDependencies.length ||
    newDependencies.some(
      (dependencies, index) => !Object.is(dependencies, oldDependencies[index]),
    )
  );
}

function ensureHookType<TExpectedHook extends Hook>(
  expectedType: TExpectedHook['type'],
  hook: Hook,
): asserts hook is TExpectedHook {
  if (hook.type !== expectedType) {
    throw new Error(
      `Invalid hook type. Expected "${expectedType}" but got "${hook.type}".`,
    );
  }
}
