import { Funnel_Sans, Funnel_Display, Geist_Mono } from "next/font/google";
import "./globals.css";

// Het lettertype van houseofdigital.nl: Funnel Display voor koppen, Funnel Sans voor lopende tekst.
const funnelSans = Funnel_Sans({
  variable: "--font-funnel-sans",
  subsets: ["latin"],
});

const funnelDisplay = Funnel_Display({
  variable: "--font-funnel-display",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "AI Organisatie Transformatie Simulator",
  description: "Intern tool voor organisatie- en sectoranalyse",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="nl"
      className={`${funnelSans.variable} ${funnelDisplay.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-page text-slate-900">{children}</body>
    </html>
  );
}
