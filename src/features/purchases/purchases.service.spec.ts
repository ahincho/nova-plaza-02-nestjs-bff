import { PurchasesService } from './purchases.service';

describe('PurchasesService', () => {
  it('responde una lista vacía mientras no hay upstream conectado', async () => {
    const service = new PurchasesService();

    await expect(service.list({ periodId: 2026 })).resolves.toEqual([]);
  });
});
