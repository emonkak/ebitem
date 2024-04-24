import { assert, describe, it } from 'vitest';
import { getCall, getCalls, spy } from './spy.js';

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

      assert.strictEqual(binding.part, part);
      assert.strictEqual(binding.startNode, element);
      assert.strictEqual(binding.endNode, element);
      assert.strictEqual(binding.value, 'foo');
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

      assert.strictEqual(binding.value, 'foo');
      assert.strictEqual(element.getAttribute('class'), 'foo');

      binding.value = 'bar';
      binding.bind(updater);
      updater.flush();

      assert.strictEqual(binding.value, 'bar');
      assert.strictEqual(element.getAttribute('class'), 'bar');
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

      assert.strictEqual(binding.value, obj1);
      assert.strictEqual(element.getAttribute('class'), 'foo');

      binding.value = obj2;
      binding.bind(updater);
      updater.flush();

      assert.strictEqual(binding.value, obj2);
      assert.strictEqual(element.getAttribute('class'), 'bar');
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

      assert.strictEqual(binding.value, true);
      assert.isTrue(element.hasAttribute('contenteditable'));

      binding.value = false;
      binding.bind(updater);
      updater.flush();

      assert.strictEqual(binding.value, false);
      assert.isFalse(element.hasAttribute('contenteditable'));
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

      assert.strictEqual(binding.value, null);
      assert.isFalse(element.hasAttribute('contenteditable'));
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

      assert.strictEqual(binding.value, undefined);
      assert.isFalse(element.hasAttribute('contenteditable'));
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

      assert.lengthOf(getCalls(updater), 1);
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

      assert.strictEqual(binding.value, null);
      assert.isFalse(element.hasAttribute('contenteditable'));
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

      assert.lengthOf(getCalls(updater), 1);
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

      assert.strictEqual(binding.part, part);
      assert.strictEqual(binding.startNode, element);
      assert.strictEqual(binding.endNode, element);
      assert.strictEqual(binding.value, listener);
    });

    it('should throw the error if the value other than an event listner is passed', () => {
      assert.throw(() => {
        new EventBinding(
          {},
          {
            type: PartType.EVENT,
            node: document.createElement('div'),
            name: 'hello',
          },
        );
      }, 'A value that EventBinding binds must be EventListener, EventListenerObject or null.');
    });
  });

  describe('.value', () => {
    it('should throw the error if the value other than an event listner is assigned', () => {
      assert.throw(() => {
        const binding = new EventBinding(null, {
          type: PartType.EVENT,
          node: document.createElement('div'),
          name: 'hello',
        });
        binding.value = {};
      }, 'A value that EventBinding binds must be EventListener, EventListenerObject or null.');
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

      assert.lengthOf(getCalls(spiedElement), 1);
      assert.strictEqual(
        getCall(spiedElement, 0)?.function.name,
        'addEventListener',
      );
      assert.sameOrderedMembers(getCall(spiedElement, 0)?.args ?? [], [
        'hello',
        binding,
      ]);
      assert.lengthOf(getCalls(spiedListener1), 1);
      assert.strictEqual(getCall(spiedListener1, 0)?.function, listener1);
      assert.sameOrderedMembers(getCall(spiedListener1, 0)?.args ?? [], [
        event,
      ]);
      assert.lengthOf(getCalls(spiedListener2), 0);

      binding.value = spiedListener2;
      binding.bind(updater);
      updater.flush();
      element.dispatchEvent(event);

      assert.lengthOf(getCalls(spiedElement), 1);
      assert.lengthOf(getCalls(spiedListener1), 1);
      assert.lengthOf(getCalls(spiedListener2), 1);
      assert.strictEqual(getCall(spiedListener2, 0)?.function, listener2);
      assert.sameOrderedMembers(getCall(spiedListener2, 0)?.args ?? [], [
        event,
      ]);
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

      assert.lengthOf(getCalls(spiedElement), 1);
      assert.strictEqual(
        getCall(spiedElement, 0)?.function.name,
        'addEventListener',
      );
      assert.sameOrderedMembers(getCall(spiedElement, 0)?.args ?? [], [
        'hello',
        binding,
        spiedListener1,
      ]);
      assert.lengthOf(getCalls(spiedListener1), 1);
      assert.strictEqual(
        getCall(spiedListener1, 0)?.function,
        listener1.handleEvent,
      );
      assert.sameOrderedMembers(getCall(spiedListener1, 0)?.args ?? [], [
        event,
      ]);
      assert.lengthOf(getCalls(spiedListener2), 0);

      binding.value = spiedListener2;
      binding.bind(updater);
      updater.flush();
      element.dispatchEvent(event);

      assert.lengthOf(getCalls(spiedElement), 3);
      assert.strictEqual(
        getCall(spiedElement, 1)?.function.name,
        'removeEventListener',
      );
      assert.sameOrderedMembers(getCall(spiedElement, 1)?.args ?? [], [
        'hello',
        binding,
        spiedListener1,
      ]);
      assert.strictEqual(
        getCall(spiedElement, 2)?.function.name,
        'addEventListener',
      );
      assert.sameOrderedMembers(getCall(spiedElement, 2)?.args ?? [], [
        'hello',
        binding,
        spiedListener2,
      ]);
      assert.lengthOf(getCalls(spiedListener1), 1);
      assert.lengthOf(getCalls(spiedListener2), 1);
      assert.strictEqual(
        getCall(spiedListener2, 0)?.function,
        listener2.handleEvent,
      );
      assert.sameOrderedMembers(getCall(spiedListener2, 0)?.args ?? [], [
        event,
      ]);
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

      assert.lengthOf(getCalls(spiedElement), 2);
      assert.strictEqual(
        getCall(spiedElement, 0)?.function.name,
        'addEventListener',
      );
      assert.sameOrderedMembers(getCall(spiedElement, 0)?.args ?? [], [
        'hello',
        binding,
      ]);
      assert.strictEqual(
        getCall(spiedElement, 1)?.function.name,
        'removeEventListener',
      );
      assert.sameOrderedMembers(getCall(spiedElement, 1)?.args ?? [], [
        'hello',
        binding,
      ]);
      assert.lengthOf(getCalls(spiedListener), 1);
      assert.strictEqual(getCall(spiedListener, 0)?.function, listener);
      assert.sameOrderedMembers(getCall(spiedListener, 0)?.args ?? [], [event]);
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

      assert.lengthOf(getCalls(updater), 1);
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

      assert.strictEqual(binding.value, null);
      assert.lengthOf(getCalls(spiedElement), 2);
      assert.strictEqual(
        getCall(spiedElement, 0)?.function.name,
        'addEventListener',
      );
      assert.sameOrderedMembers(getCall(spiedElement, 0)?.args ?? [], [
        'hello',
        binding,
      ]);
      assert.strictEqual(
        getCall(spiedElement, 1)?.function.name,
        'removeEventListener',
      );
      assert.sameOrderedMembers(getCall(spiedElement, 1)?.args ?? [], [
        'hello',
        binding,
      ]);
      assert.lengthOf(getCalls(spiedListener), 1);
      assert.strictEqual(getCall(spiedListener, 0)?.function, listener);
      assert.sameOrderedMembers(getCall(spiedListener, 0)?.args ?? [], [event]);
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

      assert.lengthOf(getCalls(spiedUpdater), 1);
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

      assert.lengthOf(getCalls(updater), 0);
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

      assert.lengthOf(getCalls(element), 2);
      assert.strictEqual(
        getCall(element, 0)?.function.name,
        'addEventListener',
      );
      assert.sameOrderedMembers(getCall(element, 0)?.args ?? [], [
        'hello',
        binding,
      ]);
      assert.strictEqual(
        getCall(element, 1)?.function.name,
        'removeEventListener',
      );
      assert.sameOrderedMembers(getCall(element, 1)?.args ?? [], [
        'hello',
        binding,
      ]);

      binding.disconnect();

      assert.lengthOf(
        getCalls(element),
        2,
        'Do nothing if the event listener is already detached.',
      );
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

      assert.lengthOf(getCalls(element), 2);
      assert.strictEqual(
        getCall(element, 0)?.function.name,
        'addEventListener',
      );
      assert.sameOrderedMembers(getCall(element, 0)?.args ?? [], [
        'hello',
        binding,
        listener,
      ]);
      assert.strictEqual(
        getCall(element, 1)?.function.name,
        'removeEventListener',
      );
      assert.sameOrderedMembers(getCall(element, 1)?.args ?? [], [
        'hello',
        binding,
        listener,
      ]);

      binding.disconnect();

      assert.lengthOf(
        getCalls(element),
        2,
        'Do nothing if the event listener is already detached.',
      );
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

      assert.strictEqual(binding.part, part);
      assert.strictEqual(binding.startNode, element);
      assert.strictEqual(binding.endNode, element);
      assert.strictEqual(binding.value, listener);
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

      assert.strictEqual(binding.value, 'foo');
      assert.strictEqual(node.nodeValue, 'foo');

      binding.value = 'bar';
      binding.bind(updater);
      updater.flush();

      assert.strictEqual(binding.value, 'bar');
      assert.strictEqual(node.nodeValue, 'bar');

      binding.value = null;
      binding.bind(updater);
      updater.flush();

      assert.strictEqual(binding.value, null);
      assert.strictEqual(node.nodeValue, '');
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

      assert.lengthOf(getCalls(updater), 1);
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

      assert.strictEqual(binding.value, 'foo');
      assert.strictEqual(node.nodeValue, 'foo');

      binding.unbind(updater);
      updater.flush();

      assert.strictEqual(binding.value, null);
      assert.strictEqual(node.nodeValue, '');
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

      assert.lengthOf(getCalls(updater), 1);
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

      assert.strictEqual(binding.part, part);
      assert.strictEqual(binding.startNode, element);
      assert.strictEqual(binding.endNode, element);
      assert.strictEqual(binding.value, 'foo');
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

      assert.strictEqual(binding.value, 'foo');
      assert.strictEqual(element.className, 'foo');

      binding.value = 'bar';
      binding.bind(updater);
      updater.flush();

      assert.strictEqual(binding.value, 'bar');
      assert.strictEqual(element.className, 'bar');
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

      assert.lengthOf(getCalls(updater), 1);
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

      assert.lengthOf(getCalls(element), 0);
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

      assert.lengthOf(getCalls(element), 0);
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

      assert.strictEqual(binding.part, part);
      assert.strictEqual(binding.startNode, element);
      assert.strictEqual(binding.endNode, element);
      assert.strictEqual(binding.value, props);
    });

    it('should throw the error when a non-object value is passed', () => {
      assert.throw(() => {
        const element = document.createElement('div');
        const part = {
          type: PartType.ELEMENT,
          node: element,
        } as const;
        new SpreadBinding(null, part);
      }, 'A value of SpreadBinding must be an object.');
    });
  });

  describe('.value', () => {
    it('should throw the error when a non-object value is passed', () => {
      assert.throw(() => {
        const element = document.createElement('div');
        const part = {
          type: PartType.ELEMENT,
          node: element,
        } as const;
        const binding = new SpreadBinding({}, part);

        binding.value = null;
      }, 'A value of SpreadBinding must be an object.');
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

      assert.strictEqual(element.getAttribute('class'), 'foo');
      assert.strictEqual(element.getAttribute('title'), 'bar');
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

      assert.strictEqual(element.className, 'foo');
      assert.strictEqual(element.title, 'bar');
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

      assert.lengthOf(getCalls(element), 2);
      assert.strictEqual(
        getCall(element, 0)?.function.name,
        'addEventListener',
      );
      assert.strictEqual(getCall(element, 0)?.args[0], 'click');
      assert.strictEqual(
        getCall(element, 1)?.function.name,
        'addEventListener',
      );
      assert.strictEqual(getCall(element, 1)?.args[0], 'touchstart');
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

      assert.sameOrderedMembers(
        getCalls(spiedElement).map((call) => call.function.name),
        ['setAttribute', 'setAttribute', 'setAttribute'],
      );
      assert.sameOrderedMembers(getCall(spiedElement, 0)?.args ?? [], [
        'class',
        'foo',
      ]);
      assert.sameOrderedMembers(getCall(spiedElement, 1)?.args ?? [], [
        'title',
        'bar',
      ]);
      assert.sameOrderedMembers(getCall(spiedElement, 2)?.args ?? [], [
        'title',
        'baz',
      ]);
      assert.strictEqual(element.getAttribute('class'), 'foo');
      assert.strictEqual(element.getAttribute('title'), 'baz');
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

      assert.isFalse(element.hasAttribute('class'));
      assert.isFalse(element.hasAttribute('title'));
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

      assert.isFalse(element.hasAttribute('class'));
      assert.isFalse(element.hasAttribute('title'));
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

      assert.strictEqual(disconnects, 2);
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

    assert.instanceOf(binding, MockBinding);
    assert.lengthOf(getCalls(directive), 1);
    assert.strictEqual(
      getCall(directive, 0)?.function,
      MockDirective.prototype[directiveTag],
    );
    assert.sameOrderedMembers(getCall(directive, 0)?.args ?? [], [
      part,
      updater,
    ]);
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

    assert.instanceOf(binding, AttributeBinding);
    assert.strictEqual(element.getAttribute('class'), 'foo');
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

    assert.instanceOf(binding, EventBinding);
    assert.lengthOf(getCalls(listener), 1);
    assert.sameOrderedMembers(getCall(listener, 0)?.args ?? [], [event]);
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

    assert.instanceOf(binding, PropertyBinding);
    assert.strictEqual(element.className, 'foo');
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

    assert.instanceOf(binding, NodeBinding);
    assert.strictEqual(node.nodeValue, 'foo');
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

    assert.instanceOf(binding, NodeBinding);
    assert.strictEqual(node.nodeValue, 'foo');
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

    assert.instanceOf(binding, SpreadBinding);
    assert.strictEqual(element.getAttribute('class'), 'foo');
    assert.strictEqual(element.getAttribute('title'), 'bar');
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

    assert.strictEqual(newBinding, binding);
    assert.strictEqual(binding.value, newDirective);
    assert.lengthOf(getCalls(binding), 1);
    assert.strictEqual(getCall(binding, 0)?.function.name, 'bind');
    assert.sameOrderedMembers(getCall(binding, 0)?.args ?? [], [updater]);
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

    assert.strictEqual(newBinding, binding);
    assert.lengthOf(getCalls(binding), 1);
    assert.strictEqual(getCall(binding, 0)?.function.name, 'bind');
    assert.sameOrderedMembers(getCall(binding, 0)?.args ?? [], [updater]);
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

    assert.instanceOf(newBinding, MockBinding);
    assert.lengthOf(getCalls(binding), 1);
    assert.strictEqual(getCall(binding, 0)?.function.name, 'unbind');
    assert.lengthOf(getCalls(directive), 1);
    assert.strictEqual(
      getCall(directive, 0)?.function,
      MockDirective.prototype[directiveTag],
    );
    assert.sameOrderedMembers(getCall(directive, 0)?.args ?? [], [
      part,
      updater,
    ]);
  });

  it('should return the new binding if the old value is a directive and the new value is a non-directive', () => {
    const directive = new MockDirective();
    const node = document.createTextNode('');
    const part = {
      type: PartType.NODE,
      node,
    } as const;
    const updater = new LocalUpdater();
    const binding = spy(new MockBinding(directive, part)) as Binding<
      MockDirective | string
    >;
    const newBinding = spy(updateBinding(binding, 'foo', updater));

    updater.flush();

    assert.instanceOf(newBinding, NodeBinding);
    assert.lengthOf(getCalls(binding), 1);
    assert.strictEqual(getCall(binding, 0)?.function.name, 'unbind');
    assert.strictEqual(node.nodeValue, 'foo');
  });
});
