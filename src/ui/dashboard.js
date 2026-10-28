/**
 * Production Admin Dashboard UI
 * Self-contained HTML, CSS, and Vanilla JavaScript
 * Zero external CDN dependencies, zero emojis, dark-blue theme with restrained orange accents
 */

export function renderDashboardHtml() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Notification Gateway &bull; Administration Console</title>
<style>
:root {
  color-scheme: dark;
  --bg-app: #080d1a;
  --bg-sidebar: #0d1527;
  --bg-panel: #121c33;
  --bg-panel-alt: #172440;
  --bg-input: #0a1122;
  --border: #223252;
  --border-focus: #f97316;
  --text-main: #f1f5f9;
  --text-muted: #94a3b8;
  --text-dim: #64748b;
  --accent-orange: #f97316;
  --accent-orange-hover: #ea580c;
  --accent-orange-dim: rgba(249, 115, 22, 0.15);
  --success: #10b981;
  --success-dim: rgba(16, 185, 129, 0.15);
  --warning: #f59e0b;
  --warning-dim: rgba(245, 158, 11, 0.15);
  --danger: #ef4444;
  --danger-dim: rgba(239, 68, 68, 0.15);
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: var(--bg-app);
  color: var(--text-main);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  display: flex;
  min-height: 100vh;
}
/* Layout */
#sidebar {
  width: 250px;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}
.sidebar-header {
  padding: 20px 18px;
  border-bottom: 1px solid var(--border);
}
.logo-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-main);
  letter-spacing: -0.3px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.logo-badge {
  background: var(--accent-orange);
  color: #ffffff;
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.5px;
}
.logo-sub {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}
.nav-list {
  list-style: none;
  padding: 14px 10px;
  flex: 1;
  overflow-y: auto;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  color: var(--text-muted);
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 3px;
  font-weight: 500;
  font-size: 13.5px;
  transition: all 0.15s ease;
}
.nav-item:hover {
  background: var(--bg-panel);
  color: var(--text-main);
}
.nav-item.active {
  background: var(--accent-orange-dim);
  color: var(--accent-orange);
  border: 1px solid rgba(249, 115, 22, 0.3);
  font-weight: 600;
}
.nav-item svg { width: 17px; height: 17px; flex-shrink: 0; }
.sidebar-footer {
  padding: 14px 16px;
  border-top: 1px solid var(--border);
  font-size: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
#main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  max-height: 100vh;
}
header {
  padding: 16px 28px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-sidebar);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.view-title { font-size: 19px; font-weight: 700; }
.header-actions { display: flex; gap: 10px; align-items: center; }
.content-area {
  padding: 24px 28px;
  flex: 1;
}
/* Components */
.panel {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.panel-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-main);
}
.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
.grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.grid-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}
.metric-card {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px 18px;
}
.metric-label { font-size: 12px; color: var(--text-muted); font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
.metric-value { font-size: 26px; font-weight: 700; color: var(--text-main); margin-top: 4px; }
.metric-card.accent .metric-value { color: var(--accent-orange); }
.metric-card.success .metric-value { color: var(--success); }
.metric-card.danger .metric-value { color: var(--danger); }
/* Buttons */
button, .btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: var(--bg-panel-alt);
  color: var(--text-main);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 7px 13px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}
button:hover, .btn:hover {
  background: #1f3054;
  border-color: #3b527d;
}
button.btn-primary {
  background: var(--accent-orange);
  border-color: var(--accent-orange-hover);
  color: #ffffff;
  font-weight: 600;
}
button.btn-primary:hover {
  background: var(--accent-orange-hover);
}
button.btn-danger {
  background: var(--danger-dim);
  border-color: var(--danger);
  color: var(--danger);
}
button.btn-danger:hover {
  background: var(--danger);
  color: #ffffff;
}
button.btn-sm {
  padding: 4px 8px;
  font-size: 12px;
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
/* Forms */
.form-group {
  margin-bottom: 14px;
}
label {
  display: block;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 5px;
}
input, select, textarea {
  width: 100%;
  background: var(--bg-input);
  color: var(--text-main);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13.5px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s ease;
}
input:focus, select, textarea:focus {
  border-color: var(--border-focus);
}
textarea { resize: vertical; min-height: 80px; }
.form-hint {
  font-size: 11.5px;
  color: var(--text-dim);
  margin-top: 4px;
}
/* Tables */
.table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 6px;
}
table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 13px;
}
th {
  background: var(--bg-panel-alt);
  color: var(--text-muted);
  font-weight: 600;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}
td {
  padding: 11px 14px;
  border-bottom: 1px solid var(--border);
  color: var(--text-main);
  vertical-align: middle;
}
tr:last-child td { border-bottom: none; }
tr:hover td { background: rgba(255, 255, 255, 0.02); }
/* Badges and Tags */
.badge {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.badge-success { background: var(--success-dim); color: var(--success); border: 1px solid rgba(16, 185, 129, 0.3); }
.badge-warning { background: var(--warning-dim); color: var(--warning); border: 1px solid rgba(245, 158, 11, 0.3); }
.badge-danger { background: var(--danger-dim); color: var(--danger); border: 1px solid rgba(239, 68, 68, 0.3); }
.badge-neutral { background: rgba(148, 163, 184, 0.15); color: var(--text-muted); border: 1px solid rgba(148, 163, 184, 0.25); }
.topic-tag {
  display: inline-block;
  background: #0f1c34;
  border: 1px solid #283a5e;
  color: #93c5fd;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11.5px;
  margin: 1px 2px;
  font-family: monospace;
}
/* Notifications & Alerts */
.alert {
  padding: 12px 16px;
  border-radius: 6px;
  margin-bottom: 16px;
  font-size: 13.5px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.alert-success { background: var(--success-dim); color: #6ee7b7; border: 1px solid var(--success); }
.alert-danger { background: var(--danger-dim); color: #fca5a5; border: 1px solid var(--danger); }
.alert-info { background: rgba(59, 130, 246, 0.15); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.3); }
/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(4, 7, 14, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}
.modal-card {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  width: 100%;
  max-width: 580px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}
.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.modal-title { font-size: 16px; font-weight: 700; }
.modal-body {
  padding: 20px;
  overflow-y: auto;
}
.modal-footer {
  padding: 14px 20px;
  border-top: 1px solid var(--border);
  background: var(--bg-panel-alt);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
/* Portal & Login View */
.portal-wrapper {
  max-width: 960px;
  width: 100%;
  margin: 30px auto;
  padding: 0 16px;
}
.portal-header {
  text-align: center;
  margin-bottom: 28px;
}
.portal-grid {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 22px;
}
@media (max-width: 820px) {
  .portal-grid {
    grid-template-columns: 1fr;
  }
}
.portal-card {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 26px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
  position: relative;
  overflow: hidden;
  transition: border-color 0.2s ease, transform 0.2s ease;
}
.portal-card:hover {
  border-color: rgba(249, 115, 22, 0.45);
}
.portal-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 12px;
}
.portal-card-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-main);
  display: flex;
  align-items: center;
  gap: 8px;
}
.portal-card-desc {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 6px;
  line-height: 1.45;
}
.topic-pill {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  background: var(--bg-panel-alt);
  border: 1px solid var(--border);
  border-radius: 20px;
  font-size: 12px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}
.topic-pill:hover, .topic-pill.selected {
  background: var(--accent-orange-dim);
  border-color: var(--accent-orange);
  color: #fdba74;
}
.pulse-indicator {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--success);
  box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
  animation: pulseGreen 2s infinite;
}
@keyframes pulseGreen {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
}
.active-subs-box {
  margin-top: 18px;
  padding: 14px;
  background: var(--bg-app);
  border: 1px solid var(--border);
  border-radius: 8px;
}
.active-sub-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 6px;
  margin-top: 6px;
}
.secret-display {
  background: #060b17;
  border: 1px solid var(--accent-orange);
  border-radius: 6px;
  padding: 14px;
  font-family: monospace;
  font-size: 13px;
  color: #fdba74;
  word-break: break-all;
  user-select: all;
  margin: 12px 0;
}
.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 14px;
  font-size: 13px;
  color: var(--text-muted);
}
.hidden { display: none !important; }
@media (max-width: 900px) {
  body { flex-direction: column; }
  #sidebar { width: 100%; border-right: none; border-bottom: 1px solid var(--border); }
  .grid-2 { grid-template-columns: 1fr; }
  .grid-3 { grid-template-columns: 1fr; }
  #main-content { max-height: none; }
}
</style>
</head>
<body>

