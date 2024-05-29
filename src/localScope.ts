import { Context } from './context.js';
import type { Hook } from './hook.js';
import { TaggedTemplate, getMarker } from './template/taggedTemplate.js';
import type { Component, Scope, Template, Updater } from './types.js';

export type Namespace = { [key: PropertyKey]: unknown };

export class LocalScope implements Scope<Context> {
  private readonly _globalNamespace: Namespace;

  private readonly _marker: string = getMarker();

  private readonly _namespaces: WeakMap<Component<Context>, Namespace> =
    new WeakMap();

  private readonly _cachedTemplates: WeakMap<
    ReadonlyArray<string>,
    Template<unknown, Context>
  > = new WeakMap();

  constructor(globalNamespace: Namespace = {}) {
    this._globalNamespace = globalNamespace;
  }

  getVariable(key: PropertyKey, component: Component<Context>): unknown {
    let current: Component<Context> | null = component;
    do {
      const value = this._namespaces.get(component)?.[key];
      if (value !== undefined) {
        return value;
      }
    } while ((current = current.parent));
    return this._globalNamespace[key];
  }

  setVariable(
    key: PropertyKey,
    value: unknown,
    component: Component<Context>,
  ): void {
    const namespace = this._namespaces.get(component);
    if (namespace !== undefined) {
      namespace[key] = value;
    } else {
      this._namespaces.set(component, { [key]: value });
    }
  }

  startContext(
    component: Component<Context>,
    hooks: Hook[],
    updater: Updater<Context>,
  ): Context {
    return new Context(component, hooks, this, updater);
  }

  finishContext(_context: Context): void {}

  createHTMLTemplate(
    tokens: ReadonlyArray<string>,
    _data: unknown[],
  ): Template<unknown[], Context> {
    let template = this._cachedTemplates.get(tokens);

    if (template === undefined) {
      template = TaggedTemplate.parseHTML(tokens, this._marker);
      this._cachedTemplates.set(tokens, template);
    }

    return template;
  }

  createSVGTemplate(
    tokens: ReadonlyArray<string>,
    _data: unknown[],
  ): Template<unknown[], Context> {
    let template = this._cachedTemplates.get(tokens);

    if (template === undefined) {
      template = TaggedTemplate.parseSVG(tokens, this._marker);
      this._cachedTemplates.set(tokens, template);
    }

    return template;
  }
}
