import { assert } from 'chai';

import { TaggedTemplate, getMarker, isValidMarker } from '../src/template.js';
import { PartType } from '../src/types.js';

describe('TaggedTemplate', () => {
  const MARKER = getMarker();

  function html(
    tokens: TemplateStringsArray,
    ..._values: unknown[]
  ): TaggedTemplate {
    return TaggedTemplate.parseHTML(tokens, MARKER);
  }

  function svg(
    tokens: TemplateStringsArray,
    ..._values: unknown[]
  ): TaggedTemplate {
    return TaggedTemplate.parseSVG(tokens, MARKER);
  }

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
        TaggedTemplate.parseHTML([], 'INVALID_MARKER');
      }, 'The marker is in an invalid format:');
      assert.throw(() => {
        TaggedTemplate.parseHTML([], MARKER.toUpperCase());
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
        TaggedTemplate.parseSVG([], 'INVALID_MARKER');
      }, 'The marker is in an invalid format:');
      assert.throw(() => {
        TaggedTemplate.parseSVG([], MARKER.toUpperCase());
      }, 'The marker is in an invalid format:');
    });
  });
});

describe('getMarker()', () => {
  it('returns a valid marker string', () => {
    assert.ok(isValidMarker(getMarker()));

    // force randomUUID() polyfill.
    const originalRandomUUID = crypto.randomUUID;
    try {
      (crypto as any).randomUUID = null;
      assert.ok(isValidMarker(getMarker()));
    } finally {
      crypto.randomUUID = originalRandomUUID;
    }
  });
});
