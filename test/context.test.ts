import { describe, expect, it, vi } from 'vitest';

import { Context, usableTag } from '../src/context.js';
import { Engine } from '../src/engine.js';
import { ElementTemplate } from '../src/template/elementTemplate.js';
import { TaggedTemplate } from '../src/template/taggedTemplate.js';
import {
  ChildNodeTemplate,
  TextTemplate,
} from '../src/template/valueTemplate.js';
import type { Hook } from '../src/types.js';
import { SyncUpdater } from '../src/updater.js';
import { MockComponent } from './mocks.js';

describe('Context', () => {
  describe('.childNode()', () => {
    it('should return TemplateDirective with ChildNodeTemplate set as a template', () => {
      const hooks: Hook[] = [];
      const component = new MockComponent();
      const engine = new Engine();
      const updater = new SyncUpdater(engine);
      const context = new Context(hooks, component, engine, updater);
      const directive = context.childNode('foo');

      expect(directive.template).toBeInstanceOf(ChildNodeTemplate);
      expect(directive.data).toBe('foo');
    });
  });

  describe('.element()', () => {
    it('should return TemplateDirective with ElementTemplate set as a template', () => {
      const hooks: Hook[] = [];
      const component = new MockComponent();
      const engine = new Engine();
      const updater = new SyncUpdater(engine);
      const context = new Context(hooks, component, engine, updater);
      const directive = context.element(
        'div',
        { class: 'foo', id: 'bar' },
        'baz',
      );

      expect(directive.template).toBeInstanceOf(ElementTemplate);
      expect(directive.data).toEqual({
        elementValue: { class: 'foo', id: 'bar' },
        childNodeValue: 'baz',
      });
    });
  });

  describe('.getContextValue()', () => {
    it('should get the value from global namespace', () => {
      const hooks: Hook[] = [];
      const component = new MockComponent();
      const engine = new Engine({ foo: 123 });
      const updater = new SyncUpdater(engine);
      const context = new Context(hooks, component, engine, updater);

      expect(context.getContextValue('foo')).toBe(123);
      expect(context.getContextValue('bar')).toBeUndefined();
    });

    it('should get the value set on the component', () => {
      const hooks: Hook[] = [];
      const component = new MockComponent();
      const engine = new Engine({ foo: 123 });
      const updater = new SyncUpdater(engine);

      {
        const context = new Context(hooks, component, engine, updater);
        context.setContextValue('foo', 456);
        context.setContextValue('bar', 789);
        expect(context.getContextValue('foo')).toBe(456);
        expect(context.getContextValue('bar')).toBe(789);
      }

      {
        const context = new Context(hooks, component, engine, updater);
        expect(context.getContextValue('foo')).toBe(456);
        expect(context.getContextValue('bar')).toBe(789);
      }

      {
        const context = new Context(
          hooks,
          new MockComponent(),
          engine,
          updater,
        );
        expect(context.getContextValue('foo')).toBe(123);
        expect(context.getContextValue('bar')).toBeUndefined();
      }
    });
  });

  describe('.html()', () => {
    it('should return TemplateDirective with an HTML-formatted TaggedTemplate set as a template', () => {
      const hooks: Hook[] = [];
      const component = new MockComponent();
      const engine = new Engine();
      const updater = new SyncUpdater(engine);
      const context = new Context(hooks, component, engine, updater);
      const directive = context.html`
        <div class=${0}>Hello, ${1}!</div>
      `;

      expect(directive.template).toBeInstanceOf(TaggedTemplate);
      expect(
        (directive.template as TaggedTemplate).element.content.firstElementChild
          ?.namespaceURI,
      ).toBe('http://www.w3.org/1999/xhtml');
      expect(directive.data).toEqual([0, 1]);
    });
  });

  describe('.requestUpdate()', () => {
    it('should request update for the component', () => {
      const hooks: Hook[] = [];
      const component = new MockComponent();
      const requestUpdateSpy = vi.spyOn(component, 'requestUpdate');
      const engine = new Engine();
      const updater = new SyncUpdater(engine);
      const context = new Context(hooks, component, engine, updater);

      context.requestUpdate();

      expect(requestUpdateSpy).toHaveBeenCalledOnce();
      expect(requestUpdateSpy).toHaveBeenCalledWith('user-blocking', updater);
    });
  });

  describe('.svg()', () => {
    it('should return TemplateDirective with an SVG-hormatted TaggedTemplate set as a template', () => {
      const hooks: Hook[] = [];
      const component = new MockComponent();
      const engine = new Engine();
      const updater = new SyncUpdater(engine);
      const context = new Context(hooks, component, engine, updater);
      const directive = context.svg`
        <text x=${0} y=${1}>Hello, ${2}!</text>
      `;

      expect(directive.template).toBeInstanceOf(TaggedTemplate);
      expect(
        (directive.template as TaggedTemplate).element.content.firstElementChild
          ?.namespaceURI,
      ).toBe('http://www.w3.org/2000/svg');
      expect(directive.data).toEqual([0, 1, 2]);
    });
  });

  describe('.text()', () => {
    it('should return TemplateDirective with TextTemplate set as a template', () => {
      const hooks: Hook[] = [];
      const component = new MockComponent();
      const engine = new Engine();
      const updater = new SyncUpdater(engine);
      const context = new Context(hooks, component, engine, updater);
      const directive = context.text('foo');

      expect(directive.template).toBeInstanceOf(TextTemplate);
      expect(directive.data).toEqual('foo');
    });
  });

  describe('.use()', () => {
    it('should handle the UsableCallback', () => {
      const component = new MockComponent();
      const hooks: Hook[] = [];
      const engine = new Engine();
      const updater = new SyncUpdater(engine);
      const context = new Context(hooks, component, engine, updater);
      const callback = vi.fn(() => 'foo');

      expect(context.use(callback)).toBe('foo');
      expect(callback).toHaveBeenCalledOnce();
      expect(callback).toHaveBeenCalledWith(context);
    });

    it('should handle the UsableObject', () => {
      const hooks: Hook[] = [];
      const component = new MockComponent();
      const engine = new Engine();
      const updater = new SyncUpdater(engine);
      const context = new Context(hooks, component, engine, updater);
      const usable = { [usableTag]: vi.fn(() => 'foo') };

      expect(context.use(usable)).toBe('foo');
      expect(usable[usableTag]).toHaveBeenCalledOnce();
      expect(usable[usableTag]).toHaveBeenCalledWith(context);
    });
  });
});
