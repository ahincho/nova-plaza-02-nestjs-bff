import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiEnvelope, ApiErrors } from '@ahincho/nova-nestjs';
import { PurchasesQuery } from './dto/purchases-query.dto';
import { PurchasesResponse } from './dto/purchases.response';
import {
  GET_PURCHASES_USE_CASE,
  type GetPurchasesUseCase,
} from './port/in/get-purchases.use-case';

@Controller('purchases')
export class PurchasesController {
  /**
   * Depende del puerto de entrada y no de la clase del servicio. El controlador
   * es un adaptador: si nombra la implementación, el borde queda atado al
   * núcleo y ya no se puede cambiar uno sin el otro.
   */
  constructor(
    @Inject(GET_PURCHASES_USE_CASE)
    private readonly purchases: GetPurchasesUseCase,
  ) {}

  /**
   * Devuelve la respuesta pelada: el sobre lo pone el interceptor global de la
   * plataforma. El DTO del query lo valida el pipe global, y un campo que no
   * esté declarado ahí se rechaza en vez de ignorarse en silencio.
   *
   * `ApiEnvelope` describe lo que sale por el cable, que no es lo que devuelve
   * este método: el interceptor lo envuelve después.
   */
  @Get()
  @ApiEnvelope(PurchasesResponse, { isArray: true })
  @ApiErrors(400)
  list(@Query() query: PurchasesQuery): Promise<PurchasesResponse[]> {
    return this.purchases.list(query);
  }
}
