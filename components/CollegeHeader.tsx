'use client';
import Image from 'next/image';
import { useState } from 'react';

export const COLLEGE_NAME = 'RJMMs Vishwakamal Mahavidhayal';

// Hardcoded logo URL as provided
const LOGO_URL = 'https://i.postimg.cc/c1cHCbHX/Whats-App-Image-2026-07-31-at-6-24-50-PM.jpg';

export default function CollegeHeader() {
  const [logoError, setLogoError] = useState(false);

  return (
    <header className="flex items-center justify-center gap-3 py-4 px-6 bg-white shadow-sm border-b border-gray-100">
      {!logoError && (
        <div className="relative w-12 h-12 flex-shrink-0">
          <Image
            src={LOGO_URL}
            alt={`${COLLEGE_NAME} logo`}
            fill
            sizes="48px"
            className="object-contain rounded-full"
            onError={() => setLogoError(true)}
            priority
            unoptimized
          />
        </div>
      )}
      <div className="text-center">
        <h1 className="text-base font-bold text-gray-800 leading-tight">
          {COLLEGE_NAME}
        </h1>
        <p className="text-xs text-blue-600 font-medium tracking-wide">Treasure Hunt Event</p>
      </div>
    </header>
  );
}
