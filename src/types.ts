export type UserRole = 'admin' | 'manager' | 'agent' | 'customer';

export interface UserProfile {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  email?: string;
  managerId?: string;
  agentId?: string;
}

export interface ManagerItem {
  id: string;
  userId: string;
  username: string;
  name: string;
  email?: string;
  maxAgents: number;
  currentAgentsCount: number;
  campaignsCount: number;
  assignedSipCount: number;
  assignedNumbersCount: number;
  assignedVoipCount?: number;
  assignedRouteId?: string;
  assignedRouteName?: string;
  assignedSipIds?: string[];
  assignedVoipIds?: string[];
  enabled: boolean;
  notes?: string;
  allowedRoutingMode?: 'IVR_THEN_DIRECT_AGENT' | 'AI_VOICE_TRANSLATION' | 'BOTH';
  enforcedAgentLanguage?: string;
  enforcedCustomerLanguage?: string;
  allowManagerOverrideLanguages?: boolean;
  aiTranslationBotVoice?: string;
  createdAt: string;
}

export interface AgentItem {
  id: string;
  userId: string;
  managerId: string;
  name: string;
  username: string;
  phoneNumber?: string;
  enabled: boolean;
  state: 'OFFLINE' | 'AVAILABLE' | 'RINGING' | 'BUSY' | 'WRAP-UP';
  currentCallId?: string | null;
  lastStateChange: string;
  createdAt: string;
}

export interface SipConnectionItem {
  id: string;
  connectionId: string;
  providerName: string;
  sipHost: string;
  sipPort: number;
  transport: 'UDP' | 'TCP' | 'TLS';
  authType: 'CREDENTIALS' | 'IP_AUTH';
  username?: string;
  password?: string;
  ipAuthWhitelist?: string;
  defaultCallerId: string;
  supportedCodecs: string[];
  maxChannels: number;
  activeChannels: number;
  priority: number;
  enabled: boolean;
  healthStatus: 'HEALTHY' | 'DEGRADED' | 'FAILED' | 'DISABLED';
  lastHealthCheck?: string;
  lastFailure?: string;
  errorCount: number;
  latencyMs?: number;
  createdAt: string;
}

export interface SipNumberItem {
  id: string;
  phoneNumber: string;
  provider: string;
  sipConnectionId: string;
  authorized: boolean;
  outboundCallerIdEligible: boolean;
  assignedManagerId?: string | null;
  assignedManagerName?: string;
  enabled: boolean;
  createdAt: string;
}

export interface IvrOptionItem {
  id: string;
  key: string;
  action: 'TRANSFER_TO_AGENT' | 'REPEAT_MENU' | 'PLAY_AUDIO' | 'END_CALL';
  label: string;
  transferQueue?: string;
  audioPrompt?: string;
}

export interface IvrConfigItem {
  id: string;
  managerId: string;
  name: string;
  greetingText: string;
  audioUrl?: string;
  audioFileName?: string;
  timeoutSeconds: number;
  maxRetries: number;
  invalidKeyAction: 'REPEAT_MENU' | 'END_CALL';
  options: IvrOptionItem[];
  queueTuneName?: string;
  queueTuneUrl?: string;
  queueGreetingText?: string;
  queueMaxWaitSeconds?: number;
  zadarmaSoundId?: string;
  zadarmaSoundSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignItem {
  id: string;
  managerId: string;
  name: string;
  sipConnectionId: string;
  callerIdNumber: string;
  ivrConfigId: string;
  status: 'DRAFT' | 'READY' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
  totalContacts: number;
  validContacts: number;
  duplicateContacts: number;
  invalidContacts: number;
  answeredCount: number;
  ivrCompletedCount: number;
  agentConnectedCount: number;
  failedCount: number;
  routingType?: 'IVR_THEN_DIRECT_AGENT' | 'AI_VOICE_TRANSLATION';
  agentLanguage?: string;
  customerLanguage?: string;
  autoDetectCustomerLanguage?: boolean;
  aiBotGreeting?: string;
  aiVoicePersona?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface CallItem {
  id: string;
  callId: string;
  campaignId?: string;
  managerId?: string;
  customerNumber: string;
  callerId: string;
  sipConnectionId: string;
  sipResponseCode?: number;
  sipResponseText?: string;
  agentId?: string;
  startTime: string;
  answerTime?: string;
  endTime?: string;
  durationSeconds: number;
  status: 'QUEUED' | 'DIALING' | 'RINGING' | 'ANSWERED' | 'IVR_ACTIVE' | 'BRIDGED' | 'COMPLETED' | 'BUSY' | 'NO_ANSWER' | 'FAILED';
  ivrResult?: string;
  dtmfSequence: string;
  transferResult?: string;
  failureReason?: string;
  queueEnteredAt?: string;
  queueTuneUrl?: string;
  failoverFromConnectionId?: string;
  notes?: string;
  disposition?: string;
}

export interface DtmfEventItem {
  id: string;
  callId: string;
  campaignId?: string;
  managerId?: string;
  customerPhone: string;
  digit: string;
  sequenceNumber: number;
  timestamp: string;
  timeOffsetMs: number;
  resultingAction: string;
}

export interface AuditLogItem {
  id: string;
  actor: string;
  actorRole: string;
  action: string;
  resource: string;
  timestamp: string;
  ipAddress?: string;
  metadata?: Record<string, any>;
}

export interface SystemErrorItem {
  id: string;
  timestamp: string;
  component: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  description: string;
  affectedResource?: string;
  affectedCampaignOrCall?: string;
  automaticAction: string;
  currentStatus: 'RESOLVED' | 'ACTIVE' | 'INVESTIGATING';
}

export interface VoipProviderRules {
  ipPeeringWhitelist: string;
  allowedPrefixes: string[];
  blockedPrefixes: string[];
  rateLimitPerSec: number;
  maxConcurrency: number;
  priority: number;
  failoverFallbackId?: string;
  enforceTls: boolean;
  headerSigningEnabled: boolean;
}

export interface VoipApiProviderItem {
  id: string;
  name: string;
  providerType: 'REST_API' | 'SIP_TRUNK_API' | 'WEBSOCKET_MEDIA' | 'IP_PEERING' | 'SIGNALWIRE' | 'TWILIO' | 'ZADARMA';
  apiEndpoint: string;
  apiKeyEncrypted: string;
  apiSecretEncrypted?: string;
  accountSidOrId?: string;
  webhookSecret?: string;
  sipLogin?: string;
  pbxExtension?: string;
  defaultCallerId?: string;
  webrtcKey?: string;
  region: string;
  rules: VoipProviderRules;
  enabled: boolean;
  healthStatus: 'HEALTHY' | 'DEGRADED' | 'FAILED';
  lastPing?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TranslationTurn {
  id: string;
  callId: string;
  speaker: 'agent' | 'customer';
  originalText: string;
  sourceLanguage: string;
  targetLanguage: string;
  translatedText: string;
  audioBase64?: string;
  latencyMs: number;
  timestamp: string;
  detectedLanguage?: string;
}

export interface TranslationLanguage {
  code: string;
  name: string;
  nativeName: string;
  voiceDefault: string;
}

