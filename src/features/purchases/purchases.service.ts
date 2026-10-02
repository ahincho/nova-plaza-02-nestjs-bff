import { Injectable } from '@nestjs/common';
import type { GetPurchasesUseCase } from './port/in/get-purchases.use-case';
import type { PurchasesQuery } from './dto/purchases-query.dto';
import type { PurchasesResponse } from './dto/purchases.response';

@Injectable()
export class PurchasesService implements GetPurchasesUseCase {
  // Inyectar aca el cliente del upstream, que vive en src/upstream/.
  constructor() {}

  list(_query: PurchasesQuery): Promise<PurchasesResponse[]> {
    return Promise.resolve([]);
  }
}
