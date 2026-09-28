export type ServiceId = 'fullstack' | 'automation' | 'web-branding' | 'consultation';

export type CursorParticleMode = 'bubbles' | 'none';

export interface ServiceDetail {
  id: ServiceId;
  number: string;
  title: string;
  subtitle: string;
  shortDesc: string;
  fullDesc: string;
  badge: string;
  iconName: string;
  highlights: string[];
  capabilities: {
    title: string;
    description: string;
  }[];
  deliverables: string[];
  idealFor: string[];
  quotePrompt: string;
}

export interface QuestionnaireData {
  serviceId: ServiceId;
  projectScope: string;
  selectedFeatures: string[];
  securityOptions: string[];
  automationScope: string[];
  brandingOptions: string[];
  consultationTopics?: string[];
  consultationFormat?: string;
  animationLevel: string;
  budgetRange: string;
  timeline: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  notes: string;
}

export interface InquiredSubmission extends QuestionnaireData {
  id: string;
  createdAt: string;
  status: 'new' | 'reviewed';
}
