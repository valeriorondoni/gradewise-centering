import { CardRecord, GraderId, MarketplaceId } from '../types/cardRecord';

export interface CatalogSuggestion {
  name: string;
  set: string;
  number: string;
  language: string;
  variant: string;
  rawValue: number;
  gradedBase10: number;
  gradedBase9: number;
  gradedBase8: number;
}

export const MOCK_CATALOG: CatalogSuggestion[] = [
  {
    name: 'Charizard',
    set: 'Base Set',
    number: '4/102',
    language: 'English',
    variant: 'Holo',
    rawValue: 190,
    gradedBase10: 6200,
    gradedBase9: 1150,
    gradedBase8: 440,
  },
  {
    name: 'Umbreon VMAX',
    set: 'Evolving Skies',
    number: '215/203',
    language: 'English',
    variant: 'Full Art / Alt Art',
    rawValue: 640,
    gradedBase10: 1320,
    gradedBase9: 790,
    gradedBase8: 660,
  },
  {
    name: 'Lugia',
    set: 'Neo Genesis',
    number: '9/111',
    language: 'English',
    variant: 'Holo',
    rawValue: 165,
    gradedBase10: 4100,
    gradedBase9: 860,
    gradedBase8: 340,
  },
  {
    name: 'Pikachu (Van Gogh)',
    set: 'SVP Black Star Promos',
    number: '085',
    language: 'English',
    variant: 'Promo',
    rawValue: 95,
    gradedBase10: 275,
    gradedBase9: 135,
    gradedBase8: 100,
  },
  {
    name: 'Blastoise',
    set: 'Base Set',
    number: '2/102',
    language: 'English',
    variant: 'Holo',
    rawValue: 85,
    gradedBase10: 2600,
    gradedBase9: 490,
    gradedBase8: 210,
  },
];

export interface GraderTier {
  grader: GraderId;
  tier: string;
  feeEur: number;
  turnaroundDays: string;
  carrier: string;
  shippingEur: number;
}

export const GRADER_TIERS: GraderTier[] = [
  {
    grader: 'PSA',
    tier: 'Value Bulk (EU Partner)',
    feeEur: 24,
    turnaroundDays: '45 business days',
    carrier: 'DHL Express Insured',
    shippingEur: 18,
  },
  {
    grader: 'PSA',
    tier: 'Regular',
    feeEur: 68,
    turnaroundDays: '15 business days',
    carrier: 'DHL Express Insured',
    shippingEur: 22,
  },
  {
    grader: 'BGS',
    tier: 'Standard (Subgrades)',
    feeEur: 38,
    turnaroundDays: '30 business days',
    carrier: 'UPS Express Saver',
    shippingEur: 20,
  },
  {
    grader: 'CGC',
    tier: 'Economy',
    feeEur: 19,
    turnaroundDays: '25 business days',
    carrier: 'DPD Insured',
    shippingEur: 15,
  },
];

export const MARKETPLACE_FEES: Record<MarketplaceId, number> = {
  eBay: 0.13,
  Cardmarket: 0.05,
  CardTrader: 0.06,
};

export function suggestCatalogMatch(query: string): CatalogSuggestion {
  const q = query.trim().toLowerCase();
  if (q) {
    const found = MOCK_CATALOG.find(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.set.toLowerCase().includes(q) ||
        c.number.toLowerCase().includes(q)
    );
    if (found) return found;
  }
  return {
    name: query.trim() || 'Trading Card',
    set: 'Collector Set',
    number: '001/100',
    language: 'English',
    variant: 'Holo',
    rawValue: 80,
    gradedBase10: 320,
    gradedBase9: 175,
    gradedBase8: 110,
  };
}

export function estimateValuesFromCeiling(
  ceiling: number | null,
  catalog: CatalogSuggestion,
  liveRawPriceEur?: number
): { low: number; high: number; rawValue: number; gradedLow: number; gradedHigh: number } {
  const g = ceiling ?? 8;
  const low = Math.max(6, g - 1);
  const high = Math.min(10, g);
  const rawValue = liveRawPriceEur && liveRawPriceEur > 0 ? liveRawPriceEur : catalog.rawValue;

  const valForGrade = (grade: number) => {
    if (liveRawPriceEur && liveRawPriceEur > 0) {
      if (grade >= 10) return Math.round(rawValue * 2.8);
      if (grade === 9) return Math.round(rawValue * 1.45);
      if (grade === 8) return Math.round(rawValue * 1.15);
      return Math.round(rawValue * 0.95);
    }
    if (grade >= 10) return catalog.gradedBase10;
    if (grade === 9) return catalog.gradedBase9;
    if (grade === 8) return catalog.gradedBase8;
    return Math.round(rawValue * 0.95);
  };

  return {
    low,
    high,
    rawValue,
    gradedLow: valForGrade(low),
    gradedHigh: valForGrade(high),
  };
}

