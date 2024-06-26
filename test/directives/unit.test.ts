import { describe, expect, it } from 'vitest';

import { directiveTag } from '../../src/binding.js';
import { UnitBinding, UnitDirective, unit } from '../../src/directives/unit.js';
import { PartType } from '../../src/types.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockRenderingEngine } from '../mocks.js';

describe('UnitDirective', () => {
  describe('.constructor()', () => {
    it('should be forbidden from being called directly', () => {
      expect(() => new (UnitDirective as any)()).toThrow(
        'UnitDirective constructor cannot be called directly.',
      );
    });
  });

  describe('[directiveTag]()', () => {
    it('should return a new instance of UnitBinding', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const updater = new SyncUpdater(new MockRenderingEngine());
      const binding = UnitDirective.instance[directiveTag](part, updater);

      expect(binding.value).toBe(UnitDirective.instance);
      expect(binding.part).toBe(part);
    });
  });
});

describe('UnitBinding', () => {
  describe('.constructor()', () => {
    it('should construct a new UnitBinding', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new UnitBinding(part);

      expect(binding.value).toBe(UnitDirective.instance);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
    });
  });

  describe('.connect()', () => {
    it('should do nothing', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new UnitBinding(part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      binding.connect(updater);

      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });
  });

  describe('.bind()', () => {
    it('should do nothing', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new UnitBinding(part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      binding.bind(UnitDirective.instance, updater);

      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });

    it('should throw an error if the new value is not UnitDirective', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new UnitBinding(part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      expect(() => binding.bind(null as any, updater)).toThrow(
        'A value must be a instance of "UnitDirective", but got "null".',
      );
    });
  });

  describe('.unbind()', () => {
    it('should do nothing', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new UnitBinding(part);
      const updater = new SyncUpdater(new MockRenderingEngine());

      binding.unbind(updater);

      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });
  });

  describe('.disconnect()', () => {
    it('should do nothing', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new UnitBinding(part);

      binding.disconnect();
    });
  });
});

describe('unit', () => {
  it('should be the same as UnitDirective.instance', () => {
    expect(unit).toBe(UnitDirective.instance);
  });
});
