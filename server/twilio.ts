/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TwilioAccountInfo {
  accountSid: string;
  friendlyName: string;
  status: string;
  type: 'Trial' | 'Full' | string;
  isTrial: boolean;
  currency: string;
  balance?: string;
  incomingNumbers: Array<{
    sid: string;
    phoneNumber: string;
    friendlyName: string;
    capabilities: {
      voice: boolean;
      sms: boolean;
    };
  }>;
  verifiedCallerIds: Array<{
    sid: string;
    phoneNumber: string;
    friendlyName: string;
  }>;
}

export interface TwilioVerifyResult {
  success: boolean;
  message: string;
  account?: TwilioAccountInfo;
  error?: {
    code?: number;
    message: string;
    moreInfo?: string;
    trialHint?: string;
  };
}

export interface TwilioCallResult {
  success: boolean;
  callSid?: string;
  status?: string;
  to?: string;
  from?: string;
  dateCreated?: string;
  consoleUrl?: string;
  message: string;
  error?: {
    code?: number;
    message: string;
    moreInfo?: string;
    trialHint?: string;
  };
}

/**
 * Validates Twilio credentials by fetching account details, incoming phone numbers,
 * and verified outgoing caller IDs (critical for Trial accounts).
 */
export async function verifyTwilioCredentials(
  accountSid: string,
  authToken: string
): Promise<TwilioVerifyResult> {
  const cleanSid = accountSid.trim();
  const cleanToken = authToken.trim();

  if (!cleanSid.startsWith('AC')) {
    return {
      success: false,
      message: 'Invalid Twilio Account SID format. Twilio Account SIDs must start with "AC".',
    };
  }

  const basicAuth = Buffer.from(`${cleanSid}:${cleanToken}`).toString('base64');
  const headers = {
    Authorization: `Basic ${basicAuth}`,
    Accept: 'application/json',
  };

  try {
    // 1. Fetch Account Details
    const accRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${cleanSid}.json`,
      { headers }
    );
    const accData = await accRes.json();

    if (!accRes.ok) {
      let trialHint = undefined;
      if (accData.code === 20003) {
        trialHint =
          'Authentication failed. Please verify that your Twilio Account SID and Auth Token are copied correctly from the Twilio Console (https://console.twilio.com).';
      }
      return {
        success: false,
        message: accData.message || 'Failed to authenticate with Twilio.',
        error: {
          code: accData.code,
          message: accData.message,
          moreInfo: accData.more_info,
          trialHint,
        },
      };
    }

    const isTrial = accData.type === 'Trial' || accData.status === 'trial';

    // 2. Fetch Incoming Numbers (Purchased Phone Numbers)
    let incomingNumbers: TwilioAccountInfo['incomingNumbers'] = [];
    try {
      const incRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${cleanSid}/IncomingPhoneNumbers.json?PageSize=50`,
        { headers }
      );
      if (incRes.ok) {
        const incData = await incRes.json();
        incomingNumbers = (incData.incoming_phone_numbers || []).map((num: any) => ({
          sid: num.sid,
          phoneNumber: num.phone_number,
          friendlyName: num.friendly_name,
          capabilities: {
            voice: Boolean(num.capabilities?.voice),
            sms: Boolean(num.capabilities?.sms),
          },
        }));
      }
    } catch {
      // Non-fatal if numbers fetch fails
    }

    // 3. Fetch Verified Caller IDs (essential for trial accounts)
    let verifiedCallerIds: TwilioAccountInfo['verifiedCallerIds'] = [];
    try {
      const verRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${cleanSid}/OutgoingCallerIds.json?PageSize=50`,
        { headers }
      );
      if (verRes.ok) {
        const verData = await verRes.json();
        verifiedCallerIds = (verData.outgoing_caller_ids || []).map((num: any) => ({
          sid: num.sid,
          phoneNumber: num.phone_number,
          friendlyName: num.friendly_name,
        }));
      }
    } catch {
      // Non-fatal if caller IDs fetch fails
    }

    // 4. Fetch Balance (if trial or standard)
    let balance: string | undefined = undefined;
    try {
      const balRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${cleanSid}/Balance.json`,
        { headers }
      );
      if (balRes.ok) {
        const balData = await balRes.json();
        balance = balData.balance ? `${balData.balance} ${balData.currency || 'USD'}` : undefined;
      }
    } catch {
      // Non-fatal
    }

    const account: TwilioAccountInfo = {
      accountSid: cleanSid,
      friendlyName: accData.friendly_name || 'Twilio Account',
      status: accData.status,
      type: accData.type || (isTrial ? 'Trial' : 'Full'),
      isTrial,
      currency: accData.currency || 'USD',
      balance,
      incomingNumbers,
      verifiedCallerIds,
    };

    return {
      success: true,
      message: `Successfully connected to Twilio ${isTrial ? '(Trial Account)' : '(Full Account)'}. Found ${incomingNumbers.length} Twilio number(s) and ${verifiedCallerIds.length} verified test recipient(s).`,
      account,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Twilio network connection error: ${err.message || 'Unknown network error'}`,
    };
  }
}

/**
 * Places a live phone call using Twilio Voice REST API.
 * Handles trial account restrictions and provides detailed diagnostic error hints.
 */
export async function makeTwilioCall(options: {
  accountSid: string;
  authToken: string;
  from: string;
  to: string;
  greetingText?: string;
  appUrl?: string;
  statusCallbackUrl?: string;
  dtmfCallbackUrl?: string;
  callId?: string;
}): Promise<TwilioCallResult> {
  const { accountSid, authToken, from, to, greetingText, statusCallbackUrl, dtmfCallbackUrl } = options;

  const cleanSid = accountSid.trim();
  const cleanToken = authToken.trim();
  const cleanFrom = from.trim();
  const cleanTo = to.trim();

  const basicAuth = Buffer.from(`${cleanSid}:${cleanToken}`).toString('base64');
  const headers = {
    Authorization: `Basic ${basicAuth}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  };

  // Build embedded TwiML
  const textToSay =
    greetingText ||
    'Hello from Pirates World Tele Solution. This is a real test call dispatched through your carrier account. Press 1 to connect with an available agent, or press 2 to repeat this greeting.';

  // TwiML with gather for real DTMF detection
  const gatherAction = dtmfCallbackUrl ? ` action="${escapeXml(dtmfCallbackUrl)}" method="POST"` : '';
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="1"/>
  <Gather numDigits="1" timeout="10"${gatherAction}>
    <Say voice="alice">${escapeXml(textToSay)}</Say>
    <Say voice="alice">Press 1 to speak with an agent, or 2 to hear this greeting again.</Say>
  </Gather>
  <Say voice="alice">No key was detected. Thank you for testing Pirates World Tele Solution. Goodbye.</Say>
  <Hangup/>
