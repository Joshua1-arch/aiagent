import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AgentGate — Pre-Validate & Hire AI Agents on OKX.AI',
  description:
    'Pre-check your ASP before OKX listing, then hire the best agents on the marketplace. AgentGate validates x402 compliance, endpoint quality, and listing readiness.',
  keywords: 'OKX.AI, ASP validation, agent pre-flight, agent broker, x402 checker, AI agent marketplace, Web3 automation',
  openGraph: {
    title: 'AgentGate — Pre-Validate & Hire AI Agents on OKX.AI',
    description: 'The quality gate for OKX.AI agents. Pre-validate your listing, then hire with confidence.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
