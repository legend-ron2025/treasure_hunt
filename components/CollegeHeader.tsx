'use client';
import Image from 'next/image';
import { useState } from 'react';

export const COLLEGE_NAME = 'RJMMsVishwakamal Mahavidhayal';

const LOGO_URL = process.env.NEXT_PUBLIC_COLLEGE_LOGO_URL ?? '';

export default function CollegeHeader() {
  const [logoError, setLogoError] = useState(false);
  const showLogo = LOGO_URL.length > 0 && !logoError;

  return (
    <header className="flex items-center justify-center gap-3 py-4 px-6 bg-white shadow-sm">
      {showLogo && (
        <div className="relative min-w-[44px] min-h-[44px] w-11 h-11 flex-shrink-0">
          <Image
            src={LOGO_URL}
            alt={`${COLLEGE_NAME} logo`}
            fill
            sizes="44px"
            className="object-contain"
            onError={() => setLogoError(true)}
            priority
          />
        </div>
      )}
      <h1 className="text-lg font-bold text-gray-800 text-center leading-tight">
        {COLLEGE_NAME}
      </h1>
    </header>
  );
}
