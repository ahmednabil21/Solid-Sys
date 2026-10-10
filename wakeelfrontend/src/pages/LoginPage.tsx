import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// import Turnstile from 'react-turnstile'; // خدمة Cloudflare Turnstile — معطّلة بتعليق
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, User, Lock, AlertTriangle, RefreshCw } from 'lucide-react';
import WifiLoaderComponent from '../components/WifiLoaderComponent';
import { apiService, ApiService } from '../services/api';
import { showSuccess } from '../utils/notifications';
import brandLogo from '../images/wakeellogo.png';

// const TURNSTILE_SITE_KEY = process.env.REACT_APP_TURNSTILE_SITE_KEY || '0x4AAAAAACh0LGLTfAOqhxi6';

// /** تشغيل محلي أو تطوير — لا نعرض Turnstile ولا نرسل توكن (تجنب خطأ 110200) */
// const shouldUseTurnstile = (): boolean => {
//   if (process.env.REACT_APP_TURNSTILE_ENABLED === 'false') return false;
//   if (process.env.NODE_ENV !== 'production') return false;
//   if (typeof window === 'undefined') return false;
//   const host = window.location.hostname;
//   return host !== 'localhost' && host !== '127.0.0.1';
// };

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockTimeRemaining, setBlockTimeRemaining] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- محفوظ لتفعيل Turnstile لاحقاً
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // const useTurnstile = shouldUseTurnstile(); // معطّل — خدمة Cloudflare معطّلة
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- محفوظ لتفعيل Turnstile لاحقاً
  const useTurnstile = false;
  const { login } = useAuth();
  const navigate = useNavigate();

  const MAX_LOGIN_ATTEMPTS = 4;
  const BLOCK_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

  // استدعاء رسالة النظام عند فتح صفحة تسجيل الدخول (حسب المواصفات)
  useEffect(() => {
    apiService.getSystemMessage().catch(() => {});
  }, []);

  // تحميل المحاولات من localStorage عند تحميل الصفحة
  useEffect(() => {
    const savedAttempts = localStorage.getItem('loginAttempts');
    const savedBlockTime = localStorage.getItem('blockTime');

    if (savedAttempts) {
      setLoginAttempts(parseInt(savedAttempts));
    }

    if (savedBlockTime) {
      const blockTime = parseInt(savedBlockTime);
      const remaining = blockTime - Date.now();
      if (remaining > 0) {
        setIsBlocked(true);
        setBlockTimeRemaining(remaining);
      } else {
        // انتهت فترة الحظر
        localStorage.removeItem('blockTime');
        localStorage.removeItem('loginAttempts');
        setLoginAttempts(0);
        setIsBlocked(false);
      }
    }
  }, []);

  // تحديث العد التنازلي للحظر
  useEffect(() => {
    if (isBlocked && blockTimeRemaining > 0) {
      const timer = setInterval(() => {
        setBlockTimeRemaining((prev) => {
          if (prev <= 1000) {
            setIsBlocked(false);
            localStorage.removeItem('blockTime');
            localStorage.removeItem('loginAttempts');
            setLoginAttempts(0);
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isBlocked, blockTimeRemaining]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // التحقق من الحظر
    if (isBlocked) {
      const minutes = Math.floor(blockTimeRemaining / 60000);
      const seconds = Math.floor((blockTimeRemaining % 60000) / 1000);
      setError(`تم حظر تسجيل الدخول. يرجى المحاولة بعد ${minutes}:${seconds.toString().padStart(2, '0')}`);
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      // await login(username, password, useTurnstile ? (captchaToken ?? undefined) : undefined);
      await login(username, password, undefined); // لا نرسل توكن Turnstile — الخدمة معطّلة
      // نجح تسجيل الدخول - إعادة تعيين المحاولات
      localStorage.removeItem('loginAttempts');
      localStorage.removeItem('blockTime');
      setLoginAttempts(0);
      showSuccess('تم تسجيل الدخول بنجاح', 'مرحباً بك في نظام إدارة المشتركين');
      navigate('/admin/dashboard');
    } catch (err: any) {
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);
      localStorage.setItem('loginAttempts', newAttempts.toString());

      // الحصول على رسالة الخطأ المترجمة
      const errorMessage = ApiService.showError(err);

      // التحقق من نوع الخطأ
      if (err.response?.status === 400 && err.response?.data?.message?.includes('انتهت صلاحية اشتراكك')) {
        setError('انتهت صلاحية اشتراكك. يرجى التواصل مع الدعم الفني لتجديد الاشتراك');
      } else {
        setError(errorMessage);
      }

      // التحقق من الوصول للحد الأقصى من المحاولات
      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        const blockTime = Date.now() + BLOCK_DURATION;
        setIsBlocked(true);
        setBlockTimeRemaining(BLOCK_DURATION);
        localStorage.setItem('blockTime', blockTime.toString());
        setError(
          `تم حظر تسجيل الدخول بعد ${MAX_LOGIN_ATTEMPTS} محاولات فاشلة. يرجى المحاولة بعد 5 دقائق أو التواصل مع الدعم الفني.`
        );
      } else {
        const remainingAttempts = MAX_LOGIN_ATTEMPTS - newAttempts;
        if (remainingAttempts > 0) {
          setError(`${errorMessage}\n\nالمحاولات المتبقية: ${remainingAttempts}`);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    window.open('https://api.whatsapp.com/send?phone=9647733140600&text=', '_blank');
  };

  const formatTime = (milliseconds: number) => {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <WifiLoaderComponent
          background="transparent"
          desktopSize="150px"
          mobileSize="150px"
          text="جاري تسجيل الدخول..."
          backColor="#dbe7ff"
          frontColor="#2763eb"
        />
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-white grid grid-cols-1 lg:grid-cols-2 overflow-hidden">
      {/* الجانب الأيمن: النص والنموذج */}
      <div className="relative z-10 flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-14 xl:px-20">
        <div className="w-full max-w-md mx-auto">
          <header className="mb-8 sm:mb-10 text-right">
            <h1 className="text-2xl sm:text-3xl lg:text-[2rem] xl:text-[2.15rem] font-extrabold leading-relaxed tracking-tight text-primary-600">
              مرحباً بك
              <br />
              في نظام إدارة المشتركين
            </h1>
            <p className="mt-3 text-base sm:text-lg font-semibold tracking-[0.35em] text-secondary-500">
              كــل التقنيـــــــات في مكــــــــــان واحد
            </p>
          </header>

          {/* شعار على الموبايل */}
          <div className="mb-8 flex justify-center lg:hidden">
            <img
              src={brandLogo}
              alt="شعار النظام"
              className="h-40 w-40 sm:h-48 sm:w-48 rounded-2xl object-cover shadow-sm"
            />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-3 sm:px-4 py-2 sm:py-3 rounded-xl text-sm">
                <div className="flex items-start">
                  <AlertTriangle className="h-4 w-4 mt-0.5 ml-2 flex-shrink-0" />
                  <div className="whitespace-pre-line">{error}</div>
                </div>
              </div>
            )}

            {loginAttempts > 0 && !isBlocked && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 px-3 sm:px-4 py-2 sm:py-3 rounded-xl text-sm">
                <div className="flex items-center">
                  <AlertTriangle className="h-4 w-4 ml-2" />
                  <span>
                    المحاولات الفاشلة: {loginAttempts} من {MAX_LOGIN_ATTEMPTS}
                  </span>
                </div>
              </div>
            )}

            {isBlocked && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-3 sm:px-4 py-2 sm:py-3 rounded-xl text-sm">
                <div className="flex items-center">
                  <AlertTriangle className="h-4 w-4 ml-2" />
                  <span>تم حظر تسجيل الدخول. يرجى المحاولة بعد: {formatTime(blockTimeRemaining)}</span>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                اسم المستخدم
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pr-11 pl-4 py-3.5 text-base border-0 rounded-xl bg-[#eef2f7] text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/35 transition"
                  placeholder="اسم المستخدم"
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                كلمة المرور
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pr-11 pl-11 py-3.5 text-base border-0 rounded-xl bg-[#eef2f7] text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/35 transition"
                  placeholder="كلمة المرور"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 left-0 pl-3.5 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
            </div>

            {/* Cloudflare Turnstile — معطّل بتعليق (لا تحذف)
            {useTurnstile && (
              <div className="flex justify-center">
                <Turnstile
                  sitekey={TURNSTILE_SITE_KEY}
                  onVerify={(token) => setCaptchaToken(token)}
                  onExpire={() => setCaptchaToken(null)}
                />
              </div>
            )}
            */}

            <button
              type="submit"
              disabled={isLoading || isBlocked}
              className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl text-base font-bold text-white bg-secondary-500 hover:bg-secondary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 ml-2 animate-spin" />
                  جاري تسجيل الدخول...
                </>
              ) : isBlocked ? (
                'محظور مؤقتاً'
              ) : (
                'تسجيل الدخول'
              )}
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-sm text-primary-600 hover:text-primary-700 hover:underline focus:outline-none focus:underline"
              >
                نسيت كلمة السر؟
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* الجانب الأيسر: الشعار الكبير */}
      <div className="relative hidden lg:flex items-center justify-center overflow-hidden bg-white p-4 xl:p-6">
        <img
          src={brandLogo}
          alt=""
          aria-hidden="true"
          width={720}
          height={720}
          className="pointer-events-none select-none h-auto w-[min(90%,42rem)] max-h-[85vh] object-contain"
        />
      </div>
    </div>
  );
};

export default LoginPage;
