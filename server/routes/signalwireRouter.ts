/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from 'express';
import { db } from '../db.ts';
import { authenticate, requireRole, AuthenticatedRequest } from '../auth.ts';
import { telephony, realtime } from '../telephony.ts';
import { SignalWireTrunkConnector, normalizeSpace } from '../signalwireTrunkConnector.ts';
import { verifySignalWireCredentials } from '../twilio.ts';

const signalwireRouter = express.Router();

function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Get SignalWire Settings
signalwireRouter.get('/settings', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const data = db.get();
  const prov = data.voip_api_providers.find(
    (p) => p.providerType === 'SIGNALWIRE' || p.apiEndpoint?.includes('signalwire.com')
  );

  const rawKey = prov?.apiKeyEncrypted || '';
  const tokenOnly = rawKey.replace(/^KEY_/, '').trim();
  const masked = tokenOnly ? `${tokenOnly.substring(0, 4)}...${tokenOnly.slice(-4)}` : '';

  res.json({
    configured: Boolean(prov?.accountSidOrId && prov?.apiKeyEncrypted),
    id: prov?.id,
    name: prov?.name || 'SignalWire Cloud Trunk',
    space: prov?.apiEndpoint || '101proposalsllc.signalwire.com',
    projectId: prov?.accountSidOrId || 'f3aa4eda-0405-4c0d-a352-3fc7e748c016',
    primaryCallerId: '+12013615607',
    hasToken: Boolean(tokenOnly),
    apiTokenMasked: masked,
    healthStatus: prov?.healthStatus || 'HEALTHY',
    lastPing: prov?.lastPing,
  });
});

// Save SignalWire Settings
signalwireRouter.post('/settings', authenticate, requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  const { name = 'SignalWire Cloud PSTN Trunk', space, projectId, apiToken, primaryCallerId = '+12013615607' } = req.body;

  if (!space || !projectId) {
    return res.status(400).json({ error: 'SignalWire Space URL and Project ID are required.' });
  }

  const cleanSpace = normalizeSpace(space);
  const cleanProjectId = projectId.trim();

  const data = db.get();
  const existing = data.voip_api_providers.find(
    (p) => p.providerType === 'SIGNALWIRE' || p.apiEndpoint?.includes('signalwire.com')
  );

  const finalToken = apiToken?.trim() || existing?.apiKeyEncrypted?.replace(/^KEY_/, '').trim();
  if (!finalToken) {
    return res.status(400).json({ error: 'SignalWire API Token is required.' });
  }

  // Ping credentials
  const check = await verifySignalWireCredentials(cleanSpace, cleanProjectId, finalToken);
  const now = new Date().toISOString();

  await db.update((d) => {
    let target = d.voip_api_providers.find(
      (p) => p.providerType === 'SIGNALWIRE' || p.apiEndpoint?.includes('signalwire.com')
    );

    if (target) {
      target.name = name;
      target.apiEndpoint = cleanSpace;
      target.accountSidOrId = cleanProjectId;
      target.apiKeyEncrypted = `KEY_${finalToken}`;
      target.healthStatus = check.success ? 'HEALTHY' : 'DEGRADED';
      target.lastPing = now;
      target.updatedAt = now;
    } else {
      d.voip_api_providers.push({
        id: `voip_sw_${Date.now()}`,
        name,
        providerType: 'SIGNALWIRE',
        apiEndpoint: cleanSpace,
        accountSidOrId: cleanProjectId,
        apiKeyEncrypted: `KEY_${finalToken}`,
        region: 'GLOBAL',
        rules: {
          ipPeeringWhitelist: '108.174.192.0/20, 192.76.120.0/24',
          allowedPrefixes: ['+1', '+44', '+33'],
          blockedPrefixes: ['+900'],
          rateLimitPerSec: 50,
          maxConcurrency: 100,
          priority: 1,
          enforceTls: true,
          headerSigningEnabled: true,
        },
        enabled: true,
        healthStatus: check.success ? 'HEALTHY' : 'DEGRADED',
        lastPing: now,
        createdAt: now,
        updatedAt: now,
      });
    }
  });

  res.json({
    success: true,
    message: check.success
      ? 'SignalWire Trunk credentials saved and verified!'
      : `Saved. Verification status: ${check.message}`,
  });
});

