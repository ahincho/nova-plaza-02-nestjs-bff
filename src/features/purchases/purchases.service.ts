import { Injectable, Logger } from '@nestjs/common';
import { CatalogClient } from '../../upstream/catalog/catalog.client';
import { OrdersClient } from '../../upstream/orders/orders.client';
import { PaymentsClient } from '../../upstream/payments/payments.client';
import type {
  PlacePurchaseUseCase,
  Purchase,
  PurchaseItem,
} from './port/in/place-purchase.use-case';

/**
 * La compra de Plaza, orquestada por el BFF como una saga (ADR-043):
 *
 * 1. reserva el stock en el catálogo, que fija los precios;
 * 2. crea el pedido con esos precios;
 * 3. cobra el total del pedido;
 * 4. confirma la reserva;
 * 5. confirma el pedido.
 *
 * Si un paso falla, deshace los anteriores en orden inverso y entrega el error
 * del paso que falló, con su forma: sin stock es un 409 `OUT_OF_STOCK`, y un
 * pago rechazado un 422 `PAYMENT_DECLINED`.
 *
 * **Nada se reintenta** (ADR-029). El estado de la saga vive solo en esta
 * petición: el BFF no tiene base. Una compensación que falla no tapa el error
 * original, y no deja nada bloqueado para siempre, porque la reserva vence sola
 * a los diez minutos. La misma `Idempotency-Key` en el pedido y en la reserva, y
 * un solo pago por pedido, hacen que repetir la compra no compre dos veces.
 */
@Injectable()
export class PurchasesService implements PlacePurchaseUseCase {
  private readonly logger = new Logger(PurchasesService.name);

  constructor(
    private readonly catalog: CatalogClient,
    private readonly orders: OrdersClient,
    private readonly payments: PaymentsClient,
  ) {}

  async execute(
    idempotencyKey: string,
    items: readonly PurchaseItem[],
  ): Promise<Purchase> {
    const undo: { step: string; run: () => Promise<unknown> }[] = [];
    try {
      const reservation = await this.catalog.reserve(idempotencyKey, items);
      undo.push({
        step: 'liberar la reserva',
        run: () => this.catalog.release(reservation.id),
      });

      const order = await this.orders.place(idempotencyKey, {
        reservationId: reservation.id,
        currency: reservation.currency,
        items: reservation.items,
      });
      undo.push({
        step: 'cancelar el pedido',
        run: () => this.orders.cancel(order.id),
      });

      const payment = await this.payments.authorize({
        orderId: order.id,
        amount: order.total,
        currency: order.currency,
      });
      undo.push({
        step: 'reembolsar el pago',
        run: () => this.payments.refund(payment.id),
      });

      await this.catalog.confirm(reservation.id);
      const confirmed = await this.orders.confirm(order.id);

      return {
        orderId: confirmed.id,
        paymentId: payment.id,
        status: confirmed.status,
        currency: confirmed.currency,
        total: confirmed.total,
        items: confirmed.items,
      };
    } catch (error) {
      await this.compensate(undo.reverse());
      throw error;
    }
  }

  /**
   * Corre cada compensación aunque otra falle: una que no se pudo hacer se
   * registra, y la siguiente se intenta igual.
   */
  private async compensate(
    steps: { step: string; run: () => Promise<unknown> }[],
  ): Promise<void> {
    for (const { step, run } of steps) {
      try {
        await run();
      } catch (failure) {
        this.logger.error(
          `La compra falló y no se pudo ${step}`,
          failure instanceof Error ? failure.stack : String(failure),
        );
      }
    }
  }
}
