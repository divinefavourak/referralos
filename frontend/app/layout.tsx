import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'ReferralOS | Emergency Healthcare Transfer Coordination',
  description:
    'Real-time emergency referral coordination platform matching clinical acuity against verified hospital capability.',
  keywords: [
    'healthcare referral',
    'emergency triage',
    'hospital capacity management',
    'distributed locking',
    'ambulance telematics',
    'postpartum haemorrhage',
  ],
  authors: [{ name: 'ReferralOS Clinical Engineering Team' }],
  icons: {
    icon: '/logo.svg',
    shortcut: '/logo.svg',
    apple: '/logo.svg',
  },
  openGraph: {
    title: 'ReferralOS | Emergency Healthcare Transfer Coordination',
    description:
      'Real-time emergency referral coordination platform matching clinical acuity against verified hospital capability.',
    siteName: 'ReferralOS',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'ReferralOS | Emergency Healthcare Transfer Coordination',
    description:
      'Real-time emergency referral coordination platform matching clinical acuity against verified hospital capability.',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#F8FAFC] text-[#0F172A] selection:bg-[#E0F2FE] selection:text-[#0369A1] font-sans">
        {children}
      </body>
    </html>
  );
}