<!-- Login & Web Push Subscription Portal -->
<div id="login-view" style="width: 100%; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px 16px;">
  <div class="portal-wrapper">
    <div class="portal-header">
      <div style="display:inline-flex; align-items:center; gap:8px; margin-bottom:12px;">
        <span class="logo-badge" style="font-size:12px; padding:4px 10px; border-radius:4px;">UNG GATEWAY</span>
        <span style="font-size:12px; color:var(--text-muted); background:var(--bg-panel); padding:4px 10px; border-radius:4px; border:1px solid var(--border);">v1.0 &bull; Cloudflare D1</span>
      </div>
      <h1 style="font-size: 26px; font-weight: 800; letter-spacing: -0.5px; color: var(--text-main);">Universal Notification Gateway</h1>
      <p style="font-size: 14px; color: var(--text-muted); margin-top: 6px;">Real-Time Multi-Channel Notification Router &amp; Browser Push Service</p>
    </div>

    <div class="portal-grid">
      <!-- Card 1: Web Push Subscription -->
      <div class="portal-card" style="border-top: 3px solid var(--accent-orange);">
        <div class="portal-card-header">
          <div>
            <div class="portal-card-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-orange)" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
              <span>Subscribe to Web Push Alerts</span>
            </div>
            <p class="portal-card-desc">Subscribe this browser or mobile device to real-time notification topics. No account required.</p>
          </div>
          <div id="push-capability-badge">
            <span class="badge badge-neutral" style="display:flex; align-items:center; gap:5px;"><span class="pulse-indicator"></span> Checking...</span>
          </div>
        </div>

        <div id="push-alert" class="alert alert-danger hidden" style="margin-bottom:16px;"></div>

        <form id="push-subscribe-form" onsubmit="return false;">
          <div class="form-group">
            <label for="push-topic-input">Alert Topic</label>
            <input type="text" id="push-topic-input" list="available-topics-list" required placeholder="e.g. system.alerts, devops, database">
            <datalist id="available-topics-list"></datalist>
            <div class="form-hint" style="margin-top:6px;">Select an active topic or click a suggested topic below:</div>
            <div id="push-topic-pills" style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">
              <span style="font-size:12px; color:var(--text-dim);">Loading available topics...</span>
            </div>
          </div>

          <div class="form-group">
            <label for="push-device-label">Device Identifier <span style="font-weight:normal;color:var(--text-muted);">(Optional)</span></label>
            <input type="text" id="push-device-label" placeholder="e.g. Work Laptop (Chrome)">
          </div>

          <div style="display:flex; gap:10px; margin-top:14px;">
            <button type="button" id="push-subscribe-btn" class="btn-primary" style="flex:1; padding:11px; font-weight:600; display:flex; align-items:center; justify-content:center; gap:8px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
              <span id="push-subscribe-btn-text">Subscribe to Topic Alerts</span>
            </button>
          </div>
        </form>

        <div id="active-subs-container" class="active-subs-box hidden">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-muted);">Active Device Subscriptions</span>
            <button type="button" id="push-send-test-btn" class="btn-sm" style="font-size:11px; padding:3px 8px; border-color:var(--accent-orange); color:#fdba74;">Send Test Push</button>
          </div>
          <div id="active-subs-list" style="margin-top:8px;"></div>
        </div>
      </div>

      <!-- Card 2: Administrator Sign In -->
      <div class="portal-card" style="display:flex; flex-direction:column; justify-content:space-between;">
        <div>
          <div class="portal-card-header">
            <div>
              <div class="portal-card-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                <span>Console Sign In</span>
              </div>
              <p class="portal-card-desc">Sign in with administrator credentials to manage routing rules, sources, destinations, and audit logs.</p>
            </div>
          </div>

          <div id="login-alert" class="alert alert-danger hidden" style="margin-bottom:16px;"></div>

          <form id="login-form">
            <div class="form-group">
              <label for="admin-user">Administrator Username</label>
              <input type="text" id="admin-user" required autocomplete="username" placeholder="admin">
            </div>
            <div class="form-group">
              <label for="admin-pass">Password</label>
              <input type="password" id="admin-pass" required autocomplete="current-password" placeholder="••••••••••••">
            </div>
            <button type="submit" id="login-submit-btn" class="btn-primary" style="width:100%; padding:11px; font-weight:600; margin-top:10px;">Sign In to Console</button>
          </form>
        </div>

        <div style="border-top:1px solid var(--border); padding-top:14px; margin-top:20px; font-size:12px; color:var(--text-dim); text-align:center;">
          Protected by Argon2id / PBKDF2 Session Tokens &bull; Cloudflare D1
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Main App View -->
<div id="app-view" class="hidden" style="display: flex; width: 100%; height: 100vh;">
  <!-- Sidebar -->
  <aside id="sidebar">
    <div class="sidebar-header">
      <div class="logo-title">
        <span class="logo-badge">UNG</span>
        <span>Notification Gateway</span>
      </div>
      <div class="logo-sub">Cloudflare Workers &bull; D1</div>
    </div>
    <ul class="nav-list">
      <li class="nav-item active" data-tab="overview">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
        <span>Overview</span>
      </li>
      <li class="nav-item" data-tab="sources">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2"></rect><rect x="2" y="14" width="20" height="8" rx="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>
        <span>Sources</span>
      </li>
      <li class="nav-item" data-tab="topics">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
        <span>Topics</span>
      </li>
      <li class="nav-item" data-tab="destinations">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        <span>Destinations</span>
      </li>
      <li class="nav-item" data-tab="groups">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
        <span>Recipient Groups</span>
      </li>
      <li class="nav-item" data-tab="subscriptions">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
        <span>Subscriptions</span>
      </li>
      <li class="nav-item" data-tab="events">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        <span>Event History</span>
      </li>
      <li class="nav-item" data-tab="logs">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
        <span>Delivery Logs</span>
      </li>
      <li class="nav-item" data-tab="settings">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        <span>System Settings</span>
      </li>
    </ul>
    <div class="sidebar-footer">
      <span id="nav-user-label" style="color:var(--text-muted); font-weight:500;">Admin</span>
      <button id="logout-btn" class="btn-sm btn-danger">Log Out</button>
    </div>
  </aside>

  <!-- Main View Area -->
  <main id="main-content">
    <header>
      <h2 id="view-heading" class="view-title">Overview</h2>
      <div class="header-actions">
        <button id="refresh-current-btn" class="btn-sm">Refresh</button>
      </div>
    </header>

    <div class="content-area">
      <div id="global-alert" class="alert hidden"></div>

      <!-- Tab 1: Overview -->
      <section id="tab-overview">
        <div class="grid-metrics">
          <div class="metric-card">
            <div class="metric-label">Registered Sources</div>
            <div id="stat-sources" class="metric-value">0</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Active Topics</div>
            <div id="stat-topics" class="metric-value">0</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Active Destinations</div>
            <div id="stat-destinations" class="metric-value">0</div>
          </div>
          <div class="metric-card accent">
            <div class="metric-label">Total Events</div>
            <div id="stat-events" class="metric-value">0</div>
          </div>
          <div class="metric-card success">
            <div class="metric-label">Successful Deliveries</div>
            <div id="stat-success" class="metric-value">0</div>
          </div>
          <div class="metric-card danger">
            <div class="metric-label">Failed Deliveries</div>
            <div id="stat-failed" class="metric-value">0</div>
          </div>
        </div>

        <div class="grid-2">
          <div class="panel">
            <div class="panel-header">
              <h3 class="panel-title">Recent Events</h3>
            </div>
            <div class="table-wrap">
              <table>
                <thead><tr><th>ID</th><th>Topic</th><th>Title</th><th>Severity</th><th>Status</th><th>Time</th></tr></thead>
                <tbody id="overview-recent-events"><tr><td colspan="6" style="text-align:center;color:var(--text-muted);">No events recorded yet</td></tr></tbody>
              </table>
            </div>
          </div>
          <div class="panel">
            <div class="panel-header">
              <h3 class="panel-title">Delivery Failure Breakdown</h3>
            </div>
            <div class="table-wrap">
              <table>
                <thead><tr><th>Destination</th><th>Type</th><th>Failures</th><th>Latest Error</th></tr></thead>
                <tbody id="overview-failures"><tr><td colspan="4" style="text-align:center;color:var(--text-muted);">No delivery failures recorded</td></tr></tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <!-- Tab 2: Sources -->
      <section id="tab-sources" class="hidden">
        <div class="grid-2">
          <div class="panel">
            <div class="panel-header">
              <h3 class="panel-title">Register New Source</h3>
            </div>
            <form id="create-source-form">
              <div class="form-group">
                <label for="source-name">Source Name</label>
                <input type="text" id="source-name" required placeholder="e.g. production-backend, linux-server-01">
                <div class="form-hint">Descriptive identifier for the application or server</div>
              </div>
              <div class="form-group">
                <label for="source-topics-select">Allowed Topics (Multi-select)</label>
                <select id="source-topics-select" multiple size="4" required style="height:100px;"></select>
                <div class="form-hint">Hold Ctrl / Cmd to select multiple topics. Sources can only publish to permitted topics.</div>
              </div>
              <div class="form-group">
                <label for="source-rate-limit">Rate Limit (Requests / minute)</label>
                <input type="number" id="source-rate-limit" value="60" min="1" max="1000">
              </div>
              <button type="submit" class="btn-primary">Register Source &bull; Generate API Key</button>
            </form>
          </div>

          <div class="panel">
            <div class="panel-header">
              <h3 class="panel-title">Registered Sources</h3>
            </div>
            <div class="table-wrap">
              <table>
                <thead><tr><th>Name</th><th>Allowed Topics</th><th>Rate Limit</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody id="sources-table-body"></tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <!-- Tab 3: Topics -->
      <section id="tab-topics" class="hidden">
        <div class="grid-2">
          <div class="panel">
            <div class="panel-header">
              <h3 class="panel-title">Create New Topic</h3>
            </div>
            <form id="create-topic-form">
              <div class="form-group">
                <label for="topic-name">Topic Identifier</label>
                <input type="text" id="topic-name" required placeholder="e.g. security.alerts, billing.invoices">
                <div class="form-hint">Normalized lowercase alphanumeric string with '.', '_', '-', or ':'</div>
              </div>
              <div class="form-group">
                <label for="topic-desc">Description</label>
                <input type="text" id="topic-desc" placeholder="Operational alert notifications">
              </div>

              <!-- Web Push Style & Notification Settings -->
              <div style="background:var(--bg-panel-alt); border:1px solid var(--border); border-radius:8px; padding:14px; margin-bottom:16px;">
                <div style="font-size:13px; font-weight:700; color:var(--text-main); margin-bottom:10px; display:flex; align-items:center; gap:6px;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-orange)" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                  <span>Web Push Notification Style & Behaviour</span>
                </div>

                <div class="form-group" style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                  <input type="checkbox" id="topic-webpush-enabled" checked style="width:auto; margin:0;">
                  <label for="topic-webpush-enabled" style="margin:0; cursor:pointer;">Allow Web Push subscriptions from login page</label>
                </div>

                <div class="form-group">
                  <label for="topic-click-url">When Clicked, Open URL / Page <span style="color:var(--accent-orange);">*</span></label>
                  <input type="text" id="topic-click-url" placeholder="/admin#events or https://..." value="/admin#events">
                  <div class="form-hint">URL or path opened in browser when notification is clicked</div>
                </div>

                <div class="grid-2" style="gap:10px;">
                  <div class="form-group">
                    <label for="topic-icon">Notification Icon URL</label>
                    <input type="url" id="topic-icon" placeholder="https://example.com/icon.png">
                  </div>
                  <div class="form-group">
                    <label for="topic-badge">Status Bar Badge URL</label>
                    <input type="url" id="topic-badge" placeholder="https://example.com/badge.png">
                  </div>
                </div>

                <div class="form-group" style="display:flex; align-items:center; gap:8px; margin-top:6px; margin-bottom:0;">
                  <input type="checkbox" id="topic-require-interaction" style="width:auto; margin:0;">
                  <label for="topic-require-interaction" style="margin:0; cursor:pointer;">Require Interaction (keep on screen until dismissed)</label>
                </div>
              </div>

              <button type="submit" class="btn-primary">Create Topic</button>
            </form>
          </div>

          <div class="panel">
            <div class="panel-header">
              <h3 class="panel-title">Configured Topics</h3>
            </div>
            <div class="table-wrap">
              <table>
                <thead><tr><th>Topic</th><th>Description</th><th>Sources</th><th>Subscribers</th><th>Web Push Style</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody id="topics-table-body"></tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <!-- Tab 4: Destinations -->
      <section id="tab-destinations" class="hidden">
        <div class="grid-2">
          <div class="panel">
            <div class="panel-header">
              <h3 class="panel-title">Add Notification Destination</h3>
            </div>
            <form id="create-dest-form">
              <div class="form-group">
                <label for="dest-name">Destination Name</label>
                <input type="text" id="dest-name" required placeholder="e.g. ops-email, dev-telegram, browser-push">
              </div>
              <div class="form-group">
                <label for="dest-type">Provider Type</label>
                <select id="dest-type">
                  <option value="email">Email (HTTP Sender API)</option>
                  <option value="telegram">Telegram Bot</option>
                  <option value="webpush">Web Push (Browser Push Service)</option>
                </select>
              </div>

              <!-- Email Fields -->
              <div id="dest-email-fields">
                <div class="form-group">
                  <label for="dest-email-to">Recipient Email Address</label>
                  <input type="email" id="dest-email-to" placeholder="team@example.com">
                </div>
                <div class="form-group">
                  <label for="dest-email-sender">Sender Identifier</label>
                  <input type="text" id="dest-email-sender" placeholder="snd_mvcmbbyw">
                </div>
                <div class="form-group">
                  <label for="dest-email-key">Destination Email API Key (Encrypted in D1)</label>
                  <input type="password" id="dest-email-key" placeholder="Leave blank to use Worker EMAIL_API_KEY">
                </div>
              </div>

              <!-- Telegram Fields -->
              <div id="dest-telegram-fields" class="hidden">
                <div class="form-group">
                  <label for="dest-telegram-chat">Chat ID</label>
                  <input type="text" id="dest-telegram-chat" placeholder="-1001234567890">
                </div>
                <div class="form-group">
                  <label for="dest-telegram-token">Bot Token (Encrypted with AES-256-GCM)</label>
                  <input type="password" id="dest-telegram-token" placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz">
                </div>
              </div>

              <!-- Web Push Fields -->
              <div id="dest-webpush-fields" class="hidden">
                <div class="form-group">
                  <label for="dest-webpush-endpoint">Push Subscription Endpoint URL</label>
                  <input type="url" id="dest-webpush-endpoint" placeholder="https://fcm.googleapis.com/fcm/send/...">
                  <div class="form-hint">Push service endpoint URL from browser pushManager.subscribe()</div>
                </div>
                <div class="form-group">
                  <label for="dest-webpush-p256dh">Client Public Key (p256dh)</label>
                  <input type="text" id="dest-webpush-p256dh" placeholder="Base64url encoded client ECDH public key">
                </div>
                <div class="form-group">
                  <label for="dest-webpush-auth">Client Auth Secret (auth)</label>
                  <input type="password" id="dest-webpush-auth" placeholder="Base64url encoded client authentication secret">
                </div>
                <div class="form-group">
                  <label for="dest-webpush-click-url">Custom Click URL Override <span style="font-weight:normal;color:var(--text-muted);">(Optional)</span></label>
                  <input type="text" id="dest-webpush-click-url" placeholder="/admin#events or https://...">
                </div>
                <div class="form-group">
                  <label for="dest-webpush-icon">Custom Notification Icon URL <span style="font-weight:normal;color:var(--text-muted);">(Optional)</span></label>
                  <input type="url" id="dest-webpush-icon" placeholder="https://example.com/icon.png">
                </div>
              </div>

              <button type="submit" class="btn-primary">Save Destination</button>
            </form>
          </div>

          <div class="panel">
            <div class="panel-header">
              <h3 class="panel-title">Configured Destinations</h3>
            </div>
            <div class="table-wrap">
              <table>
                <thead><tr><th>Name</th><th>Channel</th><th>Config Summary</th><th>Secret</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody id="destinations-table-body"></tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <!-- Tab 5: Recipient Groups -->
      <section id="tab-groups" class="hidden">
        <div class="grid-2">
          <div class="panel">
            <div class="panel-header">
              <h3 class="panel-title">Create Recipient Group</h3>
            </div>
            <form id="create-group-form">
              <div class="form-group">
                <label for="group-name">Group Name</label>
                <input type="text" id="group-name" required placeholder="e.g. devops-oncall, security-team">
              </div>
              <div class="form-group">
                <label for="group-desc">Description</label>
                <input type="text" id="group-desc" placeholder="On-call escalation roster">
              </div>
              <button type="submit" class="btn-primary">Create Group</button>
            </form>

            <hr style="border:none; border-top:1px solid var(--border); margin:24px 0;">

            <div class="panel-header">
              <h3 class="panel-title">Add Destination to Group</h3>
            </div>
            <form id="add-member-form">
              <div class="form-group">
                <label for="member-group-select">Select Group</label>
                <select id="member-group-select" required></select>
              </div>
              <div class="form-group">
                <label for="member-dest-select">Select Destination</label>
                <select id="member-dest-select" required></select>
              </div>
              <button type="submit" class="btn-primary">Add Member Destination</button>
            </form>
          </div>

          <div class="panel">
            <div class="panel-header">
              <h3 class="panel-title">Recipient Groups &bull; Membership</h3>
            </div>
            <div id="groups-container"></div>
          </div>
        </div>
      </section>

      <!-- Tab 6: Subscriptions -->
      <section id="tab-subscriptions" class="hidden">
        <div class="grid-2">
          <div class="panel">
            <div class="panel-header">
              <h3 class="panel-title">Create Subscription</h3>
            </div>
            <form id="create-subscription-form">
              <div class="form-group">
                <label for="sub-topic-select">Topic</label>
                <select id="sub-topic-select" required></select>
              </div>
              <div class="form-group">
                <label for="sub-source-select">Source Filter (Optional)</label>
                <select id="sub-source-select">
                  <option value="">All Authorized Sources</option>
                </select>
              </div>
              <div class="form-group">
                <label for="sub-severity-select">Severity Filter (Optional)</label>
                <select id="sub-severity-select">
                  <option value="">All Severities</option>
                  <option value="info">info only</option>
                  <option value="warning">warning only</option>
                  <option value="error">error only</option>
                  <option value="critical">critical only</option>
                </select>
              </div>
              <div class="form-group">
                <label for="sub-target-type">Recipient Type</label>
                <select id="sub-target-type">
                  <option value="destination">Individual Destination</option>
                  <option value="group">Recipient Group</option>
                </select>
              </div>
              <div class="form-group">
                <label id="sub-target-label" for="sub-target-id">Target Destination</label>
                <select id="sub-target-id" required></select>
              </div>
              <button type="submit" class="btn-primary">Create Subscription</button>
            </form>
          </div>

          <div class="panel">
            <div class="panel-header">
              <h3 class="panel-title">Active Subscriptions</h3>
            </div>
            <div class="table-wrap">
              <table>
                <thead><tr><th>Topic</th><th>Filter (Source/Severity)</th><th>Delivered To</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody id="subscriptions-table-body"></tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <!-- Tab 7: Event History -->
      <section id="tab-events" class="hidden">
        <div class="panel">
          <div class="panel-header">
            <h3 class="panel-title">Notification Event History</h3>
            <div style="display:flex; gap:10px;">
              <input type="text" id="event-search-input" placeholder="Search title, message, key..." style="width:240px;">
              <select id="event-status-filter" style="width:140px;">
                <option value="">All Statuses</option>
                <option value="processed">Processed</option>
                <option value="partial_failure">Partial Failure</option>
                <option value="failed">Failed</option>
                <option value="no_subscribers">No Subscribers</option>
              </select>
              <button id="event-filter-btn" class="btn-sm">Filter</button>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Source</th><th>Topic</th><th>Title</th><th>Severity</th><th>Deliveries</th><th>Status</th><th>Time</th><th>Action</th></tr></thead>
              <tbody id="events-table-body"></tbody>
            </table>
          </div>
          <div class="pagination">
            <span id="events-count-label">Showing 0 events</span>
            <div style="display:flex; gap:6px;">
              <button id="events-prev-btn" class="btn-sm" disabled>Previous</button>
              <button id="events-next-btn" class="btn-sm" disabled>Next</button>
            </div>
          </div>
        </div>
      </section>

      <!-- Tab 8: Delivery Logs -->
      <section id="tab-logs" class="hidden">
        <div class="panel">
          <div class="panel-header">
            <h3 class="panel-title">Provider Delivery Audit Logs</h3>
            <div style="display:flex; gap:10px;">
              <select id="log-status-filter" style="width:130px;">
                <option value="">All Results</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
              </select>
              <input type="text" id="log-search-input" placeholder="Search destination or excerpt..." style="width:220px;">
              <button id="log-filter-btn" class="btn-sm">Filter</button>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Delivery ID</th><th>Event ID</th><th>Topic</th><th>Destination</th><th>Provider</th><th>Status</th><th>HTTP</th><th>Excerpt / Sanitized Error</th><th>Time</th></tr></thead>
              <tbody id="logs-table-body"></tbody>
            </table>
          </div>
          <div class="pagination">
            <span id="logs-count-label">Showing 0 logs</span>
            <div style="display:flex; gap:6px;">
              <button id="logs-prev-btn" class="btn-sm" disabled>Previous</button>
              <button id="logs-next-btn" class="btn-sm" disabled>Next</button>
            </div>
          </div>
        </div>
      </section>

      <!-- Tab 9: System Settings -->
      <section id="tab-settings" class="hidden">
        <div class="grid-2">
          <div class="panel">
            <div class="panel-header">
              <h3 class="panel-title">Runtime & Security Diagnostics</h3>
            </div>
            <div id="settings-diagnostics-body">Loading diagnostic state...</div>
            <div style="margin-top:20px;">
              <button id="cleanup-sessions-btn" class="btn-primary">Purge Expired Sessions</button>
            </div>
          </div>
          <div class="panel">
            <div class="panel-header">
              <h3 class="panel-title">Operational Guidelines</h3>
            </div>
            <p style="color:var(--text-muted); font-size:13px; line-height:1.6;">
              <strong>Synchronous Delivery:</strong> Deliveries run within the Cloudflare Worker execution budget (10s per provider).<br><br>
              <strong>Secret Encryption:</strong> Bot tokens and API credentials stored in D1 are secured with AES-256-GCM derived from <code>DESTINATION_ENCRYPTION_KEY</code>.<br><br>
              <strong>SSRF Guardrails:</strong> Web Push and external webhook destinations block private IP ranges (127.0.0.1, RFC1918, link-local metadata).<br><br>
              <strong>Web Push VAPID:</strong> RFC 8292 application server keys securely sign all browser push dispatches via Web Crypto.
            </p>
          </div>
        </div>
      </section>
    </div>
  </main>
