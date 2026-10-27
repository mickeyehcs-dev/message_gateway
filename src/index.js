const ADMIN_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Notification Gateway Admin</title>
<style>
:root{color-scheme:dark;--bg:#0b1020;--panel:#121a2b;--panel2:#182238;--line:#2a3853;--text:#eef3ff;--muted:#a8b5cc;--accent:#77a7ff;--danger:#ff8181;--ok:#72d6a0}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
header{padding:22px max(18px,calc((100% - 1200px)/2));border-bottom:1px solid var(--line);background:#0e1628;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}
h1{font-size:22px;margin:0}h2{font-size:17px;margin:0 0 14px}p{color:var(--muted);margin:5px 0}
main{max-width:1200px;margin:24px auto;padding:0 18px}.panel{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px;margin-bottom:18px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}.tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px}
button,.button{border:1px solid #38517a;border-radius:9px;padding:9px 13px;background:#1a2a47;color:var(--text);cursor:pointer;font:inherit}
button.primary{background:#315fb2;border-color:#477bd7}button.danger{border-color:#874b58;background:#48242e}
button:disabled{opacity:.5;cursor:not-allowed}input,select,textarea{width:100%;background:#0b1324;color:var(--text);border:1px solid #33435e;border-radius:8px;padding:10px;font:inherit;margin:4px 0 12px}
label{display:block;color:var(--muted);font-size:13px}textarea{min-height:75px;resize:vertical}.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.row>*{flex:1}.muted{color:var(--muted)}.hidden{display:none!important}
.notice{padding:12px;border-radius:9px;background:#182238;border:1px solid var(--line);margin:12px 0;white-space:pre-wrap;overflow-wrap:anywhere}
.notice.error{border-color:#874b58;color:#ffb1b1}.notice.ok{border-color:#326b51;color:#a4f0c2}
.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:10px;border-bottom:1px solid var(--line);vertical-align:top;max-width:380px;overflow-wrap:anywhere}th{color:var(--muted);font-weight:600}
.tag{display:inline-block;border:1px solid var(--line);padding:2px 7px;border-radius:99px;font-size:12px;color:var(--muted)}
#login{max-width:460px;margin:10vh auto}small{color:var(--muted)}.top-actions{display:flex;gap:8px;align-items:center}
</style>
</head>
<body>
<header><div><h1>Universal Notification Gateway</h1><p>Admin console · topics, sources, destinations, groups and subscriptions</p></div><div class="top-actions"><button id="refreshBtn" class="hidden">Refresh data</button><button id="logoutBtn" class="hidden">Log out</button></div></header>
<main>
<section id="login" class="panel">
<h2>Admin sign in</h2><p>Sign in with the username and password registered in the gateway D1 database.</p>
<form id="loginForm" autocomplete="on">
<label for="loginUsername">Username</label><input id="loginUsername" name="username" type="text" autocomplete="username" required maxlength="64" placeholder="Admin username">
<label for="loginPassword">Password</label><input id="loginPassword" name="password" type="password" autocomplete="current-password" required maxlength="256" placeholder="Admin password">
<button class="primary" id="loginBtn" type="submit">Sign in</button>
</form><div id="loginMsg" class="notice hidden" role="status" aria-live="polite"></div>
</section>
<section id="app" class="hidden">
<div id="message" class="notice hidden"></div>
<div class="tabs">
<button data-tab="overview" class="primary">Overview</button><button data-tab="topics">Topics</button><button data-tab="sources">Sources</button><button data-tab="destinations">Destinations</button><button data-tab="groups">Groups</button><button data-tab="subscriptions">Subscriptions</button><button data-tab="logs">Delivery logs</button>
</div>
<section id="view-overview" class="panel"><h2>Overview</h2><p>Manage the gateway using the forms below. Create topics first, then sources and destinations, then subscriptions.</p><div id="stats" class="grid"></div><p class="muted">Wildcard topics are disabled. A source can only publish topics explicitly assigned to its token.</p></section>
<section id="view-topics" class="hidden">
<div class="grid"><div class="panel"><h2>Create topic</h2><form id="topicForm"><label>Topic name (explicit only)</label><input name="name" required pattern="[A-Za-z0-9][A-Za-z0-9._:-]{0,99}" placeholder="security.attack"><label>Description</label><input name="description" placeholder="Security alerts"><button class="primary">Create topic</button></form></div><div class="panel"><h2>Existing topics</h2><div id="topicsTable"></div></div></div>
</section>
<section id="view-sources" class="hidden">
<div class="grid"><div class="panel"><h2>Create source</h2><form id="sourceForm"><label>Source name</label><input name="name" required maxlength="100" placeholder="production-server"><label>Allowed topics (select one or more)</label><select name="allowed_topics" id="sourceTopics" multiple required size="5"></select><small>Use Ctrl/Cmd to select multiple topics.</small><p><button class="primary">Create source</button></p></form><div id="newToken" class="notice hidden"></div></div><div class="panel"><h2>Sources</h2><div id="sourcesTable"></div></div></div>
</section>
<section id="view-destinations" class="hidden">
<div class="grid"><div class="panel"><h2>Add destination</h2><form id="destinationForm"><label>Display name</label><input name="name" required maxlength="100" placeholder="security-email"><label>Channel</label><select name="type" id="destType"><option value="email">Email</option><option value="telegram">Telegram bot + chat</option><option value="ntfy">ntfy topic</option></select>
<div id="emailFields"><label>Recipient email</label><input name="to" type="email" placeholder="ops@example.com"><label>Sender ID</label><input name="sender_id" required placeholder="snd_..."><label>Email API key</label><input name="api_key" type="password" autocomplete="new-password" required placeholder="Your sender API key"></div>
<div id="telegramFields" class="hidden"><label>Telegram bot token</label><input name="bot_token" type="password" autocomplete="off"><label>Telegram chat ID</label><input name="chat_id" placeholder="-1001234567890"></div>
<div id="ntfyFields" class="hidden"><label>ntfy base URL</label><input name="base_url" value="https://ntfy.sh"><label>ntfy topic</label><input name="topic" placeholder="private-alert-topic"><label>ntfy access token (optional)</label><input name="token" type="password" autocomplete="off"></div>
<button class="primary">Add destination</button></form><small>Secrets are sent over HTTPS and encrypted in D1 by the Worker. Never share this admin page publicly.</small></div><div class="panel"><h2>Destinations</h2><div id="destinationsTable"></div></div></div>
</section>
<section id="view-groups" class="hidden">
<div class="grid"><div class="panel"><h2>Create recipient group</h2><form id="groupForm"><label>Group name</label><input name="name" required placeholder="operations"><label>Description</label><input name="description" placeholder="Operations recipients"><button class="primary">Create group</button></form><hr style="border-color:var(--line);margin:20px 0"><h2>Add destination to group</h2><form id="memberForm"><label>Group</label><select name="group_id" id="memberGroup" required></select><label>Destination</label><select name="destination_id" id="memberDestination" required></select><button class="primary">Add member</button></form></div><div class="panel"><h2>Groups</h2><div id="groupsTable"></div><h2 style="margin-top:20px">Group members</h2><div id="membersTable"></div></div></div>
</section>
<section id="view-subscriptions" class="hidden">
<div class="grid"><div class="panel"><h2>Create subscription</h2><form id="subscriptionForm"><label>Topic</label><select name="topic" id="subTopic" required></select><label>Source filter (optional)</label><select name="source_id" id="subSource"><option value="">All authorized sources</option></select><label>Severity filter (optional)</label><select name="severity"><option value="">All severities</option><option>info</option><option>warning</option><option>error</option><option>critical</option></select><label>Deliver to</label><select name="target_type" id="targetType"><option value="destination">Individual destination</option><option value="group">Recipient group</option></select><label>Destination / group</label><select name="target_id" id="targetId" required></select><button class="primary">Create subscription</button></form></div><div class="panel"><h2>Subscriptions</h2><div id="subscriptionsTable"></div></div></div>
</section>
<section id="view-logs" class="panel hidden"><h2>Recent delivery logs</h2><div id="logsTable"></div></section>
</section>
</main>
<script>
(() => {
const $ = (id) => document.getElementById(id);
// Storage can be blocked in some browser/privacy modes. Never let that stop
// the login script from registering the Connect handler.
function getSavedKey() { try { return window.sessionStorage.getItem("ngw_admin_key") || ""; } catch (_) { return ""; } }
function saveKey(value) { try { window.sessionStorage.setItem("ngw_admin_key", value); } catch (_) {} }
function clearSavedKey() { try { window.sessionStorage.removeItem("ngw_admin_key"); } catch (_) {} }
let key = getSavedKey();
let cache = {topics:[],sources:[],destinations:[],groups:[],members:[],subscriptions:[],logs:[]};
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function msg(text, type="ok", target="message") { const el=$(target); el.textContent=text; el.className="notice "+type; }
function hideMsg(target="message") { $(target).classList.add("hidden"); }
async function api(path, options={}) {
  const headers = {"Authorization":"Bearer "+key, ...(options.body ? {"Content-Type":"application/json"} : {}), ...(options.headers||{})};
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  let response;
  try {
    response = await fetch(path,{...options,headers,signal:controller.signal});
  } catch (error) {
    if (error && error.name === "AbortError") throw new Error("Request timed out after 12 seconds");
    throw new Error("Cannot reach the Worker API. Check the domain and deployment.");
  } finally {
    clearTimeout(timeout);
  }
  const data = await response.json().catch(()=>({error:"Invalid server response"}));
  if (!response.ok) throw new Error(data.error || ("HTTP "+response.status));
  return data;
}
function table(items, columns, actions=[]) {
  if (!items || !items.length) return '<p class="muted">No records yet.</p>';
  return '<div class="table-wrap"><table><thead><tr>'+columns.map(c=>'<th>'+esc(c.label)+'</th>').join('')+(actions.length?'<th>Actions</th>':'')+'</tr></thead><tbody>'+
    items.map(item=>'<tr>'+columns.map(c=>'<td>'+esc(c.render?c.render(item):item[c.key])+'</td>').join('')+
    (actions.length?'<td>'+actions.map(a=>'<button data-action="'+esc(a.action)+'" data-id="'+esc(item.id)+'" class="'+(a.danger?'danger':'')+'">'+esc(a.label)+'</button>').join(' '):'')+'</td></tr>').join('')+
    '</tbody></table></div>';
}
function options(el, items, label, value="id", includeBlank=false, blankLabel="—") {
  el.innerHTML=(includeBlank?'<option value="">'+esc(blankLabel)+'</option>':'')+items.map(x=>'<option value="'+esc(x[value])+'">'+esc(label(x))+'</option>').join('');
}
function selectedValues(select) { return [...select.selectedOptions].map(o=>o.value); }
function showTab(name) {
  document.querySelectorAll('[id^="view-"]').forEach(el=>el.classList.add("hidden"));
  $("view-"+name).classList.remove("hidden");
  document.querySelectorAll("[data-tab]").forEach(b=>b.classList.toggle("primary",b.dataset.tab===name));
}
function showApp() { $("login").classList.add("hidden"); $("app").classList.remove("hidden"); $("refreshBtn").classList.remove("hidden"); $("logoutBtn").classList.remove("hidden"); }
function showLogin() { $("login").classList.remove("hidden"); $("app").classList.add("hidden"); $("refreshBtn").classList.add("hidden"); $("logoutBtn").classList.add("hidden"); }
async function load() {
  const [topics,sources,destinations,groups,members,subscriptions,logs] = await Promise.all([
    api("/v1/admin/topics"),api("/v1/admin/sources"),api("/v1/admin/destinations"),api("/v1/admin/groups"),api("/v1/admin/group-members"),api("/v1/admin/subscriptions"),api("/v1/admin/logs?limit=100")
  ]);
  cache={topics:topics.items||[],sources:sources.items||[],destinations:destinations.items||[],groups:groups.items||[],members:members.items||[],subscriptions:subscriptions.items||[],logs:logs.items||[]};
  render();
}
function render() {
  $("stats").innerHTML=[["Topics",cache.topics.length],["Sources",cache.sources.length],["Destinations",cache.destinations.length],["Subscriptions",cache.subscriptions.length]].map(([k,v])=>'<div class="panel"><p>'+esc(k)+'</p><strong style="font-size:28px">'+v+'</strong></div>').join('');
  $("topicsTable").innerHTML=table(cache.topics,[{key:"name",label:"Topic"},{key:"description",label:"Description"},{key:"enabled",label:"Enabled"}],[{action:"disable-topic",label:"Disable",danger:true}]);
  $("sourcesTable").innerHTML=table(cache.sources,[{key:"name",label:"Source"},{key:"enabled",label:"Enabled"},{key:"created_at",label:"Created"}],[{action:"disable-source",label:"Disable",danger:true}]);
  $("destinationsTable").innerHTML=table(cache.destinations,[{key:"name",label:"Name"},{key:"type",label:"Type"},{key:"enabled",label:"Enabled"},{key:"config",label:"Config",render:x=>JSON.stringify(x.config)}],[{action:"disable-destination",label:"Disable",danger:true}]);
  $("groupsTable").innerHTML=table(cache.groups,[{key:"name",label:"Group"},{key:"description",label:"Description"},{key:"enabled",label:"Enabled"}],[{action:"disable-group",label:"Disable",danger:true}]);
  $("membersTable").innerHTML=table(cache.members,[{key:"group_name",label:"Group"},{key:"destination_name",label:"Destination"},{key:"type",label:"Type"},{key:"enabled",label:"Enabled"}]);
  $("subscriptionsTable").innerHTML=table(cache.subscriptions,[{key:"topic",label:"Topic"},{key:"source_name",label:"Source filter",render:x=>x.source_name||"All sources"},{key:"severity",label:"Severity",render:x=>x.severity||"All"},{key:"destination_name",label:"Destination",render:x=>x.destination_name||("Group: "+(x.group_name||"unknown"))},{key:"enabled",label:"Enabled"}],[{action:"disable-subscription",label:"Disable",danger:true}]);
  $("logsTable").innerHTML=table(cache.logs,[{key:"created_at",label:"Time"},{key:"topic",label:"Topic"},{key:"source_name",label:"Source"},{key:"destination_name",label:"Destination"},{key:"status",label:"Status"},{key:"http_status",label:"HTTP"},{key:"response_excerpt",label:"Response"}]);
  options($("sourceTopics"),cache.topics.filter(x=>x.enabled),x=>x.name,"name");
  options($("subTopic"),cache.topics.filter(x=>x.enabled),x=>x.name,"name");
  options($("subSource"),cache.sources.filter(x=>x.enabled),x=>x.name,"id",true,"All authorized sources");
  options($("memberGroup"),cache.groups.filter(x=>x.enabled),x=>x.name);
  options($("memberDestination"),cache.destinations.filter(x=>x.enabled),x=>x.name+" ("+x.type+")");
  updateTargetOptions();
}
function updateTargetOptions() {
  const group=$("targetType").value==="group";
  options($("targetId"),(group?cache.groups:cache.destinations).filter(x=>x.enabled),x=>group?x.name:x.name+" ("+x.type+")");
}
async function submitForm(id, path, transform=(o)=>o, success="Saved") {
  const form=$(id);
  form.addEventListener("submit", async (event)=>{
    event.preventDefault(); hideMsg();
    const raw=Object.fromEntries(new FormData(form).entries());
    try { const result=await api(path,{method:"POST",body:JSON.stringify(transform(raw,form))});
      if(id==="sourceForm" && result.token){$("newToken").textContent="Copy this source token now; it will not be shown again:\n"+result.token;$("newToken").className="notice ok";}
      form.reset(); await load(); msg(success+(result.token?" (source token displayed separately)":"")); 
    } catch(e) { msg(e.message,"error"); }
  }, {once:false});
}
// Expose the login action explicitly so the button can invoke it directly.
// This also makes failures visible if an event listener was not attached.
$("loginForm").addEventListener("submit", async (event)=>{
  event.preventDefault();
  const username=$("loginUsername").value.trim(), password=$("loginPassword").value, button=$("loginBtn");
  if(!username || !password){msg("Enter both username and password.","error","loginMsg");return;}
  button.disabled=true; button.textContent="Signing in…"; msg("Checking credentials against D1…","ok","loginMsg");
  try {
    const response=await fetch("/v1/auth/login",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},cache:"no-store",body:JSON.stringify({username,password})});
    const result=await response.json().catch(()=>({error:"The server returned an invalid response."}));
    if(!response.ok || !result.token) throw new Error(result.error || ("Login failed (HTTP "+response.status+")"));
    key=result.token; sessionStorage.setItem("ngw_admin_key",key); $("loginPassword").value=""; showApp(); showTab("overview");
    try { await load(); hideMsg("loginMsg"); msg("Signed in as "+(result.username||username)+"."); }
    catch(loadError){msg("Signed in, but dashboard data failed to load: "+loadError.message,"error");}
  } catch(error) { key=""; sessionStorage.removeItem("ngw_admin_key"); showLogin(); msg(error.message||"Could not reach the login service.","error","loginMsg"); }
  finally {button.disabled=false;button.textContent="Sign in";}
});
$("logoutBtn").addEventListener("click",async()=>{try{if(key)await fetch("/v1/auth/logout",{method:"POST",headers:{Authorization:"Bearer "+key},cache:"no-store"});}catch(_){}sessionStorage.removeItem("ngw_admin_key");key="";$("loginPassword").value="";showLogin()});
$("refreshBtn").addEventListener("click",()=>load().then(()=>msg("Data refreshed")).catch(e=>msg(e.message,"error")));
document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>showTab(b.dataset.tab)));
$("destType").addEventListener("change",()=>{
  const type=$("destType").value;
  $("emailFields").classList.toggle("hidden",type!=="email");
  $("telegramFields").classList.toggle("hidden",type!=="telegram");
  $("ntfyFields").classList.toggle("hidden",type!=="ntfy");
});
$("targetType").addEventListener("change",updateTargetOptions);
submitForm("topicForm","/v1/admin/topics",o=>o,"Topic created.");
submitForm("sourceForm","/v1/admin/sources",(o,form)=>({name:o.name,allowed_topics:selectedValues(form.elements.allowed_topics)}),"Source created.");
submitForm("destinationForm","/v1/admin/destinations",o=>{
  const base={name:o.name,type:o.type};
  if(o.type==="email")return {...base,to:o.to,sender_id:o.sender_id,api_key:o.api_key};
  if(o.type==="telegram")return {...base,bot_token:o.bot_token,chat_id:o.chat_id};
  return {...base,base_url:o.base_url,topic:o.topic,...(o.token?{token:o.token}:{})};
},"Destination created.");
submitForm("groupForm","/v1/admin/groups",o=>o,"Group created.");
submitForm("memberForm","/v1/admin/group-members",o=>({group_id:Number(o.group_id),destination_id:Number(o.destination_id)}),"Group member added.");
submitForm("subscriptionForm","/v1/admin/subscriptions",o=>({
  topic:o.topic,source_id:o.source_id?Number(o.source_id):null,severity:o.severity||null,
  ...(o.target_type==="group"?{group_id:Number(o.target_id)}:{destination_id:Number(o.target_id)})
}),"Subscription created.");
document.addEventListener("click",async e=>{
  const b=e.target.closest("button[data-action]"); if(!b)return;
  const map={"disable-topic":"topics","disable-source":"sources","disable-destination":"destinations","disable-group":"groups","disable-subscription":"subscriptions"};
  const entity=map[b.dataset.action];if(!entity)return;
  if(!confirm("Disable this "+entity.slice(0,-1)+"? This does not delete history."))return;
  try{await api("/v1/admin/"+entity+"/"+b.dataset.id+"/disable",{method:"POST"});await load();msg("Record disabled.");}
  catch(err){msg(err.message,"error");}
});
if(key){showApp();load().catch(e=>{sessionStorage.removeItem("ngw_admin_key");key="";showLogin();msg("Your session expired. Please sign in again. "+e.message,"error","loginMsg")});}
})();
</script>
</body>
</html>`;

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff"
};

const SEVERITIES = new Set(["info", "warning", "error", "critical"]);
const DESTINATION_TYPES = new Set(["email", "telegram", "ntfy"]);
const MAX_BODY_BYTES = 32 * 1024;

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders }
  });
}

function fail(message, status = 400, details = undefined) {
  return json({ ok: false, error: message, ...(details ? { details } : {}) }, status);
}

function corsHeaders(request, env) {
  // API-only by default. Set CORS_ORIGIN to one exact origin if a trusted
  // browser-based admin UI is added later. Never use "*" with credentials.
  const origin = request.headers.get("Origin");
  const allowed = env.CORS_ORIGIN;
  if (origin && allowed && origin === allowed) {
    return {
      "access-control-allow-origin": allowed,
      "access-control-allow-methods": "GET, POST, PATCH, OPTIONS",
      "access-control-allow-headers": "Authorization, Content-Type, Idempotency-Key",
      "vary": "Origin"
    };
  }
  return {};
}

function withCors(response, headers) {
  const out = new Response(response.body, response);
  for (const [key, value] of Object.entries(headers)) out.headers.set(key, value);
  return out;
}

function bearer(request) {
  const value = request.headers.get("Authorization") || "";
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(prefix = "ngw") {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw = btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  return `${prefix}_${raw}`;
}

function validSlug(value) {
  return typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(value);
}

function safeText(value, max = 2000) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

async function readJson(request) {
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > MAX_BODY_BYTES) throw new Error("Request body too large");
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) throw new Error("Request body too large");
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Body must be valid JSON");
  }
}

async function requireAdmin(request, env) {
  const supplied = bearer(request);
  if (!supplied || supplied.length > 200) return false;
  const tokenHash = await sha256Hex(supplied);
  const session = await env.DB.prepare(`
    SELECT s.token_hash FROM admin_sessions s
    JOIN admin_users u ON u.username = s.username
    WHERE s.token_hash = ? AND s.expires_at > datetime('now') AND u.enabled = 1
    LIMIT 1
  `).bind(tokenHash).first();
  return !!session;
}

const ADMIN_PASSWORD_ITERATIONS = 210000;
function base64ToBytes(value) {
  const raw = atob(value);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
async function verifyAdminPassword(password, saltBase64, expectedBase64, iterations) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name:'PBKDF2', hash:'SHA-256', salt:base64ToBytes(saltBase64), iterations:Number(iterations)||ADMIN_PASSWORD_ITERATIONS}, key, 256);
  const actual = new Uint8Array(bits), expected = base64ToBytes(expectedBase64);
  if (actual.length !== expected.length) return false;
  let diff = 0; for (let i=0;i<actual.length;i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}
async function handleAdminLogin(request, env) {
  let body;
  try { body = await readJson(request); } catch (error) { return fail(error.message, 400); }
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(username) || password.length < 1 || password.length > 256) return fail('Enter a valid username and password.', 400);
  const user = await env.DB.prepare('SELECT username, salt, password_hash, iterations, enabled FROM admin_users WHERE username = ? LIMIT 1').bind(username).first();
  let valid = false;
  try {
    if (user && user.enabled === 1) valid = await verifyAdminPassword(password, user.salt, user.password_hash, user.iterations);
    else await verifyAdminPassword(password, 'MDEyMzQ1Njc4OWFiY2RlZg==', 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', ADMIN_PASSWORD_ITERATIONS);
  } catch (error) {
    console.error('admin_password_verify_failed', {message:error instanceof Error ? error.message : 'unknown'});
    return fail('Authentication service is not configured correctly.', 500);
  }
  if (!valid) return fail('Invalid username or password.', 401);
  const token = randomToken('ngw_session'), tokenHash = await sha256Hex(token);
  await env.DB.prepare("DELETE FROM admin_sessions WHERE expires_at <= datetime('now')").run();
  await env.DB.prepare("INSERT INTO admin_sessions (token_hash, username, expires_at) VALUES (?, ?, datetime('now', '+8 hours'))").bind(tokenHash, user.username).run();
  return json({ok:true, token, username:user.username, expires_in:28800});
}
async function handleAdminLogout(request, env) {
  const supplied = bearer(request);
  if (supplied) await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(await sha256Hex(supplied)).run();
  return json({ok:true, logged_out:true});
}

async function requireSource(request, env) {
  const supplied = bearer(request);
  if (!supplied) return null;
  const hash = await sha256Hex(supplied);
  return await env.DB.prepare(
    "SELECT id, name, enabled FROM sources WHERE token_hash = ? LIMIT 1"
  ).bind(hash).first();
}

async function deriveEncryptionKey(secret) {
  if (!secret || secret.length < 32) throw new Error("DESTINATION_ENCRYPTION_KEY must be at least 32 characters");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptSecret(value, env) {
  if (!value) return null;
  const key = await deriveEncryptionKey(env.DESTINATION_ENCRYPTION_KEY);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(value);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decryptSecret(value, env) {
  if (!value) return "";
  const combined = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const key = await deriveEncryptionKey(env.DESTINATION_ENCRYPTION_KEY);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}

async function logDelivery(env, eventId, destinationId, status, httpStatus, responseText) {
  await env.DB.prepare(`
    INSERT INTO delivery_logs (event_id, destination_id, status, http_status, response_excerpt, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).bind(eventId, destinationId, status, httpStatus ?? null, String(responseText || "").slice(0, 1000)).run();
}

