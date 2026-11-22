import { useState } from 'react';
import {
  ArrowRight,
  Coins,
  Layers,
  Loader2,
  Package,
  Plus,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { CardRecord, CardStage } from '../types/cardRecord';

interface InventoryDashboardProps {
  records: CardRecord[];
  onSelectCard: (id: string) => void;
  onStartGrading: () => void;
  onSeedDemo: () => Promise<void> | void;
}

const STAGE_META: Record<CardStage, { label: string; badge: string; nextAction: string }> = {
  imported: {
    label: 'Imported',
    badge: 'bg-slate-100 text-slate-700',
    nextAction: 'Review estimate & ROI',
  },
  estimated: {
    label: 'Estimated',
    badge: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
    nextAction: 'Decide: submit or keep raw',
  },
  keep_raw: {
    label: 'Kept Raw',
    badge: 'bg-slate-100 text-slate-600',
    nextAction: 'List raw on marketplace',
  },
  submission_approved: {
    label: 'Ready to Ship',
    badge: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
    nextAction: 'Print label & hand to carrier',
  },
  in_transit_to_grader: {
    label: 'In Transit',
    badge: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
    nextAction: 'Track outbound shipment',
  },
  grading_in_progress: {
    label: 'At Grader',
    badge: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
    nextAction: 'Await grading update',
  },
  return_transit: {
    label: 'Returning',
    badge: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
    nextAction: 'Receive & reconcile slab',
  },
  reconciled: {
    label: 'Reconciled',
    badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    nextAction: 'Publish to marketplaces',
  },
  listed: {
    label: 'Listed',
    badge: 'bg-emerald-100 text-emerald-800',
    nextAction: 'Manage active listings',
  },
  sold: {
    label: 'Sold',
    badge: 'bg-navy-900 text-white',
    nextAction: 'Completed',
  },
};

type FilterTab = 'all' | 'decision' | 'grading' | 'market' | 'sold';

export function InventoryDashboard({
  records,
  onSelectCard,
  onStartGrading,
  onSeedDemo,
}: InventoryDashboardProps) {
  const [filter, setFilter] = useState<FilterTab>('all');
  const [loadingLive, setLoadingLive] = useState(false);

  const handleLoadLive = async () => {
    setLoadingLive(true);
    try {
      await onSeedDemo();
    } finally {
      setLoadingLive(false);
    }
  };

  const totalCommitted = records.reduce(
    (sum, r) =>
      sum +
      r.purchaseCost +
      (r.stage === 'keep_raw' || r.stage === 'estimated' || r.stage === 'imported'
        ? 0
        : r.gradingFee + r.shippingInsuranceFee) +
      (r.finalExtraCosts || 0),
    0
  );

  const inGradingCount = records.filter((r) =>
    [
      'submission_approved',
      'in_transit_to_grader',
      'grading_in_progress',
      'return_transit',
    ].includes(r.stage)
  ).length;

  const realisedProfit = records.reduce((sum, r) => sum + (r.realisedProfit || 0), 0);

  const filtered = records.filter((r) => {
    if (filter === 'all') return true;
    if (filter === 'decision') return ['imported', 'estimated', 'keep_raw'].includes(r.stage);
    if (filter === 'grading')
      return [
        'submission_approved',
        'in_transit_to_grader',
        'grading_in_progress',
        'return_transit',
      ].includes(r.stage);
    if (filter === 'market') return ['reconciled', 'listed'].includes(r.stage);
    if (filter === 'sold') return r.stage === 'sold';
    return true;
  });

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-slate-50 py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-widest text-emerald-700 uppercase">
              Centralised Card Management
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy-900 sm:text-3xl">
              My Card Inventory
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              One continuous record per card &mdash; from first scan through grading, tracking, and
              resale.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleLoadLive}
              disabled={loadingLive}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-900 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
            >
              {loadingLive ? (
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
              ) : (
                <Sparkles className="h-4 w-4 text-emerald-600" />
              )}
              {loadingLive ? 'Fetching API cards...' : 'Load live cards (API)'}
            </button>
            <button
              type="button"
              onClick={onStartGrading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              Assess new card
            </button>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Total Cards</span>
              <Layers className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-2 font-mono text-2xl font-extrabold text-navy-900 tabular-nums">
              {records.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Capital Committed</span>
              <Coins className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-2 font-mono text-2xl font-extrabold text-navy-900 tabular-nums">
              €{totalCommitted}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Active in Grading</span>
              <Package className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-2 font-mono text-2xl font-extrabold text-navy-900 tabular-nums">
              {inGradingCount}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Realised Profit</span>
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
            <p
              className={`mt-2 font-mono text-2xl font-extrabold tabular-nums ${
                realisedProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {realisedProfit >= 0 ? `+€${realisedProfit}` : `-€${Math.abs(realisedProfit)}`}
            </p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="mt-8 flex flex-wrap gap-2">
          {(
            [
              { id: 'all', label: 'All cards' },
              { id: 'decision', label: 'Estimate & Decision' },
              { id: 'grading', label: 'Shipping & Grading' },
              { id: 'market', label: 'Reconciled & Listed' },
              { id: 'sold', label: 'Sold' },
            ] as { id: FilterTab; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                filter === tab.id
                  ? 'bg-navy-900 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Empty State or Card Table */}
        {filtered.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <Layers className="mx-auto h-10 w-10 text-slate-300" />
            <h2 className="mt-3 text-lg font-bold text-navy-900">
              {records.length === 0 ? 'No cards in your inventory yet' : 'No cards in this stage'}
            </h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              Scan and assess a card using the Python CV engine, or load 3 sample cards to explore
              the full 7-stage GradeWise workflow.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={onStartGrading}
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Assess a card
              </button>
              {records.length === 0 && (
                <button
                  type="button"
                  onClick={handleLoadLive}
                  disabled={loadingLive}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-navy-900 hover:bg-slate-50"
                >
                  {loadingLive ? 'Fetching API cards...' : 'Load 3 live cards from API'}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            {filtered.map((card) => {
              const meta = STAGE_META[card.stage];
              const committed =
                card.purchaseCost +
                (['imported', 'estimated', 'keep_raw'].includes(card.stage)
                  ? 0
                  : card.gradingFee + card.shippingInsuranceFee) +
                (card.finalExtraCosts || 0);

              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => onSelectCard(card.id)}
                  className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-emerald-300 hover:shadow-md sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    {card.cardImageUrl ? (
                      <img
                        src={card.cardImageUrl}
                        alt={card.name}
                        className="h-14 w-10 shrink-0 rounded-md border border-slate-200 object-cover shadow-sm"
                      />
                    ) : (
                      <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-100 text-[10px] font-bold text-slate-400">
                        TCG
                      </div>
                    )}
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-base font-bold text-navy-900">{card.name}</span>
                        <span className="text-xs text-slate-500">
                          {card.set} &bull; #{card.number}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${meta.badge}`}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Next action:{' '}
                        <span className="font-medium text-navy-900">{meta.nextAction}</span>
                        {card.storageLocation ? ` • ${card.storageLocation}` : ''}
                        {card.submissionBatchId ? ` • ${card.submissionBatchId}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-6 sm:shrink-0">
                    <div>
                      <p className="text-[11px] text-slate-400">
                        {card.officialGrade ? 'Official Grade' : 'Est. Grade'}
                      </p>
                      <p className="font-mono text-sm font-bold text-navy-900 tabular-nums">
                        {card.officialGrade
                          ? `${card.selectedGrader || 'Grade'} ${card.officialGrade}`
                          : `${card.estimatedGradeLow}–${card.estimatedGradeHigh}`}
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] text-slate-400">Committed</p>
                      <p className="font-mono text-sm font-bold text-navy-900 tabular-nums">
                        €{committed}
                      </p>
                    </div>

                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                      Open record
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
