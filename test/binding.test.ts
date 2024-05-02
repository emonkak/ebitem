import { describe, expect, it, vi } from 'vitest';

import {
  AttributeBinding,
  Binding,
  EventBinding,
  NodeBinding,
  Part,
  PartType,
  PropertyBinding,
  SpreadBinding,
  directiveTag,
  initializeBinding,
  updateBinding,
} from '../src/binding.js';
import { Scope } from '../src/scope.js';
import { SyncUpdater } from '../src/updater/sync.js';
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
      const binding = new AttributeBinding('foo', {
        type: PartType.Attribute,
        node: element,
        name: 'class',
      });
      const updater = new SyncUpdater(new Scope());

      binding.bind(updater);
      updater.flush();

      expect(binding.value).toBe('foo');
      expect(element.getAttribute('class')).toBe('foo');

      binding.value = 'bar';
      binding.bind(updater);
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
      const binding = new AttributeBinding(obj1, {
        type: PartType.Attribute,
        node: element,
        name: 'class',
      });
      const updater = new SyncUpdater(new Scope());

      binding.bind(updater);
      updater.flush();

      expect(binding.value).toBe(obj1);
      expect(element.getAttribute('class')).toBe('foo');

      binding.value = obj2;
      binding.bind(updater);
      updater.flush();

      expect(binding.value).toBe(obj2);
      expect(element.getAttribute('class')).toBe('bar');
    });

    it('should toggle the attribute according to the boolean value', () => {
      const element = document.createElement('div');
      const binding = new AttributeBinding(true, {
        type: PartType.Attribute,
        node: element,
        name: 'contenteditable',
      });
      const updater = new SyncUpdater(new Scope());

      binding.bind(updater);
      updater.flush();

      expect(binding.value).toBe(true);
      expect(element.hasAttribute('contenteditable')).toBe(true);

      binding.value = false;
      binding.bind(updater);
      updater.flush();

      expect(binding.value).toBe(false);
      expect(element.hasAttribute('contenteditable')).toBe(false);
    });

    it('should remove the attribute when null is passed', () => {
      const element = document.createElement('div');
      const binding = new AttributeBinding(null, {
        type: PartType.Attribute,
        node: element,
        name: 'contenteditable',
      });
      const updater = new SyncUpdater(new Scope());

      element.toggleAttribute('contenteditable', true);
      binding.bind(updater);
      updater.flush();

      expect(binding.value).toBe(null);
      expect(element.hasAttribute('contenteditable')).toBe(false);
    });

    it('should remove the attribute when undefined is passed', () => {
      const element = document.createElement('div');
      const binding = new AttributeBinding(undefined, {
        type: PartType.Attribute,
        node: element,
        name: 'contenteditable',
      });
      const updater = new SyncUpdater(new Scope());

      element.toggleAttribute('contenteditable', true);
      binding.bind(updater);
      updater.flush();

      expect(binding.value).toBe(undefined);
      expect(element.hasAttribute('contenteditable')).toBe(false);
    });

    it('should do nothing if called twice', () => {
      const element = document.createElement('div');
      const binding = new AttributeBinding(undefined, {
        type: PartType.Attribute,
        node: element,
        name: 'contenteditable',
      });
      const updater = new SyncUpdater(new Scope());
      const enqueueMutationEffectSpy = vi.spyOn(
        updater,
        'enqueueMutationEffect',
      );

      binding.bind(updater);
      binding.bind(updater);

      expect(enqueueMutationEffectSpy).toHaveBeenCalledOnce();
      expect(enqueueMutationEffectSpy).toHaveBeenCalledWith(binding);
    });
  });

  describe('.unbind()', () => {
    it('should remove the attribute', () => {
      const element = document.createElement('div');
      const binding = new AttributeBinding(true, {
        type: PartType.Attribute,
        node: element,
        name: 'contenteditable',
      });
      const updater = new SyncUpdater(new Scope());

      element.toggleAttribute('contenteditable', true);
      binding.unbind(updater);
      updater.flush();

      expect(binding.value).toBe(null);
      expect(element.hasAttribute('contenteditable')).toBe(false);
    });

    it('should do nothing if called twice', () => {
      const element = document.createElement('div');
      const binding = new AttributeBinding(undefined, {
        type: PartType.Attribute,
        node: element,
        name: 'contenteditable',
      });
      const updater = new SyncUpdater(new Scope());
      const enqueueMutationEffectSpy = vi.spyOn(
        updater,
        'enqueueMutationEffect',
      );

      binding.bind(updater);
      binding.bind(updater);

      expect(enqueueMutationEffectSpy).toHaveBeenCalledOnce();
      expect(enqueueMutationEffectSpy).toHaveBeenCalledWith(binding);
    });
  });

  describe('.disconnect()', () => {
    it('should do nothing', () => {
      const element = document.createElement('div');
      const binding = new AttributeBinding(true, {
        type: PartType.Attribute,
        node: element,
        name: 'contenteditable',
      });

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
        'A value that EventBinding binds must be EventListener, EventListenerObject or null.',
      );
    });
  });

  describe('.value', () => {
    it('should throw the error if the value other than an event listner is assigned', () => {
      expect(() => {
        const binding = new EventBinding(null, {
          type: PartType.Event,
          node: document.createElement('div'),
          name: 'hello',
        });
        binding.value = {};
      }).toThrow(
        'A value that EventBinding binds must be EventListener, EventListenerObject or null.',
      );
    });
  });

  describe('.bind()', () => {
    it('should attach the function to the element as an event listener', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const element = document.createElement('div');
      const addEventListenerSpy = vi.spyOn(element, 'addEventListener');
      const part = {
        type: PartType.Event,
        node: element,
        name: 'hello',
      } as const;
      const event = new CustomEvent('hello');
      const binding = new EventBinding(listener1, part);
      const updater = new SyncUpdater(new Scope());

      binding.bind(updater);
      updater.flush();
      element.dispatchEvent(event);

      expect(addEventListenerSpy).toHaveBeenCalledOnce();
      expect(addEventListenerSpy).toHaveBeenCalledWith('hello', binding);
      expect(listener1).toHaveBeenCalledOnce();
      expect(listener1).toHaveBeenCalledWith(event);
      expect(listener2).not.toHaveBeenCalled();

      binding.value = listener2;
      binding.bind(updater);
      updater.flush();
      element.dispatchEvent(event);

      expect(listener1).toHaveBeenCalledOnce();
      expect(listener2).toHaveBeenCalledWith(event);
    });

    it('should attach the object to the element as an event listener', () => {
      const element = document.createElement('div');
      const addEventListenerSpy = vi.spyOn(element, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(element, 'removeEventListener');
      const part = {
        type: PartType.Event,
        node: element,
        name: 'hello',
      } as const;
      const event = new CustomEvent('hello');
      const listener1 = {
        capture: true,
        handleEvent: vi.fn(),
      };
      const listener2 = {
        capture: false,
        handleEvent: vi.fn(),
      };
      const binding = new EventBinding(listener1, part);
      const updater = new SyncUpdater(new Scope());

      binding.bind(updater);
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

      binding.value = listener2;
      binding.bind(updater);
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

    it('should detach the active event listener when null is passed', () => {
      const listener = vi.fn();
      const element = document.createElement('div');
      const addEventListenerSpy = vi.spyOn(element, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(element, 'removeEventListener');
      const part = {
        type: PartType.Event,
        node: element,
        name: 'hello',
      } as const;
      const event = new CustomEvent('hello');
      const binding = new EventBinding(listener, part);
      const updater = new SyncUpdater(new Scope());

      binding.bind(updater);
      updater.flush();
      element.dispatchEvent(event);

      binding.value = null;
      binding.bind(updater);
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
      const binding = new EventBinding(listener, {
        type: PartType.Event,
        node: element,
        name: 'click',
      });
      const updater = new SyncUpdater(new Scope());
      const enqueueMutationEffectSpy = vi.spyOn(
        updater,
        'enqueueMutationEffect',
      );

      binding.bind(updater);
      binding.bind(updater);

      expect(enqueueMutationEffectSpy).toHaveBeenCalledOnce();
      expect(enqueueMutationEffectSpy).toHaveBeenCalledWith(binding);
    });
  });

  describe('.unbind()', () => {
    it('should detach the active event listener', () => {
      const listener = vi.fn();
      const element = document.createElement('div');
      const addEventListenerSpy = vi.spyOn(element, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(element, 'removeEventListener');
      const part = {
        type: PartType.Event,
        node: element,
        name: 'hello',
      } as const;
      const event = new CustomEvent('hello');
      const binding = new EventBinding(listener, part);
      const updater = new SyncUpdater(new Scope());

      binding.bind(updater);
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
      const binding = new EventBinding(listener, {
        type: PartType.Event,
        node: element,
        name: 'click',
      });
      const updater = new SyncUpdater(new Scope());

      binding.bind(updater);

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
      const binding = new EventBinding(listener, {
        type: PartType.Event,
        node: element,
        name: 'click',
      });
      const updater = new SyncUpdater(new Scope());
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
      const addEventListenerSpy = vi.spyOn(element, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(element, 'removeEventListener');
      const binding = new EventBinding(listener, {
        type: PartType.Event,
        node: element,
        name: 'hello',
      });
      const updater = new SyncUpdater(new Scope());

      binding.bind(updater);
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
      const addEventListenerSpy = vi.spyOn(element, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(element, 'removeEventListener');
      const binding = new EventBinding(listener, {
        type: PartType.Event,
        node: element,
        name: 'hello',
      });
      const updater = new SyncUpdater(new Scope());

      binding.bind(updater);
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
      const binding = new NodeBinding('foo', {
        type: PartType.Node,
        node,
      });
      const updater = new SyncUpdater(new Scope());

      binding.bind(updater);
      updater.flush();

      expect(binding.value).toBe('foo');
      expect(node.nodeValue).toBe('foo');

      binding.value = 'bar';
      binding.bind(updater);
      updater.flush();

      expect(binding.value).toBe('bar');
      expect(node.nodeValue).toBe('bar');

      binding.value = null;
      binding.bind(updater);
      updater.flush();

      expect(binding.value).toBe(null);
      expect(node.nodeValue).toBe('');
    });

    it('should do nothing if called twice', () => {
      const node = document.createTextNode('');
      const binding = new NodeBinding(undefined, {
        type: PartType.Node,
        node,
      });
      const updater = new SyncUpdater(new Scope());
      const enqueueMutationEffectSpy = vi.spyOn(
        updater,
        'enqueueMutationEffect',
      );

      binding.bind(updater);
      binding.bind(updater);

      expect(enqueueMutationEffectSpy).toHaveBeenCalledOnce();
      expect(enqueueMutationEffectSpy).toHaveBeenCalledWith(binding);
    });
  });

  describe('.unbind()', () => {
    it('should set null to the value of the node', () => {
      const node = document.createTextNode('');
      const binding = new NodeBinding('foo', {
        type: PartType.Node,
        node,
      });
      const updater = new SyncUpdater(new Scope());

      binding.bind(updater);
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
      const binding = new NodeBinding(undefined, {
        type: PartType.Node,
        node,
      });
      const updater = new SyncUpdater(new Scope());
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
      const binding = new NodeBinding(true, {
        type: PartType.Node,
        node,
      });

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
      const binding = new PropertyBinding('foo', {
        type: PartType.Property,
        node: element,
        name: 'className',
      });
      const updater = new SyncUpdater(new Scope());

      binding.bind(updater);
      updater.flush();

      expect(binding.value).toBe('foo');
      expect(element.className).toBe('foo');

      binding.value = 'bar';
      binding.bind(updater);
      updater.flush();

      expect(binding.value).toBe('bar');
      expect(element.className).toBe('bar');
    });

    it('should do nothing if called twice', () => {
      const element = document.createElement('div');
      const binding = new PropertyBinding(undefined, {
        type: PartType.Property,
        node: element,
        name: 'className',
      });
      const updater = new SyncUpdater(new Scope());
      const enqueueMutationEffectSpy = vi.spyOn(
        updater,
        'enqueueMutationEffect',
      );

      binding.bind(updater);
      binding.bind(updater);

      expect(enqueueMutationEffectSpy).toHaveBeenCalledOnce();
      expect(enqueueMutationEffectSpy).toHaveBeenCalledWith(binding);
    });
  });

  describe('.unbind()', () => {
    it('should do nothing', () => {
      const element = document.createElement('div');
      const setterSpy = vi.spyOn(element, 'className', 'set');
      const binding = new PropertyBinding('foo', {
        type: PartType.Property,
        node: element,
        name: 'className',
      });
      const updater = new SyncUpdater(new Scope());

      binding.unbind(updater);
      updater.flush();

      expect(setterSpy).not.toHaveBeenCalled();
    });
  });

  describe('.disconnect()', () => {
    it('should do nothing', () => {
      const element = document.createElement('div');
      const setterSpy = vi.spyOn(element, 'className', 'set');
      const binding = new PropertyBinding('foo', {
        type: PartType.Property,
        node: element,
        name: 'className',
      });
      const updater = new SyncUpdater(new Scope());

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
        const element = document.createElement('div');
        const part = {
          type: PartType.Element,
          node: element,
        } as const;
        new SpreadBinding(null, part);
      }).toThrow('A value of SpreadBinding must be an object.');
    });
  });

  describe('.value', () => {
    it('should throw the error when a non-object value is passed', () => {
      expect(() => {
        const element = document.createElement('div');
        const part = {
          type: PartType.Element,
          node: element,
        } as const;
        const binding = new SpreadBinding({}, part);

        binding.value = null;
      }).toThrow('A value of SpreadBinding must be an object.');
    });
  });

  describe('.bind()', () => {
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
      const updater = new SyncUpdater(new Scope());

      binding.bind(updater);
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
      const updater = new SyncUpdater(new Scope());

      binding.bind(updater);
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
      const updater = new SyncUpdater(new Scope());

      binding.bind(updater);
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
      const updater = new SyncUpdater(new Scope());

      binding.bind(updater);
      updater.flush();

      binding.value = {
        class: 'foo', // same value as last time
        title: 'baz',
      };
      binding.bind(updater);
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
      const updater = new SyncUpdater(new Scope());

      binding.bind(updater);
      updater.flush();

      binding.value = { class: undefined };
      binding.bind(updater);
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
      const updater = new SyncUpdater(new Scope());

      binding.bind(updater);
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
          [directiveTag](this: MockDirective, part: Part) {
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
      const updater = new SyncUpdater(new Scope());

      binding.bind(updater);
      updater.flush();

      binding.disconnect();

      expect(disconnects).toBe(2);
    });
  });
});

describe('initializeBinding()', () => {
  it('should perform the value if it is a directive', () => {
    const part = {
      type: PartType.Node,
      node: document.createTextNode(''),
    } as const;
    const directive = new MockDirective();
    const directiveSpy = vi.spyOn(directive, directiveTag);
    const updater = new SyncUpdater(new Scope());
    const binding = initializeBinding(directive, part, updater);

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
    const updater = new SyncUpdater(new Scope());
    const binding = initializeBinding('foo', part, updater);

    updater.flush();

    expect(binding).toBeInstanceOf(AttributeBinding);
    expect(element.getAttribute('class')).toBe('foo');
  });

  it('should resolve the value as a EventBinding if the part is a EventPart', () => {
    const listener = vi.fn();
    const element = document.createElement('div');
    const part = {
      type: PartType.Event,
      node: element,
      name: 'hello',
    } as const;
    const event = new CustomEvent('hello');
    const updater = new SyncUpdater(new Scope());
    const binding = initializeBinding(listener, part, updater);

    updater.flush();

    element.dispatchEvent(event);

    expect(binding).toBeInstanceOf(EventBinding);
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(event);
  });

  it('should resolve the value as a PropertyBinding if the part is a PropertyPart', () => {
    const element = document.createElement('div');
    const part = {
      type: PartType.Property,
      node: element,
      name: 'className',
    } as const;
    const updater = new SyncUpdater(new Scope());
    const binding = initializeBinding('foo', part, updater);

    updater.flush();

    expect(binding).toBeInstanceOf(PropertyBinding);
    expect(element.className).toBe('foo');
  });

  it('should resolve the value as a NodeBinding if the part is a NodePart', () => {
    const node = document.createTextNode('');
    const part = {
      type: PartType.Node,
      node,
    } as const;
    const updater = new SyncUpdater(new Scope());
    const binding = initializeBinding('foo', part, updater);

    updater.flush();

    expect(binding).toBeInstanceOf(NodeBinding);
    expect(node.nodeValue).toBe('foo');
  });

  it('should resolve the value as a NodeBinding if the part is a ChildNodePart', () => {
    const node = document.createComment('');
    const part = {
      type: PartType.ChildNode,
      node,
    } as const;
    const updater = new SyncUpdater(new Scope());
    const binding = initializeBinding('foo', part, updater);

    updater.flush();

    expect(binding).toBeInstanceOf(NodeBinding);
    expect(node.nodeValue).toBe('foo');
  });

  it('should resolve the value as a SpreadBinding if the part is a ElementPart', () => {
    const element = document.createElement('div');
    const part = {
      type: PartType.Element,
      node: element,
    } as const;
    const updater = new SyncUpdater(new Scope());
    const binding = initializeBinding(
      {
        class: 'foo',
        title: 'bar',
      },
      part,
      updater,
    );

    updater.flush();

    expect(binding).toBeInstanceOf(SpreadBinding);
    expect(element.getAttribute('class')).toBe('foo');
    expect(element.getAttribute('title')).toBe('bar');
  });
});

describe('updateBinding()', () => {
  it('should update the binding if the both new and old values are directives', () => {
    const directive = new MockDirective();
    const node = document.createTextNode('');
    const part = {
      type: PartType.Node,
      node,
    } as const;
    const updater = new SyncUpdater(new Scope());
    const binding = new MockBinding(directive, part);
    const bindSpy = vi.spyOn(binding, 'bind');
    const unbindSpy = vi.spyOn(binding, 'unbind');
    const newDirective = new MockDirective();
    const newBinding = updateBinding(binding, newDirective, updater);

    expect(newBinding).toBe(binding);
    expect(binding.value).toBe(newDirective);
    expect(bindSpy).toHaveBeenCalledOnce();
    expect(bindSpy).toHaveBeenCalledWith(updater);
    expect(unbindSpy).not.toHaveBeenCalled();
  });

  it('should update the binding if the both new and old values are non-dirbiectives', () => {
    const node = document.createTextNode('');
    const part = {
      type: PartType.Node,
      node,
    } as const;
    const updater = new SyncUpdater(new Scope());
    const binding = new NodeBinding('foo', part);
    const bindSpy = vi.spyOn(binding, 'bind');
    const unbindSpy = vi.spyOn(binding, 'unbind');
    const newBinding = updateBinding(binding, 'bar', updater);

    expect(newBinding).toBe(binding);
    expect(bindSpy).toHaveBeenCalledOnce();
    expect(bindSpy).toHaveBeenCalledWith(updater);
    expect(unbindSpy).not.toHaveBeenCalled();
  });

  it('should return the new binding if the old value is a non-directive and the new value is a directive', () => {
    const directive = new MockDirective();
    const directiveSpy = vi.spyOn(directive, directiveTag);
    const node = document.createTextNode('');
    const part = {
      type: PartType.Node,
      node,
    } as const;
    const updater = new SyncUpdater(new Scope());
    const binding = new NodeBinding('foo', part);
    const bindSpy = vi.spyOn(binding, 'bind');
    const unbindSpy = vi.spyOn(binding, 'unbind');
    const newBinding = updateBinding(binding, directive, updater);

    expect(newBinding).toBeInstanceOf(MockBinding);
    expect(bindSpy).not.toHaveBeenCalled();
    expect(unbindSpy).toHaveBeenCalledOnce();
    expect(unbindSpy).toHaveBeenCalledWith(updater);
    expect(directiveSpy).toHaveBeenCalledOnce();
    expect(directiveSpy).toHaveBeenCalledWith(part, updater);
  });

  it('should return the new binding if the old value is a directive and the new value is a non-directive', () => {
    const directive = new MockDirective();
    const node = document.createTextNode('');
    const part = {
      type: PartType.Node,
      node,
    } as const;
    const updater = new SyncUpdater(new Scope());
    const binding = new MockBinding(directive, part) as Binding<
      MockDirective | string
    >;
    const unbindSpy = vi.spyOn(binding, 'unbind');
    const newBinding = updateBinding(binding, 'foo', updater);

    updater.flush();

    expect(newBinding).toBeInstanceOf(NodeBinding);
    expect(unbindSpy).toHaveBeenCalledOnce();
    expect(unbindSpy).toHaveBeenCalledWith(updater);
    expect(node.nodeValue).toBe('foo');
  });
});
