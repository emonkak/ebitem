import { describe, expect, it } from 'vitest';
import { SpiedObject, getCall, getCalls, spy } from './spy.js';

import {
  AttributeBinding,
  EventBinding,
  NodeBinding,
  PropertyBinding,
  SpreadBinding,
  initializeBinding,
  updateBinding,
} from '../src/binding.js';
import { Binding, Part, PartType, directiveTag } from '../src/types.js';
import { LocalUpdater } from '../src/updater/local.js';
import { MockBinding, MockDirective } from './mocks.js';

describe('AttributeBinding', () => {
  describe('.constructor()', () => {
    it('should construct a new AttributeBinding', () => {
      const element = document.createElement('div');
      const part = {
        type: PartType.ATTRIBUTE,
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
        type: PartType.ATTRIBUTE,
        node: element,
        name: 'class',
      });
      const updater = new LocalUpdater();

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
        type: PartType.ATTRIBUTE,
        node: element,
        name: 'class',
      });
      const updater = new LocalUpdater();

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
        type: PartType.ATTRIBUTE,
        node: element,
        name: 'contenteditable',
      });
      const updater = new LocalUpdater();

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
        type: PartType.ATTRIBUTE,
        node: element,
        name: 'contenteditable',
      });
      const updater = new LocalUpdater();

      element.toggleAttribute('contenteditable', true);
      binding.bind(updater);
      updater.flush();

      expect(binding.value).toBe(null);
      expect(element.hasAttribute('contenteditable')).toBe(false);
    });

    it('should remove the attribute when undefined is passed', () => {
      const element = document.createElement('div');
      const binding = new AttributeBinding(undefined, {
        type: PartType.ATTRIBUTE,
        node: element,
        name: 'contenteditable',
      });
      const updater = new LocalUpdater();

      element.toggleAttribute('contenteditable', true);
      binding.bind(updater);
      updater.flush();

      expect(binding.value).toBe(undefined);
      expect(element.hasAttribute('contenteditable')).toBe(false);
    });

    it('should do nothing if called twice', () => {
      const element = document.createElement('div');
      const binding = new AttributeBinding(undefined, {
        type: PartType.ATTRIBUTE,
        node: element,
        name: 'contenteditable',
      });
      const updater = spy(new LocalUpdater());

      binding.bind(updater);
      binding.bind(updater);

      expect(getCalls(updater)).toHaveLength(1);
    });
  });

  describe('.unbind()', () => {
    it('should remove the attribute', () => {
      const element = document.createElement('div');
      const binding = new AttributeBinding(true, {
        type: PartType.ATTRIBUTE,
        node: element,
        name: 'contenteditable',
      });
      const updater = new LocalUpdater();

      element.toggleAttribute('contenteditable', true);
      binding.unbind(updater);
      updater.flush();

      expect(binding.value).toBe(null);
      expect(element.hasAttribute('contenteditable')).toBe(false);
    });

    it('should do nothing if called twice', () => {
      const element = document.createElement('div');
      const binding = new AttributeBinding(undefined, {
        type: PartType.ATTRIBUTE,
        node: element,
        name: 'contenteditable',
      });
      const updater = spy(new LocalUpdater());

      binding.unbind(updater);
      binding.unbind(updater);

      expect(getCalls(updater)).toHaveLength(1);
    });
  });

  describe('.disconnect()', () => {
    it('should do nothing', () => {
      const element = document.createElement('div');
      const binding = new AttributeBinding(true, {
        type: PartType.ATTRIBUTE,
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
        type: PartType.EVENT,
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
            type: PartType.EVENT,
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
          type: PartType.EVENT,
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
      const listener1 = () => {};
      const listener2 = () => {};
      const element = document.createElement('div');
      const spiedListener1 = spy(listener1);
      const spiedListener2 = spy(listener2);
      const spiedElement = spy(element);
      const part = {
        type: PartType.EVENT,
        node: spiedElement,
        name: 'hello',
      } as const;
      const event = new CustomEvent('hello');
      const binding = new EventBinding(spiedListener1, part);
      const updater = new LocalUpdater();

      binding.bind(updater);
      updater.flush();
      element.dispatchEvent(event);

      expect(getCalls(spiedElement)).toHaveLength(1);
      expect(getCall(spiedElement, 0)?.function.name).toBe('addEventListener');
      expect(getCall(spiedElement, 0)?.args).toEqual(['hello', binding]);
      expect(getCalls(spiedListener1)).toHaveLength(1);
      expect(getCall(spiedListener1, 0)?.function).toBe(listener1);
      expect(getCall(spiedListener1, 0)?.args).toEqual([event]);
      expect(getCalls(spiedListener2)).toHaveLength(0);

      binding.value = spiedListener2;
      binding.bind(updater);
      updater.flush();
      element.dispatchEvent(event);

      expect(getCalls(spiedElement)).toHaveLength(1);
      expect(getCalls(spiedListener1)).toHaveLength(1);
      expect(getCalls(spiedListener2)).toHaveLength(1);
      expect(getCall(spiedListener2, 0)?.function).toBe(listener2);
      expect(getCall(spiedListener2, 0)?.args).toEqual([event]);
    });

    it('should attach the object to the element as an event listener', () => {
      const element = document.createElement('div');
      const spiedElement = spy(element);
      const part = {
        type: PartType.EVENT,
        node: spiedElement,
        name: 'hello',
      } as const;
      const event = new CustomEvent('hello');
      const listener1 = {
        capture: true,
        handleEvent: () => {},
      };
      const listener2 = {
        capture: false,
        handleEvent: () => {},
      };
      const spiedListener1 = spy(listener1);
      const spiedListener2 = spy(listener2);
      const binding = new EventBinding(spiedListener1, part);
      const updater = new LocalUpdater();

      binding.bind(updater);
      updater.flush();
      element.dispatchEvent(event);

      expect(getCalls(spiedElement)).toHaveLength(1);
      expect(getCall(spiedElement, 0)?.function.name).toBe('addEventListener');
      expect(getCall(spiedElement, 0)?.args ?? []).toEqual([
        'hello',
        binding,
        spiedListener1,
      ]);
      expect(getCalls(spiedListener1)).toHaveLength(1);
      expect(getCall(spiedListener1, 0)?.function).toBe(listener1.handleEvent);
      expect(getCall(spiedListener1, 0)?.args).toEqual([event]);
      expect(getCalls(spiedListener2)).toHaveLength(0);

      binding.value = spiedListener2;
      binding.bind(updater);
      updater.flush();
      element.dispatchEvent(event);

      expect(getCalls(spiedElement)).toHaveLength(3);
      expect(getCall(spiedElement, 1)?.function.name).toBe(
        'removeEventListener',
      );
      expect(getCall(spiedElement, 1)?.args).toEqual([
        'hello',
        binding,
        spiedListener1,
      ]);
      expect(getCall(spiedElement, 2)?.function.name).toBe('addEventListener');
      expect(getCall(spiedElement, 2)?.args).toEqual([
        'hello',
        binding,
        spiedListener2,
      ]);
      expect(getCalls(spiedListener1)).toHaveLength(1);
      expect(getCalls(spiedListener2)).toHaveLength(1);
      expect(getCall(spiedListener2, 0)?.function).toBe(listener2.handleEvent);
      expect(getCall(spiedListener2, 0)?.args).toEqual([event]);
    });

    it('should detach the active event listener when null is passed', () => {
      const listener = () => {};
      const element = document.createElement('div');
      const spiedListener = spy(listener);
      const spiedElement = spy(element);
      const part = {
        type: PartType.EVENT,
        node: spiedElement,
        name: 'hello',
      } as const;
      const event = new CustomEvent('hello');
      const binding = new EventBinding(spiedListener, part);
      const updater = new LocalUpdater();

      binding.bind(updater);
      updater.flush();
      element.dispatchEvent(event);

      binding.value = null;
      binding.bind(updater);
      updater.flush();
      element.dispatchEvent(event);

      expect(getCalls(spiedElement)).toHaveLength(2);
      expect(getCall(spiedElement, 0)?.function.name).toBe('addEventListener');
      expect(getCall(spiedElement, 0)?.args).toEqual(['hello', binding]);
      expect(getCall(spiedElement, 1)?.function.name).toBe(
        'removeEventListener',
      );
      expect(getCall(spiedElement, 1)?.args ?? []).toEqual(['hello', binding]);
      expect(getCalls(spiedListener)).toHaveLength(1);
      expect(getCall(spiedListener, 0)?.function).toBe(listener);
      expect(getCall(spiedListener, 0)?.args ?? []).toEqual([event]);
    });

    it('should do nothing if called twice', () => {
      const listener = () => {};
      const element = document.createElement('div');
      const binding = new EventBinding(listener, {
        type: PartType.EVENT,
        node: element,
        name: 'click',
      });
      const updater = spy(new LocalUpdater());

      binding.bind(updater);
      binding.bind(updater);

      expect(getCalls(updater)).toHaveLength(1);
    });
  });

  describe('.unbind()', () => {
    it('should detach the active event listener', () => {
      const listener = () => {};
      const element = document.createElement('div');
      const spiedListener = spy(listener);
      const spiedElement = spy(element);
      const part = {
        type: PartType.EVENT,
        node: spiedElement,
        name: 'hello',
      } as const;
      const event = new CustomEvent('hello');
      const binding = new EventBinding(spiedListener, part);
      const updater = new LocalUpdater();

      binding.bind(updater);
      updater.flush();
      element.dispatchEvent(event);

      binding.unbind(updater);
      updater.flush();
      element.dispatchEvent(event);

      expect(binding.value).toBe(null);
      expect(getCalls(spiedElement)).toHaveLength(2);
      expect(getCall(spiedElement, 0)?.function.name).toBe('addEventListener');
      expect(getCall(spiedElement, 0)?.args).toEqual(['hello', binding]);
      expect(getCall(spiedElement, 1)?.function.name).toBe(
        'removeEventListener',
      );
      expect(getCall(spiedElement, 1)?.args).toEqual(['hello', binding]);
      expect(getCalls(spiedListener)).toHaveLength(1);
      expect(getCall(spiedListener, 0)?.function).toBe(listener);
      expect(getCall(spiedListener, 0)?.args).toEqual([event]);
    });

    it('should do nothing if called twice', () => {
      const listener = () => {};
      const element = document.createElement('div');
      const binding = new EventBinding(listener, {
        type: PartType.EVENT,
        node: element,
        name: 'click',
      });
      const updater = new LocalUpdater();

      binding.bind(updater);

      updater.flush();

      const spiedUpdater = spy(updater);

      binding.unbind(spiedUpdater);
      binding.unbind(spiedUpdater);

      expect(getCalls(spiedUpdater)).toHaveLength(1);
    });

    it('should do nothing if there is no active listner', () => {
      const listener = () => {};
      const element = document.createElement('div');
      const binding = new EventBinding(listener, {
        type: PartType.EVENT,
        node: element,
        name: 'click',
      });
      const updater = spy(new LocalUpdater());

      binding.unbind(updater);
      binding.unbind(updater);

      expect(getCalls(updater)).toHaveLength(0);
    });
  });

  describe('.disconnect()', () => {
    it('should detach the active event listener function', () => {
      const listener = () => {};
      const element = spy(document.createElement('div'));
      const binding = new EventBinding(listener, {
        type: PartType.EVENT,
        node: element,
        name: 'hello',
      });
      const updater = new LocalUpdater();

      binding.bind(updater);
      updater.flush();

      binding.disconnect();

      expect(getCalls(element)).toHaveLength(2);
      expect(getCall(element, 0)?.function.name).toBe('addEventListener');
      expect(getCall(element, 0)?.args ?? []).toEqual(['hello', binding]);
      expect(getCall(element, 1)?.function.name).toBe('removeEventListener');
      expect(getCall(element, 1)?.args ?? []).toEqual(['hello', binding]);

      binding.disconnect();

      expect(
        getCalls(element),
        'Do nothing if the event listener is already detached.',
      ).toHaveLength(2);
    });

    it('should detach the active event listener object', () => {
      const listener = { handleEvent: () => {}, capture: true };
      const element = spy(document.createElement('div'));
      const binding = new EventBinding(listener, {
        type: PartType.EVENT,
        node: element,
        name: 'hello',
      });
      const updater = new LocalUpdater();

      binding.bind(updater);
      updater.flush();

      binding.disconnect();

      expect(getCalls(element)).toHaveLength(2);
      expect(getCall(element, 0)?.function.name).toBe('addEventListener');
      expect(getCall(element, 0)?.args ?? []).toEqual([
        'hello',
        binding,
        listener,
      ]);
      expect(getCall(element, 1)?.function.name).toBe('removeEventListener');
      expect(getCall(element, 1)?.args).toEqual(['hello', binding, listener]);

      binding.disconnect();

      expect(
        getCalls(element),
        'Do nothing if the event listener is already detached.',
      ).toHaveLength(2);
    });
  });
});