</Response>`;

  const bodyParams = new URLSearchParams();
  bodyParams.append('To', cleanTo);
  bodyParams.append('From', cleanFrom);
  bodyParams.append('Twiml', twiml);

  if (statusCallbackUrl) {
    bodyParams.append('StatusCallback', statusCallbackUrl);
    bodyParams.append('StatusCallbackEvent', 'initiated ringing answered completed');
    bodyParams.append('StatusCallbackMethod', 'POST');
  }

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${cleanSid}/Calls.json`,
      {
        method: 'POST',
        headers,
        body: bodyParams.toString(),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      let trialHint: string | undefined = undefined;

      // Handle specific Twilio trial limitations
      if (data.code === 21608) {
        trialHint =
          `Twilio Trial Restriction (Error 21608): The destination number "${cleanTo}" is unverified. Twilio trial accounts can only call verified numbers. Please verify this phone number in your Twilio Console at: https://console.twilio.com/us1/develop/phone-numbers/manage/verified`;
      } else if (data.code === 21215) {
        trialHint =
          `Twilio Trial Restriction (Error 21215): Geo-permissions block calls to this country prefix on trial accounts. Enable country permissions in Twilio Voice Settings or test with a US/local verified number.`;
      } else if (data.code === 21606) {
        trialHint =
          `Twilio Error (21606): The "From" number "${cleanFrom}" is not an active incoming number in your Twilio account. Please select one of your purchased Twilio phone numbers.`;
      } else if (data.code === 20003) {
        trialHint =
          'Authentication failed. Check your Twilio Account SID and Auth Token.';
      } else if (data.code === 20429) {
        trialHint =
          'Twilio Trial Limit (20429): Concurrency limit reached. Trial accounts only allow 1 concurrent active outbound call at a time.';
      }

      return {
        success: false,
        message: data.message || 'Twilio call placement failed.',
        error: {
          code: data.code,
          message: data.message,
          moreInfo: data.more_info,
          trialHint,
        },
      };
    }

    const consoleUrl = `https://console.twilio.com/us1/develop/voice/manage/logs/${data.sid}`;

    return {
      success: true,
      callSid: data.sid,
      status: data.status,
      to: data.to,
      from: data.from,
      dateCreated: data.date_created,
      consoleUrl,
      message: `Outbound test call successfully queued with Twilio! Call SID: ${data.sid}. Your phone should ring shortly.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Network error communicating with Twilio: ${err.message || 'Unknown error'}`,
    };
  }
}

