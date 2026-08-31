import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStore } from './store/useStore';
import { StickyNavbar } from './components/ui/StickyNavbar';
import { AnnouncementStrip } from './components/ui/AnnouncementStrip';
import { MainMap } from './components/map/MainMap';
import { LiveMonitoringView } from './views/LiveMonitoringView';
import { HistoricalView } from './views/HistoricalView';
import { ApprovalModal } from './components/evidence/ApprovalModal';
import { AuditLogModal } from './components/evidence/AuditLogModal';
import { supabaseService, isSupabaseConfigured } from './services/supabase';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 60000,
    },
  },
});

export const App: React.FC = () => {
  const { currentMode, setPendingApprovalsCount } = useStore();

  useEffect(() => {
    // Setup Supabase Realtime listeners when configured
    if (isSupabaseConfigured) {
      const unsubIncidents = supabaseService.subscribeToIncidents((newInc) => {
        console.log('Realtime Incident Detected via Supabase:', newInc);
      });

      const unsubAlerts = supabaseService.subscribeToAlerts((alert) => {
        console.log('Realtime Alert Update via Supabase:', alert);
        // Refresh pending count
        fetch('/api/v1/approvals/pending')
          .then((r) => r.json())
          .then((d) => setPendingApprovalsCount(d.total_pending || 0))
          .catch(() => {});
      });

      return () => {
        unsubIncidents();
        unsubAlerts();
      };
    }
  }, [setPendingApprovalsCount]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen w-full bg-nav-ink flex flex-col text-bone-white font-sans overflow-hidden select-none">
        <AnnouncementStrip
          variant="demo"
          message="SUPABASE BACKEND INTEGRATED — Sentinel-1 SAR detections, AIS vessel attributions, and prompt audit logs persisted to PostgreSQL with RLS."
        />

        <StickyNavbar />

        <main className="relative flex-1 w-full h-[calc(100vh-80px)] overflow-hidden">
          <MainMap />

          {currentMode === 'live' ? <LiveMonitoringView /> : <HistoricalView />}
        </main>

        {/* Supabase Approver Dispatch & Audit Modals */}
        <ApprovalModal />
        <AuditLogModal />
      </div>
    </QueryClientProvider>
  );
};

export default App;