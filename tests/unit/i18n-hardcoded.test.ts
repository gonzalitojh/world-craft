import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import {
  HARDCODED_ALLOWLIST,
  type HardcodedAllowlistEntry,
} from '../fixtures/i18n/allowlist';

/**
 * Auditoría estática de internacionalización.
 *
 * No sustituye a una revisión, pero bloquea los fallos que más se repiten: una
 * frase escrita a mano en JSX (en texto, en un atributo visible o dentro de una
 * expresión) y un componente cliente que importa el catálogo (y lo mete en el
 * bundle del navegador).
 *
 * La detección usa la API de TypeScript, no expresiones regulares: así
 * distingue texto JSX de un atributo `className` o de un comentario.
 *
 * Limitaciones conocidas, aceptadas para no generar falsos positivos:
 * - Solo se revisan atributos de la lista `VISIBLE_ATTRIBUTES`; una prop nueva
 *   que pinte texto debe añadirse allí.
 * - En expresiones JSX solo se marcan cadenas que parecen prosa (mayúscula
 *   inicial, acentos o puntuación de frase). Un literal en minúsculas y sin
 *   acentos —por ejemplo `'nuevo'`— no se detecta.
 * - No se analizan plantillas con interpolación (`${...}`).
 * - Los textos que llegan como dato (constantes, props) no son literales JSX y
 *   quedan fuera de esta auditoría.
 */

const SRC_DIR = fileURLToPath(new URL('../../src', import.meta.url));
const MESSAGES_DIR = path.join(SRC_DIR, 'messages');
const SERVER_MODULE = path.join(SRC_DIR, 'lib', 'i18n', 'server');

/** Atributos JSX cuyo valor llega al usuario. */
const VISIBLE_ATTRIBUTES = new Set([
  'alt',
  'aria-description',
  'aria-label',
  'aria-placeholder',
  'label',
  'note',
  'placeholder',
  'title',
]);

type Violation = {
  file: string;
  line: number;
  value: string;
  kind: 'text' | 'attribute' | 'expression' | 'import';
};

function listSourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return listSourceFiles(fullPath);
    }

    return /\.tsx?$/.test(entry.name) ? [fullPath] : [];
  });
}

/** Ruta relativa al repositorio, siempre con `/`. */
function relativePath(file: string): string {
  return path.relative(path.dirname(SRC_DIR), file).split(path.sep).join('/');
}

const LETTER = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/;

function hasLetters(value: string): boolean {
  return LETTER.test(value);
}

/**
 * Heurística para separar texto de interfaz de un token técnico dentro de una
 * expresión JSX.
 *
 * Las clases de Tailwind, las claves y los valores de enumeración van en
 * minúsculas y sin acentos; una frase de interfaz empieza por mayúscula o
 * lleva acentos o puntuación de frase.
 */
function looksLikeProse(value: string): boolean {
  const trimmed = value.trim();

  if (!hasLetters(trimmed)) {
    return false;
  }

  return (
    /^[A-ZÁÉÍÓÚÜÑ¿¡]/.test(trimmed) ||
    /[áéíóúüñÁÉÍÓÚÜÑ¿¡]/.test(trimmed) ||
    /[.!?](?:\s|$)/.test(trimmed)
  );
}

function isClientModule(sourceFile: ts.SourceFile): boolean {
  const firstStatement = sourceFile.statements[0];

  if (!firstStatement) {
    return false;
  }

  return (
    ts.isExpressionStatement(firstStatement) &&
    ts.isStringLiteral(firstStatement.expression) &&
    firstStatement.expression.text === 'use client'
  );
}

function lineOf(sourceFile: ts.SourceFile, node: ts.Node): number {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  return line + 1;
}

/** Recorre una expresión JSX y avisa de las cadenas que se pintan. */
function visitExpression(
  node: ts.Node,
  report: (node: ts.Node, value: string) => void,
): void {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    if (looksLikeProse(node.text)) {
      report(node, node.text);
    }

    return;
  }

  // Un `t('clave')`, un `format.number(...)` o un objeto de props no pintan
  // sus literales: no se recorren para no marcar claves ni configuraciones.
  if (
    ts.isCallExpression(node) ||
    ts.isNewExpression(node) ||
    ts.isObjectLiteralExpression(node) ||
    ts.isArrayLiteralExpression(node) ||
    ts.isFunctionLike(node) ||
    ts.isJsxElement(node) ||
    ts.isJsxSelfClosingElement(node) ||
    ts.isJsxFragment(node)
  ) {
    return;
  }

  ts.forEachChild(node, (child) => {
    visitExpression(child, report);
  });
}

/** ¿La expresión es hija directa de un elemento, es decir, se pinta? */
function isRenderedExpression(node: ts.JsxExpression): boolean {
  return ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent);
}

