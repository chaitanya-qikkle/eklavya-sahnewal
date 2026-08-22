import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { isAuthenticated, login, storeAuthData } from '../../../services/authService';
import { setCredentials } from '../../../store/slices/authSlice';
import { Eye, EyeOff, User, Lock, AlertCircle } from 'lucide-react';

const toFiniteNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const normalizeUserFromLoginResponse = (response, fallbackUsername) => {
  const direct = response?.user_details;
  if (direct && typeof direct === 'object') return direct;
  const legacyUser = response?.user;
  if (legacyUser && typeof legacyUser === 'object') return legacyUser;
  const row = Array.isArray(response?.data) ? response.data[0] : null;
  if (row && typeof row === 'object') {
    const roleId = toFiniteNumber(row?.ROLE_ID ?? row?.role_id);
    return {
      user_id: toFiniteNumber(row?.USER_ID ?? row?.user_id),
      username: row?.USERNAME ?? row?.username ?? fallbackUsername,
      first_name: row?.FIRST_NAME ?? row?.first_name,
      last_name: row?.LAST_NAME ?? row?.last_name,
      email: row?.EMAIL_ID ?? row?.email,
      role_id: roleId,
      role: row?.ROLE ?? row?.role ?? row?.ROLE_NAME ?? row?.role_name,
    };
  }
  return { username: fallbackUsername };
};

const features = [
  { title: 'Plan Your Work',        description: 'Identify goals and create structured work plans efficiently.', img: '/Images/tab1.png' },
  { title: 'Work on Your Plan',     description: 'Execute milestones and strategies into measurable results.', img: '/Images/tab2.png' },
  { title: 'Get Asset Utilized',    description: 'Maximize asset efficiency across your entire operation.', img: '/Images/tab3.png' },
  { title: 'Locate Your Container', description: 'Track & trace every shipment with a single click.', img: '/Images/tab4.png' },
  { title: 'KPI Reporting',         description: 'Measure, organize and analyse key performance indicators.', img: '/Images/tab5.png' },
];

