import React, { useState } from 'react';
import {
  X,
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  Database,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { apiLogin, apiSignup, DBStatus, User as AuthUser } from '../utils/authClient';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: AuthUser) => void;
  dbStatus: DBStatus | null;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  dbStatus,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (mode === 'signup' && !name.trim()) {
      setErrorMessage('Please enter your full name');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please provide a valid email address');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);

    try {
      const res =
        mode === 'signup'
          ? await apiSignup(name, email, password)
          : await apiLogin(email, password);

      if (res.success && res.user) {
        onSuccess(res.user);
        onClose();
      } else {
        setErrorMessage(res.error || 'Authentication failed. Please verify credentials.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemo = async () => {
    setName('Student Analyst');
    setEmail('student@analyst.academy');
    setPassword('student123');
    setIsLoading(true);
    setErrorMessage(null);

    // Try login first, or signup if not created
    let res = await apiLogin('student@analyst.academy', 'student123');
    if (!res.success) {
      res = await apiSignup('Student Analyst', 'student@analyst.academy', 'student123');
    }

    setIsLoading(false);
    if (res.success && res.user) {
      onSuccess(res.user);
      onClose();
    } else {
      setErrorMessage(res.error || 'Quick demo login failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-white rounded-2xl border border-neutral-200/80 shadow-2xl overflow-hidden">
        {/* Header Ribbon */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 bg-neutral-50/70">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center font-bold text-xs tracking-wider">
              K
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">
                {mode === 'signin' ? 'Sign in to Khokhi' : 'Create Student Account'}
              </h2>
              <p className="text-[11px] text-neutral-500">
                Track your data cleaning battles & mentor progress
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Database Status Indicator Banner */}
        <div className="px-6 py-2 bg-neutral-100/60 border-b border-neutral-100 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 text-neutral-600">
            <Database className="w-3.5 h-3.5 text-neutral-500" />
            <span className="font-medium">Database:</span>
            {dbStatus?.connected ? (
              <span className="text-emerald-700 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                MongoDB Atlas ({dbStatus.database})
              </span>
            ) : dbStatus?.configured ? (
              <span className="text-amber-700 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Connecting to MongoDB...
              </span>
            ) : (
              <span className="text-neutral-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Local MongoDB Store (Ready for MONGODB_URI)
              </span>
            )}
          </div>
          <span className="text-[10px] text-neutral-400 font-mono">JWT Secure</span>
        </div>

        {/* Tab switch [ Sign In | Sign Up ] */}
        <div className="px-6 pt-5">
          <div className="grid grid-cols-2 p-1 bg-neutral-100 rounded-lg text-xs font-medium text-neutral-600">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMessage(null);
              }}
              className={`py-1.5 rounded-md transition-all ${
                mode === 'signin'
                  ? 'bg-white text-neutral-900 shadow-2xs'
                  : 'hover:text-neutral-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMessage(null);
              }}
              className={`py-1.5 rounded-md transition-all ${
                mode === 'signup'
                  ? 'bg-white text-neutral-900 shadow-2xs'
                  : 'hover:text-neutral-900'
              }`}
            >
              Create Account
            </button>
          </div>
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-3.5">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sipho Ndlovu"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white rounded-lg border border-neutral-200 focus:outline-hidden focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 w-4 h-4 text-neutral-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="analyst@domain.com"
                className="w-full pl-9 pr-3 py-2 text-xs bg-white rounded-lg border border-neutral-200 focus:outline-hidden focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 w-4 h-4 text-neutral-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full pl-9 pr-10 py-2 text-xs bg-white rounded-lg border border-neutral-200 focus:outline-hidden focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-700"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-2.5 px-4 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-60 text-white text-xs font-medium rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>{mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>


      </div>
    </div>
  );
};
