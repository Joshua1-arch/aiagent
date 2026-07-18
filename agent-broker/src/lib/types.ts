export interface MarketAgent {
  agentId: string;
  name: string;
  category: string;
  rating: string | null;
  minPrice: number | null;
  soldCount: number | null;
  description: string;
  communicationAddress: string;
  onlineStatus: number; // 1 = online, 2 = offline
  services: AgentService[];
}

export interface AgentService {
  serviceId: string;
  serviceName: string;
  serviceType: 'A2MCP' | 'A2A';
  fee: number | null;
  endpoint: string | null;
  description: string;
}

export interface BrokerTask {
  jobId: string;
  taskDescription: string;
  budget: number;
  selectedAgent: MarketAgent;
  selectedService: AgentService;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  result?: string;
  txHash?: string;
}

export type TaskStatus =
  | 'searching'
  | 'selecting'
  | 'publishing'
  | 'pending_agent'
  | 'in_progress'
  | 'verifying'
  | 'complete'
  | 'failed';

export interface SearchResult {
  agents: MarketAgent[];
  recommended: MarketAgent | null;
  reasoning: string;
  total: number;
}

export interface BrokerSearchRequest {
  query: string;
  budget: number;
  category?: string;
}

export interface ValidationCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn' | 'error';
  message: string;
  details?: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
}

export interface ValidationResult {
  overall: 'pass' | 'fail' | 'warn';
  score: number;
  summary: string;
  checks: ValidationCheck[];
  recommendations: string[];
  timestamp: string;
}

export interface ValidateRequest {
  aspName: string;
  aspDescription: string;
  serviceName: string;
  serviceDescription: string;
  serviceType: 'A2A' | 'A2MCP';
  fee: number;
  endpoint?: string;
  openApiSpec?: string;
  profilePicture?: string;
}
