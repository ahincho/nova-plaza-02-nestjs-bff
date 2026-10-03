import { Module } from '@nestjs/common';
import { NovaModule } from '@ahincho/nova-nestjs';
import { keycloakVerifier } from './auth/keycloak';
import { OrdersModule } from './features/orders/orders.module';
import { ProductsModule } from './features/products/products.module';
import { PurchasesModule } from './features/purchases/purchases.module';
import { audit } from './upstream/audit/audit.config';
import { catalog } from './upstream/catalog/catalog.config';
import { orders } from './upstream/orders/orders.config';
import { payments } from './upstream/payments/payments.config';

@Module({
  imports: [
    NovaModule.forRoot({
      // Los cuatro servicios de Plaza. Si falta la URL de uno, el BFF no arranca
      // y el error la nombra, en vez de responder 500 en la primera compra.
      config: { load: [catalog, orders, payments, audit] },

      // El BFF es el único que valida el token (ADR-043): la firma contra el
      // JWKS de Keycloak, el emisor y el vencimiento. Todo lo que no es
      // `@Public()` pide token.
      auth: {
        verify: keycloakVerifier(),
        // El cliente es su usuario de Keycloak, y viaja solo a cada servicio en
        // `X-Customer-Id`, la cabecera que los tres ya leen.
        idClaim: 'preferred_username',
        userIdHeader: 'x-customer-id',
        rolesClaim: 'realm_access.roles',
        ignoredRoles: ['offline_access', 'uma_authorization'],
        ignoredRolePrefixes: ['default-roles-'],
      },

      health: {
        // Tras SIGTERM el servicio sigue vivo esta ventana y termina lo que
        // tenga en vuelo; `ready` contesta 503 mientras tanto. Menor que el
        // stopTimeout de la tarea, porque pasado ese plazo llega un SIGKILL.
        gracefulShutdownTimeoutMs: 5000,

        // A propósito no llama a los servicios: si `ready` cayera cuando uno
        // se cae, el orquestador mataría tareas sanas del BFF por un problema
        // que no es suyo.
        readinessChecks: [],
      },
    }),
    ProductsModule,
    OrdersModule,
    PurchasesModule,
  ],
})
export class AppModule {}
