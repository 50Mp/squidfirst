export type AdminActor={id:string;telegramUserId:string;role:'owner'|'operator';channel:'miniapp'|'telegram'};
export type AuditInput={action:string;entityType:string;entityId:string;before:unknown;after:unknown};
