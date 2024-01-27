import { Template } from './template';
import { TemplateResult } from './templateResult';

export interface TemplateFactoryInterface {
  createTemplate(
    strings: TemplateStringsArray,
    values: unknown[],
  ): TemplateResult;
}

export class TemplateFactory implements TemplateFactory {
  private readonly _marker: string;

  private readonly _templateCaches: WeakMap<TemplateStringsArray, Template> =
    new WeakMap();

  constructor() {
    this._marker = '{{' + getUUID() + '}}';
  }

  createTemplate(
    strings: TemplateStringsArray,
    values: unknown[],
  ): TemplateResult {
    let template = this._templateCaches.get(strings);

    if (!template) {
      template = Template.parse(strings, this._marker);
      this._templateCaches.set(strings, template);
    }

    return new TemplateResult(template, values);
  }
}

function getUUID(): string {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  const s = [...crypto.getRandomValues(new Uint8Array(16))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return (
    s.slice(0, 8) +
    '-' +
    s.slice(8, 12) +
    '-' +
    s.slice(12, 16) +
    '-' +
    s.slice(16, 20) +
    '-' +
    s.slice(20, 32)
  );
}
