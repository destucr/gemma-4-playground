import type { Metadata } from "next";
import { Alegreya, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";

const displayFont = Alegreya({
  variable: "--font-alegreya",
  subsets: ["latin"],
});

const bodyFont = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Local Classroom • Learning Adventure",
  description: "A warm, patient local AI kindergarten teacher.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${displayFont.variable} ${bodyFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-body">{children}</body>
    </html>
  );
}
