import Link from 'next/link';
import { ArrowLeft, Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 text-slate-800">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-lg text-center space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-[#0284C7]">
          <Compass className="h-7 w-7" />
        </div>

        <div className="space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#0284C7] bg-sky-50 px-2.5 py-0.5 rounded-full">
            404 • Resource Not Found
          </span>
          <h2 className="text-lg font-bold text-slate-900">
            Page Or Clinical Record Not Found
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            The requested emergency terminal route does not exist. Return to the active clinic intake dashboard.
          </p>
        </div>

        <div className="pt-2">
          <Link
            href="/"
            className="w-full flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#0369A1] transition-all active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" stroke='#0284C7' />
            <span>Return to ReferralOS Triage</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
