import { describe, expect, it, vi } from 'vitest';

import {
  AttributeBinding,
  EventBinding,
  NodeBinding,
  PropertyBinding,
  SpreadBinding,
  directiveTag,
  isDirective,
  mountValue,
  resolveBinding,
} from '../src/binding.js';
import { Engine } from '../src/engine.js';
import { Part, PartType } from '../src/part.js';
import { SyncUpdater } from '../src/updater.js';
import { MockBinding, MockDirective } from './mocks.js';

describe('AttributeBinding', () => {
  describe('.constructor()', () => {
    it('should construct a new AttributeBinding', () => {
      const element = document.createElement('div');
      const part = {
        type: PartType.Attribute,
        node: element,
        name: 'class',
      } as const;
      const binding = new AttributeBinding('foo', part);

      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(element);
      expect(binding.endNode).toBe(element);
      expect(binding.value).toBe('foo');
    });
  });

  describe('.bind()', () => {
    it('should update the attribute with the passed string', () => {
      const element = document.createElement('div');
      const part = {
        type: PartType.Attribute,
        node: element,
        name: 'class',
      } as const;
      const binding = new AttributeBinding('foo', part);
      const updater = new SyncUpdater(new Engine());

      binding.rebind(updater);
      updater.flush();

      expect(binding.value).toBe('foo');
      expect(element.getAttribute('class')).toBe('foo');

      binding.bind('bar', updater);
      updater.flush();

      expect(binding.value).toBe('bar');
      expect(element.getAttribute('class')).toBe('bar');
    });

    it('should update the attribute with the string representation of the object', () => {
      const obj1 = {
        toString() {
          return 'foo';
        },
      };
      const obj2 = {
        toString() {
          return 'bar';
        },
      };
      const element = document.createElement('div');
      const part = {
        type: PartType.Attribute,
        node: element,
        name: 'class',
      } as const;
      const binding = new AttributeBinding(obj1, part);
      const updater = new SyncUpdater(new Engine());

      binding.rebind(updater);
      updater.flush();

      expect(binding.value).toBe(obj1);
      expect(element.getAttribute('class')).toBe('foo');

      binding.bind(obj2, updater);
      updater.flush();

      expect(binding.value).toBe(obj2);
      expect(element.getAttribute('class')).toBe('bar');
    });

    it('should toggle the attribute according to the boolean value', () => {
      const element = document.createElement('div');
      const part = {
        type: PartType.Attribute,
        node: element,
        name: 'contenteditable',
      } as const;
      const binding = new AttributeBinding(true, part);
      const updater = new SyncUpdater(new Engine());

      binding.rebind(updater);
      updater.flush();

      expect(binding.value).toBe(true);
      expect(element.hasAttribute('contenteditable')).toBe(true);

      binding.bind(false, updater);
      updater.flush();

      expect(binding.value).toBe(false);
      expect(element.hasAttribute('contenteditable')).toBe(false);
    });

    it('should remove the attribute when null is passed', () => {
      const element = document.createElement('div');
      const part = {
        type: PartType.Attribute,
        node: element,
        name: 'contenteditable',
      } as const;
      const binding = new AttributeBinding(null, part);
      const updater = new SyncUpdater(new Engine());

      element.toggleAttribute('contenteditable', true);
      binding.rebind(updater);
      updater.flush();

      expect(binding.value).toBe(null);
      expect(element.hasAttribute('contenteditable')).toBe(false);
    });

    it('should remove the attribute when undefined is passed', () => {
      const element = document.createElement('div');
      const part = {
        type: PartType.Attribute,
        node: element,
        name: 'contenteditable',
      } as const;
      const binding = new AttributeBinding(undefined, part);
      const updater = new SyncUpdater(new Engine());

      element.toggleAttribute('contenteditable', true);
      binding.rebind(updater);
      updater.flush();

      expect(binding.value).toBe(undefined);
      expect(element.hasAttribute('contenteditable')).toBe(false);
    });

    it('should not update the binding if the new and old values are the same', () => {
      const element = document.createElement('div');
      const part = {
        type: PartType.Attribute,
        node: element,
        name: 'class',
      } as const;
      const binding = new AttributeBinding('foo', part);
      const updater = new SyncUpdater(new Engine());

      binding.bind('foo', updater);

      expect(binding.value).toBe('foo');
      expect(updater.isScheduled()).toBe(false);
    });

    it('should do nothing if called twice', () => {
      const element = document.createElement('div');
      const part = {
        type: PartType.Attribute,
        node: element,
        name: 'contenteditable',
      } as const;
      const binding = new AttributeBinding(undefined, part);
      const updater = new SyncUpdater(new Engine());

      const enqueueMutationEffectSpy = vi.spyOn(
        updater,
        'enqueueMutationEffect',
      );

      binding.rebind(updater);
      binding.rebind(updater);

      expect(enqueueMutationEffectSpy).toHaveBeenCalledOnce();
      expect(enqueueMutationEffectSpy).toHaveBeenCalledWith(binding);
    });

    it('should throw the error if the value is a directive', () => {
      expect(() => {
        const binding = new AttributeBinding(null, {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: 'class',
        });
        const updater = new SyncUpdater(new Engine());
        binding.bind(new MockDirective(), updater);
      }).toThrow('A value must not be a directive,');
    });
  });

  describe('.unbind()', () => {
    it('should remove the attribute', () => {
      const element = document.createElement('div');
      const part = {
        type: PartType.Attribute,
        node: element,
        name: 'contenteditable',
      } as const;
      const binding = new AttributeBinding(true, part);
      const updater = new SyncUpdater(new Engine());

      element.toggleAttribute('contenteditable', true);
      binding.unbind(updater);
      updater.flush();

      expect(binding.value).toBe(null);
      expect(element.hasAttribute('contenteditable')).toBe(false);
    });

    it('should do nothing if called twice', () => {
      const element = document.createElement('div');
      const part = {
        type: PartType.Attribute,
        node: element,
        name: 'contenteditable',
      } as const;
      const binding = new AttributeBinding(undefined, part);
      const updater = new SyncUpdater(new Engine());

      const enqueueMutationEffectSpy = vi.spyOn(
        updater,
        'enqueueMutationEffect',
      );

      binding.unbind(updater);
      binding.unbind(updater);

      expect(enqueueMutationEffectSpy).toHaveBeenCalledOnce();
      expect(enqueueMutationEffectSpy).toHaveBeenCalledWith(binding);
    });
  });

  describe('.disconnect()', () => {
    it('should do nothing', () => {
      const element = document.createElement('div');
      const part = {
        type: PartType.Attribute,
        node: element,
        name: 'contenteditable',
      } as const;
      const binding = new AttributeBinding(true, part);

      binding.disconnect();
    });
  });
});

