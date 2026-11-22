import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Image as ImageIcon,
  Info,
  Layers,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Upload,
  X,
  Zap,
} from 'lucide-react';

import { AnalysisRun, AssessmentMode } from '../types/cardRecord';
import { suggestCatalogMatch } from '../data/mockMarket';
import { LiveCatalogCard, searchPokemonCards } from '../data/pokemonTcgApi';

interface GradingServiceEntryProps {
  onBackHome: () => void;
  onSaveToInventory: (
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
  ) => void;
}

type PhotoKey =
  | 'front'
  | 'back'
  | 'corner_top_left'
  | 'corner_top_right'
  | 'corner_bottom_left'
  | 'corner_bottom_right'
  | 'edge_top'
  | 'edge_bottom'
  | 'edge_left'
  | 'edge_right'
  | 'surface_front_angled'
  | 'surface_back_angled';

interface PhotoGroup {
  title: string;
  items: { key: PhotoKey; label: string }[];
}

const PHOTO_GROUPS: PhotoGroup[] = [
  {
    title: 'Overview',
    items: [
      { key: 'front', label: 'Full front' },
      { key: 'back', label: 'Full back' },
    ],
  },
  {
    title: 'Corners',
    items: [
      { key: 'corner_top_left', label: 'Top-left corner' },
      { key: 'corner_top_right', label: 'Top-right corner' },
      { key: 'corner_bottom_left', label: 'Bottom-left corner' },
      { key: 'corner_bottom_right', label: 'Bottom-right corner' },
    ],
  },
  {
    title: 'Edges',
    items: [
      { key: 'edge_top', label: 'Top edge' },
      { key: 'edge_bottom', label: 'Bottom edge' },
      { key: 'edge_left', label: 'Left edge' },
      { key: 'edge_right', label: 'Right edge' },
    ],
  },
  {
    title: 'Surface',
    items: [
      { key: 'surface_front_angled', label: 'Front surface - angled' },
      { key: 'surface_back_angled', label: 'Back surface - angled' },
    ],
  },
];

const QUICK_KEYS: PhotoKey[] = ['front', 'back'];
const DETAILED_KEYS: PhotoKey[] = PHOTO_GROUPS.flatMap((g) => g.items.map((i) => i.key));

const LABEL_BY_KEY: Record<string, string> = Object.fromEntries(
  PHOTO_GROUPS.flatMap((g) => g.items.map((i) => [i.key, i.label]))
);

interface UploadedPhoto {
  file: File;
  previewUrl: string;
}

interface LargePhotoSlotProps {
  label: string;
  hint: string;
  uploaded?: UploadedPhoto;
  onSelect: (file: File) => void;
  onClear: () => void;
}

function LargePhotoSlot({ label, hint, uploaded, onSelect, onClear }: LargePhotoSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (files && files[0]) onSelect(files[0]);
  };

  return (
    <div className="flex flex-col">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-navy-900">
          {label} <span className="text-rose-500">*</span>
        </span>
        {uploaded && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-rose-600"
          >
            <X className="h-3.5 w-3.5" />
            Remove
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {uploaded ? (
        <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-slate-900/5 p-3">
          <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-slate-900">
            <img
              src={uploaded.previewUrl}
              alt={`${label} preview`}
              className="h-full w-full object-contain"
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs text-slate-600">
            <span className="truncate font-medium">{uploaded.file.name}</span>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="shrink-0 font-semibold text-emerald-700 hover:text-emerald-800"
            >
              Replace
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={`flex aspect-[4/3] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition ${
            dragging
              ? 'border-emerald-500 bg-emerald-50/70'
              : 'border-slate-300 bg-slate-50/70 hover:border-emerald-400 hover:bg-emerald-50/30'
          }`}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm">
            <Upload className="h-5 w-5" />
          </div>
          <p className="mt-3 text-sm font-semibold text-navy-900">
            Click to upload or drag &amp; drop
          </p>
          <p className="mt-1 max-w-[220px] text-xs text-slate-500">{hint}</p>
        </button>
      )}
    </div>
  );
}

