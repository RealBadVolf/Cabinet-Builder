import React, { useState, useEffect, createContext, useContext, useCallback, useMemo } from 'react';
import { Routes, Route, Link, useNavigate, useParams, Navigate } from 'react-router-dom';
import * as api from './api';
import CabinetStudio from './components/CabinetStudio';

// ═══════════════════════════════════════════════════════════════════════════
// AUTH CONTEXT
// ═══════════════════════════════════════════════════════════════════════════
const AuthCtx = createContext(null);
export function useAuth() { return useContext(AuthCtx); }

function AuthProvider({ children }) {
  const [user, setUser] = useState(api.getStoredUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = api.getStoredUser();
    if (stored) {
      api.getMe().then(u => { setUser(u); api.setStoredUser(u); })
        .catch(() => { setUser(null); api.logout(); })
        .finally(() => setLoading(false));
    } else { setLoading(false); }

    const onExpired = () => { setUser(null); };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const doLogin = async (login, pw) => { const u = await api.login(login, pw); setUser(u); return u; };
  const doRegister = async (email, username, pw, fn, ln) => { const u = await api.register(email, username, pw, fn, ln); setUser(u); return u; };
  const doLogout = () => { api.logout(); setUser(null); };

  if (loading) return <div style={S.loadingScreen}>Loading...</div>;
  return <AuthCtx.Provider value={{ user, login: doLogin, register: doRegister, logout: doLogout }}>{children}</AuthCtx.Provider>;
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════
const S = {
  loadingScreen: { display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',
    background:'#151210',color:'#8a7e6a',fontFamily:'IBM Plex Mono,monospace',fontSize:14 },
};

const CSS = `
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'IBM Plex Mono','Fira Code',monospace;background:#151210;color:#e4d8c4;min-height:100vh;}
  a{color:#c49355;text-decoration:none;} a:hover{text-decoration:underline;}
  .btn{font-family:inherit;font-size:11px;padding:7px 16px;border-radius:4px;cursor:pointer;
    border:1px solid #3a3228;transition:all .15s;letter-spacing:.3px;}
  .btn-primary{background:#c49355;color:#151210;border-color:#c49355;font-weight:600;}
  .btn-primary:hover{background:#d4a365;}
  .btn-ghost{background:transparent;color:#8a7e6a;} .btn-ghost:hover{color:#e4d8c4;background:#252119;}
  .btn-danger{background:transparent;color:#c05050;border-color:#c05050;} .btn-danger:hover{background:#c05050;color:#fff;}
  .btn-sm{font-size:10px;padding:4px 10px;}
  .input{font-family:inherit;font-size:12px;background:#1e1a15;border:1px solid #3a3228;color:#e4d8c4;
    padding:8px 12px;border-radius:4px;outline:none;width:100%;transition:border .2s;}
  .input:focus{border-color:#c49355;}
  .input-label{font-size:10px;color:#8a7e6a;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;}
  .card{background:#1c1916;border:1px solid #252119;border-radius:6px;padding:16px;transition:border-color .2s;}
  .card:hover{border-color:#3a3228;}
  .sec-title{font-size:10px;font-weight:600;color:#c49355;letter-spacing:1.5px;text-transform:uppercase;
    padding-bottom:8px;border-bottom:1px solid #252119;margin-bottom:12px;}
  .badge{display:inline-block;font-size:8px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;
    padding:2px 6px;border-radius:3px;}
  .badge-admin{background:rgba(196,80,80,.15);color:#d05050;}
  .badge-manager{background:rgba(100,160,220,.15);color:#64a0dc;}
  .badge-user{background:rgba(106,154,90,.15);color:#7aba6a;}
  select.input{cursor:pointer;}
  table{width:100%;border-collapse:collapse;font-size:12px;}
  th{text-align:left;font-size:9px;font-weight:600;color:#c49355;text-transform:uppercase;letter-spacing:.6px;
    padding:8px 10px;border-bottom:1px solid #252119;}
  td{padding:8px 10px;border-bottom:1px solid #1c1916;vertical-align:top;}
  tr:hover td{background:#1c1916;}
  .nav{display:flex;align-items:center;justify-content:space-between;padding:10px 24px;
    background:#1c1916;border-bottom:1px solid #252119;}
  .nav-brand{font-size:15px;font-weight:600;color:#c49355;letter-spacing:-.3px;}
  .nav-links{display:flex;align-items:center;gap:12px;}
  .nav-link{font-size:11px;color:#8a7e6a;letter-spacing:.3px;transition:color .15s;}
  .nav-link:hover{color:#e4d8c4;text-decoration:none;}
  .nav-link.active{color:#c49355;}
  .page{padding:24px;max-width:1100px;margin:0 auto;}
  .status-quote{color:#8a7e6a;} .status-approved{color:#64a0dc;} .status-in_progress{color:#c49355;}
  .status-complete{color:#7aba6a;} .status-cancelled{color:#c05050;}
`;

// ═══════════════════════════════════════════════════════════════════════════
// NAV BAR
// ═══════════════════════════════════════════════════════════════════════════
function NavBar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <div className="nav">
      <Link to="/" className="nav-brand" style={{ textDecoration: 'none' }}>◧ Cabinet Studio</Link>
      <div className="nav-links">
        <Link to="/designer" className="nav-link">Designer</Link>
        {user && <Link to="/projects" className="nav-link">Projects</Link>}
        {user && ['admin','manager'].includes(user.role) && <Link to="/admin" className="nav-link">Admin</Link>}
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, color: '#8a7e6a' }}>{user.username}</span>
            <span className={`badge badge-${user.role}`}>{user.role}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => { logout(); nav('/'); }}>Logout</button>
          </div>
        ) : (
          <Link to="/login" className="nav-link">Login</Link>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH PAGES
// ═══════════════════════════════════════════════════════════════════════════
function LoginPage() {
  const { login, register, user } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ login: '', password: '', email: '', username: '', firstName: '', lastName: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/projects" />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      if (mode === 'login') await login(form.login, form.password);
      else await register(form.email, form.username, form.password, form.firstName, form.lastName);
      nav('/projects');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const u = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="page" style={{ maxWidth: 400, marginTop: 60 }}>
      <h2 style={{ fontSize: 18, color: '#c49355', marginBottom: 24 }}>
        {mode === 'login' ? 'Sign In' : 'Create Account'}
      </h2>
      <form onSubmit={handleSubmit}>
        {mode === 'register' && <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div><div className="input-label">First Name</div><input className="input" value={form.firstName} onChange={e => u('firstName', e.target.value)} /></div>
            <div><div className="input-label">Last Name</div><input className="input" value={form.lastName} onChange={e => u('lastName', e.target.value)} /></div>
          </div>
          <div className="input-label">Email</div>
          <input className="input" type="email" value={form.email} onChange={e => u('email', e.target.value)} required style={{ marginBottom: 12 }} />
          <div className="input-label">Username</div>
          <input className="input" value={form.username} onChange={e => u('username', e.target.value)} required style={{ marginBottom: 12 }} />
        </>}
        {mode === 'login' && <>
          <div className="input-label">Email or Username</div>
          <input className="input" value={form.login} onChange={e => u('login', e.target.value)} required style={{ marginBottom: 12 }} />
        </>}
        <div className="input-label">Password</div>
        <input className="input" type="password" value={form.password} onChange={e => u('password', e.target.value)}
          required minLength={mode === 'register' ? 8 : 1} style={{ marginBottom: 16 }} />
        {error && <div style={{ color: '#c05050', fontSize: 11, marginBottom: 12 }}>{error}</div>}
        <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', padding: '10px 0' }}>
          {loading ? '...' : mode === 'login' ? 'Sign In' : 'Create Account'}
        </button>
      </form>
      <div style={{ marginTop: 16, textAlign: 'center', fontSize: 11, color: '#8a7e6a' }}>
        {mode === 'login' ? (
          <>No account? <span style={{ color: '#c49355', cursor: 'pointer' }} onClick={() => setMode('register')}>Register free</span></>
        ) : (
          <>Have an account? <span style={{ color: '#c49355', cursor: 'pointer' }} onClick={() => setMode('login')}>Sign in</span></>
        )}
      </div>
      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <Link to="/designer" style={{ fontSize: 11, color: '#8a7e6a' }}>
          → Continue as guest (design without saving)
        </Link>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PROJECTS LIST
// ═══════════════════════════════════════════════════════════════════════════
function ProjectsPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newJob, setNewJob] = useState({ jobCode: '', jobName: '', description: '' });
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { const j = await api.listJobs(); setJobs(j); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault(); setError('');
    try {
      await api.createJob(newJob);
      setShowNew(false); setNewJob({ jobCode: '', jobName: '', description: '' });
      load();
    } catch (err) { setError(err.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this project and all its cabinets?')) return;
    try { await api.deleteJob(id); load(); } catch (err) { setError(err.message); }
  };

  if (!user) return <Navigate to="/login" />;

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, color: '#c49355' }}>
          {['admin','manager'].includes(user.role) ? 'All Projects' : 'My Projects'}
        </h2>
        <button className="btn btn-primary" onClick={() => setShowNew(!showNew)}>+ New Project</button>
      </div>

      {showNew && (
        <form onSubmit={handleCreate} className="card" style={{ marginBottom: 20, display: 'grid', gridTemplateColumns: '1fr 2fr 3fr auto', gap: 12, alignItems: 'end' }}>
          <div><div className="input-label">Code</div><input className="input" placeholder="2026-001" value={newJob.jobCode} onChange={e => setNewJob(p => ({ ...p, jobCode: e.target.value }))} required /></div>
          <div><div className="input-label">Name</div><input className="input" placeholder="Smith Kitchen" value={newJob.jobName} onChange={e => setNewJob(p => ({ ...p, jobName: e.target.value }))} required /></div>
          <div><div className="input-label">Description</div><input className="input" placeholder="Optional notes" value={newJob.description} onChange={e => setNewJob(p => ({ ...p, description: e.target.value }))} /></div>
          <button className="btn btn-primary" type="submit">Create</button>
        </form>
      )}

      {error && <div style={{ color: '#c05050', fontSize: 11, marginBottom: 12 }}>{error}</div>}

      {loading ? <div style={{ color: '#8a7e6a' }}>Loading...</div> : jobs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: '#8a7e6a' }}>
          <div style={{ fontSize: 13, marginBottom: 8 }}>No projects yet</div>
          <div style={{ fontSize: 11 }}>Create your first project to start designing cabinets</div>
        </div>
      ) : (
        <table>
          <thead><tr>
            <th>Code</th><th>Name</th><th>Status</th><th>Cabinets</th>
            {['admin','manager'].includes(user.role) && <th>Owner</th>}
            <th>Updated</th><th></th>
          </tr></thead>
          <tbody>
            {jobs.map(j => (
              <tr key={j.job_id} style={{ cursor: 'pointer' }} onClick={() => nav(`/project/${j.job_id}`)}>
                <td style={{ fontWeight: 600, color: '#c49355' }}>{j.job_code}</td>
                <td>{j.job_name}</td>
                <td><span className={`status-${j.status}`} style={{ fontSize: 11 }}>{j.status?.replace('_',' ')}</span></td>
                <td style={{ textAlign: 'center' }}>{j.cabinet_count || 0}</td>
                {['admin','manager'].includes(user.role) && <td style={{ fontSize: 10, color: '#8a7e6a' }}>{j.owner_name || '—'}</td>}
                <td style={{ fontSize: 10, color: '#8a7e6a' }}>{j.updated_at ? new Date(j.updated_at).toLocaleDateString() : '—'}</td>
                <td><button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); handleDelete(j.job_id); }}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PROJECT DETAIL (cabinet list for a job)
// ═══════════════════════════════════════════════════════════════════════════
function ProjectDetailPage() {
  const { user } = useAuth();
  const { jobId } = useParams();
  const nav = useNavigate();
  const [job, setJob] = useState(null);
  const [cabinets, setCabinets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newCab, setNewCab] = useState({ code: '', name: '', type: 'base' });
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(new Set());

  const load = useCallback(async () => {
    try {
      const [j, c] = await Promise.all([api.getJob(jobId), api.listCabinets(jobId)]);
      setJob(j); setCabinets(c);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const DEFAULT_CONFIG = {
        cabinetType: newCab.type, construction: 'frameless',
        height: 760, width: 600, depth: 580,
        caseMaterialThickness: 18, backPanelThickness: 6, doorMaterialThickness: 18,
        dadoDepth: 10, dadoWidth: 18, rabbetDepth: 10, rabbetWidth: 6,
        toeKickHeight: 100, toeKickRecess: 75, toeKickStyle: 'integral',
        shelfCount: 1, shelfType: 'adjustable', shelfSetback: 5,
        pinDia: 5, pinDepth: 12, pinSpacing: 32, pinRowsPerSide: 2,
        pinInsetFront: 37, pinInsetRear: 37, pinZoneStart: 80, pinZoneEnd: 80,
        doorCount: 1, doorStyle: 'shaker', doorOverlay: 12, doorGap: 3, doorReveal: 3,
        drawerCount: 0, nailerHeight: 90, nailerCount: 2,
        hingeBoreDia: 35, hingeBoreDepth: 13, hingeBoreFromEdge: 22,
        handleType: 'pull', handleLength: 128,
      };
      await api.createCabinet(jobId, {
        cabinetCode: newCab.code, name: newCab.name || undefined,
        cabinetType: newCab.type, config: DEFAULT_CONFIG,
      });
      setShowNew(false); setNewCab({ code: '', name: '', type: 'base' }); load();
    } catch (err) { setError(err.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this cabinet?')) return;
    try { await api.deleteCabinet(id); load(); } catch (err) { setError(err.message); }
  };

  const handleDuplicate = async (id, code) => {
    try { await api.duplicateCabinet(id, code + '-copy'); load(); } catch (err) { setError(err.message); }
  };

  const toggleSelect = (id, e) => {
    e.stopPropagation();
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(cabinets.map(c => c.cabinet_id)));
  const selectNone = () => setSelected(new Set());

  // Get unique thicknesses from selected cabinets' configs
  const thicknesses = useMemo(() => {
    const ts = new Set();
    const sel = selected.size > 0 ? cabinets.filter(c => selected.has(c.cabinet_id)) : cabinets;
    for (const c of sel) {
      const cfg = typeof c.config === 'object' ? c.config : {};
      ts.add(cfg.caseMaterialThickness || 18);
      ts.add(cfg.backPanelThickness || 6);
    }
    return [...ts].sort((a, b) => b - a);
  }, [cabinets, selected]);

  if (!user) return <Navigate to="/login" />;
  if (loading) return <div className="page" style={{ color: '#8a7e6a' }}>Loading...</div>;
  if (!job) return <div className="page" style={{ color: '#c05050' }}>Project not found</div>;

  const selIds = selected.size > 0 ? [...selected] : null; // null = all

  return (
    <div className="page">
      <div style={{ marginBottom: 8 }}><Link to="/projects" style={{ fontSize: 11, color: '#8a7e6a' }}>← Projects</Link></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 16, color: '#c49355' }}>{job.job_name}</h2>
          <div style={{ fontSize: 11, color: '#8a7e6a' }}>{job.job_code} • {cabinets.length} cabinet{cabinets.length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={() => setShowNew(!showNew)}>+ Add Cabinet</button>
        </div>
      </div>

      {showNew && (
        <form onSubmit={handleCreate} className="card" style={{ marginBottom: 16, display: 'grid', gridTemplateColumns: '120px 1fr 160px auto', gap: 12, alignItems: 'end' }}>
          <div><div className="input-label">Code</div><input className="input" placeholder="B1" value={newCab.code} onChange={e => setNewCab(p => ({ ...p, code: e.target.value }))} required /></div>
          <div><div className="input-label">Name</div><input className="input" placeholder="Sink Base" value={newCab.name} onChange={e => setNewCab(p => ({ ...p, name: e.target.value }))} /></div>
          <div><div className="input-label">Type</div>
            <select className="input" value={newCab.type} onChange={e => setNewCab(p => ({ ...p, type: e.target.value }))}>
              {['base','wall','tall','vanity','drawer_base','sink_base','corner_base','open_shelf','island'].map(t =>
                <option key={t} value={t}>{t.replace('_',' ')}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" type="submit">Add</button>
        </form>
      )}

      {error && <div style={{ color: '#c05050', fontSize: 11, marginBottom: 12 }}>{error}</div>}

      {/* ─── Export Bar ─── */}
      {cabinets.length > 0 && (
        <div className="card" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: '#8a7e6a', textTransform: 'uppercase', letterSpacing: '.5px' }}>
              Export DXF:
            </span>
            <button className="btn btn-ghost btn-sm" onClick={selectAll}>Select All</button>
            {selected.size > 0 && <button className="btn btn-ghost btn-sm" onClick={selectNone}>Clear</button>}
            <span style={{ fontSize: 10, color: '#8a7e6a' }}>
              {selected.size > 0 ? selected.size + ' selected' : 'all ' + cabinets.length + ' cabinets'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {thicknesses.map(t => (
              <a key={t} href={api.jobDxfUrl(jobId, t, selIds)}
                className="btn btn-ghost btn-sm"
                style={{ color: '#64a0dc', textDecoration: 'none' }}
                download>
                {t}mm ⬇
              </a>
            ))}
          </div>
        </div>
      )}

      {cabinets.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: '#8a7e6a', fontSize: 12 }}>
          No cabinets yet. Add one to start designing.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
          {cabinets.map(c => (
            <div key={c.cabinet_id} className="card"
              style={{ cursor: 'pointer', borderColor: selected.has(c.cabinet_id) ? '#64a0dc' : undefined }}
              onClick={() => nav(`/designer/${c.cabinet_id}`)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={selected.has(c.cabinet_id)}
                    onChange={e => toggleSelect(c.cabinet_id, e)}
                    onClick={e => e.stopPropagation()}
                    style={{ accentColor: '#64a0dc' }} />
                  <span style={{ fontWeight: 600, color: '#c49355' }}>{c.cabinet_code}</span>
                </div>
                <span className={`badge badge-user`}>{c.cabinet_type?.replace('_',' ')}</span>
              </div>
              <div style={{ fontSize: 12, marginBottom: 8 }}>{c.name || '—'}</div>
              <div style={{ fontSize: 11, color: '#8a7e6a' }}>
                {c.width}×{c.height}×{c.depth}mm • {c.part_count || 0} parts
                {c.door_style_name && <> • {c.door_style_name}</>}
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); handleDuplicate(c.cabinet_id, c.cabinet_code); }}>Dup</button>
                <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); handleDelete(c.cabinet_id); }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN PANEL
// ═══════════════════════════════════════════════════════════════════════════
function AdminPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listUsers().then(setUsers).catch(console.error).finally(() => setLoading(false));
  }, []);

  const changeRole = async (id, role) => {
    await api.updateUserRole(id, role);
    setUsers(u => u.map(x => x.user_id === id ? { ...x, role } : x));
  };

  const toggleActive = async (id, current) => {
    await api.toggleUserActive(id, !current);
    setUsers(u => u.map(x => x.user_id === id ? { ...x, is_active: !current } : x));
  };

  if (!user || !['admin','manager'].includes(user.role)) return <Navigate to="/" />;

  return (
    <div className="page">
      <h2 style={{ fontSize: 16, color: '#c49355', marginBottom: 20 }}>User Management</h2>
      {loading ? <div style={{ color: '#8a7e6a' }}>Loading...</div> : (
        <table>
          <thead><tr><th>Username</th><th>Email</th><th>Name</th><th>Role</th><th>Status</th><th>Last Login</th><th></th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.user_id}>
                <td style={{ fontWeight: 500 }}>{u.username}</td>
                <td style={{ fontSize: 11 }}>{u.email}</td>
                <td style={{ fontSize: 11 }}>{[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}</td>
                <td>
                  {user.role === 'admin' ? (
                    <select className="input" style={{ width: 100, padding: '3px 6px', fontSize: 10 }}
                      value={u.role} onChange={e => changeRole(u.user_id, e.target.value)}>
                      <option value="admin">admin</option>
                      <option value="manager">manager</option>
                      <option value="user">user</option>
                    </select>
                  ) : <span className={`badge badge-${u.role}`}>{u.role}</span>}
                </td>
                <td><span style={{ color: u.is_active ? '#7aba6a' : '#c05050', fontSize: 11 }}>{u.is_active ? 'Active' : 'Disabled'}</span></td>
                <td style={{ fontSize: 10, color: '#8a7e6a' }}>{u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}</td>
                <td>{user.role === 'admin' && u.user_id !== user.userId && (
                  <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(u.user_id, u.is_active)}>
                    {u.is_active ? 'Disable' : 'Enable'}
                  </button>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DESIGNER PAGE — renders full CabinetStudio component
// ═══════════════════════════════════════════════════════════════════════════
function DesignerPage() {
  const { cabinetId } = useParams();
  const { user } = useAuth();

  return (
    <div style={{ maxWidth: '100%' }}>
      {!user && (
        <div style={{ background: '#252119', padding: '8px 24px', borderBottom: '1px solid #332d24',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#8a7e6a' }}>
            Guest mode — design freely, copy cut lists, all works offline. <Link to="/login">Sign in</Link> to save projects & export DXF.
          </span>
        </div>
      )}
      <CabinetStudio
        cabinetId={cabinetId || null}
        user={user}
        api={user ? api : null}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LANDING
// ═══════════════════════════════════════════════════════════════════════════
function LandingPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  return (
    <div style={{ textAlign: 'center', padding: '80px 24px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 300, color: '#c49355', letterSpacing: -1, marginBottom: 8 }}>
        ◧ Cabinet Studio
      </h1>
      <p style={{ fontSize: 13, color: '#8a7e6a', maxWidth: 500, margin: '0 auto 32px', lineHeight: 1.7 }}>
        Parametric frameless cabinet design with automatic cut lists, dado/rabbet joinery,
        shelf pin layouts, and DXF export for Vectric Aspire.
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <button className="btn btn-primary" onClick={() => nav('/designer')} style={{ padding: '12px 28px', fontSize: 13 }}>
          Open Designer
        </button>
        {!user && (
          <button className="btn btn-ghost" onClick={() => nav('/login')} style={{ padding: '12px 28px', fontSize: 13 }}>
            Sign In to Save
          </button>
        )}
        {user && (
          <button className="btn btn-ghost" onClick={() => nav('/projects')} style={{ padding: '12px 28px', fontSize: 13 }}>
            My Projects
          </button>
        )}
      </div>
      <div style={{ marginTop: 60, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, maxWidth: 700, margin: '60px auto 0' }}>
        {[
          ['Full Parametric', 'Every dimension, dado depth, shelf pin spacing, door overlay — all configurable in mm.'],
          ['10 Door Styles', 'Slab, Shaker, Raised Panel, Cathedral, Glass, Beadboard, Mullion, Louvered, and more.'],
          ['DXF Export', 'Each part on named layers (Profile_Cut, Dado, Shelf_Pins...) ready for Vectric Aspire toolpaths.'],
        ].map(([title, desc], i) => (
          <div key={i} className="card">
            <div style={{ fontSize: 11, fontWeight: 600, color: '#c49355', marginBottom: 6 }}>{title}</div>
            <div style={{ fontSize: 10, color: '#8a7e6a', lineHeight: 1.6 }}>{desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// APP ROOT
// ═══════════════════════════════════════════════════════════════════════════
export default function App() {
  return (
    <AuthProvider>
      <style>{CSS}</style>
      <NavBar />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/project/:jobId" element={<ProjectDetailPage />} />
        <Route path="/designer" element={<DesignerPage />} />
        <Route path="/designer/:cabinetId" element={<DesignerPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </AuthProvider>
  );
}