/**
 * Extracts clean SignalWire space subdomain from any input format
 * (e.g. "my-space", "my-space.signalwire.com", "https://my-space.signalwire.com/api/laml/...")
 */
export function extractSignalWireSpace(input: string): string {
  if (!input) return '';
  let cleaned = input.trim();
  cleaned = cleaned.replace(/^https?:\/\//i, '');
  cleaned = cleaned.split('/')[0].split('?')[0].trim();
  cleaned = cleaned.split(':')[0].trim();
  cleaned = cleaned.replace(/\.(sip\.)?signalwire\.com$/i, '').trim();
  return cleaned;
}

/**
 * Safely parses response text as JSON without throwing SyntaxError on plain-text errors
 */
async function parseResponseSafely(res: Response): Promise<{ isJson: boolean; data: any; rawText: string }> {
  const rawText = await res.text();
  try {
    const data = JSON.parse(rawText);
    return { isJson: true, data, rawText };
  } catch {
    return { isJson: false, data: { message: rawText }, rawText };
  }
}

/**
 * Validates SignalWire credentials via SignalWire Compatibility API (LAML).
 */
export async function verifySignalWireCredentials(
  space: string,
  projectId: string,
  apiToken: string
): Promise<TwilioVerifyResult> {
  const cleanSpace = extractSignalWireSpace(space);
  const cleanProjectId = projectId.trim().replace(/^["']|["']$/g, '');
  const cleanToken = apiToken.trim().replace(/^["']|["']$/g, '');

  if (!cleanSpace) {
    return {
      success: false,
      message: 'SignalWire Space is required (e.g. "my-space" or "https://my-space.signalwire.com").',
    };
  }
  if (!cleanProjectId) {
    return {
      success: false,
      message: 'SignalWire Project ID is required (36-character UUID from your SignalWire Dashboard).',
    };
  }
  if (!cleanToken) {
    return {
      success: false,
      message: 'SignalWire API Token is required (starts with "PT").',
    };
  }

  const basicAuth = Buffer.from(`${cleanProjectId}:${cleanToken}`).toString('base64');
  const headers = {
    Authorization: `Basic ${basicAuth}`,
    Accept: 'application/json',
    'User-Agent': 'TeleSolution-SignalWire-Client/1.0',
  };

  const baseUrl = `https://${cleanSpace}.signalwire.com/api/laml/2010-04-01`;

  try {
    const accRes = await fetch(`${baseUrl}/Accounts/${cleanProjectId}.json`, { headers });
    const { isJson, data: accData, rawText } = await parseResponseSafely(accRes);

    if (!accRes.ok) {
      let trialHint = undefined;
      let detailedMessage = '';

      if (accRes.status === 401) {
        detailedMessage = `SignalWire rejected credentials (HTTP 401 Unauthorized for Space: "${cleanSpace}.signalwire.com").`;
        trialHint =
          'Authentication failed (HTTP 401 Unauthorized). Please check:\n' +
          '1. Space Name: Verify that "' + cleanSpace + '.signalwire.com" is your exact SignalWire Space.\n' +
          '2. Project ID: Ensure you copied the 36-character Project ID UUID from SignalWire Dashboard -> API (e.g. 38f1a8e4-b3ef-4f4c-8fa2-0c309f4e24ab), NOT your project display name.\n' +
          '3. API Token Scopes: In SignalWire Dashboard -> API -> API Tokens, ensure your token has "cXML / LAML" and "Voice" permissions enabled.\n' +
          '4. Token Type: Use a "Project API Token" (created inside your project), not a Personal Access Token.';
      } else if (accRes.status === 403) {
        detailedMessage = `SignalWire API Token has insufficient permissions (HTTP 403 Forbidden).`;
        trialHint =
          'Your API token was recognized, but lacks the necessary scope. In SignalWire Console -> API -> API Tokens, edit the token and check all voice/cXML permissions.';
      } else if (accRes.status === 404) {
        detailedMessage = `Account or Space not found (HTTP 404 at ${cleanSpace}.signalwire.com).`;
        trialHint = `The Space "${cleanSpace}.signalwire.com" or Project ID "${cleanProjectId}" was not found. Please double check your Space URL.`;
      } else {
        detailedMessage = accData?.message || rawText || `SignalWire authentication failed (HTTP ${accRes.status}).`;
      }

      return {
        success: false,
        message: detailedMessage,
        error: {
          code: accData?.code || accRes.status,
          message: accData?.message || rawText || 'Unauthorized',
          trialHint,
        },
      };
    }

    // Fetch incoming numbers
    let incomingNumbers: TwilioAccountInfo['incomingNumbers'] = [];
    try {
      const incRes = await fetch(
        `${baseUrl}/Accounts/${cleanProjectId}/IncomingPhoneNumbers.json?PageSize=50`,
        { headers }
      );
      if (incRes.ok) {
        const { data: incData } = await parseResponseSafely(incRes);
        incomingNumbers = (incData?.incoming_phone_numbers || []).map((num: any) => ({
          sid: num.sid,
          phoneNumber: num.phone_number,
          friendlyName: num.friendly_name || num.phone_number,
          capabilities: {
            voice: Boolean(num.capabilities?.voice),
            sms: Boolean(num.capabilities?.sms),
          },
        }));
      }
    } catch {}

    // Fetch verified caller IDs
    let verifiedCallerIds: TwilioAccountInfo['verifiedCallerIds'] = [];
    try {
      const verRes = await fetch(
        `${baseUrl}/Accounts/${cleanProjectId}/OutgoingCallerIds.json?PageSize=50`,
        { headers }
      );
      if (verRes.ok) {
        const { data: verData } = await parseResponseSafely(verRes);
        verifiedCallerIds = (verData?.outgoing_caller_ids || []).map((num: any) => ({
          sid: num.sid,
          phoneNumber: num.phone_number,
          friendlyName: num.friendly_name || num.phone_number,
        }));
      }
    } catch {}

    const isTrial =
      Boolean(accData?.type?.toLowerCase().includes('trial')) ||
      Boolean(accData?.status?.toLowerCase().includes('trial'));

    return {
      success: true,
      message: `Successfully connected to SignalWire Space "${cleanSpace}.signalwire.com"! Found ${incomingNumbers.length} purchased number(s) and ${verifiedCallerIds.length} verified caller ID(s).`,
      account: {
        accountSid: cleanProjectId,
        friendlyName: accData?.friendly_name || `${cleanSpace}.signalwire.com`,
        status: accData?.status || 'active',
        type: accData?.type || (isTrial ? 'Trial Space' : 'Full Space'),
        isTrial,
        currency: accData?.currency || 'USD',
        incomingNumbers,
        verifiedCallerIds,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      message: `SignalWire network error: ${err.message || 'Unknown network error'}`,
    };
  }
}

/**
 * Places a live phone call using SignalWire Voice Compatibility REST API.
 */
export async function makeSignalWireCall(options: {
  space: string;
  projectId: string;
  apiToken: string;
  from: string;
  to: string;
  greetingText?: string;
  appUrl?: string;
  statusCallbackUrl?: string;
  dtmfCallbackUrl?: string;
  callId?: string;
}): Promise<TwilioCallResult> {
  const { space, projectId, apiToken, from, to, greetingText, statusCallbackUrl, dtmfCallbackUrl } = options;
  const cleanSpace = extractSignalWireSpace(space);
  const cleanProjectId = projectId.trim().replace(/^["']|["']$/g, '');
  const cleanToken = apiToken.trim().replace(/^["']|["']$/g, '');
  const cleanFrom = from.trim();
  const cleanTo = to.trim();

  const basicAuth = Buffer.from(`${cleanProjectId}:${cleanToken}`).toString('base64');
  const headers = {
    Authorization: `Basic ${basicAuth}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  };

  const textToSay =
    greetingText ||
    'Hello from Pirates World Tele Solution. Dispatched via SignalWire cloud. Press 1 to connect with an available agent, or 2 to repeat this greeting.';

  const gatherAction = dtmfCallbackUrl ? ` action="${escapeXml(dtmfCallbackUrl)}" method="POST"` : '';
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="1"/>
  <Gather numDigits="1" timeout="10"${gatherAction}>
    <Say voice="alice">${escapeXml(textToSay)}</Say>
    <Say voice="alice">Press 1 to speak with an agent, or 2 to hear this greeting again.</Say>
  </Gather>
  <Say voice="alice">No key was detected. Thank you for testing Pirates World Tele Solution with SignalWire. Goodbye.</Say>
  <Hangup/>
</Response>`;

  const bodyAppUrl = options.appUrl || 'https://ais-dev-poipaeays7cgf773toaf6y-679199737507.asia-northeast1.run.app';
  const xmlUrl = `${bodyAppUrl}/api/twilio/call-twiml${options.callId ? `?callId=${encodeURIComponent(options.callId)}` : ''}`;

  const bodyParams = new URLSearchParams();
  bodyParams.append('To', cleanTo);
  bodyParams.append('From', cleanFrom);
  bodyParams.append('Url', xmlUrl);
  bodyParams.append('Twiml', twiml);

  if (statusCallbackUrl) {
    bodyParams.append('StatusCallback', statusCallbackUrl);
    bodyParams.append('StatusCallbackEvent', 'initiated');
    bodyParams.append('StatusCallbackEvent', 'answered');
    bodyParams.append('StatusCallbackMethod', 'POST');
  }

  try {
    const res = await fetch(
      `https://${cleanSpace}.signalwire.com/api/laml/2010-04-01/Accounts/${cleanProjectId}/Calls.json`,
      {
        method: 'POST',
        headers,
        body: bodyParams.toString(),
      }
    );

    const { isJson, data, rawText } = await parseResponseSafely(res);

    if (!res.ok) {
      let trialHint: string | undefined = undefined;
      if (res.status === 401) {
        trialHint =
          'Authentication failed (HTTP 401). Verify your SignalWire Space, Project ID, and API Token. Ensure the token has Voice permissions.';
      } else if (data?.message && data.message.toLowerCase().includes('unverified')) {
        trialHint =
          'SignalWire Trial Restriction: On trial accounts, you must verify the destination phone number in SignalWire Console -> Phone Numbers -> Verified before calling it.';
      }

      return {
        success: false,
        message: data?.message || rawText || `SignalWire call placement failed (HTTP ${res.status}).`,
        error: {
          code: data?.code || res.status,
          message: data?.message || rawText || 'Call rejected',
          trialHint,
        },
      };
    }

    return {
      success: true,
      callSid: data?.sid,
      status: data?.status,
      to: data?.to,
      from: data?.from,
      dateCreated: data?.date_created,
      message: `Outbound test call placed via SignalWire! Call SID: ${data?.sid}. Your phone will ring shortly.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Network error communicating with SignalWire: ${err.message || 'Unknown error'}`,
    };
  }
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
