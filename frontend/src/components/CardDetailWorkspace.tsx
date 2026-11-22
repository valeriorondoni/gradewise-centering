import { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  PackageCheck,
  Printer,
  ShoppingBag,
  Sparkles,
  Trash2,
  Truck,
} from 'lucide-react';
import {
  CardRecord,
  GraderId,
  MarketplaceId,
} from '../types/cardRecord';
import { GRADER_TIERS, MARKETPLACE_FEES } from '../data/mockMarket';

interface CardDetailWorkspaceProps {
  card: CardRecord;
  onBack: () => void;
  onApproveSubmission: (
    id: string,
    grader: GraderId,
    tier: string,
    minReturnTargetPct: number
  ) => void;
  onKeepRaw: (id: string) => void;
  onMarkShipped: (id: string) => void;
  onAdvanceTracking: (id: string) => void;
  onReconcile: (
    id: string,
    officialGrade: number,
    certNumber: string,
    extraCosts: number,
    updatedValue: number
  ) => void;
  onPublishListings: (
    id: string,
    channels: { channel: MarketplaceId; askingPrice: number }[]
  ) => void;
  onMarkSold: (id: string, channel: MarketplaceId, salePrice: number) => void;
  onDelete: (id: string) => void;
}

const STAGES_7 = [
  '1. Import',
  '2. Estimate',
  '3. Decide',
  '4. Print & Send',
  '5. Track',
  '6. Reconcile',
  '7. Sell',
];

function stageStepIndex(stage: CardRecord['stage']): number {
  switch (stage) {
    case 'imported':
      return 0;
    case 'estimated':
      return 2;
    case 'keep_raw':
      return 2;
    case 'submission_approved':
      return 3;
    case 'in_transit_to_grader':
    case 'grading_in_progress':
    case 'return_transit':
      return 4;
    case 'reconciled':
      return 5;
    case 'listed':
    case 'sold':
      return 6;
  }
}

