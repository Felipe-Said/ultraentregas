import cors from 'cors';
import express from 'express';

import loginHandler from './api/login.js';
import metricsHandler from './api/metrics.js';
import settingsHandler from './api/settings.js';
import trackHandler from './api/track.js';
import trackingConfigHandler from './api/tracking-config.js';
import pixCreateHandler from './api/pix/create.js';
import pixStatusHandler from './api/pix/status.js';
import pixWebhookHandler from './api/pix/webhook.js';

const app = express();
const PORT = Number(process.env.PORT || 3210);

app.use(cors());
app.use(express.json());

function adapt(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error('[API Error]', error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message || 'Internal server error' });
      }
    }
  };
}

app.all('/api/login', adapt(loginHandler));
app.all('/api/metrics', adapt(metricsHandler));
app.all('/api/settings', adapt(settingsHandler));
app.all('/api/track', adapt(trackHandler));
app.all('/api/tracking-config', adapt(trackingConfigHandler));
app.all('/api/pix/create', adapt(pixCreateHandler));
app.all('/api/pix/status', adapt(pixStatusHandler));
app.all('/api/pix/webhook', adapt(pixWebhookHandler));

app.listen(PORT, () => {
  console.log(`AquaGas API server running on http://localhost:${PORT}`);
  console.log('Routes: /api/login, /api/metrics, /api/settings, /api/track, /api/tracking-config, /api/pix/create, /api/pix/status, /api/pix/webhook');
});