describe('EventBinding', () => {
  describe('.constructor()', () => {
    it('should construct a new EventBinding', () => {
      const listener = () => {};
      const element = document.createElement('div');
      const part = {
        type: PartType.Event,
        node: element,
        name: 'hello',
      } as const;
      const binding = new EventBinding(listener, part);

      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(element);
      expect(binding.endNode).toBe(element);
      expect(binding.value).toBe(listener);
    });

    it('should throw the error if the value other than an event listner is passed', () => {
      expect(() => {
        new EventBinding(
          {},
          {
            type: PartType.Event,
            node: document.createElement('div'),
            name: 'hello',
          },
        );
      }).toThrow(
        'A value of EventBinding must be EventListener, EventListenerObject or null.',
      );
      expect(() => {
        new EventBinding(undefined, {
          type: PartType.Event,
          node: document.createElement('div'),
          name: 'hello',
        });
      }).toThrow(
        'A value of EventBinding must be EventListener, EventListenerObject or null.',
      );
    });
  });

  describe('.bind()', () => {
    it('should attach the function to the element as an event listener', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const event = new CustomEvent('hello');
      const element = document.createElement('div');
      const part = {
        type: PartType.Event,
        node: element,
        name: 'hello',
      } as const;
      const binding = new EventBinding(listener1, part);
      const updater = new SyncUpdater(new Engine());

      const addEventListenerSpy = vi.spyOn(element, 'addEventListener');

      binding.rebind(updater);
      updater.flush();
      element.dispatchEvent(event);

      expect(addEventListenerSpy).toHaveBeenCalledOnce();
      expect(addEventListenerSpy).toHaveBeenCalledWith('hello', binding);
      expect(listener1).toHaveBeenCalledOnce();
      expect(listener1).toHaveBeenCalledWith(event);
      expect(listener2).not.toHaveBeenCalled();

      binding.bind(listener2, updater);
      updater.flush();
      element.dispatchEvent(event);

      expect(listener1).toHaveBeenCalledOnce();
      expect(listener2).toHaveBeenCalledWith(event);
    });

    it('should attach the object to the element as an event listener', () => {
      const listener1 = {
        capture: true,
        handleEvent: vi.fn(),
      };
      const listener2 = {
        capture: false,
        handleEvent: vi.fn(),
      };
      const event = new CustomEvent('hello');
      const element = document.createElement('div');
      const part = {
        type: PartType.Event,
        node: element,
        name: 'hello',
      } as const;
      const binding = new EventBinding(listener1, part);
      const updater = new SyncUpdater(new Engine());

      const addEventListenerSpy = vi.spyOn(element, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(element, 'removeEventListener');

      binding.rebind(updater);
      updater.flush();
      element.dispatchEvent(event);

      expect(addEventListenerSpy).toHaveBeenCalledTimes(1);
      expect(addEventListenerSpy).toHaveBeenLastCalledWith(
        'hello',
        binding,
        listener1,
      );
      expect(listener1.handleEvent).toHaveBeenCalledOnce();
      expect(listener1.handleEvent).toHaveBeenCalledWith(event);
      expect(listener2.handleEvent).not.toHaveBeenCalled();

      binding.bind(listener2, updater);
      updater.flush();
      element.dispatchEvent(event);

      expect(addEventListenerSpy).toHaveBeenCalledTimes(2);
      expect(addEventListenerSpy).toHaveBeenLastCalledWith(
        'hello',
        binding,
        listener2,
      );
      expect(removeEventListenerSpy).toHaveBeenCalledOnce();
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'hello',
        binding,
        listener1,
      );
      expect(listener2.handleEvent).toHaveBeenCalledOnce();
      expect(listener2.handleEvent).toHaveBeenCalledWith(event);
    });

    it('should not attach the event listener if the new and current listeners are the same', () => {
      const listener = () => {};
      const element = document.createElement('div');
      const part = {
        type: PartType.Event,
        node: element,
        name: 'hello',
      } as const;
      const binding = new EventBinding(listener, part);
      const updater = new SyncUpdater(new Engine());

      const addEventListenerSpy = vi.spyOn(element, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(element, 'removeEventListener');

      binding.rebind(updater);
      updater.flush();

      expect(addEventListenerSpy).toHaveBeenCalledOnce();
      expect(removeEventListenerSpy).not.toHaveBeenCalled();

      binding.bind(listener, updater);

      expect(updater.isScheduled()).toBe(false);
    });

    it('should detach the active event listener when null is passed', () => {
      const element = document.createElement('div');
      const part = {
        type: PartType.Event,
        node: element,
        name: 'hello',
      } as const;
      const listener = vi.fn();
      const event = new CustomEvent('hello');
      const binding = new EventBinding(listener, part);
      const updater = new SyncUpdater(new Engine());

      const addEventListenerSpy = vi.spyOn(element, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(element, 'removeEventListener');

      binding.rebind(updater);
      updater.flush();
      element.dispatchEvent(event);

      binding.bind(null, updater);
      updater.flush();
      element.dispatchEvent(event);

      expect(addEventListenerSpy).toHaveBeenCalledOnce();
      expect(addEventListenerSpy).toHaveBeenCalledWith('hello', binding);
      expect(removeEventListenerSpy).toHaveBeenCalledOnce();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('hello', binding);
      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith(event);
    });

    it('should do nothing if called twice', () => {
      const listener = () => {};
      const element = document.createElement('div');
      const part = {
        type: PartType.Event,
        node: element,
        name: 'click',
      } as const;
      const binding = new EventBinding(listener, part);
      const updater = new SyncUpdater(new Engine());

      const enqueueMutationEffectSpy = vi.spyOn(
        updater,
        'enqueueMutationEffect',
      );

      binding.rebind(updater);
      binding.rebind(updater);

      expect(enqueueMutationEffectSpy).toHaveBeenCalledOnce();
      expect(enqueueMutationEffectSpy).toHaveBeenCalledWith(binding);
    });

    it('should throw the error if the value other than an event listner or null is assigned', () => {
      expect(() => {
        const binding = new EventBinding(null, {
          type: PartType.Event,
          node: document.createElement('div'),
          name: 'hello',
        });
        const updater = new SyncUpdater(new Engine());
        binding.bind({}, updater);
      }).toThrow(
        'A value of EventBinding must be EventListener, EventListenerObject or null.',
      );
      expect(() => {
        const binding = new EventBinding(null, {
          type: PartType.Event,
          node: document.createElement('div'),
          name: 'hello',
        });
        const updater = new SyncUpdater(new Engine());
        binding.bind(undefined, updater);
      }).toThrow(
        'A value of EventBinding must be EventListener, EventListenerObject or null.',
      );
    });
  });

  describe('.unbind()', () => {
    it('should detach the active event listener', () => {
      const listener = vi.fn();
      const element = document.createElement('div');
      const part = {
        type: PartType.Event,
        node: element,
        name: 'hello',
      } as const;
      const event = new CustomEvent('hello');
      const binding = new EventBinding(listener, part);
      const updater = new SyncUpdater(new Engine());

      const addEventListenerSpy = vi.spyOn(element, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(element, 'removeEventListener');

      binding.rebind(updater);
      updater.flush();
      element.dispatchEvent(event);

      binding.unbind(updater);
      updater.flush();
      element.dispatchEvent(event);

      expect(binding.value).toBe(null);
      expect(addEventListenerSpy).toHaveBeenCalledOnce();
      expect(addEventListenerSpy).toHaveBeenCalledWith('hello', binding);
      expect(removeEventListenerSpy).toHaveBeenCalledOnce();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('hello', binding);
      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith(event);
    });

    it('should do nothing if called twice', () => {
      const listener = () => {};
      const element = document.createElement('div');
      const part = {
        type: PartType.Event,
        node: element,
        name: 'click',
      } as const;
      const binding = new EventBinding(listener, part);
      const updater = new SyncUpdater(new Engine());

      binding.rebind(updater);

      updater.flush();

      const enqueueMutationEffectSpy = vi.spyOn(
        updater,
        'enqueueMutationEffect',
      );

      binding.unbind(updater);
      binding.unbind(updater);

      expect(enqueueMutationEffectSpy).toHaveBeenCalledOnce();
      expect(enqueueMutationEffectSpy).toHaveBeenCalledWith(binding);
    });

    it('should do nothing if there is no active listner', () => {
      const listener = () => {};
      const element = document.createElement('div');
      const part = {
        type: PartType.Event,
        node: element,
        name: 'click',
      } as const;
      const binding = new EventBinding(listener, part);
      const updater = new SyncUpdater(new Engine());
      const enqueueMutationEffectSpy = vi.spyOn(
        updater,
        'enqueueMutationEffect',
      );

      binding.unbind(updater);
      binding.unbind(updater);

      expect(enqueueMutationEffectSpy).not.toHaveBeenCalled();
    });
  });

  describe('.disconnect()', () => {
    it('should detach the active event listener function', () => {
      const listener = () => {};
      const element = document.createElement('div');
      const part = {
        type: PartType.Event,
        node: element,
        name: 'hello',
      } as const;
      const binding = new EventBinding(listener, part);
      const updater = new SyncUpdater(new Engine());

      const addEventListenerSpy = vi.spyOn(element, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(element, 'removeEventListener');

      binding.rebind(updater);
      updater.flush();

      binding.disconnect();

      expect(addEventListenerSpy).toHaveBeenCalledOnce();
      expect(addEventListenerSpy).toHaveBeenCalledWith('hello', binding);
      expect(removeEventListenerSpy).toHaveBeenCalledOnce();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('hello', binding);

      binding.disconnect();

      expect(
        addEventListenerSpy,
        'Do nothing if the event listener is already detached.',
      ).toHaveBeenCalledOnce();
      expect(
        removeEventListenerSpy,
        'Do nothing if the event listener is already detached.',
      ).toHaveBeenCalledOnce();
    });

    it('should detach the active event listener object', () => {
      const listener = { handleEvent: () => {}, capture: true };
      const element = document.createElement('div');
      const part = {
        type: PartType.Event,
        node: element,
        name: 'hello',
      } as const;
      const binding = new EventBinding(listener, part);
      const updater = new SyncUpdater(new Engine());

      const addEventListenerSpy = vi.spyOn(element, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(element, 'removeEventListener');

      binding.rebind(updater);
      updater.flush();

      binding.disconnect();

      expect(addEventListenerSpy).toHaveBeenCalledOnce();
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'hello',
        binding,
        listener,
      );
      expect(removeEventListenerSpy).toHaveBeenCalledOnce();
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'hello',
        binding,
        listener,
      );

      binding.disconnect();

      expect(
        addEventListenerSpy,
        'Do nothing if the event listener is already detached.',
      ).toHaveBeenCalledOnce();
      expect(
        removeEventListenerSpy,
        'Do nothing if the event listener is already detached.',
      ).toHaveBeenCalledOnce();
    });
  });
});

describe('NodeBinding', () => {
  describe('.constructor()', () => {
    it('should construct a new NodeBinding', () => {
      const listener = () => {};
      const element = document.createElement('div');
      const part = {
        type: PartType.Node,
        node: element,
      } as const;
      const binding = new NodeBinding(listener, part);

      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(element);
      expect(binding.endNode).toBe(element);
      expect(binding.value).toBe(listener);
    });
  });

  describe('.bind()', () => {
    it('should update the value of the node', () => {
      const node = document.createTextNode('');
      const part = {
        type: PartType.Node,
        node,
      } as const;
      const binding = new NodeBinding('foo', part);
      const updater = new SyncUpdater(new Engine());

      binding.rebind(updater);
      updater.flush();

      expect(binding.value).toBe('foo');
      expect(node.nodeValue).toBe('foo');

      binding.bind('bar', updater);
      updater.flush();

      expect(binding.value).toBe('bar');
      expect(node.nodeValue).toBe('bar');

      binding.bind(null, updater);
      updater.flush();
      updater.flush();

      expect(binding.value).toBe(null);
      expect(node.nodeValue).toBe('');
    });

    it('should not update the binding if the new and old values are the same', () => {
      const node = document.createTextNode('');
      const part = {
        type: PartType.Node,
        node,
      } as const;
      const updater = new SyncUpdater(new Engine());
      const binding = new NodeBinding('foo', part);

      binding.bind('foo', updater);

      expect(binding.value).toBe('foo');
      expect(updater.isScheduled()).toBe(false);
    });

    it('should do nothing if called twice', () => {
      const node = document.createTextNode('');
      const part = {
        type: PartType.Node,
        node,
      } as const;
      const binding = new NodeBinding(undefined, part);
      const updater = new SyncUpdater(new Engine());
      const enqueueMutationEffectSpy = vi.spyOn(
        updater,
        'enqueueMutationEffect',
      );

      binding.rebind(updater);
      binding.rebind(updater);

      expect(enqueueMutationEffectSpy).toHaveBeenCalledOnce();
      expect(enqueueMutationEffectSpy).toHaveBeenCalledWith(binding);
    });

    it('should throw the error if the value is a directive', () => {
      expect(() => {
        const binding = new NodeBinding('foo', {
          type: PartType.Node,
          node: document.createElement('div'),
        });
        const updater = new SyncUpdater(new Engine());
        binding.bind(new MockDirective(), updater);
      }).toThrow('A value must not be a directive,');
    });
  });

  describe('.unbind()', () => {
    it('should set null to the value of the node', () => {
      const node = document.createTextNode('');
      const part = {
        type: PartType.Node,
        node,
      } as const;
      const binding = new NodeBinding('foo', part);
      const updater = new SyncUpdater(new Engine());

      binding.rebind(updater);
      updater.flush();

      expect(binding.value).toBe('foo');
      expect(node.nodeValue).toBe('foo');

      binding.unbind(updater);
      updater.flush();

      expect(binding.value).toBe(null);
      expect(node.nodeValue).toBe('');
    });

    it('should do nothing if called twice', () => {
      const node = document.createTextNode('');
      const part = {
        type: PartType.Node,
        node,
      } as const;
      const binding = new NodeBinding(undefined, part);
      const updater = new SyncUpdater(new Engine());
      const enqueueMutationEffectSpy = vi.spyOn(
        updater,
        'enqueueMutationEffect',
      );

      binding.unbind(updater);
      binding.unbind(updater);

      expect(enqueueMutationEffectSpy).toHaveBeenCalledOnce();
      expect(enqueueMutationEffectSpy).toHaveBeenCalledWith(binding);
    });
  });

  describe('.disconnect()', () => {
    it('should do nothing', () => {
      const node = document.createTextNode('');
      const part = {
        type: PartType.Node,
        node,
      } as const;
      const binding = new NodeBinding('foo', part);

      binding.disconnect();
    });
  });
});

describe('PropertyBinding', () => {
  describe('.constructor()', () => {
    it('should construct a new PropertyBinding', () => {
      const element = document.createElement('div');
      const part = {
        type: PartType.Property,
        node: element,
        name: 'className',
      } as const;
      const binding = new PropertyBinding('foo', part);

      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(element);
      expect(binding.endNode).toBe(element);
      expect(binding.value).toBe('foo');
    });
  });

  describe('.bind()', () => {
    it('should update the property of the element', () => {
      const element = document.createElement('div');
      const part = {
        type: PartType.Property,
        node: element,
        name: 'className',
      } as const;
      const binding = new PropertyBinding('foo', part);
      const updater = new SyncUpdater(new Engine());

      binding.rebind(updater);
      updater.flush();

      expect(binding.value).toBe('foo');
      expect(element.className).toBe('foo');

      binding.bind('bar', updater);
      updater.flush();

      expect(binding.value).toBe('bar');
      expect(element.className).toBe('bar');
    });

    it('should not update the binding if the new and old values are the same', () => {
      const element = document.createElement('div');
      const part = {
        type: PartType.Property,
        node: element,
        name: 'className',
      } as const;
      const updater = new SyncUpdater(new Engine());
      const binding = new PropertyBinding('foo', part);

      binding.bind('foo', updater);

      expect(binding.value).toBe('foo');
      expect(updater.isScheduled()).toBe(false);
    });

    it('should do nothing if called twice', () => {
      const element = document.createElement('div');
      const part = {
        type: PartType.Property,
        node: element,
        name: 'className',
      } as const;
      const binding = new PropertyBinding(undefined, part);
      const updater = new SyncUpdater(new Engine());
      const enqueueMutationEffectSpy = vi.spyOn(
        updater,
        'enqueueMutationEffect',
      );

      binding.rebind(updater);
      binding.rebind(updater);

      expect(enqueueMutationEffectSpy).toHaveBeenCalledOnce();
      expect(enqueueMutationEffectSpy).toHaveBeenCalledWith(binding);
    });

    it('should throw the error if the value is a directive', () => {
      expect(() => {
        const binding = new PropertyBinding('foo', {
          type: PartType.Property,
          node: document.createElement('div'),
          name: 'className',
        });
        const updater = new SyncUpdater(new Engine());
        binding.bind(new MockDirective(), updater);
      }).toThrow('A value must not be a directive,');
    });
  });

  describe('.unbind()', () => {
    it('should do nothing', () => {
      const element = document.createElement('div');
      const setterSpy = vi.spyOn(element, 'className', 'set');
      const part = {
        type: PartType.Property,
        node: element,
        name: 'className',
      } as const;
      const binding = new PropertyBinding('foo', part);
      const updater = new SyncUpdater(new Engine());

      binding.unbind(updater);
      updater.flush();

      expect(setterSpy).not.toHaveBeenCalled();
    });
  });

  describe('.disconnect()', () => {
    it('should do nothing', () => {
      const element = document.createElement('div');
      const setterSpy = vi.spyOn(element, 'className', 'set');
      const part = {
        type: PartType.Property,
        node: element,
        name: 'className',
      } as const;
      const binding = new PropertyBinding('foo', part);
      const updater = new SyncUpdater(new Engine());

      binding.disconnect();
      updater.flush();

      expect(setterSpy).not.toHaveBeenCalled();
    });
  });
});

describe('SpreadBinding', () => {
  describe('.constructor()', () => {
    it('should construct a new SpreadBinding', () => {
      const props = {};
      const element = document.createElement('div');
      const part = {
        type: PartType.Element,
        node: element,
      } as const;
      const binding = new SpreadBinding(props, part);

      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(element);
      expect(binding.endNode).toBe(element);
      expect(binding.value).toBe(props);
    });

    it('should throw the error when a non-object value is passed', () => {
      expect(() => {
        new SpreadBinding(null, {
          type: PartType.Element,
          node: document.createElement('div'),
        });
      }).toThrow('A value of SpreadBinding must be an object,');
    });
  });

  describe('.value', () => {
    it('should throw the error when a non-object value is passed', () => {
      expect(() => {
        const binding = new SpreadBinding(
          {},
          {
            type: PartType.Element,
            node: document.createElement('div'),
          },
        );
        const updater = new SyncUpdater(new Engine());
        binding.bind(null, updater);
      }).toThrow('A value of SpreadBinding must be an object,');
    });
  });

  describe('.rebind()', () => {
    it('should bind element attributes', () => {
      const props = {
        class: 'foo',
        title: 'bar',
      };
      const element = document.createElement('div');
      const part = {
        type: PartType.Element,
        node: element,
      } as const;
      const binding = new SpreadBinding(props, part);
      const updater = new SyncUpdater(new Engine());

      binding.rebind(updater);
      updater.flush();

      expect(element.getAttribute('class')).toBe('foo');
      expect(element.getAttribute('title')).toBe('bar');
    });

    it('should bind element properities by properities starting with "."', () => {
      const props = {
        '.className': 'foo',
        '.title': 'bar',
      };
      const element = document.createElement('div');
      const part = {
        type: PartType.Element,
        node: element,
      } as const;
      const binding = new SpreadBinding(props, part);
      const updater = new SyncUpdater(new Engine());

      binding.rebind(updater);
      updater.flush();

      expect(element.className).toBe('foo');
      expect(element.title).toBe('bar');
    });

    it('should bind event listeners by properities starting with "@"', () => {
      const props = {
        '@click': () => {},
        '@touchstart': () => {},
      };
      const element = document.createElement('div');
      const addEventListenerSpy = vi.spyOn(element, 'addEventListener');
      const part = {
        type: PartType.Element,
        node: element,
      } as const;
      const binding = new SpreadBinding(props, part);
      const updater = new SyncUpdater(new Engine());

      binding.rebind(updater);
      updater.flush();

      expect(addEventListenerSpy).toHaveBeenCalledTimes(2);
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'click',
        expect.any(EventBinding),
      );
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'touchstart',
        expect.any(EventBinding),
      );
    });

    it('should skip bindings that are passed the same value as last time', () => {
      const props = {
        class: 'foo',
        title: 'bar',
      };
      const element = document.createElement('div');
      const setAttributeSpy = vi.spyOn(element, 'setAttribute');
      const part = {
        type: PartType.Element,
        node: element,
      } as const;
      const binding = new SpreadBinding(props, part);
      const updater = new SyncUpdater(new Engine());

      binding.rebind(updater);
      updater.flush();

      binding.bind(
        {
          class: 'foo', // same value as last time
          title: 'baz',
        },
        updater,
      );
      updater.flush();

      expect(setAttributeSpy).toHaveBeenCalledTimes(3);
      expect(setAttributeSpy).toHaveBeenCalledWith('class', 'foo');
      expect(setAttributeSpy).toHaveBeenCalledWith('title', 'bar');
      expect(setAttributeSpy).toHaveBeenCalledWith('title', 'baz');
      expect(element.getAttribute('class')).toBe('foo');
      expect(element.getAttribute('title')).toBe('baz');
    });

    it('should unbind bindings that no longer exists', () => {
      const props = {
        class: 'foo',
        title: 'bar',
      };
      const element = document.createElement('div');
      const part = {
        type: PartType.Element,
        node: element,
      } as const;
      const binding = new SpreadBinding(props, part);
      const updater = new SyncUpdater(new Engine());

      binding.rebind(updater);
      updater.flush();

      binding.bind({ class: undefined }, updater);
      updater.flush();

      expect(element.hasAttribute('class')).toBe(false);
      expect(element.hasAttribute('title')).toBe(false);
    });
  });

  describe('.unbind()', () => {
    it('should unbind all bound properities', () => {
      const props = {
        class: 'foo',
        title: 'bar',
      };
      const element = document.createElement('div');
      const part = {
        type: PartType.Element,
        node: element,
      } as const;
      const binding = new SpreadBinding(props, part);
      const updater = new SyncUpdater(new Engine());

      binding.rebind(updater);
      updater.flush();

      binding.unbind(updater);
      updater.flush();

      expect(element.hasAttribute('class')).toBe(false);
      expect(element.hasAttribute('title')).toBe(false);
    });
  });

  describe('.disconnect()', () => {
    it('should disconnect all bound properities', () => {
      let disconnects = 0;

      const createMockDirective = () =>
        Object.assign(new MockDirective(), {
          [directiveTag](this: MockDirective, part: Part): MockBinding {
            return Object.assign(new MockBinding(this, part), {
              disconnect() {
                disconnects++;
              },
            });
          },
        });
      const props = {
        foo: createMockDirective(),
        bar: createMockDirective(),
      };
      const element = document.createElement('div');
      const part = {
        type: PartType.Element,
        node: element,
      } as const;
      const binding = new SpreadBinding(props, part);
      const updater = new SyncUpdater(new Engine());

      binding.rebind(updater);
      updater.flush();

      binding.disconnect();

      expect(disconnects).toBe(2);
    });
  });
});