export function CardDetailWorkspace({
  card,
  onBack,
  onApproveSubmission,
  onKeepRaw,
  onMarkShipped,
  onAdvanceTracking,
  onReconcile,
  onPublishListings,
  onMarkSold,
  onDelete,
}: CardDetailWorkspaceProps) {
  const [selectedTierIdx, setSelectedTierIdx] = useState(0);
  const [minTargetPct, setMinTargetPct] = useState(card.minReturnTargetPct || 20);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Stage 6 reconcile inputs
  const [officialGrade, setOfficialGrade] = useState(card.estimatedGradeHigh || 9);
  const [certNumber, setCertNumber] = useState(card.certNumber || '');
  const [extraCosts, setExtraCosts] = useState(card.finalExtraCosts || 0);
  const [updatedValue, setUpdatedValue] = useState(
    card.updatedValue || Math.round((card.gradedValueLow + card.gradedValueHigh) / 2)
  );

  // Stage 7 marketplace inputs
  const defaultAsk = card.updatedValue || card.rawValue;
  const [selectedChannels, setSelectedChannels] = useState<Record<MarketplaceId, boolean>>({
    eBay: true,
    Cardmarket: true,
    CardTrader: false,
  });
  const [askingPrices, setAskingPrices] = useState<Record<MarketplaceId, number>>({
    eBay: Math.round(defaultAsk * 1.05),
    Cardmarket: defaultAsk,
    CardTrader: defaultAsk,
  });

  const activeStep = stageStepIndex(card.stage);
  const tier = GRADER_TIERS[selectedTierIdx] || GRADER_TIERS[0];

  // Financial ROI comparison for Stage 3
  const expectedGradedMid = Math.round((card.gradedValueLow + card.gradedValueHigh) / 2);
  const estSellingFee = Math.round(expectedGradedMid * 0.08);
  const netGradedProceeds =
    expectedGradedMid - tier.feeEur - tier.shippingEur - estSellingFee;
  const netGainOverRaw = netGradedProceeds - card.rawValue;
  const roiPct =
    tier.feeEur + tier.shippingEur > 0
      ? Math.round((netGainOverRaw / (tier.feeEur + tier.shippingEur)) * 100)
      : 0;
  const meetsTarget = roiPct >= minTargetPct && netGainOverRaw > 0;

  const totalCommitted =
    card.purchaseCost +
    (['imported', 'estimated', 'keep_raw'].includes(card.stage)
      ? 0
      : card.gradingFee + card.shippingInsuranceFee) +
    (card.finalExtraCosts || 0);

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-slate-50 py-10">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-navy-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to My Cards
          </button>

          <button
            type="button"
            onClick={() => {
              onDelete(card.id);
              onBack();
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-rose-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove card
          </button>
        </div>

        {/* Card Header & 7-Stage Stepper */}
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              {card.cardImageUrl && (
                <img
                  src={card.cardImageUrl}
                  alt={card.name}
                  className="h-20 w-14 shrink-0 rounded-lg border border-slate-200 object-cover shadow-sm"
                />
              )}
              <div>
                <p className="font-mono text-xs font-semibold text-emerald-700">
                  RECORD #{card.id} &bull; {card.language} &bull; {card.variant}
                </p>
                <h1 className="mt-1 text-2xl font-extrabold text-navy-900">
                  {card.name}{' '}
                  <span className="font-normal text-slate-500">
                    ({card.set} #{card.number})
                  </span>
                </h1>
                <p className="mt-1 text-xs text-slate-500">
                  Purchase cost: <strong className="text-navy-900">€{card.purchaseCost}</strong>{' '}
                  &bull; Total committed:{' '}
                  <strong className="text-navy-900">€{totalCommitted}</strong>
                  {card.storageLocation ? ` • Location: ${card.storageLocation}` : ''}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-right">
              <p className="text-[11px] font-medium text-slate-500">
                {card.officialGrade ? 'Official Grade' : 'Estimated Grade (Not Official)'}
              </p>
              <p className="font-mono text-2xl font-extrabold text-navy-900 tabular-nums">
                {card.officialGrade
                  ? `${card.selectedGrader || 'PSA'} ${card.officialGrade}`
                  : `${card.estimatedGradeLow}–${card.estimatedGradeHigh}`}
              </p>
            </div>
          </div>

          {/* 7-stage progress */}
          <div className="mt-6 grid grid-cols-2 gap-2 border-t border-slate-100 pt-5 sm:grid-cols-7">
            {STAGES_7.map((label, idx) => {
              const done = idx < activeStep || card.stage === 'sold';
              const current = idx === activeStep && card.stage !== 'sold';
              return (
                <div
                  key={label}
                  className={`rounded-lg px-2.5 py-2 text-center text-[11px] font-semibold ${
                    done
                      ? 'bg-emerald-50 text-emerald-800'
                      : current
                        ? 'bg-navy-900 text-white'
                        : 'bg-slate-50 text-slate-400'
                  }`}
                >
                  {label}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          {/* Left Column: Active Workflow Stage */}
          <div className="space-y-6 lg:col-span-7">
            {/* Stage 2-3: Decision & Grader Selection */}
            {card.stage === 'estimated' && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-navy-900">
                  Stage 3: Decide whether to grade
                </h2>
                <p className="mt-1 text-xs text-slate-600">
                  Compare expected graded return (minus fees &amp; shipping) against selling raw.
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-navy-900">
                      Grader &amp; Service Tier
                    </label>
                    <select
                      value={selectedTierIdx}
                      onChange={(e) => setSelectedTierIdx(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-navy-900"
                    >
                      {GRADER_TIERS.map((t, i) => (
                        <option key={`${t.grader}-${t.tier}`} value={i}>
                          {t.grader} — {t.tier} (€{t.feeEur} + €{t.shippingEur} ship)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-navy-900">
                      Min. Return Target on Grading Fees (%)
                    </label>
                    <input
                      type="number"
                      value={minTargetPct}
                      onChange={(e) => setMinTargetPct(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm text-navy-900"
                    />
                  </div>
                </div>

                {/* ROI Breakdown */}
                <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 text-sm">
                  <div className="flex justify-between border-b border-slate-100 px-4 py-2.5">
                    <span className="text-slate-600">Raw market value (sell as-is)</span>
                    <span className="font-mono font-semibold text-navy-900">€{card.rawValue}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 px-4 py-2.5">
                    <span className="text-slate-600">
                      Expected graded value ({card.estimatedGradeLow}–{card.estimatedGradeHigh})
                    </span>
                    <span className="font-mono font-semibold text-navy-900">
                      €{card.gradedValueLow}–€{card.gradedValueHigh}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 px-4 py-2.5">
                    <span className="text-slate-600">
                      Grading + Insured Shipping + Est. Selling Fee
                    </span>
                    <span className="font-mono text-rose-600">
                      -€{tier.feeEur + tier.shippingEur + estSellingFee}
                    </span>
                  </div>
                  <div
                    className={`flex justify-between px-4 py-3 font-semibold ${
                      meetsTarget ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'
                    }`}
                  >
                    <span>Net expected gain vs. selling raw</span>
                    <span className="font-mono">
                      {netGainOverRaw >= 0 ? `+€${netGainOverRaw}` : `-€${Math.abs(netGainOverRaw)}`}{' '}
                      ({roiPct}% ROI)
                    </span>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      onApproveSubmission(card.id, tier.grader, tier.tier, minTargetPct)
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Approve {tier.grader} submission (€{tier.feeEur + tier.shippingEur})
                  </button>
                  <button
                    type="button"
                    onClick={() => onKeepRaw(card.id)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-900 hover:bg-slate-50"
                  >
                    Keep raw in inventory
                  </button>
                </div>
              </div>
            )}

            {/* Stage 4: Print & Send */}
            {card.stage === 'submission_approved' && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-navy-900">
                  Stage 4: Print documents &amp; ship parcel
                </h2>
                <p className="mt-1 text-xs text-slate-600">
                  Submission batch <strong>{card.submissionBatchId}</strong> &bull; Carrier:{' '}
                  <strong>{card.carrier}</strong> &bull; Tracking:{' '}
                  <span className="font-mono">{card.trackingNumber}</span>
                </p>

                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
                  <p className="font-bold text-navy-900">Packing Checklist</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    <li>Place card in penny sleeve + semi-rigid Card Saver.</li>
                    <li>Sandwich between two rigid cardboard pieces with painter&apos;s tape.</li>
                    <li>Include printed GradeWise submission slip inside the box.</li>
                  </ul>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setShowPrintModal(true)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-900 hover:bg-slate-50"
                  >
                    <Printer className="h-4 w-4" />
                    Preview / Print label &amp; slip
                  </button>
                  <button
                    type="button"
                    onClick={() => onMarkShipped(card.id)}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    <Truck className="h-4 w-4" />
                    Mark handed to carrier
                  </button>
                </div>
              </div>
            )}

            {/* Stage 5: Track Shipping & Grading */}
            {['in_transit_to_grader', 'grading_in_progress'].includes(card.stage) && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-navy-900">
                  Stage 5: Live shipping &amp; grading updates
                </h2>
                <p className="mt-1 text-xs text-slate-600">
                  Tracking <span className="font-mono font-semibold">{card.trackingNumber}</span>{' '}
                  via {card.carrier}.
                </p>

                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => onAdvanceTracking(card.id)}
                    className="inline-flex items-center gap-2 rounded-xl bg-navy-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-800"
                  >
                    <Sparkles className="h-4 w-4 text-emerald-400" />
                    {card.stage === 'in_transit_to_grader'
                      ? 'Simulate update: Grader received parcel'
                      : 'Simulate update: Grading complete & returning'}
                  </button>
                </div>
              </div>
            )}

            {/* Stage 6: Receive & Reconcile */}
            {card.stage === 'return_transit' && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-navy-900">
                  Stage 6: Receive &amp; reconcile graded card
                </h2>
                <p className="mt-1 text-xs text-slate-600">
                  Confirm the returned slab&apos;s official grade, certificate number, and updated
                  market value.
                </p>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-navy-900">
                      Official Grade ({card.selectedGrader || 'PSA'})
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      step={0.5}
                      value={officialGrade}
                      onChange={(e) => setOfficialGrade(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-navy-900">
                      Certificate Number
                    </label>
                    <input
                      type="text"
                      value={certNumber}
                      onChange={(e) => setCertNumber(e.target.value)}
                      placeholder="e.g. 94821044"
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-navy-900">
                      Extra Upcharges / Customs (€)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={extraCosts}
                      onChange={(e) => setExtraCosts(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-navy-900">
                      Updated Market Value (€)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={updatedValue}
                      onChange={(e) => setUpdatedValue(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onReconcile(card.id, officialGrade, certNumber, extraCosts, updatedValue)
                  }
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  <ClipboardCheck className="h-4 w-4" />
                  Confirm receipt &amp; reconcile record
                </button>
              </div>
            )}

            {/* Stage 7: Publish to Connected Marketplaces */}
            {(card.stage === 'reconciled' || card.stage === 'keep_raw') && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-navy-900">
                  Stage 7: Sell through connected marketplaces
                </h2>
                <p className="mt-1 text-xs text-slate-600">
                  Approve publication to your connected channels. When sold on one channel, the
                  others auto-delist.
                </p>

                <div className="mt-4 space-y-3">
                  {(['eBay', 'Cardmarket', 'CardTrader'] as MarketplaceId[]).map((ch) => (
                    <div
                      key={ch}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
                    >
                      <label className="flex items-center gap-2.5 text-sm font-semibold text-navy-900">
                        <input
                          type="checkbox"
                          checked={selectedChannels[ch]}
                          onChange={(e) =>
                            setSelectedChannels((prev) => ({ ...prev, [ch]: e.target.checked }))
                          }
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                        />
                        {ch}
                        <span className="text-xs font-normal text-slate-400">
                          ({Math.round(MARKETPLACE_FEES[ch] * 100)}% fee)
                        </span>
                      </label>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Asking €</span>
                        <input
                          type="number"
                          value={askingPrices[ch]}
                          onChange={(e) =>
                            setAskingPrices((prev) => ({
                              ...prev,
                              [ch]: Number(e.target.value),
                            }))
                          }
                          className="w-24 rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const active = (['eBay', 'Cardmarket', 'CardTrader'] as MarketplaceId[])
                      .filter((c) => selectedChannels[c])
                      .map((c) => ({ channel: c, askingPrice: askingPrices[c] }));
                    if (active.length > 0) onPublishListings(card.id, active);
                  }}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  <ShoppingBag className="h-4 w-4" />
                  Approve &amp; publish listings
                </button>
              </div>
            )}

            {/* Active Listings -> Simulate Sale */}
            {card.stage === 'listed' && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-navy-900">Active marketplace listings</h2>
                <p className="mt-1 text-xs text-slate-600">
                  Simulate a buyer purchase on any channel to auto-delist the others and record
                  realised profit.
                </p>

                <div className="mt-4 space-y-3">
                  {card.listings.map((l) => (
                    <div
                      key={l.channel}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                    >
                      <div>
                        <p className="text-sm font-bold text-navy-900">{l.channel}</p>
                        <p className="text-xs text-slate-500">
                          Listed at <strong className="font-mono">€{l.askingPrice}</strong> &bull;{' '}
                          {Math.round(l.feePct * 100)}% fee
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onMarkSold(card.id, l.channel, l.askingPrice)}
                        className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Simulate sale (€{l.askingPrice})
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sold Summary */}
            {card.stage === 'sold' && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6 shadow-sm">
                <div className="flex items-center gap-2 text-emerald-800">
                  <PackageCheck className="h-5 w-5" />
                  <h2 className="text-lg font-bold">Sold on {card.soldChannel}</h2>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-[11px] text-slate-500">Sale Price</p>
                    <p className="font-mono text-lg font-bold text-navy-900">€{card.salePrice}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-[11px] text-slate-500">Total Costs + Fees</p>
                    <p className="font-mono text-lg font-bold text-rose-600">
                      -€{totalCommitted + (card.sellingFeePaid || 0)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-[11px] text-slate-500">Realised Profit</p>
                    <p
                      className={`font-mono text-lg font-extrabold ${
                        (card.realisedProfit || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {(card.realisedProfit || 0) >= 0
                        ? `+€${card.realisedProfit}`
                        : `-€${Math.abs(card.realisedProfit || 0)}`}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Continuous Timeline & Engine Overlays */}
          <div className="space-y-6 lg:col-span-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-base font-bold text-navy-900">Card Timeline</h3>
              <div className="mt-4 space-y-4">
                {card.timeline.map((ev) => (
                  <div key={ev.id} className="relative border-l-2 border-emerald-200 pl-4">
                    <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-emerald-600" />
                    <p className="font-mono text-[11px] text-slate-400">{ev.date}</p>
                    <p className="text-sm font-bold text-navy-900">{ev.title}</p>
                    <p className="text-xs text-slate-600">{ev.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            {(card.frontOverlayUrl || card.backOverlayUrl) && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-base font-bold text-navy-900">Python CV Scan Overlays</h3>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {card.frontOverlayUrl && (
                    <img
                      src={card.frontOverlayUrl}
                      alt="Front centering"
                      className="aspect-[4/3] w-full rounded-lg bg-slate-950 object-contain"
                    />
                  )}
                  {card.backOverlayUrl && (
                    <img
                      src={card.backOverlayUrl}
                      alt="Back centering"
                      className="aspect-[4/3] w-full rounded-lg bg-slate-950 object-contain"
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Printable Submission & Label Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="border-b border-slate-200 pb-4">
              <p className="text-xs font-bold text-emerald-700 uppercase">
                GradeWise Submission &amp; Shipping Label
              </p>
              <h3 className="mt-1 text-lg font-extrabold text-navy-900">
                {card.selectedGrader} — {card.serviceTier}
              </h3>
            </div>
            <div className="mt-4 space-y-2 text-xs text-slate-700">
              <p>
                <strong>Batch:</strong> {card.submissionBatchId}
              </p>
              <p>
                <strong>Card:</strong> {card.name} ({card.set} #{card.number})
              </p>
              <p>
                <strong>Carrier:</strong> {card.carrier}
              </p>
              <p>
                <strong>Tracking:</strong> <span className="font-mono">{card.trackingNumber}</span>
              </p>
            </div>
            <div className="mt-6 flex justify-end gap-3 print:hidden">
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-navy-900"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-lg bg-navy-900 px-4 py-2 text-xs font-semibold text-white"
              >
                Print document
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
