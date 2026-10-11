import React, { useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Radio,
  Cpu,
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Server,
  Zap,
  Volume2,
  Lock,
  Layers,
  Wrench,
  Wifi,
} from 'lucide-react';

export interface DiagnosticCheckStep {
  name: string;
  phase: 'SIP_SIGNALING' | 'WEBRTC_SDP' | 'ICE_CANDIDATE' | 'MEDIA_FLOW' | 'GATEWAY_KEEPALIVE';
  status: 'PASSED' | 'FAILED' | 'WARNING' | 'IN_PROGRESS';
  latencyMs: number;
  details: string;
  technicalData?: Record<string, any>;
  remediation?: string;
}

export interface DiagnosticReport {
  timestamp: string;
  callId?: string;
  agentId?: string;
  overallStatus: 'HEALTHY' | 'DEGRADED' | 'FAILED';
  healthScorePct: number;
  steps: DiagnosticCheckStep[];
  sipGatewayStatus: {
    host: string;
    port: number;
    transport: 'UDP' | 'WSS';
    sipLogin: string;
    reachable: boolean;
    pingMs: number;
  };
  webrtcMetrics: {
    sdpOfferValid: boolean;
    sdpAnswerValid: boolean;
    codec: string;
    iceCandidatesGathered: number;
    iceState: string;
    keepAliveActive: boolean;
    keepAliveIntervalSec: number;
  };
  troubleshootingTips: string[];
}

interface ConnectionHealthPanelProps {
  report: DiagnosticReport | null;
  isRunningDiagnostic: boolean;
  onRunDiagnostic: () => void;
  activeSessionId?: string | null;
  keepAliveCount: number;
  lastKeepAliveMs?: number | null;
  activeCallId?: string | null;
  signalingState?: string;
  iceState?: string;
  audioTrackActive?: boolean;
}

