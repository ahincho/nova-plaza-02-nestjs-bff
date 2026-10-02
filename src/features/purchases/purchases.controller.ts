import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
} from '@nestjs/common';
import { ApiEnvelope, ApiErrors, ApplicationError } from '@ahincho/nova-nestjs';
import { PurchaseRequest } from './dto/purchase.request';
import { PurchaseResponse, toPurchaseResponse } from './dto/purchase.response';
import {
  PLACE_PURCHASE_USE_CASE,
  type PlacePurchaseUseCase,
} from './port/in/place-purchase.use-case';

/** La clave con la que el cliente puede repetir una compra sin comprar dos veces. */
export const IDEMPOTENCY_HEADER = 'idempotency-key';

@Controller('purchases')
export class PurchasesController {
  constructor(
    @Inject(PLACE_PURCHASE_USE_CASE)
    private readonly purchases: PlacePurchaseUseCase,
  ) {}

  /**
   * Compra el carrito del cliente que inició sesión. Sin stock, 409
   * `OUT_OF_STOCK`; con el pago rechazado, 422 `PAYMENT_DECLINED`; en los dos
   * casos el BFF ya deshizo lo que había hecho.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiEnvelope(PurchaseResponse, { status: 201, description: 'La compra' })
  @ApiErrors(400, 401, 404, 409, 422)
  async purchase(
    @Headers(IDEMPOTENCY_HEADER) idempotencyKey: string | undefined,
    @Body() request: PurchaseRequest,
  ): Promise<PurchaseResponse> {
    if (idempotencyKey === undefined || idempotencyKey.trim() === '') {
      throw ApplicationError.invalidInput('La solicitud no es válida', [
        {
          field: 'Idempotency-Key',
          message:
            'La compra necesita una clave para poder repetirse sin cobrar dos veces',
        },
      ]);
    }
    const purchase = await this.purchases.execute(
      idempotencyKey.trim(),
      request.items.map((item) => ({ sku: item.sku, quantity: item.quantity })),
    );
    return toPurchaseResponse(purchase);
  }
}
