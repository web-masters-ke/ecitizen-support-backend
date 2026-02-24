-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('CITIZEN', 'BUSINESS', 'AGENCY_AGENT', 'SERVICE_PROVIDER_AGENT', 'COMMAND_CENTER_ADMIN', 'SUPER_ADMIN', 'API_CLIENT');

-- CreateEnum
CREATE TYPE "AgencyType" AS ENUM ('MINISTRY', 'DEPARTMENT', 'PARASTATAL', 'COUNTY_GOVERNMENT', 'REGULATORY_BODY', 'SERVICE_PROVIDER');

-- CreateEnum
CREATE TYPE "TicketChannel" AS ENUM ('WEB', 'MOBILE', 'USSD', 'SMS', 'API', 'CALL_CENTER', 'WHATSAPP', 'EMAIL');

-- CreateEnum
CREATE TYPE "TicketStatusName" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ESCALATED', 'PENDING_CITIZEN', 'RESOLVED', 'CLOSED', 'REOPENED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TicketPriorityName" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('COMMENT', 'STATUS_CHANGE', 'ESCALATION_NOTE', 'SYSTEM_UPDATE');

-- CreateEnum
CREATE TYPE "BreachType" AS ENUM ('RESPONSE', 'RESOLUTION');

-- CreateEnum
CREATE TYPE "EscalationTrigger" AS ENUM ('SYSTEM', 'SUPERVISOR', 'COMMAND_CENTER', 'MANUAL_OVERRIDE');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('SUCCESS', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'PUSH', 'IN_APP', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED', 'RETRYING');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'BOUNCED');

-- CreateEnum
CREATE TYPE "KbVisibility" AS ENUM ('PUBLIC', 'AGENCY_INTERNAL', 'AGENT_ONLY');

-- CreateEnum
CREATE TYPE "AccessType" AS ENUM ('READ', 'EXPORT', 'PRINT', 'DOWNLOAD');

-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SUSPENDED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "ecitizen_user_id" VARCHAR(100),
    "user_type" "UserType" NOT NULL,
    "first_name" VARCHAR(100),
    "last_name" VARCHAR(100),
    "email" VARCHAR(255) NOT NULL,
    "phone_number" VARCHAR(20),
    "national_id" VARCHAR(50),
    "business_registration_no" VARCHAR(100),
    "password_hash" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_system_role" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "resource" VARCHAR(100) NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "agency_id" UUID,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" UUID,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_users" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "department_id" UUID,
    "employment_status" VARCHAR(30) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agency_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL,
    "client_name" VARCHAR(150),
    "api_key_hash" TEXT NOT NULL,
    "agency_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "rate_limit" INTEGER NOT NULL DEFAULT 1000,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authentication_logs" (
    "id" BIGSERIAL NOT NULL,
    "user_id" UUID,
    "email_attempted" VARCHAR(255),
    "success" BOOLEAN,
    "failure_reason" VARCHAR(255),
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "authentication_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mfa_devices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_type" VARCHAR(50),
    "secret_key" TEXT NOT NULL,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agencies" (
    "id" UUID NOT NULL,
    "agency_code" VARCHAR(50) NOT NULL,
    "agency_name" VARCHAR(255) NOT NULL,
    "agency_type" "AgencyType" NOT NULL,
    "parent_agency_id" UUID,
    "registration_number" VARCHAR(100),
    "official_email" VARCHAR(255),
    "official_phone" VARCHAR(50),
    "physical_address" TEXT,
    "county" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "onboarding_status" "OnboardingStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "department_name" VARCHAR(255) NOT NULL,
    "department_code" VARCHAR(50),
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_providers" (
    "id" UUID NOT NULL,
    "provider_name" VARCHAR(255) NOT NULL,
    "provider_type" VARCHAR(100),
    "contact_email" VARCHAR(255),
    "contact_phone" VARCHAR(50),
    "contract_reference" VARCHAR(100),
    "contract_start_date" DATE,
    "contract_end_date" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_service_mappings" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "service_provider_id" UUID NOT NULL,
    "support_scope" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agency_service_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalation_matrix" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "priority_level" VARCHAR(50) NOT NULL,
    "max_response_time_minutes" INTEGER NOT NULL,
    "max_resolution_time_minutes" INTEGER NOT NULL,
    "auto_escalation_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escalation_matrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalation_levels" (
    "id" UUID NOT NULL,
    "escalation_matrix_id" UUID NOT NULL,
    "level_number" INTEGER NOT NULL,
    "escalation_role" VARCHAR(100),
    "escalation_department_id" UUID,
    "notify_via_email" BOOLEAN NOT NULL DEFAULT true,
    "notify_via_sms" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escalation_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_settings" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "setting_key" VARCHAR(100) NOT NULL,
    "setting_value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agency_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_business_hours" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" VARCHAR(8) NOT NULL,
    "end_time" VARCHAR(8) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "agency_business_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_contacts" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "contact_name" VARCHAR(255),
    "role_title" VARCHAR(255),
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "escalation_level" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agency_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_categories" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_priority_levels" (
    "id" UUID NOT NULL,
    "name" "TicketPriorityName" NOT NULL,
    "severity_score" INTEGER NOT NULL,
    "description" TEXT,

    CONSTRAINT "ticket_priority_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_statuses" (
    "id" UUID NOT NULL,
    "name" "TicketStatusName" NOT NULL,
    "is_closed_status" BOOLEAN NOT NULL DEFAULT false,
    "is_system_status" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ticket_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" UUID NOT NULL,
    "ticket_number" VARCHAR(30) NOT NULL,
    "agency_id" UUID NOT NULL,
    "department_id" UUID,
    "category_id" UUID,
    "created_by" UUID NOT NULL,
    "current_assignee_id" UUID,
    "priority_id" UUID,
    "status_id" UUID NOT NULL,
    "channel" "TicketChannel" NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "ai_predicted_category_id" UUID,
    "ai_confidence_score" DECIMAL(5,2),
    "ai_auto_assigned" BOOLEAN NOT NULL DEFAULT false,
    "sla_response_due_at" TIMESTAMP(3),
    "sla_resolution_due_at" TIMESTAMP(3),
    "first_response_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "reopen_count" INTEGER NOT NULL DEFAULT 0,
    "escalation_level" INTEGER NOT NULL DEFAULT 0,
    "is_escalated" BOOLEAN NOT NULL DEFAULT false,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_messages" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "sender_id" UUID,
    "message_type" "MessageType" NOT NULL DEFAULT 'COMMENT',
    "message_text" TEXT,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_attachments" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "message_id" UUID,
    "file_name" VARCHAR(255),
    "file_type" VARCHAR(100),
    "file_size" BIGINT,
    "storage_url" TEXT NOT NULL,
    "uploaded_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_assignments" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "assigned_to" UUID,
    "assigned_by" UUID,
    "assignment_reason" TEXT,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_history" (
    "id" BIGSERIAL NOT NULL,
    "ticket_id" UUID NOT NULL,
    "old_status_id" UUID,
    "new_status_id" UUID,
    "changed_by" UUID,
    "change_reason" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_tags" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "agency_id" UUID,

    CONSTRAINT "ticket_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_tag_mappings" (
    "ticket_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "ticket_tag_mappings_pkey" PRIMARY KEY ("ticket_id","tag_id")
);

-- CreateTable
CREATE TABLE "sla_policies" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "policy_name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "applies_business_hours" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sla_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_rules" (
    "id" UUID NOT NULL,
    "sla_policy_id" UUID NOT NULL,
    "priority_id" UUID,
    "category_id" UUID,
    "response_time_minutes" INTEGER NOT NULL,
    "resolution_time_minutes" INTEGER NOT NULL,
    "escalation_after_minutes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sla_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_tracking" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "sla_policy_id" UUID,
    "response_due_at" TIMESTAMP(3) NOT NULL,
    "resolution_due_at" TIMESTAMP(3) NOT NULL,
    "response_met" BOOLEAN,
    "resolution_met" BOOLEAN,
    "response_breached" BOOLEAN NOT NULL DEFAULT false,
    "resolution_breached" BOOLEAN NOT NULL DEFAULT false,
    "response_breach_at" TIMESTAMP(3),
    "resolution_breach_at" TIMESTAMP(3),
    "escalation_level" INTEGER NOT NULL DEFAULT 0,
    "last_escalated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sla_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalation_events" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "sla_tracking_id" UUID,
    "previous_level" INTEGER,
    "new_level" INTEGER,
    "escalated_to_user_id" UUID,
    "escalated_to_role" VARCHAR(100),
    "escalation_reason" VARCHAR(255),
    "triggered_by" "EscalationTrigger" NOT NULL DEFAULT 'SYSTEM',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escalation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "breach_logs" (
    "id" BIGSERIAL NOT NULL,
    "ticket_id" UUID NOT NULL,
    "sla_tracking_id" UUID,
    "breach_type" "BreachType" NOT NULL,
    "breach_timestamp" TIMESTAMP(3) NOT NULL,
    "breach_duration_minutes" INTEGER,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "breach_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_calendar_overrides" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "override_date" DATE NOT NULL,
    "is_working_day" BOOLEAN NOT NULL DEFAULT false,
    "start_time" VARCHAR(8),
    "end_time" VARCHAR(8),
    "description" TEXT,

    CONSTRAINT "business_calendar_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_models" (
    "id" UUID NOT NULL,
    "model_name" VARCHAR(150) NOT NULL,
    "model_version" VARCHAR(50) NOT NULL,
    "model_type" VARCHAR(100),
    "deployment_environment" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_classification_logs" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "ai_model_id" UUID,
    "predicted_category_id" UUID,
    "predicted_priority_id" UUID,
    "confidence_score" DECIMAL(5,2),
    "sentiment_score" DECIMAL(5,2),
    "auto_applied" BOOLEAN NOT NULL DEFAULT false,
    "manual_override" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_classification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_recommendations" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "recommendation_type" VARCHAR(100),
    "recommended_value" TEXT,
    "confidence_score" DECIMAL(5,2),
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "applied_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_rules" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "rule_name" VARCHAR(150) NOT NULL,
    "trigger_event" VARCHAR(100) NOT NULL,
    "condition_expression" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_actions" (
    "id" UUID NOT NULL,
    "automation_rule_id" UUID NOT NULL,
    "action_type" VARCHAR(100) NOT NULL,
    "action_payload" JSONB,
    "execution_order" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_triggers" (
    "id" UUID NOT NULL,
    "ticket_id" UUID,
    "trigger_type" VARCHAR(100),
    "triggered_by" UUID,
    "trigger_source" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_execution_logs" (
    "id" BIGSERIAL NOT NULL,
    "ticket_id" UUID,
    "automation_rule_id" UUID,
    "action_type" VARCHAR(100),
    "execution_status" "ExecutionStatus" NOT NULL,
    "error_message" TEXT,
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_execution_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kb_categories" (
    "id" UUID NOT NULL,
    "agency_id" UUID,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "parent_category_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kb_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kb_articles" (
    "id" UUID NOT NULL,
    "agency_id" UUID,
    "category_id" UUID,
    "title" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "current_version_id" UUID,
    "visibility" "KbVisibility" NOT NULL DEFAULT 'PUBLIC',
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kb_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kb_article_versions" (
    "id" UUID NOT NULL,
    "article_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "change_notes" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kb_article_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kb_tags" (
    "id" UUID NOT NULL,
    "agency_id" UUID,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "kb_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kb_article_tag_mappings" (
    "article_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "kb_article_tag_mappings_pkey" PRIMARY KEY ("article_id","tag_id")
);

-- CreateTable
CREATE TABLE "kb_feedback" (
    "id" UUID NOT NULL,
    "article_id" UUID NOT NULL,
    "user_id" UUID,
    "rating" INTEGER,
    "was_helpful" BOOLEAN,
    "feedback_comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kb_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kb_article_views" (
    "id" BIGSERIAL NOT NULL,
    "article_id" UUID NOT NULL,
    "viewed_by" UUID,
    "ip_address" VARCHAR(45),
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kb_article_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" UUID NOT NULL,
    "agency_id" UUID,
    "template_name" VARCHAR(150) NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "subject_template" VARCHAR(255),
    "body_template" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "agency_id" UUID,
    "ticket_id" UUID,
    "template_id" UUID,
    "trigger_event" VARCHAR(100),
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "scheduled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_recipients" (
    "id" UUID NOT NULL,
    "notification_id" UUID NOT NULL,
    "recipient_user_id" UUID,
    "recipient_email" VARCHAR(255),
    "recipient_phone" VARCHAR(50),
    "delivery_status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "delivered_at" TIMESTAMP(3),

    CONSTRAINT "notification_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_delivery_logs" (
    "id" BIGSERIAL NOT NULL,
    "notification_id" UUID,
    "recipient_id" UUID,
    "attempt_number" INTEGER,
    "delivery_status" "DeliveryStatus" NOT NULL,
    "provider_response" TEXT,
    "attempted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_delivery_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_logs" (
    "id" BIGSERIAL NOT NULL,
    "notification_id" UUID,
    "phone_number" VARCHAR(50),
    "message_body" TEXT,
    "provider_name" VARCHAR(100),
    "provider_message_id" VARCHAR(150),
    "delivery_status" VARCHAR(50),
    "cost" DECIMAL(10,4),
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" BIGSERIAL NOT NULL,
    "notification_id" UUID,
    "recipient_email" VARCHAR(255),
    "subject" TEXT,
    "message_body" TEXT,
    "provider_name" VARCHAR(100),
    "provider_message_id" VARCHAR(150),
    "delivery_status" VARCHAR(50),
    "opened" BOOLEAN NOT NULL DEFAULT false,
    "clicked" BOOLEAN NOT NULL DEFAULT false,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_logs" (
    "id" BIGSERIAL NOT NULL,
    "notification_id" UUID,
    "device_token" TEXT,
    "message_title" TEXT,
    "message_body" TEXT,
    "delivery_status" VARCHAR(50),
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_logs" (
    "id" BIGSERIAL NOT NULL,
    "notification_id" UUID,
    "target_url" TEXT,
    "payload" JSONB,
    "response_status" INTEGER,
    "response_body" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" UUID,
    "action_type" VARCHAR(100) NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "performed_by" UUID,
    "performed_by_role" VARCHAR(100),
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_activity_logs" (
    "id" BIGSERIAL NOT NULL,
    "user_id" UUID,
    "agency_id" UUID,
    "activity_type" VARCHAR(100),
    "ticket_id" UUID,
    "description" TEXT,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_access_logs" (
    "id" BIGSERIAL NOT NULL,
    "user_id" UUID,
    "agency_id" UUID,
    "entity_type" VARCHAR(100),
    "entity_id" UUID,
    "field_accessed" VARCHAR(100),
    "access_type" "AccessType" NOT NULL,
    "accessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "consent_type" VARCHAR(100) NOT NULL,
    "current_version_id" UUID,
    "consent_given" BOOLEAN NOT NULL,
    "consent_timestamp" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_versions" (
    "id" UUID NOT NULL,
    "consent_type" VARCHAR(100) NOT NULL,
    "version_number" INTEGER NOT NULL,
    "consent_text" TEXT NOT NULL,
    "effective_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retention_policies" (
    "id" UUID NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "retention_period_days" INTEGER NOT NULL,
    "archive_after_days" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retention_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "archival_records" (
    "id" UUID NOT NULL,
    "entity_type" VARCHAR(100),
    "entity_id" UUID,
    "archived_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_by_process" VARCHAR(100),
    "storage_location" TEXT,

    CONSTRAINT "archival_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_metrics_hourly" (
    "id" BIGSERIAL NOT NULL,
    "agency_id" UUID,
    "hour_bucket" TIMESTAMP(3) NOT NULL,
    "tickets_created" INTEGER NOT NULL DEFAULT 0,
    "tickets_resolved" INTEGER NOT NULL DEFAULT 0,
    "tickets_closed" INTEGER NOT NULL DEFAULT 0,
    "tickets_escalated" INTEGER NOT NULL DEFAULT 0,
    "tickets_reopened" INTEGER NOT NULL DEFAULT 0,
    "avg_first_response_minutes" DECIMAL(10,2),
    "avg_resolution_minutes" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_metrics_hourly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_metrics_daily" (
    "id" BIGSERIAL NOT NULL,
    "agency_id" UUID,
    "date_bucket" DATE NOT NULL,
    "tickets_created" INTEGER NOT NULL DEFAULT 0,
    "tickets_resolved" INTEGER NOT NULL DEFAULT 0,
    "tickets_closed" INTEGER NOT NULL DEFAULT 0,
    "open_tickets" INTEGER NOT NULL DEFAULT 0,
    "escalated_tickets" INTEGER NOT NULL DEFAULT 0,
    "breached_response" INTEGER NOT NULL DEFAULT 0,
    "breached_resolution" INTEGER NOT NULL DEFAULT 0,
    "avg_first_response_minutes" DECIMAL(10,2),
    "avg_resolution_minutes" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_metrics_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_performance_metrics" (
    "id" BIGSERIAL NOT NULL,
    "agency_id" UUID,
    "reporting_period_start" DATE NOT NULL,
    "reporting_period_end" DATE NOT NULL,
    "total_tickets" INTEGER,
    "avg_response_time" DECIMAL(10,2),
    "avg_resolution_time" DECIMAL(10,2),
    "sla_compliance_percentage" DECIMAL(5,2),
    "escalation_rate_percentage" DECIMAL(5,2),
    "citizen_satisfaction_score" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agency_performance_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_performance_metrics" (
    "id" BIGSERIAL NOT NULL,
    "agency_id" UUID,
    "date_bucket" DATE NOT NULL,
    "total_sla_tracked" INTEGER,
    "response_met" INTEGER,
    "response_breached" INTEGER,
    "resolution_met" INTEGER,
    "resolution_breached" INTEGER,
    "avg_breach_duration_minutes" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sla_performance_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_activity_metrics" (
    "id" BIGSERIAL NOT NULL,
    "user_id" UUID,
    "agency_id" UUID,
    "date_bucket" DATE NOT NULL,
    "tickets_assigned" INTEGER NOT NULL DEFAULT 0,
    "tickets_resolved" INTEGER NOT NULL DEFAULT 0,
    "avg_resolution_time_minutes" DECIMAL(10,2),
    "escalations_handled" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_activity_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_snapshots" (
    "id" UUID NOT NULL,
    "agency_id" UUID,
    "snapshot_type" VARCHAR(100),
    "snapshot_payload" JSONB NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dashboard_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_idempotency_keys" (
    "id" UUID NOT NULL,
    "idempotency_key" VARCHAR(255) NOT NULL,
    "endpoint" VARCHAR(255),
    "request_hash" TEXT,
    "response_snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_outbox" (
    "id" UUID NOT NULL,
    "aggregate_type" VARCHAR(100),
    "aggregate_id" UUID,
    "event_type" VARCHAR(100),
    "event_payload" JSONB,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media" (
    "id" UUID NOT NULL,
    "file_id" TEXT NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "user_id" UUID NOT NULL,
    "media_type" VARCHAR(50) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "storage_url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "duration" INTEGER,
    "metadata" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" UUID,
    "deletion_reason" TEXT,
    "restored_at" TIMESTAMP(3),
    "restored_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_ecitizen_user_id_key" ON "users"("ecitizen_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_resource_action_key" ON "permissions"("resource", "action");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_agency_id_key" ON "user_roles"("user_id", "role_id", "agency_id");

-- CreateIndex
CREATE UNIQUE INDEX "agency_users_user_id_agency_id_key" ON "agency_users"("user_id", "agency_id");

-- CreateIndex
CREATE UNIQUE INDEX "agencies_agency_code_key" ON "agencies"("agency_code");

-- CreateIndex
CREATE UNIQUE INDEX "departments_agency_id_department_name_key" ON "departments"("agency_id", "department_name");

-- CreateIndex
CREATE UNIQUE INDEX "service_providers_provider_name_key" ON "service_providers"("provider_name");

-- CreateIndex
CREATE UNIQUE INDEX "agency_service_mappings_agency_id_service_provider_id_key" ON "agency_service_mappings"("agency_id", "service_provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "escalation_levels_escalation_matrix_id_level_number_key" ON "escalation_levels"("escalation_matrix_id", "level_number");

-- CreateIndex
CREATE UNIQUE INDEX "agency_settings_agency_id_setting_key_key" ON "agency_settings"("agency_id", "setting_key");

-- CreateIndex
CREATE UNIQUE INDEX "agency_business_hours_agency_id_day_of_week_key" ON "agency_business_hours"("agency_id", "day_of_week");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_categories_agency_id_name_key" ON "ticket_categories"("agency_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_priority_levels_name_key" ON "ticket_priority_levels"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_statuses_name_key" ON "ticket_statuses"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_ticket_number_key" ON "tickets"("ticket_number");

-- CreateIndex
CREATE INDEX "tickets_agency_id_status_id_idx" ON "tickets"("agency_id", "status_id");

-- CreateIndex
CREATE INDEX "tickets_agency_id_priority_id_idx" ON "tickets"("agency_id", "priority_id");

-- CreateIndex
CREATE INDEX "tickets_agency_id_created_at_idx" ON "tickets"("agency_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "tickets_current_assignee_id_idx" ON "tickets"("current_assignee_id");

-- CreateIndex
CREATE INDEX "ticket_messages_ticket_id_created_at_idx" ON "ticket_messages"("ticket_id", "created_at");

-- CreateIndex
CREATE INDEX "ticket_history_ticket_id_changed_at_idx" ON "ticket_history"("ticket_id", "changed_at");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_tags_agency_id_name_key" ON "ticket_tags"("agency_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "sla_policies_agency_id_policy_name_key" ON "sla_policies"("agency_id", "policy_name");

-- CreateIndex
CREATE UNIQUE INDEX "sla_tracking_ticket_id_key" ON "sla_tracking"("ticket_id");

-- CreateIndex
CREATE UNIQUE INDEX "business_calendar_overrides_agency_id_override_date_key" ON "business_calendar_overrides"("agency_id", "override_date");

-- CreateIndex
CREATE UNIQUE INDEX "ai_models_model_name_model_version_key" ON "ai_models"("model_name", "model_version");

-- CreateIndex
CREATE UNIQUE INDEX "automation_rules_agency_id_rule_name_key" ON "automation_rules"("agency_id", "rule_name");

-- CreateIndex
CREATE UNIQUE INDEX "kb_categories_agency_id_name_key" ON "kb_categories"("agency_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "kb_articles_agency_id_slug_key" ON "kb_articles"("agency_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "kb_article_versions_article_id_version_number_key" ON "kb_article_versions"("article_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "kb_tags_agency_id_name_key" ON "kb_tags"("agency_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_agency_id_template_name_channel_key" ON "notification_templates"("agency_id", "template_name", "channel");

-- CreateIndex
CREATE INDEX "notifications_status_scheduled_at_idx" ON "notifications"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "consent_versions_consent_type_version_number_key" ON "consent_versions"("consent_type", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "retention_policies_entity_type_key" ON "retention_policies"("entity_type");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_metrics_hourly_agency_id_hour_bucket_key" ON "ticket_metrics_hourly"("agency_id", "hour_bucket");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_metrics_daily_agency_id_date_bucket_key" ON "ticket_metrics_daily"("agency_id", "date_bucket");

-- CreateIndex
CREATE UNIQUE INDEX "agency_performance_metrics_agency_id_reporting_period_start_key" ON "agency_performance_metrics"("agency_id", "reporting_period_start", "reporting_period_end");

-- CreateIndex
CREATE UNIQUE INDEX "sla_performance_metrics_agency_id_date_bucket_key" ON "sla_performance_metrics"("agency_id", "date_bucket");

-- CreateIndex
CREATE UNIQUE INDEX "user_activity_metrics_user_id_date_bucket_key" ON "user_activity_metrics"("user_id", "date_bucket");

-- CreateIndex
CREATE UNIQUE INDEX "api_idempotency_keys_idempotency_key_endpoint_key" ON "api_idempotency_keys"("idempotency_key", "endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "media_file_id_key" ON "media"("file_id");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_users" ADD CONSTRAINT "agency_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_users" ADD CONSTRAINT "agency_users_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_users" ADD CONSTRAINT "agency_users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mfa_devices" ADD CONSTRAINT "mfa_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agencies" ADD CONSTRAINT "agencies_parent_agency_id_fkey" FOREIGN KEY ("parent_agency_id") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_service_mappings" ADD CONSTRAINT "agency_service_mappings_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_service_mappings" ADD CONSTRAINT "agency_service_mappings_service_provider_id_fkey" FOREIGN KEY ("service_provider_id") REFERENCES "service_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalation_matrix" ADD CONSTRAINT "escalation_matrix_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalation_levels" ADD CONSTRAINT "escalation_levels_escalation_matrix_id_fkey" FOREIGN KEY ("escalation_matrix_id") REFERENCES "escalation_matrix"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalation_levels" ADD CONSTRAINT "escalation_levels_escalation_department_id_fkey" FOREIGN KEY ("escalation_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_settings" ADD CONSTRAINT "agency_settings_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_business_hours" ADD CONSTRAINT "agency_business_hours_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_contacts" ADD CONSTRAINT "agency_contacts_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_categories" ADD CONSTRAINT "ticket_categories_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ticket_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_current_assignee_id_fkey" FOREIGN KEY ("current_assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_priority_id_fkey" FOREIGN KEY ("priority_id") REFERENCES "ticket_priority_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "ticket_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "ticket_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_assignments" ADD CONSTRAINT "ticket_assignments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_assignments" ADD CONSTRAINT "ticket_assignments_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_assignments" ADD CONSTRAINT "ticket_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_old_status_id_fkey" FOREIGN KEY ("old_status_id") REFERENCES "ticket_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_new_status_id_fkey" FOREIGN KEY ("new_status_id") REFERENCES "ticket_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_tags" ADD CONSTRAINT "ticket_tags_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_tag_mappings" ADD CONSTRAINT "ticket_tag_mappings_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_tag_mappings" ADD CONSTRAINT "ticket_tag_mappings_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "ticket_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_rules" ADD CONSTRAINT "sla_rules_sla_policy_id_fkey" FOREIGN KEY ("sla_policy_id") REFERENCES "sla_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_rules" ADD CONSTRAINT "sla_rules_priority_id_fkey" FOREIGN KEY ("priority_id") REFERENCES "ticket_priority_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_rules" ADD CONSTRAINT "sla_rules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ticket_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_tracking" ADD CONSTRAINT "sla_tracking_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_tracking" ADD CONSTRAINT "sla_tracking_sla_policy_id_fkey" FOREIGN KEY ("sla_policy_id") REFERENCES "sla_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalation_events" ADD CONSTRAINT "escalation_events_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalation_events" ADD CONSTRAINT "escalation_events_sla_tracking_id_fkey" FOREIGN KEY ("sla_tracking_id") REFERENCES "sla_tracking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalation_events" ADD CONSTRAINT "escalation_events_escalated_to_user_id_fkey" FOREIGN KEY ("escalated_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "breach_logs" ADD CONSTRAINT "breach_logs_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "breach_logs" ADD CONSTRAINT "breach_logs_sla_tracking_id_fkey" FOREIGN KEY ("sla_tracking_id") REFERENCES "sla_tracking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_calendar_overrides" ADD CONSTRAINT "business_calendar_overrides_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_classification_logs" ADD CONSTRAINT "ai_classification_logs_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_classification_logs" ADD CONSTRAINT "ai_classification_logs_ai_model_id_fkey" FOREIGN KEY ("ai_model_id") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_classification_logs" ADD CONSTRAINT "ai_classification_logs_predicted_category_id_fkey" FOREIGN KEY ("predicted_category_id") REFERENCES "ticket_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_classification_logs" ADD CONSTRAINT "ai_classification_logs_predicted_priority_id_fkey" FOREIGN KEY ("predicted_priority_id") REFERENCES "ticket_priority_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_applied_by_fkey" FOREIGN KEY ("applied_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_actions" ADD CONSTRAINT "automation_actions_automation_rule_id_fkey" FOREIGN KEY ("automation_rule_id") REFERENCES "automation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_triggers" ADD CONSTRAINT "workflow_triggers_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_triggers" ADD CONSTRAINT "workflow_triggers_triggered_by_fkey" FOREIGN KEY ("triggered_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_execution_logs" ADD CONSTRAINT "automation_execution_logs_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_execution_logs" ADD CONSTRAINT "automation_execution_logs_automation_rule_id_fkey" FOREIGN KEY ("automation_rule_id") REFERENCES "automation_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_categories" ADD CONSTRAINT "kb_categories_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_categories" ADD CONSTRAINT "kb_categories_parent_category_id_fkey" FOREIGN KEY ("parent_category_id") REFERENCES "kb_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_articles" ADD CONSTRAINT "kb_articles_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_articles" ADD CONSTRAINT "kb_articles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "kb_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_articles" ADD CONSTRAINT "kb_articles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_article_versions" ADD CONSTRAINT "kb_article_versions_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "kb_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_article_versions" ADD CONSTRAINT "kb_article_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_tags" ADD CONSTRAINT "kb_tags_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_article_tag_mappings" ADD CONSTRAINT "kb_article_tag_mappings_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "kb_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_article_tag_mappings" ADD CONSTRAINT "kb_article_tag_mappings_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "kb_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_feedback" ADD CONSTRAINT "kb_feedback_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "kb_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_feedback" ADD CONSTRAINT "kb_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_article_views" ADD CONSTRAINT "kb_article_views_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "kb_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_article_views" ADD CONSTRAINT "kb_article_views_viewed_by_fkey" FOREIGN KEY ("viewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "notification_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_delivery_logs" ADD CONSTRAINT "notification_delivery_logs_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_delivery_logs" ADD CONSTRAINT "notification_delivery_logs_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "notification_recipients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_logs" ADD CONSTRAINT "sms_logs_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_logs" ADD CONSTRAINT "push_logs_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_activity_logs" ADD CONSTRAINT "user_activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_activity_logs" ADD CONSTRAINT "user_activity_logs_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_access_logs" ADD CONSTRAINT "data_access_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_access_logs" ADD CONSTRAINT "data_access_logs_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_metrics_hourly" ADD CONSTRAINT "ticket_metrics_hourly_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_metrics_daily" ADD CONSTRAINT "ticket_metrics_daily_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_performance_metrics" ADD CONSTRAINT "agency_performance_metrics_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_performance_metrics" ADD CONSTRAINT "sla_performance_metrics_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_activity_metrics" ADD CONSTRAINT "user_activity_metrics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_activity_metrics" ADD CONSTRAINT "user_activity_metrics_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_snapshots" ADD CONSTRAINT "dashboard_snapshots_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
