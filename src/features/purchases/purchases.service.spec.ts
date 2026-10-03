import { DomainError } from '@ahincho/nova-nestjs';
import type { CatalogClient } from '../../upstream/catalog/catalog.client';
import type { OrdersClient } from '../../upstream/orders/orders.client';
import type { PaymentsClient } from '../../upstream/payments/payments.client';
import { PurchasesService } from './purchases.service';
import type { Mock } from 'vitest';

/** Un paso de un servicio falso: siempre devuelve una promesa. */
type Step = Mock<() => Promise<unknown>>;

const RESERVATION = {
  id: 'reservation-1',
  status: 'HELD' as const,
  currency: 'PEN',
  total: 100.9,
  expiresAt: '2026-10-02T15:10:00Z',
  items: [
    { sku: 'MUG-001', quantity: 2, unitPrice: 25.5 },
    { sku: 'TEE-002', quantity: 1, unitPrice: 49.9 },
  ],
};

const ORDER = {
  id: 'order-1',
  customerId: 'ana',
  status: 'PENDING' as const,
  currency: 'PEN',
  total: 100.9,
  reservationId: RESERVATION.id,
  createdAt: '2026-10-02T15:00:00Z',
  items: RESERVATION.items,
};

const PAYMENT = {
  id: 'payment-1',
  orderId: ORDER.id,
  status: 'AUTHORIZED' as const,
  amount: 100.9,
  currency: 'PEN',
};

/**
 * La saga con los tres clientes como dobles: se prueba el orden de los pasos y
 * de las compensaciones, que es todo lo que el BFF decide.
 */
describe('la compra orquestada', () => {
  const calls: string[] = [];
  const record =
    <T>(name: string, value: T) =>
    () => {
      calls.push(name);
      return Promise.resolve(value);
    };

  let catalog: Record<'reserve' | 'confirm' | 'release', Step>;
  let orders: Record<'place' | 'confirm' | 'cancel', Step>;
  let payments: Record<'authorize' | 'refund', Step>;
  let service: PurchasesService;

  beforeEach(() => {
    calls.length = 0;
    catalog = {
      reserve: vi.fn(record('reserve', RESERVATION)),
      confirm: vi.fn(
        record('confirm reservation', { ...RESERVATION, status: 'CONFIRMED' }),
      ),
      release: vi.fn(record('release', { ...RESERVATION, status: 'RELEASED' })),
    };
    orders = {
      place: vi.fn(record('place', ORDER)),
      confirm: vi.fn(
        record('confirm order', { ...ORDER, status: 'CONFIRMED' }),
      ),
      cancel: vi.fn(record('cancel', { ...ORDER, status: 'CANCELLED' })),
    };
    payments = {
      authorize: vi.fn(record('authorize', PAYMENT)),
      refund: vi.fn(record('refund', { ...PAYMENT, status: 'REFUNDED' })),
    };
    service = new PurchasesService(
      catalog as unknown as CatalogClient,
      orders as unknown as OrdersClient,
      payments as unknown as PaymentsClient,
    );
  });

  const buy = () =>
    service.execute('key-1', [
      { sku: 'MUG-001', quantity: 2 },
      { sku: 'TEE-002', quantity: 1 },
    ]);

  const failWith = (mock: Step, name: string, error: Error): void => {
    mock.mockImplementation(() => {
      calls.push(name);
      return Promise.reject(error);
    });
  };

  it('reserva, crea el pedido con los precios del catálogo, cobra y confirma', async () => {
    const purchase = await buy();

    expect(calls).toEqual([
      'reserve',
      'place',
      'authorize',
      'confirm reservation',
      'confirm order',
    ]);
    expect(catalog.reserve).toHaveBeenCalledWith('key-1', [
      { sku: 'MUG-001', quantity: 2 },
      { sku: 'TEE-002', quantity: 1 },
    ]);
    expect(orders.place).toHaveBeenCalledWith('key-1', {
      reservationId: 'reservation-1',
      currency: 'PEN',
      items: RESERVATION.items,
    });
    expect(payments.authorize).toHaveBeenCalledWith({
      orderId: 'order-1',
      amount: 100.9,
      currency: 'PEN',
    });
    expect(purchase).toEqual({
      orderId: 'order-1',
      paymentId: 'payment-1',
      status: 'CONFIRMED',
      currency: 'PEN',
      total: 100.9,
      items: RESERVATION.items,
    });
  });

  it('sin stock no hay nada que deshacer, y el 409 sale tal cual', async () => {
    const outOfStock = DomainError.conflict('No hay stock', {
      code: 'OUT_OF_STOCK',
    });
    failWith(catalog.reserve, 'reserve', outOfStock);

    await expect(buy()).rejects.toBe(outOfStock);
    expect(calls).toEqual(['reserve']);
  });

  it('si el pedido no se crea, libera la reserva', async () => {
    failWith(orders.place, 'place', new Error('pedidos no responde'));

    await expect(buy()).rejects.toThrow('pedidos no responde');
    expect(calls).toEqual(['reserve', 'place', 'release']);
  });

  it('con el pago rechazado, cancela el pedido y libera la reserva', async () => {
    const declined = DomainError.ruleViolation('Pasa el tope', {
      code: 'PAYMENT_DECLINED',
    });
    failWith(payments.authorize, 'authorize', declined);

    await expect(buy()).rejects.toBe(declined);
    expect(calls).toEqual([
      'reserve',
      'place',
      'authorize',
      'cancel',
      'release',
    ]);
  });

  it('si confirmar falla, reembolsa, cancela y libera, en ese orden', async () => {
    const expired = DomainError.conflict('Venció', {
      code: 'RESERVATION_EXPIRED',
    });
    failWith(catalog.confirm, 'confirm reservation', expired);

    await expect(buy()).rejects.toBe(expired);
    expect(calls).toEqual([
      'reserve',
      'place',
      'authorize',
      'confirm reservation',
      'refund',
      'cancel',
      'release',
    ]);
  });

  it('una compensación que falla no tapa el error ni frena las demás', async () => {
    const declined = DomainError.ruleViolation('Pasa el tope', {
      code: 'PAYMENT_DECLINED',
    });
    failWith(payments.authorize, 'authorize', declined);
    failWith(orders.cancel, 'cancel', new Error('pedidos se cayó'));

    await expect(buy()).rejects.toBe(declined);
    expect(calls).toEqual([
      'reserve',
      'place',
      'authorize',
      'cancel',
      'release',
    ]);
  });
});