describe('resolveBinding()', () => {
  it('should perform the value if it is a directive', () => {
    const part = {
      type: PartType.Node,
      node: document.createTextNode(''),
    } as const;
    const directive = new MockDirective();
    const directiveSpy = vi.spyOn(directive, directiveTag);
    const updater = new SyncUpdater(new Engine());
    const binding = resolveBinding(directive, part, updater);

    expect(binding).toBeInstanceOf(MockBinding);
    expect(directiveSpy).toHaveBeenCalledOnce();
    expect(directiveSpy).toHaveBeenCalledWith(part, updater);
  });

  it('should resolve the value as a AttributeBinding if the part is a AttributePart', () => {
    const element = document.createElement('div');
    const part = {
      type: PartType.Attribute,
      node: element,
      name: 'class',
    } as const;
    const updater = new SyncUpdater(new Engine());
    const binding = resolveBinding('foo', part, updater);

    expect(binding).toBeInstanceOf(AttributeBinding);
    expect(binding.value).toBe('foo');
    expect(updater.isScheduled()).toBe(false);
  });

  it('should resolve the value as a EventBinding if the part is a EventPart', () => {
    const listener = vi.fn();
    const element = document.createElement('div');
    const part = {
      type: PartType.Event,
      node: element,
      name: 'hello',
    } as const;
    const updater = new SyncUpdater(new Engine());
    const binding = resolveBinding(listener, part, updater);

    expect(binding).toBeInstanceOf(EventBinding);
    expect(binding.value).toBe(listener);
    expect(updater.isScheduled()).toBe(false);
  });

  it('should resolve the value as a PropertyBinding if the part is a PropertyPart', () => {
    const element = document.createElement('div');
    const part = {
      type: PartType.Property,
      node: element,
      name: 'className',
    } as const;
    const updater = new SyncUpdater(new Engine());
    const binding = resolveBinding('foo', part, updater);

    expect(binding).toBeInstanceOf(PropertyBinding);
    expect(binding.value).toBe('foo');
    expect(updater.isScheduled()).toBe(false);
  });

  it('should resolve the value as a NodeBinding if the part is a NodePart', () => {
    const node = document.createTextNode('');
    const part = {
      type: PartType.Node,
      node,
    } as const;
    const updater = new SyncUpdater(new Engine());
    const binding = resolveBinding('foo', part, updater);

    expect(binding).toBeInstanceOf(NodeBinding);
    expect(binding.value).toBe('foo');
    expect(updater.isScheduled()).toBe(false);
  });

  it('should resolve the value as a NodeBinding if the part is a ChildNodePart', () => {
    const node = document.createComment('');
    const part = {
      type: PartType.ChildNode,
      node,
    } as const;
    const updater = new SyncUpdater(new Engine());
    const binding = resolveBinding('foo', part, updater);

    expect(binding).toBeInstanceOf(NodeBinding);
    expect(binding.value).toBe('foo');
    expect(updater.isScheduled()).toBe(false);
  });

  it('should resolve the value as a SpreadBinding if the part is a ElementPart', () => {
    const element = document.createElement('div');
    const part = {
      type: PartType.Element,
      node: element,
    } as const;
    const updater = new SyncUpdater(new Engine());
    const props = {
      class: 'foo',
      title: 'bar',
    };
    const binding = resolveBinding(props, part, updater);

    binding.rebind(updater);
    updater.flush();

    expect(binding).toBeInstanceOf(SpreadBinding);
    expect(binding.value).toBe(props);
    expect(updater.isScheduled()).toBe(false);
  });
});

