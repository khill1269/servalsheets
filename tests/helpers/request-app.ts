import type { Express } from 'express';
import { IncomingMessage, ServerResponse } from 'http';
import { Socket } from 'net';

export type AppResponse = {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  text: string;
};

const normalizeHeaders = (
  headers: Record<string, number | string | string[] | undefined>
): Record<string, string> => {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    normalized[key.toLowerCase()] = Array.isArray(value) ? value.join(',') : String(value);
  }
  return normalized;
};

const buildQueryString = (query?: Record<string, unknown>): string => {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, String(item));
      }
    } else {
      params.append(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
};

export const requestApp = async (
  app: Express,
  options: {
    method: 'GET' | 'POST' | 'DELETE' | 'OPTIONS';
    path: string;
    query?: Record<string, unknown>;
    body?: Record<string, unknown> | string;
    headers?: Record<string, string>;
  }
): Promise<AppResponse> =>
  await new Promise((resolve, reject) => {
    const socket = new Socket();
    let settled = false;
    const settleReject = (error: unknown) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    // Express/Node writes to the assigned socket even when we only need an
    // in-memory response capture. On slower CI runners, eagerly destroying the
    // fake socket can surface ERR_SOCKET_CLOSED from deferred uncork/writev
    // tasks. Stub writes and ignore post-settlement socket noise so contract
    // tests stay deterministic.
    (socket as Socket & {
      _write: (
        chunk: Buffer,
        encoding: BufferEncoding,
        callback: (error?: Error | null) => void
      ) => void;
      _writev?: (
        chunks: Array<{ chunk: Buffer; encoding: BufferEncoding }>,
        callback: (error?: Error | null) => void
      ) => void;
    })._write = (_chunk, _encoding, callback) => {
      callback();
    };
    (socket as Socket & {
      _writev?: (
        chunks: Array<{ chunk: Buffer; encoding: BufferEncoding }>,
        callback: (error?: Error | null) => void
      ) => void;
    })._writev = (_chunks, callback) => {
      callback();
    };
    socket.on('error', (error: NodeJS.ErrnoException) => {
      if (
        settled &&
        (error.code === 'ERR_SOCKET_CLOSED' || error.code === 'EPIPE' || error.code === 'ECONNRESET')
      ) {
        return;
      }
      settleReject(error);
    });

    const req = new IncomingMessage(socket);
    const queryString = buildQueryString(options.query);
    const url = `${options.path}${queryString}`;
    const headers: Record<string, string> = {};
    if (options.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        headers[key.toLowerCase()] = value;
      }
    }
    headers['host'] = headers['host'] ?? 'localhost';

    let bodyString: string | undefined;
    let bodyRecord: Record<string, string> | undefined;
    if (options.body !== undefined) {
      if (typeof options.body === 'string') {
        bodyString = options.body;
      } else {
        bodyRecord = Object.entries(options.body).reduce<Record<string, string>>(
          (acc, [key, value]) => {
            if (value === undefined) return acc;
            acc[key] = String(value);
            return acc;
          },
          {}
        );

        if (headers['content-type'] === 'application/x-www-form-urlencoded') {
          bodyString = new URLSearchParams(bodyRecord).toString();
        } else {
          bodyString = JSON.stringify(options.body);
        }
      }

      headers['content-type'] = headers['content-type'] ?? 'application/json';
      headers['content-length'] = Buffer.byteLength(bodyString).toString();
    }

    req.method = options.method;
    req.url = url;
    req.headers = headers;
    const rawHeaders = Object.entries(headers).flatMap(([key, value]) => [key, value]);
    Object.defineProperty(req, 'rawHeaders', {
      configurable: true,
      value: rawHeaders,
    });
    Object.defineProperty(req, 'headersDistinct', {
      configurable: true,
      value: Object.fromEntries(Object.entries(headers).map(([key, value]) => [key, [value]])),
    });
    Object.defineProperty(req, 'httpVersion', {
      configurable: true,
      value: '1.1',
    });
    Object.defineProperty(req, 'httpVersionMajor', {
      configurable: true,
      value: 1,
    });
    Object.defineProperty(req, 'httpVersionMinor', {
      configurable: true,
      value: 1,
    });
    Object.defineProperty(req, 'ip', {
      configurable: true,
      value: '127.0.0.1',
    });
    Object.defineProperty(req.socket, 'remoteAddress', {
      configurable: true,
      value: '127.0.0.1',
    });

    const res = new ServerResponse(req);
    res.assignSocket(socket);
    const chunks: Buffer[] = [];
    const write = res.write.bind(res);
    const end = res.end.bind(res);

    res.write = ((chunk: any, ...args: any[]) => {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return write(chunk, ...args);
    }) as typeof res.write;

    res.end = ((chunk: any, ...args: any[]) => {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return end(chunk, ...args);
    }) as typeof res.end;

    res.on('finish', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      const responseHeaders = normalizeHeaders(res.getHeaders() as Record<string, any>);
      let body: unknown = text;
      if (responseHeaders['content-type']?.includes('application/json') && text) {
        try {
          body = JSON.parse(text);
        } catch {
          body = text;
        }
      }
      settled = true;
      resolve({
        status: res.statusCode,
        headers: responseHeaders,
        body,
        text,
      });
      setImmediate(() => {
        if (!socket.destroyed) {
          socket.destroy();
        }
      });
    });

    res.on('error', settleReject);

    let bodyPushed = false;
    const pushBody = () => {
      if (bodyPushed) return;
      bodyPushed = true;
      if (bodyString) {
        req.emit('data', Buffer.from(bodyString));
      }
      req.emit('end');
    };

    req.on('newListener', (event) => {
      if (event === 'data' || event === 'end') {
        process.nextTick(pushBody);
      }
    });

    app.handle(req, res, (err) => {
      if (err) settleReject(err);
    });

    setImmediate(pushBody);
  });
