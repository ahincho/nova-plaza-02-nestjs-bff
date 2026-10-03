import {
  ApplicationError,
  DomainError,
  UpstreamHttpError,
  type FieldError,
} from '@ahincho/nova-nestjs';

type ErrorItem = {
  readonly code?: unknown;
  readonly message?: unknown;
  readonly field?: unknown;
};

/**
 * Entrega al cliente, con la misma forma, el error de negocio de un servicio
 * de Plaza (ADR-043): sin stock, el catálogo responde 409 `OUT_OF_STOCK`, y el
 * BFF responde 409 `OUT_OF_STOCK`, no un 502.
 *
 * Solo se traducen los status que dicen algo del pedido del cliente -400, 404,
 * 409 y 422- y que vienen en el sobre de Nova. Lo demás sale como lo clasifica
 * el cliente HTTP de la plataforma: un 502 o un 504, sin el detalle del
 * servicio, que es lo que no le sirve al cliente.
 */
export function forwardBusinessError(error: unknown): never {
  if (!(error instanceof UpstreamHttpError)) {
    throw error;
  }
  const items = errorItems(error.body);
  const first = items[0];
  const message = text(first?.message) ?? 'La operación no se pudo completar';
  const code = text(first?.code);
  switch (error.statusCode) {
    case 400:
      throw ApplicationError.invalidInput(message, fieldErrors(items));
    case 404:
      throw DomainError.notFound(message, { code, cause: error });
    case 409:
      throw DomainError.conflict(message, { code, cause: error });
    case 422:
      throw DomainError.ruleViolation(message, { code, cause: error });
    default:
      throw error;
  }
}

function errorItems(body: unknown): ErrorItem[] {
  if (typeof body !== 'object' || body === null) {
    return [];
  }
  const errors = (body as { errors?: unknown }).errors;
  return Array.isArray(errors) ? (errors as ErrorItem[]) : [];
}

function fieldErrors(items: ErrorItem[]): FieldError[] {
  return items.map((item) => ({
    field: text(item.field) ?? null,
    message: text(item.message) ?? 'No es válido',
  }));
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}
