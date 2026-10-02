import { Module } from '@nestjs/common';
import { CatalogUpstreamModule } from '../../upstream/catalog/catalog.module';
import { OrdersUpstreamModule } from '../../upstream/orders/orders.module';
import { PaymentsUpstreamModule } from '../../upstream/payments/payments.module';
import { PLACE_PURCHASE_USE_CASE } from './port/in/place-purchase.use-case';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';

/**
 * Los módulos de los upstreams se importan desde src/upstream/: en un BFF los
 * adaptadores de salida viven afuera porque los comparten varios features.
 */
@Module({
  imports: [
    CatalogUpstreamModule,
    OrdersUpstreamModule,
    PaymentsUpstreamModule,
  ],
  controllers: [PurchasesController],
  providers: [
    // Por token y no por clase, para que el controlador dependa del puerto.
    { provide: PLACE_PURCHASE_USE_CASE, useClass: PurchasesService },
  ],
})
export class PurchasesModule {}
