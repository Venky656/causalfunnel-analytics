import 'dotenv/config';
import { createApp } from './app.js';
import { connectDB } from './db.js';

// The MongoDB driver refills its pool in the background; a network/TLS
// blip surfaces as an unhandled rejection. Absorb Mongo network errors so
// the API stays up on the in-memory store; anything else still crashes loud.
process.on('unhandledRejection', (err) => {
  const msg = String(err?.message ?? err);
  if (err?.name === 'MongoNetworkError' || /SSL|TLS|ECONN|ENOTFOUND|topology|ResetPool/i.test(msg)) {
    console.warn('[db] background mongo error absorbed, staying alive:', msg.split('\n')[0]);
    return;
  }
  console.error('[fatal] unhandled rejection:', err);
  process.exit(1);
});

const PORT = Number(process.env.PORT ?? 5000);
const MONGODB_URI = process.env.MONGODB_URI;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';

if (!MONGODB_URI) {
  console.warn('[config] MONGODB_URI not set — API will run on the in-memory store until it is provided.');
}

// Listen immediately: cold starts (platform health checks, restarts) must
// never wait on MongoDB. Routes serve the in-memory store until it lands.
createApp({ clientOrigin: CLIENT_ORIGIN }).listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});

// Connect in the background (db.js keeps retrying until MongoDB responds).
connectDB(MONGODB_URI ?? 'mongodb://127.0.0.1:27017/analytics').catch((err) => {
  console.warn('[db] connect failed, continuing on in-memory store:', err?.message ?? err);
});