const SignIn = () => {
  const navigate  = useNavigate();
  const dispatch  = useDispatch();
  const [username, setUsername]         = useState('');
  const [password, setPassword]         = useState('');
  const [isLoading, setIsLoading]       = useState(false);
  const [ready, setReady]               = useState(false);
  const [error, setError]               = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const cardRef = useRef(null);

  useEffect(() => { setTimeout(() => setReady(true), 80); }, []);

  useEffect(() => {
    if (isAuthenticated()) navigate('/machine/equipment-status', { replace: true });
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!username || !password) { setError('Please enter both username and password'); return; }
    setIsLoading(true);
    try {
      const response = await login(username, password);
      if (response.status === 'success') {
        const token        = response.access_token || response.accessToken || response.token || response.data?.token;
        const refreshToken = response.refresh_token || response.refreshToken;
        const userData     = normalizeUserFromLoginResponse(response, username);
        const roleId       = userData?.role_id ?? userData?.ROLE_ID ?? userData?.roleId;
        if (!token)         { setError('Login failed: missing access token from server'); return; }
        if (roleId == null) { setError('Login failed: your account has no role assigned'); return; }
        storeAuthData(userData, token, refreshToken);
        dispatch(setCredentials({ user: userData, token }));
        navigate('/machine/equipment-status');
      } else {
        setError(response.message || response.detail || 'Invalid credentials. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 w-full h-full font-sans overflow-hidden">

      {/* ── Background image + overlays ── */}
      <div className="absolute inset-0 z-0">
        <img
          src="/Images/bgimageold.png"
          alt=""
          className="w-full h-full object-cover"
          style={{ filter: 'brightness(0.45) saturate(0.8)' }}
        />
        {/* subtle top-to-bottom darkening */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(2,6,23,0.72) 0%, rgba(2,6,23,0.30) 40%, rgba(2,6,23,0.82) 100%)',
          }}
        />
        {/* Very faint blue-slate tint to give a premium "control-room" feel */}
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(14,42,78,0.35) 0%, transparent 70%)' }}
        />
      </div>

      {/* Scrollable main layer */}
      <div className="relative z-20 w-full h-full overflow-y-auto flex flex-col">

        {/* ── TOP BAR ── */}
        <header className="flex items-center justify-between px-8 py-5 flex-shrink-0">

          {/* GDL logo — no background box */}
          <div
            className={`transition-all duration-700 ease-out ${ready ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-6'}`}
            style={{ transitionDelay: '60ms' }}
          >
            <img
              src="/Images/logo.png"
              alt="Qikkle"
              className="h-10 w-auto object-contain drop-shadow-xl hover:scale-105 transition-transform duration-300"
              style={{ filter: 'drop-shadow(0 2px 12px rgba(0,0,0,0.6)) brightness(1.08)' }}
            />
          </div>

          {/* Eklavya logo — no background box */}
          <div
            className={`transition-all duration-700 ease-out ${ready ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-6'}`}
            style={{ transitionDelay: '60ms' }}
          >
            <img
              src="/Images/eklaya.png"
              alt="Eklavya"
              className="h-16 w-auto object-contain drop-shadow-xl hover:scale-105 transition-transform duration-300"
              style={{ filter: 'drop-shadow(0 2px 12px rgba(0,0,0,0.6)) brightness(1.08)' }}
            />
          </div>
        </header>

        {/* ── CENTRE CONTENT ── */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 gap-8 pb-4">

          {/* ── LOGIN CARD ── */}
          <div
            className={`w-full max-w-[400px] transition-all duration-700 ease-out ${ready ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
            style={{ transitionDelay: '260ms' }}
          >
            <div
              ref={cardRef}
              className="relative rounded-2xl overflow-hidden"
              style={{
                background: 'rgba(255,255,255,0.055)',
                backdropFilter: 'blur(28px) saturate(160%)',
                WebkitBackdropFilter: 'blur(28px) saturate(160%)',
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow:
                  '0 0 0 1px rgba(255,255,255,0.06), 0 24px 64px rgba(0,0,0,0.55), 0 8px 24px rgba(0,0,0,0.30)',
              }}
            >
              {/* Ultra-thin top accent — slate-blue not red */}
              <div
                className="absolute top-0 left-0 right-0 h-[2px]"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, #3b82f6 30%, #60a5fa 50%, #3b82f6 70%, transparent 100%)',
                }}
              />

              <div className="px-9 pt-9 pb-8">

                {/* GDL logo */}
                <div className="flex flex-col items-center gap-3 mb-7">
                  <img
                    src="/Images/gdl_logo.png"
                    alt="Gateway Distriparks"
                    className="h-20 w-auto object-contain"
                    style={{ filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.45)) brightness(1.12)' }}
                  />
                  <div className="text-center">
                    <h2 className="text-white text-[22px] font-semibold tracking-tight" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.4)' }}>
                      Welcome Back
                    </h2>
                    <p className="text-slate-400 text-xs mt-1 tracking-wide">Sign in to start your session</p>
                  </div>
                </div>

                {/* Divider */}
                <div className="w-full h-px mb-6" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)' }} />

                <form onSubmit={handleLogin} className="space-y-4" autoComplete="off">

                  {/* Username */}
                  <div className="relative">
                    <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focusedField === 'user' ? 'text-blue-400' : 'text-slate-500'}`}>
                      <User size={15} strokeWidth={2} />
                    </div>
                    <input
                      type="text"
                      placeholder="User Name"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      onFocus={() => setFocusedField('user')}
                      onBlur={() => setFocusedField(null)}
                      className="w-full pl-10 pr-4 py-3.5 rounded-xl text-white text-sm placeholder-slate-500 outline-none transition-all duration-250"
                      style={{
                        background: focusedField === 'user' ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.06)',
                        border: focusedField === 'user'
                          ? '1px solid rgba(96,165,250,0.55)'
                          : '1px solid rgba(255,255,255,0.10)',
                        boxShadow: focusedField === 'user'
                          ? '0 0 0 3px rgba(59,130,246,0.12)'
                          : 'none',
                      }}
                    />
                  </div>

                  {/* Password */}
                  <div className="relative">
                    <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focusedField === 'pass' ? 'text-blue-400' : 'text-slate-500'}`}>
                      <Lock size={15} strokeWidth={2} />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocusedField('pass')}
                      onBlur={() => setFocusedField(null)}
                      className="w-full pl-10 pr-12 py-3.5 rounded-xl text-white text-sm placeholder-slate-500 outline-none transition-all duration-250"
                      style={{
                        background: focusedField === 'pass' ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.06)',
                        border: focusedField === 'pass'
                          ? '1px solid rgba(96,165,250,0.55)'
                          : '1px solid rgba(255,255,255,0.10)',
                        boxShadow: focusedField === 'pass'
                          ? '0 0 0 3px rgba(59,130,246,0.12)'
                          : 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors focus:outline-none"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>

                  {/* Error */}
                  {error && (
                    <div
                      className="flex items-start gap-2.5 px-4 py-3 rounded-xl text-xs text-red-300 border"
                      style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.22)' }}
                    >
                      <AlertCircle size={13} className="flex-shrink-0 mt-0.5 text-red-400" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Login button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="relative w-full py-3.5 mt-1 rounded-xl font-semibold text-white text-sm tracking-widest uppercase overflow-hidden transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 50%, #1d4ed8 100%)',
                      boxShadow: '0 4px 16px rgba(29,78,216,0.40), 0 1px 0 rgba(255,255,255,0.12) inset',
                      transition: 'box-shadow 0.25s, transform 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isLoading) {
                        e.currentTarget.style.boxShadow = '0 8px 28px rgba(29,78,216,0.60), 0 1px 0 rgba(255,255,255,0.15) inset';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(29,78,216,0.40), 0 1px 0 rgba(255,255,255,0.12) inset';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    {/* Subtle shine sweep */}
                    <span
                      className="absolute inset-0 pointer-events-none"
                      style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.10) 50%, transparent 60%)' }}
                    />
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        Signing in…
                      </span>
                    ) : 'Login'}
                  </button>

                </form>
              </div>
            </div>
          </div>

          {/* ── FEATURE CARDS ── */}
          <div
            className={`w-full max-w-5xl transition-all duration-700 ease-out ${ready ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
            style={{ transitionDelay: '480ms' }}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {features.map((item, i) => (
                <div
                  key={i}
                  className="group relative rounded-2xl overflow-hidden cursor-default"
                  style={{
                    opacity: ready ? 1 : 0,
                    transform: ready ? 'translateY(0)' : 'translateY(18px)',
                    transition: `opacity 0.55s ease ${540 + i * 65}ms, transform 0.55s ease ${540 + i * 65}ms`,
                    background: 'rgba(255,255,255,0.045)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.28)',
                  }}
                >
                  {/* hover overlay — cool blue-white, not red */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-350 pointer-events-none"
                    style={{
                      background: 'linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(255,255,255,0.04) 100%)',
                      border: '1px solid rgba(96,165,250,0.22)',
                    }}
                  />
                  {/* top accent on hover */}
                  <div
                    className="absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: 'linear-gradient(90deg, #3b82f6, #60a5fa, #3b82f6)' }}
                  />

                  <div className="relative flex flex-col items-center text-center gap-3 p-4 pt-5">
                    {/* Icon — pure image, no bg circle */}
                    <img
                      src={item.img}
                      alt={item.title}
                      className="h-11 w-11 object-contain group-hover:scale-110 transition-transform duration-300"
                      style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.40)) brightness(1.05)' }}
                    />
                    <div>
                      <h3 className="text-white/90 font-semibold text-xs mb-1 group-hover:text-white transition-colors leading-tight">{item.title}</h3>
                      <p className="text-slate-500 text-[10px] leading-relaxed group-hover:text-slate-400 transition-colors">{item.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── FOOTER ── */}
          <p
            className={`text-slate-600 text-[11px] text-center pb-2 transition-all duration-700 ${ready ? 'opacity-100' : 'opacity-0'}`}
            style={{ transitionDelay: '900ms' }}
          >
            Copyright &copy; 2019–{new Date().getFullYear()}&nbsp;
            <span className="text-slate-400 font-medium">Qikkle Solutions Pvt Ltd</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignIn;