describe('NodeBinding', () => {
  describe('.constructor()', () => {
    it('should construct a new NodeBinding', () => {
      const listener = () => {};
      const element = document.createElement('div');
      const part = {
        type: PartType.NODE,
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
        type: PartType.NODE,
        node,
      });
      const updater = new LocalUpdater();

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
        type: PartType.NODE,
        node,
      });
      const updater = spy(new LocalUpdater());

      binding.bind(updater);
      binding.bind(updater);

      expect(getCalls(updater)).toHaveLength(1);
    });
  });

  describe('.unbind()', () => {
    it('should set null to the value of the node', () => {
      const node = document.createTextNode('');
      const binding = new NodeBinding('foo', {
        type: PartType.NODE,
        node,
      });
      const updater = new LocalUpdater();

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
        type: PartType.NODE,
        node,
      });
      const updater = spy(new LocalUpdater());

      binding.unbind(updater);
      binding.unbind(updater);

      expect(getCalls(updater)).toHaveLength(1);
    });
  });

  describe('.disconnect()', () => {
    it('should do nothing', () => {
      const node = document.createTextNode('');
      const binding = new NodeBinding(true, {
        type: PartType.NODE,
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
        type: PartType.PROPERTY,
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
        type: PartType.PROPERTY,
        node: element,
        name: 'className',
      });
      const updater = new LocalUpdater();

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
        type: PartType.PROPERTY,
        node: element,
        name: 'className',
      });
      const updater = spy(new LocalUpdater());

      binding.bind(updater);
      binding.bind(updater);

      expect(getCalls(updater)).toHaveLength(1);
    });
  });

  describe('.unbind()', () => {
    it('should do nothing', () => {
      const element = spy(document.createElement('div'));
      const binding = new PropertyBinding('foo', {
        type: PartType.PROPERTY,
        node: element,
        name: 'className',
      });
      const updater = new LocalUpdater();

      binding.unbind(updater);
      updater.flush();

      expect(getCalls(element)).toHaveLength(0);
    });
  });

  describe('.disconnect()', () => {
    it('should do nothing', () => {
      const element = spy(document.createElement('div'));
      const binding = new PropertyBinding('foo', {
        type: PartType.PROPERTY,
        node: element,
        name: 'className',
      });
      const updater = new LocalUpdater();

      binding.disconnect();
      updater.flush();

      expect(getCalls(element)).toHaveLength(0);
    });
  });
});

