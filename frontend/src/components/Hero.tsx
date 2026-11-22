import { ArrowDownRight, ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';

interface HeroProps {
  onStartGrading: () => void;
}

export function Hero({ onStartGrading }: HeroProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-slate-50/80 via-white to-white pt-12 pb-16 sm:pt-16 sm:pb-20">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:gap-10 lg:px-8">
        {/* Left copy */}
        <div className="lg:col-span-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold tracking-wide text-emerald-800 uppercase">
            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
            A second opinion before you grade
          </div>

          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-navy-900 sm:text-5xl lg:text-[3.25rem] lg:leading-[1.08]">
            Know when your card is worth grading.
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
            Understand your card&apos;s centering, surface wear, likely grade range, and net
            financial return before you pay grading fees and shipping.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onStartGrading}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3.5 text-base font-semibold text-white shadow-md shadow-emerald-600/15 transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              Assess my card
              <ArrowRight className="h-4 w-4" />
            </button>

            <a
              href="#sample-report"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-navy-900 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Explore a sample report
              <ArrowDownRight className="h-4 w-4 text-slate-500" />
            </a>
          </div>

          <p className="mt-4 text-xs font-medium text-slate-500">
            No login required &bull; First 3 scans free &bull; Centering, wear &amp; ROI breakdown
          </p>
        </div>

        {/* Right visual: Inspected card + Decision widget */}
        <div className="relative lg:col-span-6">
          <div className="relative mx-auto max-w-lg rounded-3xl border border-slate-200/90 bg-gradient-to-br from-slate-100 via-slate-50 to-mint-50 p-6 shadow-xl shadow-slate-900/5 sm:p-8">
            <div className="grid items-center gap-6 sm:grid-cols-12">
              {/* Mock Trading Card inside inspection frame */}
              <div className="relative mx-auto w-48 sm:col-span-6 sm:w-full">
                {/* Callout pins */}
                <div className="absolute -top-3 -left-2 z-20 rounded-md bg-navy-900 px-2 py-1 text-[11px] font-medium text-white shadow-md">
                  Corner: minor whitening
                </div>
                <div className="absolute top-12 -right-3 z-20 rounded-md bg-navy-900 px-2 py-1 text-[11px] font-medium text-white shadow-md">
                  Surface: light marks
                </div>
                <div className="absolute -bottom-2 -left-2 z-20 rounded-md bg-emerald-700 px-2 py-1 text-[11px] font-medium text-white shadow-md">
                  Edge: clean
                </div>

                {/* Card slab / sleeve */}
                <div className="relative aspect-[5/7] w-full overflow-hidden rounded-2xl border-2 border-slate-300/90 bg-slate-900 p-1.5 shadow-lg">
                  <img
                    src="https://images.pokemontcg.io/base1/4_hires.png"
                    alt="Charizard Base Set card"
                    className="h-full w-full rounded-xl object-cover"
                  />
                  <div className="card-holo-sheen pointer-events-none absolute inset-0" />
                </div>
              </div>

              {/* Decision Summary Card */}
              <div className="sm:col-span-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-navy-900">
                      Your grading decision
                    </span>
                    <span className="text-[10px] font-medium text-slate-400">
                      Illustrative report
                    </span>
                  </div>

                  <div className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Consider grading
                  </div>

                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <p className="text-[11px] font-medium text-slate-500">Estimated grade</p>
                    <p className="mt-0.5 font-mono text-3xl font-bold tracking-tight text-navy-900 tabular-nums">
                      8–9
                    </p>
                  </div>

                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <p className="text-[11px] font-medium text-slate-500">
                      Potential extra value
                    </p>
                    <p className="mt-0.5 font-mono text-xl font-bold text-emerald-600 tabular-nums">
                      +€20–€95
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
