import pino from "pino";

/**
 * Logger centralizado.
 *
 * - En producción emitimos JSON en stdout: Coolify/Docker lo recoge tal
 *   cual y cualquier parser (fluent-bit, loki, etc.) puede filtrar por
 *   nivel, módulo o req-id.
 * - En desarrollo usamos pino-pretty para leerlo cómodo en la terminal.
 *
 * Convención de uso:
 *   logger.info("[modulo] mensaje")            // info normal
 *   logger.warn("[modulo] aviso")
 *   logger.error({ err }, "[modulo] mensaje")  // error con stack
 *
 * El campo `err` es especial en pino: lo serializa con name, message
 * y stack. Si lo pasas como segundo argumento posicional (como hacíamos
 * con console.error), se pierde el stack.
 */
const IS_PROD = process.env.NODE_ENV === "production";
const LEVEL = process.env.LOG_LEVEL || (IS_PROD ? "info" : "debug");

const transport = IS_PROD
  ? undefined
  : {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss",
        ignore: "pid,hostname",
      },
    };

export const logger = pino({
  level: LEVEL,
  transport,
  // Redactamos campos sensibles por si algún error lleva payload adjunto.
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.password_hash",
      "*.token",
    ],
    censor: "[REDACTED]",
  },
});
