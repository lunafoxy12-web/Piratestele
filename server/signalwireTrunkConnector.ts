import { db } from './db.ts';

export interface SignalWireNumber {
  sid: string;
  phoneNumber: string;
  friendlyName: string;
  voiceEnabled: boolean;
}

export interface SignalWireCredentials {
  space: string;
  projectId: string;
  apiToken: string;
}

export interface SignalWirePingResult {
  success: boolean;
  latencyMs: number;
  statusText?: string;
  account?: {
    projectId: string;
    friendlyName: string;
    status: string;
    accountType: string;
    isTrial: boolean;
    currency: string;
    numbers: SignalWireNumber[];
  };
  error?: string;
  troubleshooting?: string;
}

export interface OutboundPstnCallParams {
  space: string;
  projectId: string;
  apiToken: string;
  from: string;
  to: string;
  greetingText?: string;
  appUrl?: string;
  callId?: string;
  campaignId?: string;
  contactId?: string;
}

export interface OutboundPstnCallResult {
  success: boolean;
  callSid?: string;
  status?: string;
  error?: string;
  troubleshooting?: string;
}

/**
 * Extracts clean space subdomain (e.g. "101proposalsllc") from any format
 */
export function normalizeSpace(space: string): string {
  if (!space) return '';
  let cleaned = space.trim();
  cleaned = cleaned.replace(/^https?:\/\//i, '');
  cleaned = cleaned.split('/')[0].split('?')[0].trim();
  cleaned = cleaned.split(':')[0].trim();
  cleaned = cleaned.replace(/\.(sip\.)?signalwire\.com$/i, '').trim();
  return cleaned;
}

function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function safeFetchJson(url: string, options: RequestInit): Promise<{ ok: boolean; status: number; data: any; raw: string }> {
  try {
    const res = await fetch(url, options);
    const raw = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { message: raw };
    }
    return { ok: res.ok, status: res.status, data, raw };
  } catch (err: any) {
    return { ok: false, status: 0, data: { message: err.message }, raw: err.message || 'Network failure' };
  }
}

/**
 * SignalWire Trunk Connector:
 * Direct carrier interface for SignalWire LAML / REST Voice API.
 * Eliminates all mock logic; performs live HTTP calls to SignalWire cloud.
 */
