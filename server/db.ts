import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'tele_solution_db.json');

// Interface Definitions for all required tables
export interface Role {
  id: string;
  name: 'admin' | 'manager' | 'agent' | 'customer';
  description: string;
}

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
  role: 'admin' | 'manager' | 'agent' | 'customer';
  name: string;
  email?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Manager {
  id: string;
  userId: string;
  name: string;
  maxAgents: number;
  assignedRouteId?: string;
  enabled: boolean;
  notes?: string;
  allowedRoutingMode?: 'IVR_THEN_DIRECT_AGENT' | 'AI_VOICE_TRANSLATION' | 'BOTH';
  enforcedAgentLanguage?: string;
  enforcedCustomerLanguage?: string;
  allowManagerOverrideLanguages?: boolean;
  aiTranslationBotVoice?: string;
  createdAt: string;
}

export interface Agent {
  id: string;
  userId: string;
  managerId: string;
  name: string;
  username: string;
  phoneNumber?: string;
  enabled: boolean;
  currentCallId?: string | null;
  state: 'OFFLINE' | 'AVAILABLE' | 'RINGING' | 'BUSY' | 'WRAP-UP';
  lastStateChange: string;
  createdAt: string;
}

export interface Provider {
  id: string;
  name: string;
  techType: 'SIP' | 'IP_TO_IP' | 'ASTERISK_ARI' | 'FREESWITCH_ESL' | 'KAMAILIO_SBC';
  description: string;
  country: string;
  status: 'ACTIVE' | 'DEGRADED' | 'MAINTENANCE';
  createdAt: string;
}