async function sendEmail(destination, env, message) {
  const cfg = JSON.parse(destination.config_json);
  // Each email destination has its own API key, encrypted at rest in D1.
  const apiKey = await decryptSecret(destination.secret_ciphertext, env);
  if (!apiKey) throw new Error("Email API key is not configured for this destination");
  if (!cfg.sender_id) throw new Error("Sender ID is not configured for this destination");
  const response = await fetch(env.EMAIL_API_URL || "https://sender-api.mickey.qzz.io/api/v1/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey
    },
    body: JSON.stringify({
      to: cfg.to,
      subject: message.subject || `[${message.severity.toUpperCase()}] ${message.topic}`,
      html: message.html || buildEmailHtml(message),
      sender_id: cfg.sender_id
    }),
    signal: AbortSignal.timeout(10000)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Email provider returned HTTP ${response.status}: ${text.slice(0, 300)}`);
  return { httpStatus: response.status, responseText: text };
}

async function sendTelegram(destination, env, message) {
  const cfg = JSON.parse(destination.config_json);
  const botToken = await decryptSecret(destination.secret_ciphertext, env);
  if (!botToken) throw new Error("Telegram bot token is missing");
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const body = {
    chat_id: cfg.chat_id,
    text: formatPlainText(message),
    disable_web_page_preview: true
  };
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Telegram API returned HTTP ${response.status}: ${text.slice(0, 300)}`);
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = {}; }
  if (parsed.ok === false) throw new Error(`Telegram API error: ${String(parsed.description || "unknown error").slice(0, 300)}`);
  return { httpStatus: response.status, responseText: text };
}

