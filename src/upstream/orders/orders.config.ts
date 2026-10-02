import { defineUpstream } from '@ahincho/nova-nestjs';

/**
 * Lee `ORDERS_URL` y `ORDERS_TIMEOUT_MS`. Sin la URL el BFF no arranca, y el
 * error la nombra. En local es `http://localhost:8081`. Nada se reintenta
 * (ADR-029): un timeout es un fallo, y la compra compensa.
 */
export const orders = defineUpstream('orders', { defaultTimeoutMs: 3000 });
