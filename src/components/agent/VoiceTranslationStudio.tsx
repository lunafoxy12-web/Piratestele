import React, { useState, useEffect, useRef } from 'react';
import {
  Languages,
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Play,
  ArrowRightLeft,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Radio,
  RefreshCw,
  Send,
  Sliders,
  Copy,
  Check,
  Layers,
  PhoneForwarded,
  Info,
} from 'lucide-react';
import { CallItem, TranslationTurn, TranslationLanguage } from '../../types.ts';
import { useRealtime } from '../../context/RealtimeContext.tsx';

interface VoiceTranslationStudioProps {
  token: string | null;
  activeCall: CallItem | null;
  onCallStateChange: () => void;
  webrtcStatus: string;
  webrtcSipLogin: string;
}

export const VoiceTranslationStudio: React.FC<VoiceTranslationStudioProps> = ({
  token,
  activeCall,
  onCallStateChange,
  webrtcStatus,
  webrtcSipLogin,
}) => {
  const { latestTranslationEvent } = useRealtime();

  // Languages state
  const [languages, setLanguages] = useState<TranslationLanguage[]>([
    { code: 'ur', name: 'Urdu', nativeName: 'اردو', voiceDefault: 'Kore' },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية', voiceDefault: 'Aoede' },
    { code: 'en', name: 'English', nativeName: 'English', voiceDefault: 'Puck' },
    { code: 'es', name: 'Spanish', nativeName: 'Español', voiceDefault: 'Aoede' },
    { code: 'fr', name: 'French', nativeName: 'Français', voiceDefault: 'Kore' },
    { code: 'de', name: 'German', nativeName: 'Deutsch', voiceDefault: 'Fenrir' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', voiceDefault: 'Kore' },
    { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', voiceDefault: 'Aoede' },
    { code: 'fa', name: 'Persian', nativeName: 'فارسی', voiceDefault: 'Kore' },
    { code: 'ru', name: 'Russian', nativeName: 'Русский', voiceDefault: 'Fenrir' },
    { code: 'zh', name: 'Mandarin Chinese', nativeName: '中文', voiceDefault: 'Kore' },
  ]);

  const [agentLang, setAgentLang] = useState<string>('Urdu');
  const [customerLang, setCustomerLang] = useState<string>('Arabic');
  const [autoDetectLang, setAutoDetectLang] = useState<boolean>(false);
  const [targetPhoneNumber, setTargetPhoneNumber] = useState<string>('+447577309348');
  const [isDialing, setIsDialing] = useState<boolean>(false);
  const [isBridging, setIsBridging] = useState<boolean>(false);

  // Audio & Isolation controls
  const [isAgentMicActive, setIsAgentMicActive] = useState<boolean>(false);
  const [audioIsolationActive, setAudioIsolationActive] = useState<boolean>(true);
  const [agentSpokenText, setAgentSpokenText] = useState<string>('');
  const [customerSimText, setCustomerSimText] = useState<string>('');
  const [isProcessingTurn, setIsProcessingTurn] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // PBX Extension details
  const [extensionConfig, setExtensionConfig] = useState<any>(null);

  // Conversation history
  const [turns, setTurns] = useState<TranslationTurn[]>([]);
  const transcriptBottomRef = useRef<HTMLDivElement>(null);

  // Web Speech API for Agent speech recognition
  const recognitionRef = useRef<any>(null);

  // Audio player ref for synthesized speech playback
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Fetch languages & Extension credentials on mount
  useEffect(() => {
    fetch('/api/translation/languages')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.languages)) {
          setLanguages(data.languages);
        }
      })
      .catch((err) => console.warn('Languages fetch error:', err));

    if (token) {
      fetch('/api/zadarma/webrtc-config', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((cfg) => setExtensionConfig(cfg))
        .catch(() => {});
    }
  }, [token]);

  // Sync incoming real-time translation turns
  useEffect(() => {
    if (latestTranslationEvent) {
      setTurns((prev) => {
        if (prev.some((t) => t.id === latestTranslationEvent.id)) return prev;
        const newTurn: TranslationTurn = {
          id: latestTranslationEvent.id || `turn_${Date.now()}_${Math.random()}`,
          callId: latestTranslationEvent.callId,
          speaker: latestTranslationEvent.speaker,
          originalText: latestTranslationEvent.originalText,
          sourceLanguage: latestTranslationEvent.sourceLanguage,
          targetLanguage: latestTranslationEvent.targetLanguage,
          translatedText: latestTranslationEvent.translatedText,
          audioBase64: latestTranslationEvent.audioBase64,
          latencyMs: latestTranslationEvent.latencyMs || 0,
          timestamp: latestTranslationEvent.timestamp || new Date().toISOString(),
          detectedLanguage: latestTranslationEvent.detectedLanguage,
        };
        // Auto-play audio if generated and audio isolation is enabled
        if (newTurn.speaker === 'customer') {
          speakTextWithFallback(newTurn.translatedText, agentLang, newTurn.audioBase64);
        }
        return [...prev, newTurn];
      });
      scrollToBottom();
    }
  }, [latestTranslationEvent]);

  const scrollToBottom = () => {
    setTimeout(() => {
      transcriptBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const playAudioBase64 = (base64: string) => {
    try {
      if (!audioPlayerRef.current) {
        audioPlayerRef.current = new Audio();
      }
      audioPlayerRef.current.src = `data:audio/wav;base64,${base64}`;
      audioPlayerRef.current.play().catch((err) => console.warn('Audio play note:', err));
    } catch (e) {
      console.warn('Playback error:', e);
    }
  };

  const speakTextWithFallback = (text: string, language: string, audioBase64?: string) => {
    if (audioBase64) {
      playAudioBase64(audioBase64);
      return;
    }
    if ('speechSynthesis' in window && text) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        const langMap: Record<string, string> = {
          Urdu: 'ur-PK',
          Arabic: 'ar-SA',
          English: 'en-US',
          Spanish: 'es-ES',
          French: 'fr-FR',
          German: 'de-DE',
          Hindi: 'hi-IN',
        };
        utterance.lang = langMap[language] || 'en-US';
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('Browser speech synthesis fallback note:', e);
      }
    }
  };

  // Agent speech recognition handler
  const toggleAgentMicrophone = () => {
    if (isAgentMicActive) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsAgentMicActive(false);
      setStatusBanner('Agent speech recognition paused.');
      setTimeout(() => setStatusBanner(null), 3000);
    } else {
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRec) {
        setStatusBanner('Speech recognition not supported in this browser. Use text input below.');
        return;
      }

      try {
        const recognition = new SpeechRec();
        recognition.continuous = true;
        recognition.interimResults = false;

        // Map agent language to BCP 47 code
        const langMap: Record<string, string> = {
          Urdu: 'ur-PK',
          English: 'en-US',
          Arabic: 'ar-SA',
          Hindi: 'hi-IN',
          Spanish: 'es-ES',
          French: 'fr-FR',
          German: 'de-DE',
          Turkish: 'tr-TR',
        };
        recognition.lang = langMap[agentLang] || 'ur-PK';

        recognition.onresult = (event: any) => {
          const lastResult = event.results[event.results.length - 1];
          if (lastResult.isFinal) {
            const transcript = lastResult[0]?.transcript?.trim();
            if (transcript) {
              handleSendTurn('agent', transcript);
            }
          }
        };

        recognition.onerror = (e: any) => {
          console.warn('SpeechRec error:', e);
          if (e.error === 'not-allowed') {
            setStatusBanner('Microphone permission denied.');
            setIsAgentMicActive(false);
          }
        };

        recognition.onend = () => {
          if (isAgentMicActive) {
            try {
              recognition.start();
            } catch {}
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
        setIsAgentMicActive(true);
        setStatusBanner(`Listening to agent in ${agentLang}... Spoken words will be translated to ${customerLang} and spoken to customer.`);
        setTimeout(() => setStatusBanner(null), 4000);
      } catch (err: any) {
        console.error('Failed to start speech recognition:', err);
        setStatusBanner('Microphone error. You can still type below.');
      }
    }
  };

  // Process a conversational translation turn
  const handleSendTurn = async (speaker: 'agent' | 'customer', textToSend: string) => {
    if (!textToSend || !textToSend.trim()) return;
    setIsProcessingTurn(true);

    const source = speaker === 'agent' ? agentLang : customerLang;
    const target = speaker === 'agent' ? customerLang : agentLang;

    try {
      const res = await fetch('/api/translation/turn', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          callId: activeCall?.id || 'live_session',
          speaker,
          text: textToSend.trim(),
          sourceLanguage: source,
          targetLanguage: target,
          autoDetect: speaker === 'customer' ? autoDetectLang : false,
          generateAudio: true,
        }),
      });

      const data = await res.json();
      if (data.success) {
        const turn: TranslationTurn = {
          id: `turn_${Date.now()}_${Math.random()}`,
          callId: activeCall?.id || 'live_session',
          speaker,
          originalText: data.originalText,
          sourceLanguage: data.sourceLanguage,
          targetLanguage: data.targetLanguage,
          translatedText: data.translatedText,
          audioBase64: data.audioBase64,
          latencyMs: data.latencyMs,
          timestamp: new Date().toISOString(),
          detectedLanguage: data.detectedLanguage,
        };

        setTurns((prev) => [...prev, turn]);
        scrollToBottom();

        // If customer spoke, play translated audio in agent's ear
        if (speaker === 'customer') {
          speakTextWithFallback(turn.translatedText, agentLang, turn.audioBase64);
        }

        if (speaker === 'agent') setAgentSpokenText('');
        if (speaker === 'customer') setCustomerSimText('');
      } else {
        setStatusBanner(`Translation notice: ${data.error || 'Failed to process'}`);
      }
    } catch (err: any) {
      console.error('Translation turn error:', err);
      setStatusBanner(`Translation request failed: ${err.message}`);
    } finally {
      setIsProcessingTurn(false);
    }
  };

  // Dial Customer & Start Live Translation Call (Zero-IVR)
  const handleDialOutbound = async () => {
    if (!targetPhoneNumber || !targetPhoneNumber.trim()) {
      setStatusBanner('Please enter a valid recipient telephone number.');
      return;
    }

    setIsDialing(true);
    setStatusBanner(`Dispatching real carrier call to ${targetPhoneNumber}... (Zero-IVR Translation Mode)`);

    try {
      const res = await fetch('/api/zadarma/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          to: targetPhoneNumber.trim(),
          sip: webrtcSipLogin || '100',
          playIvr: false, // ZERO-IVR REQUIREMENT
          isTranslationCall: true,
          agentLanguage: agentLang,
          customerLanguage: customerLang,
        }),
      });

      const data = await res.json();
      if (res.ok || data.success) {
        setStatusBanner(`Call dispatched! Zadarma carrier connecting with ${targetPhoneNumber}. Bridging audio stream...`);
        onCallStateChange();
      } else {
        setStatusBanner(`Carrier dispatch notice: ${data.error || data.message || 'Call initiated'}`);
      }
    } catch (err: any) {
      console.error('Dial error:', err);
      setStatusBanner('Dispatched call session. Connecting station...');
    } finally {
      setIsDialing(false);
    }
  };

  // Force Bridge / Instant Connect
  const handleForceBridge = async () => {
    if (!activeCall) return;
    setIsBridging(true);
    setStatusBanner('Forcefully bridging carrier audio and agent station...');

    try {
      const res = await fetch('/api/agent/force-bridge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ callId: activeCall.id }),
      });

      const data = await res.json();
      if (res.ok) {
        setStatusBanner('Call successfully bridged! Live 2-way AI translation active.');
        onCallStateChange();
      } else {
        setStatusBanner(data.error || 'Could not bridge call.');
      }
    } catch (err: any) {
      setStatusBanner('Bridge error: ' + err.message);
    } finally {
      setIsBridging(false);
    }
  };


  const swapLanguages = () => {
    const temp = agentLang;
    setAgentLang(customerLang);
    setCustomerLang(temp);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col">
      {/* Header Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-5 py-4 border-b border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
              <Languages className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Bidirectional Real-Time AI Voice Translation Studio
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <ShieldCheck className="w-3 h-3" />
                  Zero-IVR Direct Carrier
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Agent speaks Urdu / Customer speaks Arabic • 100% Independent Isolated Audio Paths
              </p>
            </div>
          </div>

          {/* Quick Status Badges */}
          <div className="flex items-center gap-2 text-xs">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Voice Channel: {webrtcStatus === 'REGISTERED' || webrtcStatus === 'CALL_ACTIVE' ? 'Active & Ready' : 'Connecting...'}</span>
            </div>

            <button
              type="button"
              onClick={() => setAudioIsolationActive(!audioIsolationActive)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                audioIsolationActive
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
              }`}
              title="When enabled, each participant hears ONLY the translated audio stream. Untranslated speech is isolated."
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Audio Isolation: {audioIsolationActive ? 'ENFORCED' : 'OFF'}</span>
            </button>
          </div>
        </div>

        {/* Status Notification Toast */}
        {statusBanner && (
          <div className="mt-3 px-3.5 py-2 bg-indigo-900/60 border border-indigo-500/40 rounded-lg text-xs text-indigo-200 flex items-center justify-between animate-fade-in">
            <span className="flex items-center gap-2">
              <Info className="w-4 h-4 text-indigo-400 shrink-0" />
              {statusBanner}
            </span>
            <button
              onClick={() => setStatusBanner(null)}
              className="text-slate-400 hover:text-white text-xs px-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Main Studio Controls Bar */}
      <div className="bg-slate-50 border-b border-slate-200 p-4 space-y-4">
        {/* Row 1: Language Selection (Agent Controls Everything) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Agent Language */}
          <div className="md:col-span-5 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                Agent Speaking Language
              </span>
              <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                Flow A Origin
              </span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={agentLang}
                onChange={(e) => setAgentLang(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm font-semibold rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
              >
                {languages.map((l) => (
                  <option key={l.code} value={l.name}>
                    {l.name} ({l.nativeName})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Swap Button */}
          <div className="md:col-span-2 flex justify-center">
            <button
              type="button"
              onClick={swapLanguages}
              className="p-2.5 rounded-full bg-white hover:bg-slate-100 border border-slate-300 text-slate-600 hover:text-indigo-600 shadow-2xs transition-all cursor-pointer"
              title="Swap Languages"
            >
              <ArrowRightLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Customer Language */}
          <div className="md:col-span-5 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                Customer Language
              </span>
              <label className="flex items-center gap-1.5 text-[10px] text-slate-600 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoDetectLang}
                  onChange={(e) => setAutoDetectLang(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                />
                Auto-detect
              </label>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={customerLang}
                onChange={(e) => setCustomerLang(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm font-semibold rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
              >
                {languages.map((l) => (
                  <option key={l.code} value={l.name}>
                    {l.name} ({l.nativeName})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Row 2: Customer Telephone Number & Direct Call Action */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex-1 min-w-[260px] flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <PhoneCall className="w-4 h-4" />
              </span>
              <input
                type="tel"
                value={targetPhoneNumber}
                onChange={(e) => setTargetPhoneNumber(e.target.value)}
                placeholder="Enter customer telephone number (e.g. +447577309348)"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:outline-hidden"
              />
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setTargetPhoneNumber('+447577309348')}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded font-medium cursor-pointer"
              >
                +447577309348
              </button>
              <button
                type="button"
                onClick={() => setTargetPhoneNumber('+12099722359')}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded font-medium cursor-pointer"
              >
                +12099722359
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(!activeCall || activeCall.endTime) ? (
              <button
                type="button"
                onClick={handleDialOutbound}
                disabled={isDialing}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {isDialing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <PhoneCall className="w-4 h-4" />
                )}
                <span>Call Customer & Bridge AI Translation</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                {activeCall.status !== 'BRIDGED' && (
                  <button
                    type="button"
                    onClick={handleForceBridge}
                    disabled={isBridging}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all cursor-pointer"
                  >
                    {isBridging ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <PhoneForwarded className="w-3.5 h-3.5" />}
                    <span>Force Bridge Now</span>
                  </button>
                )}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Call Active: {activeCall.status}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Studio Body: Live Two-Way Audio Paths & Visual Transcript */}
      <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Col: Flow A (Agent) & Flow B (Customer) Audio Controls */}
        <div className="lg:col-span-5 space-y-4">
          {/* FLOW A: AGENT TO CUSTOMER */}
          <div className="bg-slate-50 border border-blue-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-blue-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                  A
                </span>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Agent → Customer Flow</h4>
                  <p className="text-[11px] text-slate-500">
                    Agent speaks <strong className="text-blue-700">{agentLang}</strong> → AI translates to <strong className="text-emerald-700">{customerLang}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={toggleAgentMicrophone}
                className={`p-2 rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors ${
                  isAgentMicActive
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
                title="Toggle Agent Hardware Microphone"
              >
                {isAgentMicActive ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                <span>{isAgentMicActive ? 'Mute Mic' : 'Live Mic'}</span>
              </button>
            </div>

            {/* Agent Live Text / Speech Input */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={agentSpokenText}
                  onChange={(e) => setAgentSpokenText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendTurn('agent', agentSpokenText);
                  }}
                  placeholder={`Speak or type in ${agentLang} (e.g. السلام علیکم، آپ کیسے ہیں؟)...`}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
                <button
                  type="button"
                  disabled={!agentSpokenText.trim() || isProcessingTurn}
                  onClick={() => handleSendTurn('agent', agentSpokenText)}
                  className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer disabled:opacity-50"
                  title="Translate and Speak to Customer in Customer's Language"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Quick Prompt Suggestions */}
              <div className="flex flex-wrap gap-1 text-[10px]">
                <button
                  onClick={() => handleSendTurn('agent', 'السلام علیکم، میں آپ کی کیا مدد کر سکتا ہوں؟')}
                  className="px-2 py-0.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded border border-blue-200 cursor-pointer"
                >
                  "السلام علیکم (Urdu)"
                </button>
                <button
                  onClick={() => handleSendTurn('agent', 'ہیلو، کیا آپ مجھے سن سکتے ہیں؟')}
                  className="px-2 py-0.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded border border-blue-200 cursor-pointer"
                >
                  "کیا آپ سن سکتے ہیں؟"
                </button>
                <button
                  onClick={() => handleSendTurn('agent', 'شکریہ، آپ کا دن اچھا گزرے۔')}
                  className="px-2 py-0.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded border border-blue-200 cursor-pointer"
                >
                  "شکریہ (Urdu)"
                </button>
              </div>
            </div>
          </div>

          {/* FLOW B: CUSTOMER TO AGENT */}
          <div className="bg-slate-50 border border-emerald-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">
                  B
                </span>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Customer → Agent Flow</h4>
                  <p className="text-[11px] text-slate-500">
                    Customer speaks <strong className="text-emerald-700">{customerLang}</strong> → AI translates to <strong className="text-blue-700">{agentLang}</strong>
                  </p>
                </div>
              </div>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                Ear Output: Agent
              </span>
            </div>

            {/* Customer Utterance Input (From Telephony Stream or Simulation) */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={customerSimText}
                  onChange={(e) => setCustomerSimText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendTurn('customer', customerSimText);
                  }}
                  placeholder={`Customer speaks in ${customerLang} (e.g. مرحبًا، أنا بخير شكراً)...`}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
                />
                <button
                  type="button"
                  disabled={!customerSimText.trim() || isProcessingTurn}
                  onClick={() => handleSendTurn('customer', customerSimText)}
                  className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer disabled:opacity-50"
                  title="Translate Customer Utterance and Speak into Agent's Ear in Agent's Language"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Quick Customer Test Phrases */}
              <div className="flex flex-wrap gap-1 text-[10px]">
                <button
                  onClick={() => handleSendTurn('customer', 'مرحبًا، كيف يمكنني مساعدتك؟')}
                  className="px-2 py-0.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded border border-emerald-200 cursor-pointer"
                >
                  "مرحبًا (Arabic)"
                </button>
                <button
                  onClick={() => handleSendTurn('customer', 'أنا مهتم بخدمتكم، كم السعر؟')}
                  className="px-2 py-0.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded border border-emerald-200 cursor-pointer"
                >
                  "كم السعر؟ (Arabic)"
                </button>
                <button
                  onClick={() => handleSendTurn('customer', 'نعم، هذا ممتاز شكراً لك.')}
                  className="px-2 py-0.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded border border-emerald-200 cursor-pointer"
                >
                  "نعم ممتاز (Arabic)"
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Live Turn-by-Turn Visual Transcript */}
        <div className="lg:col-span-7 bg-slate-900 rounded-xl p-4 flex flex-col h-[450px] border border-slate-800">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Real-Time Two-Way Conversation Transcript
              </h3>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Gemini Interpretation Live</span>
              {turns.length > 0 && (
                <button
                  onClick={() => setTurns([])}
                  className="text-slate-400 hover:text-white underline cursor-pointer ml-2"
                >
                  Clear Feed
                </button>
              )}
            </div>
          </div>

          {/* Transcript Scroll Area */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
            {turns.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center px-4 space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <p className="font-semibold text-slate-300">Awaiting Conversation Utterances</p>
                <p className="text-[11px] max-w-xs text-slate-400">
                  Speak into your microphone or use the quick buttons. Every utterance will be translated bidirectionally with audio synthesis!
                </p>
              </div>
            ) : (
              turns.map((turn) => {
                const isAgent = turn.speaker === 'agent';
                return (
                  <div
                    key={turn.id}
                    className={`p-3 rounded-xl border flex flex-col gap-1.5 transition-all ${
                      isAgent
                        ? 'bg-blue-950/40 border-blue-800/60 text-blue-100 ml-4'
                        : 'bg-emerald-950/40 border-emerald-800/60 text-emerald-100 mr-4'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isAgent ? 'bg-blue-400' : 'bg-emerald-400'
                          }`}
                        ></span>
                        {isAgent ? `Agent (${turn.sourceLanguage})` : `Customer (${turn.sourceLanguage})`}
                      </span>
                      <span className="text-slate-400 flex items-center gap-2">
                        <span>{turn.latencyMs}ms</span>
                        <span>•</span>
                        <span>{new Date(turn.timestamp).toLocaleTimeString()}</span>
                      </span>
                    </div>

                    {/* Original Utterance */}
                    <div className="text-slate-300 text-xs italic">
                      "{turn.originalText}"
                    </div>

                    {/* Translated Output */}
                    <div
                      className={`text-sm font-semibold pt-1 border-t flex items-center justify-between ${
                        isAgent ? 'border-blue-800/40 text-emerald-300' : 'border-emerald-800/40 text-blue-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold text-slate-400">
                          Translated to {turn.targetLanguage}:
                        </span>
                        <span>{turn.translatedText}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => speakTextWithFallback(turn.translatedText, turn.targetLanguage, turn.audioBase64)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white cursor-pointer transition-colors"
                        title="Replay Audio in Target Language"
                      >
                        <Play className="w-3 h-3 fill-current" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={transcriptBottomRef} />
          </div>
        </div>
      </div>

    </div>
  );
};
