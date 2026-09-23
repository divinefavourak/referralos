'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[ReferralOS Boundary Caught Error]:', error);
  }, [error]);

  const handleResetSession = () => {
    try {
      sessionStorage.clear();
    } catch {}
    reset();
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 text-slate-800">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-lg text-center space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl  text-rose-600 ring-8 ring-rose-50/50">
          <AlertTriangle className="h-7 w-7" />
        </div>

        <div className="space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full">
            Clinical System Recovery
          </span>
          <h2 className="text-lg font-bold text-slate-900">
            Encountered An Unexpected Exception
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            The emergency referral pipeline caught a runtime exception. Patient and capacity integrity are preserved.
          </p>
        </div>

        {error.message && (
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-left">
            <span className="text-[10px] font-bold uppercase text-slate-400">Diagnostic Details</span>
            <p className="text-xs font-mono text-slate-700 truncate mt-0.5">
              {error.message}
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={() => handleResetSession()}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl  px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#0369A1] transition-all active:scale-95 cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" stroke='#0284C7' />
            <span>Recover Session</span>
          </button>

          <Link
            href="/"
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all active:scale-95 cursor-pointer"
          >
            <Home className="h-4 w-4" />
            <span>Reload App</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
