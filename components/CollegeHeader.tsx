'use client';
import Image from 'next/image';
import { useState } from 'react';

export const COLLEGE_NAME = 'Vishwakamal Mahavidyalay';

const LOGO_URL = 'https://i.postimg.cc/c1cHCbHX/Whats-App-Image-2026-07-31-at-6-24-50-PM.jpg';

export default function CollegeHeader() {
  const [logoError, setLogoError] = useState(false);

  return (
    <header className="w-full bg-white border-b border-gray-200 shadow-sm">
      {/* Main banner row */}
      <div className="flex items-center gap-2 px-3 py-2 max-w-2xl mx-auto">
        {/* Left logo */}
        {!logoError && (
          <div className="relative flex-shrink-0" style={{ width: 56, height: 56 }}>
            <Image
              src={LOGO_URL}
              alt="Vishwakamal Mahavidyalay logo"
              fill
              sizes="56px"
              className="object-contain rounded-full"
              onError={() => setLogoError(true)}
              priority
              unoptimized
            />
          </div>
        )}

        {/* Center text */}
        <div className="flex-1 min-w-0 text-center px-1">
          <p className="text-[9px] sm:text-[10px] text-gray-600 leading-tight">
            Rajmata Jijau Mahila Manch&apos;s
          </p>
          <h1 className="text-sm sm:text-base font-extrabold text-blue-800 leading-tight tracking-tight">
            Vishwakamal Mahavidyalay
          </h1>
          <p className="text-[8px] sm:text-[9px] font-semibold text-gray-700 leading-tight mt-0.5">
            Talegaon Dabhade, Tal - Maval, Dist - Pune, Pin - 410 507
          </p>
          <p className="text-[7px] sm:text-[8px] text-gray-500 leading-tight mt-0.5 hidden xs:block">
            Website: rjmvkm.edu.in &nbsp;|&nbsp; Phone: 96239 71999
          </p>
        </div>

        {/* Right portrait */}
        {!logoError && (
          <div className="relative flex-shrink-0" style={{ width: 52, height: 52 }}>
            <Image
              src={LOGO_URL}
              alt="Vishwakamal Mahavidyalay"
              fill
              sizes="52px"
              className="object-cover rounded-full border-2 border-yellow-400"
              onError={() => {}}
              priority
              unoptimized
            />
          </div>
        )}
      </div>

      {/* Affiliation bar */}
      <div className="bg-gray-50 border-t border-gray-100 px-3 py-1 text-center">
        <p className="text-[8px] sm:text-[9px] font-semibold text-gray-700 leading-tight">
          Affiliated to Savitribai Phule Pune University (Affiliation ID CAAP021850)
        </p>
      </div>

      {/* Event label bar */}
      <div className="bg-blue-800 px-3 py-1 text-center">
        <p className="text-[10px] sm:text-xs font-bold text-white tracking-widest uppercase">
          🏆 Treasure Hunt Event
        </p>
      </div>
    </header>
  );
}
