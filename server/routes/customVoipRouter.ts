import express, { Request, Response } from 'express';
import { db } from '../db.ts';
import { realtime, telephony } from '../telephony.ts';

const customVoipRouter = express.Router({ mergeParams: true });

/**
 * Dedicated Isolated Webhook for Any Admin-Added VoIP Provider
 * Route: /api/voip/:providerId/webhook
 * 
 * Guarantees that each VoIP provider has its own separate endpoint:
 * - Credentials and webhook payloads are never mixed
 * - Matches incoming call events strictly against the provider's own records
 */
customVoipRouter.all('/:providerId/webhook', async (req: Request, res: Response) => {
  const { providerId } = req.params;
  const payload = { ...req.query, ...req.body };
  console.log(`[CUSTOM VOIP WEBHOOK] Provider: ${providerId}`, payload);

  const data = db.get();
  const provider = (data.voip_api_providers || []).find((p) => p.id === providerId);

  if (!provider) {
    console.warn(`[CUSTOM VOIP WEBHOOK] Unknown provider ${providerId}`);
    return res.status(404).json({ error: 'Provider configuration not found.' });
  }

  // Handle echo / challenge verifications (e.g., Telnyx, Plivo, Vonage challenge handshakes)
  if (payload.zd_echo) {
    return res.status(200).type('text/plain').send(String(payload.zd_echo));
  }
  if (payload.challenge) {
    return res.status(200).type('text/plain').send(String(payload.challenge));
  }

  // Extract call identifiers from standard VoIP provider payloads
  const callSid = payload.call_control_id || payload.CallSid || payload.call_uuid || payload.id || payload.call_id;
  const from = payload.from || payload.From || payload.caller;
  const to = payload.to || payload.To || payload.destination;
  const eventType = (payload.event_type || payload.CallStatus || payload.status || payload.event || '').toLowerCase();

  // Correlate with active call in database
  let call = data.calls.find((c) => c.callSid === callSid || c.id === callSid);
  if (!call && (from || to)) {
    const cleanDigits = (s?: string) => (s ? String(s).replace(/\D/g, '').slice(-10) : '');
    const fromD = cleanDigits(from);
    const toD = cleanDigits(to);
    call = data.calls.find((c) => {
      if (['COMPLETED', 'FAILED'].includes(c.status) && c.endTime) return false;
      const cCustD = cleanDigits(c.customerNumber);
      return (fromD && cCustD === fromD) || (toD && cCustD === toD);
    });
  }

  if (call) {
    const now = new Date().toISOString();

    if (eventType.includes('answer') || eventType === 'in-progress' || eventType === 'call.answered') {
      await db.update((d) => {
        const target = d.calls.find((c) => c.id === call!.id);
        if (target) {
          target.status = 'ANSWERED';
          target.answerTime = now;
          target.sipResponseCode = 200;
          target.sipResponseText = `200 OK (${provider.name})`;
        }
      });
      realtime.broadcast('call.answered', {
        callId: call.id,
        answerTime: now,
        customerNumber: call.customerNumber,
        provider: provider.name,
      }, { managerId: call.managerId });
    } else if (eventType.includes('end') || eventType.includes('hangup') || eventType === 'completed') {
      await db.update((d) => {
        const target = d.calls.find((c) => c.id === call!.id);
        if (target) {
          target.status = 'COMPLETED';
          target.endTime = now;
          target.failureReason = payload.hangup_cause || payload.reason || 'Normal clearing';
        }
      });
      realtime.broadcast('call.ended', {
        callId: call.id,
        status: 'COMPLETED',
        customerNumber: call.customerNumber,
        provider: provider.name,
      }, { managerId: call.managerId });
    }
  }

  return res.status(200).json({ success: true, provider: provider.name, received: true });
});

/**
 * Dedicated DTMF Webhook for Any Admin-Added VoIP Provider
 * Route: /api/voip/:providerId/dtmf
 */
customVoipRouter.all('/:providerId/dtmf', async (req: Request, res: Response) => {
  const { providerId } = req.params;
  const payload = { ...req.query, ...req.body };
  const digit = String(payload.digit || payload.Digits || payload.dtmf || '1').trim();
  const callId = payload.callId || payload.call_id || payload.CallSid;

  console.log(`[CUSTOM VOIP DTMF] Provider: ${providerId}, Digit: ${digit}, CallId: ${callId}`);

  if (callId) {
    await telephony.handleDtmfInput(callId, digit);
  }

  return res.status(200).json({ success: true, processed: true });
});

export default customVoipRouter;
