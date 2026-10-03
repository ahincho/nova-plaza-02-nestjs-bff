import { defineUpstream } from '@ahincho/nova-nestjs';

/**
 * Lee `AUDIT_URL` y `AUDIT_TIMEOUT_MS`. Sin la URL el BFF no arranca, y el
 * error la nombra. En local es `http://localhost:8085`.
 */
export const audit = defineUpstream('audit', { defaultTimeoutMs: 3000 });
