/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from 'express';
import { db } from '../db.ts';
import { authenticate, requireRole, AuthenticatedRequest } from '../auth.ts';
import { telephony, realtime } from '../telephony.ts';
import { verifyTwilioCredentials, makeTwilioCall } from '../twilio.ts';

const twilioRouter = express.Router();

function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Twilio TwiML Dynamic Voice Generation
twilioRouter.all('/call-twiml', (req: Request, res: Response) => {
  const callId = ((req.query.callId || req.body?.callId || '') as string).trim();
  const data = db.get();
  const call = callId ? data.calls.find((c) => c.id === callId || c.callSid === callId) : null;
  const campaign = call?.campaignId ? data.campaigns.find((c) => c.id === call.campaignId) : null;
  const ivr = campaign ? data.ivr_configs.find((i) => i.id === campaign.ivrConfigId) : data.ivr_configs[0];
  const greeting = ivr?.greetingText || 'Hello from Pirates World Tele Solution. Press 1 to connect with an agent, or 2 to hear this greeting again.';

  const appUrl = process.env.APP_URL || '';
  const dtmfUrl = `${appUrl}/api/twilio/dtmf${callId ? `?callId=${encodeURIComponent(callId)}` : ''}`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="1"/>
  <Gather numDigits="1" timeout="10" action="${escapeXml(dtmfUrl)}" method="POST">
    <Say voice="alice">${escapeXml(greeting)}</Say>
    <Say voice="alice">Press 1 to speak with an agent, or 2 to repeat.</Say>
  </Gather>
  <Say voice="alice">No key was detected. Thank you for calling Pirates World Tele Solution. Goodbye.</Say>
  <Hangup/>
</Response>`;

  res.set('Content-Type', 'text/xml');
  res.send(xml);
});

// Twilio Status Webhook (Physical Handset Call Events)
twilioRouter.post('/call-status', async (req: Request, res: Response) => {
  const { CallSid, CallStatus, To, From, CallDuration, Duration } = req.body;
  console.log(`[TWILIO STATUS CALLBACK] CallSid: ${CallSid}, CallStatus: ${CallStatus}, To: ${To}`);

  const data = db.get();
  const call = data.calls.find((c) => c.callSid === CallSid || c.id === CallSid);

  if (call) {
    await db.update((d) => {
      const targetCall = d.calls.find((c) => c.id === call.id);
      const targetContact = d.campaign_contacts.find((c) => c.callId === call.id || c.phoneNumber === To);
      const targetCamp = targetCall?.campaignId ? d.campaigns.find((c) => c.id === targetCall.campaignId) : null;

      if (CallStatus === 'ringing') {
        if (targetCall) {
          targetCall.status = 'RINGING';
          targetCall.sipResponseCode = 180;
          targetCall.sipResponseText = '180 Ringing (Twilio PSTN Handset)';
        }
        if (targetContact) targetContact.status = 'RINGING';
        realtime.broadcast('call.ringing', { callId: call.id, status: 'RINGING' }, { managerId: call.managerId });
      } else if (CallStatus === 'in-progress' || CallStatus === 'answered') {
        if (targetCall) {
          targetCall.status = 'IVR_ACTIVE';
          targetCall.answerTime = new Date().toISOString();
          targetCall.sipResponseCode = 200;
          targetCall.sipResponseText = '200 OK - PSTN Handset Answered';
        }
        if (targetContact) targetContact.status = 'ANSWERED';
        if (targetCamp) targetCamp.answeredCount += 1;
        realtime.broadcast('call.answered', { callId: call.id, answerTime: new Date().toISOString() }, { managerId: call.managerId });
      } else if (CallStatus === 'completed') {
        const dur = parseInt(CallDuration || Duration || '0', 10);
        if (targetCall) {
          targetCall.status = 'COMPLETED';
          targetCall.durationSeconds = dur;
          targetCall.endTime = new Date().toISOString();
        }
        if (targetContact) targetContact.status = 'COMPLETED';
        if (targetCall?.agentId) {
          const agt = d.agents.find((a) => a.id === targetCall.agentId);
          if (agt && agt.currentCallId === targetCall.id) {
            agt.state = 'AVAILABLE';
            agt.currentCallId = null;
            realtime.broadcast('agent.state_changed', { agentId: agt.id, state: 'AVAILABLE' }, { managerId: call.managerId });
          }
        }
        realtime.broadcast('call.completed', { callId: call.id, duration: dur }, { managerId: call.managerId });
      } else if (['busy', 'no-answer', 'failed', 'canceled'].includes(CallStatus)) {
        if (targetCall) {
          targetCall.status = CallStatus === 'busy' ? 'BUSY' : CallStatus === 'no-answer' ? 'NO_ANSWER' : 'FAILED';
          targetCall.transferResult = `Carrier Terminal State: ${CallStatus}`;
        }
        if (targetContact) targetContact.status = 'FAILED';
        realtime.broadcast('call.failed', { callId: call.id, status: targetCall?.status }, { managerId: call.managerId });
      }
    });
  }

  res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response/>');
});

// Twilio DTMF Webhook & Automatic Human Agent Bridging
twilioRouter.post('/dtmf', async (req: Request, res: Response) => {
  const { CallSid, Digits, To, From } = req.body;
  const callIdParam = req.query.callId as string;
  console.log(`[TWILIO DTMF CALLBACK] CallSid: ${CallSid}, Digits: ${Digits}, From: ${From}`);

  const data = db.get();
  const call = data.calls.find((c) => c.callSid === CallSid || c.id === CallSid || (callIdParam && c.id === callIdParam));

  if (!call) {
    return res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>');
  }

  // Handle DTMF input in telephony engine
  await telephony.handleDtmfInput(call.id, String(Digits || ''));

  const campaign = call.campaignId ? data.campaigns.find((c) => c.id === call.campaignId) : null;
  const ivr = campaign ? data.ivr_configs.find((i) => i.id === campaign.ivrConfigId) : data.ivr_configs[0];

  const matchedOption = ivr?.options.find((opt) => opt.key === String(Digits));
  const action = matchedOption?.action || (Digits === '1' ? 'TRANSFER_TO_AGENT' : Digits === '2' ? 'REPEAT_MENU' : 'END_CALL');

  if (action === 'TRANSFER_TO_AGENT') {
    const transferResult = await telephony.initiateAgentTransfer(call.id, call.managerId);

    if (transferResult.success) {
      console.log(`[AGENT BRIDGED] Connecting customer directly to human agent ${transferResult.agentName}...`);
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Connecting you to representative agent ${escapeXml(transferResult.agentName || 'Agent')}. Please hold.</Say>
  <Dial timeout="25">
    <Conference waitUrl="http://twimlets.com/holdmusic?Bucket=com.twilio.music.classical" statusCallbackEvent="join leave">conf_${call.id}</Conference>
  </Dial>
</Response>`;
      return res.type('text/xml').send(twiml);
    } else {
      console.log(`[AGENT BUSY] No available free agent under manager ${call.managerId}`);
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">All representative agents are currently assisting other callers. Please stay on the line or call back shortly.</Say>
  <Pause length="2"/>
  <Say voice="alice">Thank you for calling Pirates World Tele Solution. Goodbye.</Say>
  <Hangup/>
</Response>`;
      return res.type('text/xml').send(twiml);
    }
  } else if (action === 'REPEAT_MENU') {
    const textToSay = ivr?.greetingText || 'Welcome to Pirates World Tele Solution. Press 1 to speak with an agent, or 2 to repeat.';
    const appUrl = process.env.APP_URL || '';
    const dtmfUrl = `${appUrl}/api/twilio/dtmf?callId=${encodeURIComponent(call.id)}`;
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" timeout="10" action="${escapeXml(dtmfUrl)}" method="POST">
    <Say voice="alice">${escapeXml(textToSay)}</Say>
    <Say voice="alice">Press 1 to speak with an agent, or 2 to repeat.</Say>
  </Gather>
  <Say voice="alice">No key was detected. Goodbye.</Say>
  <Hangup/>
</Response>`;
    return res.type('text/xml').send(twiml);
  } else {
    await telephony.endCall(call.id, 'COMPLETED', 'Caller ended IVR menu interaction.');
    return res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">Thank you for calling Pirates World Tele Solution. Goodbye.</Say><Hangup/></Response>');
  }
});

export default twilioRouter;
