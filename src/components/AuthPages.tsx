import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { ListTodo, LogIn, User, Lock, Mail, AlertCircle } from 'lucide-react';
import { authApi, setStoredToken } from '../api';
import { User as AppUser } from '../types';

interface AuthShellProps {
  isDarkMode: boolean;
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

export function AuthShell({ isDarkMode, children, title, subtitle }: AuthShellProps) {
  return (
    <div className={`min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div className={`absolute inset-0 transition-opacity duration-500 pointer-events-none ${isDarkMode ? 'opacity-40' : 'opacity-40'}`}>
        <div className={`absolute top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full filter blur-[120px] transition-colors duration-500 ${isDarkMode ? 'bg-indigo-600' : 'bg-indigo-200'}`} />
        <div className={`absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full filter blur-[120px] transition-colors duration-500 ${isDarkMode ? 'bg-fuchsia-600' : 'bg-fuchsia-200'}`} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={`w-full max-w-md border backdrop-blur-md rounded-[2.5rem] p-8 transition-all duration-300 shadow-2xl relative z-10 ${
          isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white/90 border-slate-200/80 shadow-slate-200/60'
        }`}
      >
        <div className="flex items-center justify-center mb-5">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl shadow-lg shadow-indigo-500/20">
            <ListTodo className="w-8 h-8" />
          </div>
        </div>
        <h1 className={`text-2xl font-bold text-center tracking-tight mb-1 transition-colors duration-300 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          {title}
        </h1>
        <p className={`text-sm text-center mb-6 transition-colors duration-300 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          {subtitle}
        </p>
        {children}
      </motion.div>
    </div>
  );
}

interface LoginPageProps {
  isDarkMode: boolean;
  onLogin: (user: AppUser) => void;
  onSwitchToRegister: () => void;
}

export function LoginPage({ isDarkMode, onLogin, onSwitchToRegister }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const inputClass = `w-full pl-10 pr-4 py-3 rounded-xl text-sm transition-all ${
    isDarkMode
      ? 'bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-white/25'
      : 'bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-300'
  }`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, user } = await authApi.login(username.trim(), password);
      setStoredToken(token);
      onLogin(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell isDarkMode={isDarkMode} title="Welcome Back" subtitle="Sign in to your private task workspace">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className={`text-[10px] font-bold uppercase font-mono block mb-1.5 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Username</label>
          <div className="relative">
            <User className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`} />
            <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="your_username" className={inputClass} autoComplete="username" />
          </div>
        </div>

        <div>
          <label className={`text-[10px] font-bold uppercase font-mono block mb-1.5 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Password</label>
          <div className="relative">
            <Lock className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`} />
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={inputClass} autoComplete="current-password" />
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={loading}
          className={`w-full py-3.5 px-4 font-semibold rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 ${
            isDarkMode ? 'bg-white hover:bg-slate-100 text-slate-950' : 'bg-slate-900 hover:bg-slate-800 text-white'
          }`}
        >
          <LogIn className="w-4 h-4" />
          {loading ? 'Signing in...' : 'Sign In'}
        </motion.button>
      </form>

      <p className={`text-center text-xs mt-5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        Don&apos;t have an account?{' '}
        <button type="button" onClick={onSwitchToRegister} className="text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer">
          Create one
        </button>
      </p>
    </AuthShell>
  );
}

interface RegisterPageProps {
  isDarkMode: boolean;
  onRegister: (user: AppUser) => void;
  onSwitchToLogin: () => void;
}

export function RegisterPage({ isDarkMode, onRegister, onSwitchToLogin }: RegisterPageProps) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');

  const inputClass = (field?: string) =>
    `w-full pl-10 pr-4 py-3 rounded-xl text-sm transition-all ${
      fieldErrors[field ?? '']
        ? 'border-rose-500/50 ring-1 ring-rose-500/30'
        : ''
    } ${
      isDarkMode
        ? 'bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-white/25'
        : 'bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-300'
    }`;

  const usernameCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkUsernameAvailability = async (value: string) => {
    if (value.trim().length < 3) {
      setUsernameStatus('idle');
      return;
    }
    setUsernameStatus('checking');
    try {
      const result = await authApi.checkUsername(value.trim());
      if (result.error) {
        setFieldErrors((prev) => ({ ...prev, username: result.error! }));
        setUsernameStatus('idle');
      } else {
        setUsernameStatus(result.available ? 'available' : 'taken');
        if (!result.available) {
          setFieldErrors((prev) => ({ ...prev, username: 'This username is already taken.' }));
        } else {
          setFieldErrors((prev) => {
            const next = { ...prev };
            delete next.username;
            return next;
          });
        }
      }
    } catch {
      setUsernameStatus('idle');
    }
  };

  const handleUsernameChange = (value: string) => {
    setUsername(value);
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.username;
      return next;
    });
    if (usernameCheckTimer.current) clearTimeout(usernameCheckTimer.current);
    usernameCheckTimer.current = setTimeout(() => checkUsernameAvailability(value), 400);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: 'Passwords do not match.' });
      return;
    }

    if (usernameStatus === 'taken') {
      setFieldErrors({ username: 'This username is already taken.' });
      return;
    }

    setLoading(true);
    try {
      const { token, user } = await authApi.register({
        fullName: fullName.trim(),
        username: username.trim(),
        email: email.trim() || undefined,
        password,
        confirmPassword,
      });
      setStoredToken(token);
      onRegister(user);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed.';
      if (message.includes('username')) {
        setFieldErrors({ username: message });
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell isDarkMode={isDarkMode} title="Create Account" subtitle="Register for your private task workspace">
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className={`text-[10px] font-bold uppercase font-mono block mb-1.5 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Full Name</label>
          <div className="relative">
            <User className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`} />
            <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" className={inputClass()} autoComplete="name" />
          </div>
        </div>

        <div>
          <label className={`text-[10px] font-bold uppercase font-mono block mb-1.5 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Username</label>
          <div className="relative">
            <User className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`} />
            <input
              type="text"
              required
              value={username}
              onChange={(e) => handleUsernameChange(e.target.value)}
              placeholder="jane_doe"
              className={inputClass('username')}
              autoComplete="username"
            />
          </div>
          {fieldErrors.username && <p className="text-[11px] text-rose-400 mt-1">{fieldErrors.username}</p>}
          {usernameStatus === 'available' && !fieldErrors.username && (
            <p className="text-[11px] text-emerald-400 mt-1">Username is available</p>
          )}
          {usernameStatus === 'checking' && (
            <p className={`text-[11px] mt-1 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Checking availability...</p>
          )}
        </div>

        <div>
          <label className={`text-[10px] font-bold uppercase font-mono block mb-1.5 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Email (optional)</label>
          <div className="relative">
            <Mail className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`} />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" className={inputClass()} autoComplete="email" />
          </div>
        </div>

        <div>
          <label className={`text-[10px] font-bold uppercase font-mono block mb-1.5 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Password</label>
          <div className="relative">
            <Lock className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`} />
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={inputClass('password')} autoComplete="new-password" minLength={6} />
          </div>
          {fieldErrors.password && <p className="text-[11px] text-rose-400 mt-1">{fieldErrors.password}</p>}
        </div>

        <div>
          <label className={`text-[10px] font-bold uppercase font-mono block mb-1.5 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Confirm Password</label>
          <div className="relative">
            <Lock className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`} />
            <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className={inputClass('confirmPassword')} autoComplete="new-password" />
          </div>
          {fieldErrors.confirmPassword && <p className="text-[11px] text-rose-400 mt-1">{fieldErrors.confirmPassword}</p>}
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={loading || usernameStatus === 'taken'}
          className={`w-full py-3.5 px-4 font-semibold rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 mt-2 ${
            isDarkMode ? 'bg-white hover:bg-slate-100 text-slate-950' : 'bg-slate-900 hover:bg-slate-800 text-white'
          }`}
        >
          {loading ? 'Creating account...' : 'Create Account'}
        </motion.button>
      </form>

      <p className={`text-center text-xs mt-5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        Already have an account?{' '}
        <button type="button" onClick={onSwitchToLogin} className="text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer">
          Sign in
        </button>
      </p>
    </AuthShell>
  );
}
