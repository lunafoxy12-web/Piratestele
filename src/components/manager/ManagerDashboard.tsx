import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useRealtime } from '../../context/RealtimeContext.tsx';
import {
  AgentItem,
  CampaignItem,
  IvrConfigItem,
  CallItem,
  VoicemailTemplateItem,
  VoicemailDropLogItem,
} from '../../types.ts';
import {
  Users,
  PlayCircle,
  Phone,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  Upload,
  RefreshCw,
  KeyRound,
  UserCheck,
  UserX,
  Mic,
  FileAudio,
  Volume2,
  Square,
  ShieldCheck,
  Clock,
  Radio,
  FileText,
  User,
  Check,
  Trash2,
  Sparkles,
  Languages,
  Voicemail,
  Zap,
  ArrowRight,
} from 'lucide-react';

export const ManagerDashboard: React.FC = () => {
  const { token, user } = useAuth();
  const { triggerRefresh } = useRealtime();

  const [activeTab, setActiveTab] = useState<'campaigns' | 'ivr' | 'voicemails' | 'agents' | 'calls'>('campaigns');

  // Data states
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [maxAgents, setMaxAgents] = useState<number>(10);
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [ivrs, setIvrs] = useState<IvrConfigItem[]>([]);
  const [calls, setCalls] = useState<CallItem[]>([]);
  const [callsSummary, setCallsSummary] = useState({
    total: 0,
    answered: 0,
    bridged: 0,
    completed: 0,
    failed: 0,
    avgDuration: 0,
  });

  // Voicemail & Voicemail Drop states
  const [voicemails, setVoicemails] = useState<VoicemailTemplateItem[]>([]);
  const [voicemailDrops, setVoicemailDrops] = useState<VoicemailDropLogItem[]>([]);
  const [showCreateVoicemailModal, setShowCreateVoicemailModal] = useState<boolean>(false);
  const [voicemailForm, setVoicemailForm] = useState({
    name: '',
    description: '',
    type: 'TTS_GENERATED' as 'TTS_GENERATED' | 'AUDIO_FILE',
    ttsText: 'Hello, this is our customer service team following up on your request. Please call us back or check your account portal.',
    audioUrl: '',
    voiceGender: 'FEMALE' as 'FEMALE' | 'MALE',
    voiceLanguage: 'en-US',
    durationSeconds: 15,
  });
  const [playingVoicemailId, setPlayingVoicemailId] = useState<string | null>(null);
  const [voicemailFilterReason, setVoicemailFilterReason] = useState<string>('ALL');
  const [voicemailSearch, setVoicemailSearch] = useState<string>('');
  const [showManagerInstantDropModal, setShowManagerInstantDropModal] = useState<boolean>(false);
  const [managerInstantDropForm, setManagerInstantDropForm] = useState({
    targetNumber: '+12099722359',
    voicemailId: '',
  });
  const [isManagerDropping, setIsManagerDropping] = useState<boolean>(false);
  const [managerInstantDropResult, setManagerInstantDropResult] = useState<any>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form Modals
  const [showCreateAgentModal, setShowCreateAgentModal] = useState<boolean>(false);
  const [agentForm, setAgentForm] = useState({ name: '', username: '', password: '', phoneNumber: '' });
  const [resetPassAgentId, setResetPassAgentId] = useState<string | null>(null);
  const [newAgentPassword, setNewAgentPassword] = useState<string>('');

  const [showCreateCampaignModal, setShowCreateCampaignModal] = useState<boolean>(false);
  const [campaignForm, setCampaignForm] = useState({
    name: '',
    ivrConfigId: '',
    targetPhone: '',
    csvText: '',
    routingType: 'IVR_THEN_DIRECT_AGENT' as 'IVR_THEN_DIRECT_AGENT' | 'AI_VOICE_TRANSLATION',
    agentLanguage: 'Urdu',
    customerLanguage: 'Arabic',
    autoDetectCustomerLanguage: false,
    aiBotGreeting: 'مرحباً، جاري توصيلك بممثل الخدمة',
    voicemailDropEnabled: true,
    voicemailTemplateId: '',
  });
  const [managerPolicy, setManagerPolicy] = useState<{
    allowedRoutingMode: 'IVR_THEN_DIRECT_AGENT' | 'AI_VOICE_TRANSLATION' | 'BOTH';
    enforcedAgentLanguage: string;
    enforcedCustomerLanguage: string;
    allowManagerOverrideLanguages: boolean;
    aiTranslationBotVoice: string;
  }>({
    allowedRoutingMode: 'IVR_THEN_DIRECT_AGENT',
    enforcedAgentLanguage: 'Urdu',
    enforcedCustomerLanguage: 'Arabic',
    allowManagerOverrideLanguages: true,
    aiTranslationBotVoice: 'Aoede',
  });
  const [autoStartCampaign, setAutoStartCampaign] = useState<boolean>(true);

  const [showCreateIvrModal, setShowCreateIvrModal] = useState<boolean>(false);
  const [ivrForm, setIvrForm] = useState({
    name: '',
    greetingText: 'Hello and welcome. Press 1 on your phone keypad to speak with our live representative agent.',
    audioOption: 'TTS' as 'TTS' | 'UPLOAD' | 'RECORD',
    audioUrl: '',
    audioFileName: '',
    key1Action: 'TRANSFER_TO_AGENT',
    timeoutSeconds: 8,
  });

  // Microphone recording state for IVR
  const [isRecordingMic, setIsRecordingMic] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState<boolean>(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const showNotification = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  const safeFetch = async (url: string) => {
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  };

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [agentsData, campData, ivrData, repData, vmData, vmDropData] = await Promise.all([
        safeFetch('/api/manager/agents'),
        safeFetch('/api/manager/campaigns'),
        safeFetch('/api/manager/ivr-configs'),
        safeFetch('/api/manager/reports'),
        safeFetch('/api/voicemails'),
        safeFetch('/api/voicemail-drops'),
      ]);

      if (agentsData) {
        setAgents(agentsData.agents || []);
        if (agentsData.maxAgents !== undefined) setMaxAgents(agentsData.maxAgents);
        if (agentsData.managerPolicy) setManagerPolicy(agentsData.managerPolicy);
      }
      if (Array.isArray(campData)) setCampaigns(campData);
      if (Array.isArray(ivrData)) setIvrs(ivrData);
      if (repData) {
        if (Array.isArray(repData.calls)) setCalls(repData.calls);
        if (repData.summary) setCallsSummary(repData.summary);
      }
      if (Array.isArray(vmData)) setVoicemails(vmData);
      if (Array.isArray(vmDropData)) setVoicemailDrops(vmDropData);
    } catch (err: any) {
      showNotification('error', `Failed to load dashboard data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token, triggerRefresh]);

  // Periodic polling for live calls
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(async () => {
      const repData = await safeFetch('/api/manager/reports');
      if (repData) {
        if (Array.isArray(repData.calls)) setCalls(repData.calls);
        if (repData.summary) setCallsSummary(repData.summary);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [token]);

  // ==========================================
  // AGENT ACTIONS
  // ==========================================
  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!agentForm.name.trim() || !agentForm.username.trim() || !agentForm.password.trim()) {
      showNotification('error', 'Name, username, and password are required.');
      return;
    }

    if (maxAgents && agents.length >= maxAgents && maxAgents > 0) {
      showNotification('error', `Agent limit reached. You can create up to ${maxAgents} agents.`);
      return;
    }

    try {
      const res = await fetch('/api/manager/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: agentForm.name.trim(),
          username: agentForm.username.trim(),
          password: agentForm.password.trim(),
          phoneNumber: agentForm.phoneNumber.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showNotification('error', data.error || 'Failed to create agent.');
        return;
      }

      showNotification('success', `Agent '${data.name}' (@${data.username}) created successfully.`);
      setShowCreateAgentModal(false);
      setAgentForm({ name: '', username: '', password: '', phoneNumber: '' });
      await fetchData();
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  const handleToggleAgent = async (agent: AgentItem) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/manager/agents/${agent.id}/toggle`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        showNotification('error', data.error || 'Failed to update agent status.');
        return;
      }
      showNotification('success', data.message);
      fetchData();
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  const handleResetAgentPassword = async (agentId: string) => {
    if (!token || !newAgentPassword.trim()) return;
    try {
      const res = await fetch(`/api/manager/agents/${agentId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newPassword: newAgentPassword.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotification('error', data.error || 'Failed to reset password.');
        return;
      }
      showNotification('success', data.message);
      setResetPassAgentId(null);
      setNewAgentPassword('');
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  // ==========================================
  // CAMPAIGN ACTIONS
  // ==========================================
  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const targetList: Array<{ phoneNumber: string; name?: string }> = [];

    // Check target phone input first
    if (campaignForm.targetPhone.trim()) {
      let cleanTarget = campaignForm.targetPhone.trim().replace(/[^\d+]/g, '');
      if (cleanTarget.length >= 7) {
        if (!cleanTarget.startsWith('+')) {
          if (cleanTarget.length === 10 && !cleanTarget.startsWith('0') && !cleanTarget.startsWith('1')) {
            cleanTarget = `1${cleanTarget}`;
          }
          cleanTarget = `+${cleanTarget}`;
        }
        targetList.push({
          phoneNumber: cleanTarget,
          name: 'Target Customer',
        });
      }
    }

    // Check textarea / CSV input for all uploaded numbers
    if (campaignForm.csvText.trim()) {
      const rawLines = campaignForm.csvText.trim().split(/[\r\n]+/);
      for (const line of rawLines) {
        if (!line.trim() || line.toLowerCase().includes('phonenumber')) continue;
        const parts = line.split(',');
        let phone = (parts[0] || '').trim().replace(/[^\d+]/g, '');
        if (phone.length >= 7) {
          if (!phone.startsWith('+')) {
            if (phone.length === 10 && !phone.startsWith('0') && !phone.startsWith('1')) {
              phone = `1${phone}`;
            }
            phone = `+${phone}`;
          }
          targetList.push({
            phoneNumber: phone,
            name: parts[1]?.trim() || undefined,
          });
        }
      }
    }

    if (targetList.length === 0) {
      showNotification('error', 'Please enter a valid target PSTN mobile number to call (e.g. +12099722359).');
      return;
    }

    const resolvedIvr = campaignForm.ivrConfigId || ivrs[0]?.id;
    if (campaignForm.routingType === 'IVR_THEN_DIRECT_AGENT' && !resolvedIvr) {
      showNotification('error', 'Please create or select an IVR voice first for IVR campaign.');
      return;
    }

    try {
      const res = await fetch('/api/manager/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: campaignForm.name.trim(),
          ivrConfigId: resolvedIvr || 'ivr_direct',
          contacts: targetList,
          autoStart: autoStartCampaign,
          routingType: campaignForm.routingType,
          agentLanguage: campaignForm.agentLanguage,
          customerLanguage: campaignForm.customerLanguage,
          autoDetectCustomerLanguage: campaignForm.autoDetectCustomerLanguage,
          aiBotGreeting: campaignForm.aiBotGreeting,
          voicemailDropEnabled: campaignForm.voicemailDropEnabled,
          voicemailTemplateId: campaignForm.voicemailTemplateId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showNotification('error', data.error || 'Failed to create campaign.');
        return;
      }

      showNotification('success', `Campaign '${data.name}' (${campaignForm.routingType === 'AI_VOICE_TRANSLATION' ? 'AI Translation Bot' : 'IVR Menu'}) created! Calling ${targetList[0].phoneNumber} immediately.`);
      setShowCreateCampaignModal(false);
      setCampaignForm({
        name: '',
        ivrConfigId: '',
        targetPhone: '',
        csvText: '',
        routingType: managerPolicy.allowedRoutingMode === 'AI_VOICE_TRANSLATION' ? 'AI_VOICE_TRANSLATION' : 'IVR_THEN_DIRECT_AGENT',
        agentLanguage: managerPolicy.enforcedAgentLanguage || 'Urdu',
        customerLanguage: managerPolicy.enforcedCustomerLanguage || 'Arabic',
        autoDetectCustomerLanguage: false,
        aiBotGreeting: 'مرحباً، جاري توصيلك بممثل الخدمة',
        voicemailDropEnabled: true,
        voicemailTemplateId: '',
      });

      if (autoStartCampaign && data.id) {
        await handleRunCampaign(data.id);
      } else {
        await fetchData();
      }
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  const handleRunCampaign = async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/manager/campaigns/${id}/run`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        showNotification('error', data.error || 'Failed to start campaign.');
        return;
      }
      showNotification('success', `Campaign dispatched! PSTN call is ringing the recipient's phone.`);
      setActiveTab('calls');
      fetchData();
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  const handlePauseCampaign = async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/manager/campaigns/${id}/pause`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        showNotification('error', data.error || 'Failed to pause campaign.');
        return;
      }
      showNotification('success', data.message);
      fetchData();
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  // ==========================================
  // IVR AUDIO RECORDING & CREATION
  // ==========================================
  const handleStartMicRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let options: MediaRecorderOptions = {};
      if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          options = { mimeType: 'audio/webm;codecs=opus' };
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          options = { mimeType: 'audio/webm' };
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          options = { mimeType: 'audio/mp4' };
        }
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Data = reader.result as string;
          const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('wav') ? 'wav' : 'webm';
          setIvrForm((prev) => ({
            ...prev,
            audioUrl: base64Data,
            audioFileName: `mic_recorded_prompt_${Date.now()}.${ext}`,
            audioOption: 'RECORD',
            greetingText: prev.greetingText || 'Recorded Microphone IVR Greeting',
          }));
          setPreviewAudioUrl(base64Data);
        };
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecordingMic(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      showNotification('error', `Microphone access denied: ${err.message}`);
    }
  };

  const handleStopMicRecording = () => {
    if (mediaRecorderRef.current && isRecordingMic) {
      mediaRecorderRef.current.stop();
      setIsRecordingMic(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      showNotification('success', 'Voice recorded successfully! Ready to set as campaign IVR voice.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showNotification('error', 'File size exceeds 10MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setIvrForm((prev) => ({
        ...prev,
        audioUrl: base64,
        audioFileName: file.name,
        audioOption: 'UPLOAD',
        greetingText: prev.greetingText || `Uploaded Audio: ${file.name}`,
      }));
      setPreviewAudioUrl(base64);
      showNotification('success', `Audio file '${file.name}' loaded!`);
    };
    reader.readAsDataURL(file);
  };

  const handleTestTtsAudio = () => {
    if (!ivrForm.greetingText.trim()) return;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(ivrForm.greetingText.trim());
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
      showNotification('success', 'Playing Text-to-Speech preview through speaker.');
    } else {
      showNotification('error', 'Browser does not support SpeechSynthesis.');
    }
  };

  const handleCreateIvr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!ivrForm.name.trim()) {
      showNotification('error', 'IVR Workflow Name is required.');
      return;
    }

    let greetingText = ivrForm.greetingText.trim();
    if (!greetingText && ivrForm.audioOption !== 'TTS') {
      greetingText = ivrForm.audioFileName ? `[Recorded Voice: ${ivrForm.audioFileName}]` : 'Recorded Custom IVR Voice';
    }

    if (!greetingText && !ivrForm.audioUrl) {
      showNotification('error', 'Please provide either spoken text or recorded/uploaded audio.');
      return;
    }

    const payload = {
      name: ivrForm.name.trim(),
      greetingText,
      audioUrl: ivrForm.audioOption !== 'TTS' ? ivrForm.audioUrl : undefined,
      audioFileName: ivrForm.audioOption !== 'TTS' ? ivrForm.audioFileName : undefined,
      timeoutSeconds: ivrForm.timeoutSeconds || 8,
      options: [
        { key: '1', action: 'TRANSFER_TO_AGENT', label: 'Transfer to Live Human Agent' },
        { key: '2', action: 'REPEAT_MENU', label: 'Repeat Menu Prompt' },
        { key: '3', action: 'END_CALL', label: 'End Call' },
      ],
    };

    try {
      const res = await fetch('/api/manager/ivr-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showNotification('error', data.error || 'Failed to save IVR workflow.');
        return;
      }

      showNotification('success', `IVR voice '${data.name || payload.name}' saved! Key 1 will transfer to live agent.`);
      setShowCreateIvrModal(false);
      setIvrForm({
        name: '',
        greetingText: 'Hello and welcome. Press 1 to speak with our live representative agent.',
        audioOption: 'TTS',
        audioUrl: '',
        audioFileName: '',
        key1Action: 'TRANSFER_TO_AGENT',
        timeoutSeconds: 8,
      });
      setPreviewAudioUrl(null);
      await fetchData();
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  const handleDeleteIvr = async (id: string, name: string) => {
    if (!token) return;
    if (!confirm(`Are you sure you want to delete IVR voice '${name}'?`)) return;
    try {
      const res = await fetch(`/api/manager/ivr-configs/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showNotification('success', `IVR voice '${name}' deleted.`);
        await fetchData();
      } else {
        const data = await res.json().catch(() => ({}));
        showNotification('error', data.error || 'Failed to delete IVR voice.');
      }
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  // ==========================================
  // VOICEMAIL & VOICEMAIL DROP HANDLERS
  // ==========================================
  const handlePreviewVoicemailAudio = (template: VoicemailTemplateItem) => {
    if (playingVoicemailId === template.id) {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setPlayingVoicemailId(null);
      return;
    }

    if (template.type === 'TTS_GENERATED' && template.ttsText) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(template.ttsText);
        utterance.rate = 0.95;
        utterance.pitch = template.voiceGender === 'MALE' ? 0.9 : 1.1;
        utterance.lang = template.voiceLanguage || 'en-US';
        utterance.onend = () => setPlayingVoicemailId(null);
        utterance.onerror = () => setPlayingVoicemailId(null);
        setPlayingVoicemailId(template.id);
        window.speechSynthesis.speak(utterance);
        showNotification('success', `Playing TTS audio preview: "${template.name}"`);
      } else {
        showNotification('error', 'Browser SpeechSynthesis is not supported on this device.');
      }
    } else if (template.audioUrl) {
      try {
        const audio = new Audio(template.audioUrl);
        setPlayingVoicemailId(template.id);
        audio.play();
        audio.onended = () => setPlayingVoicemailId(null);
        audio.onerror = () => {
          setPlayingVoicemailId(null);
          showNotification('error', 'Unable to play audio URL source.');
        };
      } catch (err: any) {
        setPlayingVoicemailId(null);
        showNotification('error', err.message);
      }
    }
  };

  const handleCreateVoicemail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!voicemailForm.name.trim()) {
      showNotification('error', 'Voicemail template name is required.');
      return;
    }

    try {
      const res = await fetch('/api/voicemails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: voicemailForm.name.trim(),
          description: voicemailForm.description.trim() || undefined,
          type: voicemailForm.type,
          ttsText: voicemailForm.type === 'TTS_GENERATED' ? voicemailForm.ttsText.trim() : undefined,
          audioUrl: voicemailForm.type === 'AUDIO_FILE' ? voicemailForm.audioUrl.trim() : undefined,
          voiceGender: voicemailForm.voiceGender,
          voiceLanguage: voicemailForm.voiceLanguage,
          durationSeconds: Number(voicemailForm.durationSeconds) || 15,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showNotification('error', data.error || 'Failed to create voicemail template.');
        return;
      }

      showNotification('success', `Voicemail template "${data.name}" saved! Available for campaigns.`);
      setShowCreateVoicemailModal(false);
      setVoicemailForm({
        name: '',
        description: '',
        type: 'TTS_GENERATED',
        ttsText: 'Hello, this is our customer service team following up on your request. Please call us back or check your account portal.',
        audioUrl: '',
        voiceGender: 'FEMALE',
        voiceLanguage: 'en-US',
        durationSeconds: 15,
      });
      fetchData();
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  const handleDeleteVoicemail = async (id: string, name: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/voicemails/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showNotification('success', `Voicemail template "${name}" deleted.`);
        fetchData();
      } else {
        const data = await res.json();
        showNotification('error', data.error || 'Failed to delete template.');
      }
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  const handleManagerInstantDrop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!managerInstantDropForm.targetNumber.trim()) {
      showNotification('error', 'Destination phone number is required.');
      return;
    }

    try {
      setIsManagerDropping(true);
      setManagerInstantDropResult(null);

      const res = await fetch('/api/voicemail-drops/instant-drop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          targetNumber: managerInstantDropForm.targetNumber.trim(),
          voicemailId: managerInstantDropForm.voicemailId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showNotification('error', data.error || 'Voicemail drop dispatch failed.');
        setIsManagerDropping(false);
        return;
      }

      setManagerInstantDropResult(data);
      showNotification('success', `Voicemail dropped successfully to ${data.customerNumber}!`);
      setIsManagerDropping(false);
      fetchData();
    } catch (err: any) {
      setIsManagerDropping(false);
      showNotification('error', err.message);
    }
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Top Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Manager Operations Hub</h2>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2.5 py-0.5 rounded-full border border-emerald-200">
              Live PSTN Gateway
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Logged in as <strong>{user?.name}</strong> (@{user?.username}) &middot; Route managed by Administrator
          </p>
        </div>

        {/* Global Action Refresh */}
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-3.5 rounded-lg border text-xs flex items-center justify-between shadow-xs ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-xs font-bold hover:opacity-75">
            &times;
          </button>
        </div>
      )}

      {/* 4 Clean Navigation Tabs (No SIP, No VoIP) */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('campaigns')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'campaigns'
                ? 'border-blue-700 text-blue-800'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <PlayCircle className="w-4 h-4" />
            <span>Campaigns</span>
            <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">
              {campaigns.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('ivr')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'ivr'
                ? 'border-blue-700 text-blue-800'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Mic className="w-4 h-4 text-indigo-600" />
            <span>IVR Studio & Voice</span>
            <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">
              {ivrs.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('voicemails')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'voicemails'
                ? 'border-blue-700 text-blue-800'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Voicemail className="w-4 h-4 text-indigo-600" />
            <span>Voicemail Drops</span>
            {voicemailDrops.length > 0 && (
              <span className="bg-indigo-100 text-indigo-800 font-bold text-xs px-2 py-0.5 rounded-full">
                {voicemailDrops.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('agents')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'agents'
                ? 'border-blue-700 text-blue-800'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Agents</span>
            <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">
              {agents.length}/{maxAgents}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('calls')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'calls'
                ? 'border-blue-700 text-blue-800'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Phone className="w-4 h-4 text-emerald-600" />
            <span>Call Status & Monitor</span>
            <span className="bg-emerald-100 text-emerald-800 font-bold text-xs px-2 py-0.5 rounded-full">
              {calls.length}
            </span>
          </button>
        </nav>
      </div>

      {/* ========================================== */}
      {/* TAB 1: CAMPAIGNS */}
      {/* ========================================== */}
      {activeTab === 'campaigns' && (
        <div className="space-y-6">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shadow-xs">
            <div className="flex items-center gap-2 text-emerald-900 font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>
                <strong>Admin Route Enforced:</strong> All outbound campaign calls automatically utilize the PSTN trunk assigned by the administrator.
              </span>
            </div>
            <span className="text-[11px] bg-emerald-200/80 text-emerald-900 font-bold px-2 py-0.5 rounded">
              PSTN Ready
            </span>
          </div>

          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Outbound Campaigns</h3>
              <p className="text-xs text-slate-500">
                Create a campaign, select your IVR recorded voice, and immediately dial physical PSTN mobile numbers
              </p>
            </div>
            <button
              onClick={() => {
                const defaultRouting = managerPolicy.allowedRoutingMode === 'AI_VOICE_TRANSLATION'
                  ? 'AI_VOICE_TRANSLATION'
                  : 'IVR_THEN_DIRECT_AGENT';
                setCampaignForm({
                  name: `Campaign ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
                  ivrConfigId: ivrs[0]?.id || '',
                  targetPhone: '',
                  csvText: '',
                  routingType: defaultRouting,
                  agentLanguage: managerPolicy.enforcedAgentLanguage || 'Urdu',
                  customerLanguage: managerPolicy.enforcedCustomerLanguage || 'Arabic',
                  autoDetectCustomerLanguage: false,
                  aiBotGreeting: 'مرحباً، جاري توصيلك بممثل الخدمة',
                  voicemailDropEnabled: true,
                  voicemailTemplateId: '',
                });
                setShowCreateCampaignModal(true);
              }}
              className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-3.5 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Campaign</span>
            </button>
          </div>

          {campaigns.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-500 space-y-3">
              <PlayCircle className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-700">No campaigns created yet</p>
              <p className="text-xs max-w-sm mx-auto">
                Click <strong>Create Campaign</strong> above to enter your mobile number, select an IVR voice, and place a real outbound PSTN call!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {campaigns.map((camp) => (
                <div key={camp.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h4 className="text-base font-bold text-slate-900">{camp.name}</h4>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                            camp.status === 'RUNNING'
                              ? 'bg-emerald-100 text-emerald-800 animate-pulse'
                              : camp.status === 'COMPLETED'
                              ? 'bg-blue-100 text-blue-800'
                              : camp.status === 'PAUSED'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {camp.status}
                        </span>
                        {camp.routingType === 'AI_VOICE_TRANSLATION' ? (
                          <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-emerald-600" />
                            <span>AI Translation ({camp.agentLanguage || 'Urdu'} ⇄ {camp.customerLanguage || 'Arabic'})</span>
                          </span>
                        ) : (
                          <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                            <span>📞 IVR → Direct Agent</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        IVR Voice: <strong>{ivrs.find((i) => i.id === camp.ivrConfigId)?.name || 'Standard Service Menu'}</strong> &middot; Created on {new Date(camp.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {camp.status === 'RUNNING' ? (
                        <button
                          onClick={() => handlePauseCampaign(camp.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                        >
                          <Pause className="w-3.5 h-3.5" />
                          <span>Pause</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRunCampaign(camp.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Dial / Run Now</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Campaign Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 text-center">
                    <div className="bg-slate-50 p-2.5 rounded-lg">
                      <div className="text-[11px] text-slate-500">Total Numbers</div>
                      <div className="text-lg font-bold text-slate-900 font-mono">{camp.totalContacts}</div>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-lg">
                      <div className="text-[11px] text-slate-500">Answered by Recipient</div>
                      <div className="text-lg font-bold text-blue-700 font-mono">{camp.answeredCount}</div>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-lg">
                      <div className="text-[11px] text-slate-500">Connected with Agent</div>
                      <div className="text-lg font-bold text-emerald-700 font-mono">{camp.agentConnectedCount}</div>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-lg">
                      <div className="text-[11px] text-slate-500">Completed / Closed</div>
                      <div className="text-lg font-bold text-slate-700 font-mono">{camp.ivrCompletedCount}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 2: IVR STUDIO & VOICE RECORDINGS */}
      {/* ========================================== */}
      {activeTab === 'ivr' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">IVR Studio & Recorded Prompts</h3>
              <p className="text-xs text-slate-500">
                Upload or record voice prompts that PSTN callers hear, and configure the DTMF key that bridges to your human agents
              </p>
            </div>
            <button
              onClick={() => {
                setIvrForm({
                  name: `Voice Prompt ${ivrs.length + 1}`,
                  greetingText: 'Hello and welcome. Press 1 on your phone keypad to speak with our live representative agent.',
                  audioOption: 'TTS',
                  audioUrl: '',
                  audioFileName: '',
                  key1Action: 'TRANSFER_TO_AGENT',
                  timeoutSeconds: 8,
                });
                setShowCreateIvrModal(true);
              }}
              className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-3.5 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Record / Create IVR Voice</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ivrs.map((ivr) => (
              <div key={ivr.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Mic className="w-4 h-4 text-indigo-600" />
                      <span>{ivr.name}</span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Type: <strong>{ivr.audioUrl ? 'Uploaded / Recorded Audio' : 'Text-to-Speech Engine'}</strong>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] bg-indigo-50 text-indigo-800 font-bold px-2 py-0.5 rounded border border-indigo-200">
                      DTMF Key 1 &rarr; Agent
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteIvr(ivr.id, ivr.name)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                      title="Delete IVR Voice"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {ivr.audioUrl ? (
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                    <div className="text-xs text-slate-700 font-medium flex items-center gap-1.5">
                      <FileAudio className="w-4 h-4 text-blue-600" />
                      <span>Recorded Audio File: {ivr.audioFileName || 'ivr_voice_prompt.wav'}</span>
                    </div>
                    <audio controls className="w-full h-8" src={ivr.audioUrl} />
                  </div>
                ) : (
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1 text-xs">
                    <span className="font-semibold text-slate-600 block">Voice Text Prompt:</span>
                    <p className="italic text-slate-800">"{ivr.greetingText}"</p>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                  <span>Routing: <strong>Press 1 &rarr; Live Human Agent</strong></span>
                  <span>Input Timeout: <strong>{ivr.timeoutSeconds}s</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 3: VOICEMAIL DROPS MANAGEMENT */}
      {/* ========================================== */}
      {activeTab === 'voicemails' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
                  <Voicemail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight">Voicemail Library & PSTN Drops</h3>
                  <p className="text-xs text-slate-500">
                    Custom & system voicemail templates delivered when customer does not pick up or line is busy
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setManagerInstantDropResult(null);
                  setManagerInstantDropForm({
                    targetNumber: '+12099722359',
                    voicemailId: voicemails[0]?.id || '',
                  });
                  setShowManagerInstantDropModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                <Zap className="w-4 h-4 text-indigo-600" />
                <span>Test Instant Voicemail Drop</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setVoicemailForm({
                    name: '',
                    description: '',
                    type: 'TTS_GENERATED',
                    ttsText: 'Hello, this is our customer care team following up on your request. Please give us a callback or check your account.',
                    audioUrl: '',
                    voiceGender: 'FEMALE',
                    voiceLanguage: 'en-US',
                    durationSeconds: 15,
                  });
                  setShowCreateVoicemailModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>New Voicemail Audio</span>
              </button>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-xs">
              <div className="text-[11px] text-slate-500 font-medium">Available Templates</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{voicemails.length}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Ready to drop on campaigns</div>
            </div>

            <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-xs">
              <div className="text-[11px] text-slate-500 font-medium">Delivered to PSTN</div>
              <div className="text-2xl font-bold text-emerald-700 mt-1">
                {voicemailDrops.filter((d) => d.status === 'DELIVERED').length}
              </div>
              <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                {voicemailDrops.length > 0
                  ? `${Math.round((voicemailDrops.filter((d) => d.status === 'DELIVERED').length / voicemailDrops.length) * 100)}% delivery rate`
                  : '100% target'}
              </div>
            </div>

            <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-xs">
              <div className="text-[11px] text-slate-500 font-medium">No-Answer Drops</div>
              <div className="text-2xl font-bold text-amber-700 mt-1">
                {voicemailDrops.filter((d) => d.triggerReason === 'NO_ANSWER').length}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Dropped after 45s ringing</div>
            </div>

            <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-xs">
              <div className="text-[11px] text-slate-500 font-medium">Busy Line Drops</div>
              <div className="text-2xl font-bold text-rose-700 mt-1">
                {voicemailDrops.filter((d) => d.triggerReason === 'BUSY').length}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Recipient busy / declined</div>
            </div>
          </div>

          {/* Voicemail Templates Library */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold text-slate-900">Voicemail Library</h4>
                <p className="text-xs text-slate-500">Audio and TTS messages selectable in your campaigns</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {voicemails.map((vm) => {
                const isPlaying = playingVoicemailId === vm.id;
                return (
                  <div
                    key={vm.id}
                    className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-indigo-300 transition-all flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-sm text-slate-900">{vm.name}</span>
                            {vm.isDefault && (
                              <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded border border-amber-200">
                                ★ Default
                              </span>
                            )}
                            <span className="text-[10px] bg-slate-100 text-slate-600 font-medium px-1.5 py-0.5 rounded">
                              {vm.managerId ? 'My Template' : 'System Template'}
                            </span>
                          </div>
                          {vm.description && (
                            <p className="text-xs text-slate-500 mt-1">{vm.description}</p>
                          )}
                        </div>

                        {vm.managerId && (
                          <button
                            type="button"
                            title="Delete template"
                            onClick={() => handleDeleteVoicemail(vm.id, vm.name)}
                            className="p-1 text-slate-400 hover:text-red-700 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Message preview */}
                      <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-700 leading-relaxed font-sans">
                        {vm.type === 'TTS_GENERATED' ? (
                          <span>&ldquo;{vm.ttsText || 'No text defined'}&rdquo;</span>
                        ) : (
                          <div className="flex items-center gap-1.5 text-indigo-700 font-mono text-[11px] truncate">
                            <Volume2 className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{vm.audioUrl || 'Custom Audio File'}</span>
                          </div>
                        )}
                      </div>

                      {/* Meta Tags */}
                      <div className="flex items-center gap-2 mt-2.5 text-[11px] text-slate-500 flex-wrap">
                        <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-medium">
                          {vm.type === 'TTS_GENERATED' ? 'TTS Generated' : 'Audio File'}
                        </span>
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
                          {vm.durationSeconds}s duration
                        </span>
                        {vm.voiceLanguage && (
                          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                            {vm.voiceLanguage}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handlePreviewVoicemailAudio(vm)}
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                          isPlaying
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                        }`}
                      >
                        <Volume2 className={`w-3.5 h-3.5 ${isPlaying ? 'animate-bounce' : ''}`} />
                        <span>{isPlaying ? 'Stop Preview' : 'Listen Preview'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setManagerInstantDropResult(null);
                          setManagerInstantDropForm({
                            targetNumber: '+12099722359',
                            voicemailId: vm.id,
                          });
                          setShowManagerInstantDropModal(true);
                        }}
                        className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-indigo-700 font-medium cursor-pointer"
                      >
                        <span>Test Drop</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Drops History Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-3 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h4 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Voicemail className="w-4 h-4 text-indigo-600" />
                  <span>Campaign Voicemail Drop Logs</span>
                </h4>
                <p className="text-xs text-slate-500">
                  Voicemails delivered to recipients when calls went unanswered or busy
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  placeholder="Search phone number..."
                  value={voicemailSearch}
                  onChange={(e) => setVoicemailSearch(e.target.value)}
                  className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 w-44 focus:ring-2 focus:ring-indigo-500"
                />

                <select
                  value={voicemailFilterReason}
                  onChange={(e) => setVoicemailFilterReason(e.target.value)}
                  className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white font-medium text-slate-700"
                >
                  <option value="ALL">All Trigger Reasons</option>
                  <option value="NO_ANSWER">No Answer (Unanswered)</option>
                  <option value="BUSY">User Busy / Rejected</option>
                  <option value="CARRIER_TIMEOUT">Carrier Timeout (45s)</option>
                  <option value="ANSWERING_MACHINE_DETECTED">Answering Machine</option>
                </select>

                <button
                  type="button"
                  onClick={fetchData}
                  className="p-1.5 border border-slate-300 text-slate-600 hover:bg-slate-100 rounded-lg"
                  title="Refresh drops"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Recipient PSTN</th>
                    <th className="py-2.5 px-3">Caller ID</th>
                    <th className="py-2.5 px-3">Trigger Reason</th>
                    <th className="py-2.5 px-3">Voicemail Template</th>
                    <th className="py-2.5 px-3">Duration</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Carrier Token</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {voicemailDrops
                    .filter((d) => {
                      if (voicemailFilterReason !== 'ALL' && d.triggerReason !== voicemailFilterReason) return false;
                      if (
                        voicemailSearch &&
                        !d.customerNumber.toLowerCase().includes(voicemailSearch.toLowerCase()) &&
                        !d.voicemailName.toLowerCase().includes(voicemailSearch.toLowerCase())
                      )
                        return false;
                      return true;
                    })
                    .map((drop) => {
                      return (
                        <tr key={drop.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                            {new Date(drop.timestamp).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                            {drop.customerNumber}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">
                            {drop.callerId || '+18045930160'}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                drop.triggerReason === 'NO_ANSWER'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : drop.triggerReason === 'BUSY'
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                  : drop.triggerReason === 'CARRIER_TIMEOUT'
                                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                  : 'bg-purple-100 text-purple-800 border border-purple-200'
                              }`}
                            >
                              {drop.triggerReason.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-800">
                            {drop.voicemailName}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">
                            {drop.audioDurationSeconds}s
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                                drop.status === 'DELIVERED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : drop.status === 'DROPPING'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {drop.status === 'DELIVERED' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                              <span>{drop.status}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[10px] text-slate-400">
                            {drop.carrierReceipt || drop.id.substring(0, 16)}
                          </td>
                        </tr>
                      );
                    })}
                  {voicemailDrops.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                        No voicemail drops recorded yet. If recipient doesn&apos;t answer or is busy, a voicemail drop will appear here.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 4: AGENTS MANAGEMENT */}
      {/* ========================================== */}
      {activeTab === 'agents' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Representative Human Agents</h3>
              <p className="text-xs text-slate-500">
                Created <strong>{agents.length}</strong> of maximum <strong>{maxAgents}</strong> allocated by administrator
              </p>
            </div>
            <button
              onClick={() => {
                setAgentForm({ name: '', username: '', password: '', phoneNumber: '' });
                setShowCreateAgentModal(true);
              }}
              disabled={agents.length >= maxAgents}
              className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white px-3.5 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Agent</span>
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold text-xs">
                <tr>
                  <th className="py-3 px-4 text-left">Agent Name</th>
                  <th className="py-3 px-4 text-left">Login Username</th>
                  <th className="py-3 px-4 text-left">Audio Channel</th>
                  <th className="py-3 px-4 text-left">Live Status</th>
                  <th className="py-3 px-4 text-left">Active Call</th>
                  <th className="py-3 px-4 text-left">Account</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {agents.map((agent) => (
                  <tr key={agent.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400" />
                      <span>{agent.name}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-mono text-xs">@{agent.username}</td>
                    <td className="py-3 px-4 text-xs font-mono">
                      {agent.phoneNumber ? (
                        <span className="text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          📱 {agent.phoneNumber}
                        </span>
                      ) : (
                        <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          🎧 WebRTC Browser Terminal
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                          agent.state === 'AVAILABLE'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : agent.state === 'RINGING'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                            : agent.state === 'BUSY'
                            ? 'bg-red-100 text-red-800 border border-red-300'
                            : agent.state === 'WRAP-UP'
                            ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {agent.state === 'OFFLINE' ? 'OFF DUTY' : agent.state}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 font-mono">
                      {agent.currentCallId ? agent.currentCallId.substring(0, 16) : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-semibold ${agent.enabled ? 'text-emerald-700' : 'text-red-600'}`}>
                        {agent.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => handleToggleAgent(agent)}
                        className="text-xs p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                        title={agent.enabled ? 'Disable Agent' : 'Enable Agent'}
                      >
                        {agent.enabled ? <UserX className="w-4 h-4 text-amber-700" /> : <UserCheck className="w-4 h-4 text-emerald-700" />}
                      </button>
                      <button
                        onClick={() => setResetPassAgentId(agent.id)}
                        className="text-xs p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                        title="Reset Password"
                      >
                        <KeyRound className="w-4 h-4 text-blue-700" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 4: CALL STATUS & LIVE MONITOR */}
      {/* ========================================== */}
      {activeTab === 'calls' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Radio className="w-5 h-5 text-emerald-600 animate-pulse" />
                <span>Real-Time Call Monitor & Telephony Status</span>
              </h3>
              <p className="text-xs text-slate-500">
                Live monitoring of calling numbers, call status, duration, DTMF keys pressed, and connected agents
              </p>
            </div>
            <button
              onClick={fetchData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Update Log</span>
            </button>
          </div>

          {/* Real-time Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            <div className="bg-white p-3.5 border border-slate-200 rounded-xl shadow-xs">
              <div className="text-xs text-slate-500 font-medium">Total Placed</div>
              <div className="text-2xl font-black text-slate-900 font-mono mt-0.5">{callsSummary.total}</div>
            </div>
            <div className="bg-white p-3.5 border border-slate-200 rounded-xl shadow-xs">
              <div className="text-xs text-slate-500 font-medium">Recipient Answered</div>
              <div className="text-2xl font-black text-blue-700 font-mono mt-0.5">{callsSummary.answered}</div>
            </div>
            <div className="bg-white p-3.5 border border-slate-200 rounded-xl shadow-xs">
              <div className="text-xs text-slate-500 font-medium">In Call With Agent</div>
              <div className="text-2xl font-black text-emerald-700 font-mono mt-0.5">{callsSummary.bridged}</div>
            </div>
            <div className="bg-white p-3.5 border border-slate-200 rounded-xl shadow-xs">
              <div className="text-xs text-slate-500 font-medium">Completed</div>
              <div className="text-2xl font-black text-indigo-700 font-mono mt-0.5">{callsSummary.completed}</div>
            </div>
            <div className="bg-white p-3.5 border border-slate-200 rounded-xl shadow-xs">
              <div className="text-xs text-slate-500 font-medium">Failed / No Answer</div>
              <div className="text-2xl font-black text-red-600 font-mono mt-0.5">{callsSummary.failed}</div>
            </div>
          </div>

          {/* Calls Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold text-xs">
                <tr>
                  <th className="py-3 px-4 text-left">Recipient Phone</th>
                  <th className="py-3 px-4 text-left">Call Status</th>
                  <th className="py-3 px-4 text-left">Duration</th>
                  <th className="py-3 px-4 text-left">DTMF Key Pressed</th>
                  <th className="py-3 px-4 text-left">Connected Agent</th>
                  <th className="py-3 px-4 text-left">Caller ID</th>
                  <th className="py-3 px-4 text-left">Timestamp / Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {calls.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                      No calls placed yet. Launch a campaign to see live call progress.
                    </td>
                  </tr>
                ) : (
                  calls.map((call) => {
                    const agentName = agents.find((a) => a.id === call.agentId)?.name || (call.agentId ? 'Agent Assigned' : '—');
                    return (
                      <tr key={call.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-900 font-mono text-xs">
                          {call.customerNumber}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-xs px-2.5 py-0.5 rounded-full font-bold inline-flex items-center gap-1 ${
                              call.status === 'BRIDGED' || call.status === 'ANSWERED'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : call.status === 'IVR_ACTIVE'
                                ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                                : call.status === 'DIALING' || call.status === 'RINGING'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                                : call.status === 'COMPLETED'
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : 'bg-red-100 text-red-800 border border-red-200'
                            }`}
                          >
                            <span>{call.status === 'IVR_ACTIVE' ? 'IVR VOICE ACTIVE' : call.status}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-700">
                          {formatSeconds(call.durationSeconds || 0)}
                        </td>
                        <td className="py-3 px-4">
                          {call.dtmfSequence ? (
                            <span className="font-mono font-bold text-xs bg-indigo-100 text-indigo-900 border border-indigo-200 px-2 py-0.5 rounded inline-flex items-center gap-1">
                              <span>Key [{call.dtmfSequence}]</span>
                              <span>&rarr;</span>
                              <span className="text-emerald-700 font-semibold">Bridged with Agent</span>
                            </span>
                          ) : call.status === 'IVR_ACTIVE' ? (
                            <div className="flex flex-col gap-1 items-start">
                              <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                                <Radio className="w-2.5 h-2.5 text-indigo-600 animate-pulse" />
                                <span>Playing IVR Voice Prompt</span>
                              </span>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    const res = await fetch('/api/customer/dtmf', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ callId: call.id, digit: '1' }),
                                    });
                                    if (res.ok) {
                                      showNotification('success', 'DTMF Key 1 confirmed! Agent station ring beep sounding for 3 seconds -> Auto-connecting call with zero clicks.');
                                      fetchData();
                                    }
                                  } catch (err: any) {
                                    showNotification('error', err.message);
                                  }
                                }}
                                className="text-[10px] font-bold px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1"
                                title="Press DTMF Key 1 to trigger agent bridge"
                              >
                                <span>Press [1] &rarr; Bridge Agent</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs font-semibold text-slate-800">
                          {agentName}
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-mono text-xs">
                          {call.callerId}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500">
                          <div>{new Date(call.startTime).toLocaleTimeString()}</div>
                          {call.notes && (
                            <div className="text-[11px] text-slate-700 italic truncate max-w-xs mt-0.5">
                              "{call.notes}"
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: CREATE AGENT */}
      {/* ========================================== */}
      {showCreateAgentModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Create Representative Agent</h3>
                <p className="text-xs text-slate-500">
                  {agents.length} of {maxAgents} agent accounts currently in use
                </p>
              </div>
              <button
                onClick={() => setShowCreateAgentModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateAgent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Agent Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={agentForm.name}
                  onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Login Username</label>
                <input
                  type="text"
                  required
                  placeholder="agent_johnd"
                  value={agentForm.username}
                  onChange={(e) => setAgentForm({ ...agentForm, username: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  placeholder="Minimum 6 characters"
                  value={agentForm.password}
                  onChange={(e) => setAgentForm({ ...agentForm, password: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Physical Mobile Phone Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. +12099722359 (for real phone-to-phone ringing)"
                  value={agentForm.phoneNumber}
                  onChange={(e) => setAgentForm({ ...agentForm, phoneNumber: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 font-mono focus:ring-2 focus:ring-blue-600"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Leave blank for browser WebRTC audio, or provide an external phone number to ring a real physical mobile SIM.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateAgentModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg shadow-sm cursor-pointer"
                >
                  Create Agent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESET AGENT PASSWORD */}
      {resetPassAgentId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 space-y-4 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Reset Agent Password</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">New Password</label>
              <input
                type="password"
                required
                placeholder="New password"
                value={newAgentPassword}
                onChange={(e) => setNewAgentPassword(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResetPassAgentId(null)}
                className="px-3 py-1.5 border border-slate-300 text-slate-700 text-xs rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleResetAgentPassword(resetPassAgentId)}
                className="px-3 py-1.5 bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Save Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: CREATE CAMPAIGN */}
      {/* ========================================== */}
      {showCreateCampaignModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-5 border border-slate-200 my-8">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Create Outbound Campaign</h3>
                <p className="text-xs text-slate-500">Configure campaign and dial real physical PSTN numbers</p>
              </div>
              <button
                onClick={() => setShowCreateCampaignModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Campaign Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Real PSTN Calling Campaign"
                  value={campaignForm.name}
                  onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-600"
                />
              </div>

              {/* Admin Route Badge (No SIP/VoIP Selection) */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-emerald-900 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Carrier Route: Admin-Assigned Route</span>
                </div>
                <span className="text-[11px] bg-emerald-200/80 text-emerald-900 font-bold px-2 py-0.5 rounded">
                  PSTN Connected
                </span>
              </div>

              {/* Campaign Routing & Bridge Mode Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800">
                    Campaign Routing Mode:
                  </label>
                  {managerPolicy.allowedRoutingMode !== 'BOTH' && (
                    <span className="text-[10px] bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-full border border-amber-200">
                      Enforced by Admin Policy
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {/* Option 1: IVR then Direct Agent */}
                  {(managerPolicy.allowedRoutingMode === 'BOTH' || managerPolicy.allowedRoutingMode === 'IVR_THEN_DIRECT_AGENT') && (
                    <label className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                      campaignForm.routingType === 'IVR_THEN_DIRECT_AGENT'
                        ? 'bg-blue-50/70 border-blue-400 ring-1 ring-blue-400'
                        : 'bg-slate-50 border-slate-200'
                    }`}>
                      <input
                        type="radio"
                        name="campaignRouting"
                        disabled={managerPolicy.allowedRoutingMode !== 'BOTH'}
                        checked={campaignForm.routingType === 'IVR_THEN_DIRECT_AGENT'}
                        onChange={() => setCampaignForm({ ...campaignForm, routingType: 'IVR_THEN_DIRECT_AGENT' })}
                        className="mt-0.5 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                          <span>Option 1: Traditional IVR Menu → Direct Human Agent Bridge</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          PSTN recipient answers, hears IVR voice prompt, presses DTMF key 1, and bridges directly with live agent in normal voice.
                        </div>
                      </div>
                    </label>
                  )}

                  {/* Option 2: AI Real-Time Voice Translation Bot */}
                  {(managerPolicy.allowedRoutingMode === 'BOTH' || managerPolicy.allowedRoutingMode === 'AI_VOICE_TRANSLATION') && (
                    <label className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                      campaignForm.routingType === 'AI_VOICE_TRANSLATION'
                        ? 'bg-emerald-50/70 border-emerald-400 ring-1 ring-emerald-400'
                        : 'bg-slate-50 border-slate-200'
                    }`}>
                      <input
                        type="radio"
                        name="campaignRouting"
                        disabled={managerPolicy.allowedRoutingMode !== 'BOTH'}
                        checked={campaignForm.routingType === 'AI_VOICE_TRANSLATION'}
                        onChange={() => setCampaignForm({ ...campaignForm, routingType: 'AI_VOICE_TRANSLATION' })}
                        className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                      />
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Option 2: Real-Time AI Voice Translation Bot Bridge</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          PSTN recipient hears AI Bot voice. Agent speaks in their language (Urdu), receiver hears translated bot voice (Arabic). When customer speaks Arabic, agent hears translated voice in Urdu!
                        </div>
                      </div>
                    </label>
                  )}
                </div>
              </div>

              {/* IF OPTION 2: AI TRANSLATION CONFIGURATION */}
              {campaignForm.routingType === 'AI_VOICE_TRANSLATION' && (
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                      <Languages className="w-4 h-4 text-emerald-700" />
                      <span>AI Bidirectional Translation Languages</span>
                    </span>
                    {!managerPolicy.allowManagerOverrideLanguages && (
                      <span className="text-[10px] bg-emerald-200/80 text-emerald-900 font-bold px-2 py-0.5 rounded-full">
                        Admin Enforced
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Agent Speaks (Flow A):
                      </label>
                      <select
                        disabled={!managerPolicy.allowManagerOverrideLanguages}
                        value={campaignForm.agentLanguage}
                        onChange={(e) => setCampaignForm({ ...campaignForm, agentLanguage: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-blue-900 disabled:bg-slate-100 disabled:text-slate-600"
                      >
                        <option value="Urdu">Urdu (اردو)</option>
                        <option value="English">English</option>
                        <option value="Hindi">Hindi (हिन्दी)</option>
                        <option value="Spanish">Spanish (Español)</option>
                        <option value="French">French (Français)</option>
                        <option value="German">German (Deutsch)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Customer Speaks & Hears (Flow B):
                      </label>
                      <select
                        disabled={!managerPolicy.allowManagerOverrideLanguages}
                        value={campaignForm.customerLanguage}
                        onChange={(e) => setCampaignForm({ ...campaignForm, customerLanguage: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-emerald-900 disabled:bg-slate-100 disabled:text-slate-600"
                      >
                        <option value="Arabic">Arabic (العربية)</option>
                        <option value="Urdu">Urdu (اردو)</option>
                        <option value="English">English</option>
                        <option value="French">French (Français)</option>
                        <option value="Spanish">Spanish (Español)</option>
                        <option value="Turkish">Turkish (Türkçe)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Initial Bot Greeting (Spoken to Customer upon answer):
                    </label>
                    <input
                      type="text"
                      value={campaignForm.aiBotGreeting}
                      onChange={(e) => setCampaignForm({ ...campaignForm, aiBotGreeting: e.target.value })}
                      placeholder="e.g. مرحباً، جاري توصيلك بممثل الخدمة"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                </div>
              )}

              {/* IF OPTION 1: SELECT IVR VOICE */}
              {campaignForm.routingType === 'IVR_THEN_DIRECT_AGENT' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Select IVR Voice / Prompt</label>
                  <select
                    required
                    value={campaignForm.ivrConfigId}
                    onChange={(e) => setCampaignForm({ ...campaignForm, ivrConfigId: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2.5 bg-white font-medium"
                  >
                    <option value="">-- Choose IVR Voice --</option>
                    {ivrs.map((ivr) => (
                      <option key={ivr.id} value={ivr.id}>
                        🎙️ {ivr.name} (Key 1 &rarr; Transfer to Live Agent)
                      </option>
                    ))}
                  </select>

                  {/* Selected IVR Voice Live Preview */}
                  {(() => {
                    const selectedIvr = ivrs.find((i) => i.id === campaignForm.ivrConfigId) || ivrs[0];
                    if (!selectedIvr) return null;
                    return (
                      <div className="mt-2 p-2.5 bg-indigo-50/80 border border-indigo-200 rounded-xl text-xs space-y-1.5 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                            <Volume2 className="w-3.5 h-3.5 text-indigo-600" />
                            <span>PSTN Receiver Prompt Voice: {selectedIvr.name}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (selectedIvr.audioUrl) {
                                try {
                                  const a = new Audio(selectedIvr.audioUrl);
                                  a.play();
                                  showNotification('success', `Playing recorded audio: "${selectedIvr.name}"`);
                                  return;
                                } catch {}
                              }
                              if ('speechSynthesis' in window && selectedIvr.greetingText) {
                                window.speechSynthesis.cancel();
                                const clean = selectedIvr.greetingText.replace(/^["']|["']$/g, '').trim();
                                const utt = new SpeechSynthesisUtterance(clean);
                                utt.rate = 1.0;
                                window.speechSynthesis.speak(utt);
                                showNotification('success', `Playing voice preview: "${clean}"`);
                              }
                            }}
                            className="text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-2 py-0.5 rounded shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Volume2 className="w-3 h-3" />
                            <span>Audition Voice</span>
                          </button>
                        </div>
                        <p className="italic text-slate-700 border-l-2 border-indigo-400 pl-2 text-[11px]">
                          "{selectedIvr.greetingText?.replace(/^["']|["']$/g, '').trim()}"
                        </p>
                        <p className="text-[10px] text-slate-500">
                          PSTN recipient will hear this exact voice when they answer their phone.
                        </p>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Recipient Phone Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Destination Phone Number to Call (Real PSTN SIM)
                </label>
                <input
                  type="text"
                  placeholder="+12099722359 or your physical mobile number"
                  value={campaignForm.targetPhone}
                  onChange={(e) => setCampaignForm({ ...campaignForm, targetPhone: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 font-mono focus:ring-2 focus:ring-blue-600"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Enter your physical mobile phone number (with country code, e.g. +1...). The system will dial it immediately.
                </p>
              </div>

              {/* Or paste batch */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Or Paste Multiple Numbers (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="+12099722359, John&#10;+18045930160, Jane"
                  value={campaignForm.csvText}
                  onChange={(e) => setCampaignForm({ ...campaignForm, csvText: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 font-mono focus:ring-2 focus:ring-blue-600"
                />
              </div>

              {/* Voicemail Drop on No-Answer / Busy */}
              <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Voicemail className="w-4 h-4 text-indigo-700 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-slate-900">Enable Voicemail Drop on No-Answer / Busy</div>
                      <div className="text-[11px] text-slate-500">
                        Automatically drops pre-recorded voicemail audio if recipient does not pick up or line is busy
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={campaignForm.voicemailDropEnabled}
                    onChange={(e) => setCampaignForm({ ...campaignForm, voicemailDropEnabled: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                  />
                </div>

                {campaignForm.voicemailDropEnabled && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Voicemail Audio Template:
                    </label>
                    <select
                      value={campaignForm.voicemailTemplateId}
                      onChange={(e) => setCampaignForm({ ...campaignForm, voicemailTemplateId: e.target.value })}
                      className="w-full text-xs border border-indigo-200 bg-white rounded-lg p-2 font-medium"
                    >
                      <option value="">-- Use Default Template (Automatic) --</option>
                      {voicemails.map((vm) => (
                        <option key={vm.id} value={vm.id}>
                          {vm.name} ({vm.durationSeconds}s {vm.type === 'TTS_GENERATED' ? 'TTS' : 'Audio'}) {vm.isDefault ? '★ Default' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Auto-start Toggle */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-800">Auto-Dial Immediately</div>
                  <div className="text-[11px] text-slate-500">Call the destination number as soon as campaign is created</div>
                </div>
                <input
                  type="checkbox"
                  checked={autoStartCampaign}
                  onChange={(e) => setAutoStartCampaign(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateCampaignModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Launch Campaign & Call Now</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: CREATE / RECORD IVR VOICE */}
      {/* ========================================== */}
      {showCreateIvrModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-5 border border-slate-200 my-8">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Set IVR Recorded Voice</h3>
                <p className="text-xs text-slate-500">Record through your microphone or upload audio</p>
              </div>
              <button
                onClick={() => setShowCreateIvrModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateIvr} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">IVR Voice Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Customer Welcome Message"
                  value={ivrForm.name}
                  onChange={(e) => setIvrForm({ ...ivrForm, name: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-600"
                />
              </div>

              {/* Audio Source Options */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Voice Audio Source</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setIvrForm({ ...ivrForm, audioOption: 'RECORD' })}
                    className={`p-3 rounded-lg border text-xs font-bold flex flex-col items-center gap-1.5 transition-colors cursor-pointer ${
                      ivrForm.audioOption === 'RECORD'
                        ? 'bg-indigo-50 border-indigo-600 text-indigo-900'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Mic className="w-5 h-5 text-indigo-600" />
                    <span>Record Mic</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIvrForm({ ...ivrForm, audioOption: 'UPLOAD' })}
                    className={`p-3 rounded-lg border text-xs font-bold flex flex-col items-center gap-1.5 transition-colors cursor-pointer ${
                      ivrForm.audioOption === 'UPLOAD'
                        ? 'bg-blue-50 border-blue-600 text-blue-900'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Upload className="w-5 h-5 text-blue-600" />
                    <span>Upload Audio</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIvrForm({ ...ivrForm, audioOption: 'TTS' })}
                    className={`p-3 rounded-lg border text-xs font-bold flex flex-col items-center gap-1.5 transition-colors cursor-pointer ${
                      ivrForm.audioOption === 'TTS'
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-900'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Volume2 className="w-5 h-5 text-emerald-600" />
                    <span>Text to Speech</span>
                  </button>
                </div>
              </div>

              {/* Source-specific controls */}
              {ivrForm.audioOption === 'RECORD' && (
                <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-4 text-center space-y-3">
                  <div className="text-xs font-semibold text-indigo-900">
                    Record IVR Voice Through Microphone
                  </div>
                  {isRecordingMic ? (
                    <div className="space-y-3">
                      <div className="w-12 h-12 bg-red-600 text-white rounded-full flex items-center justify-center mx-auto animate-pulse">
                        <Square className="w-5 h-5" />
                      </div>
                      <div className="text-sm font-bold text-red-600 font-mono">
                        Recording: {recordingSeconds}s
                      </div>
                      <button
                        type="button"
                        onClick={handleStopMicRecording}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer"
                      >
                        Stop Recording
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={handleStartMicRecording}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Mic className="w-4 h-4" />
                        <span>Start Recording</span>
                      </button>
                      <p className="text-[11px] text-slate-500">
                        Speak your IVR greeting clearly into the microphone.
                      </p>
                    </div>
                  )}

                  {ivrForm.audioUrl && (
                    <div className="pt-2 border-t border-indigo-200 text-left space-y-1">
                      <span className="text-[11px] text-indigo-900 font-semibold">Recorded Voice Preview:</span>
                      <audio controls className="w-full h-8" src={ivrForm.audioUrl} />
                    </div>
                  )}
                </div>
              )}

              {ivrForm.audioOption === 'UPLOAD' && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Upload MP3 or WAV Audio File
                  </label>
                  <input
                    type="file"
                    accept="audio/mp3,audio/wav,audio/*"
                    onChange={handleFileUpload}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white"
                  />
                  {ivrForm.audioUrl && (
                    <div className="p-2 bg-slate-50 rounded border border-slate-200 space-y-1">
                      <span className="text-[11px] text-slate-700 font-semibold">Preview:</span>
                      <audio controls className="w-full h-8" src={ivrForm.audioUrl} />
                    </div>
                  )}
                </div>
              )}

              {ivrForm.audioOption === 'TTS' && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Spoken Voice Text (Played to Caller)
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={ivrForm.greetingText}
                    onChange={(e) => setIvrForm({ ...ivrForm, greetingText: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-600"
                  />
                  <button
                    type="button"
                    onClick={handleTestTtsAudio}
                    className="text-xs text-blue-700 hover:underline font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Listen to Text-To-Speech Preview</span>
                  </button>
                </div>
              )}

              {/* DTMF Key Settings */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2 text-xs">
                <div className="font-semibold text-slate-800">DTMF Keypad Routing:</div>
                <div className="flex items-center justify-between text-slate-700">
                  <span>When caller presses <strong>Key 1</strong>:</span>
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Transfer to Live Agent
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-700">
                  <span>When caller presses <strong>Key 2</strong>:</span>
                  <span>Repeat voice prompt</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateIvrModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg shadow-sm cursor-pointer"
                >
                  Save IVR Voice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL: CREATE VOICEMAIL TEMPLATE */}
      {showCreateVoicemailModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 border border-slate-200 my-8">
            <div className="flex justify-between items-start pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Voicemail className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-slate-900">Create Campaign Voicemail</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateVoicemailModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateVoicemail} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Voicemail Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. VIP Customer Notice"
                  value={voicemailForm.name}
                  onChange={(e) => setVoicemailForm({ ...voicemailForm, name: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Dropped to customers for special promotional follow-up"
                  value={voicemailForm.description}
                  onChange={(e) => setVoicemailForm({ ...voicemailForm, description: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Voicemail Audio Source</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setVoicemailForm({ ...voicemailForm, type: 'TTS_GENERATED' })}
                    className={`p-2.5 rounded-lg border text-left transition-colors flex items-center gap-2 ${
                      voicemailForm.type === 'TTS_GENERATED'
                        ? 'border-indigo-600 bg-indigo-50/80 text-indigo-900 font-bold ring-1 ring-indigo-500'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>🎙️ Text-to-Speech (TTS)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVoicemailForm({ ...voicemailForm, type: 'AUDIO_FILE' })}
                    className={`p-2.5 rounded-lg border text-left transition-colors flex items-center gap-2 ${
                      voicemailForm.type === 'AUDIO_FILE'
                        ? 'border-indigo-600 bg-indigo-50/80 text-indigo-900 font-bold ring-1 ring-indigo-500'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>📁 Audio URL / File</span>
                  </button>
                </div>
              </div>

              {voicemailForm.type === 'TTS_GENERATED' ? (
                <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Voicemail Message Spoken to Customer Answering Machine:
                    </label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Enter the voice message spoken into customer voicemail..."
                      value={voicemailForm.ttsText}
                      onChange={(e) => setVoicemailForm({ ...voicemailForm, ttsText: e.target.value })}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Voice Gender</label>
                      <select
                        value={voicemailForm.voiceGender}
                        onChange={(e: any) => setVoicemailForm({ ...voicemailForm, voiceGender: e.target.value })}
                        className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white"
                      >
                        <option value="FEMALE">Female Voice</option>
                        <option value="MALE">Male Voice</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Language</label>
                      <select
                        value={voicemailForm.voiceLanguage}
                        onChange={(e) => setVoicemailForm({ ...voicemailForm, voiceLanguage: e.target.value })}
                        className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white"
                      >
                        <option value="en-US">English (US)</option>
                        <option value="en-GB">English (UK)</option>
                        <option value="es-ES">Spanish (Español)</option>
                        <option value="ar-SA">Arabic (العربية)</option>
                        <option value="ur-PK">Urdu (اردو)</option>
                        <option value="fr-FR">French (Français)</option>
                        <option value="de-DE">German (Deutsch)</option>
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <label className="block font-semibold text-slate-700 mb-1">Audio File URL (.mp3 / .wav)</label>
                  <input
                    type="url"
                    required
                    placeholder="https://example.com/audio/custom-voicemail.mp3"
                    value={voicemailForm.audioUrl}
                    onChange={(e) => setVoicemailForm({ ...voicemailForm, audioUrl: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 font-mono bg-white"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Audio Duration (seconds)</label>
                <input
                  type="number"
                  min="5"
                  max="180"
                  required
                  value={voicemailForm.durationSeconds}
                  onChange={(e) => setVoicemailForm({ ...voicemailForm, durationSeconds: parseInt(e.target.value, 10) || 15 })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateVoicemailModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
                >
                  Save Voicemail
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MANAGER INSTANT DROP TESTER */}
      {showManagerInstantDropModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 border border-slate-200 my-8">
            <div className="flex justify-between items-start pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Instant Voicemail Drop Tester</h3>
                  <p className="text-xs text-slate-500">Dispatch voicemail directly to recipient PSTN number</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowManagerInstantDropModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleManagerInstantDrop} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Target Mobile Phone Number (e.g. +12099722359)
                </label>
                <input
                  type="text"
                  required
                  placeholder="+12099722359"
                  value={managerInstantDropForm.targetNumber}
                  onChange={(e) => setManagerInstantDropForm({ ...managerInstantDropForm, targetNumber: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 font-mono focus:ring-2 focus:ring-indigo-500 font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Voicemail Template</label>
                <select
                  value={managerInstantDropForm.voicemailId}
                  onChange={(e) => setManagerInstantDropForm({ ...managerInstantDropForm, voicemailId: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white font-medium"
                >
                  <option value="">-- Use Default Template --</option>
                  {voicemails.map((vm) => (
                    <option key={vm.id} value={vm.id}>
                      {vm.name} ({vm.durationSeconds}s, {vm.type === 'TTS_GENERATED' ? 'TTS' : 'Audio'}) {vm.isDefault ? '★' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {managerInstantDropResult && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-1.5 text-emerald-950">
                  <div className="flex items-center gap-2 font-bold text-xs text-emerald-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Voicemail Drop Dispatched to Carrier!</span>
                  </div>
                  <div className="text-[11px] font-mono text-emerald-800 space-y-0.5">
                    <div>Recipient: <strong>{managerInstantDropResult.customerNumber}</strong></div>
                    <div>Template: <strong>{managerInstantDropResult.voicemailName}</strong></div>
                    <div>Receipt: <span className="opacity-80">{managerInstantDropResult.carrierReceipt}</span></div>
                    <div>Status: <span className="font-bold text-emerald-700">{managerInstantDropResult.status}</span></div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowManagerInstantDropModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isManagerDropping}
                  className="px-5 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>{isManagerDropping ? 'Dropping to PSTN...' : 'Drop Voicemail Now'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