export interface SipConnection {
  id: string;
  connectionId: string;
  providerName: string;
  sipHost: string;
  sipPort: number;
  transport: 'UDP' | 'TCP' | 'TLS';
  authType: 'CREDENTIALS' | 'IP_AUTH';
  username?: string;
  passwordEncrypted?: string;
  ipAuthWhitelist?: string;
  defaultCallerId: string;
  supportedCodecs: string[]; // ['PCMU', 'PCMA', 'G729', 'OPUS']
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

export interface SipNumber {
  id: string;
  phoneNumber: string;
  provider: string;
  sipConnectionId: string;
  authorized: boolean;
  outboundCallerIdEligible: boolean;
  assignedManagerId?: string | null;
  enabled: boolean;
  createdAt: string;
  isVirtualNumber?: boolean;
  verificationStatus?: 'PENDING_OTP' | 'VERIFIED' | 'FAILED';
  verificationMethod?: 'OTP_SMS' | 'OTP_VOICE' | 'SIP_TRUNK_AUTH';
  verifiedAt?: string;
  directPstnCapable?: boolean;
}

export interface FirewallWhitelistRule {
  id: string;
  ipOrCidr: string;
  description: string;
  allowedPorts: string;
  protocol: 'UDP' | 'TCP' | 'ANY';
  enabled: boolean;
  createdAt: string;
}

export interface FirewallSettings {
  mode: 'PERMISSIVE' | 'STRICT';
  defaultSipPort: number;
  rtpPortRange: string;
  lastUpdated: string;
}

export interface ManagerSipAssignment {
  id: string;
  managerId: string;
  sipConnectionId: string;
  assignedAt: string;
}

export interface ManagerNumberAssignment {
  id: string;
  managerId: string;
  sipNumberId: string;
  assignedAt: string;
}

export interface ManagerVoipAssignment {
  id: string;
  managerId: string;
  voipProviderId: string;
  assignedAt: string;
}

export interface IvrOption {
  id: string;
  key: string; // '1', '2', '3', '*', '#'
  action: 'TRANSFER_TO_AGENT' | 'REPEAT_MENU' | 'PLAY_AUDIO' | 'END_CALL';
  label: string;
  transferQueue?: string;
  audioPrompt?: string;
}

export interface IvrConfig {
  id: string;
  managerId: string;
  name: string;
  greetingText: string;
  audioUrl?: string;
  audioFileName?: string;
  timeoutSeconds: number;
  maxRetries: number;
  invalidKeyAction: 'REPEAT_MENU' | 'END_CALL';
  options: IvrOption[];
  queueTuneName?: string; // 'classical' | 'acoustic' | 'ambient' | 'jazz' | 'chime' | 'custom'
  queueTuneUrl?: string; // e.g. 'http://twimlets.com/holdmusic?Bucket=com.twilio.music.classical' or custom MP3 URL
  queueGreetingText?: string; // Custom spoken queue greeting
  queueMaxWaitSeconds?: number; // Maximum wait duration in seconds before fallback
  zadarmaSoundId?: string; // Uploaded sound identifier in Zadarma Cloud PBX
  zadarmaSoundSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignContact {
  id: string;
  campaignId: string;
  phoneNumber: string;
  customerName?: string;
  status: 'PENDING' | 'QUEUED' | 'DIALING' | 'RINGING' | 'ANSWERED' | 'IVR_ACTIVE' | 'BRIDGED' | 'COMPLETED' | 'BUSY' | 'NO_ANSWER' | 'FAILED';
  callId?: string;
  attempts: number;
  lastAttemptAt?: string;
  validationStatus: 'VALID' | 'INVALID_FORMAT' | 'DUPLICATE' | 'EMPTY';
  validationReason?: string;
}

export interface Campaign {
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

export interface DtmfEvent {
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

export interface CallEvent {
  id: string;
  callId: string;
  type: string;
  timestamp: string;
  details: Record<string, any>;
}

export interface Call {
  id: string;
  callId: string; // unique correlation ID
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
  callSid?: string;
  queueEnteredAt?: string;
  queueTuneUrl?: string;
  failoverFromConnectionId?: string;
  recordingUrl?: string;
  notes?: string;
  disposition?: string;
}

export interface AgentStateLog {
  id: string;
  agentId: string;
  previousState: string;
  newState: string;
  timestamp: string;
  reason?: string;
}

export interface SystemError {
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

export interface HealthCheckRecord {
  id: string;
  sipConnectionId: string;
  timestamp: string;
  status: 'HEALTHY' | 'FAILED' | 'TIMEOUT';
  latencyMs: number;
  details: string;
}

export interface NotificationRecord {
  id: string;
  targetRole: 'admin' | 'manager' | 'all';
  managerId?: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
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

export interface VoipApiProvider {
  id: string;
  name: string;
  providerType: 'REST_API' | 'SIP_TRUNK_API' | 'WEBSOCKET_MEDIA' | 'IP_PEERING' | 'SIGNALWIRE' | 'TWILIO' | 'ZADARMA';
  apiEndpoint: string;
  apiKeyEncrypted: string;
  apiSecretEncrypted?: string;
  accountSidOrId?: string;
  webhookSecret?: string;
  sipLogin?: string; // Zadarma SIP ID (e.g. 101 or 6-digit SIP)
  pbxExtension?: string; // Zadarma PBX extension
  defaultCallerId?: string; // Verified outbound caller ID
  region: string;
  rules: VoipProviderRules;
  enabled: boolean;
  healthStatus: 'HEALTHY' | 'DEGRADED' | 'FAILED';
  lastPing?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  actor: string;
  actorRole: string;
  action: string;
  resource: string;
  timestamp: string;
  ipAddress?: string;
  metadata?: Record<string, any>;
}

export interface DatabaseSchema {
  roles: Role[];
  users: User[];
  managers: Manager[];
  agents: Agent[];
  providers: Provider[];
  sip_connections: SipConnection[];
  sip_numbers: SipNumber[];
  manager_sip_assignments: ManagerSipAssignment[];
  manager_number_assignments: ManagerNumberAssignment[];
  manager_voip_assignments: ManagerVoipAssignment[];
  campaigns: Campaign[];
  campaign_contacts: CampaignContact[];
  ivr_configs: IvrConfig[];
  calls: Call[];
  call_events: CallEvent[];
  dtmf_events: DtmfEvent[];
  agent_states: AgentStateLog[];
  system_errors: SystemError[];
  health_checks: HealthCheckRecord[];
  notifications: NotificationRecord[];
  audit_logs: AuditLog[];
  voip_api_providers: VoipApiProvider[];
  firewall_rules: FirewallWhitelistRule[];
  firewall_settings: FirewallSettings;
}

// Password hashing utility using native crypto
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, actualSalt, 1000, 64, 'sha512').toString('hex');
  return { hash, salt: actualSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const check = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return check === hash;
}

// In-Memory Database with atomic persistence to disk
class DatabaseService {
  private data: DatabaseSchema;
  private isLoaded = false;
  private saveLock = false;
  private pendingSave = false;

