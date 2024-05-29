import type { Context } from './context.js';
import type { Hook } from './hook.js';
import type { Component, Scope, Template, Updater } from './types.js';

export let currentContext: Context | null = null;

export class GlobalScope implements Scope<Context> {
  private readonly _scope: Scope<Context>;

  constructor(scope: Scope<Context>) {
    this._scope = scope;
  }

  getVariable(key: PropertyKey, component: Component<Context>): unknown {
    return this._scope.getVariable(key, component);
  }

  setVariable(
    key: PropertyKey,
    value: unknown,
    component: Component<Context>,
  ): void {
    return this._scope.setVariable(key, value, component);
  }

  startContext(
    component: Component<Context>,
    hooks: Hook[],
    updater: Updater<Context>,
  ): Context {
    if (currentContext !== null) {
      throw new Error('Context can not be started inside a block function.');
    }
    currentContext = this._scope.startContext(component, hooks, updater);
    return currentContext;
  }

  finishContext(context: Context): void {
    if (currentContext !== context) {
      throw new Error(
        'Context has not been started or a different context was attempted to be finished.',
      );
    }
    currentContext = null;
    this._scope.finishContext(context);
  }

  createHTMLTemplate(
    tokens: ReadonlyArray<string>,
    data: unknown[],
  ): Template<unknown[], Context> {
    return this._scope.createHTMLTemplate(tokens, data);
  }

  createSVGTemplate(
    tokens: ReadonlyArray<string>,
    data: unknown[],
  ): Template<unknown[], Context> {
    return this._scope.createSVGTemplate(tokens, data);
  }
}