async function sendNtfy(destination, env, message) {
  const cfg = JSON.parse(destination.config_json);
  const base = String(cfg.base_url || "https://ntfy.sh").replace(/\/+$/, "");
  const topic = String(cfg.topic || "");
  // Only allow an origin-like base URL; no embedded credentials.
  const parsed = new URL(base);
  if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error("Invalid ntfy base_url");
  }
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(topic)) throw new Error("Invalid ntfy topic");
  const headers = {
    "Content-Type": "application/json",
    "Title": (message.subject || `${message.severity.toUpperCase()}: ${message.topic}`).slice(0, 250),
    "Priority": message.severity === "critical" ? "urgent" : message.severity === "error" ? "high" : message.severity === "warning" ? "default" : "low",
    "Tags": message.severity === "critical" ? "rotating_light" : "bell"
  };
  const token = await decryptSecret(destination.secret_ciphertext, env);
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${base}/${encodeURIComponent(topic)}`, {
    method: "POST",
    headers,
    body: message.message,
    signal: AbortSignal.timeout(10000)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`ntfy returned HTTP ${response.status}: ${text.slice(0, 300)}`);
  return { httpStatus: response.status, responseText: text };
}

function formatPlainText(message) {
  const lines = [
    `[${message.severity.toUpperCase()}] ${message.topic}`,
    `Source: ${message.source_name}`,
    message.message
  ];
  if (message.metadata && Object.keys(message.metadata).length) {
    lines.push(`Metadata: ${JSON.stringify(message.metadata).slice(0, 1500)}`);
  }
  return lines.join("\n").slice(0, 3900);
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function buildEmailHtml(message) {
  const metadata = message.metadata && Object.keys(message.metadata).length
    ? `<pre style="white-space:pre-wrap;background:#f4f4f5;padding:12px;border-radius:8px">${escapeHtml(JSON.stringify(message.metadata, null, 2).slice(0, 5000))}</pre>`
    : "";
  return `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#18181b">
    <div style="padding:16px;background:#111827;color:white;border-radius:10px 10px 0 0">
      <strong>${escapeHtml(message.severity.toUpperCase())}</strong> · ${escapeHtml(message.topic)}
    </div>
    <div style="padding:20px;border:1px solid #e4e4e7;border-radius:0 0 10px 10px">
      <p><strong>Source:</strong> ${escapeHtml(message.source_name)}</p>
      <p style="white-space:pre-wrap">${escapeHtml(message.message)}</p>
      ${metadata}
      <p style="font-size:12px;color:#71717a">Notification Gateway</p>
    </div>
  </div>`;
}

async function deliverToDestination(destination, env, message) {
  try {
    let result;
    if (destination.type === "email") result = await sendEmail(destination, env, message);
    else if (destination.type === "telegram") result = await sendTelegram(destination, env, message);
    else if (destination.type === "ntfy") result = await sendNtfy(destination, env, message);
    else throw new Error("Unsupported destination type");
    await logDelivery(env, message.event_id, destination.id, "success", result.httpStatus, result.responseText);
    return { destination_id: destination.id, name: destination.name, type: destination.type, status: "success", http_status: result.httpStatus };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown delivery error";
    await logDelivery(env, message.event_id, destination.id, "failed", null, reason).catch(() => {});
    return { destination_id: destination.id, name: destination.name, type: destination.type, status: "failed", error: reason };
  }
}

async function createEvent(env, event) {
  const result = await env.DB.prepare(`
    INSERT INTO events (source_id, topic, severity, message, metadata_json, idempotency_key, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(
    event.source_id, event.topic, event.severity, event.message,
    JSON.stringify(event.metadata || {}), event.idempotency_key || null
  ).run();
  return result.meta.last_row_id;
}

