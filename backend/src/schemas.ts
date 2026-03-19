import { z } from 'zod';

// Auth
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Risks
export const CreateRiskSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  category: z.enum(['operational', 'technical', 'compliance', 'strategic', 'financial']),
  likelihood: z.number().int().min(1).max(5),
  impact: z.number().int().min(1).max(5),
  owner: z.string().optional(),
  treatment: z.enum(['mitigate', 'accept', 'transfer', 'avoid']).optional(),
  treatment_notes: z.string().optional(),
  due_date: z.string().optional(),
});

export const UpdateRiskSchema = CreateRiskSchema.partial().extend({
  status: z.enum(['open', 'in_progress', 'closed', 'accepted']).optional(),
  residual_likelihood: z.number().int().min(1).max(5).optional(),
  residual_impact: z.number().int().min(1).max(5).optional(),
});

// Vendors
export const CreateVendorSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  category: z.string().optional(),
  risk_rating: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  tier: z.number().int().min(1).max(3).optional(),
  contact_name: z.string().optional(),
  contact_email: z.string().email().optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
  data_classification: z.string().optional(),
  has_soc2: z.boolean().optional(),
  has_iso27001: z.boolean().optional(),
  review_date: z.string().optional(),
  notes: z.string().optional(),
});

export const UpdateVendorSchema = CreateVendorSchema.partial().extend({
  status: z.enum(['active', 'inactive', 'under_review', 'terminated']).optional(),
});

// Policies
export const CreatePolicySchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  category: z.enum(['security', 'privacy', 'hr', 'it', 'compliance', 'operational']),
  content: z.string().optional(),
  owner: z.string().optional(),
  review_frequency: z.number().int().min(1).optional(),
  version: z.string().optional(),
});

export const UpdatePolicySchema = CreatePolicySchema.partial().extend({
  status: z.enum(['draft', 'review', 'approved', 'published', 'archived']).optional(),
  next_review_date: z.string().optional(),
  published_at: z.string().optional(),
});

// Assets
export const CreateAssetSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  asset_type: z.enum(['server', 'workstation', 'application', 'database', 'network_device', 'cloud_resource', 'mobile_device', 'other']),
  category: z.enum(['hardware', 'software', 'data', 'cloud', 'people']).optional(),
  criticality: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  classification: z.enum(['public', 'internal', 'confidential', 'restricted']).optional(),
  owner: z.string().optional(),
  department: z.string().optional(),
  location: z.string().optional(),
  ip_address: z.string().optional(),
  hostname: z.string().optional(),
  os: z.string().optional(),
  vendor: z.string().optional(),
  purchase_date: z.string().optional(),
  end_of_life_date: z.string().optional(),
  notes: z.string().optional(),
});

export const UpdateAssetSchema = CreateAssetSchema.partial().extend({
  status: z.enum(['active', 'inactive', 'retired', 'disposed']).optional(),
});

// Audits
export const CreateAuditSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  type: z.enum(['internal', 'external', 'certification', 'surveillance']),
  framework_id: z.string().optional(),
  auditor: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  scope: z.string().optional(),
});

export const UpdateAuditSchema = CreateAuditSchema.partial().extend({
  status: z.enum(['planned', 'in_progress', 'completed', 'cancelled']).optional(),
  report_date: z.string().optional(),
  opinion: z.enum(['unqualified', 'qualified', 'adverse', 'disclaimer']).optional(),
});

export const CreateFindingSchema = z.object({
  audit_id: z.string().min(1),
  control_id: z.string().optional(),
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'informational']),
  recommendation: z.string().optional(),
  due_date: z.string().optional(),
});

export const UpdateFindingSchema = CreateFindingSchema.partial().extend({
  status: z.enum(['open', 'in_progress', 'remediated', 'accepted', 'closed']).optional(),
  management_response: z.string().optional(),
  remediated_at: z.string().optional(),
});

// Evidence
export const CreateEvidenceSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  type: z.enum(['document', 'screenshot', 'configuration', 'log', 'attestation', 'report', 'other']),
  source: z.string().optional(),
  expiration_date: z.string().optional(),
  control_ids: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

// Controls
export const UpdateControlSchema = z.object({
  status: z.enum(['not_implemented', 'in_progress', 'implemented', 'not_applicable']).optional(),
  implementation_notes: z.string().optional(),
  responsible_team: z.string().optional(),
  due_date: z.string().optional(),
});

// Systems
export const CreateSystemSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  system_type: z.enum(['major_application', 'general_support_system', 'minor_application']).optional(),
  system_owner: z.string().optional(),
  authorizing_official: z.string().optional(),
  organization: z.string().optional(),
  boundary_description: z.string().optional(),
  authorization_date: z.string().optional(),
  reauthorization_date: z.string().optional(),
});

export const UpdateSystemSchema = CreateSystemSchema.partial().extend({
  status: z.enum(['assessment_in_progress', 'authorized', 'under_review', 'decommissioned']).optional(),
});
