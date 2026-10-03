import { Module } from '@nestjs/common';
import { OrdersUpstreamModule } from '../../upstream/orders/orders.module';
import { OrdersController } from './orders.controller';

@Module({
  imports: [OrdersUpstreamModule],
  controllers: [OrdersController],
})
export class OrdersModule {}
