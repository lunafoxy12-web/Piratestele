/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Server,
  Key,
  Globe,
  PhoneCall,
  CheckCircle2,
  AlertCircle,
  Activity,
  Radio,
  Lock,
  RefreshCw,
  Phone,
  ShieldCheck,
  Send,
  Zap,
  DollarSign,
  Copy,
  Check,
  Cpu,
  Layers,
} from 'lucide-react';

interface VoipProviderSettingsProps {
  token: string;
  onRefreshParent?: () => void;
}

export const VoipProviderSettings: React.FC<VoipProviderSettingsProps> = ({ token, onRefreshParent }) => {
  const [activeVoipTab, setActiveVoipTab] = useState<'zadarma' | 'signalwire' | 'twilio'>('zadarma');

  // ==========================================
  // ZADARMA STATE
  // ==========================================
  const [zdApiKey, setZdApiKey] = useState<string>('');
  const [zdApiSecret, setZdApiSecret] = useState<string>('');
  const [zdCallerId, setZdCallerId] = useState<string>('+18045930160');
  const [zdSipLogin, setZdSipLogin] = useState<string>('12707');
  const [zdPbxExtension, setZdPbxExtension] = useState<string>('');
  const [zdAvailableSips, setZdAvailableSips] = useState<Array<{ id: string; displayName?: string }>>([]);
  const [zdAvailableExtensions, setZdAvailableExtensions] = useState<Array<{ id: string; name?: string }>>([]);
  const [zdHasSecret, setZdHasSecret] = useState<boolean>(false);
  const [zdSecretMasked, setZdSecretMasked] = useState<string>('');
  const [zdHealthStatus, setZdHealthStatus] = useState<string>('UNCONFIGURED');
  const [zdBalance, setZdBalance] = useState<{ amount: number; currency: string } | null>(null);
  const [zdIsTesting, setZdIsTesting] = useState<boolean>(false);
  const [zdIsSaving, setZdIsSaving] = useState<boolean>(false);
  const [zdIsCalling, setZdIsCalling] = useState<boolean>(false);
  const [zdTestNumber, setZdTestNumber] = useState<string>('+12099722359');
  const [zdOperatorNumber, setZdOperatorNumber] = useState<string>('+18045930160');
  const [zdTestMode, setZdTestMode] = useState<'sip' | 'phone_to_phone'>('sip');
  const [zdTestResult, setZdTestResult] = useState<any>(null);
  const [zdWebrtcKey, setZdWebrtcKey] = useState<string>('');
  const [isGeneratingWebrtcKey, setIsGeneratingWebrtcKey] = useState<boolean>(false);
  const [zdIsConfirmingIp, setZdIsConfirmingIp] = useState<boolean>(false);
  const [zdConfirmIpResult, setZdConfirmIpResult] = useState<any>(null);

  // ==========================================
  // SIGNALWIRE STATE
  // ==========================================
  const [swSpace, setSwSpace] = useState<string>('101proposalsllc.signalwire.com');
  const [swProjectId, setSwProjectId] = useState<string>('f3aa4eda-0405-4c0d-a352-3fc7e748c016');
  const [swApiToken, setSwApiToken] = useState<string>('');
  const [swCallerId, setSwCallerId] = useState<string>('+12013615607');
  const [swHasToken, setSwHasToken] = useState<boolean>(false);
  const [swTokenMasked, setSwTokenMasked] = useState<string>('');
  const [swHealthStatus, setSwHealthStatus] = useState<string>('UNCONFIGURED');
  const [swIsPinging, setSwIsPinging] = useState<boolean>(false);
  const [swIsSaving, setSwIsSaving] = useState<boolean>(false);
  const [swIsCalling, setSwIsCalling] = useState<boolean>(false);
  const [swTestNumber, setSwTestNumber] = useState<string>('+447577309348');
  const [swPingResult, setSwPingResult] = useState<any>(null);

  // ==========================================
  // TWILIO STATE
  // ==========================================
  const [twAccountSid, setTwAccountSid] = useState<string>('');
  const [twAuthToken, setTwAuthToken] = useState<string>('');
  const [twCallerId, setTwCallerId] = useState<string>('');
  const [twHealthStatus, setTwHealthStatus] = useState<string>('UNCONFIGURED');
  const [twIsTesting, setTwIsTesting] = useState<boolean>(false);
  const [twIsSaving, setTwIsSaving] = useState<boolean>(false);

  // Notifications
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState<boolean>(false);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 6000);
  };

  const webhookBaseUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/zadarma/webhook` : '/api/zadarma/webhook';

  // 1. Fetch Zadarma Settings
  const fetchZadarmaSettings = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/zadarma/config', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.configured) {
          if (data.apiKeyMasked) setZdApiKey(data.apiKeyMasked);
          setZdHasSecret(data.hasSecret);
          setZdSecretMasked(data.apiSecretMasked || '');
          if (data.defaultCallerId) setZdCallerId(data.defaultCallerId);
          if (data.sipLogin) setZdSipLogin(data.sipLogin);
          if (data.pbxExtension) setZdPbxExtension(data.pbxExtension);
          setZdHealthStatus(data.healthStatus || 'HEALTHY');

          // Query live balance, SIP accounts, and extensions
          fetchZadarmaBalance();
          fetchZadarmaSips();
          fetchZadarmaExtensions();
        }
      }
    } catch (err) {
      console.error('Failed to load Zadarma settings:', err);
    }
  };

  const fetchZadarmaSips = async () => {
    try {
      const res = await fetch('/api/zadarma/sip-logins', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.sips)) {
          setZdAvailableSips(data.sips);
        }
      }
    } catch {}
  };

  const fetchZadarmaExtensions = async () => {
    try {
      const res = await fetch('/api/zadarma/extensions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.extensions)) {
          setZdAvailableExtensions(data.extensions);
        }
      }
    } catch {}
  };

  const fetchZadarmaBalance = async () => {
    try {
      const res = await fetch('/api/zadarma/balance', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.balance !== undefined) {
          setZdBalance({ amount: data.balance, currency: data.currency || 'USD' });
        }
      }
    } catch {}
  };

  // 2. Fetch SignalWire Settings
  const fetchSignalWireSettings = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/signalwire/settings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.configured) {
          if (data.space) setSwSpace(data.space);
          if (data.projectId) setSwProjectId(data.projectId);
          if (data.primaryCallerId) setSwCallerId(data.primaryCallerId);
          setSwHasToken(data.hasToken);
          setSwTokenMasked(data.apiTokenMasked || '');
          setSwHealthStatus(data.healthStatus || 'HEALTHY');
        }
      }
    } catch (err) {
      console.error('Failed to load SignalWire settings:', err);
    }
  };

  useEffect(() => {
    fetchZadarmaSettings();
    fetchSignalWireSettings();
  }, [token]);

  // ==========================================
  // ZADARMA HANDLERS
  // ==========================================
  const handleTestZadarmaConnection = async () => {
    if (!token) return;
    setZdIsTesting(true);
    setZdTestResult(null);

    try {
      const res = await fetch('/api/zadarma/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          apiKey: zdApiKey.includes('...') ? undefined : zdApiKey.trim(),
          apiSecret: zdApiSecret ? zdApiSecret.trim() : undefined,
        }),
      });

      const data = await res.json();
      setZdTestResult(data);

      if (res.ok && data.success) {
        showToast('success', data.message);
        setZdHealthStatus('HEALTHY');
        if (data.balance !== undefined) {
          setZdBalance({ amount: data.balance, currency: data.currency || 'USD' });
        }
        if (data.defaultCallerId && !zdCallerId) {
          setZdCallerId(data.defaultCallerId);
        }
        if (data.sips && Array.isArray(data.sips)) {
          setZdAvailableSips(data.sips);
        }
        if (data.extensions && Array.isArray(data.extensions)) {
          setZdAvailableExtensions(data.extensions);
        }
      } else {
        showToast('error', data.error || 'Zadarma authentication failed.');
      }
    } catch (err: any) {
      showToast('error', `Zadarma test failed: ${err.message}`);
    } finally {
      setZdIsTesting(false);
    }
  };

  const handleSaveZadarmaSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!zdApiKey.trim()) {
      showToast('error', 'Zadarma API Key is required.');
      return;
    }

    if (!zdApiSecret && !zdHasSecret) {
      showToast('error', 'Zadarma API Secret is required.');
      return;
    }

    setZdIsSaving(true);
    try {
      const res = await fetch('/api/zadarma/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: 'Zadarma Cloud PBX PSTN',
          apiKey: zdApiKey.includes('...') ? undefined : zdApiKey.trim(),
          apiSecret: zdApiSecret.trim() || undefined,
          defaultCallerId: zdCallerId.trim(),
          sipLogin: zdSipLogin.trim(),
          pbxExtension: zdPbxExtension.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast('success', data.message);
        setZdHasSecret(true);
        setZdApiSecret('');
        fetchZadarmaSettings();
        if (onRefreshParent) onRefreshParent();
      } else {
        showToast('error', data.error || 'Failed to save Zadarma credentials.');
      }
    } catch (err: any) {
      showToast('error', `Save error: ${err.message}`);
    } finally {
      setZdIsSaving(false);
    }
  };

  const handleZadarmaTestCall = async () => {
    if (!token || !zdTestNumber.trim()) {
      showToast('error', 'Please enter a valid destination phone number.');
      return;
    }

    if (zdTestMode === 'phone_to_phone' && !zdOperatorNumber.trim()) {
      showToast('error', 'Please enter your Operator / Agent phone number for phone-to-phone mode.');
      return;
    }

    setZdIsCalling(true);
    try {
      const res = await fetch('/api/zadarma/test-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          toPhoneNumber: zdTestNumber.trim(),
          callerId: zdCallerId.trim() || undefined,
          mode: zdTestMode,
          operatorPhoneNumber: zdTestMode === 'phone_to_phone' ? zdOperatorNumber.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast('success', data.message);
      } else {
        showToast('error', data.error || 'Zadarma test call failed.');
      }
    } catch (err: any) {
      showToast('error', `Test call error: ${err.message}`);
    } finally {
      setZdIsCalling(false);
    }
  };

  const handleGenerateWebrtcKey = async () => {
    if (!token) return;
    setIsGeneratingWebrtcKey(true);
    try {
      const res = await fetch('/api/zadarma/webrtc-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sipLogin: zdSipLogin.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setZdWebrtcKey(data.key);
        showToast('success', 'Zadarma WebRTC Key successfully generated from your account!');
      } else {
        showToast('error', data.error || 'Failed to generate WebRTC Key.');
      }
    } catch (err: any) {
      showToast('error', `WebRTC key generation error: ${err.message}`);
    } finally {
      setIsGeneratingWebrtcKey(false);
    }
  };

  const handleConfirmServerIp = async () => {
    if (!token) return;
    setZdIsConfirmingIp(true);
    setZdConfirmIpResult(null);
    try {
      const res = await fetch('/api/zadarma/confirm-ip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setZdConfirmIpResult(data);
        showToast('success', `Call routed to 8888 on sip.zadarma.com! Server IP: ${data.serverIp}`);
      } else {
        showToast('error', data.error || 'Failed to call 8888.');
      }
    } catch (err: any) {
      showToast('error', `Confirmation error: ${err.message}`);
    } finally {
      setZdIsConfirmingIp(false);
    }
  };

  // ==========================================
  // SIGNALWIRE HANDLERS
  // ==========================================
  const handlePingSignalWire = async () => {
    if (!token) return;
    setSwIsPinging(true);
    setSwPingResult(null);

    try {
      const res = await fetch('/api/signalwire/ping', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          space: swSpace,
          projectId: swProjectId,
          apiToken: swApiToken || undefined,
        }),
      });

      const data = await res.json();
      setSwPingResult(data);

      if (res.ok && data.success) {
        showToast('success', `SignalWire Ping Success (${data.latencyMs}ms)! Connection verified.`);
        setSwHealthStatus('HEALTHY');
      } else {
        showToast('error', data.error || 'SignalWire ping failed.');
      }
    } catch (err: any) {
      showToast('error', `Ping network failure: ${err.message}`);
    } finally {
      setSwIsPinging(false);
    }
  };

  const handleSaveSignalWire = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setSwIsSaving(true);
    try {
      const res = await fetch('/api/signalwire/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: 'SignalWire Cloud PSTN Trunk',
          space: swSpace.trim(),
          projectId: swProjectId.trim(),
          apiToken: swApiToken.trim() || undefined,
          primaryCallerId: swCallerId.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast('success', data.message);
        setSwHasToken(true);
        setSwApiToken('');
        fetchSignalWireSettings();
        if (onRefreshParent) onRefreshParent();
      } else {
        showToast('error', data.error || 'Failed to save SignalWire settings.');
      }
    } catch (err: any) {
      showToast('error', `Save error: ${err.message}`);
    } finally {
      setSwIsSaving(false);
    }
  };

  const handleSignalWireTestCall = async () => {
    if (!token || !swTestNumber.trim()) {
      showToast('error', 'Please enter a valid destination phone number.');
      return;
    }

    setSwIsCalling(true);
    try {
      const res = await fetch('/api/signalwire/test-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          toPhoneNumber: swTestNumber.trim(),
          greetingText: 'SignalWire direct audio test call.',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast('success', data.message);
      } else {
        showToast('error', data.error || 'Test call failed.');
      }
    } catch (err: any) {
      showToast('error', `Test call failure: ${err.message}`);
    } finally {
      setSwIsCalling(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 3000);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
      {/* Header with Provider Tabs */}
      <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <Radio className="w-5 h-5 text-indigo-400 animate-pulse" />
              <h3 className="text-lg font-bold">VoIP Carrier Gateways & PSTN Trunks</h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                REAL PSTN ACTIVE
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Separated provider routes. Outbound dialing connects to real physical phone receivers worldwide.
            </p>
          </div>

          {/* Provider Selector Tabs */}
          <div className="flex items-center bg-slate-800/80 p-1 rounded-lg border border-slate-700">
            <button
              type="button"
              onClick={() => setActiveVoipTab('zadarma')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeVoipTab === 'zadarma'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              Zadarma API & PBX
            </button>
            <button
              type="button"
              onClick={() => setActiveVoipTab('signalwire')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeVoipTab === 'signalwire'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              SignalWire Trunk
            </button>
            <button
              type="button"
              onClick={() => setActiveVoipTab('twilio')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeVoipTab === 'twilio'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              Twilio Voice
            </button>
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`p-3.5 text-xs flex items-center gap-2 border-b ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : notification.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-blue-50 text-blue-800 border-blue-200'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. ZADARMA TAB                                           */}
      {/* ======================================================== */}
      {activeVoipTab === 'zadarma' && (
        <div className="p-6 space-y-6">
          {/* Top Quick Status & Balance Bar */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-slate-900">Zadarma Cloud PBX & Callback API</h4>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      zdHealthStatus === 'HEALTHY'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}
                  >
                    {zdHealthStatus}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Global PSTN termination. Supports DTMF callback notifications, caller IDs, and WebRTC audio bridging.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {zdBalance !== null ? (
                <div className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-right shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Zadarma Balance</span>
                  <span className="text-sm font-extrabold text-emerald-600">
                    {zdBalance.amount.toFixed(2)} {zdBalance.currency}
                  </span>
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleTestZadarmaConnection}
                disabled={zdIsTesting}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50"
              >
                <Activity className={`w-3.5 h-3.5 ${zdIsTesting ? 'animate-spin' : ''}`} />
                {zdIsTesting ? 'Testing Connection...' : 'Test Connection & Balance'}
              </button>
            </div>
          </div>

          {/* Zadarma WebRTC Direct Softphone Gateway Card */}
          <div className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white rounded-xl p-5 space-y-4 shadow-sm border border-blue-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300 font-bold">
                  <Zap className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h5 className="font-bold text-sm text-white">Zadarma WebRTC Direct Gateway Mode</h5>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">
                      NO WEBHOOK NEEDED
                    </span>
                  </div>
                  <p className="text-xs text-blue-200 mt-0.5">
                    Connects human agents directly to Zadarma's WebRTC SIP Gateway with real bidirectional audio.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGenerateWebrtcKey}
                disabled={isGeneratingWebrtcKey || !zdApiKey}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50"
              >
                <Key className={`w-3.5 h-3.5 ${isGeneratingWebrtcKey ? 'animate-spin' : ''}`} />
                {isGeneratingWebrtcKey ? 'Generating Key...' : 'Generate WebRTC Key from API'}
              </button>
            </div>

            {/* Explanation of where WebRTC is found in Zadarma */}
            <div className="bg-blue-950/60 border border-blue-800/80 rounded-lg p-3 text-xs text-blue-100 space-y-1.5">
              <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                Where to find your WebRTC credentials in Zadarma:
              </div>
              <p className="text-[11px] leading-relaxed text-blue-200">
                1. In your Zadarma Dashboard, open <strong>Settings &rarr; SIP Connection</strong> and look for <strong>WebRTC</strong> (or <strong>WebRTC widget / WebRTC key</strong>).<br />
                2. Copy your <strong>SIP Login</strong> (e.g. <code className="bg-blue-900 px-1 rounded font-mono">101</code> or 6-digit SIP) and your <strong>WebRTC Key / Password</strong>.<br />
                3. With WebRTC, your human agent hears the receiver and speaks through their microphone directly in the browser terminal. <strong>You do not need to configure webhooks</strong> when using Zadarma's WebRTC PBX extension!
              </p>
            </div>

            {/* WebRTC Gateway Info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-blue-900/60">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">SIP Server</span>
                <span className="font-mono text-emerald-300 font-semibold text-xs">sip.zadarma.com</span>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-blue-900/60">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">WebRTC Gateway</span>
                <span className="font-mono text-cyan-300 font-semibold text-xs">wss://webrtc.zadarma.com:5061</span>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-blue-900/60">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">WebRTC Token Status</span>
                <span className="font-mono text-amber-300 font-semibold text-xs">
                  {zdWebrtcKey ? 'Active Key Loaded' : 'Ready (Use SIP Login or API Key)'}
                </span>
              </div>
            </div>
          </div>

          {/* Zadarma Settings Form */}
          <form onSubmit={handleSaveZadarmaSettings} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  SIP Login (Primary Outbound Trunk)
                </label>
                <div className="relative">
                  <Cpu className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  {zdAvailableSips.length > 0 ? (
                    <div className="flex gap-2">
                      <select
                        value={zdSipLogin || ''}
                        onChange={(e) => setZdSipLogin(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono bg-white"
                      >
                        {zdAvailableSips.map((sip) => (
                          <option key={sip.id} value={sip.id}>
                            SIP {sip.id} {sip.displayName && sip.displayName !== 'SIP' ? `(${sip.displayName})` : ''}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={zdSipLogin || ''}
                        onChange={(e) => setZdSipLogin(e.target.value)}
                        placeholder="e.g. 12707"
                        className="w-28 px-2 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                        title="Custom SIP login"
                      />
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={zdSipLogin || ''}
                      onChange={(e) => setZdSipLogin(e.target.value)}
                      placeholder="e.g. 12707"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                    />
                  )}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Your Zadarma SIP account (e.g. <strong>12707</strong>). Found under <strong>Settings &rarr; SIP Connection</strong>.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  PBX Extension &mdash; <span className="text-amber-600 font-normal">Optional (Leave blank if no PBX)</span>
                </label>
                <div className="relative">
                  <Radio className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={zdPbxExtension || ''}
                    onChange={(e) => setZdPbxExtension(e.target.value)}
                    placeholder="Leave empty for Standard SIP (avoids Wrong PBX error)"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  <strong>Important:</strong> Leave this <em>empty</em> if you don't have Zadarma Cloud PBX extensions enabled. Entering an unconfigured PBX extension causes the <em>"Wrong PBX number"</em> error.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Default Outbound Caller ID (E.164)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={zdCallerId || ''}
                    onChange={(e) => setZdCallerId(e.target.value)}
                    placeholder="+18045930160"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Your purchased / verified Zadarma number displayed to receivers.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Zadarma API Key (User Key)
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={zdApiKey || ''}
                    onChange={(e) => setZdApiKey(e.target.value)}
                    placeholder="e.g. 8e14fc968ca07b1d53c9"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Found under Zadarma &rarr; Settings &rarr; API and Integrations.</p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Zadarma API Secret / WebRTC Secret {zdHasSecret && <span className="text-emerald-600 font-normal">(Stored)</span>}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    value={zdApiSecret || ''}
                    onChange={(e) => setZdApiSecret(e.target.value)}
                    placeholder={zdHasSecret ? zdSecretMasked : 'Enter API secret or WebRTC key'}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">API secret from Zadarma API page or WebRTC key.</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500">Route: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">/api/zadarma/*</code></span>
              <button
                type="submit"
                disabled={zdIsSaving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                {zdIsSaving ? 'Saving & Verifying...' : 'Save Zadarma Configuration'}
              </button>
            </div>
          </form>

          {/* Zero-Webhook Direct WebRTC Calling Mode */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-2.5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <h5 className="text-xs font-bold text-emerald-950">
                100% WebRTC Direct Mode &mdash; No Webhook Setting Needed in Zadarma
              </h5>
            </div>
            <p className="text-xs text-emerald-900 leading-relaxed">
              You do <strong>not</strong> need to find or configure any webhook page on the Zadarma website. Standard Zadarma accounts use <strong>WebRTC</strong> for browser calling, which connects directly without webhooks.
            </p>
            <div className="bg-white/80 p-3 rounded-lg border border-emerald-200 text-xs text-slate-700 space-y-1.5">
              <span className="font-semibold text-slate-900 block">How to connect with the WebRTC option in your Zadarma account:</span>
              <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px] leading-relaxed">
                <li>In your Zadarma Dashboard, navigate to <strong>Settings &rarr; SIP Connection &rarr; WebRTC</strong></li>
                <li>Copy your <strong>SIP Login</strong> (e.g. extension number or SIP ID) and your <strong>WebRTC Key / Password</strong></li>
                <li>Enter them into the fields above and click <strong>Save Zadarma Configuration</strong></li>
                <li>When calls are placed or transferred after DTMF keypress, audio streams directly between your browser microphone/speaker and Zadarma's WebRTC SIP gateway (<code className="font-mono text-blue-700">wss://webrtc.zadarma.com:5061</code>)</li>
              </ul>
            </div>
          </div>

          {/* SIP Trunk IP Authorization (Call 8888 on sip.zadarma.com) */}
          <div className="border border-blue-200 rounded-lg p-4 bg-blue-50/50 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h5 className="text-xs font-bold text-blue-950 flex items-center gap-2">
                  <Radio className="w-4 h-4 text-blue-700" />
                  SIP Trunk IP Authorization &amp; Verification (Call 8888)
                </h5>
                <p className="text-xs text-blue-900 leading-relaxed">
                  When setting up a SIP trunk in Zadarma with <strong>Authorization by IP</strong> (Settings &rarr; SIP Connection &rarr; SIP Trunk), Zadarma requires routing a call to <strong>8888</strong> on <code className="font-mono bg-blue-100 px-1 py-0.5 rounded text-blue-900">sip.zadarma.com</code> from your server's public IP address to confirm and activate IP-based trunking.
                </p>
              </div>
              <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                <Server className="w-3.5 h-3.5" />
                Server IP: 34.96.48.82
              </span>
            </div>

            <div className="bg-white p-3 rounded-lg border border-blue-100 text-xs text-slate-700 space-y-2">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <span className="font-semibold text-slate-900 block text-xs">Destination:</span>
                  <code className="text-[11px] font-mono text-slate-600">sip:8888@sip.zadarma.com:5060 (UDP)</code>
                </div>
                <button
                  type="button"
                  onClick={handleConfirmServerIp}
                  disabled={zdIsConfirmingIp}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50"
                >
                  <PhoneCall className={`w-4 h-4 ${zdIsConfirmingIp ? 'animate-spin' : ''}`} />
                  {zdIsConfirmingIp ? 'Dispatching Call to 8888...' : 'Make Call to 8888 to Confirm IP'}
                </button>
              </div>

              {zdConfirmIpResult && (
                <div className={`mt-2 p-3 rounded-md text-xs border ${zdConfirmIpResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
                  <div className="flex items-center gap-2 font-semibold mb-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Call to 8888 Dispatched Successfully!</span>
                  </div>
                  <p className="text-[11px] leading-relaxed mb-2">{zdConfirmIpResult.message}</p>
                  <div className="text-[10px] font-mono bg-white/70 p-2 rounded border border-emerald-200 space-y-0.5">
                    <div><strong>Server Source IP:</strong> {zdConfirmIpResult.serverIp}</div>
                    <div><strong>Gateway Status:</strong> {zdConfirmIpResult.sipResponse}</div>
                    <div><strong>SIP Target:</strong> {zdConfirmIpResult.destination}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Live Real PSTN Dialing Test */}
          <div className="border border-slate-200 rounded-lg p-5 bg-slate-50 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h5 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <Send className="w-4 h-4 text-blue-700" />
                Live PSTN Call Test (Dial PSTN Number via Zadarma)
              </h5>
              <span className="text-[10px] font-mono bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full border border-blue-200 self-start sm:self-auto font-semibold">
                SIP Trunk: {zdSipLogin || '12707'} {zdPbxExtension ? `(PBX Ext: ${zdPbxExtension})` : '(Direct SIP Mode)'}
              </span>
            </div>

            {/* Explanation of "Please wait for connection" */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-950">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Hearing &ldquo;Please wait for connection&rdquo; on your phone?</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-800">
                That means your phone successfully received the call! Zadarma callback connects <strong>two sides</strong>: your destination phone and your Zadarma SIP account (<strong>{zdSipLogin || '12707'}</strong>). Zadarma says <em>&ldquo;Please wait for connection&rdquo;</em> while waiting for the agent or station on SIP {zdSipLogin || '12707'}.
              </p>
              <div className="pt-1 flex flex-wrap items-center gap-3 text-[11px] font-medium text-amber-900">
                <span>&bull; To speak via SIP: Connect WebRTC browser audio or SIP client with SIP ID <strong>{zdSipLogin || '12707'}</strong></span>
                <span>&bull; Or select <strong>Phone-to-Phone Mode</strong> below to bridge two physical phones directly!</span>
              </div>
            </div>

            {/* Test Mode Selector */}
            <div className="flex gap-2 p-1 bg-slate-200/70 rounded-lg text-xs font-medium w-fit">
              <button
                type="button"
                onClick={() => setZdTestMode('sip')}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  zdTestMode === 'sip'
                    ? 'bg-white text-blue-800 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                1. SIP Trunk Mode (Phone &rarr; SIP {zdSipLogin || '12707'})
              </button>
              <button
                type="button"
                onClick={() => setZdTestMode('phone_to_phone')}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  zdTestMode === 'phone_to_phone'
                    ? 'bg-white text-blue-800 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                2. Phone-to-Phone Mode (Bridge 2 Physical Phones)
              </button>
            </div>

            {zdTestMode === 'sip' ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-600">
                  Enter any mobile or landline phone number (e.g. <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono">+12099722359</code> or <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono">+447577309348</code>). Zadarma will ring that number and connect to your SIP trunk <strong>{zdSipLogin || '12707'}</strong>.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={zdTestNumber || ''}
                    onChange={(e) => setZdTestNumber(e.target.value)}
                    placeholder="Destination Phone (e.g. +12099722359)"
                    className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleZadarmaTestCall}
                    disabled={zdIsCalling}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50"
                  >
                    <PhoneCall className={`w-4 h-4 ${zdIsCalling ? 'animate-bounce' : ''}`} />
                    {zdIsCalling ? 'Dialing Physical Phone...' : 'Dial Real Phone via Zadarma'}
                  </button>
                </div>

                {/* Softphone Credentials helper */}
                <div className="bg-white border border-slate-200 rounded-lg p-3 text-[11px] space-y-1.5">
                  <span className="font-semibold text-slate-800 block">How to answer incoming test calls on your PC/Phone:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[10px] text-slate-700 bg-slate-50 p-2 rounded">
                    <div><strong>SIP Server:</strong> sip.zadarma.com</div>
                    <div><strong>SIP Login:</strong> {zdSipLogin || '12707'}</div>
                    <div><strong>Port/Protocol:</strong> 5060 (UDP)</div>
                  </div>
                  <p className="text-slate-500 text-[10px]">
                    Enter these in Zoiper, MicroSIP, or the official Zadarma Mobile App with your SIP password from your Zadarma dashboard.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 bg-white p-3.5 rounded-lg border border-slate-200">
                <p className="text-xs text-slate-700">
                  <strong>Phone-to-Phone Bridge:</strong> Zadarma will place calls to <em>both real physical phones</em> simultaneously and connect you to talk directly. No softphone or SIP app required!
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Your Phone (Operator / Agent Phone)
                    </label>
                    <input
                      type="text"
                      value={zdOperatorNumber || ''}
                      onChange={(e) => setZdOperatorNumber(e.target.value)}
                      placeholder="+1... (Your personal mobile)"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono bg-white"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">This phone will ring first or simultaneously.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Customer Phone (Destination)
                    </label>
                    <input
                      type="text"
                      value={zdTestNumber || ''}
                      onChange={(e) => setZdTestNumber(e.target.value)}
                      placeholder="+1... or +44... (Recipient mobile)"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono bg-white"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">The phone you want to call.</p>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleZadarmaTestCall}
                    disabled={zdIsCalling}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50"
                  >
                    <PhoneCall className={`w-4 h-4 ${zdIsCalling ? 'animate-bounce' : ''}`} />
                    {zdIsCalling ? 'Initiating Phone-to-Phone Call...' : 'Bridge Both Physical Phones'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. SIGNALWIRE TAB                                        */}
      {/* ======================================================== */}
      {activeVoipTab === 'signalwire' && (
        <div className="p-6 space-y-6">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-slate-900">SignalWire Cloud PSTN Trunk</h4>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      swHealthStatus === 'HEALTHY'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}
                  >
                    {swHealthStatus}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Dedicated LAML / REST carrier gateway for North American and authorized international numbers.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handlePingSignalWire}
              disabled={swIsPinging}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50"
            >
              <Activity className={`w-3.5 h-3.5 ${swIsPinging ? 'animate-spin' : ''}`} />
              {swIsPinging ? 'Pinging SignalWire...' : 'Ping & Verify Status'}
            </button>
          </div>

          <form onSubmit={handleSaveSignalWire} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Space Domain
                </label>
                <input
                  type="text"
                  value={swSpace || ''}
                  onChange={(e) => setSwSpace(e.target.value)}
                  placeholder="e.g. 101proposalsllc.signalwire.com"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Project ID
                </label>
                <input
                  type="text"
                  value={swProjectId || ''}
                  onChange={(e) => setSwProjectId(e.target.value)}
                  placeholder="e.g. f3aa4eda-0405-..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  API Token {swHasToken && <span className="text-emerald-600 font-normal">(Stored)</span>}
                </label>
                <input
                  type="password"
                  value={swApiToken || ''}
                  onChange={(e) => setSwApiToken(e.target.value)}
                  placeholder={swHasToken ? swTokenMasked : 'Enter API token'}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Primary Caller ID
                </label>
                <input
                  type="text"
                  value={swCallerId || ''}
                  onChange={(e) => setSwCallerId(e.target.value)}
                  placeholder="+12013615607"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500">Route: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">/api/signalwire/*</code></span>
              <button
                type="submit"
                disabled={swIsSaving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                {swIsSaving ? 'Saving...' : 'Save SignalWire Settings'}
              </button>
            </div>
          </form>

          {/* Test Call */}
          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-3">
            <h5 className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <Send className="w-4 h-4 text-indigo-700" />
              SignalWire PSTN Test Call
            </h5>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={swTestNumber || ''}
                onChange={(e) => setSwTestNumber(e.target.value)}
                placeholder="+1... or +44..."
                className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono bg-white"
              />
              <button
                type="button"
                onClick={handleSignalWireTestCall}
                disabled={swIsCalling}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50"
              >
                <PhoneCall className={`w-4 h-4 ${swIsCalling ? 'animate-bounce' : ''}`} />
                {swIsCalling ? 'Dialing...' : 'Dial via SignalWire'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. TWILIO TAB                                            */}
      {/* ======================================================== */}
      {activeVoipTab === 'twilio' && (
        <div className="p-6 space-y-6">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-700 font-bold">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900">Twilio Voice API Route</h4>
                <p className="text-xs text-slate-500">
                  Separated Twilio Voice endpoint with dedicated TwiML, status callback, and DTMF handling.
                </p>
              </div>
            </div>
            <span className="text-xs text-slate-500">Route: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">/api/twilio/*</code></span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Account SID
              </label>
              <input
                type="text"
                value={twAccountSid || ''}
                onChange={(e) => setTwAccountSid(e.target.value)}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Auth Token
              </label>
              <input
                type="password"
                value={twAuthToken || ''}
                onChange={(e) => setTwAuthToken(e.target.value)}
                placeholder="Enter Twilio Auth Token"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-100 rounded-lg text-xs text-slate-600 flex items-center justify-between">
            <span>Twilio Status Webhook: <code className="font-mono">{typeof window !== 'undefined' ? `${window.location.origin}/api/twilio/call-status` : '/api/twilio/call-status'}</code></span>
            <span>Twilio DTMF Webhook: <code className="font-mono">{typeof window !== 'undefined' ? `${window.location.origin}/api/twilio/dtmf` : '/api/twilio/dtmf'}</code></span>
          </div>
        </div>
      )}
    </div>
  );
};