async function handleNotify(request, env) {
  const source = await requireSource(request, env);
  if (!source || !source.enabled) return fail("Invalid or disabled source token", 401);

  let body;
  try { body = await readJson(request); }
  catch (e) { return fail(e.message, 400); }

  if (!validSlug(body.topic)) return fail("topic is required and must be an explicit topic slug");
  if (!SEVERITIES.has(body.severity || "info")) return fail("severity must be info, warning, error, or critical");
  if (!safeText(body.message, 10000)) return fail("message is required (maximum 10000 characters)");
  if (body.subject !== undefined && !safeText(body.subject, 250)) return fail("subject must be 1-250 characters");
  if (body.html !== undefined && (!safeText(body.html, 20000))) return fail("html must be 1-20000 characters");
  if (body.metadata !== undefined && (body.metadata === null || typeof body.metadata !== "object" || Array.isArray(body.metadata))) {
    return fail("metadata must be a JSON object");
  }
  const severity = body.severity || "info";
  const topic = await env.DB.prepare("SELECT name FROM topics WHERE name = ? AND enabled = 1").bind(body.topic).first();
  if (!topic) return fail("Unknown or disabled topic. Wildcards are not supported; register the topic first.", 422);

  const permission = await env.DB.prepare(
    "SELECT 1 AS allowed FROM source_topics WHERE source_id = ? AND topic_name = ?"
  ).bind(source.id, body.topic).first();
  if (!permission) return fail("This source is not authorized to publish this topic", 403);

  const idempotencyKey = body.idempotency_key || request.headers.get("Idempotency-Key") || null;
  if (idempotencyKey !== null && (typeof idempotencyKey !== "string" || idempotencyKey.length < 1 || idempotencyKey.length > 128)) {
    return fail("idempotency_key must be 1-128 characters");
  }
  if (idempotencyKey) {
    const existing = await env.DB.prepare(
      "SELECT id, created_at FROM events WHERE source_id = ? AND idempotency_key = ?"
    ).bind(source.id, idempotencyKey).first();
    if (existing) return json({ ok: true, duplicate: true, event_id: existing.id, created_at: existing.created_at });
  }

  const event = {
    source_id: source.id,
    source_name: source.name,
    topic: body.topic,
    severity,
    message: body.message,
    subject: body.subject,
    html: body.html,
    metadata: body.metadata || {},
    idempotency_key: idempotencyKey
  };
  let eventId;
  try {
    eventId = await createEvent(env, event);
  } catch (e) {
    if (idempotencyKey) {
      const existing = await env.DB.prepare("SELECT id, created_at FROM events WHERE source_id = ? AND idempotency_key = ?")
        .bind(source.id, idempotencyKey).first();
      if (existing) return json({ ok: true, duplicate: true, event_id: existing.id, created_at: existing.created_at });
    }
    return fail("Could not record event", 500);
  }
  event.event_id = eventId;

  const rows = await env.DB.prepare(`
    SELECT DISTINCT d.id, d.name, d.type, d.config_json, d.secret_ciphertext
    FROM subscriptions s
    JOIN topics t ON t.id = s.topic_id AND t.enabled = 1
    JOIN destinations d ON d.enabled = 1
    LEFT JOIN recipient_groups rg ON rg.id = s.group_id AND rg.enabled = 1
    LEFT JOIN group_members gm ON gm.destination_id = d.id AND gm.enabled = 1
    WHERE s.enabled = 1
      AND t.name = ?
      AND (s.source_id IS NULL OR s.source_id = ?)
      AND (s.severity IS NULL OR s.severity = ?)
      AND (
        s.destination_id = d.id OR
        (s.group_id IS NOT NULL AND rg.id IS NOT NULL AND gm.group_id = s.group_id)
      )
  `).bind(event.topic, source.id, severity).all();

  const destinations = rows.results || [];
  if (!destinations.length) {
    return json({ ok: true, event_id: eventId, matched_destinations: 0, deliveries: [], message: "Event recorded; no active subscriptions matched." });
  }

  // Synchronous delivery: the request waits for every matching provider call.
  // Each provider has a 10-second timeout. Delivery failures are returned per destination.
  const deliveries = await Promise.all(destinations.map((destination) => deliverToDestination(destination, env, event)));
  const failed = deliveries.filter((item) => item.status === "failed").length;
  return json({
    ok: failed === 0,
    event_id: eventId,
    matched_destinations: deliveries.length,
    succeeded: deliveries.length - failed,
    failed,
    deliveries
  }, failed ? 207 : 200);
}

