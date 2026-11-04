import { ProfileSectionStates } from '@/modules/professional-profile/profile.types';
import { ApplicationDetail } from '@/modules/resume-generation/application.service';
import {
  ExtractedJobRequirements,
  GeneratedResumeContent,
} from '@/services/gemini/gemini.schemas';

export type OnboardingFlowState =
  | 'welcome'
  | 'awaiting_resume'
  | 'processing_resume'
  | 'resume_review'
  | 'collecting_profile'
  | 'collecting_experience'
  | 'collecting_education'
  | 'collecting_skills'
  | 'collecting_languages'
  | 'master_review'
  | 'master_completed';

export type ApplicationFlowState =
  | 'application_started'
  | 'awaiting_job_link'
  | 'awaiting_job_description'
  | 'analyzing_job'
  | 'generating_targeted_resume'
  | 'application_completed';

export type DataConfirmationStatus =
  | 'confirmed'
  | 'extracted_unconfirmed'
  | 'missing'
  | 'not_applicable';

export interface ChatActionButton {
  id: string;
  label: string;
  type: 'message' | 'file_upload' | 'download_pdf' | 'download_docx' | 'navigate' | 'preview_master';
  value?: string;
  href?: string;
  variant?: 'primary' | 'secondary' | 'outline';
}

export interface ChatEducationalBox {
  title: string;
  items: string[];
}

export interface ChatSectionPreview {
  title: string;
  statusBadge?: string;
  lines: string[];
}

export interface ChatMessageMetadata {
  actions?: ChatActionButton[];
  educationalBox?: ChatEducationalBox;
  sectionPreview?: ChatSectionPreview;
  masterResumePreview?: GeneratedResumeContent;
  applicationResult?: ApplicationDetail;
  fileInfo?: {
    fileName: string;
    fileSize: number;
  };
  flowState?: string;
}

export interface ChatMessageItem {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'assistant' | 'user' | 'system';
  content: string;
  metadata: ChatMessageMetadata;
  created_at: string;
}

export interface DraftExperienceItem {
  id: string;
  company: string;
  position: string;
  employment_type: string | null;
  start_date: string;
  end_date: string | null;
  description: string;
  achievements: string | null;
  tools: string | null;
  projects: string | null;
  improvement_explanation?: string | null;
  interview_turns: number;
  needs_deepening: boolean;
  status: DataConfirmationStatus;
}

export interface DraftEducationItem {
  id: string;
  institution: string;
  course: string;
  degree: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  confirmation_status: DataConfirmationStatus;
}

export interface DraftLanguageItem {
  name: string;
  proficiency: string;
  capabilities: string;
}

export type OnboardingSubStep =
  | 'welcome_choice'
  | 'personal_collect'
  | 'personal_confirm'
  | 'positioning_propose'
  | 'positioning_confirm'
  | 'summary_propose'
  | 'summary_confirm'
  | 'experience_interview'
  | 'experience_confirm'
  | 'experience_add_more'
  | 'education_collect'
  | 'education_confirm'
  | 'skills_propose'
  | 'skills_confirm'
  | 'languages_collect'
  | 'languages_confirm'
  | 'master_completed';

export interface OnboardingDraftState {
  hasUploadedResume: boolean;
  uploadedFileName?: string | null;
  currentSubStep: OnboardingSubStep;
  currentExperienceIndex: number;
  personal: {
    full_name: string | null;
    contact_email: string | null;
    phone: string | null;
    location: string | null;
    linkedin_url: string | null;
    portfolio_url: string | null;
    status: DataConfirmationStatus;
  };
  positioning: {
    target_roles: string | null;
    experience_years: string | null;
    specialties: string | null;
    positioning_angle: string | null;
    suggested_options: string[];
    status: DataConfirmationStatus;
  };
  summary: {
    text: string | null;
    explanation: string | null;
    highlighted: string[];
    gaps: string[];
    status: DataConfirmationStatus;
  };
  experiences: DraftExperienceItem[];
  educations: DraftEducationItem[];
  skills: {
    technical: string[];
    soft: string[];
    management: string[];
    tools: string[];
    certifications: string[];
    status: DataConfirmationStatus;
  };
  languages: DraftLanguageItem[];
  languagesStatus: DataConfirmationStatus;
  identifiedGaps: string[];
  identifiedInconsistencies: string[];
}

export interface OnboardingSessionOverview {
  conversationId: string;
  flowState: OnboardingFlowState;
  onboardingCompleted: boolean;
  sectionStates: ProfileSectionStates;
  draft: OnboardingDraftState;
  messages: ChatMessageItem[];
  masterResume: GeneratedResumeContent | null;
}

export interface ApplicationChatMetadata {
  flowState: ApplicationFlowState;
  sourceUrl?: string | null;
  jobDescription?: string | null;
  companyHint?: string | null;
  positionHint?: string | null;
  extractedRequirements?: ExtractedJobRequirements | null;
  detectedGaps?: string[];
  confirmedExtraSkills?: string[];
  awaitingGapConfirmation?: boolean;
  applicationId?: string | null;
}

export interface ApplicationChatOverview {
  conversationId: string;
  flowState: ApplicationFlowState;
  messages: ChatMessageItem[];
  application: ApplicationDetail | null;
  metadata: ApplicationChatMetadata;
}
