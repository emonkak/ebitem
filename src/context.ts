import {
  Cleanup,
  EffectCallback,
  EffectHook,
  HookType,
  LayoutEffectHook,
  MemoHook,
  ReducerHook,
  RefObject,
  ensureHookType,
} from './hook.js';
import type { Hook } from './hook.js';
import type { ScopeInterface } from './scopeInterface.js';
import { Signal } from './signal.js';
import { AtomSignal } from './signals.js';
import { TemplateResult } from './templateResult.js';
import type { Effect, Renderable, Updater } from './updater.js';

type ValueOrFunction<T> = T extends (...args: any[]) => any
  ? never
  : T | (() => T);

export class Context {
  private readonly _renderable: Renderable<Context>;

  private readonly _hooks: Hook[];

  private readonly _updater: Updater<Context>;

  private readonly _scope: ScopeInterface<Context>;

  private _hookIndex = 0;

  constructor(
    renderable: Renderable<Context>,
    hooks: Hook[],
    updater: Updater<Context>,
    scope: ScopeInterface<Context>,
  ) {
    this._renderable = renderable;
    this._hooks = hooks;
    this._updater = updater;
    this._scope = scope;
  }

  html(strings: TemplateStringsArray, ...values: unknown[]): TemplateResult {
    const template = this._scope.createTemplate(strings, values);
    return new TemplateResult(template, values);
  }

  useAtomSignal<T>(initialValue: ValueOrFunction<T>): AtomSignal<T> {
    const signalRef = this.useRef<AtomSignal<T> | null>(null);
    if (signalRef.current === null) {
      signalRef.current = new AtomSignal(
        typeof initialValue === 'function' ? initialValue() : initialValue,
      );
    }
    return this.useSignal(signalRef.current);
  }

  useCallback<TCallback extends Function>(
    callback: TCallback,
    dependencies: unknown[],
  ): TCallback {
    return this.useMemo(() => callback, dependencies);
  }

  useEffect(callback: EffectCallback, dependencies?: unknown[]): void {
    const currentHook = this._hooks[this._hookIndex];

    if (currentHook) {
      ensureHookType<EffectHook>(HookType.EFFECT, currentHook);

      currentHook.callback = callback;

      if (dependenciesAreChanged(currentHook.dependencies, dependencies)) {
        this._updater.pushPassiveEffect(new InvokeEffectHook(currentHook));
        currentHook.dependencies = dependencies;
      }
    } else {
      const newHook: EffectHook = {
        type: HookType.EFFECT,
        callback,
        dependencies,
        cleanup: undefined,
      };

      this._hooks[this._hookIndex] = newHook;

      this._updater.pushPassiveEffect(new InvokeEffectHook(newHook));
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

    if (currentHook) {
      ensureHookType<LayoutEffectHook>(HookType.LAYOUT_EFFECT, currentHook);

      if (dependenciesAreChanged(currentHook.dependencies, dependencies)) {
        this._updater.pushLayoutEffect(new InvokeEffectHook(currentHook));
        currentHook.dependencies = dependencies;
      }

      currentHook.callback = callback;
    } else {
      const newHook: LayoutEffectHook = {
        type: HookType.LAYOUT_EFFECT,
        callback,
        dependencies,
        cleanup: undefined,
      };

      this._hooks[this._hookIndex] = newHook;

      this._updater.pushLayoutEffect(new InvokeEffectHook(newHook));
    }

    this._hookIndex++;
  }

  useMemo<TResult>(factory: () => TResult, dependencies: unknown[]): TResult {
    let currentHook = this._hooks[this._hookIndex];

    if (currentHook) {
      ensureHookType<MemoHook>(HookType.MEMO, currentHook);

      if (dependenciesAreChanged(currentHook.dependencies, dependencies)) {
        currentHook.value = factory();
        currentHook.dependencies = dependencies;
      }
    } else {
      const newHook: MemoHook = {
        type: HookType.MEMO,
        value: factory(),
        dependencies,
      };

      currentHook = this._hooks[this._hookIndex] = newHook;
    }

    this._hookIndex++;

    return currentHook.value as TResult;
  }

  useReducer<TState, TAction>(
    reducer: (state: TState, action: TAction) => TState,
    initialState: ValueOrFunction<TState>,
  ): [TState, (action: TAction) => void] {
    const renderable = this._renderable;
    let currentHook = this._hooks[this._hookIndex];

    if (currentHook) {
      ensureHookType<ReducerHook>(HookType.REDUCER, currentHook);
    } else {
      const newHook: ReducerHook<TState, TAction> = {
        type: HookType.REDUCER,
        state:
          typeof initialState === 'function' ? initialState() : initialState,
        dispatch: (action: TAction) => {
          newHook.state = reducer(newHook.state, action);
          renderable.forceUpdate(this._updater);
        },
      };

      currentHook = this._hooks[this._hookIndex] = newHook as ReducerHook;
    }

    this._hookIndex++;

    return [
      currentHook.state as TState,
      currentHook.dispatch as (action: TAction) => void,
    ];
  }

  useRef<T>(initialValue: T): RefObject<T> {
    return this.useMemo(() => ({ current: initialValue }), []);
  }

  useSignal<TSignal extends Signal<any>>(signal: TSignal): TSignal {
    const renderable = this._renderable;
    this.useEffect(() => {
      return signal.subscribe(() => {
        renderable.forceUpdate(this._updater);
      });
    }, [signal]);
    return signal;
  }

  useState<TState>(
    initialState: ValueOrFunction<TState>,
  ): [TState, (newState: TState) => void] {
    return this.useReducer(
      (state, action) =>
        typeof action === 'function' ? action(state) : action,
      initialState,
    );
  }

  useSyncEnternalStore<T>(
    subscribe: (subscruber: () => void) => Cleanup | void,
    getSnapshot: () => T,
  ): T {
    const renderable = this._renderable;
    this.useEffect(() => {
      return subscribe(() => {
        renderable.forceUpdate(this._updater);
      });
    }, [subscribe]);
    return getSnapshot();
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

  setContextValue(key: PropertyKey, value: unknown): void {
    this._scope.setVariable(key, value, this._renderable);
  }

  requestUpdate(): void {
    this._updater.requestUpdate(this._renderable);
  }
}

class InvokeEffectHook implements Effect {
  private readonly _hook: EffectHook | LayoutEffectHook;

  constructor(hook: EffectHook | LayoutEffectHook) {
    this._hook = hook;
  }

  commit(_updater: Updater): void {
    if (this._hook.cleanup) {
      this._hook.cleanup();
      this._hook.cleanup = undefined;
    }

    const callback = this._hook.callback;

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
