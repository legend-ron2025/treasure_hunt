'use client';
import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CollegeHeader from '@/components/CollegeHeader';
import SessionWarningBanner from '@/components/SessionWarningBanner';

export default function RegistrationPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);
  const [eventReady, setEventReady] = useState<boolean | null>(null);
  const [blockedCancelled, setBlockedCancelled] = useState(false);
  const [existingParticipant, setExistingParticipant] = useState<{ currentStage: number; status: string } | null>(null);

  useEffect(() => {
    // If a canonical PUBLIC base URL is set, redirect here if user opened an old/deleted deployment
    try {
      const canonical = process.env.NEXT_PUBLIC_BASE_URL;
      if (canonical && typeof window !== 'undefined') {
        const canonicalHost = new URL(canonical).host.replace(/:\d+$/, '');
        if (window.location.host.replace(/:\d+$/, '') !== canonicalHost) {
          window.location.replace(canonical.replace(/\/$/, '') + window.location.pathname + window.location.search);
          return;
        }
      }
    } catch (e) {
      // ignore URL parse errors
    }
    // Check event window first — redirect to countdown if not active
    fetch('/api/time', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : { eventStatus: 'before' })
      .then((timeData) => {
        if (timeData.eventStatus !== 'active') {
          router.replace('/countdown');
          return;
        }
        setEventReady(true);

        // If already has an active session, check registration status
        const token = localStorage.getItem('studentToken');
        if (!token) return;
        fetch('/api/student/me', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
          .then(async (res) => {
            if (!res.ok) {
              const errorBody: any = await res.json().catch(() => ({}));
              const errorMessage = typeof errorBody?.error === 'string' ? errorBody.error.toLowerCase() : '';

              if (res.status === 403 && errorMessage.includes('cancelled')) {
                localStorage.removeItem('studentToken');
                setBlockedCancelled(true);
                return null;
              }

              if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('studentToken');
              }

              return null;
            }
            return res.json();
          })
          .then((data) => {
            if (!data) return;
            if (data.status === 'cancelled') {
              setBlockedCancelled(true);
              return;
            }
            if (data.currentStage >= 6 || data.status === 'completed') {
              router.replace('/congratulations');
              return;
            }
            if (data.currentStage > 1) {
              router.replace(`/stage/${data.currentStage}`);
              return;
            }
            // If the student is only at Stage 1, keep them on the registration page.
            // They should only be redirected to Stage 1 after completing registration.
          })
          .catch(() => {});
      })
      .catch(() => {
        // Network error — show form; API will reject if event isn't active
        setEventReady(true);
      });
  }, [router]);

  function validateName(value: string): string {
    if (value.trim().length < 2) return 'Name must be at least 2 characters.';
    if (value.length > 100) return 'Name must be at most 100 characters.';
    if (value.replace(/\s/g, '').length < 2) return 'Name cannot be entirely whitespace.';
    return '';
  }

  function validatePhone(value: string): string {
    if (!/^\d{10}$/.test(value)) return 'Phone number must be exactly 10 digits.';
    return '';
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setApiError('');

    const nErr = validateName(name);
    const pErr = validatePhone(phone);
    setNameError(nErr);
    setPhoneError(pErr);
    if (nErr || pErr) return;

    setLoading(true);
    try {
      const res = await fetch('/api/student/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMessage = data.error ?? 'Registration failed. Please try again.';
        if (
          res.status === 403 &&
          (errorMessage === 'The event has not started yet.' || errorMessage === 'The event has ended.')
        ) {
          router.replace('/countdown');
          return;
        }
        setApiError(errorMessage);
        return;
      }

      localStorage.setItem('studentToken', data.token);
      router.push('/register/success');
    } catch {
      setApiError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  // Blocked screen — cancelled student trying to re-register
  if (blockedCancelled) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <CollegeHeader />
        <main className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-sm bg-white rounded-xl shadow-md p-6 text-center space-y-4">
            <div className="text-5xl" aria-hidden="true">🚫</div>
            <h2 className="text-xl font-bold text-red-700">You Quit the Event!</h2>
            <p className="text-sm text-gray-700">
              You closed, minimized, or left the browser during the event, so you have been disqualified from the treasure hunt.
            </p>
            <p className="text-sm font-semibold text-red-600">
              Your registration has been permanently cancelled and your details have been added to the ban list.
            </p>
            <p className="text-xs text-gray-500">
              If event staff want to allow you back in, an administrator can manually re-register you.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // Spinner while checking event status
  if (eventReady === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <CollegeHeader />
        <main className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <CollegeHeader />

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-1 text-center">Register to Play</h2>
          <p className="text-sm text-gray-500 mb-6 text-center">Enter your details to join the hunt</p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => { setName(e.target.value); setNameError(''); }}
                onBlur={() => setNameError(validateName(name))}
                aria-describedby={nameError ? 'name-error' : undefined}
                aria-invalid={!!nameError}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 min-h-[44px] ${
                  nameError ? 'border-red-400 focus:ring-red-300' : 'border-gray-300 focus:ring-blue-500'
                }`}
                placeholder="e.g. Priya Sharma"
              />
              {nameError && <p id="name-error" role="alert" className="mt-1 text-xs text-red-600">{nameError}</p>}
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                required
                maxLength={10}
                value={phone}
                onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '')); setPhoneError(''); }}
                onBlur={() => setPhoneError(validatePhone(phone))}
                aria-describedby={phoneError ? 'phone-error' : undefined}
                aria-invalid={!!phoneError}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 min-h-[44px] ${
                  phoneError ? 'border-red-400 focus:ring-red-300' : 'border-gray-300 focus:ring-blue-500'
                }`}
                placeholder="10-digit number"
              />
              {phoneError && <p id="phone-error" role="alert" className="mt-1 text-xs text-red-600">{phoneError}</p>}
            </div>

            {apiError && (
              <div role="alert" className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <p className="text-sm text-red-700">{apiError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg min-h-[44px] hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {loading ? 'Registering…' : 'Register & Start Hunt'}
            </button>
          </form>
        </div>
      </main>
      <SessionWarningBanner />
    </div>
  );
}
