import type { Metadata } from 'next';
import { Space_Grotesk, Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/auth-context';
import { HouseholdProvider } from '@/contexts/household-context';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'RumahKita — Urus Rumah Bareng-Bareng',
  description:
    'Aplikasi privat pencatatan keuangan dan inventori rumah tangga untuk 2 anggota keluarga. Neo-brutalism design, Indonesian locale.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <body className="bg-bg text-ink min-h-screen font-body antialiased selection:bg-primary selection:text-ink">
        <AuthProvider>
          <HouseholdProvider>{children}</HouseholdProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
