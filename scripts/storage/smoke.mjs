/**
 * Smoke real de Cloudflare R2.
 *
 * Uso: `pnpm storage:smoke`.
 *
 * Requiere las variables R2_* en `.env.local` (o en el entorno) y un bucket
 * privado de desarrollo. Comprueba:
 * 1. Un PUT directo con el cliente S3.
 * 2. Que una URL sin firma **no** permite leer (400/401/403/404).
 * 3. Que una URL firmada devuelve 200.
 * 4. Que una URL firmada con TTL de 1 s caduca tras la espera.
 * 5. Que el borrado deja el objeto inaccesible.
 *
 * Reglas de seguridad: nunca imprime claves completas, URLs firmadas ni
 * credenciales. Solo muestra el estado HTTP y un identificador enmascarado.
 *
 * Este script no sustituye a los tests: no se ejecuta en CI ni en `pnpm test`
 * porque necesita credenciales reales.
 */
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';

const ENV_FILES = ['.env.local', '.env'];

/** Carga el entorno local si existe. */
function loadEnv() {
  for (const file of ENV_FILES) {
    if (existsSync(file)) {
      process.loadEnvFile(file);
      return file;
    }
  }

  return undefined;
}

/** Lee una variable obligatoria sin imprimir su valor. */
function required(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    console.error(
      `Falta ${name}. Copia .env.example a .env.local y rellena las variables de R2 del bucket de desarrollo.`,
    );
    process.exit(1);
  }

  return value;
}

/** Enmascara una clave para los logs. */
function maskKey(key) {
  const name = key.split('/').at(-1) ?? key;
  return `${key.split('/')[0]}/…/${name.slice(0, 4)}…`;
}

/** Comprueba el estado de una URL sin lanzar por HTTP no-2xx. */
async function statusOf(url) {
  const response = await fetch(url, { method: 'GET' });
  return response.status;
}

async function main() {
  const envFile = loadEnv();

  if (envFile) {
    console.log(`Entorno cargado desde ${envFile}.`);
  }

  const accessKeyId = required('R2_ACCESS_KEY_ID');
  const secretAccessKey = required('R2_SECRET_ACCESS_KEY');
  const bucket = required('R2_BUCKET_NAME');
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const configuredEndpoint = process.env.R2_ENDPOINT?.trim();
  const endpoint =
    configuredEndpoint ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);

  if (endpoint === undefined) {
    console.error(
      'Falta R2_ACCOUNT_ID o R2_ENDPOINT. Rellena uno de los dos en .env.local para construir el endpoint S3 de R2.',
    );
    process.exit(1);
  }

  const client = new S3Client({
    region: 'auto',
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });

  const key = `world-craft-smoke/${randomUUID()}.png`;
  const png = await sharp({
    create: {
      width: 32,
      height: 32,
      channels: 3,
      background: { r: 40, g: 80, b: 120 },
    },
  })
    .png()
    .toBuffer();

  let exitCode = 0;

  const check = (label, ok, detail) => {
    console.log(
      `${ok ? 'OK  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`,
    );

    if (!ok) {
      exitCode = 1;
    }
  };

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: png,
        ContentType: 'image/png',
      }),
    );
    check('Subida directa (PUT)', true, maskKey(key));

    const unsigned = `${endpoint}/${bucket}/${key}`;
    const unsignedStatus = await statusOf(unsigned);
    check(
      'URL sin firma rechazada',
      [400, 401, 403, 404].includes(unsignedStatus),
      `HTTP ${unsignedStatus}`,
    );

    const signedUrl = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: 60 },
    );
    const signedStatus = await statusOf(signedUrl);
    check(
      'URL firmada de lectura',
      signedStatus === 200,
      `HTTP ${signedStatus}`,
    );

    const shortUrl = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: 1 },
    );
    await delay(2000);
    const expiredStatus = await statusOf(shortUrl);
    check(
      'URL firmada caducada',
      expiredStatus === 403,
      `HTTP ${expiredStatus}`,
    );
  } finally {
    try {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      check('Borrado', true, maskKey(key));
    } catch (error) {
      check('Borrado', false, error instanceof Error ? error.message : 'error');
    }

    const afterDelete = await (async () => {
      try {
        const url = await getSignedUrl(
          client,
          new GetObjectCommand({ Bucket: bucket, Key: key }),
          { expiresIn: 30 },
        );

        return await statusOf(url);
      } catch {
        return 0;
      }
    })();
    check(
      'Objeto borrado no accesible',
      afterDelete === 403 || afterDelete === 404,
      `HTTP ${afterDelete}`,
    );
  }

  if (exitCode !== 0) {
    console.error(
      '\nSmoke de R2 con fallos. Revisa las credenciales, el bucket y CORS.',
    );
    process.exitCode = 1;
    return;
  }

  console.log('\nSmoke de R2 correcto.');
}

main().catch((error) => {
  console.error(
    `Smoke de R2 falló: ${error instanceof Error ? error.message : 'error inesperado'}`,
  );
  process.exitCode = 1;
});