async function adminRoute(request, env, url) {
  if (!(await requireAdmin(request, env))) return fail("Unauthorized", 401);
  const path = url.pathname;
  const method = request.method;

  if (method === "GET" && path === "/v1/admin/topics") {
    const r = await env.DB.prepare("SELECT id, name, description, enabled, created_at FROM topics ORDER BY name").all();
    return json({ ok: true, items: r.results });
  }
  if (method === "POST" && path === "/v1/admin/topics") {
    const b = await readJsonSafe(request); if (b.error) return fail(b.error);
    if (!validSlug(b.name)) return fail("name is required (letters, numbers, dot, underscore, colon, hyphen)");
    const description = typeof b.description === "string" ? b.description.slice(0, 500) : "";
    try {
      await env.DB.prepare("INSERT INTO topics (name, description) VALUES (?, ?)").bind(b.name, description).run();
      return json({ ok: true, name: b.name }, 201);
    } catch { return fail("Topic already exists or could not be created", 409); }
  }

  if (method === "GET" && path === "/v1/admin/sources") {
    const r = await env.DB.prepare("SELECT id, name, enabled, created_at FROM sources ORDER BY id DESC").all();
    return json({ ok: true, items: r.results });
  }
  if (method === "POST" && path === "/v1/admin/sources") {
    const b = await readJsonSafe(request); if (b.error) return fail(b.error);
    if (!safeText(b.name, 100)) return fail("name is required (maximum 100 characters)");
    if (!Array.isArray(b.allowed_topics) || b.allowed_topics.length === 0 || b.allowed_topics.some((t) => !validSlug(t))) {
      return fail("allowed_topics must be a non-empty array of explicit topic names");
    }
    const token = randomToken("ngw_src");
    const hash = await sha256Hex(token);
    let id;
    try {
      const r = await env.DB.prepare("INSERT INTO sources (name, token_hash) VALUES (?, ?)").bind(b.name.trim(), hash).run();
      id = r.meta.last_row_id;
      for (const topicName of [...new Set(b.allowed_topics)]) {
        const exists = await env.DB.prepare("SELECT id FROM topics WHERE name = ? AND enabled = 1").bind(topicName).first();
        if (!exists) {
          await env.DB.prepare("DELETE FROM sources WHERE id = ?").bind(id).run();
          return fail(`Topic does not exist or is disabled: ${topicName}`, 422);
        }
        await env.DB.prepare("INSERT INTO source_topics (source_id, topic_name) VALUES (?, ?)").bind(id, topicName).run();
      }
    } catch { return fail("Could not create source; check name and topics", 409); }
    return json({ ok: true, id, name: b.name.trim(), token, warning: "Copy this token now. It cannot be retrieved later." }, 201);
  }

  if (method === "GET" && path === "/v1/admin/destinations") {
    const r = await env.DB.prepare("SELECT id, name, type, config_json, enabled, created_at FROM destinations ORDER BY id DESC").all();
    return json({ ok: true, items: (r.results || []).map((x) => ({ ...x, config: JSON.parse(x.config_json), config_json: undefined })) });
  }
  if (method === "POST" && path === "/v1/admin/destinations") {
    const b = await readJsonSafe(request); if (b.error) return fail(b.error);
    if (!safeText(b.name, 100) || !DESTINATION_TYPES.has(b.type)) return fail("name and valid type (email, telegram, ntfy) are required");
    let config = {};
    let secret = "";
    if (b.type === "email") {
      if (typeof b.to !== "string" || b.to.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.to)) return fail("A valid email address in 'to' is required");
      if (!safeText(b.sender_id, 100)) return fail("sender_id is required (maximum 100 characters)");
      if (!safeText(b.api_key, 1000)) return fail("api_key is required (maximum 1000 characters)");
      secret = b.api_key;
      config = { to: b.to, sender_id: b.sender_id.trim() };
    } else if (b.type === "telegram") {
      if (!safeText(b.bot_token, 300) || !safeText(String(b.chat_id ?? ""), 100)) return fail("bot_token and chat_id are required");
      secret = b.bot_token;
      config = { chat_id: String(b.chat_id) };
    } else {
      const baseUrl = b.base_url || "https://ntfy.sh";
      let parsed;
      try { parsed = new URL(baseUrl); } catch { return fail("Invalid ntfy base_url"); }
      if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) return fail("ntfy base_url must be an HTTP(S) URL without embedded credentials");
      if (typeof b.topic !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(b.topic)) return fail("ntfy topic is invalid");
      if (b.token !== undefined && !safeText(b.token, 1000)) return fail("ntfy token is invalid");
      secret = b.token || "";
      config = { base_url: baseUrl.replace(/\/+$/, ""), topic: b.topic };
    }
    const encrypted = await encryptSecret(secret, env);
    try {
      const r = await env.DB.prepare("INSERT INTO destinations (name, type, config_json, secret_ciphertext) VALUES (?, ?, ?, ?)")
        .bind(b.name.trim(), b.type, JSON.stringify(config), encrypted).run();
      return json({ ok: true, id: r.meta.last_row_id, name: b.name.trim(), type: b.type }, 201);
    } catch { return fail("Could not create destination", 409); }
  }

  if (method === "GET" && path === "/v1/admin/groups") {
    const r = await env.DB.prepare("SELECT id, name, description, enabled, created_at FROM recipient_groups ORDER BY name").all();
    return json({ ok: true, items: r.results });
  }
  if (method === "POST" && path === "/v1/admin/groups") {
    const b = await readJsonSafe(request); if (b.error) return fail(b.error);
    if (!safeText(b.name, 100)) return fail("name is required");
    try {
      const r = await env.DB.prepare("INSERT INTO recipient_groups (name, description) VALUES (?, ?)")
        .bind(b.name.trim(), typeof b.description === "string" ? b.description.slice(0, 500) : "").run();
      return json({ ok: true, id: r.meta.last_row_id, name: b.name.trim() }, 201);
    } catch { return fail("Group already exists or could not be created", 409); }
  }

  if (method === "POST" && path === "/v1/admin/group-members") {
    const b = await readJsonSafe(request); if (b.error) return fail(b.error);
    if (!Number.isInteger(b.group_id) || !Number.isInteger(b.destination_id)) return fail("group_id and destination_id must be integers");
    try {
      await env.DB.prepare("INSERT INTO group_members (group_id, destination_id) VALUES (?, ?)").bind(b.group_id, b.destination_id).run();
      return json({ ok: true }, 201);
    } catch { return fail("Membership already exists or group/destination is invalid", 409); }
  }
  if (method === "GET" && path === "/v1/admin/group-members") {
    const r = await env.DB.prepare(`
      SELECT gm.group_id, g.name AS group_name, gm.destination_id, d.name AS destination_name, d.type, gm.enabled
      FROM group_members gm JOIN recipient_groups g ON g.id=gm.group_id JOIN destinations d ON d.id=gm.destination_id
      ORDER BY g.name, d.name
    `).all();
    return json({ ok: true, items: r.results });
  }

  if (method === "GET" && path === "/v1/admin/subscriptions") {
    const r = await env.DB.prepare(`
      SELECT s.id, t.name AS topic, s.source_id, src.name AS source_name, s.severity,
             s.destination_id, d.name AS destination_name, s.group_id, g.name AS group_name,
             s.enabled, s.created_at
      FROM subscriptions s JOIN topics t ON t.id=s.topic_id
      LEFT JOIN sources src ON src.id=s.source_id
      LEFT JOIN destinations d ON d.id=s.destination_id
      LEFT JOIN recipient_groups g ON g.id=s.group_id
      ORDER BY s.id DESC
    `).all();
    return json({ ok: true, items: r.results });
  }
  if (method === "POST" && path === "/v1/admin/subscriptions") {
    const b = await readJsonSafe(request); if (b.error) return fail(b.error);
    if (!validSlug(b.topic)) return fail("topic is required");
    if (b.severity != null && !SEVERITIES.has(b.severity)) return fail("severity must be info, warning, error, or critical");
    const hasDest = Number.isInteger(b.destination_id);
    const hasGroup = Number.isInteger(b.group_id);
    if (hasDest === hasGroup) return fail("Provide exactly one of destination_id or group_id");
    const topic = await env.DB.prepare("SELECT id FROM topics WHERE name = ? AND enabled = 1").bind(b.topic).first();
    if (!topic) return fail("Topic does not exist or is disabled", 422);
    if (b.source_id != null && !Number.isInteger(b.source_id)) return fail("source_id must be an integer or null");
    try {
      await env.DB.prepare(`
        INSERT INTO subscriptions (topic_id, source_id, severity, destination_id, group_id)
        VALUES (?, ?, ?, ?, ?)
      `).bind(topic.id, b.source_id ?? null, b.severity ?? null, hasDest ? b.destination_id : null, hasGroup ? b.group_id : null).run();
      return json({ ok: true }, 201);
    } catch { return fail("Could not create subscription; verify referenced IDs and duplicate rules", 409); }
  }

  // Deactivation endpoints preserve audit history.
  const disableMatch = path.match(/^\/v1\/admin\/(sources|destinations|topics|groups|subscriptions|group-members)\/(\d+)\/disable$/);
  if (method === "POST" && disableMatch) {
    const [, entity, rawId] = disableMatch;
    const id = Number(rawId);
    const table = {
      sources: "sources", destinations: "destinations", topics: "topics",
      groups: "recipient_groups", subscriptions: "subscriptions", "group-members": "group_members"
    }[entity];
    const result = await env.DB.prepare(`UPDATE ${table} SET enabled = 0 WHERE id = ?`).bind(id).run();
    if (!result.meta.changes) return fail("Record not found", 404);
    return json({ ok: true, disabled: true });
  }

  if (method === "GET" && path === "/v1/admin/logs") {
    const limitRaw = Number(url.searchParams.get("limit") || 50);
    const limit = Math.min(200, Math.max(1, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 50));
    const r = await env.DB.prepare(`
      SELECT dl.id, dl.event_id, e.topic, e.severity, e.source_id, s.name AS source_name,
             dl.destination_id, d.name AS destination_name, d.type, dl.status,
             dl.http_status, dl.response_excerpt, dl.created_at
      FROM delivery_logs dl JOIN events e ON e.id=dl.event_id
      LEFT JOIN sources s ON s.id=e.source_id
      LEFT JOIN destinations d ON d.id=dl.destination_id
      ORDER BY dl.id DESC LIMIT ?
    `).bind(limit).all();
    return json({ ok: true, items: r.results });
  }

  return fail("Admin endpoint not found", 404);
}