</div>

<!-- Modal: Event Details -->
<div id="event-modal" class="modal-overlay hidden">
  <div class="modal-card">
    <div class="modal-header">
      <h3 id="event-modal-title" class="modal-title">Event Details</h3>
      <button id="event-modal-close" class="btn-sm">&times;</button>
    </div>
    <div id="event-modal-body" class="modal-body"></div>
    <div class="modal-footer">
      <button id="event-retry-btn" class="btn-primary hidden">Retry Failed Deliveries</button>
      <button id="event-modal-done" class="btn">Close</button>
    </div>
  </div>
</div>

<!-- Modal: Token Display -->
<div id="token-modal" class="modal-overlay hidden">
  <div class="modal-card" style="max-width:500px;">
    <div class="modal-header">
      <h3 class="modal-title" style="color:var(--accent-orange);">Source API Key Generated</h3>
    </div>
    <div class="modal-body">
      <p style="font-size:13.5px; color:var(--text-main);">
        Copy and save this source credential now. For security, it is stored only as a cryptographic hash in D1 and <strong>cannot be retrieved again</strong>:
      </p>
      <div id="generated-token-text" class="secret-display"></div>
      <button id="copy-token-btn" class="btn-primary" style="width:100%; margin-top:6px;">Copy Key to Clipboard</button>
    </div>
    <div class="modal-footer">
      <button id="token-modal-close" class="btn">I Have Safely Stored This Key</button>
    </div>
  </div>
