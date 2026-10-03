import type { JwtClaims } from '@ahincho/nova-nestjs';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

/** De dónde salen las claves públicas del emisor. Una prueba pasa las suyas. */
export type KeySource = (issuer: string) => JWTVerifyGetKey;

/** Las claves que publica Keycloak para un realm. */
export const keycloakKeys: KeySource = (issuer) =>
  createRemoteJWKSet(new URL(`${issuer}/protocol/openid-connect/certs`));

/**
 * Verifica el token del cliente contra Keycloak (ADR-043): la firma con las
 * claves públicas del emisor, el emisor y el vencimiento. Es la `verify` que el
 * módulo de autenticación de Nova le pide al servicio; sin ella leería los
 * claims sin comprobar nada.
 *
 * El BFF es el único que valida el token. Los servicios confían en él, y
 * reciben el cliente en `X-Customer-Id`.
 *
 * El emisor se lee en la primera petición y no al importar: así el módulo se
 * arma aunque `KEYCLOAK_ISSUER` llegue después, y el error la nombra.
 */
export function keycloakVerifier(
  keys: KeySource = keycloakKeys,
  env: NodeJS.ProcessEnv = process.env,
): (token: string) => Promise<JwtClaims> {
  let resolved: { issuer: string; keys: JWTVerifyGetKey } | undefined;

  return async (token) => {
    if (resolved === undefined) {
      const issuer = env['KEYCLOAK_ISSUER']?.trim().replace(/\/+$/, '');
      if (issuer === undefined || issuer === '') {
        throw new Error(
          'Falta KEYCLOAK_ISSUER, como http://localhost:8180/realms/plaza',
        );
      }
      resolved = { issuer, keys: keys(issuer) };
    }
    const { payload } = await jwtVerify(token, resolved.keys, {
      issuer: resolved.issuer,
    });
    return payload;
  };
}