async function readJsonSafe(request) {
  try { return await readJson(request); }
  catch (e) { return { error: e.message }; }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    let response;
    try {
      if ((url.pathname === "/" || url.pathname === "/admin") && request.method === "GET") {
        response = new Response(ADMIN_HTML, {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
            "content-security-policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
            "x-content-type-options": "nosniff",
            "referrer-policy": "no-referrer",
            "x-frame-options": "DENY"
          }
        });
      } else if (url.pathname === "/health" && request.method === "GET") {
        response = json({ ok: true, service: "universal-notification-gateway" });
      } else if (url.pathname === "/v1/notify" && request.method === "POST") {
        response = await handleNotify(request, env);
      } else if (url.pathname === "/v1/auth/login" && request.method === "POST") {
        response = await handleAdminLogin(request, env);
      } else if (url.pathname === "/v1/auth/logout" && request.method === "POST") {
        response = await handleAdminLogout(request, env);
      } else if (url.pathname.startsWith("/v1/admin/")) {
        if (!["GET", "POST", "PATCH"].includes(request.method)) response = fail("Method not allowed", 405);
        else response = await adminRoute(request, env, url);
      } else {
        response = fail("Not found", 404);
      }
    } catch (error) {
      // Do not return stack traces, environment values, or provider credentials.
      console.error("gateway_error", { path: url.pathname, message: error instanceof Error ? error.message : "unknown" });
      response = fail("Internal server error", 500);
    }
    return withCors(response, cors);
  }
};
