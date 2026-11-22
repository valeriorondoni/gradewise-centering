import { Layers, ShieldCheck } from 'lucide-react';

export type AppView = 'landing' | 'grading' | 'inventory';

interface NavbarProps {
  view: AppView;
  cardCount: number;
  onGoHome: () => void;
  onStartGrading: () => void;
  onOpenInventory: () => void;
}

export function Navbar({
  view,
  cardCount,
  onGoHome,
  onStartGrading,
  onOpenInventory,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md print:hidden">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onGoHome}
          className="flex items-center gap-2.5 text-left focus:outline-none"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold tracking-tight text-navy-900">
            Grade<span className="text-emerald-600">Wise</span>
          </span>
        </button>

        {view === 'landing' && (
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <a href="#how-it-works" className="transition-colors hover:text-navy-900">
              How it works
            </a>
            <a href="#sample-report" className="transition-colors hover:text-navy-900">
              Sample report
            </a>
            <a href="#pricing" className="transition-colors hover:text-navy-900">
              Pricing
            </a>
          </nav>
        )}

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenInventory}
            className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold transition ${
              view === 'inventory'
                ? 'border-navy-900 bg-navy-900 text-white'
                : 'border-slate-200 bg-white text-navy-900 hover:bg-slate-50'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>My Cards</span>
            {cardCount > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums ${
                  view === 'inventory'
                    ? 'bg-emerald-500 text-navy-900'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {cardCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onStartGrading}
            className={`rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition ${
              view === 'grading'
                ? 'bg-emerald-700 text-white'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            Assess my card
          </button>
        </div>
      </div>
    </header>
  );
}
