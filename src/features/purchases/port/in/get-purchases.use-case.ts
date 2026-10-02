import type { PurchasesQuery } from '../../dto/purchases-query.dto';
import type { PurchasesResponse } from '../../dto/purchases.response';

/**
 * Lo que este feature sabe hacer, dicho sin mencionar cómo.
 */
export interface GetPurchasesUseCase {
  list(query: PurchasesQuery): Promise<PurchasesResponse[]>;
}

export const GET_PURCHASES_USE_CASE = Symbol('GET_PURCHASES_USE_CASE');
