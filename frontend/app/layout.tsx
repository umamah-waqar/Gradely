
import React from 'react';
import "./globals.css";

export const metadata = {
  title: 'Gradely',
  description: 'Multi-Tenant Quiz Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 min-h-screen">{children}</body>
    </html>
  );
}