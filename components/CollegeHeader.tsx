'use client';

export const COLLEGE_NAME = 'Vishwakamal Mahavidyalay';

const LOGO_URL     = 'https://i.postimg.cc/c1cHCbHX/Whats-App-Image-2026-07-31-at-6-24-50-PM.jpg';
const PORTRAIT_URL = 'https://i.postimg.cc/YqHBC28b/Chat-GPT-Image-Aug-7-2026-03-15-14-PM.png';

export default function CollegeHeader() {
  return (
    <header className="w-full bg-white border-b border-gray-300 shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2 max-w-2xl mx-auto">

        {/* Left — college crest */}
        <div className="flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={LOGO_URL}
            alt="Vishwakamal Mahavidyalay crest"
            width={56}
            height={56}
            className="rounded-full object-contain"
            style={{ width: 56, height: 56 }}
          />
        </div>

        {/* Centre — all text */}
        <div className="flex-1 min-w-0 text-center leading-snug px-1">
          <p className="text-[8px] text-gray-500 font-medium">
            Rajmata Jijau Mahila Manch&apos;s
          </p>
          <h1 className="text-[13px] sm:text-sm font-extrabold text-blue-800 leading-tight">
            Vishwakamal Mahavidyalay
          </h1>
          <p className="text-[7.5px] sm:text-[8px] font-semibold text-gray-700 leading-tight">
            Talegaon Dabhade, Tal - Maval, Dist - Pune, Pin - 410 507
          </p>
          <p className="text-[7px] text-gray-500 leading-tight mt-0.5">
            Website: rjmvkm.edu.in &nbsp;|&nbsp; Phone: 96239 71999
          </p>
          <p className="text-[6.5px] sm:text-[7px] font-semibold text-gray-600 leading-tight mt-1 border-t border-gray-200 pt-1">
            Affiliated to Savitribai Phule Pune University (Affiliation ID CAAP021850)
          </p>
        </div>

        {/* Right — portrait */}
        <div className="flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={PORTRAIT_URL}
            alt="Rajmata Jijau portrait"
            width={56}
            height={56}
            className="rounded-full object-cover border-2 border-yellow-400"
            style={{ width: 56, height: 56 }}
          />
        </div>

      </div>
    </header>
  );
}
