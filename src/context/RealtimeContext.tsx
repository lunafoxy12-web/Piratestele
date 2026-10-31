import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext.tsx';
import { DtmfEventItem, CallItem } from '../types.ts';

interface RealtimeContextType {
  isConnected: boolean;
  liveDtmfEvents: DtmfEventItem[];
  activeCalls: CallItem[];
  latestAgentEvent: any;
  latestIncomingCall: any;
  latestCampaignEvent: any;
  latestSipHealthEvent: any;
  latestSystemError: any;
  latestVoiceMessage: { callId: string; sender: string; text: string; timestamp: string } | null;
  latestTranslationEvent: any;
  clearLiveDtmf: () => void;
  triggerRefresh: number;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [liveDtmfEvents, setLiveDtmfEvents] = useState<DtmfEventItem[]>([]);
  const [activeCalls, setActiveCalls] = useState<CallItem[]>([]);
  const [latestAgentEvent, setLatestAgentEvent] = useState<any>(null);
  const [latestIncomingCall, setLatestIncomingCall] = useState<any>(null);
  const [latestCampaignEvent, setLatestCampaignEvent] = useState<any>(null);
  const [latestSipHealthEvent, setLatestSipHealthEvent] = useState<any>(null);
  const [latestSystemError, setLatestSystemError] = useState<any>(null);
  const [latestVoiceMessage, setLatestVoiceMessage] = useState<any>(null);
  const [latestTranslationEvent, setLatestTranslationEvent] = useState<any>(null);
  const [triggerRefresh, setTriggerRefresh] = useState<number>(0);

  const clearLiveDtmf = useCallback(() => {
    setLiveDtmfEvents([]);
  }, []);

  useEffect(() => {
    if (!token && user?.role !== 'customer') {
      setIsConnected(false);
      return;
    }

    const query = new URLSearchParams();
    if (token) query.set('token', token);
    if (user?.role) query.set('role', user.role);
    if (user?.managerId) query.set('managerId', user.managerId);
    if (user?.agentId) query.set('agentId', user.agentId);

    const eventSource = new EventSource(`/api/events?${query.toString()}`);

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onerror = (err) => {
      console.warn('Realtime event stream disconnected, retrying...', err);
      setIsConnected(false);
    };

    // Listen to real-time events
    eventSource.addEventListener('connected', () => {
      setIsConnected(true);
    });

    eventSource.addEventListener('dtmf.received', (e) => {
      try {
        const data = JSON.parse(e.data);
        setLiveDtmfEvents((prev) => [data, ...prev.slice(0, 49)]);
        setTriggerRefresh((prev) => prev + 1);
      } catch (err) {
        console.error('Error parsing DTMF event:', err);
      }
    });

    eventSource.addEventListener('call.created', (e) => {
      try {
        const data = JSON.parse(e.data);
        setActiveCalls((prev) => [data, ...prev]);
        setTriggerRefresh((prev) => prev + 1);
      } catch (err) {
        console.error('Error parsing call.created:', err);
      }
    });

    eventSource.addEventListener('call.ringing', (e) => {
      setTriggerRefresh((prev) => prev + 1);
    });

    eventSource.addEventListener('call.answered', () => {
      setTriggerRefresh((prev) => prev + 1);
    });

    eventSource.addEventListener('call.bridged', (e) => {
      try {
        const data = JSON.parse(e.data);
        setLatestAgentEvent({ type: 'bridged', ...data });
        setTriggerRefresh((prev) => prev + 1);
      } catch {
        setTriggerRefresh((prev) => prev + 1);
      }
    });

    eventSource.addEventListener('agent.answered', (e) => {
      try {
        const data = JSON.parse(e.data);
        setLatestAgentEvent({ type: 'bridged', ...data });
        setTriggerRefresh((prev) => prev + 1);
      } catch {
        setTriggerRefresh((prev) => prev + 1);
      }
    });

    eventSource.addEventListener('call.ended', (e) => {
      try {
        const data = JSON.parse(e.data);
        setActiveCalls((prev) => prev.filter((c) => (c.callId || c.id) !== data.callId));
        setLatestAgentEvent({ type: 'call.ended', ...data });
        setTriggerRefresh((prev) => prev + 1);
      } catch (err) {
        console.error('Error parsing call.ended:', err);
      }
    });

    eventSource.addEventListener('call.notes_updated', () => {
      setTriggerRefresh((prev) => prev + 1);
    });

    eventSource.addEventListener('call.updated', (e) => {
      try {
        const data = JSON.parse(e.data);
        setActiveCalls((prev) => prev.map((c) => (c.id === data.id ? { ...c, ...data } : c)));
      } catch {}
      setTriggerRefresh((prev) => prev + 1);
    });

    eventSource.addEventListener('call.failed', (e) => {
      try {
        const data = JSON.parse(e.data);
        setActiveCalls((prev) => prev.filter((c) => (c.callId || c.id) !== data.callId));
        setLatestAgentEvent({ type: 'call.failed', ...data });
        setTriggerRefresh((prev) => prev + 1);
      } catch (err) {
        console.error('Error parsing call.failed:', err);
      }
    });

    eventSource.addEventListener('agent.incoming_call', (e) => {
      try {
        const data = JSON.parse(e.data);
        const incomingPayload = { type: 'incoming', ...data, timestamp: Date.now() };
        setLatestIncomingCall(incomingPayload);
        setLatestAgentEvent(incomingPayload);
        setTriggerRefresh((prev) => prev + 1);
      } catch (err) {
        console.error('Error parsing agent.incoming_call:', err);
      }
    });

    eventSource.addEventListener('agent.state_changed', (e) => {
      try {
        const data = JSON.parse(e.data);
        setLatestAgentEvent({ type: 'state_changed', ...data });
        setTriggerRefresh((prev) => prev + 1);
      } catch (err) {
        console.error('Error parsing agent.state_changed:', err);
      }
    });

    eventSource.addEventListener('sip.health_changed', (e) => {
      try {
        const data = JSON.parse(e.data);
        setLatestSipHealthEvent(data);
        setTriggerRefresh((prev) => prev + 1);
      } catch (err) {
        console.error('Error parsing sip.health_changed:', err);
      }
    });

    eventSource.addEventListener('campaign.progress', (e) => {
      try {
        const data = JSON.parse(e.data);
        setLatestCampaignEvent(data);
        setTriggerRefresh((prev) => prev + 1);
      } catch (err) {
        console.error('Error parsing campaign.progress:', err);
      }
    });

    eventSource.addEventListener('system.error', (e) => {
      try {
        const data = JSON.parse(e.data);
        setLatestSystemError(data);
      } catch (err) {
        console.error('Error parsing system.error:', err);
      }
    });

    eventSource.addEventListener('translation.turn', (e) => {
      try {
        const data = JSON.parse(e.data);
        setLatestTranslationEvent(data);
      } catch (err) {
        console.error('Error parsing translation.turn:', err);
      }
    });

    eventSource.addEventListener('telephony.voice_message', (e) => {
      try {
        const data = JSON.parse(e.data);
        setLatestVoiceMessage(data);
      } catch (err) {
        console.error('Error parsing voice_message:', err);
      }
    });

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [token, user]);

  return (
    <RealtimeContext.Provider
      value={{
        isConnected,
        liveDtmfEvents,
        activeCalls,
        latestAgentEvent,
        latestIncomingCall,
        latestCampaignEvent,
        latestSipHealthEvent,
        latestSystemError,
        latestVoiceMessage,
        latestTranslationEvent,
        clearLiveDtmf,
        triggerRefresh,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
};

export const useRealtime = () => {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
};
