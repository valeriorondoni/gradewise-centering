import { useEffect, useState } from 'react';
import {
  AnalysisRun,
  CardRecord,
  GraderId,
  MarketplaceId,
  MarketplaceListing,
} from '../types/cardRecord';
import {
  createDemoRecords,
  estimateValuesFromCeiling,
  GRADER_TIERS,
  MARKETPLACE_FEES,
  suggestCatalogMatch,
} from '../data/mockMarket';
import { fetchRandomLiveCards } from '../data/pokemonTcgApi';

const STORAGE_KEY = 'gradewise_card_records_v1';

const DEMO_IMAGE_BACKFILL: Record<string, string> = {
  'demo-umbreon-215': 'https://images.pokemontcg.io/swsh7/215.png',
  'demo-charizard-4': 'https://images.pokemontcg.io/base1/4.png',
  'demo-pikachu-085': 'https://images.pokemontcg.io/svp/85.png',
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useCardStore() {
  const [records, setRecords] = useState<CardRecord[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map((r: CardRecord) =>
            !r.cardImageUrl && DEMO_IMAGE_BACKFILL[r.id]
              ? { ...r, cardImageUrl: DEMO_IMAGE_BACKFILL[r.id] }
              : r
          );
        }
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch {
      // ignore storage errors
    }
  }, [records]);

  const addCardFromAnalysis = (
    run: AnalysisRun,
    details: {
      name: string;
      set: string;
      number: string;
      language: string;
      variant: string;
      purchaseCost: number;
      storageLocation?: string;
      cardImageUrl?: string;
      liveRawPriceEur?: number;
    }
  ): CardRecord => {
    const catalog = suggestCatalogMatch(details.name || run.name);
    const val = estimateValuesFromCeiling(run.ceiling, catalog, details.liveRawPriceEur);
    const front = run.sides.find((s) => s.side === 'front');
    const back = run.sides.find((s) => s.side === 'back');

    const newRecord: CardRecord = {
      id: `card-${run.id}`,
      createdAt: todayIso(),
      name: details.name.trim() || catalog.name,
      set: details.set.trim() || catalog.set,
      number: details.number.trim() || catalog.number,
      language: details.language || catalog.language,
      variant: details.variant || catalog.variant,
      purchaseCost: Math.max(0, details.purchaseCost || 0),
      storageLocation: details.storageLocation?.trim() || 'Intake Tray',
      cardImageUrl: details.cardImageUrl,
      runId: run.id,
      mode: run.mode || 'quick',
      estimatedGradeLow: val.low,
      estimatedGradeHigh: val.high,
      centeringCap: run.centering_cap,
      wearCap: run.wear_cap,
      reliable: run.reliable,
      frontOverlayUrl: front?.images.centering
        ? `/tests/${run.id}/${front.images.centering}`
        : undefined,
      backOverlayUrl: back?.images.centering
        ? `/tests/${run.id}/${back.images.centering}`
        : undefined,
      rawValue: val.rawValue,
      gradedValueLow: val.gradedLow,
      gradedValueHigh: val.gradedHigh,
      stage: 'estimated',
      minReturnTargetPct: 20,
      gradingFee: 24,
      shippingInsuranceFee: 18,
      timeline: [
        {
          id: `ev-${Date.now()}`,
          date: todayIso(),
          title: 'Card scanned & imported',
          detail:
            run.ceiling !== null
              ? `Python CV engine estimated max PSA ceiling ${run.ceiling}.`
              : 'Card imported from scan.',
        },
      ],
      listings: [],
    };

    setRecords((prev) => [newRecord, ...prev]);
    return newRecord;
  };

  const updateCard = (id: string, patch: Partial<CardRecord>) => {
    setRecords((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const approveSubmission = (
    id: string,
    grader: GraderId,
    tierName: string,
    minReturnTargetPct: number
  ) => {
    const tier =
      GRADER_TIERS.find((t) => t.grader === grader && t.tier === tierName) || GRADER_TIERS[0];
    const tracking = `${tier.carrier.split(' ')[0].toUpperCase()}-EU-${Math.floor(
      10000000 + Math.random() * 89999999
    )}`;

    setRecords((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              stage: 'submission_approved',
              minReturnTargetPct,
              selectedGrader: tier.grader,
              serviceTier: tier.tier,
              gradingFee: tier.feeEur,
              shippingInsuranceFee: tier.shippingEur,
              carrier: tier.carrier,
              trackingNumber: tracking,
              submissionBatchId: `BATCH-${new Date().toISOString().slice(0, 7)}`,
              timeline: [
                ...c.timeline,
                {
                  id: `ev-${Date.now()}`,
                  date: todayIso(),
                  title: `Submission approved (${tier.grader})`,
                  detail: `${tier.tier} (€${tier.feeEur}) • ${tier.carrier} (€${tier.shippingEur}). Ready to print & send.`,
                  actionRequired: true,
                },
              ],
            }
          : c
      )
    );
  };

  const keepRaw = (id: string) => {
    setRecords((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              stage: 'keep_raw',
              timeline: [
                ...c.timeline,
                {
                  id: `ev-${Date.now()}`,
                  date: todayIso(),
                  title: 'Decision: keep raw',
                  detail: 'Expected grading ROI below target; card stays in raw inventory.',
                },
              ],
            }
          : c
      )
    );
  };

  const markShipped = (id: string) => {
    setRecords((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              stage: 'in_transit_to_grader',
              timeline: [
                ...c.timeline.map((t) => ({ ...t, actionRequired: false })),
                {
                  id: `ev-${Date.now()}`,
                  date: todayIso(),
                  title: 'Parcel handed to carrier',
                  detail: `Tracking ${c.trackingNumber} active via ${c.carrier}.`,
                },
              ],
            }
          : c
      )
    );
  };

  const advanceTracking = (id: string) => {
    setRecords((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        if (c.stage === 'in_transit_to_grader') {
          return {
            ...c,
            stage: 'grading_in_progress',
            timeline: [
              ...c.timeline,
              {
                id: `ev-${Date.now()}`,
                date: todayIso(),
                title: `Received by ${c.selectedGrader || 'grader'}`,
                detail: 'Package checked in and moved to grading queue.',
              },
            ],
          };
        }
        if (c.stage === 'grading_in_progress') {
          return {
            ...c,
            stage: 'return_transit',
            timeline: [
              ...c.timeline,
              {
                id: `ev-${Date.now()}`,
                date: todayIso(),
                title: 'Grading complete — return shipping',
                detail: `Slabbed card dispatched back via ${c.carrier || 'insured courier'}.`,
                actionRequired: true,
              },
            ],
          };
        }
        return c;
      })
    );
  };

  const reconcileCard = (
    id: string,
    officialGrade: number,
    certNumber: string,
    finalExtraCosts: number,
    updatedValue: number
  ) => {
    setRecords((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              stage: 'reconciled',
              officialGrade,
              certNumber: certNumber.trim() || `CERT-${Math.floor(1000000 + Math.random() * 8999999)}`,
              finalExtraCosts,
              updatedValue,
              timeline: [
                ...c.timeline.map((t) => ({ ...t, actionRequired: false })),
                {
                  id: `ev-${Date.now()}`,
                  date: todayIso(),
                  title: `Reconciled: ${c.selectedGrader || 'Official'} ${officialGrade}`,
                  detail: `Estimated ${c.estimatedGradeLow}–${c.estimatedGradeHigh} vs Official ${officialGrade}. Updated value: €${updatedValue}.`,
                },
              ],
            }
          : c
      )
    );
  };

  const publishListings = (
    id: string,
    channels: { channel: MarketplaceId; askingPrice: number }[]
  ) => {
    const newListings: MarketplaceListing[] = channels.map((ch) => ({
      channel: ch.channel,
      status: 'listed',
      askingPrice: ch.askingPrice,
      feePct: MARKETPLACE_FEES[ch.channel],
      listedAt: todayIso(),
    }));

    setRecords((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              stage: 'listed',
              listings: newListings,
              timeline: [
                ...c.timeline,
                {
                  id: `ev-${Date.now()}`,
                  date: todayIso(),
                  title: 'Published to marketplaces',
                  detail: newListings
                    .map((l) => `${l.channel} (€${l.askingPrice})`)
                    .join(', '),
                },
              ],
            }
          : c
      )
    );
  };

  const markSold = (id: string, channel: MarketplaceId, finalSalePrice: number) => {
    setRecords((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const feePct = MARKETPLACE_FEES[channel];
        const sellingFeePaid = Math.round(finalSalePrice * feePct);
        const totalCost =
          c.purchaseCost +
          (c.stage === 'keep_raw' ? 0 : c.gradingFee + c.shippingInsuranceFee) +
          (c.finalExtraCosts || 0);
        const realisedProfit = finalSalePrice - sellingFeePaid - totalCost;

        const updatedListings: MarketplaceListing[] = c.listings.map((l) =>
          l.channel === channel
            ? { ...l, status: 'sold', soldAt: todayIso(), askingPrice: finalSalePrice }
            : { ...l, status: 'delisted' }
        );

        return {
          ...c,
          stage: 'sold',
          soldChannel: channel,
          salePrice: finalSalePrice,
          sellingFeePaid,
          realisedProfit,
          listings: updatedListings,
          timeline: [
            ...c.timeline,
            {
              id: `ev-${Date.now()}`,
              date: todayIso(),
              title: `Sold on ${channel} for €${finalSalePrice}`,
              detail: `Other listings auto-delisted. Net realised profit: €${realisedProfit}.`,
            },
          ],
        };
      })
    );
  };

  const seedDemoCards = async () => {
    const now = todayIso();
    try {
      const liveCards = await fetchRandomLiveCards(3);
      if (liveCards.length > 0) {
        const stages: Array<'estimated' | 'grading_in_progress' | 'listed'> = [
          'estimated',
          'grading_in_progress',
          'listed',
        ];
        const freshRecords: CardRecord[] = liveCards.map((lc, idx) => {
          const stage = stages[idx % stages.length];
          const rawVal = lc.rawMarketPriceEur || 50;
          const uid = `${lc.id}-${Date.now()}-${idx}`;
          const base: CardRecord = {
            id: uid,
            createdAt: now,
            name: lc.name,
            set: lc.set,
            number: lc.number,
            language: 'English',
            variant: lc.rarity,
            purchaseCost: Math.max(5, Math.round(rawVal * 0.8)),
            storageLocation: `Binder ${idx + 1} • Slot ${idx + 2}`,
            cardImageUrl: lc.imageUrl,
            runId: `api-${uid}`,
            mode: 'quick',
            estimatedGradeLow: 8,
            estimatedGradeHigh: 9,
            centeringCap: 9,
            wearCap: 9,
            reliable: true,
            rawValue: rawVal,
            gradedValueLow: Math.round(rawVal * 1.25),
            gradedValueHigh: Math.round(rawVal * 1.75),
            stage,
            minReturnTargetPct: 20,
            gradingFee: 24,
            shippingInsuranceFee: 18,
            timeline: [
              {
                id: `ev-${uid}-1`,
                date: now,
                title: 'Imported from Pokémon TCG API',
                detail: `${lc.name} (${lc.set} #${lc.number}) • Raw market ~€${rawVal}.`,
              },
            ],
            listings: [],
          };

          if (stage === 'grading_in_progress') {
            base.selectedGrader = 'PSA';
            base.serviceTier = 'Value Bulk (EU Partner)';
            base.carrier = 'DHL Express Insured';
            base.trackingNumber = `DHL-EU-${Math.floor(10000000 + Math.random() * 89999999)}`;
            base.submissionBatchId = `BATCH-${now.slice(0, 7)}`;
            base.timeline.push({
              id: `ev-${uid}-2`,
              date: now,
              title: 'At grader (PSA)',
              detail: 'Parcel received by PSA; currently in grading queue.',
            });
          } else if (stage === 'listed') {
            const ask = Math.round(rawVal * 1.7);
            base.selectedGrader = 'CGC';
            base.serviceTier = 'Economy';
            base.gradingFee = 19;
            base.shippingInsuranceFee = 15;
            base.officialGrade = 9.5;
            base.certNumber = `CGC-${Math.floor(100000000 + Math.random() * 899999999)}`;
            base.updatedValue = ask;
            base.listings = [
              {
                channel: 'eBay',
                status: 'listed',
                askingPrice: Math.round(ask * 1.05),
                feePct: 0.13,
                listedAt: now,
              },
              {
                channel: 'Cardmarket',
                status: 'listed',
                askingPrice: ask,
                feePct: 0.05,
                listedAt: now,
              },
            ];
            base.timeline.push({
              id: `ev-${uid}-2`,
              date: now,
              title: 'Reconciled & listed on eBay + Cardmarket',
              detail: `Official CGC 9.5 • Listed from €${ask}.`,
            });
          }
          return base;
        });

        setRecords((prev) => [...freshRecords, ...prev]);
        return;
      }
    } catch {
      // Fallback to static demo records if offline
    }

    setRecords((prev) => {
      const existingIds = new Set(prev.map((r) => r.id));
      const fresh = createDemoRecords().filter((d) => !existingIds.has(d.id));
      return [...fresh, ...prev];
    });
  };

  const deleteCard = (id: string) => {
    setRecords((prev) => prev.filter((c) => c.id !== id));
  };

  return {
    records,
    addCardFromAnalysis,
    updateCard,
    approveSubmission,
    keepRaw,
    markShipped,
    advanceTracking,
    reconcileCard,
    publishListings,
    markSold,
    seedDemoCards,
    deleteCard,
  };
}
