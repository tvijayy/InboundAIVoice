import { useState } from 'react';
import { BarChart3, Calendar, Bot, Mic, Key, Phone, Users, PhoneOutgoing, Globe, Sparkles } from 'lucide-react';
import { cn } from './lib/utils';

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');

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
    { id: 'languages', label: 'Language Presets', icon: Globe },
    { id: 'demo', label: 'Demo Link', icon: Sparkles },
  ];

  return (
    <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden">
      
      {/* Sidebar */}
      <aside className="w-[240px] min-w-[240px] bg-sidebar border-r border-border flex flex-col py-6 relative z-10">
        
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 pb-6 border-b border-border">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
            {/* Minimal SVG Logo matching the HTML */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
              <path d="M8 12c0-2.21 1.79-4 4-4s4 1.79 4 4" />
              <circle cx="12" cy="15" r="2" fill="currentColor" />
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-sm leading-tight">Voice Agent</h1>
            <p className="text-[10px] text-muted-foreground">RapidX AI SaaS</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          {navigation.map((item, idx) => {
            if (item.section) {
              return (
                <div key={idx} className="px-4 py-2 mt-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                  {item.section}
                </div>
              );
            }
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-5 py-2.5 text-[13.5px] font-medium border-l-4 transition-all outline-none",
                  activePage === item.id 
                    ? "text-primary border-primary bg-[rgba(108,99,255,0.18)]" 
                    : "text-muted-foreground border-transparent hover:text-foreground hover:bg-white/5"
                )}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Footer Status */}
        <div className="px-5 pt-4 border-t border-border text-[11px] text-muted-foreground flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_6px_#22c55e] animate-pulse-glow" />
          Agent Online
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-background p-8">
        
        {/* Simple view router mapping activePage to UI component */}
        {activePage === 'dashboard' && (
          <div className="space-y-6 fade-in">
            <div>
              <h2 className="text-2xl font-bold">Dashboard</h2>
              <p className="text-sm text-muted-foreground mt-1">Real-time overview of your AI voice agent performance</p>
            </div>
            
            {/* Stat Grid */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Total Calls', value: '142', sub: 'All time' },
                { label: 'Bookings Made', value: '38', sub: 'Confirmed appointments' },
                { label: 'Avg Duration', value: '45s', sub: 'Seconds per call' },
                { label: 'Booking Rate', value: '26%', sub: 'Calls that converted' }
              ].map((stat, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-5 hover:-translate-y-1 hover:shadow-lg transition-all duration-200">
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{stat.label}</div>
                  <div className="text-3xl font-bold mt-2">{stat.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{stat.sub}</div>
                </div>
              ))}
            </div>

            {/* Recent Calls Data Table Skeleton */}
            <div className="bg-card border border-border rounded-xl flex flex-col px-6 py-5">
              <div className="flex justify-between items-center mb-4 border-b border-border pb-3">
                <h3 className="font-semibold text-sm">Recent Calls</h3>
                <button className="text-xs text-muted-foreground hover:text-primary transition">↻ Refresh</button>
              </div>
              <div className="text-center py-12 text-sm text-muted-foreground">
                TanStack Query & Supabase fetches will render here!
              </div>
            </div>
          </div>
        )}

        {activePage === 'agent' && (
          <div className="space-y-6 fade-in">
            <div>
              <h2 className="text-2xl font-bold">Agent Settings</h2>
              <p className="text-sm text-muted-foreground mt-1">Configure AI personality, opening line, and sensitivity</p>
            </div>
            
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-semibold text-sm mb-4 border-b border-border pb-3">System Prompt</h3>
              <textarea 
                className="w-full bg-background border border-border rounded-lg p-3 font-mono text-[13px] text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 h-[300px]"
                defaultValue="You are an inbound answering service answering calls sent from Twilio. Be highly professional."
              />
              <p className="text-xs text-muted-foreground mt-2">Saved directly to your Supabase Database using Zustand global state.</p>
            </div>
          </div>
        )}

        {activePage === 'outbound' && (
          <div className="space-y-6 fade-in max-w-2xl mx-auto mt-10">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight">AI Outbound Dialer</h2>
              <p className="text-sm text-muted-foreground mt-2">Command your AI agent to physically place a phone call across the global telecom network immediately.</p>
            </div>
            
            <div className="bg-card border border-border shadow-2xl shadow-primary/5 rounded-2xl p-8 mt-8">
              <form className="space-y-5" onSubmit={(e) => {
                  e.preventDefault();
                  alert("Deployment required! Push this code to Easypanel so we can trigger the live /api/calls/outbound webhook.");
              }}>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Lead Phone Number</label>
                  <input 
                    type="tel" 
                    placeholder="+1 (555) 123-4567"
                    className="w-full bg-background border border-border rounded-lg p-3.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Dynamic System Prompt (Overrides Agent Default)</label>
                  <textarea 
                    placeholder="E.g. You are calling John. Your absolute goal is to book a calendar appointment for tomorrow at 2PM..."
                    className="w-full bg-background border border-border rounded-lg p-3.5 text-sm h-[140px] outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
                  />
                </div>

                <div className="pt-4">
                  <button 
                    type="submit" 
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg p-3.5 text-sm shadow-[0_4px_14px_0_rgba(108,99,255,0.39)] hover:shadow-[0_6px_20px_rgba(108,99,255,0.23)] hover:-translate-y-0.5 transition-all flex justify-center items-center gap-2"
                  >
                    <PhoneOutgoing size={18} />
                    Dispatch AI Agent Now
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ... Other pages will be built out block-by-block using shadcn and standard react patterns */}
        {activePage !== 'dashboard' && activePage !== 'agent' && activePage !== 'outbound' && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground fade-in">
            <IconWrapper icon={navigation.find(n => n.id === activePage)?.icon} />
            <h2 className="text-lg font-medium mt-4">{navigation.find(n => n.id === activePage)?.label}</h2>
            <p className="text-xs mt-2">Component scaffolding ready. Coming soon!</p>
          </div>
        )}

      </main>

    </div>
  );
}

function IconWrapper({ icon: Icon }) {
  if (!Icon) return null;
  return <Icon size={48} className="opacity-20" />;
}
