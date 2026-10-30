import { db } from '../../src/db/index.js';
import { adminAuditLogs } from '../../src/db/schema.js';
export async function writeAdminAuditLog(params: any){
  try{
    if(!params.actorId||!params.actorEmail)return;
    await db.insert(adminAuditLogs).values({actorId:params.actorId,actorEmail:params.actorEmail,action:params.action,targetType:params.targetType||null,targetRef:params.targetRef||null,details:params.details||null});
  }catch(e){console.error('[admin/audit]failed',e);}
}