interface CompactPhotoSlotProps {
  label: string;
  uploaded?: UploadedPhoto;
  onSelect: (file: File) => void;
  onClear: () => void;
}

function CompactPhotoSlot({ label, uploaded, onSelect, onClear }: CompactPhotoSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (files && files[0]) onSelect(files[0]);
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {uploaded ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50/50 p-2.5">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-emerald-200 bg-slate-900"
            title="Click to replace photo"
          >
            <img
              src={uploaded.previewUrl}
              alt={label}
              className="h-full w-full object-cover"
            />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-navy-900">{label}</p>
            <p className="truncate text-[11px] text-emerald-700">{uploaded.file.name}</p>
          </div>
          <button
            type="button"
            onClick={onClear}
            aria-label={`Remove ${label}`}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-rose-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={`flex w-full items-center gap-3 rounded-xl border border-dashed px-3.5 py-3 text-left transition ${
            dragging
              ? 'border-emerald-500 bg-emerald-50'
              : 'border-slate-300 bg-white hover:border-emerald-400 hover:bg-emerald-50/30'
          }`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <Camera className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-bold text-navy-900">{label}</span>
            <span className="block text-[11px] text-slate-500">Upload photo</span>
          </span>
        </button>
      )}
    </div>
  );
}

function ratioPair(share: number | null): string {
  if (share === null || Number.isNaN(share)) return '—';
  const a = Math.round(share);
  const b = 100 - a;
  return `${a}/${b}`;
}

