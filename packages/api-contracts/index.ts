import type { LeadPriority, LeadScoreReason } from "../lead-engine";

export type TelegramAuthRequest={
  initData:string;
  sessionId:string;
  attribution?:{
    source?:string|null;
    medium?:string|null;
    campaign?:string|null;
    content?:string|null;
    term?:string|null;
    referrer?:string|null;
    telegramStartParam?:string|null;
  };
};

export type TelegramAuthResponse={
  user:{
    id:string;
    telegramUserId:string;
    username:string|null;
    firstName:string|null;
    lastName:string|null;
  }|null;
  sessionId:string;
  accessToken:string;
  expiresAt:string;
};

export type EventInput={
  idempotencyKey:string;
  sessionId:string;
  eventType:string;
  entityType?:string|null;
  entityId?:string|null;
  metadata?:Record<string,unknown>;
  occurredAt:string;
};

export type EventBatchRequest={
  events:EventInput[];
};

export type EventBatchResponse={
  accepted:number;
  duplicates:number;
  profile:{
    score:number;
    priority:LeadPriority;
    topPropertyId:string|null;
    nextAction:string;
  }|null;
};

export type LeadCreateRequest={
  sessionId:string;
  source:string;
  propertyId?:string|null;
  name:string;
  phone:string;
  comment?:string|null;
  consent:{
    accepted:true;
    version:string;
    acceptedAt:string;
  };
};

export type LeadCreateResponse={
  leadId:string;
  status:"new";
  score:number;
  priority:LeadPriority;
  taskId:string|null;
};

export type ControlLeadDto={
  id:string;
  source:string;
  propertyId:string|null;
  name:string;
  phone:string;
  comment:string|null;
  status:"new"|"contacted"|"qualified"|"showing"|"booking"|"deal"|"closed"|"lost";
  managerId:string|null;
  score:number;
  priority:LeadPriority;
  scoreReasons:LeadScoreReason[];
  topPropertyId:string|null;
  city:string|null;
  mortgageProgram:string|null;
  nextAction:string|null;
  createdAt:string;
  updatedAt:string;
};

export type VisitorProfileDto={
  id:string;
  sessionId:string;
  userId:string|null;
  score:number;
  priority:LeadPriority;
  scoreReasons:LeadScoreReason[];
  topPropertyId:string|null;
  city:string|null;
  mortgageProgram:string|null;
  nextAction:string;
  eventCount:number;
  firstSeenAt:string;
  lastSeenAt:string;
};

export type CrmTaskDto={
  id:string;
  leadId:string|null;
  profileId:string;
  sessionId:string;
  assignedTo:string|null;
  title:string;
  reason:string;
  priority:Exclude<LeadPriority,"cold">;
  status:"today"|"in_progress"|"waiting"|"done";
  dueAt:string;
  createdAt:string;
  updatedAt:string;
};

export type ScoringRuleDto={
  id:string;
  eventType:string;
  label:string;
  weight:number;
  maxCount:number;
  enabled:boolean;
  sortOrder:number;
};

export type LeadEngineSettingsDto={
  thresholds:{warm:number;hot:number;urgent:number};
  rules:ScoringRuleDto[];
};

export type ManagerNotificationPayload={
  kind:"new_lead"|"hot_lead"|"urgent_lead"|"sla_risk";
  leadId:string;
  managerId:string|null;
  score:number;
  priority:LeadPriority;
  title:string;
  body:string;
  propertyId:string|null;
  deepLink:string;
};

export type UserNotificationPayload={
  kind:"selection_ready"|"price_update"|"mortgage_followup"|"saved_property_update";
  userId:string;
  title:string;
  body:string;
  deepLink:string;
};
