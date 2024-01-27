import { Block } from './block';
import {
  EffectHook,
  HookType,
  LayoutEffectHook,
  MemoHook,
  ReducerHook,
  ensureHookType,
} from './hook';
import { ChildPart } from './part';
import { AtomSignal, Signal } from './signal';
import { TemplateFactory, TemplateFactoryInterface } from './templateFactory';
import { TemplateResult } from './templateResult';
import type { Effect, EffectCallback, Ref, Renderable } from './types';

type Env = { [key: string]: any };

type ValueOrFunction<T> = T extends (...args: any[]) => any
  ? never
  : T | (() => T);

export interface ContextOptions {
  env: Env;
  templateFactory: TemplateFactoryInterface;
}

export class Context {
  private readonly _env: Env;

  private readonly _envStack: WeakMap<Renderable, Env> = new WeakMap();

  private readonly _templateFactory: TemplateFactoryInterface;

  private _currentRenderable: Renderable | null = null;

  private _hookIndex = 0;

  private _isRendering = false;

  private _pendingLayoutEffects: Effect[] = [];

  private _pendingMutationEffects: Effect[] = [];

  private _pendingPassiveEffects: Effect[] = [];

  private _pendingRenderables: Renderable[] = [];

  constructor({
    env = {},
    templateFactory = new TemplateFactory(),
  }: ContextOptions) {
    this._envStack = new WeakMap();
    this._env = env;
    this._templateFactory = templateFactory;
  }

  get currentRenderable(): Renderable | null {
    return this._currentRenderable;
  }

  html(strings: TemplateStringsArray, ...values: unknown[]): TemplateResult {
    return this._templateFactory.createTemplate(strings, values);
  }

  mount(container: Node, renderable: Renderable): void {
    this.pushLayoutEffect({
      commit(context: Context) {
        const node = document.createComment('');
        container.appendChild(node);
        const part = new ChildPart(node);
        part.setValue(renderable);
        part.commit(context);
      },
    });
    this.requestUpdate(renderable);
  }

  useAtomSignal<T>(initialValue: T): AtomSignal<T> {
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
    dependencies?: unknown[],
  ): TCallback {
    return this.useMemo(() => callback, dependencies);
  }

  useEffect(callback: EffectCallback, dependencies?: unknown[]): void {
    const { hooks } = this._currentRenderable as Block;
    const currentHook = hooks[this._hookIndex];

    if (currentHook) {
      ensureHookType<EffectHook>(HookType.EFFECT, currentHook);

      currentHook.callback = callback;

      if (dependenciesAreChanged(currentHook.dependencies, dependencies)) {
        this.pushPassiveEffect(new InvokeEffectHook(currentHook));
        currentHook.dependencies = dependencies;
      }
    } else {
      const newHook: EffectHook = {
        type: HookType.EFFECT,
        callback,
        dependencies,
        cleanup: undefined,
      };

      hooks[this._hookIndex] = newHook;

      this.pushPassiveEffect(new InvokeEffectHook(newHook));
    }

    this._hookIndex++;
  }

  useEnv<T>(name: string): T | undefined {
    let renderable = this._currentRenderable;
    do {
      const env = this._envStack.get(renderable!);
      if (env && Object.prototype.hasOwnProperty.call(env, name)) {
        return env[name];
      }
    } while ((renderable = renderable!.parent));
    return this._env[name];
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
    const { hooks } = this._currentRenderable as Block;
    const currentHook = hooks[this._hookIndex];

    if (currentHook) {
      ensureHookType<LayoutEffectHook>(HookType.LAYOUT_EFFECT, currentHook);

      if (dependenciesAreChanged(currentHook.dependencies, dependencies)) {
        this.pushPassiveEffect(new InvokeEffectHook(currentHook));
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

      hooks[this._hookIndex] = newHook;

      this.pushPassiveEffect(new InvokeEffectHook(newHook));
    }

    this._hookIndex++;
  }

  useMemo<TResult>(factory: () => TResult, dependencies?: unknown[]): TResult {
    const { hooks } = this._currentRenderable as Block;
    let currentHook = hooks[this._hookIndex];

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

      currentHook = hooks[this._hookIndex] = newHook;
    }

    this._hookIndex++;

    return currentHook.value as TResult;
  }

  useReducer<TState, TAction>(
    reducer: (state: TState, action: TAction) => TState,
    initialState: ValueOrFunction<TState>,
  ): [TState, (action: TAction) => void] {
    const block = this._currentRenderable as Block;
    const { hooks } = block;
    let currentHook = hooks[this._hookIndex];

    if (currentHook) {
      ensureHookType<ReducerHook>(HookType.REDUCER, currentHook);
    } else {
      const newHook: ReducerHook<TState, TAction> = {
        type: HookType.REDUCER,
        state:
          typeof initialState === 'function' ? initialState() : initialState,
        dispatch: (action: TAction) => {
          newHook.state = reducer(newHook.state, action);
          block.scheduleUpdate(this);
        },
      };

      currentHook = hooks[this._hookIndex] = newHook as ReducerHook;
    }

    this._hookIndex++;

    return [
      currentHook.state as TState,
      currentHook.dispatch as (action: TAction) => void,
    ];
  }

  useRef<T>(initialValue: T): Ref<T> {
    return this.useMemo(() => ({ current: initialValue }), []);
  }

