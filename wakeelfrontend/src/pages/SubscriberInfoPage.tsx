import React from 'react';
import {
  Smartphone,
  Download,
  Apple,
  RefreshCw,
  Gauge,
  Wrench,
  Headphones,
  Receipt,
  ShieldCheck,
  Sparkles,
  MessageCircle,
} from 'lucide-react';
import brandLogo from '../images/solid-links-logo.png';

const ANDROID_APK_URL = `${process.env.PUBLIC_URL || ''}/downloads/solid-links-subscriber.apk`;

const FEATURES = [
  {
    icon: RefreshCw,
    title: 'تجديد الاشتراك',
    text: 'جدّد باقتك بخطوات بسيطة واختر الباقة المناسبة لك.',
  },
  {
    icon: Gauge,
    title: 'قياس السرعة',
    text: 'اختبر سرعة الإنترنت وجودة الاتصال داخل التطبيق مباشرة.',
  },
  {
    icon: Wrench,
    title: 'طلب الصيانة',
    text: 'قدّم بلاغ صيانة وتابع حالة الطلب لحظة بلحظة.',
  },
  {
    icon: Receipt,
    title: 'سجل التفعيلات',
    text: 'اطّلع على سجل اشتراكاتك وتفعيلاتك السابقة بسهولة.',
  },
  {
    icon: MessageCircle,
    title: 'دعم فني ذكي',
    text: 'شات بوت للأسئلة الشائعة مع تحويل للدعم البشري عند الحاجة.',
  },
  {
    icon: Headphones,
    title: 'اتصال سريع',
    text: 'تواصل مع فريق الدعم بضغطة زر عبر الاتصال المباشر.',
  },
];

const SubscriberInfoPage: React.FC = () => {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#F3F7FB] text-slate-900" dir="rtl">
      {/* Atmosphere */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#D9EFFA_0%,_#F3F7FB_55%,_#EEF4F9_100%)]" />
        <div className="absolute -top-24 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[#0397D9]/[0.12] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-[#016AAA]/[0.08] blur-3xl" />
      </div>

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-md shadow-sky-900/5 ring-1 ring-[#E6EEF5]">
            <img src={brandLogo} alt="Solid Links" className="h-8 w-8 object-contain" />
          </div>
          <div>
            <p className="text-lg font-black tracking-tight text-[#016AAA]">Solid Links</p>
            <p className="text-xs font-semibold text-slate-500">تطبيق المشترك</p>
          </div>
        </div>
        <div className="hidden items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-bold text-[#0397D9] ring-1 ring-[#E6EEF5] sm:flex">
          <ShieldCheck className="h-3.5 w-3.5" />
          خدمة المشتركين الملتزمين
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 pb-16 sm:px-8">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#05A8E8] via-[#0397D9] to-[#016AAA] px-6 py-12 text-white shadow-2xl shadow-sky-900/20 sm:px-12 sm:py-16">
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-20 left-10 h-64 w-64 rounded-full bg-cyan-200/20 blur-3xl" />

          <div className="relative grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" />
                التحديث الجديد متاح الآن
              </div>
              <h1 className="text-3xl font-black leading-[1.25] tracking-tight sm:text-5xl">
                Solid Links
                <span className="mt-2 block text-2xl font-extrabold text-sky-50/95 sm:text-3xl">
                  تطبيق المشترك بين يديك
                </span>
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-sky-50/90 sm:text-base">
                إدارة اشتراكك، طلب الصيانة، قياس السرعة، ومتابعة التفعيلات —
                بتجربة حديثة ومخصصة لمشتركينا الملتزمين بسداد أجور الصيانة.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <a
                  href={ANDROID_APK_URL}
                  download="solid-links-subscriber.apk"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-black text-[#016AAA] shadow-lg shadow-black/10 transition hover:bg-sky-50"
                >
                  <Download className="h-5 w-5" />
                  تحميل للأندرويد (APK)
                </a>
                <button
                  type="button"
                  disabled
                  title="قريباً — بانتظار ملف الآيفون"
                  className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-white/35 bg-white/10 px-5 py-3.5 text-sm font-black text-white/80 backdrop-blur"
                >
                  <Apple className="h-5 w-5" />
                  آيفون — قريباً
                </button>
              </div>
              <p className="mt-3 text-xs font-semibold text-sky-100/80">
                نسخة الأندرويد جاهزة للتحميل مباشرة. نسخة الآيفون تُضاف فور استلام الملف.
              </p>
            </div>

            <div className="relative mx-auto w-full max-w-[280px]">
              <div className="absolute inset-0 -rotate-6 rounded-[2rem] bg-white/10" />
              <div className="relative overflow-hidden rounded-[2rem] border border-white/25 bg-white/95 p-6 text-slate-900 shadow-2xl">
                <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#E8F5FC] ring-1 ring-[#E6EEF5]">
                  <img src={brandLogo} alt="" className="h-12 w-12 object-contain" />
                </div>
                <p className="text-center text-lg font-black text-[#016AAA]">تطبيق المشترك</p>
                <p className="mt-1 text-center text-xs font-semibold text-slate-500">
                  Solid Links Subscriber
                </p>
                <div className="mt-6 space-y-2.5">
                  {['تجديد سهل', 'صيانة فورية', 'دعم مباشر'].map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-2 rounded-xl bg-[#F3F7FB] px-3 py-2 text-xs font-bold text-slate-700"
                    >
                      <span className="h-2 w-2 rounded-full bg-[#0397D9]" />
                      {item}
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex items-center justify-center gap-2 text-[11px] font-bold text-slate-400">
                  <Smartphone className="h-3.5 w-3.5" />
                  Android · iOS قريباً
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mt-14">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              لماذا تطبيق المشترك؟
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm font-semibold leading-7 text-slate-500">
              كل ما تحتاجه لإدارة اشتراكك وخدماتك في مكان واحد، بواجهة عصرية وسهلة.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <article
                key={title}
                className="rounded-3xl border border-[#E6EEF5] bg-white/90 p-5 shadow-sm shadow-sky-900/5 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8F5FC] text-[#0397D9]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-black text-slate-900">{title}</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* CTA strip */}
        <section className="mt-14 overflow-hidden rounded-[2rem] border border-[#E6EEF5] bg-white px-6 py-8 sm:px-10">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-xl font-black text-slate-900">حمّل التطبيق وابدأ الآن</h3>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                للأندرويد متوفر مباشرة. الآيفون قريباً بعد تجهيز ملف التثبيت.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <a
                href={ANDROID_APK_URL}
                download="solid-links-subscriber.apk"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0397D9] px-5 py-3 text-sm font-black text-white shadow-lg shadow-sky-600/25 hover:bg-[#016AAA]"
              >
                <Download className="h-4 w-4" />
                Android APK
              </a>
              <span className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-400">
                <Apple className="h-4 w-4" />
                iOS قريباً
              </span>
            </div>
          </div>
        </section>

        <footer className="mt-12 flex flex-col items-center gap-3 pb-6 text-center">
          <img src={brandLogo} alt="" className="h-10 w-10 object-contain opacity-90" />
          <p className="text-sm font-black text-[#016AAA]">Solid Links</p>
          <p className="text-xs font-semibold text-slate-400">
            © {new Date().getFullYear()} — تطبيق المشترك
          </p>
        </footer>
      </main>
    </div>
  );
};

export default SubscriberInfoPage;
