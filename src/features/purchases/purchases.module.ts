import { Module } from '@nestjs/common';
import { PurchasesController } from './purchases.controller';
import { GET_PURCHASES_USE_CASE } from './port/in/get-purchases.use-case';
import { PurchasesService } from './purchases.service';

@Module({
  // El módulo del upstream se importa desde src/upstream/: en un BFF los
  // adaptadores de salida viven afuera porque los comparten varios features.
  imports: [],
  controllers: [PurchasesController],
  providers: [
    // Por token y no por clase, para que el controlador dependa del puerto.
    { provide: GET_PURCHASES_USE_CASE, useClass: PurchasesService },
  ],
})
export class PurchasesModule {}
