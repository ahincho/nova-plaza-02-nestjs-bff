import { defineUpstream } from '@ahincho/nova-nestjs';

/**
 * Lee `CATALOG_URL` y `CATALOG_TIMEOUT_MS`. Sin la URL el BFF no arranca, y el
 * error la nombra. En local es `http://localhost:8082`. Nada se reintenta
 * (ADR-029): un timeout es un fallo, y la compra compensa.
 */
export const catalog = defineUpstream('catalog', { defaultTimeoutMs: 3000 });
