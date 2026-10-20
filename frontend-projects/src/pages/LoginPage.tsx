import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { authService } from '../api/authService';
import { relayAuthSnapshotForSwitch } from '../utils/authStorage';
import { APP_KIND, PROJECTS_APP_URL } from '../config/apps';
import { LightPullThemeSwitcher } from '../components/ui/LightPullThemeSwitcher';

// ── Animated character internals ─────────────────────────────────────────────

interface EyeBallProps {
  size?: number;
  pupilSize?: number;
  maxDistance?: number;
  eyeColor?: string;
  pupilColor?: string;
  isBlinking?: boolean;
  forceLookX?: number;
  forceLookY?: number;
}

function EyeBall({
  size = 48,
  pupilSize = 16,
  maxDistance = 10,
  eyeColor = 'white',
  pupilColor = 'black',
  isBlinking = false,
  forceLookX,
  forceLookY,
}: EyeBallProps) {
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const eyeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => { setMouseX(e.clientX); setMouseY(e.clientY); };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  const pos = (() => {
    if (forceLookX !== undefined && forceLookY !== undefined) return { x: forceLookX, y: forceLookY };
    if (!eyeRef.current) return { x: 0, y: 0 };
    const r = eyeRef.current.getBoundingClientRect();
    const dx = mouseX - (r.left + r.width / 2);
    const dy = mouseY - (r.top + r.height / 2);
    const dist = Math.min(Math.sqrt(dx ** 2 + dy ** 2), maxDistance);
    const angle = Math.atan2(dy, dx);
    return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist };
  })();

  return (
    <div
      ref={eyeRef}
      className="rounded-full flex items-center justify-center"
      style={{
        width: `${size}px`,
        height: isBlinking ? '2px' : `${size}px`,
        backgroundColor: eyeColor,
        overflow: 'hidden',
        transition: 'height 0.1s ease',
      }}
    >
      {!isBlinking && (
        <div
          className="rounded-full"
          style={{
            width: `${pupilSize}px`,
            height: `${pupilSize}px`,
            backgroundColor: pupilColor,
            transform: `translate(${pos.x}px, ${pos.y}px)`,
            transition: 'transform 0.1s ease-out',
          }}
        />
      )}
    </div>
  );
}

function Pupil({
  size = 12,
  maxDistance = 5,
  pupilColor = 'black',
  forceLookX,
  forceLookY,
}: { size?: number; maxDistance?: number; pupilColor?: string; forceLookX?: number; forceLookY?: number }) {
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => { setMouseX(e.clientX); setMouseY(e.clientY); };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  const pos = (() => {
    if (forceLookX !== undefined && forceLookY !== undefined) return { x: forceLookX, y: forceLookY };
    if (!ref.current) return { x: 0, y: 0 };
    const r = ref.current.getBoundingClientRect();
    const dx = mouseX - (r.left + r.width / 2);
    const dy = mouseY - (r.top + r.height / 2);
    const dist = Math.min(Math.sqrt(dx ** 2 + dy ** 2), maxDistance);
    const angle = Math.atan2(dy, dx);
    return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist };
  })();

  return (
    <div
      ref={ref}
      className="rounded-full"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: pupilColor,
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        transition: 'transform 0.1s ease-out',
      }}
    />
  );
}

// ── Characters panel ──────────────────────────────────────────────────────────

