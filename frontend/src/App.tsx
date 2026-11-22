import { useEffect, useState } from 'react';
import { BottomCtaAndFooter } from './components/BottomCtaAndFooter';
import { CardDetailWorkspace } from './components/CardDetailWorkspace';
import { GradingServiceEntry } from './components/GradingServiceEntry';
import { Hero } from './components/Hero';
import { HowItWorks } from './components/HowItWorks';
import { InventoryDashboard } from './components/InventoryDashboard';
import { AppView, Navbar } from './components/Navbar';
import { PricingSection } from './components/PricingSection';
import { SampleReportSection } from './components/SampleReportSection';
import { TrustStrip } from './components/TrustStrip';
import { useCardStore } from './store/useCardStore';

function parseLocation(pathname: string): { view: AppView; cardId: string | null } {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/grade') {
    return { view: 'grading', cardId: null };
  }
  if (clean === '/inventory') {
    return { view: 'inventory', cardId: null };
  }
  if (clean.startsWith('/inventory/')) {
    const cardId = decodeURIComponent(clean.slice('/inventory/'.length));
    return { view: 'inventory', cardId: cardId || null };
  }
  return { view: 'landing', cardId: null };
}

export default function App() {
  const initial = parseLocation(window.location.pathname);
  const [view, setView] = useState<AppView>(initial.view);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(initial.cardId);

  const {
    records,
    addCardFromAnalysis,
    approveSubmission,
    keepRaw,
    markShipped,
    advanceTracking,
    reconcileCard,
    publishListings,
    markSold,
    seedDemoCards,
    deleteCard,
  } = useCardStore();

  const navigate = (path: string, nextView: AppView, cardId: string | null = null) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setView(nextView);
    setSelectedCardId(cardId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const onPopState = () => {
      const parsed = parseLocation(window.location.pathname);
      setView(parsed.view);
      setSelectedCardId(parsed.cardId);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const handleStartGrading = () => navigate('/grade', 'grading');
  const handleGoHome = () => navigate('/', 'landing');
  const handleOpenInventory = () => navigate('/inventory', 'inventory');
  const handleOpenCard = (id: string) =>
    navigate(`/inventory/${encodeURIComponent(id)}`, 'inventory', id);

  const selectedCard = selectedCardId
    ? records.find((c) => c.id === selectedCardId) || null
    : null;

  return (
    <div className="min-h-screen bg-white text-navy-900">
      <Navbar
        view={view}
        cardCount={records.length}
        onStartGrading={handleStartGrading}
        onGoHome={handleGoHome}
        onOpenInventory={handleOpenInventory}
      />

      {view === 'grading' ? (
        <GradingServiceEntry
          onBackHome={handleGoHome}
          onSaveToInventory={(run, details) => {
            const created = addCardFromAnalysis(run, details);
            handleOpenCard(created.id);
          }}
        />
      ) : view === 'inventory' ? (
        selectedCard ? (
          <CardDetailWorkspace
            card={selectedCard}
            onBack={handleOpenInventory}
            onApproveSubmission={approveSubmission}
            onKeepRaw={keepRaw}
            onMarkShipped={markShipped}
            onAdvanceTracking={advanceTracking}
            onReconcile={reconcileCard}
            onPublishListings={publishListings}
            onMarkSold={markSold}
            onDelete={deleteCard}
          />
        ) : (
          <InventoryDashboard
            records={records}
            onSelectCard={handleOpenCard}
            onStartGrading={handleStartGrading}
            onSeedDemo={seedDemoCards}
          />
        )
      ) : (
        <main>
          <Hero onStartGrading={handleStartGrading} />
          <TrustStrip />
          <HowItWorks />
          <SampleReportSection onStartGrading={handleStartGrading} />
          <PricingSection onStartGrading={handleStartGrading} />
          <BottomCtaAndFooter onStartGrading={handleStartGrading} />
        </main>
      )}
    </div>
  );
}
