import { describe, expect, it, vi } from 'vitest';

import { RenderingContext } from '../src/renderingContext.js';
import { RenderingEngine } from '../src/renderingEngine.js';
import { type Hook, HookType, PartType } from '../src/types.js';
import { SyncUpdater } from '../src/updater/syncUpdater.js';
import { MockComponent, MockTemplate, MockTemplateResult } from './mocks.js';

describe('RenderingEngine', () => {
  describe('.flushEffects()', () => {
    it('should perform given effects', () => {
      const engine = new RenderingEngine();
      const effect1 = {
        commit: vi.fn(),
      };
      const effect2 = {
        commit: vi.fn(),
      };
      engine.flushEffects([effect1, effect2], 'passive');

      expect(effect1.commit).toHaveBeenCalledOnce();
      expect(effect1.commit).toHaveBeenCalledWith('passive');
      expect(effect2.commit).toHaveBeenCalledOnce();
      expect(effect2.commit).toHaveBeenCalledWith('passive');
    });
  });

  describe('.getHTMLTemplate()', () => {
    it('should create a HTML template from tokens', () => {
      const engine = new RenderingEngine();
      const [tokens, data] = tmpl`<div>Hello, ${'World'}!</div>`;
      const template = engine.getHTMLTemplate(tokens, data);

      expect(template.holes).toEqual([{ type: PartType.Node, index: 2 }]);
      expect(template.element.innerHTML).toBe('<div>Hello, !</div>');
    });

    it('should get a HTML template from cache if avaiable', () => {
      const engine = new RenderingEngine();
      const [tokens, data] = tmpl`<div>Hello, ${'World'}!</div>`;
      const template = engine.getHTMLTemplate(tokens, data);

      expect(template).toBe(engine.getHTMLTemplate(tokens, data));
    });
  });

  describe('.getSVGTemplate()', () => {
    it('should create a SVG template from tokens', () => {
      const engine = new RenderingEngine();
      const [tokens, data] = tmpl`<text>Hello, ${'World'}!</text>`;
      const template = engine.getSVGTemplate(tokens, data);

      expect(template.holes).toEqual([{ type: PartType.Node, index: 2 }]);
      expect(template.element.innerHTML).toBe('<text>Hello, !</text>');
      expect(template.element.content.firstElementChild?.namespaceURI).toBe(
        'http://www.w3.org/2000/svg',
      );
    });

    it('should get a SVG template from cache if avaiable', () => {
      const engine = new RenderingEngine();
      const [tokens, data] = tmpl`<div>Hello, ${'World'}!</div>`;
      const template = engine.getSVGTemplate(tokens, data);

      expect(template).toBe(engine.getSVGTemplate(tokens, data));
    });
  });

  describe('.getVariable()', () => {
    it('should get a variable from global variables', () => {
      const engine = new RenderingEngine({ foo: 123 });
      const component = new MockComponent();

      expect(engine.getVariable(component, 'foo')).toBe(123);
    });

    it('should get a variable from the component', () => {
      const engine = new RenderingEngine({ foo: 123 });
      const component = new MockComponent();

      engine.setVariable(component, 'foo', 456);

      expect(engine.getVariable(component, 'foo')).toBe(456);

      engine.setVariable(component, 'foo', 789);

      expect(engine.getVariable(component, 'foo')).toBe(789);
    });

    it('should get a variable from the parent', () => {
      const engine = new RenderingEngine({ foo: 123 });
      const parent = new MockComponent();
      const component = new MockComponent(parent);

      engine.setVariable(parent, 'foo', 456);

      expect(engine.getVariable(component, 'foo')).toBe(456);
    });
  });

  describe('renderBlock', () => {
    it('should return the block', () => {
      const engine = new RenderingEngine();
      const template = new MockTemplate();
      const props = {
        data: ['foo'],
      };
      const block = vi.fn().mockImplementation((props, context) => {
        context.useEffect(() => {});

        return new MockTemplateResult(template, props.data);
      });
      const hooks: Hook[] = [];
      const component = new MockComponent();
      const updater = new SyncUpdater(engine);
      const result = engine.renderBlock(
        block,
        props,
        hooks,
        component,
        updater,
      );

      expect(result.template).toBe(template);
      expect(result.data).toEqual(props.data);
      expect(block).toHaveBeenCalledOnce();
      expect(block).toHaveBeenCalledWith(props, expect.any(RenderingContext));
      expect(hooks).toEqual([
        expect.objectContaining({ type: HookType.Effect }),
        { type: HookType.Finalizer },
      ]);
    });
  });
});

function tmpl(
  tokens: TemplateStringsArray,
  ...data: unknown[]
): [TemplateStringsArray, unknown[]] {
  return [tokens, data];
}