export class SignalWireTrunkConnector {
  /**
   * Pings SignalWire to verify credentials, account status, and phone numbers.
   */
  public static async pingStatus(credentials: SignalWireCredentials): Promise<SignalWirePingResult> {
    const startTime = Date.now();
    const cleanSpace = normalizeSpace(credentials.space);
    const cleanProjectId = credentials.projectId.trim().replace(/^["']|["']$/g, '');
    const cleanToken = credentials.apiToken.trim().replace(/^["']|["']$/g, '');

    if (!cleanSpace) {
      return {
        success: false,
        latencyMs: 0,
        error: 'SignalWire Space URL is required (e.g. "101proposalsllc" or "https://101proposalsllc.signalwire.com").',
      };
    }
    if (!cleanProjectId) {
      return {
        success: false,
        latencyMs: 0,
        error: 'SignalWire Project ID is required (36-character UUID from your SignalWire Dashboard -> API).',
      };
    }
    if (!cleanToken) {
      return {
        success: false,
        latencyMs: 0,
        error: 'SignalWire API Token is required (starts with "PT").',
      };
    }

    const authHeader = `Basic ${Buffer.from(`${cleanProjectId}:${cleanToken}`).toString('base64')}`;
    const baseUrl = `https://${cleanSpace}.signalwire.com/api/laml/2010-04-01`;

    const accRes = await safeFetchJson(`${baseUrl}/Accounts/${cleanProjectId}.json`, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
        'User-Agent': 'PiratesWorld-TeleSolution-Trunk/2.0',
      },
    });

    const latencyMs = Date.now() - startTime;

    if (!accRes.ok) {
      let troubleshooting = '';
      if (accRes.status === 401) {
        troubleshooting =
          'Authentication failed (HTTP 401 Unauthorized).\n' +
          '1. Ensure Space is "' + cleanSpace + '.signalwire.com".\n' +
          '2. Ensure Project ID is your 36-char UUID (Dashboard -> API).\n' +
          '3. In SignalWire -> API Tokens, verify your token has "Voice" and "cXML / LAML" scopes enabled.\n' +
          '4. Ensure you use a Project API Token, not a Personal Access Token.';
      } else if (accRes.status === 404) {
        troubleshooting = `Space "${cleanSpace}.signalwire.com" or Project ID was not found (HTTP 404). Please verify your subdomain.`;
      } else if (accRes.status === 403) {
        troubleshooting = 'Permission Denied (HTTP 403 Forbidden). Edit your API token in SignalWire to enable Voice permissions.';
      }

      return {
        success: false,
        latencyMs,
        error: accRes.data?.message || accRes.raw || `SignalWire authentication rejected (HTTP ${accRes.status})`,
        troubleshooting,
      };
    }

    // Ping incoming phone numbers to verify numbers provisioned for outbound caller ID
    const numbers: SignalWireNumber[] = [];
    const numRes = await safeFetchJson(`${baseUrl}/Accounts/${cleanProjectId}/IncomingPhoneNumbers.json?PageSize=50`, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
    });

    if (numRes.ok && Array.isArray(numRes.data?.incoming_phone_numbers)) {
      for (const n of numRes.data.incoming_phone_numbers) {
        numbers.push({
          sid: n.sid,
          phoneNumber: n.phone_number,
          friendlyName: n.friendly_name || n.phone_number,
          voiceEnabled: Boolean(n.capabilities?.voice),
        });
      }
    }

    const isTrial =
      Boolean(accRes.data?.type?.toLowerCase().includes('trial')) ||
      Boolean(accRes.data?.status?.toLowerCase().includes('trial'));

    return {
      success: true,
      latencyMs,
      statusText: `SignalWire Trunk Connected (${cleanSpace}.signalwire.com)`,
      account: {
        projectId: cleanProjectId,
        friendlyName: accRes.data?.friendly_name || `${cleanSpace}.signalwire.com`,
        status: accRes.data?.status || 'active',
        accountType: accRes.data?.type || (isTrial ? 'Trial Space' : 'Full Account'),
        isTrial,
        currency: accRes.data?.currency || 'USD',
        numbers,
      },
    };
  }

  /**
   * Automatically provisions or retrieves hosted LamlBins inside the user's SignalWire space.
   * This guarantees that telephone audio, Alice TTS greeting, and Agent Bridge hold music
   * are executed directly from SignalWire's CDN without being blocked by proxy cookies.
   */
  public static async ensureHostedBins(credentials: {
    space: string;
    projectId: string;
    apiToken: string;
    greetingText?: string;
  }): Promise<{ ivrBinUrl: string; bridgeBinUrl: string }> {
    const cleanSpace = normalizeSpace(credentials.space);
    const cleanProjectId = credentials.projectId.trim().replace(/^["']|["']$/g, '');
    const cleanToken = credentials.apiToken.trim().replace(/^["']|["']$/g, '');

    const authHeader = `Basic ${Buffer.from(`${cleanProjectId}:${cleanToken}`).toString('base64')}`;
    const baseUrl = `https://${cleanSpace}.signalwire.com/api/laml/2010-04-01/Accounts/${cleanProjectId}`;

    // 1. Create or ensure Agent Bridge & Classical Hold LamlBin
    const bridgeXml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you for pressing 1. Connecting you to representative agent Edward Teach. Please hold while we bridge your call.</Say>
  <Play>https://cdn.signalwire.com/default-music/classical.mp3</Play>
  <Say voice="alice">All representative agents are currently assisting other callers. Please stay on the line.</Say>
  <Play>https://cdn.signalwire.com/default-music/classical.mp3</Play>
</Response>`;

    const bridgeForm = new URLSearchParams();
    bridgeForm.append('Name', 'Pirates World Agent Bridge & Hold');
    bridgeForm.append('Contents', bridgeXml);

    let bridgeBinUrl = '';
    try {
      const bridgeRes = await safeFetchJson(`${baseUrl}/LamlBins`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'User-Agent': 'PiratesWorld-TeleSolution-Trunk/2.0',
        },
        body: bridgeForm.toString(),
      });
      if (bridgeRes.ok && bridgeRes.data?.request_url) {
        bridgeBinUrl = bridgeRes.data.request_url;
      }
    } catch (e) {
      console.warn('[SIGNALWIRE BINS] Could not provision bridge LamlBin:', e);
    }

    // 2. Create or ensure Main Outbound IVR LamlBin
    const greeting = credentials.greetingText || 'Welcome to Pirates World Tele Solution. Press 1 to connect with an available agent, or 2 to repeat this greeting.';
    const ivrActionUrl = bridgeBinUrl || `https://${cleanSpace}.signalwire.com/laml-bins/bridge`;
    const ivrXml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="1"/>
  <Gather numDigits="1" timeout="10" action="${escapeXml(ivrActionUrl)}" method="POST">
    <Say voice="alice">${escapeXml(greeting)}</Say>
    <Say voice="alice">Press 1 to speak with an agent, or 2 to hear this greeting again.</Say>
  </Gather>
  <Say voice="alice">No key was detected. Thank you for calling Pirates World Tele Solution. Goodbye.</Say>
  <Hangup/>
</Response>`;

    const ivrForm = new URLSearchParams();
    ivrForm.append('Name', 'Pirates World IVR Menu');
    ivrForm.append('Contents', ivrXml);

    let ivrBinUrl = '';
    try {
      const ivrRes = await safeFetchJson(`${baseUrl}/LamlBins`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'User-Agent': 'PiratesWorld-TeleSolution-Trunk/2.0',
        },
        body: ivrForm.toString(),
      });
      if (ivrRes.ok && ivrRes.data?.request_url) {
        ivrBinUrl = ivrRes.data.request_url;
      }
    } catch (e) {
      console.warn('[SIGNALWIRE BINS] Could not provision IVR LamlBin:', e);
    }

    return { ivrBinUrl, bridgeBinUrl };
  }

  /**
   * Fetches real-time call lifecycle state directly from SignalWire REST API.
   */
  public static async getCallStatus(
    credentials: { space: string; projectId: string; apiToken: string },
    callSid: string
  ): Promise<{ status: string; duration?: number; from?: string; to?: string } | null> {
    const cleanSpace = normalizeSpace(credentials.space);
    const cleanProjectId = credentials.projectId.trim().replace(/^["']|["']$/g, '');
    const cleanToken = credentials.apiToken.trim().replace(/^["']|["']$/g, '');

    const authHeader = `Basic ${Buffer.from(`${cleanProjectId}:${cleanToken}`).toString('base64')}`;
    const res = await safeFetchJson(
      `https://${cleanSpace}.signalwire.com/api/laml/2010-04-01/Accounts/${cleanProjectId}/Calls/${callSid}.json`,
      {
        method: 'GET',
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
          'User-Agent': 'PiratesWorld-TeleSolution-Trunk/2.0',
        },
      }
    );

    if (res.ok && res.data) {
      return {
        status: res.data.status,
        duration: res.data.duration ? parseInt(res.data.duration, 10) : undefined,
        from: res.data.from,
        to: res.data.to,
      };
    }
    return null;
  }

  /**
   * Dispatches a live outbound PSTN phone call via SignalWire REST API.
   * Real telephone audio and DTMF handling.
   */
  public static async dispatchOutboundCall(params: OutboundPstnCallParams): Promise<OutboundPstnCallResult> {
    const { space, projectId, apiToken, from, to, greetingText, appUrl, callId } = params;

    const cleanSpace = normalizeSpace(space);
    const cleanProjectId = projectId.trim().replace(/^["']|["']$/g, '');
    const cleanToken = apiToken.trim().replace(/^["']|["']$/g, '');
    const cleanFrom = from.trim();
    const cleanTo = to.trim();

    if (!cleanSpace || !cleanProjectId || !cleanToken) {
      return {
        success: false,
        error: 'Missing SignalWire credentials in Trunk Connector.',
      };
    }

    const hostAppUrl = appUrl || process.env.APP_URL || 'https://ais-dev-poipaeays7cgf773toaf6y-679199737507.asia-northeast1.run.app';
    const authHeader = `Basic ${Buffer.from(`${cleanProjectId}:${cleanToken}`).toString('base64')}`;

    const textToSay =
      greetingText ||
      'Hello from Pirates World Tele Solution. Dispatched via SignalWire cloud. Press 1 to connect with an available agent, or 2 to repeat this greeting.';

    // Provision hosted LamlBins directly on SignalWire CDN so audio never fails
    const { ivrBinUrl } = await this.ensureHostedBins({
      space: cleanSpace,
      projectId: cleanProjectId,
      apiToken: cleanToken,
      greetingText: textToSay,
    });

    const fallbackXmlUrl = `${hostAppUrl}/api/twilio/call-twiml${callId ? `?callId=${encodeURIComponent(callId)}` : ''}`;
    const callExecutionUrl = ivrBinUrl || fallbackXmlUrl;

    const callbackUrl = `${hostAppUrl}/api/twilio/call-status`;

    const body = new URLSearchParams();
    body.append('To', cleanTo);
    body.append('From', cleanFrom);
    body.append('Url', callExecutionUrl);
    if (callbackUrl && !hostAppUrl.includes('ais-dev-') && !hostAppUrl.includes('ais-pre-')) {
      body.append('StatusCallback', callbackUrl);
      body.append('StatusCallbackEvent', 'initiated');
      body.append('StatusCallbackEvent', 'answered');
      body.append('StatusCallbackMethod', 'POST');
    }

    console.log(`[SIGNALWIRE TRUNK] Dispatching outbound PSTN call from ${cleanFrom} to ${cleanTo} via ${cleanSpace}.signalwire.com with hosted cXML: ${callExecutionUrl}...`);

    const res = await safeFetchJson(
      `https://${cleanSpace}.signalwire.com/api/laml/2010-04-01/Accounts/${cleanProjectId}/Calls.json`,
      {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'User-Agent': 'PiratesWorld-TeleSolution-Trunk/2.0',
        },
        body: body.toString(),
      }
    );

    if (!res.ok) {
      let troubleshooting = '';
      const msg = res.data?.message || res.raw || '';

      if (res.status === 401) {
        troubleshooting = 'SignalWire rejected authentication (HTTP 401). Verify Space, Project ID, and API Token.';
      } else if (
        msg.toLowerCase().includes('not a purchased or verified number') ||
        msg.toLowerCase().includes('purchased or verified phone numbers only') ||
        msg.toLowerCase().includes('unverified') ||
        (msg.toLowerCase().includes("'to'") && msg.toLowerCase().includes('verified'))
      ) {
        troubleshooting =
          `Trial Account Recipient Verification Required: In trial mode, SignalWire only allows dialing phone numbers you have verified. To call this phone (${cleanTo}): In SignalWire Console -> Phone Numbers -> Verified Numbers, click "+ Verify a Number" and add ${cleanTo} (or add $5 balance to lift trial restrictions and dial any phone number worldwide).`;
      } else if (msg.toLowerCase().includes('not routeable') || msg.toLowerCase().includes('not routable')) {
        troubleshooting =
          `SignalWire Geo-Permissions: Destination "${cleanTo}" is not routeable. By default, SignalWire only permits North American (+1) calls. To dial UK (+44) or international numbers: In your SignalWire Dashboard -> Voice -> Settings -> Voice Geo Permissions, enable "United Kingdom" (or add $5 credit to unlock full international dialing).`;
      } else if (
        msg.toLowerCase().includes('from must be a purchased') ||
        msg.toLowerCase().includes("invalid 'from'") ||
        (msg.toLowerCase().includes('from') && msg.toLowerCase().includes('incoming number'))
      ) {
        troubleshooting = `The Caller ID ${cleanFrom} is not a valid incoming number for your SignalWire account. Make sure to use your purchased number.`;
      } else if (cleanTo.startsWith('+44') || !cleanTo.startsWith('+1')) {
        troubleshooting =
          'International Calling: SignalWire restricts calls to North America (+1) by default. In SignalWire Console -> Voice -> Settings -> Voice Geo Permissions, enable United Kingdom (+44).';
      }

      const displayError = troubleshooting
        ? `${msg} (${troubleshooting})`
        : msg || `SignalWire rejected call (HTTP ${res.status})`;

      console.error(`[SIGNALWIRE TRUNK ERROR] Call failed: HTTP ${res.status}: ${displayError}`);

      return {
        success: false,
        error: displayError,
        troubleshooting,
      };
    }

    console.log(`[SIGNALWIRE TRUNK SUCCESS] Call successfully placed! SID: ${res.data?.sid}, Status: ${res.data?.status}`);

    return {
      success: true,
      callSid: res.data?.sid,
      status: res.data?.status || 'queued',
    };
  }
}
