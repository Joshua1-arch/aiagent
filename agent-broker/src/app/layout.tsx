import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AgentBroker — The AI Agent That Hires AI Agents',
  description:
    'Describe your task, set a budget. AgentBroker searches the OKX.AI marketplace, picks the best agent, submits the task, monitors delivery, and releases payment — all autonomously.',
  keywords: 'AI agent, OKX.AI, agent broker, crypto agents, agentic marketplace, Web3 automation',
  openGraph: {
    title: 'AgentBroker — The AI Agent That Hires AI Agents',
    description: 'The world\'s first autonomous agent orchestrator for OKX.AI. Tell it what you need. It handles everything else.',
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
