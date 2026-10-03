import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JWTVerifyGetKey,
} from 'jose';
import { keycloakVerifier } from './keycloak';

const ISSUER = 'http://localhost:8180/realms/plaza';

/**
 * La verificación del token con claves propias de la prueba, en lugar de las
 * que publica Keycloak: es la misma `jwtVerify`, contra otro JWKS.
 */
describe('el token de Keycloak', () => {
  let sign: (
    claims: Record<string, unknown>,
    issuer?: string,
  ) => Promise<string>;
  let keys: JWTVerifyGetKey;

  beforeAll(async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const jwk = { ...(await exportJWK(publicKey)), kid: 'test', alg: 'RS256' };
    keys = createLocalJWKSet({ keys: [jwk] });
    sign = (claims, issuer = ISSUER) =>
      new SignJWT(claims)
        .setProtectedHeader({ alg: 'RS256', kid: 'test' })
        .setIssuer(issuer)
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(privateKey);
  });

  const verifier = (
    env: NodeJS.ProcessEnv = { KEYCLOAK_ISSUER: `${ISSUER}/` },
  ) => keycloakVerifier(() => keys, env);

  it('devuelve los claims de un token válido del emisor', async () => {
    const token = await sign({ preferred_username: 'ana' });

    await expect(verifier()(token)).resolves.toMatchObject({
      preferred_username: 'ana',
      iss: ISSUER,
    });
  });

  it('rechaza un token de otro emisor', async () => {
    const token = await sign(
      { preferred_username: 'ana' },
      'http://otro/realms/plaza',
    );

    await expect(verifier()(token)).rejects.toThrow();
  });

  it('rechaza un token que no firmó el emisor', async () => {
    const other = await generateKeyPair('RS256');
    const forged = await new SignJWT({ preferred_username: 'ana' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test' })
      .setIssuer(ISSUER)
      .setExpirationTime('5m')
      .sign(other.privateKey);

    await expect(verifier()(forged)).rejects.toThrow();
  });

  it('sin KEYCLOAK_ISSUER el error la nombra', async () => {
    const token = await sign({ preferred_username: 'ana' });

    await expect(verifier({})(token)).rejects.toThrow('KEYCLOAK_ISSUER');
  });
});
