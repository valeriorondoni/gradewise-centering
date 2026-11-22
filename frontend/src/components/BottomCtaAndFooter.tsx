import { ArrowRight, ShieldCheck } from 'lucide-react';

interface BottomCtaAndFooterProps {
  onStartGrading: () => void;
}

export function BottomCtaAndFooter({ onStartGrading }: BottomCtaAndFooterProps) {
  return (
    <>
      <section className="bg-navy-900 py-16 text-white sm:py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Make your next grading decision with confidence.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-slate-300">
            Upload your card photos and get an honest condition check, estimated grade range, and
            ROI breakdown in minutes.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3">
            <button
              type="button"
              onClick={onStartGrading}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-7 py-3.5 text-base font-semibold text-navy-900 shadow-lg transition hover:bg-emerald-400"
            >
              Assess my card
              <ArrowRight className="h-4 w-4" />
            </button>
            <span className="text-xs text-slate-400">
              No login required &bull; First 3 scans free
            </span>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 text-white">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <span className="text-sm font-bold text-navy-900">GradeWise</span>
          </div>

          <div className="flex items-center gap-6 text-xs font-medium text-slate-500">
            <a href="#how-it-works" className="hover:text-navy-900">
              How it works
            </a>
            <a href="#sample-report" className="hover:text-navy-900">
              Sample report
            </a>
            <a href="#pricing" className="hover:text-navy-900">
              Pricing
            </a>
          </div>

          <p className="text-center text-xs text-slate-400 sm:text-right">
            Independent assessment service. Not affiliated with PSA, BGS, or CGC.
          </p>
        </div>
      </footer>
    </>
  );
}
