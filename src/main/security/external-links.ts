/**
 * Reglas puras de validación de enlaces externos.
 *
 * Solo se abre en el navegador del sistema una URL `https:` absoluta, sin
 * credenciales, sin espacios, con longitud acotada y que no apunte al propio
 * equipo ni a una red privada. Es una función pura: no importa Electron ni
 * abre nada, para poder probarla sin abrir una ventana (ADR 0004).
 */

/** Longitud máxima admitida de una URL externa. */
export const MAX_EXTERNAL_URL_LENGTH = 2048;

/** Motivo por el que se rechaza un enlace externo. */
export type ExternalLinkDenialReason =
  | 'EMPTY'
  | 'TOO_LONG'
  | 'WHITESPACE'
  | 'INVALID_URL'
  | 'UNSUPPORTED_SCHEME'
  | 'CREDENTIALS'
  | 'PRIVATE_HOST';

/** Decisión sobre un enlace externo. */
export type ExternalLinkDecision =
  | { readonly kind: 'allow'; readonly url: string }
  | { readonly kind: 'deny'; readonly reason: ExternalLinkDenialReason };

function deny(reason: ExternalLinkDenialReason): ExternalLinkDecision {
  return { kind: 'deny', reason };
}

/**
 * Detecta espacios, tabuladores y caracteres de control.
 *
 * El parser de URL elimina unos y codifica otros, así que la comprobación es
 * explícita antes de parsear para que un salto de línea dentro del host no se
 * cuele como parte del dominio.
 */
function hasWhitespaceOrControl(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;

    if (code <= 0x20 || code === 0x7f) {
      return true;
    }
  }

  return false;
}

type Ipv4Octets = {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
};

function parseIpv4(hostname: string): Ipv4Octets | null {
  const parts = hostname.split('.');

  if (parts.length !== 4) {
    return null;
  }

  const octets: number[] = [];

  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return null;
    }

    const value = Number(part);

    if (value > 255) {
      return null;
    }

    octets.push(value);
  }

  const [a, b, c, d] = octets;

  if (
    a === undefined ||
    b === undefined ||
    c === undefined ||
    d === undefined
  ) {
    return null;
  }

  return { a, b, c, d };
}

/**
 * Rangos IPv4 que no deben abrirse: loopback, redes privadas, enlace local,
 * CGNAT y la dirección comodín.
 */
function isPrivateIpv4(octets: Ipv4Octets): boolean {
  const { a, b } = octets;

  if (a === 0 || a === 10 || a === 127) {
    return true;
  }

  if (a === 169 && b === 254) {
    return true;
  }

  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }

  if (a === 192 && b === 168) {
    return true;
  }

  return a === 100 && b >= 64 && b <= 127;
}

function isPrivateIpv6(address: string): boolean {
  const value = address.toLowerCase();

  if (value === '::' || value === '::1') {
    return true;
  }

  // Enlace local (`fe80::/10`) y direcciones únicas locales (`fc00::/7`).
  if (/^fe[89ab][0-9a-f]?:/.test(value)) {
    return true;
  }

  if (/^f[cd][0-9a-f]{2}:/.test(value)) {
    return true;
  }

  // IPv4 mapeada: se delega en la comprobación IPv4 y, si no se puede
  // interpretar, se rechaza por precaución.
  if (value.startsWith('::ffff:')) {
    const mapped = parseIpv4(value.slice('::ffff:'.length));

    return mapped === null ? true : isPrivateIpv4(mapped);
  }

  return false;
}

/** El parser de URL entrega los hosts IPv6 entre corchetes. */
function stripIpv6Brackets(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;
}

function isPrivateHostname(hostname: string): boolean {
  const host = stripIpv6Brackets(hostname).toLowerCase().replace(/\.$/, '');

  if (host.length === 0) {
    return true;
  }

  if (host === 'localhost' || host.endsWith('.localhost')) {
    return true;
  }

  const ipv4 = parseIpv4(host);

  if (ipv4 !== null) {
    return isPrivateIpv4(ipv4);
  }

  if (host.includes(':')) {
    return isPrivateIpv6(host);
  }

  return false;
}

/**
 * Decide si una URL puede abrirse en el navegador del sistema.
 *
 * Devuelve la URL normalizada por el parser cuando se admite, para que se abra
 * exactamente lo validado y no la cadena original.
 */
export function resolveExternalUrl(rawUrl: string): ExternalLinkDecision {
  if (rawUrl.length === 0) {
    return deny('EMPTY');
  }

  if (rawUrl.length > MAX_EXTERNAL_URL_LENGTH) {
    return deny('TOO_LONG');
  }

  // El parser de URL elimina espacios, tabuladores y controles C0 de los
  // extremos y codifica los interiores, así que la comprobación es explícita
  // antes de parsear.
  if (hasWhitespaceOrControl(rawUrl)) {
    return deny('WHITESPACE');
  }

  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    return deny('INVALID_URL');
  }

  if (url.protocol !== 'https:') {
    return deny('UNSUPPORTED_SCHEME');
  }

  if (url.username !== '' || url.password !== '') {
    return deny('CREDENTIALS');
  }

  if (isPrivateHostname(url.hostname)) {
    return deny('PRIVATE_HOST');
  }

  return { kind: 'allow', url: url.href };
}