function CharactersPanel({ isTyping, showPassword, password }: {
  isTyping: boolean;
  showPassword: boolean;
  password: string;
}) {
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const [purpleBlinking, setPurpleBlinking] = useState(false);
  const [blackBlinking, setBlackBlinking] = useState(false);
  const [lookingAtEachOther, setLookingAtEachOther] = useState(false);
  const [purplePeeking, setPurplePeeking] = useState(false);
  const purpleRef = useRef<HTMLDivElement>(null);
  const blackRef = useRef<HTMLDivElement>(null);
  const yellowRef = useRef<HTMLDivElement>(null);
  const orangeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => { setMouseX(e.clientX); setMouseY(e.clientY); };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // Blinking loops
  useEffect(() => {
    const blink = (set: (v: boolean) => void): ReturnType<typeof setTimeout> => {
      const t = setTimeout(() => {
        set(true);
        setTimeout(() => { set(false); blink(set); }, 150);
      }, Math.random() * 4000 + 3000);
      return t;
    };
    const t = blink(setPurpleBlinking);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const blink = (set: (v: boolean) => void): ReturnType<typeof setTimeout> => {
      const t = setTimeout(() => {
        set(true);
        setTimeout(() => { set(false); blink(set); }, 150);
      }, Math.random() * 4000 + 3000);
      return t;
    };
    const t = blink(setBlackBlinking);
    return () => clearTimeout(t);
  }, []);

  // Look at each other briefly when typing starts
  useEffect(() => {
    if (!isTyping) { setLookingAtEachOther(false); return; }
    setLookingAtEachOther(true);
    const t = setTimeout(() => setLookingAtEachOther(false), 800);
    return () => clearTimeout(t);
  }, [isTyping]);

  // Purple peeks when password is visible
  useEffect(() => {
    if (!password || !showPassword) { setPurplePeeking(false); return; }
    const t = setTimeout(() => {
      setPurplePeeking(true);
      setTimeout(() => setPurplePeeking(false), 800);
    }, Math.random() * 3000 + 2000);
    return () => clearTimeout(t);
  }, [password, showPassword, purplePeeking]);

  const calcPos = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (!ref.current) return { faceX: 0, faceY: 0, bodySkew: 0 };
    const r = ref.current.getBoundingClientRect();
    const dx = mouseX - (r.left + r.width / 2);
    const dy = mouseY - (r.top + r.height / 3);
    return {
      faceX: Math.max(-15, Math.min(15, dx / 20)),
      faceY: Math.max(-10, Math.min(10, dy / 30)),
      bodySkew: Math.max(-6, Math.min(6, -dx / 120)),
    };
  };

  const p = calcPos(purpleRef);
  const b = calcPos(blackRef);
  const y = calcPos(yellowRef);
  const o = calcPos(orangeRef);

  const passwordActive = password.length > 0;
  const coveringEyes = passwordActive && !showPassword;

  return (
    <div
      className="relative hidden lg:flex flex-col justify-center overflow-hidden"
    >
      <div className="relative z-20 flex items-end justify-center w-full" style={{ height: 'min(380px, 55%)' }}>
        <div className="relative w-full max-w-[520px]" style={{ height: '100%' }}>

          {/* Purple — back layer */}
          <div
            ref={purpleRef}
            className="absolute bottom-0 transition-all duration-700 ease-in-out"
            style={{
              left: '70px',
              width: '175px',
              height: coveringEyes ? '420px' : '380px',
              backgroundColor: '#7C3AED',
              borderRadius: '10px 10px 0 0',
              zIndex: 1,
              transform: passwordActive && showPassword
                ? 'skewX(0deg)'
                : coveringEyes
                  ? `skewX(${(p.bodySkew || 0) - 12}deg) translateX(38px)`
                  : `skewX(${p.bodySkew || 0}deg)`,
              transformOrigin: 'bottom center',
            }}
          >
            <div
              className="absolute flex gap-7 transition-all duration-700 ease-in-out"
              style={{
                left: passwordActive && showPassword ? '18px' : lookingAtEachOther ? '52px' : `${43 + p.faceX}px`,
                top: passwordActive && showPassword ? '32px' : lookingAtEachOther ? '62px' : `${38 + p.faceY}px`,
              }}
            >
              {[0, 1].map(i => (
                <EyeBall key={i} size={18} pupilSize={7} maxDistance={5}
                  eyeColor="#f0f0f4" pupilColor="#1a1a2e" isBlinking={purpleBlinking}
                  forceLookX={passwordActive && showPassword ? (purplePeeking ? 4 : -4) : lookingAtEachOther ? 3 : undefined}
                  forceLookY={passwordActive && showPassword ? (purplePeeking ? 5 : -4) : lookingAtEachOther ? 4 : undefined}
                />
              ))}
            </div>
          </div>

          {/* Black — middle */}
          <div
            ref={blackRef}
            className="absolute bottom-0 transition-all duration-700 ease-in-out"
            style={{
              left: '235px',
              width: '115px',
              height: '295px',
              backgroundColor: '#1e1e2e',
              borderRadius: '8px 8px 0 0',
              zIndex: 2,
              transform: passwordActive && showPassword
                ? 'skewX(0deg)'
                : lookingAtEachOther
                  ? `skewX(${(b.bodySkew || 0) * 1.5 + 10}deg) translateX(18px)`
                  : coveringEyes
                    ? `skewX(${(b.bodySkew || 0) * 1.5}deg)`
                    : `skewX(${b.bodySkew || 0}deg)`,
              transformOrigin: 'bottom center',
            }}
          >
            <div
              className="absolute flex gap-5 transition-all duration-700 ease-in-out"
              style={{
                left: passwordActive && showPassword ? '8px' : lookingAtEachOther ? '30px' : `${24 + b.faceX}px`,
                top: passwordActive && showPassword ? '26px' : lookingAtEachOther ? '10px' : `${30 + b.faceY}px`,
              }}
            >
              {[0, 1].map(i => (
                <EyeBall key={i} size={16} pupilSize={6} maxDistance={4}
                  eyeColor="#f0f0f4" pupilColor="#1e1e2e" isBlinking={blackBlinking}
                  forceLookX={passwordActive && showPassword ? -4 : lookingAtEachOther ? 0 : undefined}
                  forceLookY={passwordActive && showPassword ? -4 : lookingAtEachOther ? -4 : undefined}
                />
              ))}
            </div>
          </div>

          {/* Orange — front left */}
          <div
            ref={orangeRef}
            className="absolute bottom-0 transition-all duration-700 ease-in-out"
            style={{
              left: '0px',
              width: '230px',
              height: '190px',
              backgroundColor: '#e8621a',
              borderRadius: '115px 115px 0 0',
              zIndex: 3,
              transform: passwordActive && showPassword ? 'skewX(0deg)' : `skewX(${o.bodySkew || 0}deg)`,
              transformOrigin: 'bottom center',
            }}
          >
            <div
              className="absolute flex gap-7 transition-all duration-200 ease-out"
              style={{
                left: passwordActive && showPassword ? '46px' : `${78 + (o.faceX || 0)}px`,
                top: passwordActive && showPassword ? '80px' : `${86 + (o.faceY || 0)}px`,
              }}
            >
              {[0, 1].map(i => (
                <Pupil key={i} size={12} maxDistance={5} pupilColor="#1a1a2e"
                  forceLookX={passwordActive && showPassword ? -5 : undefined}
                  forceLookY={passwordActive && showPassword ? -4 : undefined}
                />
              ))}
            </div>
          </div>

          {/* Yellow — front right */}
          <div
            ref={yellowRef}
            className="absolute bottom-0 transition-all duration-700 ease-in-out"
            style={{
              left: '298px',
              width: '135px',
              height: '220px',
              backgroundColor: '#F59E0B',
              borderRadius: '67px 67px 0 0',
              zIndex: 4,
              transform: passwordActive && showPassword ? 'skewX(0deg)' : `skewX(${y.bodySkew || 0}deg)`,
              transformOrigin: 'bottom center',
            }}
          >
            <div
              className="absolute flex gap-5 transition-all duration-200 ease-out"
              style={{
                left: passwordActive && showPassword ? '18px' : `${49 + (y.faceX || 0)}px`,
                top: passwordActive && showPassword ? '32px' : `${38 + (y.faceY || 0)}px`,
              }}
            >
              {[0, 1].map(i => (
                <Pupil key={i} size={12} maxDistance={5} pupilColor="#1a1a2e"
                  forceLookX={passwordActive && showPassword ? -5 : undefined}
                  forceLookY={passwordActive && showPassword ? -4 : undefined}
                />
              ))}
            </div>
            <div
              className="absolute rounded-full transition-all duration-200 ease-out"
              style={{
                width: '72px',
                height: '4px',
                backgroundColor: '#1a1a2e',
                left: passwordActive && showPassword ? '8px' : `${38 + (y.faceX || 0)}px`,
                top: passwordActive && showPassword ? '85px' : `${85 + (y.faceY || 0)}px`,
              }}
            />
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Login page ────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 500,
  color: 'var(--text-1, #1d1d1f)',
};

