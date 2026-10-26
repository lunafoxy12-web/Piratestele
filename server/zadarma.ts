/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';

export interface ZadarmaConfig {
  apiKey: string;
  apiSecret: string;
  defaultCallerId?: string;
  sipLogin?: string; // e.g. 101 or 123456
  pbxExtension?: string; // PBX internal extension
  apiEndpoint?: string; // default: https://api.zadarma.com
}

export interface ZadarmaBalanceResponse {
  success: boolean;
  balance?: number;
  currency?: string;
  message?: string;
  raw?: any;
}

export interface ZadarmaCallbackResponse {
  success: boolean;
  callId?: string;
  message: string;
  raw?: any;
  error?: string;
}

export interface ZadarmaWebhookPayload {
  event: 'NOTIFY_START' | 'NOTIFY_INTERNAL' | 'NOTIFY_ANSWER' | 'NOTIFY_DTMF' | 'NOTIFY_END' | 'NOTIFY_OUT_START' | 'NOTIFY_OUT_END' | 'NOTIFY_RECORD' | string;
  call_start?: string;
  pbx_call_id?: string;
  call_id_with_rec?: string;
  caller_id?: string;
  called_did?: string;
  duration?: string | number;
  disposition?: string;
  status_code?: string | number;
  is_recorded?: string | number;
  internal?: string;
  destination?: string;
  dtmf?: string;
  dtmf_key?: string;
  zd_echo?: string;
  [key: string]: any;
}

/**
 * Zadarma REST API & Webhook Service
 * Implements official Zadarma v1 signature algorithm and PBX callback routing
 */
export class ZadarmaConnector {
  private static BASE_URL = 'https://api.zadarma.com';

