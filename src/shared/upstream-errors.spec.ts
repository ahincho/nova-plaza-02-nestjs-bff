import {
  ApplicationError,
  DomainError,
  UpstreamHttpError,
} from '@ahincho/nova-nestjs';
import { forwardBusinessError } from './upstream-errors';

const envelope = (code: string, message: string, field?: string) => ({
  success: false,
  errors: [{ code, message, field }],
});

const upstream = (status: number, body: unknown) =>
  new UpstreamHttpError(status, body, {});

describe('el error de negocio de un servicio', () => {
  it.each([
    [404, 'NOT_FOUND', 'PRODUCT_NOT_FOUND'],
    [409, 'CONFLICT', 'OUT_OF_STOCK'],
    [422, 'RULE_VIOLATION', 'PAYMENT_DECLINED'],
  ])('un %i llega con su código: %s', (status, type, code) => {
    const thrown = (() => {
      try {
        forwardBusinessError(upstream(status, envelope(code, 'Mensaje')));
      } catch (error) {
        return error;
      }
    })();

    expect(thrown).toBeInstanceOf(DomainError);
    expect(thrown).toMatchObject({ type, code, message: 'Mensaje' });
  });

  it('un 400 llega con sus campos', () => {
    expect(() =>
      forwardBusinessError(
        upstream(400, envelope('BAD_REQUEST', 'No es un cursor', 'cursor')),
      ),
    ).toThrow(ApplicationError);
  });

  it('lo que no es de negocio sale como lo clasifica el cliente HTTP', () => {
    const unavailable = upstream(503, envelope('SERVICE_UNAVAILABLE', 'Caído'));
    expect(() => forwardBusinessError(unavailable)).toThrow(unavailable);

    const plain = new Error('otra cosa');
    expect(() => forwardBusinessError(plain)).toThrow(plain);
  });

  it('un cuerpo sin el sobre de Nova no inventa un código', () => {
    try {
      forwardBusinessError(upstream(409, 'texto plano'));
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBeUndefined();
    }
  });
});
