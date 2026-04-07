import { useState, useEffect } from 'react';
import { BarChart3, Calendar, Bot, Mic, Key, Phone, Users, PhoneOutgoing, Globe, Sparkles, Trash2, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { cn } from './lib/utils';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://saas-backend.xqnsvk.easypanel.host';

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [callLogs, setCallLogs] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [agentSettings, setAgentSettings] = useState({ system_prompt: '', voice_preset: 'Mark', temperature: 0.3 });
  const [integrations, setIntegrations] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const fetchAll = () => {
    fetch(`${API_BASE}/api/calls`).then(r => r.json()).then(d => { if (d.success) setCallLogs(d.calls); }).catch(() => {});
    fetch(`${API_BASE}/api/contacts`).then(r => r.json()).then(d => { if (d?.success) setContacts(d.contacts); }).catch(() => {});
    fetch(`${API_BASE}/api/agent`).then(r => r.json()).then(d => { if (d.success && d.agent) setAgentSettings(d.agent); }).catch(() => {});
    fetch(`${API_BASE}/api/integrations`).then(r => r.json()).then(d => { if (d.success) setIntegrations(d.integrations || []); }).catch(() => {});
    fetch(`${API_BASE}/api/appointments`).then(r => r.json()).then(d => { if (d.success) setAppointments(d.appointments || []); }).catch(() => {});
  };

  useEffect(() => { fetchAll(); }, []);

  // Auto-refresh appointments every 30 seconds for real-time sync
  useEffect(() => {
    const interval = setInterval(() => {
      fetch(`${API_BASE}/api/appointments`).then(r => r.json()).then(d => { if (d.success) setAppointments(d.appointments || []); }).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const getIntegration = (provider) => integrations.find(i => i.provider === provider) || { api_key: '', meta_data: {} };

  const saveIntegration = async (provider, api_key, meta_data = {}) => {
    try {
      const res = await fetch(`${API_BASE}/api/integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, api_key, meta_data })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setIntegrations(prev => [...prev.filter(i => i.provider !== provider), { provider, api_key, meta_data }]);
      return true;
    } catch(e) {
      alert('Save failed: ' + e.message);
      return false;
    }
  };

  const fetchSlotsForDate = async (date) => {
    setLoadingSlots(true);
    setAvailableSlots([]);
    const dateStr = date.toISOString().split('T')[0];
    try {
      const res = await fetch(`${API_BASE}/api/tools/availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_date: dateStr })
      });
      const data = await res.json();
      if (Array.isArray(data.available_slots)) {
        setAvailableSlots(data.available_slots);
      } else {
        setAvailableSlots([]);
      }
    } catch(e) { setAvailableSlots([]); }
    setLoadingSlots(false);
  };

  // Get appointments for selected date
  const appointmentsForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return appointments.filter(a => a.start_time && a.start_time.startsWith(dateStr));
  };

  // Calendar grid helpers
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { firstDay, daysInMonth };
  };

  const navigation = [
    { section: 'Overview' },
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { section: 'Configuration' },
    { id: 'agent', label: 'Agent Settings', icon: Bot },
    { id: 'models', label: 'Models & Voice', icon: Mic },
    { id: 'credentials', label: 'API Credentials', icon: Key },
    { section: 'Data' },
    { id: 'logs', label: 'Call Logs', icon: Phone },
    { id: 'crm', label: 'CRM Contacts', icon: Users },
    { section: 'Calling' },
    { id: 'outbound', label: 'Outbound Calls', icon: PhoneOutgoing },
  ];

  const { firstDay, daysInMonth } = getDaysInMonth(calendarDate);
  const today = new Date();

  return (
    <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[240px] min-w-[240px] bg-sidebar border-r border-border flex flex-col py-6 relative z-10">
        <div className="flex items-center gap-3 px-5 pb-6 border-b border-border">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
              <path d="M8 12c0-2.21 1.79-4 4-4s4 1.79 4 4" />
              <circle cx="12" cy="15" r="2" fill="currentColor" />
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-sm leading-tight">Azlon AI</h1>
            <p className="text-[10px] text-muted-foreground">Advanced Voice SaaS</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-4">
          {navigation.map((item, idx) => {
            if (item.section) return <div key={idx} className="px-4 py-2 mt-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{item.section}</div>;
            const Icon = item.icon;
            return (
              <button key={item.id} onClick={() => setActivePage(item.id)}
                className={cn("w-full flex items-center gap-3 px-5 py-2.5 text-[13.5px] font-medium border-l-4 transition-all outline-none",
                  activePage === item.id ? "text-primary border-primary bg-[rgba(108,99,255,0.18)]" : "text-muted-foreground border-transparent hover:text-foreground hover:bg-white/5")}>
                <Icon size={16} />{item.label}
              </button>
            );
          })}
        </nav>
        <div className="px-5 pt-4 border-t border-border text-[11px] text-muted-foreground flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />Agent Online
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-background p-8">

        {/* ── DASHBOARD ── */}
        {activePage === 'dashboard' && (
          <div className="space-y-6 fade-in">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold">Dashboard</h2>
                <p className="text-sm text-muted-foreground mt-1">Real-time overview of your AI voice agent</p>
              </div>
              <button onClick={fetchAll} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition border border-border px-3 py-1.5 rounded-lg">
                <RefreshCw size={12} /> Refresh
              </button>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Total Calls', value: callLogs.length, sub: 'All time' },
                { label: 'Appointments', value: appointments.length, sub: 'Booked by AI' },
                { label: 'Active Contacts', value: contacts.length, sub: 'In CRM' },
                { label: 'Completed', value: callLogs.filter(c => c.status === 'completed').length, sub: 'Finished calls' }
              ].map((stat, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-5 hover:-translate-y-1 hover:shadow-lg transition-all duration-200">
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{stat.label}</div>
                  <div className="text-3xl font-bold mt-2">{stat.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{stat.sub}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-semibold text-sm mb-4 border-b border-border pb-3">Recent Calls</h3>
                <table className="w-full text-left text-sm">
                  <thead><tr className="border-b border-border"><th className="pb-2 text-muted-foreground font-medium text-xs">Number</th><th className="pb-2 text-muted-foreground font-medium text-xs">Status</th><th className="pb-2 text-muted-foreground font-medium text-xs">Date</th></tr></thead>
                  <tbody>
                    {callLogs.slice(0, 5).map((c, i) => (
                      <tr key={i} className="border-b border-border/40">
                        <td className="py-2 font-mono text-primary text-xs">{c.direction === 'inbound' ? c.from_phone : c.to_phone}</td>
                        <td className="py-2"><span className="bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full text-[10px] uppercase">{c.status}</span></td>
                        <td className="py-2 text-muted-foreground text-xs">{new Date(c.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                    {callLogs.length === 0 && <tr><td colSpan="3" className="text-center py-4 text-muted-foreground text-xs">No calls yet</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-semibold text-sm mb-4 border-b border-border pb-3">Upcoming Appointments</h3>
                <div className="space-y-2">
                  {appointments.slice(0, 5).map((a, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-border/40">
                      <div>
                        <div className="text-sm font-medium">{a.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{a.phone}</div>
                      </div>
                      <div className="text-xs text-primary text-right">{new Date(a.start_time).toLocaleString()}</div>
                    </div>
                  ))}
                  {appointments.length === 0 && <div className="text-center py-4 text-muted-foreground text-xs">No appointments yet</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── CALENDAR ── */}
        {activePage === 'calendar' && (
          <div className="space-y-6 fade-in">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold">Calendar & Booking Sync</h2>
                <p className="text-sm text-muted-foreground mt-1">Live view of all AI-booked appointments — synced from Cal.com</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => fetchSlotsForDate(calendarDate)} className="flex items-center gap-2 text-xs border border-border px-3 py-1.5 rounded-lg hover:text-primary transition">
                  <RefreshCw size={12} /> Check Free Slots
                </button>
                <button onClick={async () => {
                  const btn = document.getElementById('calcom-sync-btn');
                  btn.innerText = 'Syncing...';
                  try {
                    const res = await fetch(`${API_BASE}/api/appointments/sync`, { method: 'POST' });
                    const data = await res.json();
                    if (res.ok) {
                      alert(data.message);
                      // Refresh appointments after sync
                      fetch(`${API_BASE}/api/appointments`).then(r=>r.json()).then(d=>{if(d.success)setAppointments(d.appointments||[])});
                    } else {
                      alert('Sync failed: ' + (data.error || 'Unknown error'));
                    }
                  } catch(e) { alert('Network error during sync'); }
                  btn.innerText = '↓ Sync from Cal.com';
                }} id="calcom-sync-btn" className="flex items-center gap-2 text-xs bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary/90 transition font-medium">
                  ↓ Sync from Cal.com
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Calendar Grid */}
              <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-6">
                  <button onClick={() => { const d = new Date(calendarDate); d.setMonth(d.getMonth() - 1); setCalendarDate(d); setAvailableSlots([]); }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition text-lg">‹</button>
                  <h3 className="font-bold text-base">{calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
                  <button onClick={() => { const d = new Date(calendarDate); d.setMonth(d.getMonth() + 1); setCalendarDate(d); setAvailableSlots([]); }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition text-lg">›</button>
                </div>
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                    <div key={d} className="text-center text-[10px] font-bold text-muted-foreground uppercase py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array(firstDay).fill(null).map((_, i) => <div key={`empty-${i}`} />)}
                  {Array(daysInMonth).fill(null).map((_, i) => {
                    const day = i + 1;
                    const thisDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day);
                    const appts = appointmentsForDate(thisDate);
                    const isToday = thisDate.toDateString() === today.toDateString();
                    const isSelected = thisDate.toDateString() === calendarDate.toDateString() && calendarDate.getDate() === day;
                    return (
                      <button key={day} onClick={() => { const d = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day); setCalendarDate(d); fetchSlotsForDate(d); }}
                        className={cn("relative h-10 w-full rounded-lg text-sm font-medium transition-all hover:bg-primary/20",
                          isToday && "ring-2 ring-primary",
                          isSelected && "bg-primary text-white",
                          !isSelected && "hover:bg-white/5"
                        )}>
                        {day}
                        {appts.length > 0 && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-green-400" />}
                      </button>
                    );
                  })}
                </div>
                {/* Available Slots */}
                {(availableSlots.length > 0 || loadingSlots) && (
                  <div className="mt-6 border-t border-border pt-4">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                      Free Slots — {calendarDate.toLocaleDateString()}
                    </h4>
                    {loadingSlots ? (
                      <div className="text-xs text-muted-foreground">Loading available slots from Cal.com...</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {availableSlots.map((slot, i) => (
                          <span key={i} className="bg-green-500/10 text-green-400 border border-green-500/20 px-3 py-1 rounded-full text-xs font-mono">
                            {new Date(slot).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right Panel: Appointments for selected date + Cal.com config */}
              <div className="space-y-4">
                <div className="bg-card border border-border rounded-xl p-5 shadow-xl">
                  <div className="flex items-center justify-between mb-4 border-b border-border pb-3">
                    <h3 className="font-semibold text-sm">
                      {calendarDate.toLocaleDateString('default', { month: 'short', day: 'numeric' })}
                    </h3>
                    <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full uppercase tracking-wider">Live Sync</span>
                  </div>
                  {appointmentsForDate(calendarDate).length === 0 ? (
                    <div className="text-center py-6 text-xs text-muted-foreground">No appointments on this day</div>
                  ) : (
                    <div className="space-y-3">
                      {appointmentsForDate(calendarDate).map((a, i) => (
                        <div key={i} className="bg-background rounded-lg p-3 border border-border">
                          <div className="font-semibold text-sm">{a.name}</div>
                          <div className="text-xs text-muted-foreground font-mono mt-0.5">{a.phone}</div>
                          <div className="text-xs text-primary mt-1 font-medium">
                            {new Date(a.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-card border border-border rounded-xl p-5 shadow-xl">
                  <h3 className="font-semibold text-sm mb-4 border-b border-border pb-3">Cal.com Integration</h3>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const btn = e.target.querySelector('button[type=submit]');
                    btn.innerText = 'Saving...';
                    await saveIntegration('calcom', e.target.cal_key.value, { eventId: e.target.event_id.value });
                    btn.innerText = 'Saved!';
                    setTimeout(() => btn.innerText = 'Save', 2000);
                  }} className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">API Key</label>
                      <input name="cal_key" defaultValue={getIntegration('calcom').api_key} type="password" placeholder="cal_live_..." className="w-full bg-background border border-border rounded-lg p-2 text-xs outline-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Event Type ID</label>
                      <input name="event_id" defaultValue={getIntegration('calcom').meta_data?.eventId || ''} placeholder="123456" className="w-full bg-background border border-border rounded-lg p-2 text-xs outline-none" />
                    </div>
                    <button type="submit" className="w-full bg-primary text-white text-xs font-semibold py-2 rounded-lg">Save</button>
                  </form>
                </div>
              </div>
            </div>

            {/* All Appointments Table */}
            <div className="bg-card border border-border rounded-xl shadow-xl">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-sm">All AI-Booked Appointments</h3>
                <button onClick={() => fetch(`${API_BASE}/api/appointments`).then(r=>r.json()).then(d=>{if(d.success)setAppointments(d.appointments||[])})} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"><RefreshCw size={11}/> Sync</button>
              </div>
              <div className="p-4">
                <table className="w-full text-left text-sm">
                  <thead><tr className="border-b border-border"><th className="pb-3 px-2 text-xs font-medium text-muted-foreground">Name</th><th className="pb-3 px-2 text-xs font-medium text-muted-foreground">Phone</th><th className="pb-3 px-2 text-xs font-medium text-muted-foreground">Date & Time</th><th className="pb-3 px-2 text-xs font-medium text-muted-foreground">Status</th></tr></thead>
                  <tbody>
                    {appointments.map((a, i) => (
                      <tr key={i} className="border-b border-border/40 hover:bg-white/5 transition">
                        <td className="py-3 px-2 font-medium">{a.name}</td>
                        <td className="py-3 px-2 font-mono text-primary text-xs">{a.phone || '-'}</td>
                        <td className="py-3 px-2 text-xs">{new Date(a.start_time).toLocaleString()}</td>
                        <td className="py-3 px-2"><span className="bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full text-[10px] uppercase">{a.status || 'confirmed'}</span></td>
                      </tr>
                    ))}
                    {appointments.length === 0 && <tr><td colSpan="4" className="text-center py-8 text-muted-foreground text-xs">No appointments booked by AI yet. Test by calling your Twilio number!</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── AGENT SETTINGS ── */}
        {activePage === 'agent' && (
          <div className="space-y-6 fade-in max-w-3xl mx-auto">
            <div><h2 className="text-2xl font-bold">Agent Settings</h2><p className="text-sm text-muted-foreground mt-1">Configure your AI voice agent's behaviour and personality</p></div>
            <div className="bg-card border border-border rounded-xl p-6 shadow-xl">
              <form onSubmit={async (e) => {
                e.preventDefault();
                const btn = document.getElementById('save-agent-btn'); btn.innerText = 'Saving...';
                try {
                  const res = await fetch(`${API_BASE}/api/agent`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ system_prompt: e.target.prompt.value, voice_preset: e.target.voice.value, temperature: parseFloat(e.target.temp.value) }) });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                  btn.innerText = 'Saved!';
                  alert('Agent settings saved successfully!');
                  setTimeout(() => btn.innerText = 'Save Agent', 2000);
                } catch(err) {
                  btn.innerText = 'Save Agent';
                  alert('Save failed: ' + err.message + '\n\nBackend URL: ' + API_BASE);
                }
              }}>
                <h3 className="font-semibold text-sm mb-3 border-b border-border pb-3">Global System Prompt</h3>
                <textarea name="prompt" defaultValue={agentSettings.system_prompt} className="w-full bg-background border border-border rounded-lg p-4 font-mono text-[13px] outline-none resize-none h-[220px] mb-4" placeholder="You are the smart AI agent for Azlon AI Voice Platform..." required />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Voice Preset</label>
                    <select name="voice" defaultValue={agentSettings.voice_preset} className="w-full bg-background border border-border rounded-lg p-3 text-sm outline-none">
                      <option value="Mark">Mark (Professional Male)</option>
                      <option value="Tanya">Tanya (Warm Female)</option>
                      <option value="Adam">Adam (Energetic Male)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Temperature</label>
                    <input name="temp" type="number" step="0.1" max="1" min="0" defaultValue={agentSettings.temperature} className="w-full bg-background border border-border rounded-lg p-3 text-sm outline-none" />
                  </div>
                </div>
                <div className="mt-6 flex justify-end"><button id="save-agent-btn" type="submit" className="bg-primary text-white font-semibold px-6 py-2.5 rounded-lg text-sm">Save Agent</button></div>
              </form>
            </div>
          </div>
        )}

        {/* ── MODELS & VOICE ── */}
        {activePage === 'models' && (
          <div className="space-y-6 fade-in max-w-3xl mx-auto">
            <div><h2 className="text-2xl font-bold">Models & Voice</h2><p className="text-sm text-muted-foreground mt-1">Select your underlying AI engine and speech pipeline</p></div>
            <div className="bg-card border border-border rounded-xl p-6 shadow-xl space-y-5">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Primary LLM</label>
                <select className="w-full bg-background border border-border rounded-lg p-3 text-sm outline-none">
                  <option>Ultravox Ultra-Fast (Recommended)</option>
                  <option>GPT-4o (High Intelligence)</option>
                  <option>LLaMA 3 70B (Open Source)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Voice Engine</label>
                <select className="w-full bg-background border border-border rounded-lg p-3 text-sm outline-none">
                  <option>Ultravox Real-Time (Default)</option>
                  <option>ElevenLabs (Premium)</option>
                </select>
              </div>
              <div className="flex justify-end"><button className="bg-primary text-white font-semibold px-6 py-2.5 rounded-lg text-sm" onClick={() => alert('Preferences saved!')}>Save Preferences</button></div>
            </div>
          </div>
        )}

        {/* ── API CREDENTIALS ── */}
        {activePage === 'credentials' && (
          <div className="space-y-6 fade-in max-w-3xl mx-auto">
            <div><h2 className="text-2xl font-bold">API Credentials</h2><p className="text-sm text-muted-foreground mt-1">Store your service keys securely in Supabase</p></div>
            <div className="bg-card border border-border rounded-xl p-6 shadow-xl">
              <form onSubmit={async (e) => {
                e.preventDefault();
                const btn = document.getElementById('save-cred-btn'); btn.innerText = 'Saving...';
                const ok1 = await saveIntegration('ultravox', e.target.uv_key.value);
                const ok2 = await saveIntegration('twilio', e.target.tw_key.value, { sid: e.target.tw_sid.value, phone: e.target.tw_phone.value });
                const ok3 = await saveIntegration('calcom', e.target.cal_key.value, { eventId: e.target.cal_event.value });
                
                if (ok1 && ok2 && ok3) {
                  btn.innerText = 'Saved!';
                  alert('Credentials saved successfully!');
                  setTimeout(() => btn.innerText = 'Store Credentials', 2000);
                } else {
                  btn.innerText = 'Store Credentials';
                }
              }} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Ultravox API Key</label>
                  <input name="uv_key" defaultValue={getIntegration('ultravox').api_key} type="password" placeholder="uv_live_..." className="w-full bg-background border border-border rounded-lg p-3 text-sm outline-none" />
                </div>
                <div className="border-t border-border pt-5 space-y-4">
                  <label className="block text-xs font-bold text-muted-foreground uppercase">Twilio Configuration</label>
                  <input name="tw_sid" defaultValue={getIntegration('twilio').meta_data?.sid || ''} placeholder="Account SID" className="w-full bg-background border border-border rounded-lg p-3 text-sm outline-none" />
                  <input name="tw_key" defaultValue={getIntegration('twilio').api_key} type="password" placeholder="Auth Token" className="w-full bg-background border border-border rounded-lg p-3 text-sm outline-none" />
                  <input name="tw_phone" defaultValue={getIntegration('twilio').meta_data?.phone || ''} placeholder="Twilio Phone (+1...)" className="w-full bg-background border border-border rounded-lg p-3 text-sm outline-none" />
                </div>
                <div className="border-t border-border pt-5 space-y-4">
                  <label className="block text-xs font-bold text-muted-foreground uppercase">Cal.com Configuration</label>
                  <input name="cal_key" defaultValue={getIntegration('calcom').api_key} type="password" placeholder="Cal.com API Key (cal_live_...)" className="w-full bg-background border border-border rounded-lg p-3 text-sm outline-none" />
                  <input name="cal_event" defaultValue={getIntegration('calcom').meta_data?.eventId || ''} placeholder="Event Type ID (e.g. 123456)" className="w-full bg-background border border-border rounded-lg p-3 text-sm outline-none" />
                </div>
                <div className="flex justify-end"><button id="save-cred-btn" type="submit" className="bg-primary text-white font-semibold px-6 py-2.5 rounded-lg text-sm">Store Credentials</button></div>
              </form>
            </div>
          </div>
        )}

        {/* ── CALL LOGS ── */}
        {activePage === 'logs' && (
          <div className="space-y-6 fade-in max-w-5xl mx-auto">
            <div className="flex justify-between items-start">
              <h2 className="text-2xl font-bold">Call Logs</h2>
              <button onClick={() => fetch(`${API_BASE}/api/calls`).then(r=>r.json()).then(d=>{if(d.success)setCallLogs(d.calls)})} className="flex items-center gap-2 text-xs border border-border px-3 py-1.5 rounded-lg hover:text-primary transition"><RefreshCw size={11}/> Refresh</button>
            </div>
            <div className="bg-card border border-border rounded-xl shadow-xl">
              <table className="w-full text-left text-sm">
                <thead><tr className="border-b border-border"><th className="py-3 px-4 text-xs font-medium text-muted-foreground">Number</th><th className="py-3 px-4 text-xs font-medium text-muted-foreground">Direction</th><th className="py-3 px-4 text-xs font-medium text-muted-foreground">Duration</th><th className="py-3 px-4 text-xs font-medium text-muted-foreground">AI Summary</th><th className="py-3 px-4 text-xs font-medium text-muted-foreground">Status</th></tr></thead>
                <tbody>
                  {callLogs.map((c, i) => (
                    <tr key={i} className="border-b border-border/40 hover:bg-white/5 transition">
                      <td className="py-3 px-4 font-mono text-primary text-xs">{c.direction === 'inbound' ? c.from_phone : c.to_phone}</td>
                      <td className="py-3 px-4 capitalize text-sm">{c.direction}</td>
                      <td className="py-3 px-4 text-xs">{c.duration_seconds ? `${c.duration_seconds}s` : '—'}</td>
                      <td className="py-3 px-4 text-xs text-muted-foreground max-w-xs truncate">{c.ai_summary || '—'}</td>
                      <td className="py-3 px-4"><span className="bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full text-[10px] uppercase">{c.status}</span></td>
                    </tr>
                  ))}
                  {callLogs.length === 0 && <tr><td colSpan="5" className="text-center py-10 text-muted-foreground text-xs">No calls logged yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── CRM CONTACTS ── */}
        {activePage === 'crm' && (
          <div className="space-y-6 fade-in max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold">CRM Contacts</h2>
            <div className="bg-card border border-border rounded-xl p-6 shadow-xl">
              <form className="mb-6 grid grid-cols-5 gap-3" onSubmit={async (e) => {
                e.preventDefault(); const btn = e.target.querySelector('button'); btn.innerText = '...';
                try {
                  const res = await fetch(`${API_BASE}/api/contacts`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: e.target.cname.value, phone_number: e.target.cphone.value, email: e.target.cemail.value, notes: e.target.cnotes.value }) });
                  if (res.ok) { const d = await res.json(); setContacts([d.contact, ...contacts]); e.target.reset(); }
                } catch(e) {}
                btn.innerText = 'Add';
              }}>
                <input name="cname" placeholder="Name" required className="bg-background border border-border p-2.5 rounded-lg text-sm outline-none"/>
                <input name="cphone" placeholder="Phone" required className="bg-background border border-border p-2.5 rounded-lg text-sm outline-none"/>
                <input name="cemail" placeholder="Email" className="bg-background border border-border p-2.5 rounded-lg text-sm outline-none"/>
                <input name="cnotes" placeholder="Notes" className="bg-background border border-border p-2.5 rounded-lg text-sm outline-none"/>
                <button type="submit" className="bg-primary text-white rounded-lg text-sm font-semibold">Add</button>
              </form>
              <table className="w-full text-left text-sm">
                <thead><tr className="border-b border-border"><th className="pb-3 px-2 text-xs font-medium text-muted-foreground">Name</th><th className="pb-3 px-2 text-xs font-medium text-muted-foreground">Phone</th><th className="pb-3 px-2 text-xs font-medium text-muted-foreground">Email</th><th className="pb-3 px-2 text-xs font-medium text-muted-foreground">Notes</th><th className="pb-3 px-2 text-right text-xs font-medium text-muted-foreground">Delete</th></tr></thead>
                <tbody>
                  {contacts.map((c, i) => (
                    <tr key={i} className="border-b border-border/40 hover:bg-white/5 transition">
                      <td className="py-3 px-2 font-medium">{c.name}</td>
                      <td className="py-3 px-2 font-mono text-primary text-xs">{c.phone_number}</td>
                      <td className="py-3 px-2 text-xs text-muted-foreground">{c.email || '—'}</td>
                      <td className="py-3 px-2 text-xs text-muted-foreground max-w-[150px] truncate">{c.notes || '—'}</td>
                      <td className="py-3 px-2 text-right"><button onClick={async () => { await fetch(`${API_BASE}/api/contacts/${c.id}`, { method: 'DELETE' }); setContacts(contacts.filter(x => x.id !== c.id)); }} className="text-red-500 hover:text-red-400"><Trash2 size={15}/></button></td>
                    </tr>
                  ))}
                  {contacts.length === 0 && <tr><td colSpan="5" className="text-center py-8 text-muted-foreground text-xs">No contacts saved yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── OUTBOUND CALLS ── */}
        {activePage === 'outbound' && (
          <div className="space-y-6 fade-in max-w-2xl mx-auto mt-8">
            <div className="text-center"><h2 className="text-3xl font-bold">AI Outbound Dialer</h2><p className="text-sm text-muted-foreground mt-2">Command your AI to physically place a phone call</p></div>
            <div className="bg-card border border-border rounded-2xl p-8 shadow-xl">
              <form className="space-y-5" onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const res = await fetch(`${API_BASE}/api/calls/outbound`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ toPhone: e.target.phone.value, systemPrompt: e.target.prompt.value }) });
                  const d = await res.json();
                  if (d.success) alert(`Dialing ${e.target.phone.value}!`); else alert('Error: ' + (d.error || 'Unknown'));
                } catch { alert('Network Error'); }
              }}>
                <div><label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Phone Number</label><input name="phone" type="tel" placeholder="+1 (555) 123-4567" className="w-full bg-background border border-border rounded-lg p-3.5 text-sm outline-none" required /></div>
                <div><label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Custom Prompt (Optional)</label><textarea name="prompt" placeholder="You are calling to book an appointment..." className="w-full bg-background border border-border rounded-lg p-3.5 text-sm h-[120px] outline-none resize-none" /></div>
                <button type="submit" className="w-full bg-primary text-white font-semibold rounded-lg p-3.5 flex justify-center items-center gap-2"><PhoneOutgoing size={18}/>Dispatch AI Agent</button>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
