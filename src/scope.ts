import { Context } from './context.js';
import { Template, getMarker } from './template.js';
import type {
  AbstractScope,
  AbstractTemplate,
  Hook,
  Renderable,
  Updater,
} from './types.js';

type Varibales = { [key: PropertyKey]: unknown };

export class Scope implements AbstractScope<Context> {
  private readonly _globalVariables: Varibales;

  private readonly _marker: string;

  private readonly _variableScope: WeakMap<Renderable<Context>, Varibales> =
    new WeakMap();

  private readonly _templateCaches: WeakMap<TemplateStringsArray, Template> =
    new WeakMap();

  constructor(globalVariables: Varibales = {}) {
    this._globalVariables = globalVariables;
    this._marker = getMarker();
  }

  getVariable(key: PropertyKey, renderable: Renderable<Context>): unknown {
    return (
      this._variableScope.get(renderable)?.[key] ?? this._globalVariables[key]
    );
  }

  setVariable(
    key: PropertyKey,
    value: unknown,
    renderable: Renderable<Context>,
  ): void {
    const variables = this._variableScope.get(renderable);
    if (variables !== undefined) {
      variables[key] = value;
    } else {
      this._variableScope.set(renderable, { [key]: value });
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
    let template = this._templateCaches.get(tokens);

    if (template === undefined) {
      template = Template.parseHTML(tokens, this._marker);
      this._templateCaches.set(tokens, template);
    }

    return template;
  }

  createSVGTemplate(
    tokens: TemplateStringsArray,
    _values: unknown[],
  ): AbstractTemplate {
    let template = this._templateCaches.get(tokens);

    if (template === undefined) {
      template = Template.parseSVG(tokens, this._marker);
      this._templateCaches.set(tokens, template);
    }

    return template;
  }
}
