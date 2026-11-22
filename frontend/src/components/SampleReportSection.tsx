import { AlertTriangle, Camera, CheckCircle2, Maximize2, Shield, Sparkles } from 'lucide-react';

interface SampleReportSectionProps {
  onStartGrading: () => void;
}

const PHOTO_GROUPS = [
  { group: 'Overview', items: ['Full front', 'Full back'] },
  {
    group: 'Corners',
    items: ['Top-left corner', 'Top-right corner', 'Bottom-left corner', 'Bottom-right corner'],
  },
  { group: 'Edges', items: ['Top edge', 'Bottom edge', 'Left edge', 'Right edge'] },
  { group: 'Surface', items: ['Front surface - angled', 'Back surface - angled'] },
];

export function SampleReportSection({ onStartGrading }: SampleReportSectionProps) {
  return (
    <section id="sample-report" className="bg-mint-100/70 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold tracking-widest text-emerald-700 uppercase">
              Sample report
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-navy-900 sm:text-4xl">
              Everything you need to make the call.
            </h2>
          </div>
          <button
            type="button"
            onClick={onStartGrading}
            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            Try it with your card
          </button>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-12">
          {/* Left Column: Intake / Photo Checklist Preview */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-navy-900">Start with one card</h3>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                Preview
              </span>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500">Card name</label>
                <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-navy-900">
                  Charizard (Base Set)
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500">Language</label>
                  <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-navy-900">
                    English
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500">Variant</label>
                  <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-navy-900">
                    Holo
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-100 pt-5">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-navy-900">Required photo checklist</h4>
                <span className="font-mono text-xs text-slate-500">12 views</span>
              </div>

              <div className="mt-3 space-y-3">
                {PHOTO_GROUPS.map((section) => (
                  <div key={section.group}>
                    <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                      {section.group}
                    </p>
                    <div className="mt-1.5 grid grid-cols-2 gap-2">
                      {section.items.map((item) => (
                        <div
                          key={item}
                          className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50/70 px-2.5 py-2 text-xs text-slate-600"
                        >
                          <Camera className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="truncate">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Sample Decision Report + Why More Photos */}
          <div className="flex flex-col gap-6 lg:col-span-7">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-navy-900">Sample decision report</h3>
                <span className="text-xs italic text-slate-400">Illustrative values</span>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-slate-50 p-4">
                <div>
                  <p className="text-xs font-medium text-slate-500">Estimated grade</p>
                  <div className="mt-0.5 flex items-baseline gap-2.5">
                    <span className="font-mono text-3xl font-extrabold text-navy-900 tabular-nums">
                      8–9
                    </span>
                    <span className="text-xs text-slate-500">For PSA / BGS / CGC</span>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-100 px-3 py-1.5 text-sm font-semibold text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Consider grading
                </span>
              </div>

              {/* Condition Breakdown */}
              <div className="mt-5">
                <p className="text-xs font-semibold text-navy-900">
                  Condition <span className="font-normal text-slate-400">(based on your photos)</span>
                </p>
                <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 text-sm">
                    <span className="text-slate-600">Centering</span>
                    <span className="font-semibold text-emerald-700">Good (52/48)</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 text-sm">
                    <span className="text-slate-600">Corners</span>
                    <span className="font-semibold text-amber-600">Minor whitening</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 text-sm">
                    <span className="text-slate-600">Edges</span>
                    <span className="font-semibold text-emerald-700">Good</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 text-sm">
                    <span className="text-slate-600">Surface</span>
                    <span className="font-semibold text-amber-600">Light marks</span>
                  </div>
                </div>
              </div>

              {/* Financial Comparison */}
              <div className="mt-5">
                <p className="text-xs font-semibold text-navy-900">Financial comparison</p>
                <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 text-sm">
                    <span className="text-slate-600">Sell ungraded &mdash; net</span>
                    <span className="font-mono font-semibold text-navy-900 tabular-nums">€80</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 text-sm">
                    <span className="text-slate-600">Grade and sell &mdash; net</span>
                    <span className="font-mono font-semibold text-navy-900 tabular-nums">
                      €100–€175
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-emerald-50/80 px-4 py-2.5 text-sm">
                    <span className="font-semibold text-navy-900">Potential extra value</span>
                    <span className="font-mono font-bold text-emerald-700 tabular-nums">
                      +€20–€95
                    </span>
                  </div>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400">
                  Graded scenarios include €45 in estimated grading fees and shipping costs.
                </p>
              </div>

              {/* Reason & Disclaimer */}
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900">
                <p className="font-semibold text-navy-900">The reason</p>
                <p className="mt-0.5 text-slate-600">
                  Grading may add value, but the final outcome depends on surface condition under
                  angled lighting.
                </p>
                <div className="mt-2.5 flex items-center gap-2 font-medium text-amber-800">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                  A grade estimate is not an official grade.
                </div>
              </div>
            </div>

            {/* Why more photos? */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-base font-bold text-navy-900">Why more photos?</h3>
              <p className="mt-1 text-sm text-slate-600">
                Close-ups help inspect corner wear, edge whitening, and surface marks that full-card
                photos can miss.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-slate-50 p-3">
                  <Maximize2 className="mx-auto h-5 w-5 text-emerald-600" />
                  <p className="mt-1.5 text-xs font-semibold text-navy-900">Corners</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <Shield className="mx-auto h-5 w-5 text-emerald-600" />
                  <p className="mt-1.5 text-xs font-semibold text-navy-900">Edges</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <Sparkles className="mx-auto h-5 w-5 text-emerald-600" />
                  <p className="mt-1.5 text-xs font-semibold text-navy-900">Surface</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