describe('SpreadBinding', () => {
  describe('.constructor()', () => {
    it('should construct a new SpreadBinding', () => {
      const props = {};
      const element = document.createElement('div');
      const part = {
        type: PartType.ELEMENT,
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
          type: PartType.ELEMENT,
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
          type: PartType.ELEMENT,
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
        type: PartType.ELEMENT,
        node: element,
      } as const;
      const binding = new SpreadBinding(props, part);
      const updater = new LocalUpdater();

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
        type: PartType.ELEMENT,
        node: element,
      } as const;
      const binding = new SpreadBinding(props, part);
      const updater = new LocalUpdater();

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
      const element = spy(document.createElement('div'));
      const part = {
        type: PartType.ELEMENT,
        node: element,
      } as const;
      const binding = new SpreadBinding(props, part);
      const updater = new LocalUpdater();

      binding.bind(updater);
      updater.flush();

      expect(getCalls(element)).toHaveLength(2);
      expect(getCall(element, 0)?.function.name).toBe('addEventListener');
      expect(getCall(element, 0)?.args[0]).toBe('click');
      expect(getCall(element, 1)?.function.name).toBe('addEventListener');
      expect(getCall(element, 1)?.args[0]).toBe('touchstart');
    });

    it('should skip bindings that are passed the same value as last time', () => {
      const props = {
        class: 'foo',
        title: 'bar',
      };
      const element = document.createElement('div');
      const spiedElement = spy(element);
      const part = {
        type: PartType.ELEMENT,
        node: spiedElement,
      } as const;
      const binding = new SpreadBinding(props, part);
      const updater = new LocalUpdater();

      binding.bind(updater);
      updater.flush();

      binding.value = {
        class: 'foo', // same value as last time
        title: 'baz',
      };
      binding.bind(updater);
      updater.flush();

      expect(getCalls(spiedElement).map((call) => call.function.name)).toEqual([
        'setAttribute',
        'setAttribute',
        'setAttribute',
      ]);
      expect(getCall(spiedElement, 0)?.args).toEqual(['class', 'foo']);
      expect(getCall(spiedElement, 1)?.args ?? []).toEqual(['title', 'bar']);
      expect(getCall(spiedElement, 2)?.args ?? []).toEqual(['title', 'baz']);
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
        type: PartType.ELEMENT,
        node: element,
      } as const;
      const binding = new SpreadBinding(props, part);
      const updater = new LocalUpdater();

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
        type: PartType.ELEMENT,
        node: element,
      } as const;
      const binding = new SpreadBinding(props, part);
      const updater = new LocalUpdater();

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
        type: PartType.ELEMENT,
        node: element,
      } as const;
      const binding = new SpreadBinding(props, part);
      const updater = new LocalUpdater();

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
      type: PartType.NODE,
      node: document.createTextNode(''),
    } as const;
    const directive = spy(new MockDirective());
    const updater = new LocalUpdater();
    const binding = initializeBinding(directive, part, updater);

    expect(binding).toBeInstanceOf(MockBinding);
    expect(getCalls(directive)).toHaveLength(1);
    expect(getCall(directive, 0)?.function).toBe(
      MockDirective.prototype[directiveTag],
    );
    expect(getCall(directive, 0)?.args).toEqual([part, updater]);
  });

  it('should resolve the value as a AttributeBinding if the part is a AttributePart', () => {
    const element = document.createElement('div');
    const part = {
      type: PartType.ATTRIBUTE,
      node: element,
      name: 'class',
    } as const;
    const updater = new LocalUpdater();
    const binding = initializeBinding('foo', part, updater);

    updater.flush();

    expect(binding).toBeInstanceOf(AttributeBinding);
    expect(element.getAttribute('class')).toBe('foo');
  });

  it('should resolve the value as a EventBinding if the part is a EventPart', () => {
    const listener = spy(() => {});
    const element = document.createElement('div');
    const part = {
      type: PartType.EVENT,
      node: element,
      name: 'hello',
    } as const;
    const event = new CustomEvent('hello');
    const updater = new LocalUpdater();
    const binding = initializeBinding(listener, part, updater);

    updater.flush();

    element.dispatchEvent(event);

    expect(binding).toBeInstanceOf(EventBinding);
    expect(getCalls(listener)).toHaveLength(1);
    expect(getCall(listener, 0)?.args).toEqual([event]);
  });

  it('should resolve the value as a PropertyBinding if the part is a PropertyPart', () => {
    const element = document.createElement('div');
    const part = {
      type: PartType.PROPERTY,
      node: element,
      name: 'className',
    } as const;
    const updater = new LocalUpdater();
    const binding = initializeBinding('foo', part, updater);

    updater.flush();

    expect(binding).toBeInstanceOf(PropertyBinding);
    expect(element.className).toBe('foo');
  });

  it('should resolve the value as a NodeBinding if the part is a NodePart', () => {
    const node = document.createTextNode('');
    const part = {
      type: PartType.NODE,
      node,
    } as const;
    const updater = new LocalUpdater();
    const binding = initializeBinding('foo', part, updater);

    updater.flush();

    expect(binding).toBeInstanceOf(NodeBinding);
    expect(node.nodeValue).toBe('foo');
  });

  it('should resolve the value as a NodeBinding if the part is a ChildNodePart', () => {
    const node = document.createComment('');
    const part = {
      type: PartType.CHILD_NODE,
      node,
    } as const;
    const updater = new LocalUpdater();
    const binding = initializeBinding('foo', part, updater);

    updater.flush();

    expect(binding).toBeInstanceOf(NodeBinding);
    expect(node.nodeValue).toBe('foo');
  });

  it('should resolve the value as a SpreadBinding if the part is a ElementPart', () => {
    const element = document.createElement('div');
    const part = {
      type: PartType.ELEMENT,
      node: element,
    } as const;
    const updater = new LocalUpdater();
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
      type: PartType.NODE,
      node,
    } as const;
    const updater = new LocalUpdater();
    const binding = spy(new MockBinding(directive, part));
    const newDirective = new MockDirective();
    const newBinding = updateBinding(binding, newDirective, updater);

    expect(newBinding).toBe(binding);
    expect(binding.value).toBe(newDirective);
    expect(getCalls(binding)).toHaveLength(1);
    expect(getCall(binding, 0)?.function.name).toBe('bind');
    expect(getCall(binding, 0)?.args).toEqual([updater]);
  });

  it('should update the binding if the both new and old values are non-dirbiectives', () => {
    const node = document.createTextNode('');
    const part = {
      type: PartType.NODE,
      node,
    } as const;
    const updater = new LocalUpdater();
    const binding = spy(new NodeBinding('foo', part));
    const newBinding = updateBinding(binding, 'bar', updater);

    expect(newBinding).toBe(binding);
    expect(getCalls(binding)).toHaveLength(1);
    expect(getCall(binding, 0)?.function.name).toBe('bind');
    expect(getCall(binding, 0)?.args).toEqual([updater]);
  });

  it('should return the new binding if the old value is a non-directive and the new value is a directive', () => {
    const directive = spy(new MockDirective());
    const node = document.createTextNode('');
    const part = {
      type: PartType.NODE,
      node,
    } as const;
    const updater = new LocalUpdater();
    const binding = spy(new NodeBinding('foo', part));
    const newBinding = spy(updateBinding(binding, directive, updater));

    expect(newBinding).toBeInstanceOf(MockBinding);
    expect(getCalls(binding)).toHaveLength(1);
    expect(getCall(binding, 0)?.function.name).toBe('unbind');
    expect(getCalls(directive)).toHaveLength(1);
    expect(getCall(directive, 0)?.function).toBe(
      MockDirective.prototype[directiveTag],
    );
    expect(getCall(directive, 0)?.args).toEqual([part, updater]);
  });

  it('should return the new binding if the old value is a directive and the new value is a non-directive', () => {
    const directive = new MockDirective();
    const node = document.createTextNode('');
    const part = {
      type: PartType.NODE,
      node,
    } as const;
    const updater = new LocalUpdater();
    const binding = spy(new MockBinding(directive, part)) as SpiedObject<
      Binding<MockDirective | string>
    >;
    const newBinding = spy(updateBinding(binding, 'foo', updater));

    updater.flush();

    expect(newBinding).toBeInstanceOf(NodeBinding);
    expect(getCalls(binding)).toHaveLength(1);
    expect(getCall(binding, 0)?.function.name).toBe('unbind');
    expect(node.nodeValue).toBe('foo');
  });
});
