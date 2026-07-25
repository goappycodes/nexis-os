/**
 * Database types for Nexis OS.
 *
 * Kept in sync by hand with supabase/migrations. When you add a migration,
 * add the matching shape here — the whole app is typed off this file.
 */

export type AppRole = "super_admin" | "manager" | "member";
export type EventStatus = "draft" | "planning" | "ready" | "live" | "completed" | "cancelled";
export type TaskStatus = "todo" | "in_progress" | "blocked" | "done" | "cancelled";
export type TaskPriority = "low" | "normal" | "high" | "urgent";
export type ApprovalStatus = "draft" | "pending" | "approved" | "changes_requested" | "rejected";
export type CampaignStatus = "planned" | "in_progress" | "live" | "completed" | "cancelled";
export type CreativeType =
  | "image" | "video" | "reel" | "carousel" | "story"
  | "poster" | "banner" | "brochure" | "other";
export type ScriptType =
  | "reel" | "ad" | "announcement" | "call" | "email" | "whatsapp" | "speech" | "other";
export type ReminderChannel = "whatsapp" | "sms" | "email" | "in_app";
export type ReminderStatus = "pending" | "sent" | "failed" | "cancelled";
export type WorkCategory =
  | "printables" | "venue" | "stage_setup" | "logistics" | "invitations"
  | "announcements" | "marketing" | "campaigns" | "budget" | "registrations"
  | "hospitality" | "documentation" | "other";

export type Department = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  role: AppRole;
  job_title: string | null;
  primary_department_id: string | null;
  is_active: boolean;
  whatsapp_opt_in: boolean;
  created_at: string;
  updated_at: string;
};

export type DepartmentMember = {
  department_id: string;
  user_id: string;
  is_manager: boolean;
  created_at: string;
};

export type Event = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  department_id: string | null;
  owner_id: string | null;
  status: EventStatus;
  starts_at: string;
  ends_at: string | null;
  venue: string | null;
  expected_attendees: number | null;
  budget_amount: number | null;
  cover_image_path: string | null;
  registration_enabled: boolean;
  registration_deadline: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type EventPlaybook = {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
};

export type EventPlaybookItem = {
  id: string;
  playbook_id: string;
  category: WorkCategory;
  title: string;
  description: string | null;
  offset_days: number;
  department_id: string | null;
  sort_order: number;
};

export type Board = {
  id: string;
  name: string;
  description: string | null;
  department_id: string | null;
  created_by: string | null;
  sort_order: number;
  created_at: string;
};

export type BoardColumn = {
  id: string;
  board_id: string;
  name: string;
  sort_order: number;
};

