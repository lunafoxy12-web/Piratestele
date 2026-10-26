import React, { useState, useEffect, useRef } from 'react';
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Volume2,
  VolumeX,
  Radio,
  Sparkles,
  Headphones,
  RotateCcw,
  Minimize2,
  Maximize2,
  CheckCircle,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { useRealtime } from '../../context/RealtimeContext.tsx';

interface PstnReceiverProps {
  defaultOpen?: boolean;
}

export const PstnReceiverSoftphone: React.FC<PstnReceiverProps> = ({ defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState<boolean>(defaultOpen);
  const [activeCall, setActiveCall] = useState<any | null>(null);
  const [ivrConfig, setIvrConfig] = useState<any | null>(null);
  const [campaign, setCampaign] = useState<any | null>(null);
  const [isAnswering, setIsAnswering] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [dtmfStatus, setDtmfStatus] = useState<string | null>(null);
  const [autoAnswerReceiver, setAutoAnswerReceiver] = useState<boolean>(true);
  const [handsetSeconds, setHandsetSeconds] = useState<number>(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ringAudioCtxRef = useRef<AudioContext | null>(null);
  const ringOscillatorIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const speechUttRef = useRef<SpeechSynthesisUtterance | null>(null);
  const callDurationTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { latestAgentEvent, triggerRefresh } = useRealtime();

  // Play phone ringing sound for incoming handset calls
  const playHandsetRingTone = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = ringAudioCtxRef.current || new AudioCtx();
      ringAudioCtxRef.current = ctx;
      if (ctx.state === 'suspended') ctx.resume();

      const pulseRing = () => {
        if (!ringAudioCtxRef.current) return;
        const now = ctx.currentTime;
        // North American Ringback: 440 Hz + 480 Hz
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(440, now);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(480, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
        gain.gain.setValueAtTime(0.2, now + 1.2);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc1.stop(now + 1.5);
        osc2.start(now);
        osc2.stop(now + 1.5);
      };

      pulseRing();
      if (!ringOscillatorIntervalRef.current) {
        ringOscillatorIntervalRef.current = setInterval(pulseRing, 3500);
      }
    } catch (e) {
      console.warn('Handset ring audio error:', e);
    }
  };

  const stopHandsetRingTone = () => {
    if (ringOscillatorIntervalRef.current) {
      clearInterval(ringOscillatorIntervalRef.current);
      ringOscillatorIntervalRef.current = null;
    }
  };

  // Play DTMF dual tone (e.g. 941Hz + 1209Hz for Key 1)
  const playDtmfTone = (digit: string) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Frequencies for DTMF keypad
      const rowFreqs: Record<string, number> = {
        '1': 697, '2': 697, '3': 697,
        '4': 770, '5': 770, '6': 770,
        '7': 852, '8': 852, '9': 852,
        '*': 941, '0': 941, '#': 941,
      };
      const colFreqs: Record<string, number> = {
        '1': 1209, '4': 1209, '7': 1209, '*': 1209,
        '2': 1336, '5': 1336, '8': 1336, '0': 1336,
        '3': 1477, '6': 1477, '9': 1477, '#': 1477,
      };

      const f1 = rowFreqs[digit] || 697;
      const f2 = colFreqs[digit] || 1209;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(f1, now);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(f2, now);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.25);
      osc2.start(now);
      osc2.stop(now + 0.25);
    } catch (e) {
      console.warn('DTMF sound error:', e);
    }
  };

  // Play manager's exact configured IVR voice prompt
  const playIvrVoicePrompt = (ivr: any) => {
    if (!ivr) return;
    setIsPlayingAudio(true);

    const greeting = (ivr.greetingText || 'Welcome to Pirates World Tele Solution. Press 1 to speak with an agent, or 2 to end this call.').replace(/^["']|["']$/g, '').trim();

    // 1. If audio URL is available (uploaded WAV/MP3)
    if (ivr.audioUrl && audioRef.current) {
      try {
        audioRef.current.src = ivr.audioUrl;
        audioRef.current.currentTime = 0;
        audioRef.current.play()
          .then(() => {
            setIsPlayingAudio(true);
          })
          .catch((err) => {
            console.warn('Audio URL playback note, falling back to Web Speech:', err);
            speakGreetingViaSpeechSynthesis(greeting);
          });
        return;
      } catch {
        speakGreetingViaSpeechSynthesis(greeting);
        return;
      }
    }

    // 2. Synthesize via Web Speech API
    speakGreetingViaSpeechSynthesis(greeting);
  };

  const speakGreetingViaSpeechSynthesis = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.rate = 1.0;
      utt.pitch = 1.0;
      utt.lang = 'en-US';
      utt.onstart = () => setIsPlayingAudio(true);
      utt.onend = () => setIsPlayingAudio(false);
      utt.onerror = () => setIsPlayingAudio(false);
      speechUttRef.current = utt;
      window.speechSynthesis.speak(utt);
    } catch (e) {
      console.warn('Speech synthesis note:', e);
      setIsPlayingAudio(false);
    }
  };

  const stopIvrVoicePlayback = () => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch {}
    }
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    setIsPlayingAudio(false);
  };

  // Poll for active PSTN customer recipient call
  const fetchCustomerActiveCall = async () => {
    try {
      const res = await fetch('/api/customer/active-call');
      if (res.ok) {
        const data = await res.json();
        if (data.activeCall && !data.activeCall.endTime) {
          setActiveCall(data.activeCall);
          setIvrConfig(data.ivr);
          setCampaign(data.campaign);

          // If phone is ringing or dialing and auto-answer is ON
          if (data.activeCall.status === 'DIALING' || data.activeCall.status === 'RINGING') {
            setIsOpen(true);
            playHandsetRingTone();
            if (autoAnswerReceiver && !isAnswering) {
              setTimeout(() => {
                handleAnswerHandset(data.activeCall.id, data.ivr);
              }, 1200);
            }
          } else if (data.activeCall.status === 'IVR_ACTIVE') {
            stopHandsetRingTone();
            if (!isPlayingAudio) {
              playIvrVoicePrompt(data.ivr);
            }
          } else if (data.activeCall.status === 'BRIDGED') {
            stopHandsetRingTone();
            stopIvrVoicePlayback();
          }
        } else {
          stopHandsetRingTone();
          stopIvrVoicePlayback();
          setActiveCall(null);
          setDtmfStatus(null);
        }
      }
    } catch (err) {
      console.warn('fetchCustomerActiveCall note:', err);
    }
  };

  useEffect(() => {
    fetchCustomerActiveCall();
    const interval = setInterval(fetchCustomerActiveCall, 2000);
    return () => {
      clearInterval(interval);
      stopHandsetRingTone();
      stopIvrVoicePlayback();
    };
  }, [triggerRefresh, autoAnswerReceiver]);

  // Track call duration when handset answered
  useEffect(() => {
    if (activeCall && (activeCall.status === 'IVR_ACTIVE' || activeCall.status === 'BRIDGED')) {
      const interval = setInterval(() => {
        setHandsetSeconds((prev) => prev + 1);
      }, 1000);
      callDurationTimerRef.current = interval;
      return () => clearInterval(interval);
    } else {
      setHandsetSeconds(0);
      if (callDurationTimerRef.current) {
        clearInterval(callDurationTimerRef.current);
      }
    }
  }, [activeCall?.status]);

  // Handle user answering handset
  const handleAnswerHandset = async (callId: string, ivr?: any) => {
    setIsAnswering(true);
    stopHandsetRingTone();
    try {
      const res = await fetch('/api/customer/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveCall((prev: any) => (prev ? { ...prev, status: 'IVR_ACTIVE' } : prev));
        const resolvedIvr = ivr || data.ivr || ivrConfig;
        if (resolvedIvr) {
          setIvrConfig(resolvedIvr);
          playIvrVoicePrompt(resolvedIvr);
        }
      }
    } catch (e) {
      console.warn('Customer answer note:', e);
    } finally {
      setIsAnswering(false);
    }
  };

  // Handle pressing DTMF Key
  const handlePressDtmfKey = async (digit: string) => {
    if (!activeCall?.id) return;
    playDtmfTone(digit);
    stopIvrVoicePlayback();

    setDtmfStatus(`Pressed [${digit}]: Confirming with Agent Station...`);

    try {
      const res = await fetch('/api/customer/dtmf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId: activeCall.id, digit }),
      });

      if (res.ok) {
        setDtmfStatus(`Confirmed Key [${digit}]! Agent station ring beep starting (auto-answering in 3s)...`);
        // Refresh call state
        setTimeout(() => {
          fetchCustomerActiveCall();
        }, 1500);
      }
    } catch (e: any) {
      setDtmfStatus(`Error: ${e.message}`);
    }
  };

  const handleHangupHandset = async () => {
    if (!activeCall?.id) return;
    stopHandsetRingTone();
    stopIvrVoicePlayback();
    try {
      await fetch('/api/customer/hangup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId: activeCall.id }),
      });
      setActiveCall(null);
      setDtmfStatus(null);
    } catch (e) {
      console.warn('Customer hangup note:', e);
    }
  };

  const isRinging = activeCall && (activeCall.status === 'DIALING' || activeCall.status === 'RINGING');
  const isIvrActive = activeCall && activeCall.status === 'IVR_ACTIVE';
  const isBridged = activeCall && activeCall.status === 'BRIDGED';

  return (
    <>
      <audio ref={audioRef} onEnded={() => setIsPlayingAudio(false)} className="hidden" />

      {/* Floating Toggle Bar in Bottom Right */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={`fixed bottom-4 right-4 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-full shadow-xl transition-all cursor-pointer font-bold text-xs ${
            isRinging
              ? 'bg-amber-500 text-white animate-bounce ring-4 ring-amber-300'
              : isIvrActive
              ? 'bg-indigo-600 text-white animate-pulse'
              : isBridged
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-900 text-slate-100 hover:bg-slate-800'
          }`}
          title="Open PSTN Handset Simulator to listen to IVR voice"
        >
          <Phone className={`w-4 h-4 ${isRinging ? 'animate-ping' : ''}`} />
          <span>
            {isRinging
              ? 'PSTN Handset: INCOMING CALL...'
              : isIvrActive
              ? 'PSTN Handset: IVR VOICE PLAYING'
              : isBridged
              ? 'PSTN Handset: CALL BRIDGED'
              : 'PSTN Receiver Handset'}
          </span>
          {activeCall && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          )}
        </button>
      )}

      {/* Expanded Handset Simulator Modal / Drawer */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 z-50 w-84 sm:w-96 bg-slate-900 border-2 border-indigo-500 text-white rounded-3xl shadow-2xl overflow-hidden font-sans animate-fade-in flex flex-col max-h-[85vh]">
          {/* Handset Header */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-4 border-b border-indigo-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-sm">
                <Phone className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
                  <span>PSTN Receiver Handset</span>
                  <span className="text-[9px] bg-indigo-500/30 text-indigo-200 px-1.5 py-0.2 rounded border border-indigo-400/40">
                    SIMULATOR
                  </span>
                </h4>
                <p className="text-[10px] text-slate-400">
                  Customer recipient line for IVR voice & DTMF test
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setAutoAnswerReceiver(!autoAnswerReceiver)}
                className={`text-[9px] font-bold px-2 py-0.5 rounded-full border transition-colors ${
                  autoAnswerReceiver
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
                title="Toggle handset auto-answering"
              >
                Auto-Answer: {autoAnswerReceiver ? 'ON' : 'OFF'}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                title="Minimize Handset"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Handset Screen Display */}
          <div className="p-4 overflow-y-auto space-y-3.5 flex-1">
            {activeCall ? (
              <div className="space-y-3">
                {/* Call Metadata Banner */}
                <div className="bg-slate-800/90 rounded-2xl p-3 border border-slate-700 space-y-1.5 text-center">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                      {campaign?.name ? `Campaign: ${campaign.name}` : 'Live PSTN Outbound Leg'}
                    </span>
                    <span className="font-mono text-emerald-300 font-bold">
                      {Math.floor(handsetSeconds / 60)}:{(handsetSeconds % 60).toString().padStart(2, '0')}
                    </span>
                  </div>

                  <div className="text-lg font-black font-mono text-white tracking-wider">
                    {activeCall.customerNumber || 'Recipient Mobile Line'}
                  </div>

                  <div className="text-[11px] text-indigo-300">
                    Caller ID: <span className="font-mono font-semibold">{activeCall.callerId || '+18045930160'}</span>
                  </div>

                  {/* Status Indicator */}
                  <div className="pt-1">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        isRinging
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                          : isIvrActive
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      }`}
                    >
                      {isRinging && 'RINGING INCOMING CALL...'}
                      {isIvrActive && 'IVR VOICE PLAYING TO RECEIVER'}
                      {isBridged && 'BRIDGED WITH LIVE AGENT (2-WAY AUDIO)'}
                    </span>
                  </div>
                </div>

                {/* Ringing State Action */}
                {isRinging && (
                  <div className="bg-amber-950/60 border border-amber-700/60 rounded-2xl p-4 text-center space-y-3 animate-pulse">
                    <div className="w-12 h-12 bg-amber-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg animate-bounce">
                      <PhoneCall className="w-6 h-6" />
                    </div>
                    <div className="text-xs text-amber-200 font-semibold">
                      Phone is ringing! Answer to hear manager's configured IVR voice prompt.
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAnswerHandset(activeCall.id, ivrConfig)}
                      disabled={isAnswering}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
                    >
                      <PhoneCall className="w-4 h-4" />
                      <span>{isAnswering ? 'Connecting Handset...' : 'Answer Phone Now'}</span>
                    </button>
                  </div>
                )}

                {/* IVR Voice Playing Display */}
                {isIvrActive && (
                  <div className="bg-indigo-950/70 border border-indigo-700/70 rounded-2xl p-3.5 space-y-2.5 text-left">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-indigo-200 flex items-center gap-1.5">
                        <Volume2 className="w-4 h-4 text-indigo-400 animate-pulse" />
                        <span>Manager's Configured IVR Voice</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => playIvrVoicePrompt(ivrConfig)}
                        className="text-[10px] text-indigo-300 hover:text-white flex items-center gap-1 bg-indigo-900/60 hover:bg-indigo-800 px-2 py-0.5 rounded transition-colors"
                        title="Replay IVR Voice Prompt"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Replay Voice</span>
                      </button>
                    </div>

                    {/* Speech Transcript Display */}
                    <div className="bg-slate-950/80 p-2.5 rounded-xl border border-indigo-800/60 text-xs text-slate-200 italic space-y-1">
                      <p>
                        "{ivrConfig?.greetingText || 'Welcome to Pirates World Tele Solution. Press 1 to speak with an agent, or 2 to end this call.'}"
                      </p>
                    </div>

                    {/* Visual Audio Waveform */}
                    <div className="flex items-center justify-center gap-1 py-1">
                      <span className="w-1 h-3 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                      <span className="w-1 h-5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <span className="w-1 h-7 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.3s]" />
                      <span className="w-1 h-4 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                      <span className="w-1 h-6 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.5s]" />
                      <span className="w-1 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <span className="text-[10px] text-indigo-300 font-medium ml-2">
                        Receiver is listening to IVR audio...
                      </span>
                    </div>

                    <div className="text-[11px] text-indigo-200 font-semibold bg-indigo-900/40 p-2 rounded-lg border border-indigo-800/40 text-center">
                      👉 Press <span className="text-emerald-400 font-bold font-mono">[1]</span> on the keypad below to connect with Live Agent!
                    </div>
                  </div>
                )}

                {/* Bridged State Active */}
                {isBridged && (
                  <div className="bg-emerald-950/70 border border-emerald-700/60 rounded-2xl p-3.5 space-y-2 text-center">
                    <div className="w-10 h-10 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto shadow-md">
                      <Headphones className="w-5 h-5" />
                    </div>
                    <div className="text-xs font-bold text-emerald-300">
                      Call Connected & Bridged with Agent Station!
                    </div>
                    <p className="text-[11px] text-slate-300">
                      2-way real-time audio is active between customer receiver and agent headset.
                    </p>
                  </div>
                )}

                {/* DTMF Action Confirmation Banner */}
                {dtmfStatus && (
                  <div className="bg-indigo-900/80 border border-indigo-500 p-2.5 rounded-xl text-xs text-indigo-100 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{dtmfStatus}</span>
                  </div>
                )}

                {/* DTMF Keypad */}
                <div className="bg-slate-950/90 rounded-2xl p-3 border border-slate-800 space-y-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">
                    Telephone Keypad (DTMF)
                  </div>

                  {/* Highlighted DTMF Key 1 Button */}
                  <button
                    type="button"
                    onClick={() => handlePressDtmfKey('1')}
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-2.5 px-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
                  >
                    <span className="font-mono text-base">[1]</span>
                    <span>Press 1 &rarr; Connect to Live Agent (3s Ring Beep)</span>
                  </button>

                  {/* Standard Keypad Grid */}
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    {[
                      { key: '1', sub: '' },
                      { key: '2', sub: 'ABC' },
                      { key: '3', sub: 'DEF' },
                      { key: '4', sub: 'GHI' },
                      { key: '5', sub: 'JKL' },
                      { key: '6', sub: 'MNO' },
                      { key: '7', sub: 'PQRS' },
                      { key: '8', sub: 'TUV' },
                      { key: '9', sub: 'WXYZ' },
                      { key: '*', sub: '' },
                      { key: '0', sub: '+' },
                      { key: '#', sub: '' },
                    ].map((btn) => (
                      <button
                        key={btn.key}
                        type="button"
                        onClick={() => handlePressDtmfKey(btn.key)}
                        className="bg-slate-800 hover:bg-slate-700 active:bg-indigo-700 text-white py-2 rounded-xl border border-slate-700 transition-all flex flex-col items-center justify-center cursor-pointer shadow-xs"
                      >
                        <span className="font-mono font-bold text-sm leading-none">{btn.key}</span>
                        {btn.sub && <span className="text-[8px] text-slate-400 leading-none mt-0.5">{btn.sub}</span>}
                      </button>
                    ))}
                  </div>

                  {/* Handset Hang Up Button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleHangupHandset}
                      className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded-xl transition-colors flex items-center justify-center gap-1.5 text-xs shadow-md cursor-pointer"
                    >
                      <PhoneOff className="w-3.5 h-3.5" />
                      <span>End Handset Call (Hang Up)</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Idle Receiver Standby View */
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 text-slate-400 flex items-center justify-center mx-auto">
                  <Phone className="w-6 h-6" />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-white">Receiver Handset Standby</h5>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-[240px] mx-auto">
                    When you launch an outbound campaign from Manager Dashboard, this handset will ring automatically.
                  </p>
                </div>
                <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60 text-[10px] text-slate-300 text-left space-y-1">
                  <div className="font-semibold text-indigo-300 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    <span>How it works:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-0.5 text-slate-400">
                    <li>Launch campaign with your configured IVR Voice</li>
                    <li>Handset rings & plays your exact recorded voice</li>
                    <li>Press [1] on keypad &rarr; 3s ring beep on agent dashboard</li>
                    <li>Agent automatically answers with zero clicks required!</li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
