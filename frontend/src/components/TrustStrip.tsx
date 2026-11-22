import { Calculator, Layers, Scale, ShieldAlert } from 'lucide-react';

const ITEMS = [
  {
    icon: Layers,
    label: '4-point condition check',
    detail: 'Centering, corners, edges & surface',
  },
  {
    icon: Scale,
    label: 'Transparent grade range',
    detail: 'Probabilistic ceiling, not a guess',
  },
  {
    icon: Calculator,
    label: 'All costs considered',
    detail: 'Grading fees & shipping in net ROI',
  },
  {
    icon: ShieldAlert,
    label: 'No grade guarantees',
    detail: 'Honest, independent pre-check',
  },
];

export function TrustStrip() {
  return (
    <section className="border-y border-slate-200/80 bg-white">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 py-6 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-navy-900">{item.label}</p>
                <p className="text-xs text-slate-500">{item.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