  useSignal<TSignal extends Signal<any>>(signal: TSignal): TSignal {
    const block = this._currentRenderable as Block;
    this.useEffect(() => {
      return signal.subscribe(() => {
        block.scheduleUpdate(this);
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
    subscribe: (subscruber: () => void) => void,
    getSnapshot: () => T,
  ): T {
    const block = this._currentRenderable as Block;
    this.useEffect(() => {
      return subscribe(() => {
        block.scheduleUpdate(this);
      });
    }, [subscribe]);
    return getSnapshot();
  }

  setEnv(env: Env): void {
    if (this._currentRenderable) {
      this._envStack.set(this._currentRenderable, env);
    } else {
      Object.assign(this._env, env);
    }
  }

  requestUpdate(renderable: Renderable): void {
    if (this._currentRenderable) {
      if (this._currentRenderable !== renderable) {
        this._pendingRenderables.push(renderable);
      }
    } else {
      this._pendingRenderables.push(renderable);
      if (!this._isRendering) {
        this._isRendering = true;
        this._startRenderingPhase();
      }
    }
  }

  requestMutations(): void {
    if (!this._isRendering && this._pendingMutationEffects.length > 0) {
      this._isRendering = true;
      this._startBlockingPhase();
    }
  }

  pushMutationEffect(effect: Effect): void {
    this._pendingMutationEffects.push(effect);
  }

  pushLayoutEffect(effect: Effect): void {
    this._pendingLayoutEffects.push(effect);
  }

  pushPassiveEffect(effect: Effect): void {
    this._pendingPassiveEffects.push(effect);
  }

  private _startRenderingPhase(): void {
    scheduler.postTask(this._renderingPhase, {
      priority: 'background',
    });
  }

  private _startBlockingPhase(): void {
    scheduler.postTask(this._blockingPhase, {
      priority: 'user-blocking',
    });
  }

  private _startPassiveEffectPhase(): void {
    scheduler.postTask(this._passiveEffectPhase, {
      priority: 'background',
    });
  }

  private _renderingPhase = async () => {
    console.time('Rendering phase');

    for (let i = 0; i < this._pendingRenderables.length; i++) {
      if (navigator.scheduling.isInputPending()) {
        await yieldToMain();
      }
      const renderable = this._pendingRenderables[i]!;
      if (renderable.isDirty && !hasDirtyParent(renderable)) {
        this._hookIndex = 0;
        this._currentRenderable = renderable;
        this._currentRenderable.render(this);
        this._currentRenderable = null;
      }
    }

    this._pendingRenderables.length = 0;

    if (
      this._pendingMutationEffects.length > 0 ||
      this._pendingLayoutEffects.length > 0
    ) {
      this._startBlockingPhase();
    } else if (this._pendingPassiveEffects.length > 0) {
      this._startPassiveEffectPhase();
    } else {
      this._isRendering = false;
    }

    console.timeEnd('Rendering phase');
  };

  private _blockingPhase = async () => {
    console.time('Blocking phase');

    for (let i = 0; i < this._pendingMutationEffects.length; i++) {
      if (navigator.scheduling.isInputPending()) {
        await yieldToMain();
      }
      this._pendingMutationEffects[i]!.commit(this);
    }

    this._pendingMutationEffects.length = 0;

    for (let i = 0; i < this._pendingLayoutEffects.length; i++) {
      if (navigator.scheduling.isInputPending()) {
        await yieldToMain();
      }
      this._pendingLayoutEffects[i]!.commit(this);
    }

    this._pendingLayoutEffects.length = 0;

    if (this._pendingPassiveEffects.length > 0) {
      this._startPassiveEffectPhase();
    } else if (this._pendingRenderables.length > 0) {
      this._startRenderingPhase();
    } else {
      this._isRendering = false;
    }

    console.timeEnd('Blocking phase');
  };

  private _passiveEffectPhase = async () => {
    console.time('Passive effect phase');

    for (let i = 0; i < this._pendingPassiveEffects.length; i++) {
      if (navigator.scheduling.isInputPending()) {
        await yieldToMain();
      }
      this._pendingPassiveEffects[i]!.commit(this);
    }

    this._pendingPassiveEffects.length = 0;

    if (this._pendingRenderables.length > 0) {
      this._startRenderingPhase();
    } else if (
      this._pendingMutationEffects.length > 0 ||
      this._pendingLayoutEffects.length > 0
    ) {
      this._startBlockingPhase();
    } else {
      this._isRendering = false;
    }

    console.timeEnd('Passive effect phase');
  };
}

class InvokeEffectHook implements Effect {
  private readonly _hook: EffectHook | LayoutEffectHook;

  constructor(hook: EffectHook | LayoutEffectHook) {
    this._hook = hook;
  }

  commit(context: Context): void {
    if (this._hook.cleanup) {
      this._hook.cleanup(context);
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
      (dependencies, index) => dependencies !== oldDependencies[index],
    )
  );
}

function hasDirtyParent(renderable: Renderable): boolean {
  let currentRenderable: Renderable | null = renderable;
  while ((currentRenderable = currentRenderable.parent)) {
    if (renderable.isDirty) {
      return true;
    }
  }
  return false;
}

function yieldToMain(): Promise<void> {
  if ('scheduler' in globalThis && 'yield' in scheduler) {
    return scheduler.yield();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
