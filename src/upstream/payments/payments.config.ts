import { defineUpstream } from '@ahincho/nova-nestjs';

/**
 * Lee `PAYMENTS_URL` y `PAYMENTS_TIMEOUT_MS`. Sin la URL el BFF no arranca, y el
 * error la nombra. En local es `http://localhost:8083`. Nada se reintenta
 * (ADR-029): un timeout es un fallo, y la compra compensa.
 */
export const payments = defineUpstream('payments', { defaultTimeoutMs: 3000 });
