import { Check } from 'lucide-react';

interface PricingSectionProps {
  onStartGrading: () => void;
}

const PLANS = [
  {
    name: 'Pay-per-Scan',
    price: '€3',
    cadence: 'per estimate',
    badge: 'First 3 scans free',
    description: 'For day-to-day collectors who want a quick second opinion on individual cards.',
    features: [
      'First 3 card assessments free',
      'Centering & whitening analysis',
      'Estimated grade range (PSA / BGS / CGC)',
      'Net ROI calculation',
    ],
    cta: 'Start free scan',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '€20',
    cadence: 'per month',
    badge: 'Most popular',
    description: 'Built for active collectors and resellers managing regular submissions.',
    features: [
      'Monthly scan allowance included',
      'Saved card portfolio & history',
      'Grader & service tier comparison',
      'Full ROI & market comps',
    ],
    cta: 'Assess my card',
    highlighted: true,
  },
  {
    name: 'Business',
    price: '€100',
    cadence: 'per month',
    badge: 'High volume',
    description: 'For card shops and high-volume sellers grading inventory at scale.',
    features: [
      'High-volume card estimations',
      'Priority processing speed',
      'Bulk inventory workflow support',
      'Submission tracking & alerts',
    ],
    cta: 'Assess my card',
    highlighted: false,
  },
];

export function PricingSection({ onStartGrading }: PricingSectionProps) {
  return (
    <section id="pricing" className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold tracking-widest text-emerald-700 uppercase">
            Simple pricing
          </p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-navy-900 sm:text-4xl">
            Start free, pay only when you need more.
          </h2>
          <p className="mt-3 text-base text-slate-600">
            Test your first three cards for free &mdash; no account or credit card required to
            start.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`flex flex-col justify-between rounded-2xl border p-6 transition ${
                plan.highlighted
                  ? 'border-emerald-500 bg-mint-50/40 shadow-lg shadow-emerald-900/5 ring-1 ring-emerald-500'
                  : 'border-slate-200 bg-white shadow-sm'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-navy-900">{plan.name}</h3>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      plan.highlighted
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {plan.badge}
                  </span>
                </div>

                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="font-mono text-4xl font-extrabold text-navy-900 tabular-nums">
                    {plan.price}
                  </span>
                  <span className="text-sm text-slate-500">{plan.cadence}</span>
                </div>

                <p className="mt-3 text-sm text-slate-600">{plan.description}</p>

                <ul className="mt-6 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={onStartGrading}
                className={`mt-8 w-full rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  plan.highlighted
                    ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                    : 'border border-slate-200 bg-slate-50 text-navy-900 hover:bg-slate-100'
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
