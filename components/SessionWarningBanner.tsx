/**
 * components/SessionWarningBanner.tsx
 *
 * A sticky red warning banner shown on all student-facing pages.
 * Reminds participants not to close the browser or navigate away,
 * as doing so will permanently ban their registration.
 */

export default function SessionWarningBanner() {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="sticky bottom-0 z-50 w-full bg-red-600 text-white px-4 py-3 shadow-lg"
    >
      <div className="max-w-lg mx-auto flex items-start gap-3">
        <span className="text-2xl flex-shrink-0" aria-hidden="true">⚠️</span>
        <div>
          <p className="font-bold text-sm leading-snug">
            IMPORTANT WARNING — Do NOT close this tab or leave this page!
          </p>
          <p className="text-xs mt-0.5 text-red-100 leading-snug">
            If you quit, minimize, navigate away, or close the browser during the event, your registration
            will be permanently cancelled and you will <strong>not be allowed to re-register</strong> or
            participate in this event again.
          </p>
        </div>
      </div>
    </div>
  );
}