function collectVisibleViolations(
  sourceFile: ts.SourceFile,
  file: string,
): Violation[] {
  const violations: Violation[] = [];

  function report(kind: Violation['kind'], node: ts.Node, value: string): void {
    violations.push({ file, line: lineOf(sourceFile, node), value, kind });
  }

  function visit(node: ts.Node): void {
    if (ts.isJsxText(node)) {
      const value = node.text.trim();

      if (hasLetters(value)) {
        report('text', node, value);
      }
    }

    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sourceFile);
      const initializer = node.initializer;

      if (!VISIBLE_ATTRIBUTES.has(name) || !initializer) {
        ts.forEachChild(node, visit);
        return;
      }

      if (ts.isStringLiteral(initializer) && hasLetters(initializer.text)) {
        report('attribute', node, initializer.text);
      }

      if (ts.isJsxExpression(initializer) && initializer.expression) {
        visitExpression(initializer.expression, (target, value) => {
          report('attribute', target, value);
        });
      }
    }

    if (
      ts.isJsxExpression(node) &&
      node.expression &&
      isRenderedExpression(node)
    ) {
      visitExpression(node.expression, (target, value) => {
        report('expression', target, value);
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return violations;
}

/** Resuelve un import relativo a ruta absoluta sin extensión. */
function resolveRelativeModule(file: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) {
    return null;
  }

  const resolved = path.resolve(path.dirname(file), specifier);

  return resolved.replace(/\.(?:tsx?|jsx?|mjs|cjs)$/, '');
}

/** ¿El módulo contiene catálogos o código de servidor? */
function isForbiddenModule(file: string, specifier: string): boolean {
  if (specifier === '@/lib/i18n/server') {
    return true;
  }

  // El barril `@/messages` arrastra los catálogos; `translator` no.
  if (specifier === '@/messages' || specifier === '@/messages/index') {
    return true;
  }

  if (
    specifier.startsWith('@/messages/') &&
    specifier !== '@/messages/translator'
  ) {
    return true;
  }

  const resolved = resolveRelativeModule(file, specifier);

  if (!resolved) {
    return false;
  }

  if (resolved === SERVER_MODULE) {
    return true;
  }

  if (
    resolved === MESSAGES_DIR ||
    resolved === path.join(MESSAGES_DIR, 'index')
  ) {
    return true;
  }

  return (
    resolved.startsWith(MESSAGES_DIR + path.sep) &&
    resolved !== path.join(MESSAGES_DIR, 'translator')
  );
}

function collectImportViolations(
  sourceFile: ts.SourceFile,
  file: string,
  fullPath: string,
): Violation[] {
  if (!isClientModule(sourceFile)) {
    return [];
  }

  const violations: Violation[] = [];

  function report(node: ts.Node, specifier: string): void {
    violations.push({
      file,
      line: lineOf(sourceFile, node),
      value: specifier,
      kind: 'import',
    });
  }

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      const specifier = statement.moduleSpecifier;

      // `import type` desaparece al compilar: no arrastra el catálogo.
      if (
        ts.isStringLiteral(specifier) &&
        !statement.importClause?.isTypeOnly &&
        isForbiddenModule(fullPath, specifier.text)
      ) {
        report(statement, specifier.text);
      }
    }

    if (
      ts.isExportDeclaration(statement) &&
      !statement.isTypeOnly &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      isForbiddenModule(fullPath, statement.moduleSpecifier.text)
    ) {
      report(statement, statement.moduleSpecifier.text);
    }
  }

  function visit(node: ts.Node): void {
    // `import('./catálogo')` también mete el módulo en el bundle.
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0
    ) {
      const argument = node.arguments[0];

      if (
        argument &&
        ts.isStringLiteral(argument) &&
        isForbiddenModule(fullPath, argument.text)
      ) {
        report(node, argument.text);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return violations;
}

function sourceFileOf(fullPath: string, text: string): ts.SourceFile {
  return ts.createSourceFile(
    fullPath,
    text,
    ts.ScriptTarget.Latest,
    true,
    fullPath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function auditSource(
  text: string,
  fileName = 'src/components/example.tsx',
): Violation[] {
  const fullPath = path.join(path.dirname(SRC_DIR), ...fileName.split('/'));
  const sourceFile = sourceFileOf(fullPath, text);

  return [
    ...collectVisibleViolations(sourceFile, fileName),
    ...collectImportViolations(sourceFile, fileName, fullPath),
  ];
}

function audit(): Violation[] {
  return listSourceFiles(SRC_DIR).flatMap((fullPath) => {
    const text = fs.readFileSync(fullPath, 'utf8');
    const sourceFile = sourceFileOf(fullPath, text);
    const file = relativePath(fullPath);

    return [
      ...collectVisibleViolations(sourceFile, file),
      ...collectImportViolations(sourceFile, file, fullPath),
    ];
  });
}

function allowlistKey(entry: Pick<HardcodedAllowlistEntry, 'file' | 'value'>) {
  return `${entry.file}\u0000${entry.value}`;
}

describe('auditoría i18n', () => {
  const violations = audit();
  const allowlist = new Set(HARDCODED_ALLOWLIST.map(allowlistKey));

  it('no deja textos visibles fuera del catálogo', () => {
    const unexpected = violations
      .filter((violation) => violation.kind !== 'import')
      .filter((violation) => !allowlist.has(allowlistKey(violation)))
      .map(
        (violation) =>
          `${violation.file}:${violation.line} → «${violation.value}»`,
      );

    expect(unexpected).toEqual([]);
  });

  it('ningún componente cliente importa el catálogo ni módulos de servidor', () => {
    const unexpected = violations
      .filter((violation) => violation.kind === 'import')
      .map(
        (violation) =>
          `${violation.file}:${violation.line} → ${violation.value}`,
      );

    expect(unexpected).toEqual([]);
  });

  it('la allowlist no tiene entradas muertas', () => {
    const found = new Set(violations.map(allowlistKey));
    const unused = HARDCODED_ALLOWLIST.filter(
      (entry) => !found.has(allowlistKey(entry)),
    ).map((entry) => `${entry.file} → «${entry.value}»`);

    expect(unused).toEqual([]);
  });

  it('cada excepción de la allowlist explica su motivo', () => {
    for (const entry of HARDCODED_ALLOWLIST) {
      expect(entry.reason.trim().length).toBeGreaterThan(10);
    }
  });
});

describe('detección de la auditoría', () => {
  it('detecta texto suelto en JSX', () => {
    const violations = auditSource('export const A = () => <p>Hola</p>;');

    expect(violations).toMatchObject([
      { kind: 'text', value: 'Hola', file: 'src/components/example.tsx' },
    ]);
  });

  it('detecta una cadena dentro de una expresión JSX', () => {
    const violations = auditSource(
      'export const A = () => <p>{ready ? "No disponible" : null}</p>;',
    );

    expect(violations).toMatchObject([
      { kind: 'expression', value: 'No disponible' },
    ]);
  });

  it('detecta atributos custom visibles como label y note', () => {
    const violations = auditSource(
      'export const A = () => <Field label="Nombre" note="Opcional" />;',
    );

    expect(violations.map((violation) => violation.value)).toEqual([
      'Nombre',
      'Opcional',
    ]);
  });

  it('ignora claves de traducción, className y expresiones técnicas', () => {
    const violations = auditSource(
      [
        'export const A = () => (',
        '  <p className={active ? "text-accent" : "text-muted"} title={t("a11y.title")}>',
        '    {t("home.title")}',
        '    {count > 0 ? format.number(count) : null}',
        '  </p>',
        ');',
      ].join('\n'),
    );

    expect(violations).toEqual([]);
  });

  it('bloquea el barril @/messages y @/messages/index en cliente', () => {
    const violations = auditSource(
      [
        "'use client';",
        "import { es } from '@/messages';",
        "import { catalogs } from '@/messages/index';",
        'export const A = () => es.home.title + Object.keys(catalogs).length;',
      ].join('\n'),
    );

    expect(violations.map((violation) => violation.value)).toEqual([
      '@/messages',
      '@/messages/index',
    ]);
  });

  it('bloquea imports relativos al catálogo y al módulo de servidor', () => {
    const violations = auditSource(
      [
        "'use client';",
        "import { es } from '../messages/es';",
        "import { getI18n } from '../lib/i18n/server';",
        'export const A = () => es.home.title + String(getI18n);',
      ].join('\n'),
    );

    expect(violations.map((violation) => violation.value)).toEqual([
      '../messages/es',
      '../lib/i18n/server',
    ]);
  });

  it('permite `import type` y el traductor sin catálogos', () => {
    const violations = auditSource(
      [
        "'use client';",
        "import type { Messages } from '@/messages';",
        "import { createTranslator } from '../messages/translator';",
        'export const A = () => createTranslator({} as Messages);',
      ].join('\n'),
    );

    expect(violations).toEqual([]);
  });

  it('bloquea re-exports y cargas dinámicas del catálogo', () => {
    const violations = auditSource(
      [
        "'use client';",
        "export { es } from '@/messages/es';",
        'export const load = () => import("@/messages");',
      ].join('\n'),
    );

    expect(violations.map((violation) => violation.value)).toEqual([
      '@/messages/es',
      '@/messages',
    ]);
  });
});