const inputStyle: React.CSSProperties = {
  height: '46px',
  padding: '0 20px',
  borderRadius: '9999px',
  border: '1px solid var(--border, #e0e0e5)',
  background: 'var(--surface, #f9f9fb)',
  color: 'var(--text-1, #1d1d1f)',
  fontSize: '14px',
  fontFamily: 'inherit',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const submitStyle = (disabled: boolean): React.CSSProperties => ({
  height: '46px',
  borderRadius: '9999px',
  border: 'none',
  background: '#e8621a',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 600,
  fontFamily: 'inherit',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.5 : 1,
  marginTop: '4px',
  transition: 'opacity 0.15s',
  width: '100%',
  outline: 'none',
});

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const { login, logout, user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const projectsAppUrl = PROJECTS_APP_URL;
  const justLoggedIn = useRef(false);

  useEffect(() => {
    logout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const redirectToProjectsHome = useCallback(() => {
    // Only leave this origin when login ran on the RH app.
    // Reloading localhost:3000 from itself sent people back to /login with no error.
    if (APP_KIND !== 'projects' && projectsAppUrl) {
      relayAuthSnapshotForSwitch();
      window.location.href = projectsAppUrl;
      return;
    }
    navigate('/accueil', { replace: true });
  }, [navigate, projectsAppUrl]);

  useEffect(() => {
    if (!isAuthenticated || !justLoggedIn.current) return;
    if (user?.mustChangePassword) {
      navigate('/change-password', { replace: true });
      return;
    }
    if (user?.isClient) {
      navigate('/client/accueil', { replace: true });
      return;
    }
    redirectToProjectsHome();
  }, [isAuthenticated, user?.mustChangePassword, user?.isClient, navigate, redirectToProjectsHome]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authService.login({ username: username.trim(), password });
      if (response.data.success && response.data.data) {
        justLoggedIn.current = true;
        login(response.data.data);
        return;
      }
      setError(response.data.message || 'Identifiants invalides');
      setLoading(false);
      return;
    } catch {
      // fall through to client login
    }

    try {
      const clientRes = await authService.clientLogin(username.trim(), password);
      if (clientRes.data.success && clientRes.data.data) {
        const c = clientRes.data.data;
        justLoggedIn.current = true;
        login({
          compteId: 0,
          employeId: 0,
          username: c.loginClient,
          nom: c.nom,
          prenom: '',
          email: c.email || '',
          roles: c.roles,
          permissions: c.permissions,
          mustChangePassword: false,
          genre: null,
          message: '',
          imageUrl: c.logoUrl || null,
          token: c.token,
          tokenExpiresAt: c.tokenExpiresAt,
          isClient: true,
          clientId: c.clientId,
          clientPages: c.clientPages ?? [],
        });
        return;
      }
      setError(clientRes.data.message || 'Identifiants invalides');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Identifiants invalides');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen grid lg:grid-cols-2 bg-[var(--bg)] transition-colors duration-300">
      {/* ── Top bar ── */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        {/* Logo haut-gauche */}
        <div style={{
          position: 'absolute', left: '20px', top: '14px',
          display: 'flex', alignItems: 'center',
          pointerEvents: 'auto',
        }}>
          <img src={`${import.meta.env.BASE_URL}antigone-icon.svg`} alt="Antigone" style={{ width: '80px', height: '80px' }} />
        </div>
        {/* Switcher thème haut-centre */}
        <div style={{ pointerEvents: 'auto' }}>
          <LightPullThemeSwitcher />
        </div>
      </div>

      <CharactersPanel isTyping={isTyping} showPassword={showPassword} password={password} />

      {/* Form side */}
      <div className="flex items-center justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-[400px]">

          {/* Mobile logo */}
          <motion.div
            className="lg:hidden flex items-center gap-3 justify-center mb-10"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#e8621a' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-lg font-bold" style={{ color: 'var(--text-1, #1d1d1f)' }}>Antigone</span>
          </motion.div>

          <motion.div
            className="mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.05 }}
          >
            <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-1, #1d1d1f)', margin: '0 0 6px' }}>
              Bon retour !
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-2, #6e6e73)', margin: 0 }}>
              Connectez-vous à votre espace Antigone
            </p>
          </motion.div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <motion.div
              style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: 0.15 }}
            >
              <label htmlFor="username" style={labelStyle}>Nom d'utilisateur</label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                placeholder="Entrez votre identifiant"
                value={username}
                onChange={e => setUsername(e.target.value)}
                onFocus={() => setIsTyping(true)}
                onBlur={() => setIsTyping(false)}
                style={inputStyle}
              />
            </motion.div>

            <motion.div
              style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: 0.25 }}
            >
              <label htmlFor="password" style={labelStyle}>Mot de passe</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ ...inputStyle, paddingRight: '48px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{
                    position: 'absolute',
                    right: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-3, #6e6e73)',
                    display: 'flex',
                    alignItems: 'center',
                    outline: 'none',
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </motion.div>

            <motion.div
              style={{ textAlign: 'right' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <Link to="/forgot-password" style={{ fontSize: '13px', color: '#e8621a', textDecoration: 'none', fontWeight: 500 }}>
                Mot de passe oublié ?
              </Link>
            </motion.div>

            {error && (
              <motion.p
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                style={{
                  fontSize: '13px',
                  color: '#ff3b30',
                  background: 'rgba(255,59,48,0.08)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  margin: 0,
                }}
              >
                {error}
              </motion.p>
            )}

            <motion.button
              type="submit"
              disabled={loading}
              style={submitStyle(loading)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: 0.35 }}
              whileHover={loading ? {} : { opacity: 0.88 }}
              whileTap={loading ? {} : { scale: 0.98 }}
            >
              {loading ? 'Connexion…' : 'Se connecter'}
            </motion.button>
          </form>

          <motion.p
            style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px', color: 'var(--text-3, #9c9a94)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.45 }}
          >
            © 2026 Antigone-IT. Tous droits réservés.
          </motion.p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

