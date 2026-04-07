import os

def fix_app_jsx():
    path = r'C:\Users\tvijayy\Downloads\InboundAIVoice-main\InboundAIVoice-main\frontend\src\App.jsx'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. Force theme default
    content = content.replace("const [theme, setTheme] = useState('dark');", "const [theme, setTheme] = useState('light');")
    
    # 2. Fix Manual Dial Fetch and Error Handling
    old_dial = """try {
                         showToast('Dispatching manual call...', 'success');
                         const res = await fetch(`${API_BASE}/api/calls/outbound`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ toPhone: num, voice, goal }) });
                         if(!res.ok) throw new Error('Backend failed to dial');
                         showToast('Call initiated successfully!', 'success');
                      } catch(e) { showToast('Call dispatch failed','error'); }"""
    
    new_dial = """try {
                        const res = await fetch(`${API_BASE}/api/calls/outbound`, { 
                          method: 'POST', 
                          headers: {'Content-Type':'application/json'}, 
                          body: JSON.stringify({ toPhone: num, voice, goal }) 
                        });
                        const data = await res.json();
                        if(!data.success) {
                           showToast(data.error || 'Dial failed.', 'error');
                           return;
                        }
                        showToast('Call initiated successfully!', 'success');
                      } catch(e) { 
                        showToast('Call dispatch failed','error'); 
                      }"""
    
    # Use a more flexible replace that handles common whitespace variations
    content = content.replace("res.ok) throw new Error('Backend failed to dial')", "data.success) { showToast(data.error || 'Dial failed.', 'error'); return; }")
    
    # 3. Ensure interval={0} in AreaChart
    content = content.replace("interval={3}", "interval={0}")
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

def fix_server_js():
    path = r'C:\Users\tvijayy\Downloads\InboundAIVoice-main\InboundAIVoice-main\backend\server.js'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Ensure the outbound error handler returns 400
    content = content.replace("res.status(500).json({ error: error.message || \"Failed to launch outbound API.\" });", 
                              "res.status(400).json({ success: false, error: error.message || \"Failed to launch outbound API.\" });")

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    fix_app_jsx()
    fix_server_js()
    print(\"Final Calibrations Applied!\")
