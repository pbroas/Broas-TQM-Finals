import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'PRM Quality Intelligence | Priority Risk Management',
  description: 'Secure, AI-powered quality audit and continuous process improvement platform for Priority Risk Management (PRM).',
  openGraph: {
    title: 'PRM Quality Intelligence | Priority Risk Management',
    description: 'Secure, AI-powered quality audit and continuous process improvement platform for Priority Risk Management (PRM).',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PRM Quality Intelligence | Priority Risk Management',
    description: 'Secure, AI-powered quality audit and continuous process improvement platform for Priority Risk Management (PRM).',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