// Ping / Verify Connection
signalwireRouter.post('/ping', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { space, projectId, apiToken } = req.body;
  const data = db.get();
  const existing = data.voip_api_providers.find(
    (p) => p.providerType === 'SIGNALWIRE' || p.apiEndpoint?.includes('signalwire.com')
  );

  const cleanSpace = normalizeSpace(space || existing?.apiEndpoint || '101proposalsllc.signalwire.com');
  const cleanProjectId = (projectId || existing?.accountSidOrId || 'f3aa4eda-0405-4c0d-a352-3fc7e748c016').trim();
  const finalToken = (apiToken || existing?.apiKeyEncrypted?.replace(/^KEY_/, '') || '').trim();

  if (!cleanSpace || !cleanProjectId || !finalToken) {
    return res.status(400).json({ success: false, error: 'Incomplete SignalWire credentials provided.' });
  }

  const startTime = Date.now();
  const check = await verifySignalWireCredentials(cleanSpace, cleanProjectId, finalToken);
  const latencyMs = Date.now() - startTime;

  res.json({
    ...check,
    latencyMs,
  });
});

// Trigger Live Test Call via SignalWire
signalwireRouter.post('/test-call', authenticate, requireRole(['admin', 'manager']), async (req: AuthenticatedRequest, res: Response) => {
  const { toPhoneNumber, greetingText } = req.body;
  if (!toPhoneNumber) return res.status(400).json({ error: 'Destination phone number is required.' });

  const data = db.get();
  const prov = data.voip_api_providers.find(
    (p) => p.providerType === 'SIGNALWIRE' || p.apiEndpoint?.includes('signalwire.com')
  );

  if (!prov || !prov.accountSidOrId || !prov.apiKeyEncrypted) {
    return res.status(400).json({ error: 'SignalWire provider is not configured.' });
  }

  const tokenOnly = prov.apiKeyEncrypted.replace(/^KEY_/, '').trim();
  const appUrl = process.env.APP_URL || '';
  const callId = `sw_test_${Date.now()}`;

  const result = await SignalWireTrunkConnector.dispatchOutboundCall({
    space: prov.apiEndpoint,
    projectId: prov.accountSidOrId,
    apiToken: tokenOnly,
    from: '+12013615607',
    to: toPhoneNumber.trim(),
    greetingText: greetingText || 'SignalWire trunk test call.',
    appUrl,
    callId,
  });

  if (result.success) {
    res.json({ success: true, message: `PSTN test call initiated via SignalWire (CallSid: ${result.callSid}).` });
  } else {
    res.status(400).json({ success: false, error: (result as any).troubleshooting || result.error || 'Failed to dispatch call.' });
  }
});