export function GradingServiceEntry({
  onBackHome,
  onSaveToInventory,
}: GradingServiceEntryProps) {
  const [mode, setMode] = useState<AssessmentMode>('quick');
  const [cardName, setCardName] = useState('');
  const [setNumber, setSetNumber] = useState('');
  const [setName, setSetName] = useState('');
  const [language, setLanguage] = useState('English');
  const [variant, setVariant] = useState('Holo');
  const [purchaseCost, setPurchaseCost] = useState<number>(80);
  const [cropped, setCropped] = useState(false);

  const [apiQuery, setApiQuery] = useState('');
  const [apiResults, setApiResults] = useState<LiveCatalogCard[]>([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [selectedLiveCard, setSelectedLiveCard] = useState<LiveCatalogCard | null>(null);

  const [photos, setPhotos] = useState<Partial<Record<PhotoKey, UploadedPhoto>>>({});
  const [extraPhotos, setExtraPhotos] = useState<UploadedPhoto[]>([]);
  const extraInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisRun | null>(null);
  const [activeImageTab, setActiveImageTab] = useState<
    Record<string, 'centering' | 'wear' | 'corners'>
  >({
    front: 'centering',
    back: 'centering',
  });

  const photosRef = useRef(photos);
  const extraRef = useRef(extraPhotos);
  photosRef.current = photos;
  extraRef.current = extraPhotos;

  useEffect(() => {
    return () => {
      Object.values(photosRef.current).forEach((p) => {
        if (p) URL.revokeObjectURL(p.previewUrl);
      });
      extraRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  }, []);

  const requiredKeys = mode === 'quick' ? QUICK_KEYS : DETAILED_KEYS;
  const uploadedCount = requiredKeys.filter((k) => Boolean(photos[k])).length;
  const allUploaded = uploadedCount === requiredKeys.length;

  const handleSelectPhoto = (key: PhotoKey, file: File) => {
    setPhotos((prev) => {
      if (prev[key]) URL.revokeObjectURL(prev[key]!.previewUrl);
      return {
        ...prev,
        [key]: { file, previewUrl: URL.createObjectURL(file) },
      };
    });
    setErrorMsg(null);
  };

  const handleClearPhoto = (key: PhotoKey) => {
    setPhotos((prev) => {
      if (prev[key]) URL.revokeObjectURL(prev[key]!.previewUrl);
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleAddExtraPhotos = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const added: UploadedPhoto[] = Array.from(files).map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setExtraPhotos((prev) => [...prev, ...added]);
  };

  const handleRemoveExtraPhoto = (index: number) => {
    setExtraPhotos((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSearchCatalog = async () => {
    if (!apiQuery.trim()) return;
    setApiLoading(true);
    setApiError(null);
    try {
      const results = await searchPokemonCards(apiQuery);
      setApiResults(results);
      if (results.length === 0) {
        setApiError('No matching Pokémon cards found.');
      }
    } catch {
      setApiError('Could not reach pokemontcg.io right now. You can still enter details manually.');
    } finally {
      setApiLoading(false);
    }
  };

  const handleSelectLiveCard = (card: LiveCatalogCard) => {
    setSelectedLiveCard(card);
    setCardName(card.name);
    setSetName(card.set);
    setSetNumber(card.number);
    setPurchaseCost(card.rawMarketPriceEur);
    setApiResults([]);
  };

  const handleReset = () => {
    Object.values(photos).forEach((p) => {
      if (p) URL.revokeObjectURL(p.previewUrl);
    });
    extraPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPhotos({});
    setExtraPhotos([]);
    setCardName('');
    setSetName('');
    setSetNumber('');
    setSelectedLiveCard(null);
    setApiQuery('');
    setApiResults([]);
    setCropped(false);
    setResult(null);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allUploaded) {
      setErrorMsg(
        `Please upload all ${requiredKeys.length} required views (${uploadedCount}/${requiredKeys.length} uploaded).`
      );
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append('mode', mode);
      requiredKeys.forEach((key) => {
        const item = photos[key];
        if (item) {
          formData.append(key, item.file);
        }
      });
      if (mode === 'detailed') {
        extraPhotos.forEach((item) => {
          formData.append('extra_photos', item.file);
        });
      }

      const fullName = [cardName.trim(), setNumber.trim()].filter(Boolean).join(' — ');
      if (fullName) {
        formData.append('name', fullName);
      }
      if (cropped) {
        formData.append('cropped', 'true');
      }

      const response = await fetch('/api/analyse', {
        method: 'POST',
        body: formData,
      });

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(
          'Could not reach the Python analysis engine. Make sure webapp.py is running on port 5000.'
        );
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed. Please try again.');
      }

      setResult(data as AnalysisRun);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to connect to the analysis server. Make sure webapp.py is running.';
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-slate-50 py-10 sm:py-12">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-navy-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to landing page
          </button>

          {result && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-navy-900 shadow-sm transition hover:bg-slate-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Analyse another card
            </button>
          )}
        </div>

        {/* Upload Form */}
        {!result && (
          <form
            onSubmit={handleSubmit}
            className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
          >
            <div className="border-b border-slate-100 pb-6">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                Card Assessment
              </span>
              <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-navy-900 sm:text-3xl">
                Start with one card
              </h1>
              <p className="mt-1.5 text-sm text-slate-600">
                Choose between a quick 2-photo centering &amp; whitening check or a full 12-photo
                detailed submission.
              </p>

              {/* Modality Selector */}
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('quick');
                    setErrorMsg(null);
                  }}
                  className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${
                    mode === 'quick'
                      ? 'border-emerald-500 bg-mint-50/70 ring-1 ring-emerald-500'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      mode === 'quick'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Zap className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-navy-900">Quick 2-Photo Check</span>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                        Instant engine
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      Upload Full front &amp; Full back for immediate centering geometry and edge
                      whitening analysis.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode('detailed');
                    setErrorMsg(null);
                  }}
                  className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${
                    mode === 'detailed'
                      ? 'border-emerald-500 bg-mint-50/70 ring-1 ring-emerald-500'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      mode === 'detailed'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Layers className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-navy-900">
                        Detailed 12-Photo Check
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                        Full checklist
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      Includes 4 corners, 4 edges &amp; 2 angled surface views alongside front and
                      back analysis.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Live Pokémon TCG Database Lookup */}
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-bold text-navy-900">
                  Lookup card in live Pokémon TCG database (optional)
                </label>
                <span className="text-[11px] text-slate-500">
                  Powered by api.pokemontcg.io &bull; real artwork &amp; Cardmarket prices
                </span>
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={apiQuery}
                  onChange={(e) => setApiQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearchCatalog();
                    }
                  }}
                  placeholder="Search e.g. Charizard, Umbreon VMAX, Pikachu..."
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-navy-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSearchCatalog}
                  disabled={apiLoading || !apiQuery.trim()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-navy-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-navy-800 disabled:bg-slate-300"
                >
                  {apiLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Search className="h-3.5 w-3.5" />
                  )}
                  Search
                </button>
              </div>

              {apiError && <p className="mt-2 text-xs text-amber-700">{apiError}</p>}

              {selectedLiveCard && (
                <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-200 bg-white p-2.5">
                  <div className="flex items-center gap-3">
                    {selectedLiveCard.imageUrl && (
                      <img
                        src={selectedLiveCard.imageUrl}
                        alt={selectedLiveCard.name}
                        className="h-12 w-9 rounded object-cover"
                      />
                    )}
                    <div className="text-xs">
                      <p className="font-bold text-navy-900">
                        {selectedLiveCard.name} ({selectedLiveCard.set} #{selectedLiveCard.number})
                      </p>
                      <p className="text-emerald-700">
                        Live raw market price: €{selectedLiveCard.rawMarketPriceEur}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedLiveCard(null)}
                    className="text-xs font-medium text-slate-400 hover:text-rose-600"
                  >
                    Clear
                  </button>
                </div>
              )}

              {apiResults.length > 0 && (
                <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
                  {apiResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectLiveCard(c)}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2 text-left transition hover:border-emerald-400 hover:bg-emerald-50/30"
                    >
                      {c.imageUrl && (
                        <img
                          src={c.imageUrl}
                          alt={c.name}
                          className="h-14 w-10 shrink-0 rounded object-cover"
                        />
                      )}
                      <div className="min-w-0 flex-1 text-xs">
                        <p className="truncate font-bold text-navy-900">{c.name}</p>
                        <p className="truncate text-slate-500">
                          {c.set} &bull; #{c.number}
                        </p>
                        <p className="font-mono font-semibold text-emerald-700">
                          Raw ~€{c.rawMarketPriceEur}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Card Details */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="card-name" className="block text-xs font-semibold text-navy-900">
                  Card name <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  id="card-name"
                  type="text"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  placeholder="e.g. Charizard"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-navy-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label htmlFor="set-number" className="block text-xs font-semibold text-navy-900">
                  Set / number <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  id="set-number"
                  type="text"
                  value={setNumber}
                  onChange={(e) => setSetNumber(e.target.value)}
                  placeholder="e.g. Base Set 4/102"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-navy-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              {mode === 'detailed' && (
                <>
                  <div>
                    <label
                      htmlFor="card-lang"
                      className="block text-xs font-semibold text-navy-900"
                    >
                      Language
                    </label>
                    <select
                      id="card-lang"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-navy-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    >
                      <option>English</option>
                      <option>Japanese</option>
                      <option>French</option>
                      <option>German</option>
                      <option>Spanish</option>
                      <option>Italian</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="card-variant"
                      className="block text-xs font-semibold text-navy-900"
                    >
                      Variant
                    </label>
                    <select
                      id="card-variant"
                      value={variant}
                      onChange={(e) => setVariant(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-navy-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    >
                      <option>Holo</option>
                      <option>Reverse Holo</option>
                      <option>Full Art / Alt Art</option>
                      <option>Non-Holo</option>
                      <option>1st Edition</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* Photo Tips + Cropped Scan Toggle */}
            <div className="mt-6 grid gap-3 sm:grid-cols-12">
              <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-600 sm:col-span-7">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                <span>
                  Place the bare card (no sleeve/slab) on a <strong>plain dark surface</strong>{' '}
                  with all 4 edges visible so the centering detector can measure the borders.
                </span>
              </div>

              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs transition hover:bg-slate-100/70 sm:col-span-5">
                <input
                  type="checkbox"
                  checked={cropped}
                  onChange={(e) => setCropped(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>
                  <strong className="block text-navy-900">Flatbed scan (already cropped)</strong>
                  <span className="text-slate-500">
                    Tick only if front/back are cropped tightly to the card.
                  </span>
                </span>
              </label>
            </div>

            {/* Upload Area: Quick 2-Photo vs Detailed 12-Photo */}
            {mode === 'quick' ? (
              <div className="mt-6 border-t border-slate-100 pt-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-extrabold text-navy-900">Front &amp; back photos</h2>
                  <span
                    className={`rounded-full border px-3 py-1 font-mono text-xs font-semibold tabular-nums ${
                      allUploaded
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    {uploadedCount} / 2 photos uploaded
                  </span>
                </div>
                <div className="grid gap-6 sm:grid-cols-2">
                  <LargePhotoSlot
                    label="Full front"
                    hint="Bare card on a dark background, sharp focus"
                    uploaded={photos.front}
                    onSelect={(file) => handleSelectPhoto('front', file)}
                    onClear={() => handleClearPhoto('front')}
                  />
                  <LargePhotoSlot
                    label="Full back"
                    hint="Full card back on a dark background"
                    uploaded={photos.back}
                    onSelect={(file) => handleSelectPhoto('back', file)}
                    onClear={() => handleClearPhoto('back')}
                  />
                </div>
              </div>
            ) : (
              <div className="mt-6 border-t border-slate-100 pt-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-extrabold text-navy-900">Required photo checklist</h2>
                  <span
                    className={`rounded-full border px-3 py-1 font-mono text-xs font-semibold tabular-nums ${
                      allUploaded
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    {uploadedCount} / 12 photos uploaded
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-2 rounded-xl bg-mint-100/80 px-3.5 py-2.5 text-xs font-medium text-emerald-900">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
                  <span>12 required views &mdash; all must be uploaded to assess your card.</span>
                </div>

                <div className="mt-5 space-y-5">
                  {PHOTO_GROUPS.map((group) => (
                    <div key={group.title}>
                      <p className="mb-2 text-xs font-bold tracking-wide text-emerald-700">
                        {group.title}
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {group.items.map((item) => (
                          <CompactPhotoSlot
                            key={item.key}
                            label={item.label}
                            uploaded={photos[item.key]}
                            onSelect={(file) => handleSelectPhoto(item.key, file)}
                            onClear={() => handleClearPhoto(item.key)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[11px] italic text-slate-500">
                  <span>Sharp close-ups. Natural light. Avoid glare.</span>
                  <span>Include any visible scratches, whitening or damage.</span>
                </div>

                {/* Optional Extra Detail Photos */}
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <input
                    ref={extraInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      handleAddExtraPhotos(e.target.files);
                      e.target.value = '';
                    }}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => extraInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add more detail photos
                    </button>
                    <span className="text-xs text-slate-500">
                      Optional &mdash; extra photos for anything else you&apos;d like us to check.
                    </span>
                  </div>

                  {extraPhotos.length > 0 && (
                    <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
                      {extraPhotos.map((item, idx) => (
                        <div
                          key={`${item.file.name}-${idx}`}
                          className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-2"
                        >
                          <img
                            src={item.previewUrl}
                            alt={item.file.name}
                            className="h-10 w-10 shrink-0 rounded-md object-cover"
                          />
                          <span className="min-w-0 flex-1 truncate text-xs text-slate-700">
                            {item.file.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveExtraPhoto(idx)}
                            className="rounded p-1 text-slate-400 hover:text-rose-600"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-6">
              <p className="text-xs text-slate-500">
                {allUploaded
                  ? `All ${requiredKeys.length} required views uploaded. Ready to analyse.`
                  : `${requiredKeys.length - uploadedCount} more required photo${requiredKeys.length - uploadedCount === 1 ? '' : 's'} needed before analysis.`}
              </p>
              <button
                type="submit"
                disabled={loading || !allUploaded}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analysing card...
                  </>
                ) : (
                  'Analyse card'
                )}
              </button>
            </div>
          </form>
        )}

        {/* Analysis Results */}
        {result && (
          <div className="mt-6 space-y-6">
            {/* Summary Banner */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold tracking-wider text-emerald-700 uppercase">
                    {result.mode === 'detailed' ? 'Detailed 12-photo' : 'Quick 2-photo'} assessment
                    &bull; Run {result.id}
                  </p>
                  <h1 className="mt-1 text-2xl font-extrabold text-navy-900">
                    {result.name || 'Card Assessment Report'}
                  </h1>
                </div>

                {result.ceiling !== null ? (
                  <div className="flex items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-5 py-3">
                    <div>
                      <p className="text-xs font-medium text-emerald-800">Max PSA Ceiling</p>
                      <p className="font-mono text-3xl font-extrabold text-navy-900 tabular-nums">
                        PSA {result.ceiling}
                      </p>
                    </div>
                    <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Could not determine overall ceiling
                  </div>
                )}
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-500">Centering Cap</p>
                  <p className="mt-1 font-mono text-xl font-bold text-navy-900 tabular-nums">
                    {result.centering_cap !== null ? `PSA ${result.centering_cap}` : '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-500">Wear / Whitening Cap</p>
                  <p className="mt-1 font-mono text-xl font-bold text-navy-900 tabular-nums">
                    {result.wear_skipped
                      ? 'Skipped (light bg)'
                      : result.wear_cap !== null
                        ? `PSA ${result.wear_cap}`
                        : '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-500">Measurement Confidence</p>
                  <p
                    className={`mt-1 text-base font-bold ${
                      result.reliable ? 'text-emerald-700' : 'text-amber-600'
                    }`}
                  >
                    {result.reliable ? 'High (reliable)' : 'Check warnings below'}
                  </p>
                </div>
              </div>

              {/* Save to Centralised Card Record CTA */}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-mint-50 p-4">
                <div>
                  <p className="text-sm font-bold text-navy-900">
                    Continue to Stage 3–7: ROI Decision, Submission &amp; Resale
                  </p>
                  <p className="text-xs text-slate-600">
                    Save this assessment as a continuous Card Record in My Cards (Purchase cost: €
                    {purchaseCost}).
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-navy-900">
                    Cost €
                    <input
                      type="number"
                      min={0}
                      value={purchaseCost}
                      onChange={(e) => setPurchaseCost(Number(e.target.value))}
                      className="w-20 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const suggestion = suggestCatalogMatch(cardName || result.name);
                      onSaveToInventory(result, {
                        name: cardName.trim() || suggestion.name,
                        set: setName.trim() || suggestion.set,
                        number: setNumber.trim() || suggestion.number,
                        language,
                        variant,
                        purchaseCost,
                        cardImageUrl: selectedLiveCard?.imageUrl,
                        liveRawPriceEur: selectedLiveCard?.rawMarketPriceEur,
                      });
                    }}
                    className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                  >
                    Save to My Cards &amp; Continue &rarr;
                  </button>
                </div>
              </div>
            </div>

            {/* Front & Back Side Details */}
            <div className="grid gap-6 lg:grid-cols-2">
              {result.sides.map((side) => {
                const tab = activeImageTab[side.side] || 'centering';
                const imgName = side.images[tab];
                const warnings = [
                  ...(side.centering?.warnings || []),
                  ...(side.wear?.warnings || []),
                ];

                return (
                  <div
                    key={side.side}
                    className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <h2 className="text-lg font-bold capitalize text-navy-900">
                        {side.side} side
                      </h2>
                      {side.centering && (
                        <span className="rounded-full bg-slate-100 px-3 py-1 font-mono text-xs font-semibold text-navy-900">
                          Centering max PSA {side.centering.max_grade}
                        </span>
                      )}
                    </div>

                    {side.error ? (
                      <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                        <span>{side.error}</span>
                      </div>
                    ) : (
                      <>
                        {/* Annotated Image Viewer */}
                        <div className="mt-4">
                          <div className="mb-2 flex gap-1.5">
                            {(['centering', 'wear', 'corners'] as const).map((key) => {
                              const available = Boolean(side.images[key]);
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  disabled={!available}
                                  onClick={() =>
                                    setActiveImageTab((prev) => ({ ...prev, [side.side]: key }))
                                  }
                                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
                                    tab === key
                                      ? 'bg-navy-900 text-white'
                                      : available
                                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        : 'cursor-not-allowed bg-slate-50 text-slate-300'
                                  }`}
                                >
                                  {key === 'corners' ? 'Corner zoom' : `${key} overlay`}
                                </button>
                              );
                            })}
                          </div>

                          <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
                            {imgName ? (
                              <img
                                src={`/tests/${result.id}/${imgName}`}
                                alt={`${side.side} ${tab}`}
                                className="h-full w-full object-contain"
                              />
                            ) : (
                              <div className="flex flex-col items-center text-slate-400">
                                <ImageIcon className="h-8 w-8" />
                                <span className="mt-1 text-xs">Image unavailable</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Centering Metrics */}
                        <div className="mt-5">
                          <h3 className="text-xs font-bold tracking-wider text-slate-400 uppercase">
                            Centering Geometry
                          </h3>
                          {side.centering_error ? (
                            <p className="mt-2 text-xs text-rose-600">{side.centering_error}</p>
                          ) : side.centering ? (
                            <div className="mt-2 grid grid-cols-3 gap-2.5 text-center">
                              <div className="rounded-lg bg-slate-50 p-2.5">
                                <p className="text-[11px] text-slate-500">L / R</p>
                                <p className="font-mono text-sm font-bold text-navy-900 tabular-nums">
                                  {ratioPair(side.measured_lr)}
                                </p>
                              </div>
                              <div className="rounded-lg bg-slate-50 p-2.5">
                                <p className="text-[11px] text-slate-500">T / B</p>
                                <p className="font-mono text-sm font-bold text-navy-900 tabular-nums">
                                  {ratioPair(side.measured_tb)}
                                </p>
                              </div>
                              <div className="rounded-lg bg-slate-50 p-2.5">
                                <p className="text-[11px] text-slate-500">Worst</p>
                                <p className="font-mono text-sm font-bold text-navy-900 tabular-nums">
                                  {side.centering.worst_pct.toFixed(1)}%
                                </p>
                              </div>
                            </div>
                          ) : null}
                        </div>

                        {/* Wear Metrics */}
                        <div className="mt-5">
                          <h3 className="text-xs font-bold tracking-wider text-slate-400 uppercase">
                            Corners &amp; Edges Whitening
                          </h3>
                          {side.wear_error ? (
                            <p className="mt-2 text-xs text-rose-600">{side.wear_error}</p>
                          ) : side.wear_skipped ? (
                            <p className="mt-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">
                              Whitening check skipped because the background is too light. Use a
                              dark surface to measure corner/edge wear.
                            </p>
                          ) : side.wear ? (
                            <div className="mt-2 grid grid-cols-2 gap-2.5">
                              <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                                <span className="text-slate-500">Corners max: </span>
                                <span className="font-mono font-bold text-navy-900">
                                  PSA {side.wear.corners_max_grade}
                                </span>
                              </div>
                              <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                                <span className="text-slate-500">Edges max: </span>
                                <span className="font-mono font-bold text-navy-900">
                                  PSA {side.wear.edges_max_grade}
                                </span>
                              </div>
                            </div>
                          ) : null}
                        </div>

                        {/* Warnings */}
                        {warnings.length > 0 && (
                          <div className="mt-4 space-y-1.5 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
                            {Array.from(new Set(warnings)).map((w) => (
                              <div key={w} className="flex items-start gap-2">
                                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                                <span>{w}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Uploaded Close-up Photos */}
            {result.detail_photos && result.detail_photos.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-base font-bold text-navy-900">
                  Submitted close-up &amp; surface photos ({result.detail_photos.length})
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Saved with this run. Note: automated centering &amp; whitening currently runs on
                  the Full front and Full back images.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {result.detail_photos.map((photo) => (
                    <div
                      key={photo.image}
                      className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                    >
                      <div className="aspect-square bg-slate-900">
                        <img
                          src={`/tests/${result.id}/${photo.image}`}
                          alt={LABEL_BY_KEY[photo.key] || photo.key}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <p className="truncate px-2 py-1.5 text-[11px] font-medium text-slate-700">
                        {LABEL_BY_KEY[photo.key] || photo.key.replace('_', ' ')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
