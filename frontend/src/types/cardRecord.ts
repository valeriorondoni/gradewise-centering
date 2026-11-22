export type AssessmentMode = 'quick' | 'detailed';

export type CardStage =
  | 'imported'
  | 'estimated'
  | 'keep_raw'
  | 'submission_approved'
  | 'in_transit_to_grader'
  | 'grading_in_progress'
  | 'return_transit'
  | 'reconciled'
  | 'listed'
  | 'sold';

export type GraderId = 'PSA' | 'BGS' | 'CGC';
export type MarketplaceId = 'eBay' | 'Cardmarket' | 'CardTrader';

export interface CenteringResult {
  left_mm: number;
  right_mm: number;
  top_mm: number;
  bottom_mm: number;
  worst_pct: number;
  uncertainty_pct: number;
  max_grade: number;
  chance_for_10?: number;
  borderline?: boolean;
  reliable: boolean;
  warnings?: string[];
}

export interface WearZone {
  name: string;
  level: string;
  score?: number;
}

export interface WearResult {
  max_grade: number;
  corners_max_grade: number;
  edges_max_grade: number;
  corners?: WearZone[];
  edges?: WearZone[];
  reliable: boolean;
  warnings?: string[];
}

export interface SideResult {
  side: 'front' | 'back';
  error: string | null;
  centering: CenteringResult | null;
  centering_error: string | null;
  wear: WearResult | null;
  wear_error: string | null;
  wear_skipped?: boolean;
  measured_lr: number | null;
  measured_tb: number | null;
  images: {
    centering?: string;
    wear?: string;
    corners?: string;
  };
}

export interface DetailPhotoResult {
  key: string;
  image: string;
}

export interface AnalysisRun {
  id: string;
  time: string;
  name: string;
  mode?: AssessmentMode;
  cropped: boolean;
  ceiling: number | null;
  centering_cap: number | null;
  wear_cap: number | null;
  wear_skipped: boolean;
  reliable: boolean;
  sides: SideResult[];
  detail_photos?: DetailPhotoResult[];
}

export interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  detail: string;
  actionRequired?: boolean;
}

export interface MarketplaceListing {
  channel: MarketplaceId;
  status: 'listed' | 'sold' | 'delisted';
  askingPrice: number;
  feePct: number;
  listedAt: string;
  soldAt?: string;
}

export interface CardRecord {
  id: string;
  createdAt: string;
  // Stage 1: Identity
  name: string;
  set: string;
  number: string;
  language: string;
  variant: string;
  purchaseCost: number;
  storageLocation?: string;
  cardImageUrl?: string;

  // Stage 2: Real Python CV Estimate + Mock Market Valuation
  runId: string;
  mode: AssessmentMode;
  estimatedGradeLow: number;
  estimatedGradeHigh: number;
  centeringCap: number | null;
  wearCap: number | null;
  reliable: boolean;
  frontOverlayUrl?: string;
  backOverlayUrl?: string;
  rawValue: number;
  gradedValueLow: number;
  gradedValueHigh: number;

  // Stage 3: Decision & Grader
  stage: CardStage;
  minReturnTargetPct: number;
  selectedGrader?: GraderId;
  serviceTier?: string;
  gradingFee: number;
  shippingInsuranceFee: number;

  // Stage 4 & 5: Logistics & Tracking
  carrier?: string;
  trackingNumber?: string;
  submissionBatchId?: string;
  timeline: TimelineEvent[];

  // Stage 6: Reconcile
  officialGrade?: number;
  certNumber?: string;
  finalExtraCosts?: number;
  updatedValue?: number;

  // Stage 7: Marketplaces & Sale
  listings: MarketplaceListing[];
  soldChannel?: MarketplaceId;
  salePrice?: number;
  sellingFeePaid?: number;
  realisedProfit?: number;
}
