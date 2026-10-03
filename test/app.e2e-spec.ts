import { setupOpenApi, validationExceptionFactory } from '@ahincho/nova-nestjs';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { FakePlaza, OWNED_ORDER } from './fake-plaza';

/**
 * El BFF de punta a punta, con su cliente HTTP real contra los servicios de
 * Plaza falsos y un Keycloak falso que firma los tokens. Prueba lo que es del
 * BFF: el token, la saga y sus compensaciones, y que el error de un servicio
 * llega al cliente con su forma.
 *
 * El test no pasa por `bootstrap()`, así que monta el `ValidationPipe` de Nova
 * y la documentación, que es lo que `bootstrap()` pone.
 */
describe('PlazaBff', () => {
  const plaza = new FakePlaza();
  let app: INestApplication;
  let http: App;
  let ana: string;

  beforeAll(async () => {
    await plaza.start();
    for (const service of ['CATALOG', 'ORDERS', 'PAYMENTS', 'AUDIT']) {
      process.env[`${service}_URL`] = plaza.url;
    }
    process.env['KEYCLOAK_ISSUER'] = plaza.issuer;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: validationExceptionFactory,
      }),
    );
    setupOpenApi(app, { title: 'PlazaBff', bearerAuth: true });
    await app.init();
    http = app.getHttpServer() as App;
    ana = await plaza.token('ana');
  });

  afterAll(async () => {
    await app?.close();
    await plaza.stop();
  });

  beforeEach(() => {
    plaza.calls.length = 0;
  });

  const purchase = (items: unknown, key = 'purchase-1') =>
    request(http)
      .post('/purchases')
      .set('Authorization', `Bearer ${ana}`)
      .set('Idempotency-Key', key)
      .send({ items });

  it('answers both probes without a token', async () => {
    await request(http).get('/health/live').expect(200);
    await request(http).get('/health/ready').expect(200);
  });

  it('shows the catalog to anyone', async () => {
    const page = await request(http).get('/products?limit=1').expect(200);

    expect(page.body).toMatchObject({
      success: true,
      data: { items: [{ sku: 'MUG-001' }], nextCursor: 'next', hasNext: true },
    });
    const missing = await request(http).get('/products/NOPE-000').expect(404);
    expect(missing.body.errors[0].code).toBe('PRODUCT_NOT_FOUND');
  });

  it('asks for a valid token for everything else', async () => {
    await request(http).get('/orders').expect(401);
    await request(http)
      .get('/orders')
      .set('Authorization', 'Bearer not-a-token')
      .expect(401);
  });

  it('buys: reserves, places, pays and confirms, as the customer of the token', async () => {
    const bought = await purchase([{ sku: 'MUG-001', quantity: 2 }]).expect(
      201,
    );

    expect(bought.body).toMatchObject({
      success: true,
      data: {
        orderId: 'order-1',
        paymentId: 'payment-1',
        status: 'CONFIRMED',
        total: 51,
        currency: 'PEN',
        items: [{ sku: 'MUG-001', quantity: 2, unitPrice: 25.5 }],
      },
    });
    expect(plaza.routes()).toEqual([
      'POST /v1/reservations',
      'POST /v1/orders',
      'POST /v1/payments',
      'POST /v1/reservations/reservation-1/confirm',
      'POST /v1/orders/order-1/confirm',
    ]);
    // El cliente sale del token, y viaja solo a cada servicio.
    expect(new Set(plaza.calls.map((call) => call.customer))).toEqual(
      new Set(['ana']),
    );
  });

  it('without stock answers the 409 of the catalog and does nothing else', async () => {
    const response = await purchase([{ sku: 'HOOD-008', quantity: 4 }]).expect(
      409,
    );

    expect(response.body).toMatchObject({
      success: false,
      errors: [{ code: 'OUT_OF_STOCK' }],
    });
    expect(plaza.routes()).toEqual(['POST /v1/reservations']);
  });

  it('a declined payment cancels the order and releases the stock', async () => {
    const response = await purchase([{ sku: 'LAMP-009', quantity: 2 }]).expect(
      422,
    );

    expect(response.body.errors[0].code).toBe('PAYMENT_DECLINED');
    expect(plaza.routes()).toEqual([
      'POST /v1/reservations',
      'POST /v1/orders',
      'POST /v1/payments',
      'POST /v1/orders/order-1/cancel',
      'POST /v1/reservations/reservation-1/release',
    ]);
  });

  it('a purchase needs its key and at least one valid item', async () => {
    await request(http)
      .post('/purchases')
      .set('Authorization', `Bearer ${ana}`)
      .send({ items: [{ sku: 'MUG-001', quantity: 1 }] })
      .expect(400);
    await purchase([]).expect(400);
    await purchase([{ sku: 'MUG-001', quantity: 0 }]).expect(400);
    expect(plaza.calls).toEqual([]);
  });

  it('lists the orders of the customer', async () => {
    const page = await request(http)
      .get('/orders')
      .set('Authorization', `Bearer ${ana}`)
      .expect(200);

    expect(page.body.data).toMatchObject({
      items: [{ id: 'order-1' }],
      hasNext: false,
    });
    expect(plaza.calls).toEqual([{ route: 'GET /v1/orders', customer: 'ana' }]);
  });

  it('shows the best sellers to anyone and validates the limit before calling', async () => {
    const ranking = await request(http)
      .get('/products/best-sellers')
      .query({ limit: 2 })
      .expect(200);

    expect(ranking.body.data).toEqual([
      { sku: 'MUG-001', name: 'Taza de cerámica', unitsSold: 12 },
      { sku: 'TEE-002', name: 'Polo', unitsSold: 7 },
    ]);
    await request(http)
      .get('/products/best-sellers')
      .query({ limit: 51 })
      .expect(400);
    expect(plaza.routes()).toEqual(['GET /v1/products/best-sellers']);
  });

  it('shows the history of an order only after finding it as the customer of the token', async () => {
    const history = await request(http)
      .get(`/orders/${OWNED_ORDER}/history`)
      .set('Authorization', `Bearer ${ana}`)
      .expect(200);

    expect(history.body.data).toMatchObject([
      { id: 'event-1', type: 'pe.edu.nova.plaza.order.created.v1' },
      { id: 'event-2', type: 'pe.edu.nova.plaza.order.confirmed.v1' },
    ]);
    expect(plaza.calls).toEqual([
      { route: `GET /v1/orders/${OWNED_ORDER}`, customer: 'ana' },
      { route: `GET /v1/orders/${OWNED_ORDER}/events`, customer: 'ana' },
    ]);

    plaza.calls.length = 0;
    const someoneElses = '9a1c1d2e-3b4a-4c5d-8e6f-7a8b9c0d1e2f';
    const missing = await request(http)
      .get(`/orders/${someoneElses}/history`)
      .set('Authorization', `Bearer ${ana}`)
      .expect(404);

    expect(missing.body.errors[0].code).toBe('ORDER_NOT_FOUND');
    expect(plaza.routes()).toEqual([`GET /v1/orders/${someoneElses}`]);
  });

  it('serves an OpenAPI document with the envelope around the dto', async () => {
    const response = await request(http).get('/docs/json').expect(200);
    const document = response.body as {
      components: { schemas: Record<string, unknown> };
      paths: Record<string, unknown>;
    };

    expect(document.components.schemas).toHaveProperty('PurchaseResponse');
    expect(JSON.stringify(document.paths)).toContain(
      '#/components/schemas/ApiEnvelopeSchema',
    );
  });
});
