/**
 * Prueba de cadenas visibles hardcodeadas.
 *
 * Recorre el AST de JSX de los componentes, páginas, shell y `App`. Falla si
 * un texto hijo o un atributo visible (`aria-label`, `alt`, `title`,
 * `placeholder`...) contiene un literal. Los atributos técnicos (`className`,
 * `role`, `id`, `type`...) y los comentarios no cuentan.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const RENDERER_ROOT = fileURLToPath(
  new URL('../../../src/renderer/', import.meta.url),
);

const VISIBLE_ATTRIBUTES = new Set([
  'alt',
  'aria-description',
  'aria-label',
  'aria-placeholder',
  'aria-roledescription',
  'aria-valuetext',
  'defaultValue',
  'description',
  'error',
  'heading',
  'hint',
  'label',
  'message',
  'placeholder',
  'title',
  'value',
]);

function listTsxFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return listTsxFiles(fullPath);
    }

    return entry.isFile() && entry.name.endsWith('.tsx') ? [fullPath] : [];
  });
}

function findHardcodedStrings(filePath: string): readonly string[] {
  const source = readFileSync(filePath, 'utf8');
  const file = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const violations: string[] = [];

  const report = (node: ts.Node, detail: string): void => {
    const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
    const relative = path.relative(RENDERER_ROOT, filePath);
    violations.push(`${relative}:${line + 1} ${detail}`);
  };

  const isVisibleLiteral = (node: ts.Node | undefined): boolean =>
    node !== undefined && ts.isStringLiteral(node) && isVisibleText(node.text);

  const isVisibleText = (text: string): boolean =>
    /\p{L}/u.test(text) && text.trim().length > 0;

  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node) && isVisibleText(node.text)) {
      report(node, `texto literal «${node.text.trim()}»`);
    }

    if (
      ts.isJsxAttribute(node) &&
      VISIBLE_ATTRIBUTES.has(node.name.getText(file))
    ) {
      const initializer = node.initializer;

      if (initializer !== undefined) {
        if (ts.isStringLiteral(initializer) && isVisibleLiteral(initializer)) {
          report(initializer, `atributo ${node.name.getText(file)} literal`);
        } else if (
          ts.isJsxExpression(initializer) &&
          isVisibleLiteral(initializer.expression)
        ) {
          report(initializer, `atributo ${node.name.getText(file)} literal`);
        }
      }
    }

    if (
      ts.isJsxExpression(node) &&
      node.parent !== undefined &&
      !ts.isJsxAttribute(node.parent)
    ) {
      const expression = node.expression;

      if (
        expression !== undefined &&
        ts.isStringLiteral(expression) &&
        isVisibleText(expression.text)
      ) {
        report(node, `expresión de texto literal «${expression.text}»`);
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(file);

  return violations;
}

describe('textos visibles del renderer', () => {
  it('los componentes base, las páginas y el shell no tienen literales visibles', () => {
    const files = [
      ...listTsxFiles(path.join(RENDERER_ROOT, 'components')),
      ...listTsxFiles(path.join(RENDERER_ROOT, 'pages')),
      ...listTsxFiles(path.join(RENDERER_ROOT, 'shell')),
      path.join(RENDERER_ROOT, 'App.tsx'),
    ];
    const violations = files.flatMap(findHardcodedStrings);

    expect(
      violations,
      `Cadenas visibles fuera del catálogo:\n${violations.join('\n')}`,
    ).toEqual([]);
  });

  it('la prueba detecta un literal real y no atributos técnicos', () => {
    const temporary = path.join(RENDERER_ROOT, '__scan-example.tsx');

    // Se analiza una fuente en memoria sin escribir en el repositorio.
    const source = [
      'export function Example() {',
      '  return <button className="wc-button" aria-label="Guardar">Guardar</button>;',
      '}',
    ].join('\n');
    const file = ts.createSourceFile(
      temporary,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const violations: string[] = [];

    const visit = (node: ts.Node): void => {
      if (ts.isJsxText(node) && node.text.trim().length > 0) {
        violations.push(node.text.trim());
      }

      if (
        ts.isJsxAttribute(node) &&
        node.name.getText(file) === 'aria-label' &&
        node.initializer !== undefined &&
        ts.isStringLiteral(node.initializer)
      ) {
        violations.push(node.initializer.text);
      }

      ts.forEachChild(node, visit);
    };

    visit(file);

    expect(violations).toEqual(['Guardar', 'Guardar']);
  });
});
