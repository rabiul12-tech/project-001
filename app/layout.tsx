import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});
import { AppInitializer } from '@/components/feedback/AppInitializer';

export const metadata: Metadata = {
  title: 'AURELIX Analytics | Executive Business Intelligence Dashboard',
  description:
    'Executive Business Intelligence & Financial Analytics SaaS Dashboard for analyzing revenue, orders, customers, sales performance, and operational telemetry.',
  openGraph: {
    title: 'AURELIX Analytics | Executive Business Intelligence Dashboard',
    description:
      'Executive Business Intelligence & Financial Analytics SaaS Dashboard for analyzing revenue, orders, customers, sales performance, and operational telemetry.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AURELIX Analytics | Executive Business Intelligence Dashboard',
    description:
      'Executive Business Intelligence & Financial Analytics SaaS Dashboard for analyzing revenue, orders, customers, sales performance, and operational telemetry.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable}`} suppressHydrationWarning>
      <body
        className="min-h-screen bg-surface text-ink antialiased selection:bg-accent/25"
        suppressHydrationWarning
      >
        <AppInitializer>{children}</AppInitializer>
      </body>
    </html>
  );
}