export type Task = {
  id: string;
  title: string;
  description: string | null;
  department_id: string | null;
  assignee_id: string | null;
  created_by: string | null;
  board_id: string | null;
  column_id: string | null;
  event_id: string | null;
  campaign_id: string | null;
  category: WorkCategory;
  status: TaskStatus;
  priority: TaskPriority;
  due_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  labels: string[];
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type TaskComment = {
  id: string;
  task_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
};

export type TaskChecklistItem = {
  id: string;
  task_id: string;
  title: string;
  is_done: boolean;
  sort_order: number;
};

export type MarketingCampaign = {
  id: string;
  name: string;
  month: string;
  objective: string | null;
  channels: string[];
  status: CampaignStatus;
  department_id: string | null;
  owner_id: string | null;
  event_id: string | null;
  starts_on: string | null;
  ends_on: string | null;
  budget_amount: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Creative = {
  id: string;
  title: string;
  type: CreativeType;
  channel: string | null;
  caption: string | null;
  file_path: string | null;
  thumbnail_path: string | null;
  version: number;
  status: ApprovalStatus;
  campaign_id: string | null;
  event_id: string | null;
  department_id: string | null;
  scheduled_for: string | null;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Script = {
  id: string;
  title: string;
  type: ScriptType;
  body: string;
  version: number;
  status: ApprovalStatus;
  campaign_id: string | null;
  event_id: string | null;
  department_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ApprovalEntityType =
  | "creative" | "script" | "campaign" | "event" | "expense" | "task";

export type ApprovalRequest = {
  id: string;
  entity_type: ApprovalEntityType;
  entity_id: string;
  title: string;
  department_id: string | null;
  requested_by: string | null;
  assigned_to: string | null;
  status: ApprovalStatus;
  version: number;
  note: string | null;
  due_at: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
};

export type ApprovalComment = {
  id: string;
  request_id: string;
  author_id: string | null;
  body: string;
  decision: ApprovalStatus | null;
  created_at: string;
};

export type EventRegistration = {
  id: string;
  event_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  extra: Record<string, unknown>;
  status: "registered" | "waitlist" | "cancelled" | "attended" | "no_show";
  source: string | null;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  url: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
};

export type Reminder = {
  id: string;
  user_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  channel: ReminderChannel;
  send_at: string;
  template: string | null;
  payload: Record<string, unknown>;
  body: string | null;
  status: ReminderStatus;
  attempts: number;
  sent_at: string | null;
  error: string | null;
  provider_message_id: string | null;
  created_at: string;
};

export type ExpenseStatus =
  | "draft" | "pending" | "approved" | "changes_requested" | "rejected" | "paid";

export type ExpenseCategory =
  | "travel" | "vendor" | "equipment" | "food" | "marketing" | "printing"
  | "maintenance" | "salary" | "utilities" | "event" | "other";

export type Expense = {
  id: string;
  title: string;
  description: string | null;
  amount: number;
  category: ExpenseCategory;
  status: ExpenseStatus;
  vendor: string | null;
  expense_date: string;
  is_reimbursement: boolean;
  department_id: string | null;
  event_id: string | null;
  campaign_id: string | null;
  requested_by: string | null;
  approver_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
  paid_at: string | null;
  paid_by: string | null;
  payment_method: string | null;
  payment_ref: string | null;
  receipt_path: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type MessageLog = {
  id: string;
  provider: string;
  channel: ReminderChannel;
  recipient: string;
  template: string | null;
  body: string | null;
  status: string;
  provider_response: Record<string, unknown> | null;
  reminder_id: string | null;
  created_at: string;
};

export type ActivityLog = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  department_id: string | null;
  summary: string | null;
  meta: Record<string, unknown>;
  created_at: string;
};

/** Rows that a table accepts on insert: generated columns become optional. */
type Insertable<T, Required extends keyof T> = Partial<T> & Pick<T, Required>;

type TableDef<Row, RequiredOnInsert extends keyof Row> = {
  Row: Row;
  Insert: Insertable<Row, RequiredOnInsert>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      departments: TableDef<Department, "name" | "slug">;
      profiles: TableDef<Profile, "id" | "email">;
      department_members: TableDef<DepartmentMember, "department_id" | "user_id">;
      events: TableDef<Event, "name" | "slug" | "starts_at">;
      event_playbooks: TableDef<EventPlaybook, "name">;
      event_playbook_items: TableDef<EventPlaybookItem, "playbook_id" | "title">;
      boards: TableDef<Board, "name">;
      board_columns: TableDef<BoardColumn, "board_id" | "name">;
      tasks: TableDef<Task, "title">;
      task_comments: TableDef<TaskComment, "task_id" | "body">;
      task_checklist_items: TableDef<TaskChecklistItem, "task_id" | "title">;
      marketing_campaigns: TableDef<MarketingCampaign, "name" | "month">;
      creatives: TableDef<Creative, "title">;
      scripts: TableDef<Script, "title">;
      approval_requests: TableDef<ApprovalRequest, "entity_type" | "entity_id">;
      approval_comments: TableDef<ApprovalComment, "request_id" | "body">;
      event_registrations: TableDef<EventRegistration, "event_id" | "full_name">;
      notifications: TableDef<Notification, "user_id" | "title">;
      reminders: TableDef<Reminder, "send_at">;
      expenses: TableDef<Expense, "title" | "amount">;
      message_log: TableDef<MessageLog, "channel" | "recipient" | "status">;
      activity_log: TableDef<ActivityLog, "action">;
    };
    Views: Record<string, never>;
    Functions: {
      /** Profile, department, managed departments and pending-approval count in one call. */
      session_bundle: {
        Args: Record<string, never>;
        Returns: {
          profile: Profile;
          department: Department | null;
          managed_department_ids: string[];
          pending_approvals: number;
        } | null;
      };
    };
    Enums: {
      app_role: AppRole;
      event_status: EventStatus;
      task_status: TaskStatus;
      task_priority: TaskPriority;
      approval_status: ApprovalStatus;
      campaign_status: CampaignStatus;
      creative_type: CreativeType;
      script_type: ScriptType;
      reminder_channel: ReminderChannel;
      reminder_status: ReminderStatus;
      work_category: WorkCategory;
    };
    CompositeTypes: Record<string, never>;
  };
};

/* ── View models: rows joined with the bits the UI always needs ───────────── */

export type ProfileLite = Pick<Profile, "id" | "full_name" | "avatar_url" | "email">;

export type TaskWithRelations = Task & {
  assignee: ProfileLite | null;
  department: Pick<Department, "id" | "name" | "color" | "slug"> | null;
  event: Pick<Event, "id" | "name" | "slug"> | null;
};

export type EventWithRelations = Event & {
  owner: ProfileLite | null;
  department: Pick<Department, "id" | "name" | "color" | "slug"> | null;
};

export type CreativeWithRelations = Creative & {
  creator: ProfileLite | null;
  campaign: Pick<MarketingCampaign, "id" | "name"> | null;
  event: Pick<Event, "id" | "name"> | null;
};
