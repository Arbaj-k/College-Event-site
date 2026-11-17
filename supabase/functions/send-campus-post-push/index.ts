import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const APP_ID = "876e30fb-b69f-49da-a8aa-e90bf0240723";
const ORIGINS = new Set(["https://hapn.info", "https://www.hapn.info"]);
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin") || "";
  const headers: Record<string,string> = {"Content-Type":"application/json","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Vary":"Origin"};
  if (ORIGINS.has(origin)) { headers["Access-Control-Allow-Origin"]=origin; headers["Access-Control-Allow-Headers"]="authorization, apikey, content-type, x-client-info"; headers["Access-Control-Allow-Methods"]="POST, OPTIONS"; }
  const reply=(body:Record<string,unknown>,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(req.method==="OPTIONS") return new Response(null,{status:ORIGINS.has(origin)?204:403,headers});
  if(req.method!=="POST") return reply({error:"Method not allowed"},405);
  let admin:any=null, claimed=false, postId="";
  try {
    const token=(req.headers.get("authorization")||"").replace(/^Bearer\\s+/i,"");
    if(!token) return reply({error:"Authentication required"},401);
    const url=Deno.env.get("SUPABASE_URL"), anon=Deno.env.get("SUPABASE_ANON_KEY"), service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), key=Deno.env.get("ONESIGNAL_REST_API_KEY");
    if(!url||!anon||!service||!key) return reply({error:"Push service is not configured"},503);
    const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:au,error:ae}=await auth.auth.getUser(token);
    if(ae||!au.user) return reply({error:"Invalid session"},401);
    const body=await req.json().catch(()=>null); postId=String(body?.postId||"");
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postId)) return reply({error:"Invalid post ID"},400);
    admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:member,error:me}=await admin.from("campus_members").select("user_id,college_id").eq("user_id",au.user.id).maybeSingle();
    if(me) throw new Error("member_lookup_failed"); if(!member) return reply({error:"Approved campus membership required"},403);
    const {data:post,error:pe}=await admin.from("campus_posts").select("id,user_id,college_id,status,expires_at").eq("id",postId).maybeSingle();
    if(pe) throw new Error("post_lookup_failed"); if(!post) return reply({error:"Post not found"},404);
    if(post.user_id!==au.user.id||post.college_id!==member.college_id) return reply({error:"Post ownership or college mismatch"},403);
    if(post.status!=="active"||(post.expires_at&&Date.parse(post.expires_at)<=Date.now())) return reply({skipped:true,reason:"Post is not active"});
    const {error:claim}=await admin.from("campus_push_deliveries").insert({post_id:postId,college_id:member.college_id,status:"pending"});
    if(claim?.code==="23505") return reply({skipped:true,reason:"Already processing or sent"});
    if(claim) throw new Error("claim_failed"); claimed=true;
    const ids:string[]=[];
    for(let offset=0;;offset+=1000){const {data,error}=await admin.from("campus_members").select("user_id").eq("college_id",member.college_id).neq("user_id",au.user.id).order("user_id").range(offset,offset+999);if(error)throw new Error("recipient_lookup_failed");ids.push(...(data||[]).map((x:any)=>x.user_id));if((data||[]).length<1000)break;}
    if(ids.length>20000) throw new Error("recipient_limit_exceeded");
    for(let i=0;i<ids.length;i+=500){const rows=ids.slice(i,i+500).map(user_id=>({user_id,college_id:member.college_id,notification_type:"info",message:"A new post was shared on your college Connect Board.",post_id:postId}));if(rows.length){const {error}=await admin.from("campus_notifications").insert(rows);if(error)throw new Error("in_app_insert_failed");}}
    let notificationId:string|null=null;
    if(ids.length){const response=await fetch("https://api.onesignal.com/notifications",{method:"POST",headers:{"Authorization":"Key "+key,"Content-Type":"application/json"},body:JSON.stringify({app_id:APP_ID,include_aliases:{external_id:ids},target_channel:"push",headings:{en:"New post on your college Connect Board"},contents:{en:"Open Hapn to see what's new on your campus."},url:"https://hapn.info/connect/board/"}),signal:AbortSignal.timeout(10000)});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error("onesignal_delivery_failed");notificationId=typeof result.id==="string"?result.id:null;}
    const {error:done}=await admin.from("campus_push_deliveries").update({status:"sent",recipient_count:ids.length,onesignal_notification_id:notificationId,sent_at:new Date().toISOString()}).eq("post_id",postId);if(done)throw new Error("delivery_status_update_failed");claimed=false;
    return reply({sent:true,recipients:ids.length,push_submitted:ids.length>0,id:notificationId});
  } catch(e) {
    console.error("[send-campus-post-push]",String(e));
    return reply({error:"The notification could not be sent. Please try again."},500);
  } finally {
    if(claimed&&admin&&postId){await admin.from("campus_notifications").delete().eq("post_id",postId).eq("notification_type","info");await admin.from("campus_push_deliveries").delete().eq("post_id",postId);}
  }
});