// SignalWire LAML Voice Handler
signalwireRouter.all('/call-laml', (req: Request, res: Response) => {
  const callId = ((req.query.callId || req.body?.callId || '') as string).trim();
  const data = db.get();
  const call = callId ? data.calls.find((c) => c.id === callId || c.callSid === callId) : null;
  const campaign = call?.campaignId ? data.campaigns.find((c) => c.id === call.campaignId) : null;
  const ivr = campaign ? data.ivr_configs.find((i) => i.id === campaign.ivrConfigId) : data.ivr_configs[0];
  const rawGreeting = ivr?.greetingText || 'Welcome to Pirates World Tele Solution. Press 1 to connect with an agent, or 2 to repeat.';
  const greeting = rawGreeting.replace(/^["']|["']$/g, '').trim();

  const appUrl = process.env.APP_URL || '';
  const dtmfUrl = `${appUrl}/api/signalwire/dtmf?callId=${encodeURIComponent(callId)}`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="1"/>
  <Gather numDigits="1" timeout="10" action="${escapeXml(dtmfUrl)}" method="POST">
    ${ivr?.audioUrl ? `<Play>${escapeXml(ivr.audioUrl)}</Play>` : `<Say voice="alice">${escapeXml(greeting)}</Say>`}
    <Say voice="alice">Press 1 to speak with an agent, or 2 to repeat this greeting.</Say>
  </Gather>
  <Say voice="alice">No key was detected. Goodbye.</Say>
  <Hangup/>
</Response>`;

  res.set('Content-Type', 'text/xml');
  res.send(xml);
});

// SignalWire Status Callback
signalwireRouter.post('/status-callback', async (req: Request, res: Response) => {
  const { CallSid, CallStatus, To, From, CallDuration, Duration } = req.body;
  const data = db.get();
  const call = data.calls.find((c) => c.callSid === CallSid || c.id === CallSid);

  if (call) {
    await db.update((d) => {
      const targetCall = d.calls.find((c) => c.id === call.id);
      if (CallStatus === 'ringing') {
        if (targetCall) targetCall.status = 'RINGING';
        realtime.broadcast('call.ringing', { callId: call.id, status: 'RINGING' }, { managerId: call.managerId });
      } else if (CallStatus === 'in-progress' || CallStatus === 'answered') {
        if (targetCall) {
          targetCall.status = 'IVR_ACTIVE';
          targetCall.answerTime = new Date().toISOString();
        }
        realtime.broadcast('call.answered', { callId: call.id, answerTime: new Date().toISOString() }, { managerId: call.managerId });
      } else if (CallStatus === 'completed') {
        const dur = parseInt(CallDuration || Duration || '0', 10);
        if (targetCall) {
          targetCall.status = 'COMPLETED';
          targetCall.durationSeconds = dur;
        }
        realtime.broadcast('call.completed', { callId: call.id, duration: dur }, { managerId: call.managerId });
      }
    });
  }

  res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response/>');
});

// SignalWire DTMF Handler
signalwireRouter.post('/dtmf', async (req: Request, res: Response) => {
  const { CallSid, Digits } = req.body;
  const callIdParam = req.query.callId as string;
  const data = db.get();
  const call = data.calls.find((c) => c.callSid === CallSid || c.id === CallSid || (callIdParam && c.id === callIdParam));

  if (!call) {
    return res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>');
  }

  await telephony.handleDtmfInput(call.id, String(Digits || ''));

  const campaign = call.campaignId ? data.campaigns.find((c) => c.id === call.campaignId) : null;
  const ivr = campaign ? data.ivr_configs.find((i) => i.id === campaign.ivrConfigId) : data.ivr_configs[0];
  const matchedOption = ivr?.options.find((opt) => opt.key === String(Digits));
  const action = matchedOption?.action || (Digits === '1' ? 'TRANSFER_TO_AGENT' : Digits === '2' ? 'REPEAT_MENU' : 'END_CALL');

  if (action === 'TRANSFER_TO_AGENT') {
    const transferResult = await telephony.initiateAgentTransfer(call.id, call.managerId);
    if (transferResult.success) {
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Connecting you to representative agent ${escapeXml(transferResult.agentName || 'Agent')}. Please hold.</Say>
  <Dial timeout="25">
    <Conference waitUrl="http://twimlets.com/holdmusic?Bucket=com.twilio.music.classical" statusCallbackEvent="join leave">conf_${call.id}</Conference>
  </Dial>
</Response>`;
      return res.type('text/xml').send(twiml);
    } else {
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">All representative agents are currently assisting other callers. Please stay on the line.</Say>
  <Hangup/>
</Response>`;
      return res.type('text/xml').send(twiml);
    }
  } else if (action === 'REPEAT_MENU') {
    const appUrl = process.env.APP_URL || '';
    const dtmfUrl = `${appUrl}/api/signalwire/dtmf?callId=${encodeURIComponent(call.id)}`;
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" timeout="10" action="${escapeXml(dtmfUrl)}" method="POST">
    <Say voice="alice">${escapeXml(ivr?.greetingText || 'Welcome.')}</Say>
  </Gather>
  <Hangup/>
</Response>`;
    return res.type('text/xml').send(twiml);
  } else {
    await telephony.endCall(call.id, 'COMPLETED', 'Caller ended IVR menu.');
    return res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">Goodbye.</Say><Hangup/></Response>');
  }
});

export default signalwireRouter;
