import { RenderingContext } from './renderingContext.js';
import { TaggedTemplate, getMarker } from './template/taggedTemplate.js';
import type {
  Block,
  Component,
  Effect,
  EffectMode,
  Hook,
  TemplateResult,
  UpdateContext,
  Updater,
} from './types.js';

export type Variables = { [key: PropertyKey]: unknown };

export class RenderingEngine implements UpdateContext<RenderingContext> {
  private readonly _globalVariables: Variables;

  private readonly _marker: string = getMarker();

  private readonly _namespaces: WeakMap<
    Component<RenderingContext>,
    Variables
  > = new WeakMap();

  private readonly _cachedTemplates: WeakMap<
    ReadonlyArray<string>,
    TaggedTemplate
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
  ): TaggedTemplate {
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
  ): TaggedTemplate {
    let template = this._cachedTemplates.get(tokens);

    if (template === undefined) {
      template = TaggedTemplate.parseSVG(tokens, this._marker);
      this._cachedTemplates.set(tokens, template);
    }

    return template;
  }

  getVariable(
    component: Component<RenderingContext>,
    key: PropertyKey,
  ): unknown {
    let current: Component<RenderingContext> | null = component;
    do {
      const value = this._namespaces.get(current)?.[key];
      if (value !== undefined) {
        return value;
      }
    } while ((current = current.parent));
    return this._globalVariables[key];
  }

  renderBlock<TProps, TData>(
    block: Block<TProps, TData, RenderingContext>,
    props: TProps,
    hooks: Hook[],
    component: Component<RenderingContext>,
    updater: Updater<RenderingContext>,
  ): TemplateResult<TData, RenderingContext> {
    const context = new RenderingContext(hooks, component, this, updater);
    const result = block(props, context);
    context.finalize();
    return result;
  }

  setVariable(
    component: Component<RenderingContext>,
    key: PropertyKey,
    value: unknown,
  ): void {
    const variables = this._namespaces.get(component);
    if (variables !== undefined) {
      variables[key] = value;
    } else {
      this._namespaces.set(component, { [key]: value });
    }
  }
}
