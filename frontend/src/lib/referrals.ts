const REFERRAL_KEY = 'farmexa_referral_code'
const REFERRAL_EXPIRY_KEY = 'farmexa_referral_expires_at'
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export function captureReferralFromUrl() {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('ref')?.trim()
  if (!code) return
  localStorage.setItem(REFERRAL_KEY, code.toUpperCase())
  localStorage.setItem(REFERRAL_EXPIRY_KEY, String(Date.now() + THIRTY_DAYS_MS))
}

export function getStoredReferralCode(): string | null {
  const expiresAt = Number(localStorage.getItem(REFERRAL_EXPIRY_KEY) || 0)
  if (!expiresAt || expiresAt < Date.now()) {
    localStorage.removeItem(REFERRAL_KEY)
    localStorage.removeItem(REFERRAL_EXPIRY_KEY)
    return null
  }
  return localStorage.getItem(REFERRAL_KEY)
}
