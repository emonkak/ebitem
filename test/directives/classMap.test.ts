import { describe, expect, it, vi } from 'vitest';

import { directiveTag } from '../../src/binding.js';
import {
  ClassMapBinding,
  ClassMapDirective,
  classMap as classMapDirective,
} from '../../src/directives/classMap.js';
import { PartType } from '../../src/types.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockRenderingEngine } from '../mocks.js';

describe('classMap()', () => {
  it('should construct a new ClassMapDirective', () => {
    const classMap = { foo: true };
    const directive = classMapDirective(classMap);

    expect(directive.classMap).toBe(classMap);
  });
});

describe('ClassMapDirective', () => {
  describe('.constructor()', () => {
    it('should construct a new ClassMapDirective', () => {
      const classMap = { foo: true };
      const directive = new ClassMapDirective(classMap);

      expect(directive.classMap).toBe(classMap);
    });
  });

  describe('[directiveTag]()', () => {
    it('should return a new instance of ClassMapBinding', () => {
      const classMap = { foo: true };
      const directive = new ClassMapDirective(classMap);
      const updater = new SyncUpdater(new MockRenderingEngine());
      const part = {
        type: PartType.Attribute,
        name: 'class',
        node: document.createElement('div'),
      } as const;
      const binding = directive[directiveTag](part, updater);

      expect(binding.value).toBe(directive);
      expect(binding.part).toBe(part);
    });

    it('should throw an error if the part does not indicate "class" attribute', () => {
      const classMap = { foo: true };
      const directive = new ClassMapDirective(classMap);
      const updater = new SyncUpdater(new MockRenderingEngine());
      const part = {
        type: PartType.Attribute,
        name: 'className',
        node: document.createElement('div'),
      } as const;

      expect(() => directive[directiveTag](part, updater)).toThrow(
        'ClassMapDirective must be used in the "class" attribute.',
      );
    });
  });
});

describe('ClassMapBinding', () => {
  describe('.constructor()', () => {
    it('should construct a new ClassMapBinding', () => {
      const directive = new ClassMapDirective({ foo: true });
      const part = {
        type: PartType.Attribute,
        name: 'class',
        node: document.createElement('div'),
      } as const;
      const binding = new ClassMapBinding(directive, part);

      expect(binding.value).toBe(directive);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
    });
  });

  describe('.connect()', () => {
    it('should add properties whose values are true as classes to the element', () => {
      const directive = new ClassMapDirective({
        foo: true,
        bar: false,
        baz: true,
      });
      const part = {
        type: PartType.Attribute,
        name: 'class',
        node: document.createElement('div'),
      } as const;
      const binding = new ClassMapBinding(directive, part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      binding.connect(updater);
      updater.flush();

      expect(part.node.classList).toHaveLength(2);
      expect(part.node.classList).toContain('foo');
      expect(part.node.classList).toContain('baz');
    });

    it('should do nothing if the update is already scheduled', () => {
      const directive = new ClassMapDirective({
        foo: true,
        bar: false,
        baz: true,
      });
      const part = {
        type: PartType.Attribute,
        name: 'class',
        node: document.createElement('div'),
      } as const;
      const binding = new ClassMapBinding(directive, part);
      const updater = new SyncUpdater(new MockRenderingEngine());
      const enqueueMutationEffectSpy = vi.spyOn(
        updater,
        'enqueueMutationEffect',
      );

      binding.connect(updater);
      binding.connect(updater);

      expect(enqueueMutationEffectSpy).toHaveBeenCalledOnce();
      expect(enqueueMutationEffectSpy).toHaveBeenCalledWith(binding);
    });
  });

  describe('.bind()', () => {
    it('should remove classes whose values are false from the element', () => {
      const directive = new ClassMapDirective({
        foo: true,
        bar: false,
        baz: true,
      });
      const part = {
        type: PartType.Attribute,
        name: 'class',
        node: document.createElement('div'),
      } as const;
      const binding = new ClassMapBinding(directive, part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      binding.connect(updater);
      updater.flush();

      binding.bind(new ClassMapDirective({ foo: false, bar: true }), updater);
      updater.flush();

      expect(part.node.classList).toHaveLength(1);
      expect(part.node.classList).toContain('bar');
    });

    it('should skip update if the classes are the same as the previous one', () => {
      const directive = new ClassMapDirective({
        foo: true,
        bar: false,
        baz: true,
      });
      const part = {
        type: PartType.Attribute,
        name: 'class',
        node: document.createElement('div'),
      } as const;
      const binding = new ClassMapBinding(directive, part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      binding.connect(updater);
      updater.flush();

      binding.bind(directive, updater);

      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });

    it('should throw an error if the new value is not ClassMapDirective', () => {
      const directive = new ClassMapDirective({
        foo: true,
      });
      const part = {
        type: PartType.Attribute,
        name: 'class',
        node: document.createElement('div'),
      } as const;
      const binding = new ClassMapBinding(directive, part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      expect(() => {
        binding.bind(null as any, updater);
      }).toThrow(
        'A value must be a instance of "ClassMapDirective", but got "null".',
      );
    });
  });

  describe('.unbind()', () => {
    it('should remove all classes from the element', () => {
      const directive = new ClassMapDirective({
        foo: true,
        bar: false,
        baz: true,
      });
      const part = {
        type: PartType.Attribute,
        name: 'class',
        node: document.createElement('div'),
      } as const;
      const binding = new ClassMapBinding(directive, part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      binding.connect(updater);
      updater.flush();

      binding.unbind(updater);
      updater.flush();

      expect(part.node.classList).toHaveLength(0);
    });

    it('should skip update if the current properties are empty', () => {
      const directive = new ClassMapDirective({});
      const part = {
        type: PartType.Attribute,
        name: 'class',
        node: document.createElement('div'),
      } as const;
      const binding = new ClassMapBinding(directive, part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      binding.unbind(updater);

      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });
  });

  describe('.disconnect()', () => {
    it('should do nothing', () => {
      const directive = new ClassMapDirective({
        foo: true,
      });
      const part = {
        type: PartType.Attribute,
        name: 'class',
        node: document.createElement('div'),
      } as const;
      const binding = new ClassMapBinding(directive, part);

      binding.disconnect();
    });
  });
});
