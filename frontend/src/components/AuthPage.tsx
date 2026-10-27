import React, { useState, useRef, useEffect } from 'react';
import {
  Mail,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  FileSpreadsheet,
  Terminal,
  ShieldCheck,
  RotateCcw,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';
import {
  apiLogin,
  apiSignup,
  apiVerifyOtp,
  apiResendOtp,
  DBStatus,
  User,
} from '../utils/authClient';

interface AuthPageProps {
  onSuccess: (user: User) => void;
  dbStatus?: DBStatus | null;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [step, setStep] = useState<'form' | 'otp'>('form');

  // Form inputs
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // OTP inputs: 6 separate boxes
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Feedback states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  // Resend cooldown countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Focus first OTP input when entering OTP mode
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    }
  }, [step]);

  // Handle Form Submit (Login or Step 1 Signup)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessInfo(null);

    if (mode === 'signup') {
      if (!name.trim()) {
        setErrorMessage('Please enter your full name');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match');
        return;
      }
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);

    try {
      if (mode === 'signin') {
        const res = await apiLogin(email, password);
        if (res.success && res.user) {
          onSuccess(res.user);
        } else {
          setErrorMessage(res.error || 'Invalid email or password');
        }
      } else {
        // Signup: Initiate OTP flow
        const res = await apiSignup(name, email, password);
        if (res.success && res.step === 'otp_required') {
          setStep('otp');
          setResendCooldown(60);
          setSuccessInfo(`Verification code sent to ${email}`);
          setOtpDigits(['', '', '', '', '', '']);
        } else {
          setErrorMessage(res.error || 'Failed to send verification code');
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle single OTP digit input
  const handleOtpChange = (index: number, val: string) => {
    // Only allow numbers
    const clean = val.replace(/\D/g, '');
    if (!clean && val !== '') return;

    const newDigits = [...otpDigits];
    newDigits[index] = clean.slice(-1);
    setOtpDigits(newDigits);
    setErrorMessage(null);

    // Auto-advance to next input
    if (clean && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  // Handle backspace key navigation
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Handle paste of full 6-digit code
  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const newDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || '';
    }
    setOtpDigits(newDigits);
    setErrorMessage(null);

    // Focus last filled or next empty
    const nextIdx = Math.min(pasted.length, 5);
    otpInputRefs.current[nextIdx]?.focus();
  };

  // Submit OTP Verification
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullOtp = otpDigits.join('');

    if (fullOtp.length !== 6) {
      setErrorMessage('Please enter all 6 digits of your verification code');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await apiVerifyOtp(email, fullOtp);
      if (res.success && res.user) {
        onSuccess(res.user);
      } else {
        setErrorMessage(res.error || 'Verification failed. Please check the code.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred during verification');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Resend Code Request
  const handleResend = async () => {
    if (resendCooldown > 0 || isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await apiResendOtp(email);
      if (res.success) {
        setResendCooldown(60);
        setSuccessInfo('A fresh 6-digit code has been sent to your email.');
        setOtpDigits(['', '', '', '', '', '']);
        otpInputRefs.current[0]?.focus();
      } else {
        setErrorMessage(res.error || 'Failed to resend verification code');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not resend code');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#fbfbfb] text-[#0d0d0d] flex flex-col justify-between font-sans antialiased selection:bg-neutral-900 selection:text-white">
      {/* Top Simple Brand Bar */}
      <header className="w-full px-6 py-4 flex items-center justify-between border-b border-neutral-200/70 bg-white/80 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-white border border-neutral-200/80 p-1 shadow-2xs flex items-center justify-center shrink-0">
            <img
              src="/khokhi.png"
              alt="Khokhi Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <span className="font-semibold text-base tracking-tight text-neutral-900">
            Khokhi
          </span>
        </div>
      </header>

      {/* Main Split Grid */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Column: Visual Highlights & Value Proposition */}
          <div className="lg:col-span-6 space-y-6 lg:pr-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 leading-snug">
                Master messy business data from raw spreadsheets to production pipelines.
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-neutral-500 leading-relaxed">
                Log in to Khokhi to access Excel lab, realistic dirty data battle scenarios, and AI guidance.
              </p>
            </div>

            {/* Feature Badges */}
            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-neutral-200/80 shadow-2xs">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-neutral-900">
                    Interactive Excel Studio
                  </h3>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Full desktop-class spreadsheet with 500+ formulas, ribbon controls, formatting, and native .xlsx support.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-neutral-200/80 shadow-2xs">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                  <Terminal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-neutral-900">
                    Khokhi AI Guidance
                  </h3>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Adaptive diagnostic mentoring that sharpens your data problem-solving intuition step by step.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Clean Auth Card */}
          <div className="lg:col-span-6 w-full max-w-md mx-auto">
            <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-xl overflow-hidden p-6 sm:p-8">
              
              {/* STEP 1: Standard Sign In / Sign Up Form */}
              {step === 'form' ? (
                <>
                  {/* Card Header & Toggle */}
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-bold text-neutral-900">
                      {mode === 'signin' ? 'Welcome back to Khokhi' : 'Create your Khokhi account'}
                    </h2>
                    <p className="text-xs text-neutral-500 mt-1">
                      {mode === 'signin'
                        ? 'Enter your credentials to access your studio'
                        : 'Enter your details to receive your 6-digit verification code'}
                    </p>

                    {/* Tab Pill [ Sign In | Create Account ] */}
                    <div className="mt-5 grid grid-cols-2 p-1 bg-neutral-100 rounded-xl text-xs font-medium text-neutral-600">
                      <button
                        type="button"
                        onClick={() => {
                          setMode('signin');
                          setErrorMessage(null);
                        }}
                        className={`py-2 rounded-lg transition-all cursor-pointer ${
                          mode === 'signin'
                            ? 'bg-white text-neutral-900 shadow-2xs font-semibold'
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
                        className={`py-2 rounded-lg transition-all cursor-pointer ${
                          mode === 'signup'
                            ? 'bg-white text-neutral-900 shadow-2xs font-semibold'
                            : 'hover:text-neutral-900'
                        }`}
                      >
                        Create Account
                      </button>
                    </div>
                  </div>

                  {/* Error Alert */}
                  {errorMessage && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-xs text-red-700 animate-in fade-in duration-150">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* Form */}
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {mode === 'signup' && (
                      <div>
                        <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                          Full Name
                        </label>
                        <div className="relative">
                          <UserIcon className="absolute left-3.5 top-3 w-4 h-4 text-neutral-400" />
                          <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Sipho Ndlovu"
                            className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-neutral-50/50 rounded-xl border border-neutral-200 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
                            required
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-3 w-4 h-4 text-neutral-400" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="analyst@domain.com"
                          className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-neutral-50/50 rounded-xl border border-neutral-200 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                        Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-3 w-4 h-4 text-neutral-400" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="At least 6 characters"
                          className="w-full pl-10 pr-11 py-2.5 text-xs bg-neutral-50/50 rounded-xl border border-neutral-200 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-3 text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {mode === 'signup' && (
                      <div>
                        <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                          Confirm Password
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-3 w-4 h-4 text-neutral-400" />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Repeat your password"
                            className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-neutral-50/50 rounded-xl border border-neutral-200 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
                            required
                          />
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full mt-2 py-3 px-4 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-60 text-white text-xs font-medium rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isLoading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>{mode === 'signin' ? 'Sign In to Khokhi' : 'Continue to Email Verification'}</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                </>
              ) : (
                /* STEP 2: 6-Digit Email Verification Screen */
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('form');
                      setErrorMessage(null);
                    }}
                    className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-800 mb-4 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to signup details</span>
                  </button>

                  <div className="text-center mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-neutral-100 text-neutral-800 flex items-center justify-center mx-auto mb-3 shadow-2xs">
                      <ShieldCheck className="w-6 h-6 text-emerald-600" />
                    </div>
                    <h2 className="text-xl font-bold text-neutral-900">
                      Verify Your Email
                    </h2>
                    <p className="text-xs text-neutral-500 mt-1 max-w-[320px] mx-auto leading-relaxed">
                      We've sent a 6-digit code to <span className="font-semibold text-neutral-800">{email}</span>
                    </p>
                  </div>

                  {/* Success notification */}
                  {successInfo && !errorMessage && (
                    <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                      <span>{successInfo}</span>
                    </div>
                  )}

                  {/* Error Notification */}
                  {errorMessage && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700 animate-in fade-in duration-150">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                      <div>
                        <span>{errorMessage}</span>
                        {errorMessage.includes('locked for 24 hours') && (
                          <p className="text-[11px] text-red-600 mt-1 font-medium">
                            Security lock active. You have reached the 3-attempt limit.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 6 Digit Input Boxes */}
                  <form onSubmit={handleVerifyOtp} className="space-y-6">
                    <div className="flex justify-center gap-2 sm:gap-2.5" onPaste={handleOtpPaste}>
                      {otpDigits.map((digit, idx) => (
                        <input
                          key={idx}
                          ref={(el) => { otpInputRefs.current[idx] = el; }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(idx, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                          className={`w-11 h-13 sm:w-12 sm:h-14 text-center font-mono text-xl font-bold bg-neutral-50/70 rounded-xl border transition-all focus:outline-hidden focus:bg-white ${
                            digit
                              ? 'border-neutral-900 text-neutral-900 bg-white shadow-2xs'
                              : 'border-neutral-200 text-neutral-800'
                          } focus:ring-2 focus:ring-neutral-900 focus:border-transparent`}
                          required
                        />
                      ))}
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading || otpDigits.join('').length !== 6}
                      className="w-full py-3 px-4 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white text-xs font-medium rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isLoading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>Verify & Launch Khokhi</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>

                  {/* Resend Code Section */}
                  <div className="mt-6 text-center text-xs text-neutral-500">
                    <p>Didn't receive the email?</p>
                    {resendCooldown > 0 ? (
                      <span className="text-[11px] text-neutral-400 mt-1 inline-block">
                        Resend code in <span className="font-semibold text-neutral-700">{resendCooldown}s</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={isLoading}
                        className="mt-1 font-semibold text-emerald-700 hover:text-emerald-800 transition-colors cursor-pointer"
                      >
                        Resend Code
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
