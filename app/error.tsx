'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ErrorPageProps {
  error: Error;
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const router = useRouter();

  useEffect(() => {
    console.error('Unhandled application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-200 p-8 text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Something went wrong</h1>
          <p className="text-sm text-gray-600 mb-6">
            A client-side error occurred while loading the page. Please refresh or return to the registration page.
          </p>
          <div className="space-y-3">
            <button
              className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 transition-colors"
              onClick={() => router.replace('/register')}
            >
              Go to Registration
            </button>
            <button
              className="w-full bg-gray-100 text-gray-800 py-3 rounded-xl hover:bg-gray-200 transition-colors"
              onClick={() => reset()}
            >
              Try Again
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-6">If this keeps happening, clear your browser cache and try again.</p>
        </div>
      </main>
    </div>
  );
}