describe('isDirective()', () => {
  it('should return true if the value is directive', () => {
    expect(isDirective(null)).toBe(false);
    expect(isDirective('')).toBe(false);
    expect(isDirective({})).toBe(false);
    expect(isDirective({ [directiveTag]: () => {} })).toBe(true);
  });
});

describe('mountValue()', () => {
  it('should mount element inside the container', async () => {
    const directive = new MockDirective();
    const container = document.createElement('div');
    const updater = new SyncUpdater(new Engine());
    const directiveSpy = vi.spyOn(directive, directiveTag);
    const isUpdatingSpy = vi.spyOn(updater, 'isUpdating');
    const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');

    expect(mountValue(directive, container, updater)).toBeInstanceOf(
      MockBinding,
    );
    expect(directiveSpy).toHaveBeenCalledOnce();
    expect(isUpdatingSpy).toHaveBeenCalledOnce();
    expect(scheduleUpdateSpy).toHaveBeenCalled();

    await updater.waitForUpdate();

    expect(container.innerHTML).toBe('<!---->');
  });

  it('should not schedule update if it is already running', () => {
    const directive = new MockDirective();
    const container = document.createElement('div');
    const updater = new SyncUpdater(new Engine());
    const directiveSpy = vi.spyOn(directive, directiveTag);
    const isUpdatingSpy = vi.spyOn(updater, 'isUpdating').mockReturnValue(true);
    const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');

    expect(mountValue(directive, container, updater)).toBeInstanceOf(
      MockBinding,
    );
    expect(container.innerHTML).toBe('');
    expect(directiveSpy).toHaveBeenCalledOnce();
    expect(isUpdatingSpy).toHaveBeenCalledOnce();
    expect(scheduleUpdateSpy).not.toHaveBeenCalled();
  });
});
