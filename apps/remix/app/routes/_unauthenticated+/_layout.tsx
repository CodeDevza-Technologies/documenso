import CodedevzaIconWhite from '@documenso/assets/codedevza-icon-white.png';
import { CheckIcon, PenLineIcon, UploadIcon } from 'lucide-react';
import { Fragment, useEffect } from 'react';
import { Link, Outlet } from 'react-router';

import { BrandingLogoIcon } from '~/components/general/branding-logo-icon';

const Wordmark = ({ className }: { className?: string }) => (
  <span className={className}>
    <span className="font-bold">Code</span>
    <span className="font-normal">devza</span> <span className="font-bold">AI Sign</span>
  </span>
);

const STEPS = [
  { icon: UploadIcon, label: 'Upload' },
  { icon: PenLineIcon, label: 'Sign' },
  { icon: CheckIcon, label: 'Complete' },
];

const ProcessVisual = () => (
  <div className="relative mx-auto w-full max-w-sm" aria-hidden="true">
    {/* Stacked paper behind, for depth */}
    <div className="absolute inset-0 translate-x-3 translate-y-4 rotate-3 rounded-2xl bg-white/[0.04] ring-1 ring-white/10" />

    {/* The document card (gently floats) */}
    <div className="relative animate-doc-float rounded-2xl bg-white p-5 shadow-2xl shadow-black/50 ring-1 ring-black/5">
      {/* Header row: file dot + title + status pill */}
      <div className="flex items-center gap-2.5">
        <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-primary" />
        <span className="h-2 w-28 rounded-full bg-neutral-200" />
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-1 font-semibold text-[10px] text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Signed
        </span>
      </div>

      {/* Body lines */}
      <div className="mt-4 space-y-2.5">
        <span className="block h-2 w-full rounded-full bg-neutral-100" />
        <span className="block h-2 w-11/12 rounded-full bg-neutral-100" />
        <span className="block h-2 w-full rounded-full bg-neutral-100" />
        <span className="block h-2 w-3/5 rounded-full bg-neutral-100" />
      </div>

      {/* Signature field — a signature is drawn on, stroke by stroke */}
      <div className="mt-5 rounded-xl border border-neutral-200 border-dashed bg-neutral-50/80 px-4 pt-2 pb-1">
        <span className="font-semibold text-[9px] text-neutral-400 uppercase tracking-[0.14em]">Signature</span>
        <svg
          viewBox="8 14 344 150"
          fill="none"
          preserveAspectRatio="xMinYMid meet"
          className="mt-0.5 h-16 w-full text-primary"
        >
          <path
            pathLength={1}
            className="animate-sign-draw [stroke-dasharray:1] [stroke-dashoffset:1] motion-reduce:animate-none motion-reduce:[stroke-dashoffset:0]"
            d="M22 98 C 34 58 20 30 36 30 C 50 30 46 74 46 96 C 52 66 64 44 76 46 C 88 48 86 78 84 94 C 90 70 100 54 110 58 C 120 62 116 86 110 92 C 118 66 140 40 154 54 C 166 66 150 90 142 78 C 136 66 152 62 158 80 C 164 96 178 92 184 76 C 198 40 224 36 214 74 C 208 98 192 92 202 70 C 214 46 230 56 224 82 C 220 96 234 96 244 82 C 256 44 270 42 266 92 C 267 72 278 60 288 64 C 300 68 296 88 290 92 C 296 70 312 46 322 62 C 330 74 318 90 314 80 C 312 70 324 68 330 82 C 300 150 120 152 44 116"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Signed badge — pops in once the signature finishes drawing */}
      <div
        className="absolute -top-3.5 -right-3.5 flex h-12 w-12 animate-pop-in items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/40 ring-4 ring-[#080B11] motion-reduce:animate-none"
        style={{ animationDelay: '2.2s' }}
      >
        <CheckIcon className="h-6 w-6" strokeWidth={3} />
      </div>
    </div>

    {/* Floating status chips — solid fills so text stays readable over both panels */}
    <div
      className="absolute top-24 -left-5 inline-flex animate-fade-up items-center gap-2 rounded-full bg-white px-3 py-1.5 font-medium text-neutral-700 text-xs shadow-black/25 shadow-xl ring-1 ring-black/5 motion-reduce:animate-none"
      style={{ animationDelay: '0.5s' }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
      Sent for signing
    </div>
    <div
      className="absolute right-2 -bottom-4 inline-flex animate-fade-up items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 font-semibold text-white text-xs shadow-lg shadow-primary/30 motion-reduce:animate-none"
      style={{ animationDelay: '2.4s' }}
    >
      <CheckIcon className="h-3.5 w-3.5" strokeWidth={3} />
      Completed
    </div>
  </div>
);

const StepFlow = () => (
  <div className="mt-12 flex items-start">
    {STEPS.map((step, index) => (
      <Fragment key={step.label}>
        <div className="flex flex-col items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/25">
            <step.icon className="h-4 w-4" strokeWidth={2.5} />
          </span>
          <span className="font-medium text-[11px] text-white/60">{step.label}</span>
        </div>
        {index < STEPS.length - 1 && (
          <span className="mt-4 h-px flex-1 bg-gradient-to-r from-primary/40 to-primary/15" />
        )}
      </Fragment>
    ))}
  </div>
);

export default function Layout() {
  // Auth pages are the first thing external users see and are often shared —
  // always render them in light mode regardless of theme or OS preference.
  useEffect(() => {
    const root = document.documentElement;

    root.classList.add('dark-mode-disabled');

    return () => root.classList.remove('dark-mode-disabled');
  }, []);

  return (
    <main className="flex min-h-screen w-full bg-background">
      {/* Brand panel */}
      <aside className="relative hidden w-1/2 flex-col overflow-hidden bg-[#080B11] p-12 text-white lg:flex xl:p-16">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="pointer-events-none absolute -top-40 -right-40 h-[560px] w-[560px] rounded-full bg-primary/25 blur-[130px]" />
        <div className="pointer-events-none absolute -bottom-32 -left-40 h-[440px] w-[440px] rounded-full bg-primary/10 blur-[120px]" />

        <Link to="/" className="relative z-10 inline-flex flex-shrink-0 items-center gap-2.5">
          <img src={CodedevzaIconWhite} alt="" className="h-8 w-auto" />
          <Wordmark className="text-white text-xl tracking-tight" />
        </Link>

        <div className="relative z-10 flex flex-1 flex-col justify-center py-10">
          <h2 className="max-w-md font-semibold text-[2.25rem] leading-[1.1] tracking-tight">
            Sign documents in seconds, not days.
          </h2>
          <p className="mt-4 max-w-sm text-base text-white/55 leading-relaxed">
            The effortless, secure way to send, sign, and manage your documents.
          </p>

          <div className="mt-10">
            <ProcessVisual />
          </div>

          <StepFlow />
        </div>

        <p className="relative z-10 flex-shrink-0 text-sm text-white/40">© Codedevza AI Ltd · Secure e-signatures</p>
      </aside>

      {/* Form panel */}
      <section className="flex w-full flex-col items-center justify-center px-6 py-12 sm:px-10 lg:w-1/2">
        <Link to="/" className="mb-10 inline-flex items-center gap-2.5 lg:hidden">
          <BrandingLogoIcon className="h-8 w-auto" />
          <Wordmark className="text-foreground text-xl tracking-tight" />
        </Link>

        <div className="w-full max-w-sm">
          <Outlet />
        </div>
      </section>
    </main>
  );
}
