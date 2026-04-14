import React, { useState, useEffect, useRef } from 'react';
import { BarChart3, Calendar, Bot, Mic, Key, Phone, Users, PhoneOutgoing, Globe, Sparkles, Trash2, RefreshCw, CheckCircle, XCircle, Target, BookOpen, Megaphone, Bell, Sun, Moon, Wrench, TrendingUp, Clock, Activity, Edit2, Send, Filter, Download, ToggleLeft, ToggleRight, Link, FileText } from 'lucide-react';
import { cn } from './lib/utils';
import * as XLSX from 'xlsx';
import { 
  PieChart, Pie, Cell, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area 
} from 'recharts';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://saas-backend.xqnsvk.easypanel.host';

// Robust local date formatting (YYYY-MM-DD) to avoid timezone/browser discrepancies
const toYYYYMMDD = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [twilioConfig, setTwilioConfig] = useState({ sid: '', api_key: '', phone: '' });
  const [uvConfig, setUVConfig] = useState({ api_key: '' });
  const [resendConfig, setResendConfig] = useState({ api_key: '' });
  const [isSavingCreds, setIsSavingCreds] = useState(false);
  const [isSavingUV, setIsSavingUV] = useState(false);
  const [isSavingResend, setIsSavingResend] = useState(false);

  const fetchTwilioConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/integrations/twilio`);
      const data = await res.json();
      if (data.success && data.integration) setTwilioConfig(data.integration);
    } catch (e) { }
  };

  const fetchUVConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/integrations/ultravox`);
      const data = await res.json();
      if (data.success && data.integration) setUVConfig(data.integration);
    } catch (e) { }
  };

  const fetchResendConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/integrations/resend`);
      const data = await res.json();
      if (data.success && data.integration) setResendConfig(data.integration);
    } catch (e) { }
  };


  useEffect(() => {
    if (activePage === 'credentials') {
      fetchTwilioConfig();
      fetchUVConfig();
      fetchResendConfig();
    }
  }, [activePage]);

  const fetchWAStatus = async () => {
    setWaStatus(p => ({ ...p, loading: true, error: null }));
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/status`);
      const data = await res.json();
      setWaStatus({ loading: false, connected: data.connected, qrCode: data.qrCode || null, error: data.error || null });
    } catch (e) {
      setWaStatus({ loading: false, connected: false, qrCode: null, error: 'Backend unreachable' });
    }
  };

  const reconnectWA = async () => {
    setWaStatus(p => ({ ...p, loading: true, qrCode: null, error: null }));
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/connect`, { method: 'POST' });
      const data = await res.json();
      setWaStatus({ loading: false, connected: false, qrCode: data.qrCode || null, error: data.error || null });
    } catch (e) {
      setWaStatus({ loading: false, connected: false, qrCode: null, error: 'Failed to connect' });
    }
  };


  const saveTwilioConfig = async (e) => {
    e.preventDefault();
    setIsSavingCreds(true);
    try {
      const res = await fetch(`${API_BASE}/api/integrations/twilio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(twilioConfig)
      });
      const data = await res.json();
      if (data.success) {
        showToast('Twilio integration updated.', 'success');
        fetchTwilioConfig();
      } else { showToast(data.error || 'Failed.', 'error'); }
    } catch (e) { showToast('Update failed.', 'error'); }
    setIsSavingCreds(false);
  };

  const saveUVConfig = async (e) => {
    e.preventDefault();
    setIsSavingUV(true);
    try {
      const res = await fetch(`${API_BASE}/api/integrations/ultravox`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(uvConfig)
      });
      const data = await res.json();
      if (data.success) {
        showToast('Ultravox settings updated.', 'success');
        fetchUVConfig();
      } else { showToast(data.error || 'Failed.', 'error'); }
    } catch (e) { showToast('Update failed.', 'error'); }
    setIsSavingUV(false);
  };

  const saveResendConfig = async (e) => {
    e.preventDefault();
    setIsSavingResend(true);
    try {
      const res = await fetch(`${API_BASE}/api/integrations/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resendConfig)
      });
      const data = await res.json();
      if (data.success) {
        showToast('Resend email API saved.', 'success');
        fetchResendConfig();
      } else { showToast(data.error || 'Failed.', 'error'); }
    } catch (e) { showToast('Update failed.', 'error'); }
    setIsSavingResend(false);
  };
  const [theme, setTheme] = useState('light');
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
  const [editingAppt, setEditingAppt] = useState(null);
  const [viewSummaryModal, setViewSummaryModal] = useState(null);
  const [expandedSentiment, setExpandedSentiment] = useState({});
  const [expandedRecording, setExpandedRecording] = useState(null);
  const [manualLeadModal, setManualLeadModal] = useState(false);
  const [newLead, setNewLead] = useState({ name: '', phone: '', email: '', ai_context: '', segment: 'Warm' });
  const [campaignGoal, setCampaignGoal] = useState('');
  const [logSentimentFilter, setLogSentimentFilter] = useState('All');
  const [logDateFilter, setLogDateFilter] = useState({ from: '', to: '' });
  const [kbTab, setKbTab] = useState('text'); // 'text' | 'file' | 'url'
  const [corpusUrl, setCorpusUrl] = useState('');
  const [corpusFile, setCorpusFile] = useState(null);
  const [agentTools, setAgentTools] = useState({ hangUp: true, transferCall: false, queryCorpus: false });

  const saveManualLead = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newLead, source: 'Manual Entry' })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Lead successfully added to CRM!', 'success');
        setManualLeadModal(false);
        setNewLead({ name: '', phone: '', email: '', ai_context: '', segment: 'Warm' });
        fetchAll(); // Refresh all data
      }
    } catch (e) { showToast('Failed to save lead', 'error'); }
  };

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

  useEffect(() => { 
    fetchAll(); 
    // Auto-refresh every 30 seconds
    const autoRefresh = setInterval(() => fetchAll(), 30000);
    return () => clearInterval(autoRefresh);
  }, []);

  const [isDeleting, setIsDeleting] = useState(false);
  const [isFixing, setIsFixing] = useState(false); 
  
  const handleFixSentiment = async () => {
    setIsFixing(true);
    try {
      const resp = await fetch(`${API_BASE}/api/fix-sentiment`, { method: 'POST' });
      const data = await resp.json();
      if (data.success) {
        showToast(`Repaired ${data.fixed} calls!`);
        fetchAll();
      }
    } catch (err) {
      showToast("Repair failed.", "error");
    } finally {
      setIsFixing(false);
    }
  };

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
    // Local-safe date string (YYYY-MM-DD) avoids UTC day-shifting bug
    const dateStr = toYYYYMMDD(date); 
    setAvailableSlots([]);

    // PRE-CHECK: If it's a holiday, skip fetch and show closure message immediately
    if ((agentSettings?.non_working_dates || []).includes(dateStr)) {
      console.info(`[Calendar] Date ${dateStr} is mark as HOLIDAY. Masking slots.`);
      setAvailableSlots("Business is closed on this date (marked as holiday).");
      setLoadingSlots(false);
      return;
    }

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
        setAvailableSlots(data.available_slots || []); // Could be a string reason
      }
    } catch(e) { setAvailableSlots([]); }
    setLoadingSlots(false);
  };

  // Get appointments for selected date
  const appointmentsForDate = (date) => {
    const dateStr = date.toLocaleDateString('en-CA');
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
    { id: 'integrations_logs', label: 'Integrations', icon: Send },
    { section: 'Calling' },
    { id: 'recordings', label: 'Voice Recordings', icon: Mic },
    { id: 'campaigns', label: 'Outbound Campaigns', icon: Megaphone },
  ];

  const { firstDay, daysInMonth } = getDaysInMonth(calendarDate);
  const today = new Date();

  useEffect(() => {
    // FORCE reset to 'light' for this final calibration session to override cached dark settings
    if (theme === 'light') {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
  }, [theme]);

  // MOUNT RESET: Ensure we start clean in Light Mode
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (!saved) {
      setTheme('light');
      document.documentElement.classList.remove('dark');
    }
  }, []);

  return (
    <div className={`flex h-screen bg-background text-foreground font-sans overflow-hidden ${theme}`}>
      
      {/* Global Toast — Premium */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 slide-up">
          <div className={cn("px-5 py-3.5 rounded-2xl shadow-premium-lg flex items-center gap-3 border backdrop-blur-xl", 
            toast.type === 'error' ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400")}>
            {toast.type === 'error' ? <XCircle size={18} strokeWidth={2.5} /> : <CheckCircle size={18} strokeWidth={2.5} />}
            <span className="text-sm font-semibold tracking-tight">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Sidebar — Premium */}
      <aside className="w-[260px] min-w-[260px] bg-sidebar border-r border-border flex flex-col relative z-10">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center text-white shadow-glow">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                <path d="M8 12c0-2.21 1.79-4 4-4s4 1.79 4 4" />
                <circle cx="12" cy="15" r="2" fill="currentColor" />
              </svg>
            </div>
            <div>
              <h1 className="font-extrabold text-[15px] leading-tight tracking-tight">Azlon AI</h1>
              <p className="text-2xs text-muted-foreground font-medium tracking-wide">Voice Intelligence</p>
            </div>
          </div>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="text-muted-foreground hover:text-foreground p-2 hover:bg-white/5 rounded-lg transition-all">
             {theme === 'dark' ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          {navigation.map((item, idx) => {
            if (item.section) return <div key={idx} className="px-3 py-2.5 mt-3 first:mt-0 text-2xs font-bold text-muted-foreground/60 uppercase tracking-ultra">{item.section}</div>;
            const Icon = item.icon;
            return (
              <button key={item.id} onClick={() => setActivePage(item.id)}
                className={cn("nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all outline-none mb-0.5",
                  activePage === item.id ? "active text-primary font-semibold" : "text-muted-foreground hover:text-foreground")}>
                <Icon size={17} strokeWidth={activePage === item.id ? 2.5 : 1.8} className="transition-all" />{item.label}
              </button>
            );
          })}
        </nav>

        {/* Status Footer */}
        <div className="px-5 py-4 border-t border-border flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 status-dot" />
          <span className="text-xs text-muted-foreground font-medium">Agent Online</span>
          <span className="ml-auto text-2xs text-muted-foreground/40 font-mono">v2.0</span>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-background p-8">

        {/* ── DASHBOARD ── */}
        {activePage === 'dashboard' && (
          <div className="space-y-8 fade-in w-full">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight">Dashboard</h2>
                <p className="text-sm text-muted-foreground mt-1.5 font-medium">Real-time overview of your AI voice agent</p>
              </div>
              <button onClick={fetchAll} className="btn-premium flex items-center gap-2 text-xs text-muted-foreground hover:text-primary border border-border px-4 py-2 rounded-xl font-semibold bg-card">
                <RefreshCw size={13} strokeWidth={2.5} /> Refresh
              </button>
            </div>
            <div className="grid grid-cols-4 gap-5">
              {[
                { label: 'Total Calls', value: reports?.totalCalls || callLogs.length, sub: 'All time', color: 'from-violet-500/10 to-indigo-500/10', accent: 'text-violet-400' },
                { label: 'Appointments', value: reports?.bookedAppointments || appointments.length, sub: 'Booked by AI', color: 'from-emerald-500/10 to-teal-500/10', accent: 'text-emerald-400' },
                { label: 'Active Contacts', value: contacts.length, sub: 'In CRM', color: 'from-blue-500/10 to-cyan-500/10', accent: 'text-blue-400' },
                { label: 'Completed', value: reports?.hourlyVolume ? reports.hourlyVolume.reduce((acc, h) => acc + h.count, 0) : callLogs.filter(c => c.status === 'completed').length, sub: 'Finished calls', color: 'from-amber-500/10 to-orange-500/10', accent: 'text-amber-400' }
              ].map((stat, i) => (
                <div key={i} className={`stat-card bg-gradient-to-br ${stat.color} border border-border rounded-2xl p-6`}>
                  <div className="text-2xs font-bold text-muted-foreground uppercase tracking-ultra">{stat.label}</div>
                  <div className={`text-4xl font-black mt-3 tracking-tight ${stat.accent}`}>{stat.value}</div>
                  <div className="text-xs text-muted-foreground mt-2 font-medium">{stat.sub}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-5">
              {/* Win Chart: Call Outcomes */}
              <div className="bg-card border border-border rounded-2xl p-6 shadow-premium flex flex-col h-[350px]">
                <h3 className="font-bold text-sm mb-2 flex items-center gap-2"><Target size={14} className="text-primary" /> Call Outcomes</h3>
                <p className="text-2xs text-muted-foreground mb-4 uppercase tracking-wider font-bold">Conversion Breakdown</p>
                <div className="flex-1 w-full min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={reports?.outcomes || []}
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {(reports?.outcomes || []).map((entry, index) => {
                          const COLORS = {
                            'Booked': '#10b981', // Emerald
                            'Resolved': '#6366f1', // Indigo
                            'Follow Up': '#f59e0b', // Amber
                            'Missed': '#f43f5e', // Rose
                            'Standard Inquiry': '#3b82f6', // Blue
                            'No Connection': '#64748b' // Slate
                          };
                          return <Cell key={`cell-${index}`} fill={COLORS[entry.name] || '#8b5cf6'} stroke="none" />;
                        })}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '12px' }}
                        itemStyle={{ fontSize: '12px', color: '#f8fafc' }}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Peak Operations: Hourly Volume */}
              <div className="col-span-2 bg-card border border-border rounded-2xl p-6 shadow-premium flex flex-col h-[350px]">
                <h3 className="font-bold text-sm mb-2 flex items-center gap-2"><Clock size={14} className="text-primary" /> Peak Operations</h3>
                <p className="text-2xs text-muted-foreground mb-4 uppercase tracking-wider font-bold">Hourly Call Volume</p>
                <div className="flex-1 w-full min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={reports?.hourlyVolume || []}>
                      <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis 
                        dataKey="hour" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} 
                        tickFormatter={(value) => {
                          if (value === '12 AM' || value === '12 PM' || value === '11 PM') return value;
                          return value.replace(' AM', '').replace(' PM', '');
                        }}
                        interval={0}
                        padding={{ left: 10, right: 10 }}
                      />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '12px' }}
                        itemStyle={{ color: '#8b5cf6' }}
                      />
                      <Area type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Duration Trend: Last 10 Calls */}
              <div className="col-span-3 bg-card border border-border rounded-2xl p-6 shadow-premium flex flex-col h-[300px]">
                <h3 className="font-bold text-sm mb-2 flex items-center gap-2"><Activity size={14} className="text-primary" /> Call Engagement</h3>
                <p className="text-2xs text-muted-foreground mb-4 uppercase tracking-wider font-bold">Duration of Recent Sessions (Seconds)</p>
                <div className="flex-1 w-full min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reports?.recentDurations || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                      <Tooltip cursor={{ fill: '#ffffff05' }} contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '12px' }} />
                      <Bar dataKey="duration" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Keep existing mini-tables below */}
              <div className="bg-card border border-border rounded-2xl p-6 shadow-premium">
                <h3 className="font-bold text-sm mb-5 pb-3 border-b border-border flex items-center gap-2"><Phone size={14} strokeWidth={2.5} className="text-primary" /> Recent Calls</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead><tr className="border-b border-border"><th className="pb-3 text-muted-foreground font-semibold text-2xs uppercase tracking-ultra whitespace-nowrap">Number</th><th className="pb-3 text-muted-foreground font-semibold text-2xs uppercase tracking-ultra">Status</th><th className="pb-3 text-muted-foreground font-semibold text-2xs uppercase tracking-ultra">Date</th></tr></thead>
                    <tbody>
                      {callLogs.slice(0, 5).map((c, i) => (
                        <tr key={i} className="border-b border-border/30">
                          <td className="py-3 font-mono text-primary text-xs font-semibold">{c.direction === 'inbound' ? c.from_phone : c.to_phone}</td>
                          <td className="py-3"><span className="bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-lg text-2xs uppercase font-bold tracking-wide">{c.status}</span></td>
                          <td className="py-3 text-muted-foreground text-xs font-medium">{new Date(c.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="bg-card border border-border rounded-2xl p-6 shadow-premium">
                <h3 className="font-bold text-sm mb-5 pb-3 border-b border-border flex items-center gap-2"><Calendar size={14} strokeWidth={2.5} className="text-primary" /> Upcoming Appointments</h3>
              <div className="space-y-1">
                  {appointments
                    .filter(a => new Date(a.start_time) > new Date())
                    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
                    .slice(0, 5)
                    .map((a, i) => (
                    <div key={i} className="flex items-center justify-between py-3 border-b border-border/30 hover:bg-white/[0.02] transition-colors rounded-lg px-2 -mx-2">
                      <div>
                        <div className="text-sm font-semibold tracking-tight">{a.name}</div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">{a.phone}</div>
                      </div>
                      <div className="text-xs text-primary text-right font-semibold">{new Date(a.start_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</div>
                    </div>
                  ))}
                  {appointments.filter(a => new Date(a.start_time) > new Date()).length === 0 && <div className="text-center py-8 text-muted-foreground text-xs font-medium">No upcoming appointments</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── REPORTS ── */}
        {activePage === 'reports' && (
          <div className="space-y-8 fade-in w-full">
             <div>
               <h2 className="text-3xl font-extrabold tracking-tight">Analytics & Reports</h2>
               <p className="text-sm text-muted-foreground mt-1.5 font-medium">Live business metrics and conversions.</p>
             </div>
             {reports ? (
               <div className="grid grid-cols-3 gap-5">
                 <div className="stat-card bg-card border border-border rounded-2xl p-6 shadow-premium">
                   <div className="text-2xs text-muted-foreground uppercase tracking-ultra font-bold">Total Calls</div>
                   <div className="text-4xl font-black mt-3 tracking-tight">{reports.totalCalls}</div>
                   <div className="flex gap-3 mt-4 text-xs text-muted-foreground">
                     <span className="bg-violet-500/10 text-violet-400 px-3 py-1.5 rounded-lg font-semibold text-2xs">Inbound: {reports.inboundCalls}</span>
                     <span className="bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-lg font-semibold text-2xs">Outbound: {reports.outboundCalls}</span>
                   </div>
                 </div>
                 <div className="stat-card bg-card border border-border rounded-2xl p-6 shadow-premium">
                   <div className="text-2xs text-muted-foreground uppercase tracking-ultra font-bold">Call Duration</div>
                   <div className="text-4xl font-black mt-3 tracking-tight">{reports.totalMinutes} <span className="text-lg text-muted-foreground font-semibold">mins</span></div>
                 </div>
                 <div className="stat-card bg-gradient-to-br from-primary/5 to-purple-500/5 border border-border rounded-2xl p-6 shadow-premium relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-4 opacity-5"><Target size={80} strokeWidth={1} /></div>
                   <div className="text-2xs text-muted-foreground uppercase tracking-ultra font-bold relative z-10">AI Bookings</div>
                   <div className="text-4xl font-black mt-3 text-primary relative z-10 tracking-tight">{reports.bookedAppointments}</div>
                 </div>
                 <div className="col-span-3 bg-card border border-border rounded-2xl p-6 shadow-premium">
                   <h3 className="font-bold text-sm tracking-tight">Call Sentiment Analysis</h3>
                   <div className="flex w-full h-10 rounded-xl overflow-hidden shrink-0 mt-6">
                     <div style={{width: `${reports.totalCalls ? (reports.sentiment.positive/reports.totalCalls)*100 : 0}%`}} className="bg-emerald-500 h-full flex items-center justify-center text-2xs font-bold text-white transition-all">{reports.sentiment.positive > 0 && reports.sentiment.positive}</div>
                     <div style={{width: `${reports.totalCalls ? (reports.sentiment.neutral/reports.totalCalls)*100 : 100}%`}} className="bg-muted h-full flex items-center justify-center text-2xs font-bold text-muted-foreground transition-all">{reports.sentiment.neutral > 0 && reports.sentiment.neutral}</div>
                     <div style={{width: `${reports.totalCalls ? (reports.sentiment.negative/reports.totalCalls)*100 : 0}%`}} className="bg-red-500 h-full flex items-center justify-center text-2xs font-bold text-white transition-all">{reports.sentiment.negative > 0 && reports.sentiment.negative}</div>
                   </div>
                   <div className="flex gap-6 mt-5 text-xs text-muted-foreground justify-center font-semibold">
                     <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500"></span>Positive</span>
                     <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-muted"></span>Neutral</span>
                     <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500"></span>Negative</span>
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
                <h2 className="text-3xl font-extrabold tracking-tight">Internal AI Calendar</h2>
                <p className="text-sm text-muted-foreground mt-1.5 font-medium">Live view of all AI-booked appointments</p>
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
                {((availableSlots.length > 0 || loadingSlots) || (agentSettings?.non_working_dates || []).includes(toYYYYMMDD(calendarDate))) && (
                  <div className="mt-6 border-t border-border pt-4">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                      Free Slots — {calendarDate.toLocaleDateString()}
                    </h4>
                    {loadingSlots ? (
                      <div className="text-xs text-muted-foreground italic">Fetching available time slots...</div>
                    ) : (agentSettings?.non_working_dates || []).includes(toYYYYMMDD(calendarDate)) ? (
                      <div className="bg-amber-500/5 text-amber-500/60 border border-amber-500/10 p-3 rounded-lg text-xs font-medium italic">
                        Business is closed on this date (marked as holiday).
                      </div>
                    ) : Array.isArray(availableSlots) && availableSlots.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {availableSlots.map((slot, i) => (
                          <span key={i} className="bg-green-500/10 text-green-400 border border-green-500/20 px-3 py-1 rounded-full text-xs font-mono">
                            {new Date(slot).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-amber-500/5 text-amber-500/60 border border-amber-500/10 p-3 rounded-lg text-xs font-medium">
                        {typeof availableSlots === 'string' ? availableSlots : "No free slots available for this date."}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right Panel: Appointments for selected date + Manual Controls */}
              <div className="space-y-4">
                <div className="bg-card border border-border rounded-xl p-5 shadow-xl">
                  <div className="flex items-center justify-between mb-4 border-b border-border pb-3">
                    <h3 className="font-semibold text-sm">
                      {calendarDate.toLocaleDateString('default', { month: 'short', day: 'numeric' })}
                    </h3>
                    <div className="flex gap-2">
                      <button onClick={async () => {
                         const dStr = toYYYYMMDD(calendarDate);
                         setAgentSettings(prev => {
                           const currArr = prev.non_working_dates || [];
                           const isHoliday = currArr.includes(dStr);
                           const nextArr = isHoliday ? currArr.filter(x => x !== dStr) : [...currArr, dStr];
                           const updated = { ...prev, non_working_dates: nextArr };
                           console.info(`[Holiday Toggle] date: ${dStr} | action: ${isHoliday ? 'REMOVE' : 'ADD'} | nextArr:`, nextArr);
                           // Background sync
                           fetch(`${API_BASE}/api/agent`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(updated) });
                           return updated;
                         });
                      }} className={cn("text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold border transition-colors", (agentSettings?.non_working_dates || []).includes(toYYYYMMDD(calendarDate)) ? "bg-red-500/20 text-red-500 border-red-500/20" : "bg-white/5 border-border hover:bg-white/10 text-muted-foreground")}>
                        {(agentSettings?.non_working_dates || []).includes(toYYYYMMDD(calendarDate)) ? "Holiday" : "Mark Holiday"}
                      </button>
                      <button onClick={() => setCalendarModal({ date: calendarDate })} className="text-[9px] bg-primary text-white border border-primary px-2 py-0.5 rounded-full uppercase tracking-wider font-bold hover:bg-primary/90 transition-colors shadow shadow-primary/20">+ Book</button>
                    </div>
                  </div>
                  {appointmentsForDate(calendarDate).length === 0 ? (
                    <div className="text-center py-6 text-xs text-muted-foreground">No appointments on this day</div>
                  ) : (
                    <div className="space-y-3">
                      {appointmentsForDate(calendarDate).map((a, i) => (
                        <div key={i} className="group relative bg-background rounded-lg p-3 border border-border transition hover:border-primary/50 relative">
                           <div className="absolute top-2 right-2">
                             <button onClick={() => setEditingAppt(editingAppt === a.id ? null : a.id)} className="text-muted-foreground hover:text-primary p-1.5 rounded-lg transition hover:bg-white/10" title="Edit appointment">
                               <Edit2 size={13} strokeWidth={2} />
                             </button>
                             {editingAppt === a.id && (
                                <div className="absolute top-8 right-0 bg-card border border-border rounded-xl shadow-xl w-48 py-1 z-50 animate-in slide-in-from-top-2">
                                   <button onClick={() => {
                                      setEditingAppt(null);
                                      setCalendarModal({ date: new Date(a.start_time), mode: 'reschedule', rescheduleId: a.id, prefill: a });
                                   }} className="w-full text-left px-4 py-2 text-xs hover:bg-white/5 transition">Allocate new time</button>
                                   <button onClick={async () => {
                                      setEditingAppt(null);
                                      if(window.confirm('Mark this meeting as completed?')) {
                                        await fetch(`${API_BASE}/api/appointments/manual/${a.id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action: 'complete', status: 'completed' })});
                                        showToast('Meeting marked as completed!', 'success');
                                        fetchAll();
                                      }
                                   }} className="w-full text-left px-4 py-2 text-xs hover:bg-blue-500/10 text-blue-400 transition">✓ Meeting Over</button>
                                   <button onClick={async () => {
                                      setEditingAppt(null);
                                      if(window.confirm("Mark as completed and book follow-up?")) {
                                        await fetch(`${API_BASE}/api/appointments/manual/${a.id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action: 'complete'})});
                                        showToast('Marked complete!', 'success');
                                        fetchAll();
                                        setCalendarModal({ date: new Date(), prefill: a });
                                      }
                                   }} className="w-full text-left px-4 py-2 text-xs hover:bg-emerald-500/10 text-emerald-400 transition">Follow-up appointment</button>
                                   <button onClick={async () => {
                                      setEditingAppt(null);
                                      if(window.confirm("Are you sure you want to cancel this appointment?")) {
                                         await fetch(`${API_BASE}/api/appointments/manual/${a.id}`, { method: 'DELETE' });
                                         showToast('Appointment deleted', 'success');
                                         fetchAll();
                                      }
                                   }} className="w-full text-left px-4 py-2 text-xs hover:bg-red-500/10 text-red-500 transition">Delete appointment</button>
                                </div>
                             )}
                           </div>
                          <div className="font-semibold text-sm pr-8">{a.name}</div>
                          <div className="text-xs text-muted-foreground font-mono mt-0.5">{a.phone}</div>
                          <div className="flex items-center gap-2 mt-1.5">
                             <span className="text-xs text-primary font-medium tracking-tight">
                               {new Date(a.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                             </span>
                             {a.status === 'completed' && <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-sm uppercase tracking-widest font-bold">Done</span>}
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
                <button onClick={() => fetchAll()} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"><RefreshCw size={11}/> Sync Live</button>
              </div>
              <div className="p-4">
                <table className="w-full text-left text-sm">
                  <thead><tr className="border-b border-border"><th className="pb-3 px-2 text-xs font-medium text-muted-foreground">Name</th><th className="pb-3 px-2 text-xs font-medium text-muted-foreground">Phone</th><th className="pb-3 px-2 text-xs font-medium text-muted-foreground">Date & Time</th><th className="pb-3 px-2 text-xs font-medium text-muted-foreground">SMS Status</th><th className="pb-3 px-2 text-xs font-medium text-muted-foreground">WhatsApp Status</th><th className="pb-3 px-2 text-xs font-medium text-muted-foreground">Email Status</th><th className="pb-3 px-2 text-xs font-medium text-muted-foreground">Booking</th></tr></thead>
                  <tbody>
                    {appointments.map((a, i) => (
                      <tr key={i} className="border-b border-border/40 hover:bg-white/5 transition">
                        <td className="py-3 px-2 font-medium">{a.name}</td>
                        <td className="py-3 px-2 font-mono text-primary text-xs">{a.phone || '-'}</td>
                        <td className="py-3 px-2 text-xs">{new Date(a.start_time).toLocaleString()}</td>
                        <td className="py-3 px-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${
                            a.sms_status === 'Sent' ? 'bg-green-500/10 text-green-400' : 
                            a.sms_status === 'Failed' ? 'bg-red-500/10 text-red-400' : 
                            'bg-gray-500/10 text-gray-400'
                          }`}>
                            {a.sms_status || 'Pending'}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${
                            a.whatsapp_status === 'Sent' ? 'bg-green-500/10 text-green-400' : 
                            a.whatsapp_status === 'Failed' ? 'bg-red-500/10 text-red-400' : 
                            'bg-gray-500/10 text-gray-400'
                          }`}>
                            {a.whatsapp_status || 'Pending'}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${
                            a.email_status === 'Sent' ? 'bg-green-500/10 text-green-400' : 
                            a.email_status === 'Failed' ? 'bg-red-500/10 text-red-500' : 
                            'bg-gray-500/10 text-gray-400'
                          }`}>
                            {a.email_status || 'Pending'}
                          </span>
                        </td>
                        <td className="py-3 px-2"><span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[10px] uppercase font-bold">{a.status || 'confirmed'}</span></td>
                      </tr>
                    ))}
                    {appointments.length === 0 && <tr><td colSpan="6" className="text-center py-8 text-muted-foreground text-xs">No appointments booked by AI yet. Test by calling your Twilio number!</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── INBOUND AGENT ── */}
        {activePage === 'agent' && (
          <div className="space-y-8 fade-in w-full">
            <div><h2 className="text-3xl font-extrabold tracking-tight">Inbound Agent</h2><p className="text-sm text-muted-foreground mt-1.5 font-medium">Configure your main AI voice agent that handles inbound calls</p></div>
            <div className="bg-card border border-border rounded-2xl p-6 shadow-premium-lg">
              <form onSubmit={async (e) => {
                e.preventDefault();
                const btn = document.getElementById('save-agent-btn'); btn.innerText = 'Saving...';
                try {
                  const payload = {
                    system_prompt: e.target.prompt.value,
                    greeting_message: e.target.greeting.value,
                    personality: e.target.personality.value,
                    voice_preset: e.target.voice.value,
                    temperature: parseFloat(e.target.temp.value),
                    tools_config: {
                      hangUp: e.target.hangUp.checked,
                      transferCall: e.target.transferCall.checked,
                      queryCorpus: e.target.queryCorpus.checked
                    },
                    record_calls: e.target.record_calls.checked
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
                      <option value="Mark">🇺🇸 Mark (Standard Male)</option>
                      <option value="Alice">🇺🇸 Alice (Professional Female)</option>
                      <option value="Jessica">🇺🇸 Jessica (Warm Female)</option>
                      <option value="Kelsey">🇬🇧 Kelsey (Soft British Female)</option>
                      <option value="Priya">🇮🇳 Priya (Clear Indian Female)</option>
                      <option value="Lulu">🌍 Lulu (Casual Female)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Creativity (Temp)</label>
                    <input name="temp" type="number" step="0.1" max="1" min="0" defaultValue={agentSettings.temperature} className="w-full bg-background border border-border rounded-lg p-3 text-sm outline-none" />
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-border">
                  <h3 className="font-semibold text-sm mb-4">Built-in AI Capabilities (Tool Toggling)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { id: 'hangUp', label: 'Call Termination', desc: 'Allows AI to hang up' },
                      { id: 'transferCall', label: 'Human Transfer', desc: 'Allows handoff to staff' },
                      { id: 'queryCorpus', label: 'Knowledge Base Search', desc: 'RAG search on PDFs/Web' }
                    ].map(tool => (
                      <div key={tool.id} className="flex items-center justify-between p-4 bg-sidebar/30 border border-border rounded-xl">
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-wider">{tool.label}</div>
                          <div className="text-[10px] text-muted-foreground">{tool.desc}</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" name={tool.id} defaultChecked={agentSettings.tools_config?.[tool.id] ?? true} className="sr-only peer" />
                          <div className="w-9 h-5 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-center justify-between">
                    <div>
                       <div className="text-[11px] font-bold text-primary uppercase tracking-wider">Master Call Recording</div>
                       <div className="text-[10px] text-muted-foreground">Automatically record and store all calls in AWS S3</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" name="record_calls" defaultChecked={agentSettings.record_calls !== false} className="sr-only peer" />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>
                <div className="mt-8 flex justify-end pt-4 border-t border-border">
                  <button id="save-agent-btn" type="submit" className="bg-primary hover:bg-primary/90 text-white font-semibold px-8 py-3 rounded-lg text-sm shadow-lg shadow-primary/20 transition">Save Configuration</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── CALL LOGS (Redesigned) ── */}
        {activePage === 'logs' && (
          <div className="space-y-6 fade-in w-full">
            <div className="flex justify-between items-start">
              <h2 className="text-3xl font-extrabold tracking-tight">Call Logs & Telemetry</h2>
               <div className="flex items-center gap-3">
                 <div className="flex bg-card border border-border rounded-xl p-1 gap-1">
                   {['All', 'Interested', 'Not Interested', 'Follow-Up', 'Booked', 'Enquiry'].map(f => (
                     <button key={f} onClick={() => setLogSentimentFilter(f)} className={cn("px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition", logSentimentFilter === f ? "bg-primary text-white" : "text-muted-foreground hover:bg-white/5")}>{f}</button>
                   ))}
                 </div>
                 <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-1.5">
                    <Filter size={11} className="text-muted-foreground" />
                    <input type="date" value={logDateFilter.from} onChange={e => setLogDateFilter({...logDateFilter, from: e.target.value})} className="bg-transparent text-[11px] outline-none text-muted-foreground" title="From Date" />
                    <span className="text-muted-foreground/30 text-xs">-</span>
                    <input type="date" value={logDateFilter.to} onChange={e => setLogDateFilter({...logDateFilter, to: e.target.value})} className="bg-transparent text-[11px] outline-none text-muted-foreground" title="To Date" />
                 </div>
                 <button 
                   onClick={() => {
                     const rows = callLogs.map(c => [new Date(c.created_at).toLocaleString(), c.caller_name||'Unknown', c.direction==='inbound'?c.from_phone:c.to_phone, c.direction, c.duration_seconds+'s', c.ai_summary||'', c.sentiment_category||'Neutral'].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(','));
                     const csv = ['Date,Name,Number,Direction,Duration,Summary,Sentiment', ...rows].join('\n');
                     const blob = new Blob([csv], { type: 'text/csv' });
                     const url = window.URL.createObjectURL(blob);
                     const a = document.createElement('a');
                     a.setAttribute('hidden', '');
                     a.setAttribute('href', url);
                     a.setAttribute('download', `call_report_${new Date().toISOString().split('T')[0]}.csv`);
                     document.body.appendChild(a);
                     a.click();
                     document.body.removeChild(a);
                   }}
                   className="flex items-center gap-2 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg hover:bg-emerald-500/20 transition"
                 >
                   <Download size={11}/> Export
                 </button>
                 <button 
                   onClick={() => fetch(`${API_BASE}/api/calls`).then(r=>r.json()).then(d=>{if(d.success)setCallLogs(d.calls)})} 
                   className="flex items-center gap-2 text-xs border border-border px-3 py-1.5 rounded-lg hover:text-primary transition"
                 >
                   <RefreshCw size={11}/> Sync
                 </button>
               </div>
            </div>
            <div className="bg-card border border-border rounded-2xl shadow-premium-lg overflow-hidden">
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
                      <th className="py-4 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">Recordings</th>
                      <th className="py-4 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {callLogs.filter(c => {
                      if (logSentimentFilter !== 'All') {
                        const cat = (c.sentiment_category || 'Neutral').toLowerCase();
                        const stat = (c.call_status || '').toLowerCase();
                        if (logSentimentFilter === 'Interested' && cat !== 'positive') return false;
                        if (logSentimentFilter === 'Not Interested' && cat !== 'negative') return false;
                        if (logSentimentFilter === 'Booked' && !stat.includes('booked')) return false;
                        if (logSentimentFilter === 'Follow-Up' && !stat.includes('follow')) return false;
                        if (logSentimentFilter === 'Enquiry' && cat !== 'neutral') return false;
                      }
                      if (logDateFilter.from) {
                        if (new Date(c.created_at) < new Date(logDateFilter.from)) return false;
                      }
                      if (logDateFilter.to) {
                        const toDate = new Date(logDateFilter.to);
                        toDate.setHours(23,59,59,999);
                        if (new Date(c.created_at) > toDate) return false;
                      }
                      return true;
                    }).map((c, i) => (
                      <React.Fragment key={i}>
                        <tr className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-4 px-5 text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                          <td className="py-4 px-5 text-xs font-medium">{c.caller_name || 'Unknown'}</td>
                          <td className="py-4 px-5 font-mono text-primary text-xs">{c.direction === 'inbound' ? c.from_phone : c.to_phone}</td>
                          <td className="py-4 px-5 capitalize text-[11px] tracking-wide text-muted-foreground">{c.direction}</td>
                          <td className="py-4 px-5 text-xs font-mono">{c.duration_seconds ? `${c.duration_seconds}s` : '—'}</td>
                          <td className="py-4 px-5 text-center">
                            <button onClick={() => setViewSummaryModal(c)} className="bg-white/5 hover:bg-white/10 text-xs px-3 py-1.5 rounded-full border border-border transition-colors">View Data</button>
                          </td>
                           <td className="py-4 px-5 text-center">
                              <div className={cn(
                                "px-4 py-1.5 rounded-full text-[10px] items-center justify-center flex transition-all border shadow-sm font-bold tracking-wide mx-auto w-max",
                                (!c.duration_seconds || c.duration_seconds === 0) ? "bg-slate-500/10 text-slate-400 border-slate-500/20" :
                                (c.sentiment_category === 'Positive') ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : 
                                (c.sentiment_category === 'Negative') ? "bg-red-500/10 text-red-400 border-red-500/20" : 
                                "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                              )}>
                                {(() => {
                                  if (!c.duration_seconds || c.duration_seconds === 0) return 'No Connection';
                                  const raw = (c.sentiment || '').trim();
                                  const cat = (c.sentiment_category || 'Neutral');
                                  if (raw && raw.toLowerCase() !== 'neutral' && raw.toLowerCase() !== cat.toLowerCase()) {
                                    const words = raw.split(/\s+/).filter(Boolean);
                                    return words.length >= 2 ? words.slice(0, 4).join(' ') : raw;
                                  }
                                  if (cat === 'Positive' && !raw) return 'Interested';
                                  if (cat === 'Negative' && !raw) return 'Customer Concern';
                                  return 'Standard Inquiry';
                                })()}
                              </div>
                           </td>
                          <td className="py-4 px-5 text-center">
                            {c.recording_url ? (
                              <button 
                                onClick={() => setExpandedRecording(expandedRecording === c.id ? null : c.id)}
                                className={cn(
                                  "p-2 rounded-full transition-all",
                                  expandedRecording === c.id ? "bg-primary/20 text-primary shadow-inner" : "bg-white/5 hover:bg-white/10 text-muted-foreground"
                                )}
                              >
                                <Mic size={16} />
                              </button>
                            ) : (
                              <span className="text-muted-foreground/30">—</span>
                            )}
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
                        {c.recording_url && expandedRecording === c.id && (
                          <tr className="bg-sidebar/10 border-b border-border/30">
                            <td colSpan="9" className="py-2 px-5">
                               <div className="flex items-center justify-between gap-4 bg-background border border-border rounded-xl p-2 w-full max-w-4xl mx-auto shadow-sm animate-in slide-in-from-top-1 duration-200">
                                 <div className="flex items-center gap-2 px-2 flex-shrink-0">
                                   <Mic size={14} className="text-primary" />
                                   <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1 border-l border-border ml-1">Recording</span>
                                 </div>
                                 <audio controls className="w-full h-8 outline-none grayscale opacity-90 hover:opacity-100 hover:grayscale-0 transition-all">
                                   <source src={c.recording_url} type="audio/mpeg" />
                                 </audio>
                               </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
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
           <div className="space-y-8 fade-in max-w-4xl mx-auto">
             <h2 className="text-3xl font-extrabold tracking-tight">Standard Contacts</h2>
             <div className="bg-card border border-border rounded-2xl p-6 shadow-premium-lg">
               {/* Hidden for brevity, just keeping table alive */}
               <div className="text-sm text-muted-foreground mb-4">Please use the new "Lead CRM" sidebar for the upgraded experience.</div>
             </div>
           </div>
        )}

        {/* ── LEAD CRM ── */}
        {activePage === 'leads' && (
          <div className="space-y-6 fade-in w-full">
            <div className="flex justify-between">
              <div><h2 className="text-3xl font-extrabold tracking-tight">Lead Management</h2><p className="text-sm text-muted-foreground mt-1.5 font-medium">AI-enriched CRM specifically built for real estate tracking</p></div>
            </div>
            
            <div className="grid grid-cols-4 gap-4 mb-6">
              {[ {l: 'Hot Leads', v: leads.filter(x=>x.segment==='Hot').length, c: 'text-red-500'}, {l: 'Warm Pipelines', v: leads.filter(x=>x.segment==='Warm').length, c: 'text-orange-400'}, {l: 'Qualified', v: leads.filter(x=>x.segment==='Qualified').length, c: 'text-primary'}, {l: 'Cold Outreach', v: leads.filter(x=>x.segment==='Cold').length, c: 'text-blue-400'} ].map((m,i)=> (
                <div key={i} className="bg-card border border-border rounded-xl p-5 shadow flex flex-col items-center justify-center">
                  <div className={`text-3xl font-bold ${m.c}`}>{m.v}</div>
                  <div className="text-xs uppercase font-medium mt-1 text-muted-foreground tracking-wider">{m.l}</div>
                </div>
              ))}
            </div>

            <div className="bg-card border border-border rounded-2xl shadow-premium-lg overflow-hidden">
              <div className="p-4 border-b border-border bg-sidebar/30 flex justify-between items-center">
                 <h3 className="font-semibold text-sm">Lead Database</h3>
                 <button className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-xs font-bold transition shadow-sm" onClick={()=>setManualLeadModal(true)}>+ Manual Lead</button>
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

                {/* KNOWLEDGE BASE SECTION */}
        {activePage === 'knowledge_base' && (
          <div className="space-y-8 fade-in w-full">
            <div><h2 className="text-3xl font-extrabold tracking-tight">Knowledge Base &amp; RAG</h2><p className="text-sm text-muted-foreground mt-1.5 font-medium">Feed documents, websites, and text to your AI Agent for smarter answers</p></div>
            <div className="flex gap-1 border-b border-border">
              {[['text','Text / Manual', FileText], ['file','Upload PDF/Word', Download], ['url','Website URL', Link]].map(([tab, label, Icon]) => (
                <button key={tab} onClick={() => setKbTab(tab)} className={cn('flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition border-b-2 -mb-px',
                  kbTab === tab ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                  <Icon size={13} />{label}
                </button>
              ))}
            </div>
            {kbTab === 'text' && (
              <div className="bg-card border border-border rounded-2xl p-6 shadow-premium-lg">
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const btn = e.target.querySelector('button[type=submit]'); btn.innerText = 'Uploading...';
                  try {
                    const res = await fetch(`${API_BASE}/api/knowledge_base`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ title: e.target.kbtitle.value, content: e.target.kbcontent.value }) });
                    const d = await res.json();
                    if(d.success) { setKnowledgeBase([d.doc, ...knowledgeBase]); showToast('Document uploaded!', 'success'); e.target.reset(); }
                  } catch(err) { }
                  btn.innerText = 'Upload Document';
                }}>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Document Title</label>
                  <input name="kbtitle" className="w-full bg-background border border-border p-3 rounded-lg text-sm mb-4 outline-none" placeholder="e.g. Pricing FAQ 2026" required/>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Knowledge Content (RAG)</label>
                  <textarea name="kbcontent" className="w-full bg-background border border-border p-3 rounded-lg text-sm h-[150px] mb-4 outline-none resize-none font-mono text-[12px]" placeholder="Type or paste text here..." required/>
                  <div className="flex justify-end"><button type="submit" className="bg-primary text-white font-semibold rounded-lg px-6 py-2.5 text-sm">Upload Document</button></div>
                </form>
              </div>
            )}
            {kbTab === 'file' && (
              <div className="bg-card border border-border rounded-2xl p-6 shadow-premium-lg">
                <p className="text-xs text-muted-foreground mb-5 leading-relaxed">Upload a PDF or Word file. Requires a <strong>Corpus API Key</strong> in API Credentials.</p>
                <div className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-white/[0.02] transition relative">
                  <FileText size={32} className="text-muted-foreground mb-3" />
                  <h4 className="font-semibold text-sm mb-1">Drop PDF or Word file here</h4>
                  <p className="text-xs text-muted-foreground">.pdf, .doc, .docx supported</p>
                  <input type="file" accept=".pdf,.doc,.docx" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => setCorpusFile(e.target.files[0])} />
                  {corpusFile && <div className="mt-3 bg-primary/10 text-primary text-xs px-3 py-1.5 rounded-full font-semibold">{corpusFile.name}</div>}
                </div>
                {corpusFile && (
                  <div className="mt-4 flex justify-end">
                    <button onClick={async () => {
                      const formData = new FormData();
                      formData.append('file', corpusFile);
                      formData.append('title', corpusFile.name);
                      try {
                        const res = await fetch(`${API_BASE}/api/corpora/upload`, { method: 'POST', body: formData });
                        const d = await res.json();
                        if (d.success) { showToast('File uploaded to Ultravox Corpus!', 'success'); setCorpusFile(null); }
                        else showToast(d.error || 'Upload failed', 'error');
                      } catch(ex) { showToast('Upload failed', 'error'); }
                    }} className="bg-primary text-white font-semibold rounded-lg px-6 py-2.5 text-sm">Upload to Agent</button>
                  </div>
                )}
              </div>
            )}
            {kbTab === 'url' && (
              <div className="bg-card border border-border rounded-2xl p-6 shadow-premium-lg">
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed">Paste a website URL. Ultravox will scrape and index it. Requires a <strong>Corpus API Key</strong> in API Credentials.</p>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Website URL</label>
                <div className="flex gap-3">
                  <input value={corpusUrl} onChange={e => setCorpusUrl(e.target.value)} placeholder="https://yourwebsite.com/faq"
                    className="flex-1 bg-background border border-border p-3 rounded-lg text-sm outline-none focus:border-primary transition" />
                  <button onClick={async () => {
                    if (!corpusUrl || !corpusUrl.startsWith('http')) { showToast('Enter a valid https:// URL', 'error'); return; }
                    try {
                      const res = await fetch(`${API_BASE}/api/corpora/add-url`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ url: corpusUrl }) });
                      const d = await res.json();
                      if (d.success) { showToast('URL added!', 'success'); setCorpusUrl(''); }
                      else showToast(d.error || 'Failed', 'error');
                    } catch(ex) { showToast('Failed to add URL', 'error'); }
                  }} className="bg-primary text-white font-semibold rounded-lg px-5 py-2.5 text-sm whitespace-nowrap">Add URL</button>
                </div>
              </div>
            )}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm px-1">Active Text Documents ({knowledgeBase.length})</h3>
              {knowledgeBase.map((k, i) => (
                <div key={i} className="flex justify-between items-center bg-card border border-border p-4 rounded-xl shadow-sm">
                  <div>
                    <h4 className="font-medium text-sm text-primary flex items-center gap-2"><CheckCircle size={14} className="text-green-500" /> {k.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1 max-w-[500px] truncate">{k.content}</p>
                  </div>
                  <button onClick={async () => {
                     await fetch(`${API_BASE}/api/knowledge_base/${k.id}`, { method: 'DELETE' });
                     setKnowledgeBase(knowledgeBase.filter(x => x.id !== k.id));
                     showToast('Knowledge removed.', 'success');
                  }} className="text-red-500 bg-red-500/10 p-2 rounded-lg hover:bg-red-500/20"><Trash2 size={16} /></button>
                </div>
              ))}
              {knowledgeBase.length === 0 && <div className="text-xs text-muted-foreground text-center py-6 bg-card border border-border rounded-xl">No text documents yet. Use the tabs above to add knowledge.</div>}
            </div>
          </div>
        )}

        {/* ── INTEGRATIONS & COMMUNICATION LOGS ── */}
        {activePage === 'integrations_logs' && (
          <div className="space-y-8 fade-in w-full">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight">Integrations Hub</h2>
                <p className="text-sm text-muted-foreground mt-1.5 font-medium">Monitoring AI output across SMS, Email, and API integrations</p>
              </div>
              <button onClick={() => {
                const rows = appointments.map(a => [a.name||'', a.phone||'', a.email||'', a.sms_status||'Pending', a.whatsapp_status||'Pending', a.email_status||'Pending', new Date(a.created_at||a.start_time).toLocaleString()].map(v => '"' + v + '"').join(','));
                const csv = ['Name,Phone,Email,SMS Status,WhatsApp Status,Email Status,Booked At', ...rows].join('\n');
                const anchor = document.createElement('a');
                anchor.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
                anchor.download = 'communications_' + new Date().toISOString().slice(0,10) + '.csv';
                anchor.click();
              }} className="flex items-center gap-2 bg-primary text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 transition">
                <Download size={13} /> Export CSV
              </button>
            </div>
            <div className="grid grid-cols-6 gap-4">
              {[
                { label: 'Total Syncs', value: appointments.length, color: 'text-primary', bg: 'from-primary/5 to-purple-500/5' },
                { label: 'SMS Delivered', value: appointments.filter(a => a.sms_status === 'Sent').length, color: 'text-emerald-400', bg: 'from-emerald-500/5 to-teal-500/5' },
                { label: 'WA Delivered', value: appointments.filter(a => a.whatsapp_status === 'Sent').length, color: 'text-green-400', bg: 'from-green-500/5 to-emerald-500/5' },
                { label: 'Email Delivered', value: appointments.filter(a => a.email_status === 'Sent').length, color: 'text-blue-400', bg: 'from-blue-500/5 to-cyan-500/5' },
                { label: 'Engagement', value: appointments.filter(a => a.status === 'completed' || (a.email_status === 'Sent' && (a.sms_status === 'Sent' || a.whatsapp_status === 'Sent'))).length, color: 'text-purple-400', bg: 'from-indigo-500/5 to-fuchsia-500/5' },
                { label: 'Issues', value: appointments.filter(a => a.sms_status === 'Failed' || a.whatsapp_status === 'Failed' || a.email_status === 'Failed').length, color: 'text-amber-400', bg: 'from-amber-500/5 to-orange-500/5' },
              ].map((s, i) => (
                <div key={i} className={'bg-gradient-to-br ' + s.bg + ' border border-border rounded-2xl p-5'}>
                  <div className="text-2xs font-bold text-muted-foreground uppercase tracking-ultra mb-2">{s.label}</div>
                  <div className={'text-3xl font-black ' + s.color}>{s.value}</div>
                </div>
              ))}
            </div>
            <div className="bg-card border border-border rounded-2xl shadow-premium-lg overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-sm">Notification Log</h3>
                <button onClick={fetchAll} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition"><RefreshCw size={11} /> Sync</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-sidebar/30">
                      <th className="py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                      <th className="py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone</th>
                      <th className="py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Address</th>
                      <th className="py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">SMS</th>
                      <th className="py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">WhatsApp</th>
                      <th className="py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</th>
                      <th className="py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Booked At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {appointments.map((a, i) => (
                      <tr key={i} className="hover:bg-white/[0.02] transition">
                        <td className="py-3 px-5 font-medium text-sm">{a.name || 'â€”'}</td>
                        <td className="py-3 px-5 font-mono text-primary text-xs">{a.phone || 'â€”'}</td>
                        <td className="py-3 px-5 text-xs text-muted-foreground">{a.email || <span className="italic opacity-40">not captured</span>}</td>
                        <td className="py-3 px-5"><span className={cn('px-2.5 py-1 rounded-full text-[10px] uppercase font-bold',
                          a.sms_status === 'Sent' ? 'bg-emerald-500/10 text-emerald-400' : a.sms_status === 'Failed' ? 'bg-red-500/10 text-red-400' : 'bg-gray-500/10 text-gray-400')}>
                          {a.sms_status || 'Pending'}</span></td>
                        <td className="py-3 px-5"><span className={cn('px-2.5 py-1 rounded-full text-[10px] uppercase font-bold',
                          a.whatsapp_status === 'Sent' ? 'bg-emerald-500/10 text-emerald-400' : a.whatsapp_status === 'Failed' ? 'bg-red-500/10 text-red-400' : 'bg-gray-500/10 text-gray-400')}>
                          {a.whatsapp_status || 'Pending'}</span></td>
                        <td className="py-3 px-5"><span className={cn('px-2.5 py-1 rounded-full text-[10px] uppercase font-bold',
                          a.email_status === 'Sent' ? 'bg-emerald-500/10 text-emerald-400' : a.email_status === 'Failed' ? 'bg-red-500/10 text-red-400' : 'bg-gray-500/10 text-gray-400')}>
                          {a.email_status || 'Pending'}</span></td>
                        <td className="py-3 px-5 text-xs text-muted-foreground">{new Date(a.created_at || a.start_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                      </tr>
                    ))}
                    {appointments.length === 0 && <tr><td colSpan="6" className="text-center py-10 text-muted-foreground text-xs">No notifications sent yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}


        {/* ── OUTBOUND CAMPAIGNS ── */}
        {activePage === 'campaigns' && (
          <div className="space-y-8 fade-in w-full">
            <div><h2 className="text-3xl font-extrabold tracking-tight">Outbound Voice Campaigns</h2><p className="text-sm text-muted-foreground mt-1.5 font-medium">Upload a CSV list to automatically dial contacts sequentially</p></div>
            <div className="bg-card border border-border rounded-2xl p-6 shadow-premium-lg space-y-4">
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Campaign Setup</label>
              
              <div className="grid grid-cols-2 gap-4">
                <input name="campaign_name" placeholder="Campaign Name (e.g. Past Clients Follow-up)" className="w-full bg-background border border-border p-3 rounded-lg text-sm outline-none" required />
                <select name="campaign_voice" className="w-full bg-background border border-border p-3 rounded-lg text-sm outline-none">
                  <option value="Mark">🇺🇸 Mark (Standard Male)</option>
                  <option value="Alice">🇺🇸 Alice (Professional Female)</option>
                  <option value="Jessica">🇺🇸 Jessica (Warm Female)</option>
                  <option value="Kelsey">🇬🇧 Kelsey (Soft British Female)</option>
                  <option value="Priya">🇮🇳 Priya (Clear Indian Female)</option>
                  <option value="Lulu">🌍 Lulu (Casual Female)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Primary Campaign Goal</label>
                <textarea id="campaign_goal" value={campaignGoal} onChange={e => setCampaignGoal(e.target.value)}
                  placeholder="What is the objective of this outbound call? e.g. 'Get them to book a viewing for next week.'" 
                  className="w-full bg-background border border-border p-3 rounded-lg text-sm outline-none h-20 resize-none"></textarea>
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
                        const res = await fetch(`${API_BASE}/api/calls/outbound`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ toPhone: num, voice, goal }) });
                        const data = await res.json();
                        if(!data.success) { showToast(data.error || 'Dial failed.', 'error'); return; }
                        showToast('Call initiated successfully!', 'success');
                     } catch(e) { showToast('Call dispatch failed','error'); }
                   }} className="w-full bg-primary hover:bg-primary/90 text-white font-semibold rounded-lg p-2.5 text-sm shadow shadow-primary/20 mt-1 transition">Dial Target</button>
                </div>
                
                <div className="flex flex-col gap-3">
                  <div className="border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-white/[0.02] transition relative">
                   <Globe size={32} className="text-muted-foreground mb-3" />
                   <h4 className="font-semibold text-sm">Upload CSV or Excel File</h4>
                   <p className="text-xs text-muted-foreground mt-1">Supports .csv, .xlsx, .xls</p>
                   <input
                     type="file"
                     accept=".csv,.txt,.xlsx,.xls"
                     className="absolute inset-0 opacity-0 cursor-pointer"
                     onChange={async (e) => {
                       const file = e.target.files[0];
                       if (!file) return;
                       const campaignNameEl = document.querySelector('input[name="campaign_name"]');
                       const campaignName = campaignNameEl?.value;
                       if (!campaignName) {
                         showToast('Enter a Campaign Name first before uploading.', 'error');
                         e.target.value = '';
                         return;
                       }
                       const voice = document.querySelector('select[name="campaign_voice"]')?.value || 'Mark';
                       const goal = document.getElementById('campaign_goal')?.value || '';
                       
                       const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
                       
                       const processCSV = async (csvText) => {
                         try {
                           showToast('Parsing file and launching campaign...', 'success');
                           const res = await fetch(`${API_BASE}/api/campaigns/csv-launch`, {
                             method: 'POST',
                             headers: { 'Content-Type': 'application/json' },
                             body: JSON.stringify({ csvText, campaignName, voice, goal })
                           });
                           const data = await res.json();
                           if (data.success) {
                             showToast(data.message, 'success');
                             fetchAll();
                             if (campaignNameEl) campaignNameEl.value = '';
                           } else {
                             showToast(data.error || 'Failed to launch campaign.', 'error');
                           }
                         } catch(err) {
                           showToast('Upload failed. Check backend.', 'error');
                         }
                       };

                       if (isExcel) {
                         const reader = new FileReader();
                         reader.onload = async (evt) => {
                           try {
                             const workbook = XLSX.read(evt.target.result, { type: 'array' });
                             const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                             const csvText = XLSX.utils.sheet_to_csv(firstSheet);
                             await processCSV(csvText);
                           } catch(err) {
                             showToast('Failed to parse Excel file. Ensure it has phone numbers.', 'error');
                           }
                         };
                         reader.readAsArrayBuffer(file);
                       } else {
                         const reader = new FileReader();
                         reader.onload = async (evt) => {
                           await processCSV(evt.target.result);
                         };
                         reader.readAsText(file);
                       }
                       e.target.value = '';
                     }}
                   />
                   <div className="mt-4 bg-primary/20 text-primary px-4 py-1.5 rounded-full text-xs font-semibold">Bulk Connect</div>
                  </div>
                  <div className="bg-background border border-border rounded-lg p-3">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Accepted Formats — CSV, Excel, or Google Sheets</p>
                    <div className="font-mono text-[10px] text-muted-foreground leading-relaxed bg-sidebar/30 rounded-md p-2.5 border border-border/50">
                      <p className="text-foreground/70 mb-1">name, phone</p>
                      <p>John Doe, 14155551234</p>
                      <p>Jane Smith, 442071234567</p>
                      <p>Kumar R, 919876543210</p>
                    </div>
                    <p className="text-[9px] text-muted-foreground mt-2 leading-relaxed">Just type country code + number — <strong>no "+" needed</strong>. We auto-add it. Header row is optional. Name column is optional. Excel uses the first sheet.</p>
                  </div>
                  <div className="bg-background border border-border rounded-lg p-3">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Or Import from Google Sheets</p>
                    <p className="text-[9px] text-muted-foreground mb-2 leading-relaxed">Paste a Google Sheet URL below. The sheet must be set to <strong>"Anyone with the link can view"</strong>.</p>
                    <div className="flex gap-2">
                      <input id="gsheet_url" placeholder="https://docs.google.com/spreadsheets/d/..." className="flex-1 bg-sidebar/30 border border-border/50 rounded-md px-3 py-2 text-[11px] outline-none focus:border-primary transition font-mono" />
                      <button onClick={async () => {
                        const url = document.getElementById('gsheet_url')?.value;
                        const campaignNameEl = document.querySelector('input[name="campaign_name"]');
                        const campaignName = campaignNameEl?.value;
                        if (!campaignName) { showToast('Enter a Campaign Name first.', 'error'); return; }
                        if (!url || !url.includes('docs.google.com/spreadsheets')) { showToast('Enter a valid Google Sheets URL.', 'error'); return; }

                        const voice = document.querySelector('select[name="campaign_voice"]')?.value || 'Mark';
                        const goal = document.getElementById('campaign_goal')?.value || '';

                        try {
                          showToast('Fetching Google Sheet and launching campaign...', 'success');
                          const res = await fetch(`${API_BASE}/api/campaigns/gsheet-launch`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ sheetUrl: url, campaignName, voice, goal })
                          });
                          const data = await res.json();
                          if (data.success) {
                            showToast(data.message, 'success');
                            fetchAll();
                            if (campaignNameEl) campaignNameEl.value = '';
                            document.getElementById('gsheet_url').value = '';
                          } else {
                            showToast(data.error || 'Google Sheet import failed.', 'error');
                          }
                        } catch(err) {
                          showToast('Google Sheet import failed.', 'error');
                        }
                      }} className="bg-primary/80 hover:bg-primary text-white text-[11px] font-semibold px-4 py-2 rounded-md transition whitespace-nowrap">Import & Launch</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm">Live Campaigns</h3>
                <button onClick={fetchAll} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition"><RefreshCw size={12} /> Refresh</button>
              </div>
              <div className="space-y-4">
                 {campaigns.map((c, i) => (
                    <div key={i} className="bg-card border border-border rounded-xl shadow-md overflow-hidden">
                       <div className="p-4 flex justify-between items-center border-b border-border bg-sidebar/30">
                          <div>
                            <h4 className="font-semibold text-sm">{c.name}</h4>
                            <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{c.goal ? `Goal: ${c.goal.substring(0,60)}...` : 'No goal set'}</p>
                          </div>
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            c.status === 'running' ? 'bg-blue-500/10 text-blue-400' :
                            c.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                            c.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                            'bg-yellow-500/10 text-yellow-400'
                          )}>{c.status === 'running' ? '● Live' : c.status}</span>
                       </div>
                       <div className="grid grid-cols-3 sm:grid-cols-6 gap-0 text-center">
                          <div className="p-3 border-r border-border">
                            <p className="text-lg font-bold text-foreground">{c.total_calls || 0}</p>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Total</p>
                          </div>
                          <div className="p-3 border-r border-border">
                            <p className="text-lg font-bold text-blue-400">{c.answered || 0}</p>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Dialed</p>
                          </div>
                          <div className="p-3 border-r border-border">
                            <p className="text-lg font-bold text-yellow-400">{c.pending || 0}</p>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Pending</p>
                          </div>
                          <div className="p-3 border-r border-border">
                            <p className="text-lg font-bold text-green-400">{c.positive || 0}</p>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Positive</p>
                          </div>
                          <div className="p-3 border-r border-border">
                            <p className="text-lg font-bold text-red-400">{c.declined || 0}</p>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Declined</p>
                          </div>
                          <div className="p-3">
                            <p className="text-lg font-bold text-orange-400">{c.failed || 0}</p>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Failed</p>
                          </div>
                       </div>
                       {c.status === 'running' && (
                         <div className="px-4 pb-3">
                           <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                             <div className="bg-primary h-1.5 rounded-full transition-all duration-500" style={{ width: `${c.total_calls > 0 ? ((c.answered || 0) / c.total_calls * 100) : 0}%` }}></div>
                           </div>
                         </div>
                       )}
                    </div>
                 ))}
                 {campaigns.length === 0 && <div className="text-xs text-muted-foreground text-center py-6 bg-card border border-border rounded-xl">No campaigns created yet. Upload a CSV or create one manually.</div>}
              </div>
            </div>
          </div>
        )}

        {/* ── VOICE RECORDINGS PAGE ── */}
        {activePage === 'recordings' && (
          <div className="space-y-8 fade-in w-full">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight">Voice Recordings</h2>
                <p className="text-sm text-muted-foreground mt-1.5 font-medium">Browse and listen to your AI agent's conversations</p>
              </div>
              <button onClick={fetchAll} className="flex items-center gap-2 text-xs border border-border px-3 py-1.5 rounded-lg hover:text-primary transition bg-card shadow-sm">
                <RefreshCw size={11}/> Sync
              </button>
            </div>

            <div className="bg-card border border-border rounded-2xl shadow-premium-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-sidebar/30">
                      <th className="py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date/Time</th>
                      <th className="py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Caller</th>
                      <th className="py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Direction</th>
                      <th className="py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recording</th>
                      <th className="py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {callLogs.filter(c => c.recording_url).map((c, i) => (
                      <tr key={i} className="hover:bg-white/[0.02] transition">
                        <td className="py-4 px-5">
                          <div className="text-sm font-medium">{new Date(c.created_at).toLocaleDateString()}</div>
                          <div className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </td>
                        <td className="py-4 px-5">
                          <div className="text-sm font-bold">{c.caller_name || 'Anonymous'}</div>
                          <div className="text-xs text-muted-foreground font-mono">{c.direction === 'inbound' ? c.from_phone : c.to_phone}</div>
                        </td>
                        <td className="py-4 px-5 px-5">
                          <span className={`px-2 py-1 rounded-md text-[10px] uppercase font-bold ${c.direction === 'inbound' ? 'bg-primary/10 text-primary' : 'bg-purple-500/10 text-purple-400'}`}>
                            {c.direction}
                          </span>
                        </td>
                        <td className="py-4 px-5 min-w-[200px]">
                           <div className="bg-sidebar/30 rounded-lg px-2 py-1 border border-border/50 max-w-[200px]">
                              <audio controls className="w-full h-8 scale-90 origin-left">
                                <source src={c.recording_url} type="audio/mpeg" />
                              </audio>
                           </div>
                        </td>
                        <td className="py-4 px-5 text-right">
                          <div className="flex justify-end gap-2">
                             <button onClick={() => setViewSummaryModal(c)} className="bg-white/5 hover:bg-white/10 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-border transition-colors uppercase tracking-wider">Summary</button>
                             <a href={c.recording_url} target="_blank" rel="noreferrer" className="p-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg transition-all">
                               <Download size={14} />
                             </a>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {callLogs.filter(c => c.recording_url).length === 0 && (
                      <tr>
                        <td colSpan="5" className="text-center py-20 text-muted-foreground text-xs italic">
                          No voice recordings found in storage.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      {/* ── MODALS ── */}
        {activePage === 'credentials' && (
          <div className="space-y-8 fade-in w-full max-w-2xl mx-auto pb-12">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight">Integration Settings</h2>
              <p className="text-sm text-muted-foreground mt-1.5 font-medium">Configure your telephony and AI provider credentials</p>
            </div>

            {/* --- WEBHOOK DISCOVERY --- */}
            <div className="bg-gradient-to-br from-primary/10 to-purple-500/10 border border-primary/20 rounded-2xl p-6 shadow-premium relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-5"><Globe size={60} /></div>
               <h3 className="text-sm font-bold text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                 <Globe size={14} /> Inbound Webhook Setup
               </h3>
               <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                 Copy this URL and paste it into your Twilio/Vobiz console under <strong>"A Call Comes In"</strong> to enable the AI Receptionist.
               </p>
               <div className="flex items-center gap-2 bg-background/50 border border-border p-2 rounded-xl">
                 <code className="text-[11px] font-mono flex-1 truncate px-2">{`${API_BASE}/api/twilio/inbound`}</code>
                 <button 
                   onClick={() => {
                     navigator.clipboard.writeText(`${API_BASE}/api/twilio/inbound`);
                     showToast('Webhook URL copied to clipboard!', 'success');
                   }}
                   className="bg-primary hover:bg-primary/90 text-white text-[10px] font-bold px-4 py-2 rounded-lg transition-all shadow-glow"
                 >
                   Copy URL
                 </button>
               </div>
            </div>

            {/* --- TWILIO CONFIG --- */}
            <div className="bg-card border border-border rounded-2xl p-8 shadow-premium-lg">
              <h3 className="text-sm font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
                <Phone size={16} className="text-primary" /> Twilio Telephony
              </h3>
              <form onSubmit={saveTwilioConfig} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-ultra mb-2">Account SID</label>
                  <input type="text" value={twilioConfig.sid} onChange={(e) => setTwilioConfig({...twilioConfig, sid: e.target.value})} placeholder="ACxxxxxxxx" className="w-full bg-background border border-border p-3 rounded-xl text-sm outline-none focus:border-primary transition-all font-mono" required />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-ultra mb-2">Auth Token</label>
                  <input type="password" value={twilioConfig.api_key} onChange={(e) => setTwilioConfig({...twilioConfig, api_key: e.target.value})} placeholder="••••••••••••" className="w-full bg-background border border-border p-3 rounded-xl text-sm outline-none focus:border-primary transition-all font-mono" required />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-ultra mb-2">Outbound Number</label>
                  <input type="text" value={twilioConfig.phone} onChange={(e) => setTwilioConfig({...twilioConfig, phone: e.target.value})} placeholder="+1..." className="w-full bg-background border border-border p-3 rounded-xl text-sm outline-none focus:border-primary transition-all font-mono" required />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-ultra mb-2">Transfer Call To (Human Handoff Number)</label>
                  <input type="text" value={twilioConfig.transfer_number || ''} onChange={(e) => setTwilioConfig({...twilioConfig, transfer_number: e.target.value})} placeholder="+91..." className="w-full bg-background border border-border p-3 rounded-xl text-sm outline-none focus:border-primary transition-all font-mono" />
                  <p className="text-[10px] text-muted-foreground mt-2 italic">When the AI transfers a caller to a human, it will dial this number.</p>
                </div>
                <div className="pt-4">
                  <button type="submit" disabled={isSavingCreds} className="w-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2">
                    {isSavingCreds ? 'Saving...' : 'Update Twilio Keys'}
                  </button>
                </div>
              </form>
            </div>

            {/* --- AZLON API CONFIG --- */}
            <div className="bg-card border border-border rounded-2xl p-8 shadow-premium-lg">
              <h3 className="text-sm font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
                <Sparkles size={16} className="text-purple-400" /> Azlon Intelligence
              </h3>
              <form onSubmit={saveUVConfig} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-ultra mb-2">Azlon Unique Key</label>
                  <input type="password" value={uvConfig.api_key} onChange={(e) => setUVConfig({...uvConfig, api_key: e.target.value})} placeholder="sk_live_..." className="w-full bg-background border border-border p-3 rounded-xl text-sm outline-none focus:border-primary transition-all font-mono" required />
                  <p className="text-[10px] text-muted-foreground mt-3 italic">This key is required for the AI to process voice and speak to callers.</p>
                </div>
                <div className="pt-2">
                  <button type="submit" disabled={isSavingUV} className="w-full bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2">
                    {isSavingUV ? 'Saving...' : 'Update AI Provider Key'}
                  </button>
                </div>
              </form>
            </div>

            {/* --- RESEND API CONFIG --- */}
            <div className="bg-card border border-border rounded-2xl p-8 shadow-premium-lg mt-8">
              <h3 className="text-sm font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
                <Globe size={16} className="text-emerald-400" /> Resend Mailing API
              </h3>
              <form onSubmit={saveResendConfig} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-ultra mb-2">Resend API Key</label>
                  <input type="password" value={resendConfig.api_key} onChange={(e) => setResendConfig({...resendConfig, api_key: e.target.value})} placeholder="re_..." className="w-full bg-background border border-border p-3 rounded-xl text-sm outline-none focus:border-primary transition-all font-mono" required />
                  <p className="text-[10px] text-muted-foreground mt-3 italic">Used for automated meeting confirmations, reminders, and follow-ups.</p>
                </div>
                <div className="pt-2">
                  <button type="submit" disabled={isSavingResend} className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2">
                    {isSavingResend ? 'Saving...' : 'Update Resend Email Key'}
                  </button>
                </div>
              </form>
            </div>


            {/* --- ULTRAVOX CORPUS API KEY --- */}
            <div className="bg-card border border-border rounded-2xl p-8 shadow-premium-lg mt-8">
              <h3 className="text-sm font-bold uppercase tracking-widest mb-1 flex items-center gap-2">
                <BookOpen size={16} className="text-amber-400" /> Ultravox Corpus API Key
              </h3>
              <p className="text-xs text-muted-foreground mb-5">Separate key for uploading PDFs, Word files, and URLs to the Knowledge Base Corpora (used in Knowledge Base page).</p>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const val = e.target.corpus_key.value;
                const ok = await saveIntegration('ultravox_corpus', val, {});
                if (ok) showToast('Corpus key saved!', 'success');
              }} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-ultra mb-2">Corpus API Key</label>
                  <input name="corpus_key" type="password" defaultValue={getIntegration('ultravox_corpus').api_key || ''}
                    placeholder="sk_live_..." className="w-full bg-background border border-border p-3 rounded-xl text-sm outline-none focus:border-primary transition-all font-mono" />
                </div>
                <button type="submit" className="w-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold py-3.5 rounded-xl transition-all">Save Corpus Key</button>
              </form>
            </div>

            {/* --- AWS S3 CONFIG --- */}
            <div className="bg-card border border-border rounded-2xl p-8 shadow-premium-lg mt-8">
              <h3 className="text-sm font-bold uppercase tracking-widest mb-1 flex items-center gap-2">
                <Globe size={16} className="text-blue-400" /> AWS S3 Call Recordings
              </h3>
              <p className="text-xs text-muted-foreground mb-5">Store voice recordings securely in your personal AWS S3 bucket.</p>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const btn = e.target.querySelector('button[type="submit"]'); btn.innerText = 'Saving...';
                const key = e.target.s3_secret.value;
                const meta = { 
                  access_key: e.target.s3_key.value,
                  region: e.target.s3_region.value,
                  bucket: e.target.s3_bucket.value 
                };
                const ok = await saveIntegration('aws_s3', key, meta);
                if (ok) showToast('AWS S3 credentials updated!', 'success');
                btn.innerText = 'Update AWS S3 Bucket';
              }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-ultra mb-2">Access Key ID</label>
                    <input name="s3_key" defaultValue={getIntegration('aws_s3').meta_data?.access_key || ''} placeholder="AKIA..." className="w-full bg-background border border-border p-3 rounded-xl text-sm outline-none font-mono" required />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-ultra mb-2">Secret Access Key</label>
                    <input name="s3_secret" type="password" defaultValue={getIntegration('aws_s3').api_key || ''} placeholder="••••••••" className="w-full bg-background border border-border p-3 rounded-xl text-sm outline-none font-mono" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-ultra mb-2">Region</label>
                    <input name="s3_region" defaultValue={getIntegration('aws_s3').meta_data?.region || 'us-east-1'} placeholder="us-east-1" className="w-full bg-background border border-border p-3 rounded-xl text-sm outline-none font-mono" required />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-ultra mb-2">Bucket Name</label>
                    <input name="s3_bucket" defaultValue={getIntegration('aws_s3').meta_data?.bucket || ''} placeholder="my-call-recordings" className="w-full bg-background border border-border p-3 rounded-xl text-sm outline-none font-mono" required />
                  </div>
                </div>
                <button type="submit" className="w-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold py-3.5 rounded-xl transition-all">Update AWS S3 Bucket</button>
              </form>
            </div>
          </div>
        )}


      {viewSummaryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center fade-in p-4">
          <div className="bg-card w-full max-w-2xl rounded-2xl shadow-premium-lg border border-border flex flex-col max-h-[85vh]">
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

              {viewSummaryModal.recording_url && (
                <div className="pt-4 border-t border-border">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Mic size={14} className="text-primary" /> Call Recording (S3)
                  </h4>
                  <div className="bg-background/50 p-4 rounded-xl border border-border flex items-center gap-4">
                     <audio controls className="flex-1 h-10">
                        <source src={viewSummaryModal.recording_url} type="audio/mpeg" />
                     </audio>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2 italic">Stored securely in {getIntegration('aws_s3').meta_data?.bucket || 'your S3 bucket'}.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {calendarModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center fade-in p-4">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-premium-lg border border-border flex flex-col">
            <div className="p-6 border-b border-border flex justify-between items-center bg-sidebar/50 rounded-t-2xl">
              <div>
                 <h3 className="font-bold text-lg">{calendarModal.mode === 'reschedule' ? 'Reschedule' : 'Manual Booking'}</h3>
                 <p className="text-xs text-muted-foreground font-mono mt-1">Date: {calendarModal.date.toLocaleDateString()}</p>
              </div>
              <button onClick={() => setCalendarModal(null)} className="text-muted-foreground hover:text-white bg-white/5 p-2 rounded-lg transition-colors"><XCircle size={20}/></button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const btn = e.target.querySelector('button[type=submit]');
              const prevText = btn.innerText;
              btn.innerText = 'Saving...';
              const dateStr = e.target.date.value; // YYYY-MM-DD
              const timeStr = e.target.time.value; // HH:mm
              const start_time = `${dateStr}T${timeStr}:00+05:30`;
              try {
                let res;
                if (calendarModal.mode === 'reschedule') {
                  res = await fetch(`${API_BASE}/api/appointments/manual/${calendarModal.rescheduleId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'reschedule', start_time })
                  });
                } else {
                  res = await fetch(`${API_BASE}/api/appointments/manual`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ start_time, name: e.target.name.value, phone: e.target.phone.value })
                  });
                }
                if(!res.ok) throw new Error('Setup failed');
                showToast(calendarModal.mode === 'reschedule' ? 'Appointment rescheduled!' : 'Appointment successfully booked!', 'success');
                setCalendarModal(null);
                fetchAll();
              } catch(err) { showToast('Execution failed. Check details.','error'); btn.innerText = prevText; }
            }} className="p-6 space-y-4">
               <div className="grid grid-cols-2 gap-3">
                 <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Date</label>
                    <input name="date" type="date" defaultValue={toYYYYMMDD(calendarModal.date)} required className="w-full bg-background border border-border rounded-lg p-3 text-sm outline-none focus:border-primary transition-colors" />
                 </div>
                 <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Time</label>
                    <input name="time" type="time" defaultValue={calendarModal.date.getHours().toString().padStart(2, '0') + ':' + calendarModal.date.getMinutes().toString().padStart(2, '0')} required className="w-full bg-background border border-border rounded-lg p-3 text-sm outline-none focus:border-primary transition-colors" />
                 </div>
               </div>
               <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Client Name</label>
                  <input name="name" required placeholder="John Doe" defaultValue={calendarModal.prefill?.name || ''} disabled={calendarModal.mode === 'reschedule'} className="w-full bg-background border border-border rounded-lg p-3 text-sm outline-none focus:border-primary transition-colors disabled:opacity-50 cursor-not-allowed" />
               </div>
               <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Phone Number</label>
                  <input name="phone" required placeholder="+1234567890" defaultValue={calendarModal.prefill?.phone || ''} disabled={calendarModal.mode === 'reschedule'} className="w-full bg-background border border-border rounded-lg p-3 text-sm outline-none focus:border-primary transition-colors disabled:opacity-50 cursor-not-allowed font-mono" />
               </div>
               <button type="submit" className="w-full bg-primary text-white font-bold py-3 rounded-lg shadow-lg shadow-primary/20 hover:bg-primary/90 mt-4 transition-all">
                  {calendarModal.mode === 'reschedule' ? 'Save New Time' : 'Record Booking Internally'}
               </button>
            </form>
          </div>
        </div>
      )}

      {manualLeadModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center fade-in p-4 text-white">
          <div className="bg-card w-full max-w-lg rounded-3xl shadow-premium-lg border border-border flex flex-col p-8 fade-in-up">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-2xl font-black tracking-tight text-primary">Add CRM Target</h3>
                <p className="text-xs text-muted-foreground mt-1">Populate your lead database manually with a new prospect.</p>
              </div>
              <button onClick={() => setManualLeadModal(false)} className="text-muted-foreground hover:text-white bg-white/5 p-2 rounded-xl transition-all"><XCircle size={24}/></button>
            </div>
            <form onSubmit={saveManualLead} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Lead Name</label>
                  <input 
                    required 
                    value={newLead.name}
                    onChange={(e)=>setNewLead({...newLead, name: e.target.value})}
                    placeholder="Full legal name" 
                    className="w-full bg-sidebar/30 border border-border rounded-xl p-3.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all shadow-inner" 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Phone Number</label>
                  <input 
                    required 
                    value={newLead.phone}
                    onChange={(e)=>setNewLead({...newLead, phone: e.target.value})}
                    placeholder="+91..." 
                    className="w-full bg-sidebar/30 border border-border rounded-xl p-3.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all shadow-inner font-mono" 
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Email Address (Optional)</label>
                <input 
                  value={newLead.email}
                  onChange={(e)=>setNewLead({...newLead, email: e.target.value})}
                  placeholder="client@company.com" 
                  className="w-full bg-sidebar/30 border border-border rounded-xl p-3.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all shadow-inner" 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Target Segment</label>
                <select 
                  value={newLead.segment}
                  onChange={(e)=>setNewLead({...newLead, segment: e.target.value})}
                  className="w-full bg-sidebar/30 border border-border rounded-xl p-3.5 text-sm outline-none focus:border-primary transition-all cursor-pointer"
                >
                  <option value="Hot">🔥 Hot Lead</option>
                  <option value="Warm">⚡ Warm Pipeline</option>
                  <option value="Qualified">🎓 Qualified Pro</option>
                  <option value="Cold">❄️ Cold Outreach</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Initial AI Context</label>
                <textarea 
                  value={newLead.ai_context}
                  onChange={(e)=>setNewLead({...newLead, ai_context: e.target.value})}
                  placeholder="e.g. Previous client looking to buy in Mumbai West..." 
                  className="w-full bg-sidebar/30 border border-border rounded-xl p-3.5 text-sm outline-none focus:border-primary h-24 resize-none transition-all shadow-inner"
                />
              </div>
              <button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white font-black py-4 rounded-2xl shadow-xl shadow-primary/20 mt-4 transition-all transform hover:-translate-y-0.5 active:translate-y-0 text-sm uppercase tracking-widest">Deploy Manual Target</button>
            </form>
          </div>
        </div>
      )}
       <div className="p-8 mt-auto text-center text-xs text-muted-foreground border-t border-border/30">
         © 2026 Azlon AI Platform • Dashboard Version V2.3
       </div>
      </main>
    </div>
  );
}
