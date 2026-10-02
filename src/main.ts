import { appEnvironment, bootstrap } from '@ahincho/nova-nestjs';
import { AppModule } from './app.module';

/**
 * El puerto del BFF en Plaza cuando nadie inyecta `PORT`. El 3000 por defecto
 * de la plataforma queda para Grafana en la máquina de desarrollo.
 */
const PLAZA_PORT = 8080;

// El main.ts completo. El ValidationPipe con la fábrica del sobre, el bind a
// 0.0.0.0, el logger estructurado, los hooks de apagado, el 503 mientras se
// cierra y la exclusión de las sondas del prefijo global los pone bootstrap();
// nada de eso se copia por servicio.
//
// **Una sola imagen para los tres ambientes.** Nada se decide al construir:
// todo llega por variable de entorno, que es lo que inyecta la task definition.
void bootstrap(AppModule, {
  // `/v1/purchases`, como `/v1/orders`, `/v1/products` y `/v1/payments` en los
  // servicios: toda Plaza responde con el mismo prefijo.
  globalPrefix: 'v1',
  ...(process.env['PORT'] === undefined ? { port: PLAZA_PORT } : {}),
  cors: { origins: process.env['CORS_ALLOWED_ORIGINS'] ?? '' },

  // El BFF no guarda credenciales: el token se valida con las claves públicas
  // de Keycloak. Si alguna vez necesita un secreto, llega igual que en pagos.
  secrets: true,

  openapi: {
    title: 'PlazaBff',
    description: 'La entrada de Plaza: el catálogo, los pedidos y la compra',

    // `appEnvironment()` lee NODE_ENV. Sin inyectar nada cae en `production`,
    // el más restrictivo: un contenedor que nadie configuró no publica la
    // documentación.
    enabled: appEnvironment() !== 'production',

    // El guard es global: el documento dice que todo pide token, salvo lo que
    // es `@Public()`.
    bearerAuth: true,
  },
});
