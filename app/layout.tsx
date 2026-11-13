import type { Metadata } from 'next';
import './globals.css';
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
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className="min-h-screen bg-app text-main antialiased selection:bg-blue-600/20 selection:text-blue-600 dark:selection:bg-blue-400/20 dark:selection:text-blue-300"
        suppressHydrationWarning
      >
        <AppInitializer>{children}</AppInitializer>
      </body>
    </html>
  );
}