</div>

<!-- Modal: Topic & Web Push Style Configuration -->
<div id="topic-style-modal" class="modal-overlay hidden">
  <div class="modal-card" style="max-width:620px;">
    <div class="modal-header">
      <div>
        <h3 id="topic-style-modal-title" class="modal-title">Configure Notification Style &amp; Web Push</h3>
        <p style="font-size:12px; color:var(--text-muted); margin-top:3px;">Topic: <span id="topic-style-modal-name" class="topic-tag"></span></p>
      </div>
      <button id="topic-style-modal-close" class="btn-sm">&times;</button>
    </div>
    <form id="topic-style-form">
      <input type="hidden" id="edit-topic-id">
      <div class="modal-body" style="max-height:65vh; overflow-y:auto; padding:18px 24px;">
        <div class="form-group">
          <label for="edit-topic-desc">Topic Description</label>
          <input type="text" id="edit-topic-desc" placeholder="Operational alert notifications">
        </div>

        <div style="background:var(--bg-panel-alt); border:1px solid var(--border); border-radius:8px; padding:16px; margin-top:14px;">
          <div style="font-size:14px; font-weight:700; color:var(--text-main); margin-bottom:12px; display:flex; align-items:center; gap:8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-orange)" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
            <span>Web Push Notification Style &amp; Behaviour</span>
          </div>

          <div class="form-group" style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
            <input type="checkbox" id="edit-topic-webpush-enabled" style="width:auto; margin:0;">
            <label for="edit-topic-webpush-enabled" style="margin:0; cursor:pointer;">Allow visitors to subscribe to this topic from the login page</label>
          </div>

          <div class="form-group">
            <label for="edit-topic-click-url">When Clicked, Open URL / Page <span style="color:var(--accent-orange); font-weight:bold;">*</span></label>
            <input type="text" id="edit-topic-click-url" placeholder="/admin#events, /, or https://company.com/alerts" value="/admin#events">
            <div class="form-hint">URL or path opened in browser when notification is clicked</div>
          </div>

          <div class="grid-2" style="gap:12px;">
            <div class="form-group">
              <label for="edit-topic-icon">Notification Icon URL</label>
              <input type="url" id="edit-topic-icon" placeholder="https://example.com/icon.png">
              <div class="form-hint">Image shown on alert card</div>
            </div>
            <div class="form-group">
              <label for="edit-topic-badge">Status Bar Badge URL</label>
              <input type="url" id="edit-topic-badge" placeholder="https://example.com/badge.png">
              <div class="form-hint">Monochrome mobile icon</div>
            </div>
          </div>

          <div class="form-group">
            <label for="edit-topic-image">Banner Image URL (Rich Push)</label>
            <input type="url" id="edit-topic-image" placeholder="https://example.com/banner.png">
          </div>

          <div class="form-group" style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
            <input type="checkbox" id="edit-topic-require-interaction" style="width:auto; margin:0;">
            <label for="edit-topic-require-interaction" style="margin:0; cursor:pointer;">Require Interaction (keep alert open on screen until user dismisses or clicks it)</label>
          </div>

          <div class="grid-2" style="gap:12px;">
            <div class="form-group">
              <label for="edit-topic-vibrate">Vibration Pattern</label>
              <input type="text" id="edit-topic-vibrate" placeholder="200, 100, 200">
            </div>
            <div class="form-group">
              <label for="edit-topic-tag">Notification Tag</label>
              <input type="text" id="edit-topic-tag" placeholder="ung-alerts">
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" id="topic-style-modal-cancel" class="btn">Cancel</button>
        <button type="submit" class="btn-primary">Save Notification Style</button>
      </div>
    </form>
  </div>
</div>

