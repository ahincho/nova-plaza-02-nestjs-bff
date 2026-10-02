import { PurchasesController } from './purchases.controller';
import type { Mock } from 'vitest';

describe('PurchasesController', () => {
  function controller(list: Mock): PurchasesController {
    // El doble satisface al servicio por su forma, sin castear.
    return new PurchasesController({ list });
  }

  // El controlador de un BFF no compone ni decide: delega y devuelve. Lo que
  // se prueba acá es que no se quede nada por el camino.
  it('pasa el query al servicio y devuelve lo que responde', async () => {
    const list = vi.fn().mockResolvedValue([{ id: '1' }]);
    const query = { periodId: 2026 };

    await expect(controller(list).list(query)).resolves.toEqual([{ id: '1' }]);
    expect(list).toHaveBeenCalledWith(query);
  });
});
