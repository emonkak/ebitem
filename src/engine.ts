import { Context } from './context.js';
import type { Hook } from './hook.js';
import { TaggedTemplate, getMarker } from './template/taggedTemplate.js';
import type {
  Block,
  Component,
  Effect,
  EffectMode,
  RenderingEngine,
  Template,
  TemplateResult,
  Updater,
} from './types.js';

export type Variables = { [key: PropertyKey]: unknown };

export class Engine implements RenderingEngine<Context> {
  private readonly _globalVariables: Variables;

  private readonly _marker: string = getMarker();

  private readonly _namespaces: WeakMap<Component<Context>, Variables> =
    new WeakMap();

  private readonly _cachedTemplates: WeakMap<
    ReadonlyArray<string>,
    Template<unknown, Context>
  > = new WeakMap();

  constructor(globalVariables: Variables = {}) {
    this._globalVariables = globalVariables;
  }

  flushEffects(effects: Effect[], mode: EffectMode): void {
    for (let i = 0, l = effects.length; i < l; i++) {
      effects[i]!.commit(mode);
    }
  }

  getHTMLTemplate(
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

  getSVGTemplate(
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

  getVariable(key: PropertyKey, component: Component<Context>): unknown {
    let current: Component<Context> | null = component;
    do {
      const value = this._namespaces.get(current)?.[key];
      if (value !== undefined) {
        return value;
      }
    } while ((current = current.parent));
    return this._globalVariables[key];
  }

  renderBlock<TProps, TData>(
    block: Block<TProps, TData, Context>,
    props: TProps,
    hooks: Hook[],
    component: Component<Context>,
    updater: Updater<Context>,
  ): TemplateResult<TData, Context> {
    const context = new Context(hooks, component, this, updater);
    const result = block(props, context);
    context.finalize();
    return result;
  }

  setVariable(
    key: PropertyKey,
    value: unknown,
    component: Component<Context>,
  ): void {
    const variables = this._namespaces.get(component);
    if (variables !== undefined) {
      variables[key] = value;
    } else {
      this._namespaces.set(component, { [key]: value });
    }
  }
}
