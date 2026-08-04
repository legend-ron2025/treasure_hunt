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

  // Redirect if already has active session
  useEffect(() => {
    const token = localStorage.getItem('studentToken');
    if (token) {
      fetch('/api/student/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (data?.currentStage) {
            if (data.currentStage > 5) {
              router.replace('/congratulations');
            } else {
              router.replace(`/stage/${data.currentStage}`);
            }
          }
        })
        .catch(() => {}); // ignore errors — stay on register page
    }
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
        setApiError(data.error ?? 'Registration failed. Please try again.');
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <CollegeHeader />

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-1 text-center">Register to Play</h2>
          <p className="text-sm text-gray-500 mb-6 text-center">Enter your details to join the hunt</p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Name */}
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
              {nameError && (
                <p id="name-error" role="alert" className="mt-1 text-xs text-red-600">
                  {nameError}
                </p>
              )}
            </div>

            {/* Phone */}
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
              {phoneError && (
                <p id="phone-error" role="alert" className="mt-1 text-xs text-red-600">
                  {phoneError}
                </p>
              )}
            </div>

            {/* API error */}
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
