import { assert, describe, it } from 'vitest';

import {
  AttributeBinding,
  EventBinding,
  NodeBinding,
  PropertyBinding,
  SpreadBinding,
} from '../src/binding.js';
import {
  Template,
  TemplateRoot,
  getMarker,
  isValidMarker,
} from '../src/template.js';
import { Part, PartType, Updater, directiveTag } from '../src/types.js';
import { LocalUpdater } from '../src/updater/local.js';
import { MockBinding, MockDirective } from './mocks.js';
import { getCalls, spy } from './spy.js';

const MARKER = getMarker();

describe('Template', () => {
  describe('.parseHTML()', () => {
    it('should parse holes inside attributes', () => {
      const template = html`
        <input type="checkbox" id=${0} .value=${1} @change=${2}>
      `;
      assert.deepEqual(template.holes, [
        { type: PartType.ATTRIBUTE, name: 'id', index: 0 },
        { type: PartType.PROPERTY, name: 'value', index: 0 },
        { type: PartType.EVENT, name: 'change', index: 0 },
      ]);
      assert.strictEqual(template.element.innerHTML, '<input type="checkbox">');
    });

    it('should parse holes inside double-quoted attributes', () => {
      const template = html`
        <input type="checkbox" id="${0}" .value="${1}" @change="${2}">
      `;
      assert.deepEqual(template.holes, [
        { type: PartType.ATTRIBUTE, name: 'id', index: 0 },
        { type: PartType.PROPERTY, name: 'value', index: 0 },
        { type: PartType.EVENT, name: 'change', index: 0 },
      ]);
      assert.strictEqual(template.element.innerHTML, '<input type="checkbox">');
    });

    it('should parse holes inside single-quoted attributes', () => {
      const template = html`
        <input type="checkbox" id='${0}' .value='${1}' @change='${2}'>
      `;
      assert.deepEqual(template.holes, [
        { type: PartType.ATTRIBUTE, name: 'id', index: 0 },
        { type: PartType.PROPERTY, name: 'value', index: 0 },
        { type: PartType.EVENT, name: 'change', index: 0 },
      ]);
      assert.strictEqual(template.element.innerHTML, '<input type="checkbox">');
    });

    it('should parse a hole inside a tag name', () => {
      const template = html`
        <${0}>
        <${1} >
        <${2}/>
        <${3} />
      `;
      assert.deepEqual(template.holes, [
        { type: PartType.CHILD_NODE, index: 0 },
        { type: PartType.CHILD_NODE, index: 2 },
        { type: PartType.CHILD_NODE, index: 4 },
        { type: PartType.CHILD_NODE, index: 6 },
      ]);
      assert.strictEqual(
        template.element.innerHTML,
        `
        <!---->
        <!---->
        <!---->
        <!---->
      `.trim(),
      );
    });

    it('should parse holes inside elements', () => {
      const template = html`
        <div id="foo" ${0}></div>
        <div ${1} id="foo"></div>
        <div id="foo" ${2} class="bar"></div>
      `;
      assert.deepEqual(template.holes, [
        { type: PartType.ELEMENT, index: 0 },
        { type: PartType.ELEMENT, index: 2 },
        { type: PartType.ELEMENT, index: 4 },
      ]);
      assert.strictEqual(
        template.element.innerHTML,
        `
        <div id="foo"></div>
        <div id="foo"></div>
        <div id="foo" class="bar"></div>
      `.trim(),
      );
    });

    it('should parse holes inside descendants', () => {
      const template = html`
        <ul>
          <li>${1}</li>
          <li>${2}</li>
        </ul>
      `;
      assert.deepEqual(template.holes, [
        { type: PartType.NODE, index: 3 },
        { type: PartType.NODE, index: 6 },
      ]);
      assert.strictEqual(
        template.element.innerHTML,
        `
        <ul>
          <li></li>
          <li></li>
        </ul>
      `.trim(),
      );
    });

    it('should parse multiple holes inside a child', () => {
      const template = html`
        <div>[${0}, ${1}]</div>
        <div>${0}, ${1}</div>
      `;
      assert.deepEqual(template.holes, [
        { type: PartType.NODE, index: 2 },
        { type: PartType.NODE, index: 4 },
        { type: PartType.NODE, index: 8 },
        { type: PartType.NODE, index: 10 },
      ]);
      assert.strictEqual(
        template.element.innerHTML,
        `
        <div>[, ]</div>
        <div>, </div>
      `.trim(),
      );
    });

    it('should parse a hole inside a comment as ChildNodeHole', () => {
      const template = html`
        <!--${0}-->
        <!--${1}/-->
        <!-- ${2} -->
        <!-- ${3} /-->
      `;
      assert.deepEqual(template.holes, [
        { type: PartType.CHILD_NODE, index: 0 },
        { type: PartType.CHILD_NODE, index: 2 },
        { type: PartType.CHILD_NODE, index: 4 },
        { type: PartType.CHILD_NODE, index: 6 },
      ]);
      assert.strictEqual(
        template.element.innerHTML,
        `
        <!---->
        <!---->
        <!---->
        <!---->
      `.trim(),
      );
    });

    it('should parse a hole inside a tag with leading spaces as NodeHole', () => {
      const template = html`
        < ${0}>
        < ${0}/>
      `;
      assert.deepEqual(template.holes, [
        { type: PartType.NODE, index: 1 },
        { type: PartType.NODE, index: 3 },
      ]);
      assert.strictEqual(
        template.element.innerHTML,
        `
        &lt; &gt;
        &lt; /&gt;
      `.trim(),
      );
    });

    it('should throw an error if passed a marker in an invalid format', () => {
      assert.throw(() => {
        Template.parseHTML([], 'INVALID_MARKER');
      }, 'The marker is in an invalid format:');
      assert.throw(() => {
        Template.parseHTML([], MARKER.toUpperCase());
      }, 'The marker is in an invalid format:');
    });

    it('should throw an error when there is a hole as an attribute name', () => {
      assert.throw(() => {
        html`
          <div ${0}="foo"></div>
        `;
      }, 'Expressions are not allowed as an attribute name:');
      assert.throw(() => {
        html`
          <div x-${0}="foo"></div>
        `;
      }, 'Expressions are not allowed as an attribute name:');
      assert.throw(() => {
        html`
          <div ${0}-x="foo"></div>
        `;
      }, 'Expressions are not allowed as an attribute name:');
    });

    it('should throw an error when there is a hole with extra strings inside an attribute value', () => {
      assert.throw(() => {
        html`
          <div class=" ${0}"></div>
        `;
      }, 'Expressions inside an attribute must make up the entire attribute value:');
      assert.throw(() => {
        html`
          <div class="${0} "></div>
        `;
      }, 'Expressions inside an attribute must make up the entire attribute value:');
    });

    it('should throw an error when there is a hole with extra strings inside a tag name', () => {
      assert.throw(() => {
        html`
          <x-${0}>
        `;
      }, 'Expressions are not allowed as a tag name:');
      assert.throw(() => {
        html`
          <${0}-x>
        `;
      }, 'Expressions inside a comment must make up the entire comment value:');
      assert.throw(() => {
        html`
          <${0}/ >
        `;
      }, 'Expressions inside a comment must make up the entire comment value:');
    });

    it('should throw an error when there is a hole with extra strings inside a comment', () => {
      assert.throw(() => {
        html`
          <!-- x-${0} -->
        `;
      }, 'Expressions inside a comment must make up the entire comment value:');
      assert.throw(() => {
        html`
          <!-- ${0}-x -->
        `;
      }, 'Expressions inside a comment must make up the entire comment value:');
      assert.throw(() => {
        html`
          <!-- ${0}/ -->
        `;
      }, 'Expressions inside a comment must make up the entire comment value:');
    });
  });

  describe('.parseSVG()', () => {
    it('should parse holes inside attributes', () => {
      const template = svg`
        <circle fill="black" cx=${0} cy=${1} r=${2} />
      `;
      assert.deepEqual(template.holes, [
        { type: PartType.ATTRIBUTE, name: 'cx', index: 0 },
        { type: PartType.ATTRIBUTE, name: 'cy', index: 0 },
        { type: PartType.ATTRIBUTE, name: 'r', index: 0 },
      ]);
      assert.strictEqual(
        template.element.innerHTML,
        '<circle fill="black"></circle>',
      );
      assert.strictEqual(
        template.element.content.firstElementChild?.namespaceURI,
        'http://www.w3.org/2000/svg',
      );
    });

    it('should throw an error when it is passed a marker in an invalid format', () => {
      assert.throw(() => {
        Template.parseSVG([], 'INVALID_MARKER');
      }, 'The marker is in an invalid format:');
      assert.throw(() => {
        Template.parseSVG([], MARKER.toUpperCase());
      }, 'The marker is in an invalid format:');
    });
  });

  describe('.hydrate()', () => {
    it('should return a TaggedTemplateRoot', () => {
      const template = html`
        <div class=${0}>
          <!-- ${1} -->
          <input type="text" .value=${2} @onchange=${3} ${4}><span>${5}</span>
        </div>
      `;
      const values = [
        'foo',
        'bar',
        'baz',
        () => {},
        { class: 'qux' },
        new MockDirective('quux'),
      ];
      const updater = new LocalUpdater();
      const root = template.hydrate(values, updater);

      assert.instanceOf(root, TemplateRoot);
      assert.lengthOf(root.bindings, values.length);
      assert.lengthOf(root.childNodes, 1);

      assert.sameOrderedMembers(
        root.bindings.map((binding) => binding.value),
        values,
      );

      assert.instanceOf(root.bindings[0], AttributeBinding);
      assert.include(root.bindings[0]?.part, {
        type: PartType.ATTRIBUTE,
        name: 'class',
      });
      assert.instanceOf(root.bindings[1], NodeBinding);
      assert.include(root.bindings[1]?.part, { type: PartType.CHILD_NODE });
      assert.instanceOf(root.bindings[2], PropertyBinding);
      assert.include(root.bindings[2]?.part, {
        type: PartType.PROPERTY,
        name: 'value',
      });
      assert.instanceOf(root.bindings[3], EventBinding);
      assert.include(root.bindings[3]?.part, {
        type: PartType.EVENT,
        name: 'onchange',
      });
      assert.instanceOf(root.bindings[4], SpreadBinding);
      assert.include(root.bindings[4]?.part, {
        type: PartType.ELEMENT,
      });
      assert.instanceOf(root.bindings[5], MockBinding);
      assert.include(root.bindings[5]?.part, {
        type: PartType.NODE,
      });

      updater.flush();

      assert.strictEqual(
        (root.childNodes[0] as Element)?.outerHTML,
        `<div class="foo">
          <!--bar-->
          <input type="text" class="qux"><span></span>
        </div>`,
      );
    });

    it('should throw an error if the number of holes and values do not match', () => {
      const template = html`
        <div class=${0} class=${1}></div>
      `;
      const values = ['foo', 'bar'];
      const updater = new LocalUpdater();
      assert.throws(() => {
        template.hydrate(values, updater);
      });
    });
  });
});

