import { useState, useEffect } from 'react';
import { BarChart3, Calendar, Bot, Mic, Key, Phone, Users, PhoneOutgoing, Globe, Sparkles, Trash2, RefreshCw, CheckCircle, XCircle, Target, BookOpen, Megaphone, Bell, Sun, Moon } from 'lucide-react';
import { cn } from './lib/utils';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://saas-backend.xqnsvk.easypanel.host';

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [theme, setTheme] = useState('dark');
  const [toast, setToast] = useState(null);

  const [callLogs, setCallLogs] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [leads, setLeads] = useState([]);
  const [knowledgeBase, setKnowledgeBase] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [reports, setReports] = useState(null);
  
  const [agentSettings, setAgentSettings] = useState({ system_prompt: '', voice_preset: 'Mark', temperature: 0.3, greeting_message: '', personality: 'professional' });
  const [integrations, setIntegrations] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [calendarModal, setCalendarModal] = useState(null);
  const [viewSummaryModal, setViewSummaryModal] = useState(null);
  const [manualLeadModal, setManualLeadModal] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchAll = () => {
    fetch(`${API_BASE}/api/calls`).then(r => r.json()).then(d => { if (d.success) setCallLogs(d.calls); }).catch(() => {});
    fetch(`${API_BASE}/api/contacts`).then(r => r.json()).then(d => { if (d?.success) setContacts(d.contacts); }).catch(() => {});
    fetch(`${API_BASE}/api/leads`).then(r => r.json()).then(d => { if (d?.success) setLeads(d.leads); }).catch(() => {});
    fetch(`${API_BASE}/api/knowledge_base`).then(r => r.json()).then(d => { if (d?.success) setKnowledgeBase(d.docs); }).catch(() => {});
    fetch(`${API_BASE}/api/campaigns`).then(r => r.json()).then(d => { if (d?.success) setCampaigns(d.campaigns); }).catch(() => {});
    fetch(`${API_BASE}/api/agent`).then(r => r.json()).then(d => { if (d.success && d.agent) setAgentSettings(d.agent); }).catch(() => {});
    fetch(`${API_BASE}/api/integrations`).then(r => r.json()).then(d => { if (d.success) setIntegrations(d.integrations || []); }).catch(() => {});
    fetch(`${API_BASE}/api/appointments`).then(r => r.json()).then(d => { if (d.success) setAppointments(d.appointments || []); }).catch(() => {});
    fetch(`${API_BASE}/api/reports`).then(r => r.json()).then(d => { if (d.success) setReports(d.metrics); }).catch(() => {});
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
    { id: 'reports', label: 'Reports', icon: Target },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { section: 'Configuration' },
    { id: 'agent', label: 'Inbound Agent', icon: Bot },
    { id: 'knowledge_base', label: 'Knowledge Base', icon: BookOpen },
    { id: 'credentials', label: 'API Credentials', icon: Key },
    { section: 'Data' },
    { id: 'logs', label: 'Call Logs', icon: Phone },
    { id: 'leads', label: 'Lead CRM', icon: Target },
    { section: 'Calling' },
    { id: 'campaigns', label: 'Outbound Campaigns', icon: Megaphone },
  ];

  const { firstDay, daysInMonth } = getDaysInMonth(calendarDate);
  const today = new Date();

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);

  return (
    <div className={`flex h-screen bg-background text-foreground font-sans overflow-hidden ${theme}`}>
      
      {/* Global Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 fade-in">
          <div className={cn("px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border", 
            toast.type === 'error' ? "bg-red-500/10 border-red-500/20 text-red-500" : "bg-green-500/10 border-green-500/20 text-green-500")}>
            {toast.type === 'error' ? <XCircle size={18} /> : <CheckCircle size={18} />}
            <span className="text-sm font-semibold">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-[240px] min-w-[240px] bg-sidebar border-r border-border flex flex-col py-6 relative z-10">
        <div className="flex items-center justify-between px-5 pb-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                <path d="M8 12c0-2.21 1.79-4 4-4s4 1.79 4 4" />
                <circle cx="12" cy="15" r="2" fill="currentColor" />
              </svg>
            </div>
            <div>
              <h1 className="font-bold text-sm leading-tight">Azlon AI</h1>
              <p className="text-[10px] text-muted-foreground">Voice SaaS</p>
            </div>
          </div>
          {/* Theme Toggle */}
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="text-muted-foreground hover:text-foreground">
             {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
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

        {/* ── REPORTS ── */}
        {activePage === 'reports' && (
          <div className="space-y-6 fade-in">
             <div className="flex justify-between items-start">
               <div>
                 <h2 className="text-2xl font-bold">Analytics & Reports</h2>
                 <p className="text-sm text-muted-foreground mt-1">Live business metrics and conversions.</p>
               </div>
             </div>
             {reports ? (
               <div className="grid grid-cols-3 gap-6">
                 <div className="bg-card border border-border rounded-xl p-5 shadow">
                   <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Total Calls</div>
                   <div className="text-4xl font-bold mt-3">{reports.totalCalls}</div>
                   <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                     <span className="bg-white/5 px-2 py-1 rounded">Inbound: {reports.inboundCalls}</span>
                     <span className="bg-white/5 px-2 py-1 rounded">Outbound: {reports.outboundCalls}</span>
                   </div>
                 </div>
                 <div className="bg-card border border-border rounded-xl p-5 shadow">
                   <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Call Duration</div>
                   <div className="text-4xl font-bold mt-3">{reports.totalMinutes} <span className="text-lg text-muted-foreground font-medium">mins</span></div>
                 </div>
                 <div className="bg-card border border-border rounded-xl p-5 shadow relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-4 opacity-10"><Target size={60} /></div>
                   <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold relative z-10">AI Bookings</div>
                   <div className="text-4xl font-bold mt-3 text-primary relative z-10">{reports.bookedAppointments}</div>
                 </div>
                 <div className="col-span-3 bg-card border border-border rounded-xl p-6 shadow">
                   <h3 className="font-bold text-sm tracking-wide">Call Sentiment Analysis</h3>
                   <div className="flex w-full h-8 rounded-lg overflow-hidden shrink-0 mt-6">
                     <div style={{width: `${reports.totalCalls ? (reports.sentiment.positive/reports.totalCalls)*100 : 0}%`}} className="bg-green-500 h-full flex items-center justify-center text-[10px] font-bold text-white transition-all">{reports.sentiment.positive > 0 && reports.sentiment.positive}</div>
                     <div style={{width: `${reports.totalCalls ? (reports.sentiment.neutral/reports.totalCalls)*100 : 100}%`}} className="bg-muted h-full flex items-center justify-center text-[10px] font-bold text-white transition-all">{reports.sentiment.neutral > 0 && reports.sentiment.neutral}</div>
                     <div style={{width: `${reports.totalCalls ? (reports.sentiment.negative/reports.totalCalls)*100 : 0}%`}} className="bg-red-500 h-full flex items-center justify-center text-[10px] font-bold text-white transition-all">{reports.sentiment.negative > 0 && reports.sentiment.negative}</div>
                   </div>
                   <div className="flex gap-4 mt-4 text-[11px] text-muted-foreground justify-center font-medium">
                     <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>Positive</span>
                     <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-muted"></span>Neutral</span>
                     <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>Negative</span>
                   </div>
                 </div>
               </div>
             ) : (
               <div className="text-center py-20 text-muted-foreground text-sm flex flex-col items-center gap-3">
                 <RefreshCw className="animate-spin text-primary" size={24} /> Loading reports...
               </div>
             )}
          </div>
        )}

        {/* ── CALENDAR ── */}
        {activePage === 'calendar' && (
          <div className="space-y-6 fade-in">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold">Internal AI Calendar</h2>
                <p className="text-sm text-muted-foreground mt-1">Live view of all AI-booked appointments</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => fetchSlotsForDate(calendarDate)} className="flex items-center gap-2 text-xs border border-border px-3 py-1.5 rounded-lg hover:text-primary transition bg-card shadow-sm">
                  <RefreshCw size={12} /> Check Free Slots
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
                    <div className="flex gap-2">
                      <button onClick={async () => {
                         const dStr = calendarDate.toISOString().split('T')[0];
                         const currArr = agentSettings?.non_working_dates || [];
                         const isHoliday = currArr.includes(dStr);
                         const nextArr = isHoliday ? currArr.filter(x => x !== dStr) : [...currArr, dStr];
                         const updatedSettings = {...agentSettings, non_working_dates: nextArr};
                         setAgentSettings(updatedSettings);
                         await fetch(`${API_BASE}/api/agent`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(updatedSettings) });
                      }} className={cn("text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold border transition-colors", (agentSettings?.non_working_dates || []).includes(calendarDate.toISOString().split('T')[0]) ? "bg-red-500/20 text-red-500 border-red-500/20" : "bg-white/5 border-border hover:bg-white/10 text-muted-foreground")}>
                        {(agentSettings?.non_working_dates || []).includes(calendarDate.toISOString().split('T')[0]) ? "Holiday" : "Mark Holiday"}
                      </button>
                      <button onClick={() => setCalendarModal({ date: calendarDate })} className="text-[9px] bg-primary text-white border border-primary px-2 py-0.5 rounded-full uppercase tracking-wider font-bold hover:bg-primary/90 transition-colors shadow shadow-primary/20">+ Book</button>
                    </div>
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

                {/* Business Hours UI */}
                <div className="bg-card border border-border rounded-xl p-5 shadow-xl">
                  <h3 className="font-semibold text-sm mb-4 border-b border-border pb-3">Business hours</h3>
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">From</label>
                        <input type="time" value={agentSettings.open_time || '09:00'} onChange={e => setAgentSettings({...agentSettings, open_time: e.target.value})} className="w-full bg-background border border-border rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Until</label>
                        <input type="time" value={agentSettings.close_time || '18:00'} onChange={e => setAgentSettings({...agentSettings, close_time: e.target.value})} className="w-full bg-background border border-border rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-2">Active Days</label>
                      <div className="flex flex-wrap gap-2">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                          const isActive = Array.isArray(agentSettings.working_days) ? agentSettings.working_days.includes(day) : ['Mon','Tue','Wed','Thu','Fri'].includes(day);
                          return (
                            <button key={day} onClick={() => {
                              const curr = Array.isArray(agentSettings.working_days) ? agentSettings.working_days : ['Mon','Tue','Wed','Thu','Fri'];
                              const next = isActive ? curr.filter(d => d !== day) : [...curr, day];
                              setAgentSettings({...agentSettings, working_days: next});
                            }} className={cn("px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all", isActive ? "bg-primary text-white shadow-md shadow-primary/20" : "bg-white/5 text-muted-foreground hover:bg-white/10 border border-border")}>{day}</button>
                          );
                        })}
                      </div>
                    </div>
                    <button onClick={async (e) => {
                       const btn = e.target;
                       btn.innerText = 'Saving...';
                       try {
                         await fetch(`${API_BASE}/api/agent`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(agentSettings) });
                         btn.innerText = 'Saved!';
                         setTimeout(() => btn.innerText = 'Save Settings', 2000);
                       } catch(err) {} 
                    }} className="w-full bg-primary text-white text-xs font-semibold py-2 rounded-lg mt-2 shadow flex items-center justify-center">Save Settings</button>
                  </div>
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

        {/* ── INBOUND AGENT ── */}
        {activePage === 'agent' && (
          <div className="space-y-6 fade-in max-w-4xl mx-auto">
            <div><h2 className="text-2xl font-bold">Inbound Agent</h2><p className="text-sm text-muted-foreground mt-1">Configure your main AI voice agent that handles inbound calls</p></div>
            <div className="bg-card border border-border rounded-xl p-6 shadow-xl">
              <form onSubmit={async (e) => {
                e.preventDefault();
                const btn = document.getElementById('save-agent-btn'); btn.innerText = 'Saving...';
                try {
                  const payload = {
                    system_prompt: e.target.prompt.value,
                    greeting_message: e.target.greeting.value,
                    personality: e.target.personality.value,
                    voice_preset: e.target.voice.value,
                    temperature: parseFloat(e.target.temp.value)
                  };
                  const res = await fetch(`${API_BASE}/api/agent`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                  btn.innerText = 'Saved!';
                  showToast('Agent settings updated and live!', 'success');
                  setTimeout(() => btn.innerText = 'Save Configuration', 2000);
                } catch(err) {
                  btn.innerText = 'Save Configuration';
                  showToast('Save failed: ' + err.message, 'error');
                }
              }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Agent Greeting Message</label>
                    <input name="greeting" defaultValue={agentSettings.greeting_message} placeholder="Hello, thanks for calling! How can I help you today?" className="w-full bg-background border border-border rounded-lg p-3 text-sm outline-none" required />
                    <p className="text-[10px] text-muted-foreground mt-1">The first thing the AI will say when answering.</p>
                  </div>
                  <div>
                     <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Personality & Tone</label>
                     <select name="personality" defaultValue={agentSettings.personality || 'professional'} className="w-full bg-background border border-border rounded-lg p-3 text-sm outline-none">
                       <option value="professional">Professional & Helpful Support</option>
                       <option value="warm">Warm & Empathetic</option>
                       <option value="sales">Aggressive Sales Closer</option>
                       <option value="casual">Friendly & Casual Buddy</option>
                       <option value="technical">Strictly Technical / Direct</option>
                     </select>
                  </div>
                </div>

                <h3 className="font-semibold text-sm mb-3 border-b border-border pb-3">Advanced System Instructions</h3>
                <p className="text-xs text-muted-foreground mb-3">Defines the specific guardrails and logic of the agent. (Do not put Knowledge Base text here, use the Knowledge Base tab instead).</p>
                <textarea name="prompt" defaultValue={agentSettings.system_prompt} className="w-full bg-background border border-border rounded-lg p-4 font-mono text-[13px] outline-none resize-none h-[150px] mb-6" placeholder="You are the smart AI agent..." required />
                
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Voice Model</label>
                    <select name="voice" defaultValue={agentSettings.voice_preset} className="w-full bg-background border border-border rounded-lg p-3 text-sm outline-none">
                      <option value="Mark">🇺🇸 American Male (Standard)</option>
                      <option value="Tanya">🇺🇸 American Female (Friendly)</option>
                      <option value="Adam">🇬🇧 British Male (Formal)</option>
                      <option value="Emily">🇬🇧 British Female (Soft)</option>
                      <option value="Priya">🇮🇳 Indian Female (English)</option>
                      <option value="Rahul">🇮🇳 Indian Male (English)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Creativity (Temp)</label>
                    <input name="temp" type="number" step="0.1" max="1" min="0" defaultValue={agentSettings.temperature} className="w-full bg-background border border-border rounded-lg p-3 text-sm outline-none" />
                  </div>
                </div>
                <div className="mt-8 flex justify-end pt-4 border-t border-border">
                  <button id="save-agent-btn" type="submit" className="bg-primary hover:bg-primary/90 text-white font-semibold px-8 py-3 rounded-lg text-sm shadow-lg shadow-primary/20 transition">Save Configuration</button>
                </div>
              </form>
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

        {/* ── CALL LOGS (Redesigned) ── */}
        {activePage === 'logs' && (
          <div className="space-y-6 fade-in max-w-[1400px] mx-auto w-full">
            <div className="flex justify-between items-start">
              <h2 className="text-2xl font-bold">Call Logs & Telemetry</h2>
              <button onClick={() => fetch(`${API_BASE}/api/calls`).then(r=>r.json()).then(d=>{if(d.success)setCallLogs(d.calls)})} className="flex items-center gap-2 text-xs border border-border px-3 py-1.5 rounded-lg hover:text-primary transition"><RefreshCw size={11}/> Refresh</button>
            </div>
            <div className="bg-card border border-border rounded-xl shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-border bg-sidebar/50">
                      <th className="py-4 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date & Time</th>
                      <th className="py-4 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Caller Name</th>
                      <th className="py-4 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Number</th>
                      <th className="py-4 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Direction</th>
                      <th className="py-4 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Duration</th>
                      <th className="py-4 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">Summary</th>
                      <th className="py-4 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">Sentiment</th>
                      <th className="py-4 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {callLogs.map((c, i) => (
                      <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-4 px-5 text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                        <td className="py-4 px-5 text-xs font-medium">{c.caller_name || 'Unknown'}</td>
                        <td className="py-4 px-5 font-mono text-primary text-xs">{c.direction === 'inbound' ? c.from_phone : c.to_phone}</td>
                        <td className="py-4 px-5 capitalize text-[11px] tracking-wide text-muted-foreground">{c.direction}</td>
                        <td className="py-4 px-5 text-xs font-mono">{c.duration_seconds ? `${c.duration_seconds}s` : '—'}</td>
                        <td className="py-4 px-5 text-center">
                          <button onClick={() => setViewSummaryModal(c)} className="bg-white/5 hover:bg-white/10 text-xs px-3 py-1.5 rounded-full border border-border transition-colors">View Data</button>
                        </td>
                        <td className="py-4 px-5">
                           {c.sentiment === 'Positive' ? <span className="bg-green-500/10 text-green-400 px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider">Positive</span> : 
                            c.sentiment === 'Negative' ? <span className="bg-red-500/10 text-red-400 px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider">Negative</span> :
                            <span className="bg-gray-500/10 text-gray-400 px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider">{c.sentiment || 'Neutral'}</span>}
                        </td>
                        <td className="py-4 px-5">
                          <span className={cn("px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider",
                            c.call_status === 'Booked' ? "bg-blue-500/10 text-blue-400" :
                            c.call_status === 'Missed' ? "bg-red-500/10 text-red-500" :
                            c.call_status === 'Follow Up' ? "bg-yellow-500/10 text-yellow-500" :
                            c.call_status === 'Resolved' ? "bg-green-500/10 text-green-500" :
                            "bg-primary/10 text-primary")}>
                            {c.call_status || c.status || 'Completed'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {callLogs.length === 0 && <tr><td colSpan="8" className="text-center py-12 text-muted-foreground text-xs">No calls logged yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── CRM CONTACTS (Existing basic contacts) ── */}
        {activePage === 'crm' && (
           <div className="space-y-6 fade-in max-w-4xl mx-auto">
             <h2 className="text-2xl font-bold">Standard Contacts</h2>
             <div className="bg-card border border-border rounded-xl p-6 shadow-xl">
               {/* Hidden for brevity, just keeping table alive */}
               <div className="text-sm text-muted-foreground mb-4">Please use the new "Lead CRM" sidebar for the upgraded experience.</div>
             </div>
           </div>
        )}

        {/* ── LEAD CRM ── */}
        {activePage === 'leads' && (
          <div className="space-y-6 fade-in max-w-6xl mx-auto">
            <div className="flex justify-between">
              <div><h2 className="text-2xl font-bold">Lead Management</h2><p className="text-sm text-muted-foreground mt-1">AI-enriched CRM specifically built for real estate tracking</p></div>
            </div>
            
            <div className="grid grid-cols-4 gap-4 mb-6">
              {[ {l: 'Hot Leads', v: leads.filter(x=>x.segment==='Hot').length, c: 'text-red-500'}, {l: 'Warm Pipelines', v: leads.filter(x=>x.segment==='Warm').length, c: 'text-orange-400'}, {l: 'Qualified', v: leads.filter(x=>x.segment==='Qualified').length, c: 'text-primary'}, {l: 'Cold Outreach', v: leads.filter(x=>x.segment==='Cold').length, c: 'text-blue-400'} ].map((m,i)=> (
                <div key={i} className="bg-card border border-border rounded-xl p-5 shadow flex flex-col items-center justify-center">
                  <div className={`text-3xl font-bold ${m.c}`}>{m.v}</div>
                  <div className="text-xs uppercase font-medium mt-1 text-muted-foreground tracking-wider">{m.l}</div>
                </div>
              ))}
            </div>

            <div className="bg-card border border-border rounded-xl shadow-xl overflow-hidden">
              <div className="p-4 border-b border-border bg-sidebar/30 flex justify-between items-center">
                 <h3 className="font-semibold text-sm">Lead Database</h3>
                 <button className="bg-primary text-white px-3 py-1.5 rounded text-xs font-semibold" onClick={()=>showToast('Wait for AI to qualify!','success')}>+ Manual Lead</button>
              </div>
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead><tr className="border-b border-border"><th className="py-3 px-4 text-xs font-medium text-muted-foreground">Name</th><th className="py-3 px-4 text-xs font-medium text-muted-foreground">Phone</th><th className="py-3 px-4 text-xs font-medium text-muted-foreground">AI Context</th><th className="py-3 px-4 text-xs font-medium text-muted-foreground">Segment</th></tr></thead>
                <tbody>
                  {leads.map((l, i) => (
                    <tr key={i} className="border-b border-border/40 hover:bg-white/5 transition">
                      <td className="py-3 px-4 font-medium">{l.name}</td>
                      <td className="py-3 px-4 font-mono text-primary text-xs">{l.phone}</td>
                      <td className="py-3 px-4 text-xs text-muted-foreground max-w-[200px] truncate">{l.ai_context || '—'}</td>
                      <td className="py-3 px-4"><span className="bg-primary/20 text-primary px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider">{l.segment}</span></td>
                    </tr>
                  ))}
                  {leads.length === 0 && <tr><td colSpan="4" className="text-center py-8 text-muted-foreground text-xs">No leads recorded. Complete an AI call first!</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── KNOWLEDGE BASE ── */}
        {activePage === 'knowledge_base' && (
          <div className="space-y-6 fade-in max-w-4xl mx-auto">
            <div><h2 className="text-2xl font-bold">Knowledge Base & RAG</h2><p className="text-sm text-muted-foreground mt-1">Upload context for your AI Agent so it learns facts, pricing, and FAQs</p></div>
            <div className="bg-card border border-border rounded-xl p-6 shadow-xl">
              <form onSubmit={async (e) => {
                e.preventDefault();
                const btn = e.target.querySelector('button'); btn.innerText = 'Uploading...';
                try {
                  const res = await fetch(`${API_BASE}/api/knowledge_base`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: e.target.title.value, content: e.target.content.value }) });
                  const d = await res.json();
                  if(d.success) {
                    setKnowledgeBase([d.doc, ...knowledgeBase]);
                    showToast('Document securely uploaded to database.', 'success');
                    e.target.reset();
                  }
                } catch(e) { }
                btn.innerText = 'Upload Document';
              }}>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Document Title</label>
                <input name="title" className="w-full bg-background border border-border p-3 rounded-lg text-sm mb-4 outline-none" placeholder="e.g. Real Estate Pricing 2026" required/>
                
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Pasted Knowledge Content (RAG)</label>
                <textarea name="content" className="w-full bg-background border border-border p-3 rounded-lg text-sm h-[150px] mb-4 outline-none resize-none font-mono text-[12px]" placeholder="Type or paste text directly here to bypass PDF conversion..." required/>
                
                <div className="flex justify-end"><button type="submit" className="bg-primary text-white font-semibold rounded-lg px-6 py-2.5 text-sm">Upload Document</button></div>
              </form>
            </div>
            
            <div className="space-y-3">
              <h3 className="font-semibold text-sm px-1">Active Documents ({knowledgeBase.length})</h3>
              {knowledgeBase.map((k, i) => (
                <div key={i} className="flex justify-between items-center bg-card border border-border p-4 rounded-xl shadow-sm">
                  <div>
                    <h4 className="font-medium text-sm text-primary flex items-center gap-2"><CheckCircle size={14} className="text-green-500" /> {k.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1 max-w-[500px] truncate">{k.content}</p>
                  </div>
                  <button onClick={async () => {
                     await fetch(`${API_BASE}/api/knowledge_base/${k.id}`, { method: 'DELETE' });
                     setKnowledgeBase(knowledgeBase.filter(x => x.id !== k.id));
                     showToast('Knowledge destroyed.', 'success');
                  }} className="text-red-500 bg-red-500/10 p-2 rounded-lg hover:bg-red-500/20"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── OUTBOUND CAMPAIGNS ── */}
        {activePage === 'campaigns' && (
          <div className="space-y-6 fade-in max-w-4xl mx-auto">
            <div><h2 className="text-2xl font-bold">Outbound Voice Campaigns</h2><p className="text-sm text-muted-foreground mt-1">Upload a CSV list to automatically dial contacts sequentially</p></div>
            <div className="bg-card border border-border rounded-xl p-6 shadow-xl space-y-4">
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Campaign Setup</label>
              
              <div className="grid grid-cols-2 gap-4">
                <input name="campaign_name" placeholder="Campaign Name (e.g. Past Clients Follow-up)" className="w-full bg-background border border-border p-3 rounded-lg text-sm outline-none" required />
                <select name="campaign_voice" className="w-full bg-background border border-border p-3 rounded-lg text-sm outline-none">
                  <option value="Mark">🇺🇸 American Male (Standard)</option>
                  <option value="Tanya">🇺🇸 American Female (Friendly)</option>
                  <option value="Adam">🇬🇧 British Male (Formal)</option>
                  <option value="Emily">🇬🇧 British Female (Soft)</option>
                  <option value="Priya">🇮🇳 Indian Female (English)</option>
                  <option value="Rahul">🇮🇳 Indian Male (English)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Primary Campaign Goal</label>
                <textarea id="campaign_goal" placeholder="What is the objective of this outbound call? e.g. 'Get them to book a viewing for next week.'" className="w-full bg-background border border-border p-3 rounded-lg text-sm outline-none h-20 resize-none"></textarea>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="border border-border rounded-xl p-6 flex flex-col justify-center gap-3 bg-sidebar/20">
                   <h4 className="font-semibold text-sm">Targeted Manual Dial</h4>
                   <p className="text-xs text-muted-foreground leading-relaxed">Call a single specific lead right now via Azlon AI.</p>
                   <input id="manual_dial_phone" placeholder="Enter Phone (+1...)" className="w-full bg-background border border-border p-3 rounded-lg text-sm outline-none focus:border-primary transition" />
                   <button onClick={async () => {
                     const num = document.getElementById('manual_dial_phone').value;
                     const voice = document.querySelector('select[name="campaign_voice"]').value;
                     const goal = document.getElementById('campaign_goal').value;
                     if(!num) { showToast('Enter a phone number','error'); return; }
                     try {
                        showToast('Dispatching manual call...', 'success');
                        await fetch(`${API_BASE}/api/calls/outbound`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ to_phone: num, voice, goal }) });
                        showToast('Call initiated successfully!', 'success');
                     } catch(e) { showToast('Call dispatch failed','error'); }
                   }} className="w-full bg-primary hover:bg-primary/90 text-white font-semibold rounded-lg p-2.5 text-sm shadow shadow-primary/20 mt-1 transition">Dial Target</button>
                </div>
                
                <div onClick={() => showToast('CSV Uploader backend is still indexing. Wait for next patch.', 'error')} className="border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-white/[0.02] transition">
                   <Globe size={32} className="text-muted-foreground mb-3" />
                   <h4 className="font-semibold text-sm">Upload CSV File</h4>
                   <p className="text-xs text-muted-foreground mt-1">Batch outbound calling.</p>
                   <div className="mt-4 bg-muted px-4 py-1.5 rounded-full text-xs font-semibold text-foreground">Bulk Connect</div>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <h3 className="font-semibold text-sm mb-4">Live Campaigns</h3>
              <div className="space-y-3">
                 {campaigns.map((c, i) => (
                    <div key={i} className="bg-card border border-border p-4 rounded-xl flex justify-between items-center">
                       <div><h4 className="font-medium">{c.name}</h4><p className="text-xs text-muted-foreground mt-0.5">Calls: {c.total_calls} | Configured by Azlon backend</p></div>
                       <span className="bg-green-500/10 text-green-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">{c.status}</span>
                    </div>
                 ))}
                 {campaigns.length === 0 && <div className="text-xs text-muted-foreground text-center py-6">No campaigns running.</div>}
              </div>
            </div>
          </div>
        )}

      {/* ── MODALS ── */}
      {viewSummaryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center fade-in p-4">
          <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-border flex justify-between items-center bg-sidebar/50 rounded-t-2xl">
              <div>
                <h3 className="font-bold text-lg">Call Summary & Transcript</h3>
                <p className="text-xs text-muted-foreground font-mono mt-1">{viewSummaryModal.from_phone || viewSummaryModal.to_phone}</p>
              </div>
              <button onClick={() => setViewSummaryModal(null)} className="text-muted-foreground hover:text-white bg-white/5 p-2 rounded-lg transition-colors"><XCircle size={20}/></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">AI Executed Summary</h4>
                <div className="bg-background rounded-xl p-5 border border-border text-sm leading-relaxed text-foreground whitespace-pre-wrap shadow-inner relative">
                  {viewSummaryModal.ai_summary || 'No summary was generated or the call failed.'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {calendarModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center fade-in p-4">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border flex flex-col">
            <div className="p-6 border-b border-border flex justify-between items-center bg-sidebar/50 rounded-t-2xl">
              <div>
                 <h3 className="font-bold text-lg">Manual Booking</h3>
                 <p className="text-xs text-muted-foreground font-mono mt-1">Date: {calendarModal.date.toLocaleDateString()}</p>
              </div>
              <button onClick={() => setCalendarModal(null)} className="text-muted-foreground hover:text-white bg-white/5 p-2 rounded-lg transition-colors"><XCircle size={20}/></button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const btn = e.target.querySelector('button[type=submit]');
              btn.innerText = 'Booking...';
              const dateStr = calendarModal.date.toISOString().split('T')[0];
              const timeStr = e.target.time.value;
              const start_time = `${dateStr}T${timeStr}:00.000Z`;
              try {
                await fetch(`${API_BASE}/api/tools/book`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ start_time, name: e.target.name.value, phone: e.target.phone.value })
                });
                alert('Saved physically to internal calendar!');
                setCalendarModal(null);
                fetch(`${API_BASE}/api/appointments`).then(r=>r.json()).then(d=>{if(d.success)setAppointments(d.appointments||[])});
              } catch(err) { alert('Failed to book.'); btn.innerText = 'Book Now'; }
            }} className="p-6 space-y-4">
               <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Time</label>
                  <input name="time" type="time" required className="w-full bg-background border border-border rounded-lg p-3 text-sm outline-none focus:border-primary transition-colors" />
               </div>
               <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Client Name</label>
                  <input name="name" required placeholder="John Doe" className="w-full bg-background border border-border rounded-lg p-3 text-sm outline-none focus:border-primary transition-colors" />
               </div>
               <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Phone Number</label>
                  <input name="phone" required placeholder="+1234567890" className="w-full bg-background border border-border rounded-lg p-3 text-sm outline-none focus:border-primary transition-colors" />
               </div>
               <button type="submit" className="w-full bg-primary text-white font-bold py-3 rounded-lg shadow-lg shadow-primary/20 hover:bg-primary/90 mt-4 transition-all">Record Booking Interally</button>
            </form>
          </div>
        </div>
      )}

      {manualLeadModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center fade-in p-4">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border flex flex-col">
            <div className="p-6 border-b border-border flex justify-between items-center bg-sidebar/50 rounded-t-2xl">
              <h3 className="font-bold text-lg">Add CRM Target</h3>
              <button onClick={() => setManualLeadModal(false)} className="text-muted-foreground hover:text-white bg-white/5 p-2 rounded-lg transition-colors"><XCircle size={20}/></button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                await fetch(`${API_BASE}/api/leads`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    name: e.target.name.value, 
                    phone: e.target.phone.value,
                    email: e.target.email.value,
                    segment: e.target.segment.value,
                    source: 'Manual Upload'
                  })
                });
                alert('Lead saved into database!');
                setManualLeadModal(false);
                fetch(`${API_BASE}/api/leads`).then(r=>r.json()).then(d=>{if(d.success)setLeads(d.leads||[])});
              } catch(err) { alert('Failed.'); }
            }} className="p-6 space-y-4">
               <div><label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Name</label><input name="name" required placeholder="Full Name" className="w-full bg-background border border-border rounded-lg p-3 text-sm outline-none focus:border-primary transition-colors" /></div>
               <div><label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Phone Number</label><input name="phone" required placeholder="+1..." className="w-full bg-background border border-border rounded-lg p-3 text-sm outline-none focus:border-primary transition-colors" /></div>
               <div><label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Email</label><input name="email" placeholder="client@company.com" className="w-full bg-background border border-border rounded-lg p-3 text-sm outline-none focus:border-primary transition-colors" /></div>
               <div><label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Segment/Tags</label><input name="segment" placeholder="VIP, Follow-up, Cold, Hot" className="w-full bg-background border border-border rounded-lg p-3 text-sm outline-none focus:border-primary transition-colors" /></div>
               <button type="submit" className="w-full bg-primary text-white font-bold py-3 rounded-lg shadow-lg shadow-primary/20 mt-4 transition-all hover:bg-primary/90">Save Manual Target</button>
            </form>
          </div>
        </div>
      )}
      </main>
    </div>
  );
}
