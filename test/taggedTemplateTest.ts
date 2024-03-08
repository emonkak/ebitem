import { assert } from 'chai';

import { TaggedTemplate } from '../src/taggedTemplate.js';

describe('Template', () => {
  const MARKER = `?${crypto.randomUUID()}?`;

  function html(tokens: TemplateStringsArray, ..._values: unknown[]) {
    return TaggedTemplate.parseHTML(tokens, MARKER);
  }

  function svg(tokens: TemplateStringsArray, ..._values: unknown[]) {
    return TaggedTemplate.parseSVG(tokens, MARKER);
  }

  describe('.parseHTML()', () => {
    it('should parse holes inside attributes', () => {
      const template = html`
        <input type="checkbox" id=${0} .value=${1} @change=${2}>
      `;
      assert.deepEqual(template.holes, [
        { type: 'attribute', name: 'id', index: 0 },
        { type: 'property', name: 'value', index: 0 },
        { type: 'event', name: 'change', index: 0 },
      ]);
      assert.strictEqual(template.element.innerHTML, '<input type="checkbox">');
    });

    it('should parse holes inside double-quoted attributes', () => {
      const template = html`
        <input type="checkbox" id="${0}" .value="${1}" @change="${2}">
      `;
      assert.deepEqual(template.holes, [
        { type: 'attribute', name: 'id', index: 0 },
        { type: 'property', name: 'value', index: 0 },
        { type: 'event', name: 'change', index: 0 },
      ]);
      assert.strictEqual(template.element.innerHTML, '<input type="checkbox">');
    });

    it('should parse holes inside single-quoted attributes', () => {
      const template = html`
        <input type="checkbox" id='${0}' .value='${1}' @change='${2}'>
      `;
      assert.deepEqual(template.holes, [
        { type: 'attribute', name: 'id', index: 0 },
        { type: 'property', name: 'value', index: 0 },
        { type: 'event', name: 'change', index: 0 },
      ]);
      assert.strictEqual(template.element.innerHTML, '<input type="checkbox">');
    });

    it('should parse holes inside elements', () => {
      const template = html`
        <div id="foo" ${0}></div>
        <div ${0} id="foo"></div>
        <div id="foo" ${0} class="bar"></div>
      `;
      assert.deepEqual(template.holes, [
        { type: 'element', index: 0 },
        { type: 'element', index: 2 },
        { type: 'element', index: 4 },
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
        { type: 'childNode', index: 3 },
        { type: 'childNode', index: 6 },
      ]);
      assert.strictEqual(
        template.element.innerHTML,
        `
        <ul>
          <li><!----></li>
          <li><!----></li>
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
        { type: 'childNode', index: 2 },
        { type: 'childNode', index: 4 },
        { type: 'childNode', index: 8 },
        { type: 'childNode', index: 10 },
      ]);
      assert.strictEqual(
        template.element.innerHTML,
        `
        <div>[<!---->, <!---->]</div>
        <div><!---->, <!----></div>
      `.trim(),
      );
    });

    it('should throw an error when it is passed a marker in an invalid format', () => {
      assert.throw(() => {
        TaggedTemplate.parseHTML([], 'INVALID_MARKER');
      }, 'The marker is in an invalid format:');
      assert.throw(() => {
        TaggedTemplate.parseHTML([], MARKER.toUpperCase());
      }, 'The marker is in an invalid format:');
    });

    it('should throw an error when there is a hole as a tag name', () => {
      assert.throw(() => {
        html`
          <${0}>
        `;
      }, 'Expressions are not allowed inside a comment:');
      assert.throw(() => {
        html`
          <x-${0}>
        `;
      }, 'Expressions are not allowed as a tag name:');
      assert.throw(() => {
        html`
          <${0}-x>
        `;
      }, 'Expressions are not allowed inside a comment:');
    });

    it('should throw an error when there is a hole ad an attribute name', () => {
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

    it('should throw an error when there is a hole inside a comment', () => {
      assert.throw(() => {
        html`
          <!-- ${0} -->
        `;
      }, 'Expressions are not allowed inside a comment:');
    });
  });

  describe('.parseSVG()', () => {
    it('should parse holes inside attributes', () => {
      const template = svg`
        <circle fill="black" cx=${0} cy=${1} r=${2} />
      `;
      assert.deepEqual(template.holes, [
        { type: 'attribute', name: 'cx', index: 0 },
        { type: 'attribute', name: 'cy', index: 0 },
        { type: 'attribute', name: 'r', index: 0 },
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
        TaggedTemplate.parseSVG([], 'INVALID_MARKER');
      }, 'The marker is in an invalid format:');
      assert.throw(() => {
        TaggedTemplate.parseSVG([], MARKER.toUpperCase());
      }, 'The marker is in an invalid format:');
    });
  });
});
