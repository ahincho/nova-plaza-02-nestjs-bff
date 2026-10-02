import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';

/** Una llamada que recibió un servicio falso, con el cliente que traía. */
export type Call = { readonly route: string; readonly customer?: string };

/**
 * Los tres servicios de Plaza y el JWKS de Keycloak, falsos y en un solo
 * servidor HTTP: las rutas no se pisan. Responden con el sobre de Nova, como
 * los de verdad, así que el BFF se prueba con su cliente HTTP real.
 *
 * Un `HOOD-008` con más de 3 unidades no tiene stock, y un pago de más de 1000
 * se rechaza: son los dos fallos de la demo.
 */
export class FakePlaza {
  readonly calls: Call[] = [];
  /** El último pedido creado: confirmarlo o cancelarlo lo devuelve con sus líneas. */
  private placed: Record<string, unknown> = {};
  private server!: Server;
  private privateKey!: Awaited<
    ReturnType<typeof generateKeyPair>
  >['privateKey'];
  private jwks!: object;

  async start(): Promise<void> {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    this.privateKey = privateKey;
    this.jwks = {
      keys: [{ ...(await exportJWK(publicKey)), kid: 'plaza', alg: 'RS256' }],
    };
    this.server = createServer((request, response) => {
      void this.answer(request).then(([status, body]) => {
        response.writeHead(status, { 'content-type': 'application/json' });
        response.end(JSON.stringify(body));
      });
    });
    await new Promise<void>((resolve) =>
      this.server.listen(0, '127.0.0.1', resolve),
    );
  }

  stop(): Promise<void> {
    return new Promise((resolve) => this.server.close(() => resolve()));
  }

  get url(): string {
    const { port } = this.server.address() as AddressInfo;
    return `http://127.0.0.1:${port}`;
  }

  get issuer(): string {
    return `${this.url}/realms/plaza`;
  }

  /** Un token de Keycloak para un cliente de prueba, firmado por este emisor. */
  token(username: string): Promise<string> {
    return new SignJWT({
      preferred_username: username,
      realm_access: { roles: ['customer', 'offline_access'] },
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'plaza' })
      .setIssuer(this.issuer)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(this.privateKey);
  }

  routes(): string[] {
    return this.calls.map((call) => call.route);
  }

  private async answer(request: IncomingMessage): Promise<[number, unknown]> {
    const url = new URL(request.url ?? '/', this.url);
    const route = `${request.method} ${url.pathname}`;
    const customer = request.headers['x-customer-id'];
    const body = (await readJson(request)) as Record<string, unknown>;
    if (route === 'GET /realms/plaza/protocol/openid-connect/certs') {
      return [200, this.jwks];
    }
    this.calls.push({
      route,
      customer: typeof customer === 'string' ? customer : undefined,
    });

    if (route === 'GET /v1/products') {
      return ok({
        items: [product('MUG-001')],
        nextCursor: 'next',
        hasNext: true,
      });
    }
    if (route === 'GET /v1/products/NOPE-000') {
      return failure(
        404,
        'PRODUCT_NOT_FOUND',
        'El producto NOPE-000 no existe',
      );
    }
    if (route === 'POST /v1/reservations') {
      const items = body['items'] as { sku: string; quantity: number }[];
      if (items.some((item) => item.sku === 'HOOD-008' && item.quantity > 3)) {
        return failure(
          409,
          'OUT_OF_STOCK',
          'No hay stock suficiente de HOOD-008',
        );
      }
      return ok(reservation(items), 201);
    }
    if (/^POST \/v1\/reservations\/[^/]+\/(confirm|release)$/.test(route)) {
      return ok(reservation([]));
    }
    if (route === 'POST /v1/orders') {
      this.placed = body;
      return ok(order(body, 'PENDING'), 201);
    }
    if (route === 'POST /v1/orders/order-1/confirm') {
      return ok(order(this.placed, 'CONFIRMED'));
    }
    if (route === 'POST /v1/orders/order-1/cancel') {
      return ok(order(this.placed, 'CANCELLED'));
    }
    if (route === 'GET /v1/orders') {
      return ok({
        items: [order({}, 'CONFIRMED')],
        nextCursor: null,
        hasNext: false,
      });
    }
    if (route === 'POST /v1/payments') {
      if ((body['amount'] as number) > 1000) {
        return failure(
          422,
          'PAYMENT_DECLINED',
          'El pago pasa el tope de 1000.00',
        );
      }
      return ok(
        {
          id: 'payment-1',
          orderId: 'order-1',
          status: 'AUTHORIZED',
          amount: body['amount'],
          currency: 'PEN',
        },
        201,
      );
    }
    if (route === 'POST /v1/payments/payment-1/refund') {
      return ok({
        id: 'payment-1',
        orderId: 'order-1',
        status: 'REFUNDED',
        amount: 1,
        currency: 'PEN',
      });
    }
    return failure(500, 'INTERNAL_ERROR', `ruta desconocida: ${route}`);
  }
}

function product(sku: string) {
  return {
    sku,
    name: 'Taza de cerámica',
    price: 25.5,
    currency: 'PEN',
    available: 100,
  };
}

const PRICES: Record<string, number> = {
  'MUG-001': 25.5,
  'HOOD-008': 119,
  'LAMP-009': 899,
};

function reservation(items: { sku: string; quantity: number }[]) {
  const lines = items.map((item) => ({
    ...item,
    unitPrice: PRICES[item.sku] ?? 10,
  }));
  return {
    id: 'reservation-1',
    status: 'HELD',
    currency: 'PEN',
    total: lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
    expiresAt: '2026-10-02T15:10:00Z',
    items: lines,
  };
}

function order(body: Record<string, unknown>, status: string) {
  const items =
    (body['items'] as { sku: string; quantity: number; unitPrice: number }[]) ??
    [];
  return {
    id: 'order-1',
    customerId: 'ana',
    status,
    currency: 'PEN',
    total: items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    reservationId: 'reservation-1',
    createdAt: '2026-10-02T15:00:00Z',
    items,
  };
}

function ok(data: unknown, status = 200): [number, unknown] {
  return [status, { success: true, status, data }];
}

function failure(
  status: number,
  code: string,
  message: string,
): [number, unknown] {
  return [status, { success: false, status, errors: [{ code, message }] }];
}

function readJson(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    let raw = '';
    request.on('data', (chunk: Buffer) => (raw += chunk.toString()));
    request.on('end', () => resolve(raw === '' ? {} : JSON.parse(raw)));
  });
}
