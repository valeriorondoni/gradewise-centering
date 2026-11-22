import { Camera, FileBarChart2, Ruler, TrendingUp } from 'lucide-react';

const STEPS = [
  {
    number: '01',
    icon: Camera,
    title: 'Upload your card',
    description:
      'Add card details and photos covering the front, back, corners, edges, and angled surfaces.',
  },
  {
    number: '02',
    icon: Ruler,
    title: 'Centering & wear check',
    description:
      'We measure exact border centering ratios with geometry and inspect corners and edges for whitening.',
  },
  {
    number: '03',
    icon: TrendingUp,
    title: 'ROI & grader comparison',
    description:
      'Compare raw market value against graded returns minus fees and shipping across PSA, BGS, and CGC.',
  },
  {
    number: '04',
    icon: FileBarChart2,
    title: 'Get your recommendation',
    description:
      'Receive a clear grade range and an honest submit-or-sell recommendation before spending a cent on grading.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-bold tracking-widest text-emerald-700 uppercase">
            How it works
          </p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-navy-900 sm:text-4xl">
            From card photos to a clearer decision.
          </h2>
        </div>

        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className="relative rounded-2xl border border-slate-200/90 bg-slate-50/50 p-6 transition hover:border-emerald-200 hover:bg-white hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-emerald-700">
                    {step.number}
                  </span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100/80 text-emerald-700">
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <h3 className="mt-4 text-base font-bold text-navy-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
