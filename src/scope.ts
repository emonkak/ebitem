import { Context, Hook } from './context.js';
import { AbstractTemplate, Template, getMarker } from './template.js';
import type { Renderable, Updater } from './updater.js';

export type Namespace = { [key: PropertyKey]: unknown };

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

export class Scope implements AbstractScope<Context> {
  private readonly _globalNamespace: Namespace;

  private readonly _marker: string;

  private readonly _namespaces: WeakMap<Renderable<Context>, Namespace> =
    new WeakMap();

  private readonly _cachedTemplates: WeakMap<TemplateStringsArray, Template> =
    new WeakMap();

  constructor(globalNamespace: Namespace = {}) {
    this._globalNamespace = globalNamespace;
    this._marker = getMarker();
  }

  getVariable(key: PropertyKey, renderable: Renderable<Context>): unknown {
    return (
      this._namespaces.get(renderable)?.[key] ?? this._globalNamespace[key]
    );
  }

  setVariable(
    key: PropertyKey,
    value: unknown,
    renderable: Renderable<Context>,
  ): void {
    const namespace = this._namespaces.get(renderable);
    if (namespace !== undefined) {
      namespace[key] = value;
    } else {
      this._namespaces.set(renderable, { [key]: value });
    }
  }

  createContext(
    renderable: Renderable<Context>,
    hooks: Hook[],
    updater: Updater<Context>,
  ): Context {
    return new Context(renderable, hooks, updater, this);
  }

  createHTMLTemplate(
    tokens: TemplateStringsArray,
    _values: unknown[],
  ): AbstractTemplate {
    let template = this._cachedTemplates.get(tokens);

    if (template === undefined) {
      template = Template.parseHTML(tokens, this._marker);
      this._cachedTemplates.set(tokens, template);
    }

    return template;
  }

  createSVGTemplate(
    tokens: TemplateStringsArray,
    _values: unknown[],
  ): AbstractTemplate {
    let template = this._cachedTemplates.get(tokens);

    if (template === undefined) {
      template = Template.parseSVG(tokens, this._marker);
      this._cachedTemplates.set(tokens, template);
    }

    return template;
  }
}