<!-- Client-side SPA Application Logic -->
<script>
(function() {
  const SESSION_KEY = "gateway_admin_token";
  let activeTab = "overview";
  let currentEventsOffset = 0;
  let currentLogsOffset = 0;
  const PAGE_SIZE = 50;
  let cachedTopics = [];
  let cachedDestinations = [];
  let cachedGroups = [];
  let cachedSources = [];

  // DOM Elements
  const loginView = document.getElementById("login-view");
  const appView = document.getElementById("app-view");
  const loginForm = document.getElementById("login-form");
  const loginAlert = document.getElementById("login-alert");
  const globalAlert = document.getElementById("global-alert");
  const logoutBtn = document.getElementById("logout-btn");
  const refreshBtn = document.getElementById("refresh-current-btn");

  function getToken() {
    return sessionStorage.getItem(SESSION_KEY);
  }

  function setToken(token) {
    if (token) sessionStorage.setItem(SESSION_KEY, token);
    else sessionStorage.removeItem(SESSION_KEY);
  }

  function showAlert(msg, type = "danger", container = globalAlert) {
    container.textContent = msg;
    container.className = "alert alert-" + type;
    container.classList.remove("hidden");
    if (container === globalAlert) {
      setTimeout(() => container.classList.add("hidden"), 6000);
    }
  }

  async function api(path, options = {}) {
    const token = getToken();
    const headers = options.headers || {};
    if (token) headers["Authorization"] = "Bearer " + token;
    if (options.body && typeof options.body === "object" && !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(options.body);
    }
    options.headers = headers;

    try {
      const res = await fetch(path, options);
      if (res.status === 401 && !path.includes("/v1/auth/login")) {
        setToken(null);
        showAuthView();
        throw new Error("Session expired. Please log in again.");
      }
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Request failed with status " + res.status);
      }
      return data;
    } catch (err) {
      throw err;
    }
  }

  function showAuthView() {
    loginView.classList.remove("hidden");
    appView.classList.add("hidden");
    initWebPushLoginCard();
  }

  function showAppView() {
    loginView.classList.add("hidden");
    appView.classList.remove("hidden");
    switchTab("overview");
  }

  // Navigation
  document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", () => {
      const tab = item.getAttribute("data-tab");
      switchTab(tab);
    });
  });

  function switchTab(tab) {
    activeTab = tab;
    document.querySelectorAll(".nav-item").forEach(el => {
      el.classList.toggle("active", el.getAttribute("data-tab") === tab);
    });
    document.querySelectorAll(".content-area > section").forEach(el => {
      el.classList.add("hidden");
    });
    const targetSection = document.getElementById("tab-" + tab);
    if (targetSection) targetSection.classList.remove("hidden");

    const heading = document.getElementById("view-heading");
    const tabNames = {
      overview: "System Overview",
      sources: "Authorized Sources",
      topics: "Notification Topics",
      destinations: "Notification Destinations",
      groups: "Recipient Groups",
      subscriptions: "Topic Subscriptions",
      events: "Notification Event History",
      logs: "Provider Delivery Logs",
      settings: "System Settings & Diagnostics"
    };
    if (heading) heading.textContent = tabNames[tab] || "Dashboard";

    loadCurrentTabData();
  }

  function loadCurrentTabData() {
    if (activeTab === "overview") loadOverview();
    else if (activeTab === "sources") loadSources();
    else if (activeTab === "topics") loadTopics();
    else if (activeTab === "destinations") loadDestinations();
    else if (activeTab === "groups") loadGroups();
    else if (activeTab === "subscriptions") loadSubscriptions();
    else if (activeTab === "events") loadEvents();
    else if (activeTab === "logs") loadLogs();
    else if (activeTab === "settings") loadSettings();
  }

  refreshBtn.addEventListener("click", loadCurrentTabData);

  // Authentication Handlers
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginAlert.classList.add("hidden");
    const username = document.getElementById("admin-user").value.trim();
    const password = document.getElementById("admin-pass").value;

    try {
      const res = await api("/v1/auth/login", {
        method: "POST",
        body: { username, password }
      });
      if (res.token) {
        setToken(res.token);
        document.getElementById("nav-user-label").textContent = res.username || "Admin";
        showAppView();
      }
    } catch (err) {
      showAlert(err.message, "danger", loginAlert);
    }
  });

  logoutBtn.addEventListener("click", async () => {
    try { await api("/v1/auth/logout", { method: "POST" }); } catch (_) {}
    setToken(null);
    showAuthView();
  });

  // --- Web Push Login Page Client Logic ---
  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  function getStoredPushTopics() {
    try {
      return JSON.parse(localStorage.getItem("ung_push_topics") || "[]");
    } catch {
      return [];
    }
  }

  function setStoredPushTopics(topics) {
    localStorage.setItem("ung_push_topics", JSON.stringify(topics));
  }

  function renderActiveSubscriptions() {
    const container = document.getElementById("active-subs-container");
    const list = document.getElementById("active-subs-list");
    const topics = getStoredPushTopics();
    if (!container || !list) return;

    if (topics.length === 0) {
      container.classList.add("hidden");
      list.innerHTML = "";
      return;
    }

    container.classList.remove("hidden");
    list.innerHTML = topics.map(t => \`
      <div class="active-sub-item">
        <div style="display:flex; align-items:center; gap:6px;">
          <span class="topic-tag">\${escapeText(t)}</span>
          <span style="font-size:11px; color:var(--text-muted);">&bull; Subscribed</span>
        </div>
        <div style="display:flex; gap:6px;">
          <button type="button" class="btn-sm" style="font-size:11px; padding:2px 8px; border-color:var(--accent-orange); color:#fdba74;" onclick="window.sendTestPushForTopic('\${escapeText(t)}')">Test Alert</button>
          <button type="button" class="btn-sm btn-danger" style="font-size:11px; padding:2px 8px;" onclick="window.unsubscribePushTopic('\${escapeText(t)}')">Unsubscribe</button>
        </div>
      </div>
    \`).join("");
  }

  async function initWebPushLoginCard() {
    const capBadge = document.getElementById("push-capability-badge");
    const pillsContainer = document.getElementById("push-topic-pills");
    const dataList = document.getElementById("available-topics-list");
    const deviceInput = document.getElementById("push-device-label");

    if (deviceInput && !deviceInput.value) {
      const ua = navigator.userAgent;
      let browser = "Browser";
      if (ua.includes("Chrome")) browser = "Chrome";
      else if (ua.includes("Firefox")) browser = "Firefox";
      else if (ua.includes("Safari")) browser = "Safari";
      else if (ua.includes("Edge")) browser = "Edge";
      const os = ua.includes("Mac") ? "macOS" : (ua.includes("Win") ? "Windows" : (ua.includes("Android") ? "Android" : (ua.includes("iPhone") || ua.includes("iPad") ? "iOS" : "Linux")));
      deviceInput.value = \`\${browser} on \${os}\`;
    }

    renderActiveSubscriptions();

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      if (capBadge) {
        capBadge.innerHTML = '<span class="badge badge-danger">Push Unsupported</span>';
      }
      return;
    }

    if (capBadge) {
      const perm = Notification.permission;
      const badgeClass = perm === "granted" ? "badge-success" : (perm === "denied" ? "badge-danger" : "badge-neutral");
      capBadge.innerHTML = \`<span class="badge \${badgeClass}"><span class="pulse-indicator"></span> Push: \${perm === "granted" ? "Enabled" : (perm === "denied" ? "Denied" : "Ready")}</span>\`;
    }

    // Load available topics from gateway
    try {
      const res = await fetch("/v1/webpush/topics");
      const data = await res.json();
      if (data.ok && Array.isArray(data.topics)) {
        if (dataList) {
          dataList.innerHTML = data.topics.map(t => \`<option value="\${escapeText(t.name)}">\${escapeText(t.description || t.name)}</option>\`).join("");
        }
        if (pillsContainer) {
          if (data.topics.length === 0) {
            pillsContainer.innerHTML = '<span style="font-size:12px; color:var(--text-dim);">No public topics configured yet</span>';
          } else {
            pillsContainer.innerHTML = data.topics.map(t => \`
              <span class="topic-pill" data-topic="\${escapeText(t.name)}" title="\${escapeText(t.description || '')}">+ \${escapeText(t.name)}</span>
            \`).join("");
            pillsContainer.querySelectorAll(".topic-pill").forEach(p => {
              p.addEventListener("click", () => {
                const topicInput = document.getElementById("push-topic-input");
                if (topicInput) {
                  topicInput.value = p.getAttribute("data-topic");
                  topicInput.focus();
                }
              });
            });
          }
        }
      }
    } catch {
      if (pillsContainer) pillsContainer.innerHTML = '';
    }
  }

  const pushSubBtn = document.getElementById("push-subscribe-btn");
  const pushAlert = document.getElementById("push-alert");

  if (pushSubBtn) {
    pushSubBtn.addEventListener("click", async () => {
      pushAlert.classList.add("hidden");
      const topicInput = document.getElementById("push-topic-input");
      const topic = topicInput ? topicInput.value.trim() : "";
      if (!topic) {
        showAlert("Please enter or select a topic to subscribe", "danger", pushAlert);
        return;
      }

      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        showAlert("Web Push is not supported in this browser environment.", "danger", pushAlert);
        return;
      }

      const btnTextEl = document.getElementById("push-subscribe-btn-text");
      const originalBtnText = btnTextEl ? btnTextEl.textContent : "Subscribe";
      if (btnTextEl) btnTextEl.textContent = "Subscribing...";
      pushSubBtn.disabled = true;

      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          throw new Error("Notification permission was denied. Please allow notifications in your browser settings to receive alerts.");
        }

        const vapidRes = await fetch("/v1/webpush/vapid-public-key");
        const vapidData = await vapidRes.json();
        if (!vapidData.ok || !vapidData.publicKey) {
          throw new Error("Failed to retrieve gateway VAPID public key");
        }

        const registration = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        const applicationServerKey = urlBase64ToUint8Array(vapidData.publicKey);
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey
        });

        const subJson = subscription.toJSON();
        const deviceName = document.getElementById("push-device-label")?.value.trim() || "";

        const subscribeRes = await fetch("/v1/webpush/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic,
            subscription: subJson,
            device_name: deviceName
          })
        });

        const subResult = await subscribeRes.json();
        if (!subscribeRes.ok || !subResult.ok) {
          throw new Error(subResult.error || "Failed to register subscription with gateway");
        }

        const stored = getStoredPushTopics();
        if (!stored.includes(topic)) {
          stored.push(topic);
          setStoredPushTopics(stored);
        }

        showAlert(\`Successfully subscribed to '\${topic}'! Browser alerts are active for this device.\`, "success", pushAlert);
        renderActiveSubscriptions();
        initWebPushLoginCard();
      } catch (err) {
        showAlert(err.message, "danger", pushAlert);
      } finally {
        if (btnTextEl) btnTextEl.textContent = originalBtnText;
        pushSubBtn.disabled = false;
      }
    });
  }

  window.sendTestPushForTopic = async function(topic) {
    showAlert("Dispatching test notification to this device...", "info", pushAlert);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        throw new Error("No active browser push subscription found. Please click Subscribe first.");
      }
      const res = await fetch("/v1/webpush/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          topic,
          title: "Gateway Alert Test",
          message: \`Live push notification test for topic '\${topic}'. Clicking this alert will open the configured page.\`
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to dispatch test notification");
      showAlert("Test notification dispatched! Check your desktop/mobile notifications.", "success", pushAlert);
    } catch (err) {
      showAlert("Test failed: " + err.message, "danger", pushAlert);
    }
  };

  const testBtn = document.getElementById("push-send-test-btn");
  if (testBtn) {
    testBtn.addEventListener("click", () => {
      const topics = getStoredPushTopics();
      const topic = topics[0] || document.getElementById("push-topic-input")?.value.trim() || "system.alerts";
      window.sendTestPushForTopic(topic);
    });
  }

  window.unsubscribePushTopic = async function(topic) {
    if (!confirm(\`Unsubscribe from push alerts for '\${topic}'?\`)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/v1/webpush/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic,
            endpoint: sub.endpoint
          })
        });
      }
      const stored = getStoredPushTopics().filter(t => t !== topic);
      setStoredPushTopics(stored);
      renderActiveSubscriptions();
      showAlert(\`Unsubscribed from '\${topic}'.\`, "success", pushAlert);
    } catch (err) {
      showAlert("Error unsubscribing: " + err.message, "danger", pushAlert);
    }
  };

  // Overview Tab
  async function loadOverview() {
    try {
      const res = await api("/v1/admin/overview");
      const m = res.data.metrics || {};
      document.getElementById("stat-sources").textContent = m.totalSources || 0;
      document.getElementById("stat-topics").textContent = m.activeTopics || 0;
      document.getElementById("stat-destinations").textContent = m.activeDestinations || 0;
      document.getElementById("stat-events").textContent = m.totalEvents || 0;
      document.getElementById("stat-success").textContent = m.successfulDeliveries || 0;
      document.getElementById("stat-failed").textContent = m.failedDeliveries || 0;

      const recentEvents = res.data.recentEvents || [];
      const tbody = document.getElementById("overview-recent-events");
      if (recentEvents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);">No events recorded yet</td></tr>';
      } else {
        tbody.innerHTML = recentEvents.map(ev => \`
          <tr>
            <td>#\${ev.id}</td>
            <td><span class="topic-tag">\${escapeText(ev.topic)}</span></td>
            <td>\${escapeText(ev.title || '-')}</td>
            <td><span class="badge badge-neutral">\${escapeText(ev.severity)}</span></td>
            <td><span class="badge \${statusBadge(ev.status)}">\${escapeText(ev.status)}</span></td>
            <td>\${formatTime(ev.created_at)}</td>
          </tr>
        \`).join("");
      }

      const failures = res.data.failureSummaries || [];
      const failTbody = document.getElementById("overview-failures");
      if (failures.length === 0) {
        failTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">No delivery failures recorded</td></tr>';
      } else {
        failTbody.innerHTML = failures.map(f => \`
          <tr>
            <td><strong>\${escapeText(f.destination_name)}</strong></td>
            <td><span class="badge badge-neutral">\${escapeText(f.provider_type)}</span></td>
            <td><span class="badge badge-danger">\${f.failure_count}</span></td>
            <td style="font-family:monospace; font-size:12px; color:var(--text-muted);">\${escapeText(f.error_message || 'Unknown error')}</td>
          </tr>
        \`).join("");
      }
    } catch (err) {
      showAlert("Failed to load overview: " + err.message);
    }
  }

  // Sources Tab
  async function loadSources() {
    try {
      const [sourcesRes, topicsRes] = await Promise.all([
        api("/v1/admin/sources"),
        api("/v1/admin/topics")
      ]);
      cachedSources = sourcesRes.items || [];
      cachedTopics = topicsRes.items || [];

      // Populate topics select
      const select = document.getElementById("source-topics-select");
      select.innerHTML = cachedTopics.map(t => \`<option value="\${escapeText(t.name)}">\${escapeText(t.name)}</option>\`).join("");

      const tbody = document.getElementById("sources-table-body");
      if (cachedSources.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">No sources registered</td></tr>';
      } else {
        tbody.innerHTML = cachedSources.map(s => \`
          <tr>
            <td><strong>\${escapeText(s.name)}</strong></td>
            <td>\${(s.allowed_topics || []).map(t => \`<span class="topic-tag">\${escapeText(t)}</span>\`).join(" ")}</td>
            <td>\${s.rate_limit_per_minute}/min</td>
            <td><span class="badge \${s.enabled ? 'badge-success' : 'badge-danger'}">\${s.enabled ? 'Active' : 'Disabled'}</span></td>
            <td>
              <button class="btn-sm" onclick="window.rotateSourceKey(\${s.id})">Rotate Key</button>
              <button class="btn-sm" onclick="window.toggleSource(\${s.id}, \${s.enabled ? 0 : 1})">\${s.enabled ? 'Disable' : 'Enable'}</button>
              <button class="btn-sm btn-danger" onclick="window.deleteSource(\${s.id})">Delete</button>
            </td>
          </tr>
        \`).join("");
      }
    } catch (err) {
      showAlert("Failed to load sources: " + err.message);
    }
  }

  document.getElementById("create-source-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("source-name").value.trim();
    const rate_limit_per_minute = parseInt(document.getElementById("source-rate-limit").value, 10);
    const select = document.getElementById("source-topics-select");
    const allowed_topics = Array.from(select.selectedOptions).map(o => o.value);

    try {
      const res = await api("/v1/admin/sources", {
        method: "POST",
        body: { name, rate_limit_per_minute, allowed_topics }
      });
      document.getElementById("create-source-form").reset();
      showTokenModal(res.item.token);
      loadSources();
    } catch (err) {
      showAlert("Error creating source: " + err.message);
    }
  });

  window.rotateSourceKey = async function(id) {
    if (!confirm("Are you sure you want to rotate this source API key? The old key will immediately stop working.")) return;
    try {
      const res = await api("/v1/admin/sources/" + id + "/rotate-key", { method: "POST" });
      showTokenModal(res.item.token);
    } catch (err) {
      showAlert("Error rotating key: " + err.message);
    }
  };

  window.toggleSource = async function(id, enabled) {
    try {
      await api("/v1/admin/sources/" + id, { method: "PATCH", body: { enabled } });
      loadSources();
    } catch (err) {
      showAlert("Error updating source: " + err.message);
    }
  };

  window.deleteSource = async function(id) {
    if (!confirm("Delete this source? This action cannot be undone.")) return;
    try {
      await api("/v1/admin/sources/" + id, { method: "DELETE" });
      loadSources();
    } catch (err) {
      showAlert("Error deleting source: " + err.message);
    }
  };

  // Topics Tab
  async function loadTopics() {
    try {
      const res = await api("/v1/admin/topics");
      cachedTopics = res.items || [];
      const tbody = document.getElementById("topics-table-body");
      if (cachedTopics.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);">No topics configured</td></tr>';
      } else {
        tbody.innerHTML = cachedTopics.map(t => {
          const cfg = t.webpush_config || {};
          const isEnabled = cfg.webpush_enabled !== false;
          const clickUrl = cfg.click_url || "/admin#events";
          const styleBadge = isEnabled
            ? \`<span class="badge badge-success" title="Opens: \${escapeText(clickUrl)}">Web Push &bull; \${escapeText(clickUrl)}</span>\`
            : '<span class="badge badge-neutral">Disabled</span>';

          return \`
            <tr>
              <td><span class="topic-tag">\${escapeText(t.name)}</span></td>
              <td>\${escapeText(t.description || '-')}</td>
              <td><span class="badge badge-neutral">\${t.sources_count} sources</span></td>
              <td><span class="badge badge-neutral">\${t.subscriptions_count} subscribers</span></td>
              <td style="font-size:12px;">\${styleBadge}</td>
              <td><span class="badge \${t.enabled ? 'badge-success' : 'badge-danger'}">\${t.enabled ? 'Active' : 'Disabled'}</span></td>
              <td>
                <button class="btn-sm" onclick="window.editTopicStyle(\${t.id})">Edit Style</button>
                <button class="btn-sm" onclick="window.toggleTopic(\${t.id}, \${t.enabled ? 0 : 1})">\${t.enabled ? 'Disable' : 'Enable'}</button>
                <button class="btn-sm btn-danger" onclick="window.deleteTopic(\${t.id})">Delete</button>
              </td>
            </tr>
          \`;
        }).join("");
      }
    } catch (err) {
      showAlert("Failed to load topics: " + err.message);
    }
  }

  document.getElementById("create-topic-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("topic-name").value.trim();
    const description = document.getElementById("topic-desc").value.trim();
    const webpush_config = {
      webpush_enabled: document.getElementById("topic-webpush-enabled").checked,
      click_url: document.getElementById("topic-click-url").value.trim() || "/admin#events",
      icon: document.getElementById("topic-icon").value.trim() || undefined,
      badge: document.getElementById("topic-badge").value.trim() || undefined,
      require_interaction: document.getElementById("topic-require-interaction").checked
    };

    try {
      await api("/v1/admin/topics", {
        method: "POST",
        body: { name, description, webpush_config }
      });
      document.getElementById("create-topic-form").reset();
      document.getElementById("topic-webpush-enabled").checked = true;
      document.getElementById("topic-click-url").value = "/admin#events";
      showAlert("Topic created successfully with Web Push style", "success");
      loadTopics();
    } catch (err) {
      showAlert("Error creating topic: " + err.message);
    }
  });

  window.editTopicStyle = function(id) {
    const topic = cachedTopics.find(t => t.id === id);
    if (!topic) return;
    const cfg = topic.webpush_config || {};
    document.getElementById("edit-topic-id").value = topic.id;
    document.getElementById("topic-style-modal-name").textContent = topic.name;
    document.getElementById("edit-topic-desc").value = topic.description || "";
    document.getElementById("edit-topic-webpush-enabled").checked = cfg.webpush_enabled !== false;
    document.getElementById("edit-topic-click-url").value = cfg.click_url || "/admin#events";
    document.getElementById("edit-topic-icon").value = cfg.icon || "";
    document.getElementById("edit-topic-badge").value = cfg.badge || "";
    document.getElementById("edit-topic-image").value = cfg.image || "";
    document.getElementById("edit-topic-require-interaction").checked = !!cfg.require_interaction;
    document.getElementById("edit-topic-vibrate").value = Array.isArray(cfg.vibrate) ? cfg.vibrate.join(", ") : (cfg.vibrate || "");
    document.getElementById("edit-topic-tag").value = cfg.tag || "";
    document.getElementById("topic-style-modal").classList.remove("hidden");
  };

  document.getElementById("topic-style-modal-close").addEventListener("click", () => {
    document.getElementById("topic-style-modal").classList.add("hidden");
  });
  document.getElementById("topic-style-modal-cancel").addEventListener("click", () => {
    document.getElementById("topic-style-modal").classList.add("hidden");
  });

  document.getElementById("topic-style-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = parseInt(document.getElementById("edit-topic-id").value, 10);
    const description = document.getElementById("edit-topic-desc").value.trim();
    const vibrateRaw = document.getElementById("edit-topic-vibrate").value.trim();
    let vibrate = undefined;
    if (vibrateRaw) {
      vibrate = vibrateRaw.split(",").map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    }

    const webpush_config = {
      webpush_enabled: document.getElementById("edit-topic-webpush-enabled").checked,
      click_url: document.getElementById("edit-topic-click-url").value.trim() || "/admin#events",
      icon: document.getElementById("edit-topic-icon").value.trim() || undefined,
      badge: document.getElementById("edit-topic-badge").value.trim() || undefined,
      image: document.getElementById("edit-topic-image").value.trim() || undefined,
      require_interaction: document.getElementById("edit-topic-require-interaction").checked,
      vibrate: vibrate && vibrate.length > 0 ? vibrate : undefined,
      tag: document.getElementById("edit-topic-tag").value.trim() || undefined
    };

    try {
      await api("/v1/admin/topics/" + id, {
        method: "PATCH",
        body: { description, webpush_config }
      });
      document.getElementById("topic-style-modal").classList.add("hidden");
      showAlert("Notification style and Web Push settings updated", "success");
      loadTopics();
    } catch (err) {
      showAlert("Error updating notification style: " + err.message, "danger");
    }
  });

  window.toggleTopic = async function(id, enabled) {
    try {
      await api("/v1/admin/topics/" + id, { method: "PATCH", body: { enabled } });
      loadTopics();
    } catch (err) {
      showAlert("Error updating topic: " + err.message);
    }
  };

  window.deleteTopic = async function(id) {
    if (!confirm("Delete this topic and its subscriptions?")) return;
    try {
      await api("/v1/admin/topics/" + id, { method: "DELETE" });
      loadTopics();
    } catch (err) {
      showAlert("Error deleting topic: " + err.message);
    }
  };

  // Destinations Tab
  const destTypeSelect = document.getElementById("dest-type");
  destTypeSelect.addEventListener("change", () => {
    const val = destTypeSelect.value;
    document.getElementById("dest-email-fields").classList.toggle("hidden", val !== "email");
    document.getElementById("dest-telegram-fields").classList.toggle("hidden", val !== "telegram");
    document.getElementById("dest-webpush-fields").classList.toggle("hidden", val !== "webpush");
  });

  async function loadDestinations() {
    try {
      const res = await api("/v1/admin/destinations");
      cachedDestinations = res.items || [];
      const tbody = document.getElementById("destinations-table-body");
      if (cachedDestinations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);">No destinations configured</td></tr>';
      } else {
        tbody.innerHTML = cachedDestinations.map(d => {
          let summary = "-";
          if (d.type === "email") {
            summary = d.config.to || "-";
          } else if (d.type === "telegram") {
            summary = "Chat: " + (d.config.chat_id || "-");
          } else if (d.type === "webpush") {
            try {
              const u = new URL(d.config.endpoint);
              summary = "Host: " + u.hostname + (d.config.click_url ? " (" + d.config.click_url + ")" : "");
            } catch {
              summary = "Endpoint: " + (d.config.endpoint ? d.config.endpoint.substring(0, 30) + "..." : "-");
            }
          }

          return \`
            <tr>
              <td><strong>\${escapeText(d.name)}</strong></td>
              <td><span class="badge badge-neutral">\${escapeText(d.type)}</span></td>
              <td style="font-size:12px; font-family:monospace;">\${escapeText(summary)}</td>
              <td><span class="badge \${d.has_secret ? 'badge-success' : 'badge-neutral'}">\${d.has_secret ? 'Encrypted' : 'None'}</span></td>
              <td><span class="badge \${d.enabled ? 'badge-success' : 'badge-danger'}">\${d.enabled ? 'Active' : 'Disabled'}</span></td>
              <td>
                <button class="btn-sm btn-primary" onclick="window.testDestination(\${d.id})">Test</button>
                <button class="btn-sm" onclick="window.toggleDestination(\${d.id}, \${d.enabled ? 0 : 1})">\${d.enabled ? 'Disable' : 'Enable'}</button>
                <button class="btn-sm btn-danger" onclick="window.deleteDestination(\${d.id})">Delete</button>
              </td>
            </tr>
          \`;
        }).join("");
      }
    } catch (err) {
      showAlert("Failed to load destinations: " + err.message);
    }
  }

  document.getElementById("create-dest-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("dest-name").value.trim();
    const type = destTypeSelect.value;
    let config = {};
    let secret = "";

    if (type === "email") {
      config = {
        to: document.getElementById("dest-email-to").value.trim(),
        sender_id: document.getElementById("dest-email-sender").value.trim()
      };
      secret = document.getElementById("dest-email-key").value.trim();
    } else if (type === "telegram") {
      config = { chat_id: document.getElementById("dest-telegram-chat").value.trim() };
      secret = document.getElementById("dest-telegram-token").value.trim();
    } else if (type === "webpush") {
      config = {
        endpoint: document.getElementById("dest-webpush-endpoint").value.trim(),
        keys: {
          p256dh: document.getElementById("dest-webpush-p256dh").value.trim(),
          auth: document.getElementById("dest-webpush-auth").value.trim()
        },
        click_url: document.getElementById("dest-webpush-click-url").value.trim() || undefined,
        icon: document.getElementById("dest-webpush-icon").value.trim() || undefined
      };
      secret = "";
    }

    try {
      await api("/v1/admin/destinations", {
        method: "POST",
        body: { name, type, config, secret }
      });
      document.getElementById("create-dest-form").reset();
      showAlert("Destination configured successfully", "success");
      loadDestinations();
    } catch (err) {
      showAlert("Error creating destination: " + err.message);
    }
  });

  window.testDestination = async function(id) {
    showAlert("Sending test notification to destination...", "info");
    try {
      const res = await api("/v1/admin/destinations/" + id + "/test", { method: "POST" });
      if (res.ok) {
        showAlert("Test notification succeeded: " + (res.result?.message || "Success"), "success");
      } else {
        showAlert("Test notification failed: " + (res.result?.message || "Provider error"), "danger");
      }
    } catch (err) {
      showAlert("Destination test failed: " + err.message, "danger");
    }
  };

  window.toggleDestination = async function(id, enabled) {
    try {
      await api("/v1/admin/destinations/" + id, { method: "PATCH", body: { enabled } });
      loadDestinations();
    } catch (err) {
      showAlert("Error updating destination: " + err.message);
    }
  };

  window.deleteDestination = async function(id) {
    if (!confirm("Delete this destination? Any subscriptions routing to it will be removed.")) return;
    try {
      await api("/v1/admin/destinations/" + id, { method: "DELETE" });
      loadDestinations();
    } catch (err) {
      showAlert("Error deleting destination: " + err.message);
    }
  };

  // Groups Tab
  async function loadGroups() {
    try {
      const [groupsRes, destsRes] = await Promise.all([
        api("/v1/admin/groups"),
        api("/v1/admin/destinations")
      ]);
      cachedGroups = groupsRes.items || [];
      cachedDestinations = destsRes.items || [];

      // Update Group select
      const groupSelect = document.getElementById("member-group-select");
      groupSelect.innerHTML = cachedGroups.map(g => \`<option value="\${g.id}">\${escapeText(g.name)}</option>\`).join("");

      // Update Destination select
      const destSelect = document.getElementById("member-dest-select");
      destSelect.innerHTML = cachedDestinations.map(d => \`<option value="\${d.id}">\${escapeText(d.name)} (\${escapeText(d.type)})</option>\`).join("");

      const container = document.getElementById("groups-container");
      if (cachedGroups.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">No recipient groups created</p>';
      } else {
        container.innerHTML = cachedGroups.map(g => \`
          <div style="background:var(--bg-panel-alt); border:1px solid var(--border); border-radius:6px; padding:14px; margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <div>
                <strong style="font-size:15px;">\${escapeText(g.name)}</strong>
                <span style="font-size:12px; color:var(--text-muted); margin-left:8px;">\${escapeText(g.description || '')}</span>
              </div>
              <div>
                <button class="btn-sm btn-danger" onclick="window.deleteGroup(\${g.id})">Delete Group</button>
              </div>
            </div>
            <div style="margin-top:10px;">
              <div style="font-size:11.5px; font-weight:600; color:var(--text-muted); margin-bottom:4px; text-transform:uppercase;">Group Members:</div>
              \${(g.members || []).length === 0 ? '<span style="color:var(--text-dim); font-size:12px;">No destinations added to this group yet</span>' : (g.members || []).map(m => \`
                <div style="display:inline-flex; align-items:center; gap:6px; background:#090f1d; border:1px solid var(--border); border-radius:4px; padding:3px 8px; margin:2px 4px 2px 0; font-size:12px;">
                  <span>\${escapeText(m.destination_name)}</span>
                  <span class="badge badge-neutral" style="font-size:10px;">\${escapeText(m.destination_type)}</span>
                  <span style="cursor:pointer; color:var(--danger); font-weight:bold; margin-left:4px;" onclick="window.removeGroupMember(\${g.id}, \${m.destination_id})">&times;</span>
                </div>
              \`).join("")}
            </div>
          </div>
        \`).join("");
      }
    } catch (err) {
      showAlert("Failed to load groups: " + err.message);
    }
  }

  document.getElementById("create-group-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("group-name").value.trim();
    const description = document.getElementById("group-desc").value.trim();
    try {
      await api("/v1/admin/groups", { method: "POST", body: { name, description } });
      document.getElementById("create-group-form").reset();
      showAlert("Group created", "success");
      loadGroups();
    } catch (err) {
      showAlert("Error creating group: " + err.message);
    }
  });

  document.getElementById("add-member-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const groupId = document.getElementById("member-group-select").value;
    const destinationId = parseInt(document.getElementById("member-dest-select").value, 10);
    try {
      await api("/v1/admin/groups/" + groupId + "/members", {
        method: "POST",
        body: { destination_id: destinationId }
      });
      showAlert("Destination added to group", "success");
      loadGroups();
    } catch (err) {
      showAlert("Error adding group member: " + err.message);
    }
  });

  window.removeGroupMember = async function(groupId, destinationId) {
    try {
      await api("/v1/admin/groups/" + groupId + "/members/" + destinationId, { method: "DELETE" });
      loadGroups();
    } catch (err) {
      showAlert("Error removing member: " + err.message);
    }
  };

  window.deleteGroup = async function(id) {
    if (!confirm("Delete this group and its group subscriptions?")) return;
    try {
      await api("/v1/admin/groups/" + id, { method: "DELETE" });
      loadGroups();
    } catch (err) {
      showAlert("Error deleting group: " + err.message);
    }
  };

  // Subscriptions Tab
  const subTargetType = document.getElementById("sub-target-type");
  subTargetType.addEventListener("change", updateSubTargetOptions);

  function updateSubTargetOptions() {
    const isGroup = subTargetType.value === "group";
    document.getElementById("sub-target-label").textContent = isGroup ? "Target Group" : "Target Destination";
    const select = document.getElementById("sub-target-id");
    if (isGroup) {
      select.innerHTML = cachedGroups.map(g => \`<option value="\${g.id}">Group: \${escapeText(g.name)} (\${(g.members||[]).length} destinations)</option>\`).join("");
    } else {
      select.innerHTML = cachedDestinations.map(d => \`<option value="\${d.id}">\${escapeText(d.name)} (\${escapeText(d.type)})</option>\`).join("");
    }
  }

  async function loadSubscriptions() {
    try {
      const [subsRes, topicsRes, sourcesRes, destsRes, groupsRes] = await Promise.all([
        api("/v1/admin/subscriptions"),
        api("/v1/admin/topics"),
        api("/v1/admin/sources"),
        api("/v1/admin/destinations"),
        api("/v1/admin/groups")
      ]);

      cachedTopics = topicsRes.items || [];
      cachedSources = sourcesRes.items || [];
      cachedDestinations = destsRes.items || [];
      cachedGroups = groupsRes.items || [];

      // Update Sub Topic Select
      const topicSelect = document.getElementById("sub-topic-select");
      topicSelect.innerHTML = cachedTopics.map(t => \`<option value="\${t.id}">\${escapeText(t.name)}</option>\`).join("");

      // Update Sub Source Select
      const sourceSelect = document.getElementById("sub-source-select");
      sourceSelect.innerHTML = '<option value="">All Authorized Sources</option>' +
        cachedSources.map(s => \`<option value="\${s.id}">\${escapeText(s.name)}</option>\`).join("");

      updateSubTargetOptions();

      const tbody = document.getElementById("subscriptions-table-body");
      const subs = subsRes.items || [];
      if (subs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">No subscriptions configured</td></tr>';
      } else {
        tbody.innerHTML = subs.map(s => {
          let target = "-";
          if (s.destination_id) target = \`<strong>\${escapeText(s.destination_name)}</strong> (\${escapeText(s.destination_type)})\`;
          else if (s.group_id) target = \`Group: <strong>\${escapeText(s.group_name)}</strong>\`;

          const filter = [
            s.source_name ? "Source: " + escapeText(s.source_name) : "Any source",
            s.severity ? "Severity: " + escapeText(s.severity) : "Any severity"
          ].join(" &bull; ");

          return \`
            <tr>
              <td><span class="topic-tag">\${escapeText(s.topic_name)}</span></td>
              <td style="font-size:12px; color:var(--text-muted);">\${filter}</td>
              <td>\${target}</td>
              <td><span class="badge \${s.enabled ? 'badge-success' : 'badge-danger'}">\${s.enabled ? 'Active' : 'Disabled'}</span></td>
              <td>
                <button class="btn-sm btn-danger" onclick="window.deleteSubscription(\${s.id})">Delete</button>
              </td>
            </tr>
          \`;
        }).join("");
      }
    } catch (err) {
      showAlert("Failed to load subscriptions: " + err.message);
    }
  }

  document.getElementById("create-subscription-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const topic_id = parseInt(document.getElementById("sub-topic-select").value, 10);
    const source_id = document.getElementById("sub-source-select").value ? parseInt(document.getElementById("sub-source-select").value, 10) : null;
    const severity = document.getElementById("sub-severity-select").value || null;
    const isGroup = subTargetType.value === "group";
    const targetId = parseInt(document.getElementById("sub-target-id").value, 10);

    const body = {
      topic_id,
      source_id,
      severity,
      destination_id: isGroup ? null : targetId,
      group_id: isGroup ? targetId : null
    };

    try {
      await api("/v1/admin/subscriptions", { method: "POST", body });
      showAlert("Subscription created successfully", "success");
      loadSubscriptions();
    } catch (err) {
      showAlert("Error creating subscription: " + err.message);
    }
  });

  window.deleteSubscription = async function(id) {
    if (!confirm("Delete this subscription?")) return;
    try {
      await api("/v1/admin/subscriptions/" + id, { method: "DELETE" });
      loadSubscriptions();
    } catch (err) {
      showAlert("Error deleting subscription: " + err.message);
    }
  };

  // Events Tab
  async function loadEvents() {
    const search = document.getElementById("event-search-input").value.trim();
    const status = document.getElementById("event-status-filter").value;

    let query = \`?limit=\${PAGE_SIZE}&offset=\${currentEventsOffset}\`;
    if (search) query += "&search=" + encodeURIComponent(search);
    if (status) query += "&status=" + encodeURIComponent(status);

    try {
      const res = await api("/v1/admin/events" + query);
      const events = res.events || [];
      const tbody = document.getElementById("events-table-body");
      if (events.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);">No notification events match criteria</td></tr>';
      } else {
        tbody.innerHTML = events.map(e => \`
          <tr>
            <td>#\${e.id}</td>
            <td><strong>\${escapeText(e.source_name || '-')}</strong></td>
            <td><span class="topic-tag">\${escapeText(e.topic)}</span></td>
            <td>\${escapeText(e.title || '-')}</td>
            <td><span class="badge badge-neutral">\${escapeText(e.severity)}</span></td>
            <td>\${e.success_deliveries}/\${e.total_deliveries} ok</td>
            <td><span class="badge \${statusBadge(e.status)}">\${escapeText(e.status)}</span></td>
            <td>\${formatTime(e.created_at)}</td>
            <td>
              <button class="btn-sm btn-primary" onclick="window.viewEventDetails(\${e.id})">Details</button>
            </td>
          </tr>
        \`).join("");
      }

      const total = res.total || 0;
      document.getElementById("events-count-label").textContent = \`Showing \${currentEventsOffset + 1} - \${Math.min(currentEventsOffset + events.length, total)} of \${total} events\`;
      document.getElementById("events-prev-btn").disabled = currentEventsOffset === 0;
      document.getElementById("events-next-btn").disabled = currentEventsOffset + PAGE_SIZE >= total;
    } catch (err) {
      showAlert("Failed to load events: " + err.message);
    }
  }

  document.getElementById("event-filter-btn").addEventListener("click", () => {
    currentEventsOffset = 0;
    loadEvents();
  });

  document.getElementById("events-prev-btn").addEventListener("click", () => {
    if (currentEventsOffset >= PAGE_SIZE) {
      currentEventsOffset -= PAGE_SIZE;
      loadEvents();
    }
  });

  document.getElementById("events-next-btn").addEventListener("click", () => {
    currentEventsOffset += PAGE_SIZE;
    loadEvents();
  });

  window.viewEventDetails = async function(id) {
    try {
      const res = await api("/v1/admin/events/" + id);
      const ev = res.data;
      document.getElementById("event-modal-title").textContent = \`Event #\${ev.id} &bull; \${ev.topic}\`;

      let deliveriesHtml = (ev.deliveries || []).map(d => \`
        <tr>
          <td><strong>\${escapeText(d.destination_name)}</strong> (\${escapeText(d.destination_type)})</td>
          <td><span class="badge \${d.status === 'success' ? 'badge-success' : 'badge-danger'}">\${escapeText(d.status)}</span></td>
          <td>\${d.http_status || '-'}</td>
          <td>Attempt #\${d.attempt_count || 1}</td>
          <td style="font-family:monospace; font-size:11.5px; color:var(--text-muted);">\${escapeText(d.error_message || d.response_excerpt || '-')}</td>
        </tr>
      \`).join("");

      if (!deliveriesHtml) {
        deliveriesHtml = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">No destinations resolved</td></tr>';
      }

      const hasFailures = (ev.deliveries || []).some(d => d.status === "failed");
      const retryBtn = document.getElementById("event-retry-btn");
      if (hasFailures) {
        retryBtn.classList.remove("hidden");
        retryBtn.onclick = () => window.retryEvent(ev.id);
      } else {
        retryBtn.classList.add("hidden");
      }

      document.getElementById("event-modal-body").innerHTML = \`
        <div style="margin-bottom:14px;">
          <div style="font-size:12px; color:var(--text-muted);">SOURCE</div>
          <div style="font-size:14px; font-weight:600;">\${escapeText(ev.source_name || '-')}</div>
        </div>
        <div style="margin-bottom:14px;">
          <div style="font-size:12px; color:var(--text-muted);">MESSAGE</div>
          <div style="background:var(--bg-input); padding:10px; border-radius:6px; border:1px solid var(--border); white-space:pre-wrap; font-size:13px;">\${escapeText(ev.message)}</div>
        </div>
        <div style="margin-bottom:14px;">
          <div style="font-size:12px; color:var(--text-muted);">METADATA</div>
          <pre style="background:var(--bg-input); padding:10px; border-radius:6px; border:1px solid var(--border); font-size:12px; overflow-x:auto;">\${escapeText(JSON.stringify(ev.metadata || {}, null, 2))}</pre>
        </div>
        <div>
          <div style="font-size:12px; color:var(--text-muted); margin-bottom:6px;">DELIVERY OUTCOMES</div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Destination</th><th>Status</th><th>HTTP</th><th>Attempts</th><th>Outcome</th></tr></thead>
              <tbody>\${deliveriesHtml}</tbody>
            </table>
          </div>
        </div>
      \`;

      document.getElementById("event-modal").classList.remove("hidden");
    } catch (err) {
      showAlert("Error loading event: " + err.message);
    }
  };

  window.retryEvent = async function(id) {
    showAlert("Retrying failed deliveries for event #" + id + "...", "info");
    try {
      const res = await api("/v1/admin/events/" + id + "/retry", { method: "POST" });
      showAlert(\`Retry completed: \${res.result?.retried || 0} destinations re-dispatched\`, "success");
      document.getElementById("event-modal").classList.add("hidden");
      loadEvents();
    } catch (err) {
      showAlert("Error retrying event: " + err.message);
    }
  };

  document.getElementById("event-modal-close").addEventListener("click", () => document.getElementById("event-modal").classList.add("hidden"));
  document.getElementById("event-modal-done").addEventListener("click", () => document.getElementById("event-modal").classList.add("hidden"));

  // Delivery Logs Tab
  async function loadLogs() {
    const status = document.getElementById("log-status-filter").value;
    const search = document.getElementById("log-search-input").value.trim();

    let query = \`?limit=\${PAGE_SIZE}&offset=\${currentLogsOffset}\`;
    if (status) query += "&status=" + encodeURIComponent(status);
    if (search) query += "&search=" + encodeURIComponent(search);

    try {
      const res = await api("/v1/admin/delivery-logs" + query);
      const logs = res.logs || [];
      const tbody = document.getElementById("logs-table-body");
      if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);">No logs match filter criteria</td></tr>';
      } else {
        tbody.innerHTML = logs.map(l => \`
          <tr>
            <td>#\${l.id}</td>
            <td>#\${l.event_id}</td>
            <td><span class="topic-tag">\${escapeText(l.topic)}</span></td>
            <td><strong>\${escapeText(l.destination_name || '-')}</strong></td>
            <td><span class="badge badge-neutral">\${escapeText(l.provider_type || '-')}</span></td>
            <td><span class="badge \${l.status === 'success' ? 'badge-success' : 'badge-danger'}">\${escapeText(l.status)}</span></td>
            <td>\${l.http_status || '-'}</td>
            <td style="font-family:monospace; font-size:12px; color:var(--text-muted); max-width:300px; overflow:hidden; text-overflow:ellipsis;">\${escapeText(l.error_message || l.response_excerpt || '-')}</td>
            <td>\${formatTime(l.created_at)}</td>
          </tr>
        \`).join("");
      }

      const total = res.total || 0;
      document.getElementById("logs-count-label").textContent = \`Showing \${currentLogsOffset + 1} - \${Math.min(currentLogsOffset + logs.length, total)} of \${total} logs\`;
      document.getElementById("logs-prev-btn").disabled = currentLogsOffset === 0;
      document.getElementById("logs-next-btn").disabled = currentLogsOffset + PAGE_SIZE >= total;
    } catch (err) {
      showAlert("Failed to load delivery logs: " + err.message);
    }
  }

  document.getElementById("log-filter-btn").addEventListener("click", () => {
    currentLogsOffset = 0;
    loadLogs();
  });

  document.getElementById("logs-prev-btn").addEventListener("click", () => {
    if (currentLogsOffset >= PAGE_SIZE) {
      currentLogsOffset -= PAGE_SIZE;
      loadLogs();
    }
  });

  document.getElementById("logs-next-btn").addEventListener("click", () => {
    currentLogsOffset += PAGE_SIZE;
    loadLogs();
  });

  // Settings Tab
  async function loadSettings() {
    try {
      const res = await api("/v1/admin/settings");
      const d = res.data;
      const vapidKey = d.vapid_public_key || "Not generated yet";
      document.getElementById("settings-diagnostics-body").innerHTML = \`
        <div style="font-size:13.5px; line-height:2;">
          <div><strong>Runtime Environment:</strong> \${escapeText(d.runtime)}</div>
          <div><strong>Database Engine:</strong> \${escapeText(d.database)}</div>
          <div><strong>Encryption Key Configured:</strong> <span class="badge \${d.config.has_encryption_key ? 'badge-success' : 'badge-danger'}">\${d.config.has_encryption_key ? 'Active (AES-256-GCM)' : 'Missing'}</span></div>
          <div><strong>Email Sender API:</strong> \${escapeText(d.config.email_api_url)}</div>
          <div><strong>Email Sender ID:</strong> \${escapeText(d.config.email_sender_id)}</div>
          <div><strong>Worker Email Key Configured:</strong> <span class="badge \${d.config.has_email_api_key ? 'badge-success' : 'badge-neutral'}">\${d.config.has_email_api_key ? 'Present' : 'Not Set in Env'}</span></div>
          <div><strong>Worker Telegram Token:</strong> <span class="badge \${d.config.has_telegram_bot_token ? 'badge-success' : 'badge-neutral'}">\${d.config.has_telegram_bot_token ? 'Present' : 'Not Set in Env'}</span></div>
          <div><strong>Active Web Push Subscribers:</strong> <span class="badge badge-success">\${d.webpush_subscribers_count ?? 0}</span></div>
          <div style="margin-top:12px; padding:12px; background:var(--bg-panel-alt); border:1px solid var(--border); border-radius:6px; line-height:1.6;">
            <div style="font-weight:700; color:var(--text-main); margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
              <span>VAPID Public Key (Web Push RFC 8292):</span>
              <button id="copy-vapid-btn" class="btn-sm" style="padding:2px 8px; font-size:11px;">Copy Key</button>
            </div>
            <div style="font-family:monospace; font-size:11.5px; word-break:break-all; color:var(--accent-orange);">\${escapeText(vapidKey)}</div>
            <div style="margin-top:8px;">
              <button id="regenerate-vapid-btn" class="btn-sm btn-danger" style="padding:3px 10px; font-size:11px;">Regenerate VAPID Keys</button>
            </div>
          </div>
          <div style="margin-top:10px;"><strong>Active Administrators:</strong> \${d.administrators.active_count}</div>
          <div><strong>Active Web Sessions:</strong> \${d.administrators.active_sessions}</div>
        </div>
      \`;

      document.getElementById("copy-vapid-btn").addEventListener("click", () => {
        navigator.clipboard.writeText(vapidKey).then(() => {
          showAlert("VAPID public key copied to clipboard", "success");
        });
      });

      document.getElementById("regenerate-vapid-btn").addEventListener("click", async () => {
        if (!confirm("WARNING: Regenerating VAPID keys will invalidate existing browser push subscriptions until they re-subscribe. Continue?")) return;
        try {
          const r = await api("/v1/admin/vapid/regenerate", { method: "POST" });
          showAlert("VAPID keys regenerated successfully: " + r.message, "success");
          loadSettings();
        } catch (err) {
          showAlert("Error regenerating VAPID keys: " + err.message, "danger");
        }
      });
    } catch (err) {
      showAlert("Error loading diagnostics: " + err.message);
    }
  }

  document.getElementById("cleanup-sessions-btn").addEventListener("click", async () => {
    try {
      await api("/v1/admin/cleanup-sessions", { method: "POST" });
      showAlert("Expired and revoked sessions purged from database", "success");
      loadSettings();
    } catch (err) {
      showAlert("Error purging sessions: " + err.message);
    }
  });

  // Modal helpers
  function showTokenModal(token) {
    document.getElementById("generated-token-text").textContent = token;
    document.getElementById("token-modal").classList.remove("hidden");
  }

  document.getElementById("copy-token-btn").addEventListener("click", () => {
    const text = document.getElementById("generated-token-text").textContent;
    navigator.clipboard.writeText(text).then(() => {
      document.getElementById("copy-token-btn").textContent = "Copied to Clipboard!";
      setTimeout(() => document.getElementById("copy-token-btn").textContent = "Copy Key to Clipboard", 2500);
    });
  });

  document.getElementById("token-modal-close").addEventListener("click", () => {
    document.getElementById("token-modal").classList.add("hidden");
  });

  // Utility functions
  function escapeText(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatTime(isoStr) {
    if (!isoStr) return "-";
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return isoStr;
    }
  }

  function statusBadge(status) {
    if (status === "processed" || status === "success") return "badge-success";
    if (status === "partial_failure" || status === "warning") return "badge-warning";
    if (status === "failed") return "badge-danger";
    return "badge-neutral";
  }

  // Initial Boot
  if (getToken()) {
    showAppView();
  } else {
    showAuthView();
  }
})();
</script>
</body>
</html>`;
}