export function createDemoRecords(): CardRecord[] {
  const now = new Date().toISOString().slice(0, 10);
  return [
    {
      id: 'demo-umbreon-215',
      createdAt: now,
      name: 'Umbreon VMAX',
      set: 'Evolving Skies',
      number: '215/203',
      language: 'English',
      variant: 'Full Art / Alt Art',
      purchaseCost: 520,
      storageLocation: 'Binder A • Slot 4',
      cardImageUrl: 'https://images.pokemontcg.io/swsh7/215.png',
      runId: 'demo-run-001',
      mode: 'detailed',
      estimatedGradeLow: 9,
      estimatedGradeHigh: 10,
      centeringCap: 10,
      wearCap: 10,
      reliable: true,
      rawValue: 640,
      gradedValueLow: 790,
      gradedValueHigh: 1320,
      stage: 'estimated',
      minReturnTargetPct: 20,
      gradingFee: 24,
      shippingInsuranceFee: 18,
      timeline: [
        {
          id: 't1',
          date: now,
          title: 'Card scanned & imported',
          detail: 'Front/back centering 51/49 L/R, 50/50 T/B. Max PSA ceiling: 10.',
        },
      ],
      listings: [],
    },
    {
      id: 'demo-charizard-4',
      createdAt: now,
      name: 'Charizard',
      set: 'Base Set',
      number: '4/102',
      language: 'English',
      variant: 'Holo',
      purchaseCost: 160,
      storageLocation: 'Grading Box #2',
      cardImageUrl: 'https://images.pokemontcg.io/base1/4.png',
      runId: 'demo-run-002',
      mode: 'detailed',
      estimatedGradeLow: 8,
      estimatedGradeHigh: 9,
      centeringCap: 9,
      wearCap: 9,
      reliable: true,
      rawValue: 190,
      gradedValueLow: 440,
      gradedValueHigh: 1150,
      stage: 'grading_in_progress',
      minReturnTargetPct: 25,
      selectedGrader: 'PSA',
      serviceTier: 'Value Bulk (EU Partner)',
      gradingFee: 24,
      shippingInsuranceFee: 18,
      carrier: 'DHL Express Insured',
      trackingNumber: 'DHL-EU-88412093',
      submissionBatchId: 'BATCH-2026-11',
      timeline: [
        {
          id: 't1',
          date: '2026-11-10',
          title: 'Submission approved',
          detail: 'Selected PSA Value Bulk (€24) + DHL Express Insured (€18).',
        },
        {
          id: 't2',
          date: '2026-11-12',
          title: 'Outbound parcel shipped',
          detail: 'Handed to DHL Express (DHL-EU-88412093).',
        },
        {
          id: 't3',
          date: '2026-11-18',
          title: 'Received by grader & grading in progress',
          detail: 'PSA confirmed intake; currently in Assembly / Grading.',
        },
      ],
      listings: [],
    },
    {
      id: 'demo-pikachu-085',
      createdAt: now,
      name: 'Pikachu (Van Gogh)',
      set: 'SVP Black Star Promos',
      number: '085',
      language: 'English',
      variant: 'Promo',
      purchaseCost: 75,
      storageLocation: 'Slab Case #1',
      cardImageUrl: 'https://images.pokemontcg.io/svp/85.png',
      runId: 'demo-run-003',
      mode: 'quick',
      estimatedGradeLow: 9,
      estimatedGradeHigh: 10,
      centeringCap: 10,
      wearCap: 10,
      reliable: true,
      rawValue: 95,
      gradedValueLow: 135,
      gradedValueHigh: 275,
      stage: 'listed',
      minReturnTargetPct: 20,
      selectedGrader: 'CGC',
      serviceTier: 'Economy',
      gradingFee: 19,
      shippingInsuranceFee: 15,
      carrier: 'DPD Insured',
      trackingNumber: 'DPD-NL-449102',
      submissionBatchId: 'BATCH-2026-10',
      officialGrade: 10,
      certNumber: 'CGC-4492019882',
      finalExtraCosts: 0,
      updatedValue: 260,
      timeline: [
        {
          id: 't1',
          date: '2026-10-15',
          title: 'Submission approved & shipped',
          detail: 'CGC Economy via DPD Insured.',
        },
        {
          id: 't2',
          date: '2026-11-08',
          title: 'Graded card received & reconciled',
          detail: 'Official Grade: CGC 10 (Cert #CGC-4492019882).',
        },
        {
          id: 't3',
          date: '2026-11-12',
          title: 'Published to connected marketplaces',
          detail: 'Listed on eBay (€265) and Cardmarket (€255).',
        },
      ],
      listings: [
        {
          channel: 'eBay',
          status: 'listed',
          askingPrice: 265,
          feePct: 0.13,
          listedAt: '2026-11-12',
        },
        {
          channel: 'Cardmarket',
          status: 'listed',
          askingPrice: 255,
          feePct: 0.05,
          listedAt: '2026-11-12',
        },
      ],
    },
  ];
}
