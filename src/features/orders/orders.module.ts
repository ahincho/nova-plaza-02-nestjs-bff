import { Module } from '@nestjs/common';
import { AuditUpstreamModule } from '../../upstream/audit/audit.module';
import { OrdersUpstreamModule } from '../../upstream/orders/orders.module';
import { OrdersController } from './orders.controller';

@Module({
  imports: [OrdersUpstreamModule, AuditUpstreamModule],
  controllers: [OrdersController],
})
export class OrdersModule {}
