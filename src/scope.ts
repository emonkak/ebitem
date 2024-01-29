import { Context } from './context';
import type { ScopeInterface } from './scopeInterface';
import { Template } from './template';
import { TemplateInterface } from './templateInterface';
import type { Renderable, RenderableBlock, Updater } from './updater';

type Varibales = { [key: PropertyKey]: unknown };

export class Scope implements ScopeInterface<Context> {
  private readonly _variableScope: WeakMap<Renderable<Context>, Varibales> =
    new WeakMap();

  private readonly _templateCaches: WeakMap<TemplateStringsArray, Template> =
    new WeakMap();

  private readonly _globalVariables: Varibales;

  private readonly _marker: string;

  constructor(globalVariables: Varibales = {}) {
    this._globalVariables = globalVariables;
    this._marker = '{{' + getUUID() + '}}';
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
    renderable: RenderableBlock<Context>,
    updater: Updater<Context>,
  ): Context {
    return new Context(renderable, updater, this);
  }

  createTemplate(
    strings: TemplateStringsArray,
    _values: unknown[],
  ): TemplateInterface {
    let template = this._templateCaches.get(strings);

    if (template === undefined) {
      template = Template.parse(strings, this._marker);
      this._templateCaches.set(strings, template);
    }

    return template;
  }
}

function getUUID(): ReturnType<typeof crypto.randomUUID> {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  const s = [...crypto.getRandomValues(new Uint8Array(16))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  const p1 = s.slice(0, 8);
  const p2 = s.slice(8, 12);
  const p3 = s.slice(12, 16);
  const p4 = s.slice(16, 20);
  const p5 = s.slice(20, 32);
  return `${p1}-${p2}-${p3}-${p4}-${p5}`;
}
