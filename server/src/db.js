import mongoose from 'mongoose';

const RETRY_MS = 10_000;
let retryTimer = null;

async function attemptConnect(uri) {
  // 0 = disconnected; skip when connected (1) or an attempt is in flight (2).
  if (mongoose.connection.readyState !== 0) return false;
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 30_000,
    });
    console.log('[db] MongoDB connected');
    return true;
  } catch (err) {
    console.warn(
      '[db] MongoDB unreachable — using transparent in-memory store:',
      String(err?.message ?? err).split('\n')[0]
    );
    return false;
  }
}

/**
 * Connect without ever blocking the HTTP server: the first attempt runs in
 * the background and a retry loop keeps trying every 10s until MongoDB
 * answers, then stops. Routes transparently use the in-memory store until
 * dbReady() flips to true, so data written meanwhile is served from memory.
 */
export async function connectDB(uri) {
  if (!uri) {
    console.warn('[db] no MongoDB URI provided — in-memory store only.');
    return;
  }
  mongoose.set('bufferTimeoutMS', 2000);
  // Connection problems must never kill the server.
  mongoose.connection.on('error', (err) => {
    console.warn(
      '[db] connection error — in-memory store until MongoDB recovers:',
      String(err?.message ?? err).split('\n')[0]
    );
  });

  const ok = await attemptConnect(uri);
  if (ok || retryTimer) return;

  retryTimer = setInterval(async () => {
    if (await attemptConnect(uri)) {
      clearInterval(retryTimer);
      retryTimer = null;
    }
  }, RETRY_MS);
  retryTimer.unref?.();
}

/**
 * True when real MongoDB is usable right now (self-healing: follows the
 * driver's readyState instead of a sticky flag, so auto-reconnects resume
 * MongoDB mode without a restart). Otherwise routes use the in-memory store.
 */
export function dbReady() {
  return mongoose.connection.readyState === 1;
}

export function dbStatus() {
  return dbReady() ? 'mongodb' : 'memory';
}

/**
 * True for driver-level connectivity failures (TLS handshake blips, cleared
 * pools, buffering timeouts). readyState can still report "connected" while
 * an in-flight operation dies, so routes check this on *catch* too and
 * degrade to the memory store instead of returning 500 / losing the event.
 */
export function isNetworkError(err) {
  const msg = String(err?.message ?? err);
  return (
    err?.name === 'MongoNetworkError' ||
    err?.name === 'MongoServerSelectionError' ||
    err?.name === 'MongoBufferingTimeoutError' ||
    /SSL|TLS|ECONN|ENOTFOUND|topology|ResetPool|connection pool|buffering timed out/i.test(msg)
  );
}