describe('TemplateRoot', () => {
  describe('.mount()', () => {
    it('should mount child nodes on the part', () => {
      const template = html`
        <p>Hello, ${0}!</p>
      `;
      const values = ['World'];
      const updater = new LocalUpdater();
      const root = template.hydrate(values, updater);

      updater.flush();

      const container = document.createElement('div');
      const marker = document.createComment('');

      container.appendChild(marker);

      root.mount({
        type: PartType.CHILD_NODE,
        node: marker,
      });

      assert.strictEqual(container.innerHTML, '<p>Hello, World!</p><!---->');

      root.unmount({
        type: PartType.CHILD_NODE,
        node: marker,
      });

      assert.strictEqual(container.innerHTML, '<!---->');
    });
  });

  describe('.update()', () => {
    it('should update bindings with new values', () => {
      const template = html`
        <p>Count: ${0}</p>
      `;
      const values = [0];
      const updater = new LocalUpdater();
      const root = template.hydrate(values, updater);

      updater.flush();

      assert.strictEqual(
        (root.childNodes[0] as Element)?.outerHTML,
        '<p>Count: 0</p>',
      );

      root.update([1], updater);

      updater.flush();

      assert.strictEqual(
        (root.childNodes[0] as Element)?.outerHTML,
        '<p>Count: 1</p>',
      );
    });
  });

  describe('.disconnect()', () => {
    it('should disconnect bindings', () => {
      const template = html`
        <p>Count: ${0}</p>
      `;
      const values = [
        spy(new MockDirective(0), {
          [directiveTag](
            this: MockDirective<number>,
            part: Part,
            _updater: Updater,
          ) {
            return spy(new MockBinding(part, this));
          },
        }),
      ];
      const updater = new LocalUpdater();
      const root = template.hydrate(values, updater);

      assert.notInclude(
        getCalls(root.bindings[0]).map((call) => call.function.name),
        'disconnect',
      );

      root.disconnect();

      assert.include(
        getCalls(root.bindings[0]).map((call) => call.function.name),
        'disconnect',
      );
    });
  });
});

describe('getMarker()', () => {
  it('returns a valid marker string', () => {
    assert.isTrue(isValidMarker(getMarker()));

    // force randomUUID() polyfill.
    const originalRandomUUID = crypto.randomUUID;
    try {
      (crypto as any).randomUUID = null;
      assert.isTrue(isValidMarker(getMarker()));
    } finally {
      crypto.randomUUID = originalRandomUUID;
    }
  });
});

function html(tokens: TemplateStringsArray, ..._values: unknown[]): Template {
  return Template.parseHTML(tokens, MARKER);
}

function svg(tokens: TemplateStringsArray, ..._values: unknown[]): Template {
  return Template.parseSVG(tokens, MARKER);
}
