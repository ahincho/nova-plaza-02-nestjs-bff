/** Lo que el cliente compra: productos y cantidades, nunca precios. */
export type PurchaseItem = {
  readonly sku: string;
  readonly quantity: number;
};

/** Una compra que terminó: el pedido confirmado y su pago. */
export type Purchase = {
  readonly orderId: string;
  readonly paymentId: string;
  readonly status: string;
  readonly currency: string;
  readonly total: number;
  readonly items: readonly {
    readonly sku: string;
    readonly quantity: number;
    readonly unitPrice: number;
  }[];
};

/** Compra: reserva, crea el pedido, cobra y confirma (ADR-043). */
export interface PlacePurchaseUseCase {
  execute(
    idempotencyKey: string,
    items: readonly PurchaseItem[],
  ): Promise<Purchase>;
}

export const PLACE_PURCHASE_USE_CASE = Symbol('PLACE_PURCHASE_USE_CASE');