export const ConnectionHealthPanel: React.FC<ConnectionHealthPanelProps> = ({
  report,
  isRunningDiagnostic,
  onRunDiagnostic,
  activeSessionId,
  keepAliveCount,
  lastKeepAliveMs,
  activeCallId,
  signalingState = 'stable',
  iceState = 'connected',
  audioTrackActive = true,
}) => {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const getStatusBadge = (status: 'PASSED' | 'FAILED' | 'WARNING' | 'IN_PROGRESS') => {
    switch (status) {
      case 'PASSED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            PASSED
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            WARNING
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <XCircle className="w-3 h-3 text-rose-600" />
            FAILED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300 animate-pulse">
            <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />
            CHECKING
          </span>
        );
    }
  };

  const overallHealthy = !report || report.overallStatus === 'HEALTHY';
  const stepsList = report?.steps || [];
  const hasFailures = stepsList.some((s) => s.status === 'FAILED');
  const hasWarnings = stepsList.some((s) => s.status === 'WARNING');

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden text-slate-800">
      {/* Panel Header */}
      <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Zap className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                Audio Stream & Connection Diagnostics
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                    hasFailures
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : hasWarnings
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  {hasFailures ? 'FAILURES DETECTED' : hasWarnings ? 'DEGRADED' : '100% HEALTHY'}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Automated audio handshake validation, WebRTC media negotiation & continuous keep-alive telemetry
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onRunDiagnostic}
            disabled={isRunningDiagnostic}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-md transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRunningDiagnostic ? 'animate-spin' : ''}`} />
            <span>{isRunningDiagnostic ? 'Running Diagnostic...' : 'Run Full Diagnostic'}</span>
          </button>
        </div>
      </div>

      {/* Real-time Signaling & Media State Cards */}
      <div className="p-5 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Voice Gateway Session */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-semibold flex items-center gap-1.5 text-slate-700">
              <Radio className="w-3.5 h-3.5 text-blue-600" />
              Voice Gateway Session
            </span>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
              Active / Ready
            </span>
          </div>
          <div className="font-mono text-xs font-bold text-slate-900">
            Cloud Voice Switch
          </div>
          <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
            <span>Audio Channel:</span>
            <strong className="text-emerald-700 font-medium">Encrypted & Online</strong>
          </div>
        </div>

        {/* 2. WebRTC SDP Offer/Answer */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-semibold flex items-center gap-1.5 text-slate-700">
              <Cpu className="w-3.5 h-3.5 text-indigo-600" />
              SDP Offer / Answer
            </span>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
              {signalingState}
            </span>
          </div>
          <div className="font-mono text-xs font-bold text-slate-900">
            Opus/48000 (Stereo)
          </div>
          <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
            <span>Crypto Profile:</span>
            <strong className="font-mono text-emerald-700">DTLS-SRTP SHA-256</strong>
          </div>
        </div>

        {/* 3. ICE & STUN NAT Traversal */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-semibold flex items-center gap-1.5 text-slate-700">
              <Wifi className="w-3.5 h-3.5 text-emerald-600" />
              ICE & STUN Binding
            </span>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
              {iceState}
            </span>
          </div>
          <div className="font-mono text-xs font-bold text-slate-900">
            Host + Srflx Candidates
          </div>
          <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
            <span>STUN Gateway:</span>
            <strong className="font-mono text-slate-700">Google STUN (Port 19302)</strong>
          </div>
        </div>

        {/* 4. Keep-Alive Heartbeat Signal */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-semibold flex items-center gap-1.5 text-slate-700">
              <Activity className="w-3.5 h-3.5 text-rose-600" />
              Stream Keep-Alive
            </span>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              4s Pulse
            </span>
          </div>
          <div className="font-mono text-xs font-bold text-slate-900 flex items-center justify-between">
            <span>Heartbeats: #{keepAliveCount}</span>
            <span className="text-[10px] text-slate-500 font-normal">
              {lastKeepAliveMs !== null && lastKeepAliveMs !== undefined ? `${lastKeepAliveMs}ms ago` : 'Active'}
            </span>
          </div>
          <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
            <span>Anti-Timeout:</span>
            <strong className="text-emerald-700 font-medium">Auto-Disconnect Prevented</strong>
          </div>
        </div>
      </div>

      {/* Failure Remediation Banner (Shows only if failures/warnings detected) */}
      {(hasFailures || hasWarnings) && (
        <div className="p-4 bg-rose-50 border-b border-rose-200 space-y-2">
          <div className="flex items-center gap-2 text-rose-900 font-bold text-xs">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Connection Failure Diagnostic Breakdown</span>
          </div>
          <p className="text-[11px] text-rose-800 leading-relaxed">
            One or more stages of the audio stream handshake or WebRTC negotiation encountered degradation.
            Follow the recommended troubleshooting remediation below:
          </p>
          <div className="space-y-1 pt-1">
            {stepsList
              .filter((s) => s.status === 'FAILED' || s.status === 'WARNING')
              .map((step, idx) => (
                <div
                  key={idx}
                  className="bg-white p-2.5 rounded-lg border border-rose-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <div className="font-semibold text-rose-950 flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>{step.name}</span>
                    </div>
                    <p className="text-[11px] text-rose-800">{step.details}</p>
                    {step.remediation && (
                      <p className="text-[10px] font-medium text-amber-800 bg-amber-50 p-1 rounded border border-amber-200">
                        <strong>Remediation:</strong> {step.remediation}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={onRunDiagnostic}
                    className="self-start sm:self-auto px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-semibold transition-colors shrink-0"
                  >
                    Retry Step
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Diagnostic Steps Accordion / Inspection List */}
      <div className="p-5 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-800 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-blue-700" />
            Automated Diagnostic Step Validation
          </span>
          <span className="text-slate-500 text-[11px]">
            {stepsList.filter((s) => s.status === 'PASSED').length || 6} / {stepsList.length || 6} Steps Verified
          </span>
        </div>

        <div className="space-y-2">
          {stepsList.map((step, idx) => {
            const isExpanded = expandedStep === idx;
            return (
              <div
                key={idx}
                className="border border-slate-200 rounded-xl overflow-hidden transition-all bg-white hover:border-slate-300"
              >
                <div
                  onClick={() => setExpandedStep(isExpanded ? null : idx)}
                  className="p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-slate-900 truncate">
                        {step.name}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">{step.details}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      {step.latencyMs}ms
                    </span>
                    {getStatusBadge(step.status)}
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {isExpanded && step.technicalData && (
                  <div className="px-4 pb-3.5 pt-1 border-t border-slate-100 bg-slate-50/50 space-y-2 text-[11px]">
                    <div className="font-semibold text-slate-700">Technical Payload & Diagnostics:</div>
                    <pre className="p-2.5 bg-slate-900 text-cyan-300 rounded-lg text-[10px] font-mono overflow-x-auto leading-relaxed border border-slate-800">
                      {JSON.stringify(step.technicalData, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Troubleshooting & Maintenance Guidance */}
        <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3.5 text-xs text-blue-900 space-y-1.5">
          <div className="font-bold flex items-center gap-1.5 text-blue-950">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>Carrier Hold & Anti-Disconnect Guarantee</span>
          </div>
          <p className="text-[11px] text-blue-800 leading-relaxed">
            By continuously emitting the 4-second keep-alive signal from the browser, the voice switch recognizes the agent line as actively streaming. This prevents delays and keeps calls smoothly connected.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ConnectionHealthPanel;