  constructor() {
    this.data = this.getDefaultSchema();
    this.init();
  }

  private getDefaultSchema(): DatabaseSchema {
    // Hash password for Mr-Pirate (Admin: Mr-Pirate / Piratesworld123$$)
    const adminAuth = hashPassword('Piratesworld123$$');
    const adminUser: User = {
      id: 'usr_admin_1',
      username: 'Mr-Pirate',
      passwordHash: adminAuth.hash,
      salt: adminAuth.salt,
      role: 'admin',
      name: 'Mr. Pirate (System Admin)',
      email: 'admin@piratesworld.tele',
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Pre-create standard system roles
    const roles: Role[] = [
      { id: 'role_admin', name: 'admin', description: 'System Administrator' },
      { id: 'role_manager', name: 'manager', description: 'Campaign & Agent Manager' },
      { id: 'role_agent', name: 'agent', description: 'Call Center Representative' },
      { id: 'role_customer', name: 'customer', description: 'Call Recipient / Customer' },
    ];

    // Seed realistic SIP providers
    const providers: Provider[] = [
      {
        id: 'prov_asterisk',
        name: 'Asterisk Enterprise Core PBX',
        techType: 'ASTERISK_ARI',
        description: 'Core SIP/RTP engine for carrier trunk termination',
        country: 'Global',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'prov_kamailio',
        name: 'Kamailio High-Capacity SBC',
        techType: 'KAMAILIO_SBC',
        description: 'Edge SIP Proxy & Load Balancer for IP-to-IP peering',
        country: 'Global',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'prov_freeswitch',
        name: 'FreeSWITCH Media Gateway',
        techType: 'FREESWITCH_ESL',
        description: 'WebRTC bridge & multi-party conferencing audio engine',
        country: 'Global',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      },
    ];

    // Initial operational manager for immediate production readiness
    const managerAuth = hashPassword('ManagerPass123!');
    const managerUser: User = {
      id: 'usr_mgr_alpha',
      username: 'manager_alpha',
      passwordHash: managerAuth.hash,
      salt: managerAuth.salt,
      role: 'manager',
      name: 'Captain Morgan (Operations Mgr)',
      email: 'morgan@piratesworld.tele',
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const managerRecord: Manager = {
      id: 'mgr_alpha',
      userId: managerUser.id,
      name: 'Captain Morgan',
      maxAgents: 10,
      enabled: true,
      notes: 'Tier-1 outbound campaign team',
      allowedRoutingMode: 'IVR_THEN_DIRECT_AGENT',
      enforcedAgentLanguage: 'Urdu',
      enforcedCustomerLanguage: 'Arabic',
      allowManagerOverrideLanguages: true,
      aiTranslationBotVoice: 'Aoede',
      createdAt: new Date().toISOString(),
    };

    // Initial SIP Connection #1
    const sipConn1: SipConnection = {
      id: 'sip_conn_01',
      connectionId: 'SIP-TRUNK-US-EAST',
      providerName: 'Asterisk Enterprise Core PBX',
      sipHost: 'sip.trunk-east.telecom-carrier.net',
      sipPort: 5060,
      transport: 'UDP',
      authType: 'CREDENTIALS',
      username: 'pw_trunk_east',
      passwordEncrypted: 'EncryptedSecret128#',
      defaultCallerId: '+12013615607',
      supportedCodecs: ['PCMU', 'PCMA', 'OPUS'],
      maxChannels: 100,
      activeChannels: 0,
      priority: 1,
      enabled: true,
      healthStatus: 'HEALTHY',
      lastHealthCheck: new Date().toISOString(),
      errorCount: 0,
      latencyMs: 14,
      createdAt: new Date().toISOString(),
    };

    // Initial SIP Connection #2 (Direct IP-to-IP Peering Trunk)
    const sipConn2: SipConnection = {
      id: 'sip_conn_02',
      connectionId: 'IP-TRUNK-DIRECT-PEER',
      providerName: 'Direct IP-to-IP Carrier Peering',
      sipHost: '198.51.100.22',
      sipPort: 5060,
      transport: 'UDP',
      authType: 'IP_AUTH',
      ipAuthWhitelist: '198.51.100.22/32',
      defaultCallerId: '+12013615607',
      supportedCodecs: ['PCMU', 'PCMA', 'G729'],
      maxChannels: 100,
      activeChannels: 0,
      priority: 1,
      enabled: true,
      healthStatus: 'HEALTHY',
      lastHealthCheck: new Date().toISOString(),
      errorCount: 0,
      latencyMs: 12,
      createdAt: new Date().toISOString(),
    };

    // Authorized Phone Numbers
    const sipNumbers: SipNumber[] = [
      {
        id: 'num_01',
        phoneNumber: '+12013615607',
        provider: 'SignalWire Cloud Carrier',
        sipConnectionId: sipConn1.id,
        authorized: true,
        outboundCallerIdEligible: true,
        assignedManagerId: managerRecord.id,
        enabled: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'num_02',
        phoneNumber: '+18005550198',
        provider: 'Kamailio High-Capacity SBC',
        sipConnectionId: sipConn2.id,
        authorized: true,
        outboundCallerIdEligible: true,
        assignedManagerId: managerRecord.id,
        enabled: true,
        createdAt: new Date().toISOString(),
      },
    ];

    // Manager Assignments
    const sipAssignments: ManagerSipAssignment[] = [
      {
        id: 'msa_1',
        managerId: managerRecord.id,
        sipConnectionId: sipConn1.id,
        assignedAt: new Date().toISOString(),
      },
      {
        id: 'msa_2',
        managerId: managerRecord.id,
        sipConnectionId: sipConn2.id,
        assignedAt: new Date().toISOString(),
      },
    ];

    const numAssignments: ManagerNumberAssignment[] = [
      {
        id: 'mna_1',
        managerId: managerRecord.id,
        sipNumberId: sipNumbers[0].id,
        assignedAt: new Date().toISOString(),
      },
      {
        id: 'mna_2',
        managerId: managerRecord.id,
        sipNumberId: sipNumbers[1].id,
        assignedAt: new Date().toISOString(),
      },
    ];

    // Seed 1 active agent for Manager Alpha
    const agentAuth = hashPassword('AgentPass123!');
    const agentUser: User = {
      id: 'usr_agent_01',
      username: 'agent_blackbeard',
      passwordHash: agentAuth.hash,
      salt: agentAuth.salt,
      role: 'agent',
      name: 'Edward Teach (Agent 01)',
      email: 'edward@piratesworld.tele',
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const agentRecord: Agent = {
      id: 'agt_01',
      userId: agentUser.id,
      managerId: managerRecord.id,
      name: 'Edward Teach',
      username: 'agent_blackbeard',
      enabled: true,
      currentCallId: null,
      state: 'AVAILABLE',
      lastStateChange: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    // Pre-create Default IVR Config for Manager Alpha
    const ivrConfig: IvrConfig = {
      id: 'ivr_default_01',
      managerId: managerRecord.id,
      name: 'Standard Customer Service Menu',
      greetingText: 'Thank you for calling Pirates World Tele Solution. Press 1 to connect with an agent, Press 2 to repeat menu, or Press 3 to end this call.',
      timeoutSeconds: 8,
      maxRetries: 3,
      invalidKeyAction: 'REPEAT_MENU',
      options: [
        {
          id: 'opt_1',
          key: '1',
          action: 'TRANSFER_TO_AGENT',
          label: 'Connect to Live Agent',
          transferQueue: 'sales_queue',
        },
        {
          id: 'opt_2',
          key: '2',
          action: 'REPEAT_MENU',
          label: 'Repeat Menu Options',
        },
        {
          id: 'opt_3',
          key: '3',
          action: 'END_CALL',
          label: 'End Call',
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return {
      roles,
      users: [adminUser, managerUser, agentUser],
      managers: [managerRecord],
      agents: [agentRecord],
      providers,
      sip_connections: [sipConn1, sipConn2],
      sip_numbers: sipNumbers,
      manager_sip_assignments: sipAssignments,
      manager_number_assignments: numAssignments,
      manager_voip_assignments: [],
      campaigns: [],
      campaign_contacts: [],
      ivr_configs: [ivrConfig],
      calls: [],
      call_events: [],
      dtmf_events: [],
      agent_states: [],
      system_errors: [],
      health_checks: [],
      notifications: [],
      audit_logs: [
        {
          id: 'aud_init_1',
          actor: 'System Bootstrap',
          actorRole: 'system',
          action: 'PLATFORM_INITIALIZED',
          resource: 'SYSTEM',
          timestamp: new Date().toISOString(),
          metadata: { note: 'Initialized Pirates World Tele Solution platform database.' },
        },
      ],
      voip_api_providers: [
        {
          id: 'voip_prov_01',
          name: 'Telnyx Elastic Voice & Peering API',
          providerType: 'REST_API',
          apiEndpoint: 'https://api.telnyx.com/v2',
          apiKeyEncrypted: 'KEY_KEY0175_TELNYX_PROD_SECURE',
          accountSidOrId: 'act_telnyx_core_991',
          region: 'US-EAST',
          rules: {
            ipPeeringWhitelist: '192.76.120.0/24, 64.16.240.0/20',
            allowedPrefixes: ['+1', '+44', '+33', '+49'],
            blockedPrefixes: ['+900', '+88'],
            rateLimitPerSec: 50,
            maxConcurrency: 150,
            priority: 1,
            enforceTls: true,
            headerSigningEnabled: true,
          },
          enabled: true,
          healthStatus: 'HEALTHY',
          lastPing: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'voip_prov_02',
          name: 'Twilio Voice Direct Route API',
          providerType: 'REST_API',
          apiEndpoint: 'https://api.twilio.com/2010-04-01',
          apiKeyEncrypted: 'KEY_SK74819_TWILIO_PROD_ACCESS',
          accountSidOrId: 'AC84820194820194820194820',
          region: 'GLOBAL',
          rules: {
            ipPeeringWhitelist: '54.172.60.0/23, 54.244.51.0/24',
            allowedPrefixes: ['+1', '+52', '+81', '+61'],
            blockedPrefixes: ['+88'],
            rateLimitPerSec: 30,
            maxConcurrency: 100,
            priority: 2,
            enforceTls: true,
            headerSigningEnabled: true,
          },
          enabled: true,
          healthStatus: 'HEALTHY',
          lastPing: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      firewall_rules: [
        {
          id: 'fw_rule_permissive_all',
          ipOrCidr: '0.0.0.0/0',
          description: 'Permissive Inbound Peering (Allow Any Carrier / PBX Traffic)',
          allowedPorts: '5060, 10000-20000',
          protocol: 'ANY',
          enabled: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'fw_rule_local_host',
          ipOrCidr: '34.34.226.194/32',
          description: 'Primary Tele Solution Core Softswitch',
          allowedPorts: '5060, 10000-20000, 3000',
          protocol: 'ANY',
          enabled: true,
          createdAt: new Date().toISOString(),
        },
      ],
      firewall_settings: {
        mode: 'PERMISSIVE',
        defaultSipPort: 5060,
        rtpPortRange: '10000-20000',
        lastUpdated: new Date().toISOString(),
      },
    };
  }

  private init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        // Merge with default schema structure to ensure backwards-compat
        this.data = {
          ...this.getDefaultSchema(),
          ...parsed,
          voip_api_providers: parsed.voip_api_providers || this.getDefaultSchema().voip_api_providers,
          manager_voip_assignments: parsed.manager_voip_assignments || [],
          firewall_rules: parsed.firewall_rules || this.getDefaultSchema().firewall_rules,
          firewall_settings: parsed.firewall_settings || this.getDefaultSchema().firewall_settings,
        };

        // Ensure Mr-Pirate admin user always exists and credentials match requirement
        const adminIndex = this.data.users.findIndex((u) => u.username === 'Mr-Pirate');
        const adminAuth = hashPassword('Piratesworld123$$');
        if (adminIndex === -1) {
          this.data.users.push({
            id: 'usr_admin_1',
            username: 'Mr-Pirate',
            passwordHash: adminAuth.hash,
            salt: adminAuth.salt,
            role: 'admin',
            name: 'Mr. Pirate (System Admin)',
            email: 'admin@piratesworld.tele',
            enabled: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        } else {
          // Always ensure password matches the prompt requirement
          this.data.users[adminIndex].passwordHash = adminAuth.hash;
          this.data.users[adminIndex].salt = adminAuth.salt;
          this.data.users[adminIndex].role = 'admin';
          this.data.users[adminIndex].enabled = true;
        }

        const mgrIndex = this.data.users.findIndex((u) => u.username === 'manager_alpha');
        if (mgrIndex !== -1) {
          this.data.users[mgrIndex].enabled = true;
        }

        // Sanitize dummy/mock demo numbers to verified SignalWire number
        this.data.sip_numbers = (this.data.sip_numbers || []).filter(
          (n) => !n.phoneNumber.includes('800555')
        );
        if (!this.data.sip_numbers.some((n) => n.phoneNumber === '+12013615607')) {
          this.data.sip_numbers.unshift({
            id: 'num_signalwire_primary',
            phoneNumber: '+12013615607',
            provider: 'SignalWire Cloud Carrier',
            sipConnectionId: 'voip_prov_1790779409050',
            authorized: true,
            outboundCallerIdEligible: true,
            assignedManagerId: 'mgr_alpha',
            enabled: true,
            createdAt: new Date().toISOString(),
          });
        }
        (this.data.sip_connections || []).forEach((c) => {
          if (c.defaultCallerId?.includes('800555')) {
            c.defaultCallerId = '+12013615607';
          }
        });
        (this.data.campaigns || []).forEach((c) => {
          if (!c.callerIdNumber || c.callerIdNumber.includes('800555')) {
            c.callerIdNumber = '+12013615607';
          }
        });
        this.saveSync();
      } else {
        // Write fresh default data
        this.saveSync();
      }
      this.isLoaded = true;
    } catch (err) {
      console.error('Failed to initialize database, using in-memory default:', err);
      this.data = this.getDefaultSchema();
      this.isLoaded = true;
    }
  }

  // Atomic write to prevent file corruption
  public async save(): Promise<void> {
    if (this.saveLock) {
      this.pendingSave = true;
      return;
    }

    this.saveLock = true;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        await fs.promises.mkdir(DATA_DIR, { recursive: true });
      }
      const tempFile = `${DB_FILE}.${Date.now()}.${Math.random().toString(36).substring(7)}.tmp`;
      const payload = JSON.stringify(this.data, null, 2);
      await fs.promises.writeFile(tempFile, payload, 'utf-8');
      await fs.promises.rename(tempFile, DB_FILE);
    } catch (err) {
      console.error('Error persisting database:', err);
    } finally {
      this.saveLock = false;
      if (this.pendingSave) {
        this.pendingSave = false;
        await this.save();
      }
    }
  }

  private saveSync(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tempFile = `${DB_FILE}.${Date.now()}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempFile, DB_FILE);
    } catch (err) {
      console.error('Error synchronously persisting database:', err);
    }
  }

  // Generic Table Getters & Mutators
  public get(): DatabaseSchema {
    return this.data;
  }

  public async update(updater: (data: DatabaseSchema) => void): Promise<void> {
    updater(this.data);
    await this.save();
  }
}

export const db = new DatabaseService();