  /**
   * Generates authorization signature according to official Zadarma API specifications:
   * 1. Add format=json to parameters
   * 2. Sort parameters alphabetically by key
   * 3. Build URL-encoded query string (RFC1738, spaces as +)
   * 4. Compute MD5 hash of query string
   * 5. Concatenate: method + params_string + md5_hash
   * 6. Compute HMAC-SHA1 in HEX format
   * 7. Base64 encode the hex hash: base64_encode(hash_hmac('sha1', ...))
   * 8. Authorization: apiKey:signature
   */
  public static generateSignature(
    method: string,
    params: Record<string, any> = {},
    apiSecret: string
  ): { signature: string; paramsString: string } {
    const cleanMethod = method.startsWith('/') ? method : `/${method}`;
    const allParams: Record<string, any> = { ...params, format: 'json' };
    const sortedKeys = Object.keys(allParams).sort();
    
    // Build query string with RFC1738 encoded components
    const paramsList: string[] = [];
    for (const key of sortedKeys) {
      if (allParams[key] !== undefined && allParams[key] !== null) {
        paramsList.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(allParams[key])).replace(/%20/g, '+')}`);
      }
    }
    const paramsString = paramsList.join('&');
    const md5Hash = crypto.createHash('md5').update(paramsString).digest('hex');
    const signString = `${cleanMethod}${paramsString}${md5Hash}`;
    
    // Official Zadarma PHP: base64_encode(hash_hmac('sha1', $signString, $secret))
    // Note: PHP hash_hmac defaults to returning a hex string, which is then base64 encoded!
    const hmacHex = crypto.createHmac('sha1', apiSecret.trim()).update(signString).digest('hex');
    const signature = Buffer.from(hmacHex).toString('base64');
    return { signature, paramsString };
  }

  /**
   * Queries Zadarma API endpoint with authenticated signature
   */
  public static async requestApi(
    method: string,
    params: Record<string, any> = {},
    config: { apiKey: string; apiSecret: string; endpoint?: string },
    httpMethod: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET'
  ): Promise<any> {
    const baseUrl = config.endpoint || this.BASE_URL;
    const cleanMethod = method.startsWith('/') ? method : `/${method}`;
    const cleanKey = config.apiKey.trim().replace(/^KEY_/, '');
    const cleanSecret = config.apiSecret.trim().replace(/^SEC_/, '');

    const { signature, paramsString } = this.generateSignature(cleanMethod, params, cleanSecret);
    const authHeader = `${cleanKey}:${signature}`;

    let url = `${baseUrl}${cleanMethod}`;
    const options: RequestInit = {
      method: httpMethod,
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
    };

    if (httpMethod === 'GET') {
      url += (url.includes('?') ? '&' : '?') + paramsString;
    } else {
      options.body = paramsString;
      (options.headers as any)['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    const response = await fetch(url, options);
    const responseText = await response.text();

    try {
      return JSON.parse(responseText);
    } catch {
      return { status: 'error', message: responseText, statusCode: response.status };
    }
  }

  /**
   * Checks Zadarma account balance & currency
   */
  public static async getBalance(config: { apiKey: string; apiSecret: string }): Promise<ZadarmaBalanceResponse> {
    try {
      const res = await this.requestApi('/v1/info/balance/', {}, config, 'GET');
      if (res && res.status === 'success') {
        return {
          success: true,
          balance: parseFloat(res.balance || '0'),
          currency: res.currency || 'USD',
          raw: res,
        };
      }
      return {
        success: false,
        message: res.message || 'Failed to retrieve balance from Zadarma.',
        raw: res,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Network failure connecting to Zadarma API: ${err.message}`,
      };
    }
  }

  /**
   * Fetches purchased Direct Inward Dialing (DID) numbers from Zadarma
   */
  public static async getDirectNumbers(config: { apiKey: string; apiSecret: string }): Promise<{
    success: boolean;
    numbers: Array<{ number: string; country?: string; description?: string; status?: string }>;
    callerIds: string[];
    message?: string;
  }> {
    try {
      const res = await this.requestApi('/v1/direct_numbers/', {}, config, 'GET');
      if (res && res.status === 'success' && Array.isArray(res.info)) {
        const numbers = res.info.map((item: any) => ({
          number: item.number.startsWith('+') ? item.number : `+${item.number}`,
          country: item.country || 'United States',
          description: item.description || '',
          status: item.status || 'on',
        }));
        return {
          success: true,
          numbers,
          callerIds: numbers.map((n: any) => n.number),
        };
      }
      return {
        success: false,
        numbers: [],
        callerIds: [],
        message: res.message || 'No direct numbers found on Zadarma account.',
      };
    } catch (err: any) {
      return {
        success: false,
        numbers: [],
        callerIds: [],
        message: err.message,
      };
    }
  }

  /**
   * Fetches verified outgoing caller IDs & direct numbers
   */
  public static async getCallerIds(config: { apiKey: string; apiSecret: string }): Promise<{
    success: boolean;
    callerIds: string[];
    defaultCallerId?: string;
    message?: string;
  }> {
    try {
      // 1. Try direct numbers first (purchased DIDs)
      const didRes = await this.getDirectNumbers(config);
      if (didRes.success && didRes.callerIds.length > 0) {
        return {
          success: true,
          callerIds: didRes.callerIds,
          defaultCallerId: didRes.callerIds[0],
        };
      }

      // 2. Try SIP callerid endpoint
      const res = await this.requestApi('/v1/sip/callerid/', {}, config, 'GET');
      if (res && res.status === 'success') {
        const callerIds: string[] = Array.isArray(res.callerid) ? res.callerid : (res.callerid ? [res.callerid] : []);
        return {
          success: true,
          callerIds,
          defaultCallerId: res.default || (callerIds.length > 0 ? callerIds[0] : undefined),
        };
      }
      return {
        success: false,
        callerIds: [],
        message: res.message || didRes.message || 'Could not fetch caller IDs.',
      };
    } catch (err: any) {
      return {
        success: false,
        callerIds: [],
        message: err.message,
      };
    }
  }

  /**
   * Fetches PBX internal extensions / agents
   */
  public static async getPbxExtensions(config: { apiKey: string; apiSecret: string }): Promise<{
    success: boolean;
    extensions: Array<{ id: string; name?: string; status?: string }>;
    message?: string;
  }> {
    try {
      const res = await this.requestApi('/v1/pbx/internal/', {}, config, 'GET');
      if (res && res.status === 'success' && Array.isArray(res.numbers)) {
        return {
          success: true,
          extensions: res.numbers.map((num: any) => ({
            id: String(num),
            name: `Extension ${num}`,
            status: 'ACTIVE',
          })),
        };
      }
      return {
        success: false,
        extensions: [],
        message: res.message || 'No PBX extensions found.',
      };
    } catch (err: any) {
      return {
        success: false,
        extensions: [],
        message: err.message,
      };
    }
  }

  /**
   * Fetches registered SIP logins/accounts (e.g. 12707, 132479)
   */
  public static async getSipAccounts(config: { apiKey: string; apiSecret: string }): Promise<{
    success: boolean;
    sips: Array<{ id: string; displayName?: string; lines?: number }>;
    message?: string;
  }> {
    try {
      const res = await this.requestApi('/v1/sip/', {}, config, 'GET');
      if (res && res.status === 'success' && Array.isArray(res.sips)) {
        return {
          success: true,
          sips: res.sips.map((s: any) => ({
            id: String(s.id),
            displayName: s.display_name || `SIP ${s.id}`,
            lines: s.lines || 3,
          })),
        };
      }
      return {
        success: false,
        sips: [],
        message: res.message || 'No SIP accounts found.',
      };
    } catch (err: any) {
      return {
        success: false,
        sips: [],
        message: err.message,
      };
    }
  }

  /**
   * Fetches recent call statistics from Zadarma for real-time reconciliation
   */
  public static async getRecentStatistics(config: { apiKey: string; apiSecret: string }): Promise<{
    success: boolean;
    stats: Array<{
      id: string;
      callstart: string;
      from: string | number;
      to: string | number;
      sip?: string;
      disposition: 'answered' | 'cancel' | 'failed' | 'busy';
      billseconds: number;
      billcost?: number;
      cost?: number;
      hangupcause?: string;
      description?: string;
    }>;
  }> {
    try {
      const res = await this.requestApi('/v1/statistics/', {}, config, 'GET');
      if (res && res.status === 'success' && Array.isArray(res.stats)) {
        return { success: true, stats: res.stats };
      }
      return { success: false, stats: [] };
    } catch {
      return { success: false, stats: [] };
    }
  }

  /**
   * Dispatches real outbound PSTN call using Zadarma API
   * Uses E.164 formatting with leading '+' to guarantee USA routing
   */
  public static async dispatchOutboundCall(params: {
    apiKey: string;
    apiSecret: string;
    from?: string; // Caller ID or purchased Zadarma number
    to: string; // Real PSTN phone number (e.g. +12099722359)
    sip?: string; // SIP login or PBX extension
    pbxExtension?: string;
    scenarioId?: string; // PBX Scenario ID e.g. '0-1'
    playIvr?: boolean; // Whether to play IVR voice menu to customer (default true)
    operatorPhone?: string; // Real physical phone of agent/operator
    predicted?: boolean;
    callId: string;
    campaignId?: string;
    contactId?: string;
    dialMethod?: 'callback' | 'checknumber';
  }): Promise<ZadarmaCallbackResponse> {
    try {
      // Clean recipient number for Zadarma (pure international digits)
      let cleanTo = params.to.trim().replace(/[^0-9]/g, '');
      if (cleanTo.startsWith('00')) {
        cleanTo = cleanTo.slice(2);
      }
      // Normalize UK domestic (07xxx, 01xxx, 02xxx -> 44...)
      if (cleanTo.startsWith('0') && cleanTo.length === 11 && (cleanTo.startsWith('07') || cleanTo.startsWith('01') || cleanTo.startsWith('02'))) {
        cleanTo = `44${cleanTo.slice(1)}`;
      }
      // Normalize UK with extra leading 0 after 44 (4407xxx -> 447xxx)
      if (cleanTo.startsWith('4407') && cleanTo.length === 13) {
        cleanTo = `447${cleanTo.slice(4)}`;
      }
      // Normalize Pakistan domestic mobile (03xx -> 923xx)
      if (cleanTo.startsWith('03') && cleanTo.length === 11) {
        cleanTo = `92${cleanTo.slice(1)}`;
      }
      // Normalize North American 10-digit number (2099722359 -> 12099722359)
      if (cleanTo.length === 10 && !cleanTo.startsWith('0')) {
        cleanTo = `1${cleanTo}`;
      }

      // CRITICAL: Zadarma requires international destination numbers to begin with '+'
      // If '+' is omitted, Zadarma applies the account's home country rule (Thailand +66)
      // and prepends '66', turning '447577309348' into '66447577309348' which fails with hangupcause 1!
      const targetInternationalTo = `+${cleanTo}`;

      // Ensure caller ID is in standard digits format without '+'
      let cleanFrom = (params.from || '').trim().replace(/[^0-9]/g, '');
      if (cleanFrom.startsWith('00')) {
        cleanFrom = cleanFrom.slice(2);
      }

      // If caller ID is a placeholder/mock number (like 8005550199) or invalid, override with confirmed Zadarma DID
      if (!cleanFrom || cleanFrom.includes('800555') || cleanFrom === cleanTo || cleanFrom.length < 7) {
        cleanFrom = '18045930160';
      }

      let res: any = null;

      // 1. Direct Phone-to-Phone mode (if agent physical/mobile phone is provided)
      let cleanOp = (params.operatorPhone || '').trim().replace(/[^0-9]/g, '');
      if (cleanOp.startsWith('00')) cleanOp = cleanOp.slice(2);

      if (cleanOp && cleanOp.length >= 7) {
        const intlOp = cleanOp.startsWith('+') ? cleanOp : `+${cleanOp}`;
        console.log(`[ZADARMA DISPATCH] Initiating real Phone-to-Phone carrier bridge: Customer ${targetInternationalTo} <-> Agent Mobile/Direct Phone ${intlOp}...`);
        const p2pParams: Record<string, any> = {
          from: targetInternationalTo,
          to: intlOp,
          predicted: 'true',
        };
        if (cleanFrom) {
          p2pParams.caller_id = cleanFrom;
        }

        res = await this.requestApi(
          '/v1/request/callback/',
          p2pParams,
          { apiKey: params.apiKey, apiSecret: params.apiSecret },
          'GET'
        );
      }

      // 2. Outbound Dispatch: Call PSTN Recipient FIRST (to = targetInternationalTo)
      // When predicted='true', Zadarma dials 'to' (PSTN recipient) FIRST.
      // - IVR Campaign (playIvr: true): 'from' = '0' (Zadarma PBX IVR Voice Menu 0).
      //   The PSTN recipient answers and hears the manager's configured IVR voice prompt over their physical phone.
      //   The Agent station DOES NOT ring until the recipient presses DTMF Key 1!
      //   Upon DTMF Key 1, Zadarma PBX routes to Extension 100 and sends NOTIFY_INTERNAL / NOTIFY_IVR.
      // - Direct Mode (playIvr: false): 'from' = targetExt (Extension 100).
      if (!res || res.status === 'error') {
        const targetExt = (params.pbxExtension || params.sip || '100').trim();
        const shouldPlayIvr = params.playIvr !== false;
        const originFrom = shouldPlayIvr ? (params.scenarioId || '0').trim() : targetExt;

        console.log(`[ZADARMA DISPATCH] Calling PSTN recipient ${targetInternationalTo} first (Mode: ${shouldPlayIvr ? 'PBX IVR Menu ' + originFrom + ' -> DTMF 1 -> Ext ' + targetExt : 'Direct Ext ' + targetExt})...`);

        const callbackParams: Record<string, any> = {
          from: originFrom,
          to: targetInternationalTo,
          predicted: 'true',
        };
        if (cleanFrom) {
          callbackParams.caller_id = cleanFrom;
        }

        res = await this.requestApi(
          '/v1/request/callback/',
          callbackParams,
          { apiKey: params.apiKey, apiSecret: params.apiSecret },
          'GET'
        );

        // Fallback to primary SIP login 12707 if origin returned an error
        if (!res || res.status === 'error') {
          console.warn(`[ZADARMA DISPATCH] from=${originFrom} returned error (${res?.message}), trying secondary routing...`);
          const fallbackParams: Record<string, any> = {
            from: shouldPlayIvr ? '0-1' : '12707',
            to: targetInternationalTo,
            predicted: 'true',
          };
          if (cleanFrom) fallbackParams.caller_id = cleanFrom;
          res = await this.requestApi(
            '/v1/request/callback/',
            fallbackParams,
            { apiKey: params.apiKey, apiSecret: params.apiSecret },
            'GET'
          );
        }
      }

      if (res && (res.status === 'success' || res.status === 'ok')) {
        const pbxCallId = res.call_id || res.pbx_call_id || `zd_${Date.now()}`;
        return {
          success: true,
          callId: pbxCallId,
          message: res.message || `Call successfully placed to ${cleanTo} via Zadarma PSTN carrier network.`,
          raw: res,
        };
      }

      const errorMsg = res.message || JSON.stringify(res);
      return {
        success: false,
        message: errorMsg,
        error: errorMsg,
        raw: res,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Zadarma API call failed: ${err.message}`,
        error: err.message,
      };
    }
  }

  /**
   * Generates WebRTC SIP credentials for direct browser audio calling
   */
  public static async getWebRtcKey(config: { apiKey: string; apiSecret: string; sipLogin: string }): Promise<{
    success: boolean;
    key?: string;
    sip?: string;
    message?: string;
  }> {
    try {
      const res = await this.requestApi(
        '/v1/webrtc/get_key/',
        { sip: config.sipLogin },
        config,
        'GET'
      );
      if (res && res.status === 'success') {
        return {
          success: true,
          key: res.key,
          sip: config.sipLogin,
        };
      }
      return {
        success: false,
        message: res.message || 'Could not generate Zadarma WebRTC key.',
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message,
      };
    }
  }

  /**
   * Uploads an audio sound file (MP3 or WAV) directly to Zadarma Cloud PBX for IVR greetings
   */
  public static async uploadIvrSound(params: {
    apiKey: string;
    apiSecret: string;
    name: string;
    audioBuffer: Buffer;
    fileName?: string;
  }): Promise<{
    success: boolean;
    soundId?: string;
    soundName?: string;
    pbxId?: number;
    message?: string;
  }> {
    try {
      const cleanKey = params.apiKey.trim().replace(/^KEY_/, '');
      const cleanSecret = params.apiSecret.trim().replace(/^SEC_/, '');
      const cleanName = params.name.trim().replace(/[^a-zA-Z0-9_\-]/g, '_') || 'ivr_greeting';
      const cleanFileName = params.fileName || `${cleanName}.wav`;
      const mimeType = cleanFileName.endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav';

      const fileBlob = new Blob([new Uint8Array(params.audioBuffer)], { type: mimeType });
      const form = new FormData();
      form.append('name', cleanName);
      form.append('format', 'json');
      form.append('file', fileBlob, cleanFileName);

      const method = '/v1/pbx/ivr/sounds/upload/';
      const { signature } = this.generateSignature(method, { name: cleanName }, cleanSecret);
      const authHeader = `${cleanKey}:${signature}`;

      const res = await fetch(`https://api.zadarma.com${method}`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
        },
        body: form,
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.status === 'success' && data.sound) {
        return {
          success: true,
          soundId: data.sound.id,
          soundName: data.sound.name,
          pbxId: data.pbx_id,
          message: `Voice prompt uploaded to Zadarma Cloud PBX (Sound ID: ${data.sound.id})`,
        };
      }

      return {
        success: false,
        message: data.message || `Upload to Zadarma PBX failed (HTTP ${res.status})`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to upload sound to Zadarma PBX: ${err.message}`,
      };
    }
  }

  /**
   * Retrieves all uploaded IVR sound files currently stored in Zadarma PBX
   */
  public static async listIvrSounds(config: { apiKey: string; apiSecret: string }): Promise<{
    success: boolean;
    sounds: Array<{ id: string; name: string }>;
    pbxId?: number;
    message?: string;
  }> {
    try {
      const res = await this.requestApi('/v1/pbx/ivr/sounds/list/', {}, config, 'GET');
      if (res && res.status === 'success') {
        return {
          success: true,
          sounds: Array.isArray(res.sounds) ? res.sounds : [],
          pbxId: res.pbx_id,
        };
      }
      return {
        success: false,
        sounds: [],
        message: res?.message || 'Could not list Zadarma PBX sounds.',
      };
    } catch (err: any) {
      return {
        success: false,
        sounds: [],
        message: err.message,
      };
    }
  }
}
