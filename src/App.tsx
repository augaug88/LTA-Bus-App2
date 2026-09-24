/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bus, RefreshCw, AlertCircle, CheckCircle2, MapPin, Activity, Clock } from 'lucide-react';

interface BusServiceItem {
  ServiceNo: string;
  nextBuses: number[];
  minutes?: number[];
}

interface HealthStatus {
  keyConfigured: boolean;
  ltaAnswered: boolean;
  upstreamStatus?: number;
  upstreamStatusCode?: number;
  error?: string;
  message?: string;
}

const PRESET_STOPS = [
  { code: '04121', name: 'Old Hill St Police Stn / Clarke Quay' },
  { code: '01012', name: 'Hotel Grand Pacific / Victoria St' },
  { code: '03019', name: 'Suntec City / Temasek Blvd' },
  { code: '80059', name: 'Opp Aljunied Stn' },
  { code: '10111', name: 'HarbourFront Stn / Telok Blangah' },
];

export default function App() {
  const [busStopCode, setBusStopCode] = useState<string>('04121');
  const [inputStopCode, setInputStopCode] = useState<string>('04121');
  const [services, setServices] = useState<BusServiceItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(20);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [showHealthModal, setShowHealthModal] = useState<boolean>(false);

  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Formatted date for licensing attribution
  const accessedDate = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const fetchBusArrivals = useCallback(async (stopCode: string, isManual = false) => {
    if (isManual) {
      setRefreshing(true);
    }
    setError(null);

    try {
      const response = await fetch(`/api/bus?BusStopCode=${encodeURIComponent(stopCode)}`, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        let errMessage = `Error ${response.status}: Failed to fetch bus arrivals`;
        try {
          const errData = await response.json();
          if (errData.error) {
            errMessage = errData.error;
          }
        } catch {
          // ignore parsing error
        }
        setError(errMessage);
        setServices([]);
        return;
      }

      const data = await response.json();
      const list: BusServiceItem[] = Array.isArray(data)
        ? data
        : Array.isArray((data as { services?: BusServiceItem[] }).services)
        ? (data as { services: BusServiceItem[] }).services
        : [];

      // Sort services logically (numerical where possible, then alphabetical)
      list.sort((a, b) => {
        const numA = parseInt(a.ServiceNo, 10);
        const numB = parseInt(b.ServiceNo, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB || a.ServiceNo.localeCompare(b.ServiceNo);
        }
        return a.ServiceNo.localeCompare(b.ServiceNo);
      });

      setServices(list);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to connect to bus arrival service');
      setServices([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setSecondsRemaining(20);
    }
  }, []);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealth(data);
    } catch (err) {
      setHealth({
        keyConfigured: false,
        ltaAnswered: false,
        error: err instanceof Error ? err.message : 'Health check failed',
      });
    }
  }, []);

  // Initial fetch and health check
  useEffect(() => {
    fetchBusArrivals(busStopCode);
    fetchHealth();
  }, [busStopCode, fetchBusArrivals, fetchHealth]);

  // 20-second refresh countdown interval
  useEffect(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }

    countdownTimerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          fetchBusArrivals(busStopCode);
          return 20;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, [busStopCode, fetchBusArrivals]);

  const handleStopSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = inputStopCode.trim();
    if (cleanCode && cleanCode !== busStopCode) {
      setLoading(true);
      setBusStopCode(cleanCode);
    }
  };

  const handleSelectPreset = (code: string) => {
    setInputStopCode(code);
    if (code !== busStopCode) {
      setLoading(true);
      setBusStopCode(code);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-900/40">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                Live Bus Arrival
                <span className="text-xs px-2 py-0.5 rounded font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  SG DataMall
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Singapore Bus Arrival Timings • Refreshes every 20s
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                fetchHealth();
                setShowHealthModal(true);
              }}
              title="Check API Health Status"
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              API Health
            </button>
            <button
              onClick={() => fetchBusArrivals(busStopCode, true)}
              disabled={refreshing}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition-colors shadow shadow-emerald-900/40 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 flex flex-col gap-6">
        {/* Bus Stop Selector & Quick Pick */}
        <section className="bg-slate-800/60 border border-slate-700/70 rounded-2xl p-5 shadow-sm">
          <form onSubmit={handleStopSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <MapPin className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={inputStopCode}
                onChange={(e) => setInputStopCode(e.target.value)}
                placeholder="Enter 5-digit bus stop code (e.g. 04121)"
                maxLength={6}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-11 pr-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm font-mono tracking-wider"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold transition-colors shrink-0"
            >
              View Arrivals
            </button>
          </form>

          {/* Quick Shortcuts */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400">Popular stops:</span>
            {PRESET_STOPS.map((preset) => (
              <button
                key={preset.code}
                onClick={() => handleSelectPreset(preset.code)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                  busStopCode === preset.code
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-semibold'
                    : 'bg-slate-900/60 text-slate-400 border-slate-700/60 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <span className="font-mono">{preset.code}</span> • {preset.name.split('/')[0].trim()}
              </button>
            ))}
          </div>
        </section>

        {/* Live Status Bar */}
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              Bus Stop Code: <strong className="font-mono text-emerald-400">{busStopCode}</strong>
            </span>
          </div>

          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <span className="text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/50">
              Refresh in <strong className="text-slate-200">{secondsRemaining}s</strong>
            </span>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="bg-red-950/40 border border-red-800/70 rounded-2xl p-4 text-red-200 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-300">Arrival Timings Unavailable</p>
              <p className="text-xs text-red-300/80 mt-1">{error}</p>
              {error.includes('LTA_ACCOUNT_KEY') && (
                <p className="text-xs text-amber-300/90 mt-2 bg-amber-950/40 p-2.5 rounded-lg border border-amber-800/40">
                  Tip: Configure <code className="bg-black/40 px-1.5 py-0.5 rounded">LTA_ACCOUNT_KEY</code> in Vercel project environment variables or AI Studio Secrets, then reload.
                </p>
              )}
            </div>
            <button
              onClick={() => fetchBusArrivals(busStopCode, true)}
              className="text-xs px-2.5 py-1 bg-red-900/60 hover:bg-red-800 rounded-lg text-red-100 transition-colors shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* Bus Arrival Panel */}
        <section className="bg-slate-800/40 border border-slate-700/70 rounded-2xl overflow-hidden shadow-lg">
          <div className="border-b border-slate-700/60 px-5 py-3.5 bg-slate-800/80 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Bus className="w-4 h-4 text-emerald-400" />
              Live Bus Services
            </h2>
            <span className="text-xs text-slate-400">
              {services.length} {services.length === 1 ? 'service' : 'services'} available
            </span>
          </div>

          {loading ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
              <p className="text-sm font-medium">Fetching real-time arrivals from LTA DataMall...</p>
            </div>
          ) : services.length === 0 && !error ? (
            <div className="py-16 text-center px-4">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <Bus className="w-6 h-6" />
              </div>
              <p className="text-base font-semibold text-slate-300">No buses running</p>
              <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
                There are currently no active bus services arriving at stop {busStopCode}. Check again during operational service hours.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700/50">
              {services.map((service) => {
                const nextBuses = service.nextBuses || service.minutes || [];
                const hasBuses = nextBuses.length > 0;

                return (
                  <div
                    key={service.ServiceNo}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-800/30 transition-colors"
                  >
                    {/* Service Number Badge */}
                    <div className="flex items-center gap-3 min-w-[120px]">
                      <div className="h-11 px-3.5 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center shadow-inner">
                        <span className="font-mono text-xl font-bold tracking-tight text-white">
                          {service.ServiceNo}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 font-medium">Service</span>
                    </div>

                    {/* Arrivals display */}
                    <div className="flex-1 flex items-center justify-start sm:justify-end gap-3 sm:gap-6">
                      {!hasBuses ? (
                        <p className="text-sm text-slate-400 italic">
                          No buses currently running for this service.
                        </p>
                      ) : (
                        <div className="flex items-center gap-3">
                          {/* Next Bus */}
                          <div className="flex flex-col items-start sm:items-end">
                            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-1">
                              Next Bus
                            </span>
                            {nextBuses[0] < 1 ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                                Arriving
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-bold bg-slate-900 text-white border border-slate-700 font-mono">
                                {nextBuses[0]} <span className="text-xs font-normal text-slate-400">min</span>
                              </span>
                            )}
                          </div>

                          {/* Next Bus 2 (if present) */}
                          {nextBuses.length > 1 && (
                            <div className="flex flex-col items-start sm:items-end border-l border-slate-700/60 pl-3">
                              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-1">
                                Subsequent
                              </span>
                              {nextBuses[1] < 1 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  Arriving
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-semibold bg-slate-900/80 text-slate-300 border border-slate-700/60 font-mono">
                                  {nextBuses[1]} <span className="text-xs font-normal text-slate-400">min</span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Health Status Modal / Drawer */}
      {showHealthModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400" />
                LTA Service Health Check
              </h3>
              <button
                onClick={() => setShowHealthModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-3 text-sm">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
                <span className="text-slate-300">API Key Configured:</span>
                <span className="flex items-center gap-1.5 font-semibold">
                  {health?.keyConfigured ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Yes
                    </span>
                  ) : (
                    <span className="text-amber-400 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" /> No
                    </span>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
                <span className="text-slate-300">LTA Upstream Answered:</span>
                <span className="flex items-center gap-1.5 font-semibold">
                  {health?.ltaAnswered ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Yes
                    </span>
                  ) : (
                    <span className="text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" /> No
                    </span>
                  )}
                </span>
              </div>

              {health?.upstreamStatus !== undefined && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700/50 font-mono text-xs">
                  <span className="text-slate-300 font-sans">HTTP Status Code:</span>
                  <span className={health.upstreamStatus === 200 ? 'text-emerald-400' : 'text-amber-400'}>
                    {health.upstreamStatus}
                  </span>
                </div>
              )}

              {health?.error && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-xs text-red-300">
                  {health.error}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowHealthModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer with exact required license attribution */}
      <footer className="border-t border-slate-800 bg-slate-950/90 py-6 px-4">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs text-slate-400 leading-relaxed text-center sm:text-left">
            Contains information from LTA DataMall Bus Arrival accessed on {accessedDate} from the
            Land Transport Authority (LTA DataMall), which is made available under the terms of the
            Singapore Open Data Licence version 1.0{' '}
            <a
              href="https://data.gov.sg/open-data-licence"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
            >
              https://data.gov.sg/open-data-licence
            </a>
            . This is an SMU course project and is not affiliated with or endorsed by the Land
            Transport Authority.
          </p>
        </div>
      </footer>
    </div>
  );
}
