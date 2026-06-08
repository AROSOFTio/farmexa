const PLATFORM_HOSTS = new Set([
  'arosoftlabs.com',
  'www.arosoftlabs.com',
  'cp.arosoftlabs.com',
  'farm.arosoftlabs.com',
  'mail.arosoftlabs.com',
  'courses.arosoftlabs.com',
  'demo.arosoftlabs.com',
  'my.arosoftlabs.com',
  'arofi.arosoftlabs.com',
  'api.arosoftlabs.com',
  'admin.arosoftlabs.com',
  'support.arosoftlabs.com',
  'localhost',
  '127.0.0.1',
])

/** Returns true when the current host is a known central platform host. */
export function isPlatformRegistrationHost(hostname = window.location.hostname) {
  const host = hostname.toLowerCase()
  return PLATFORM_HOSTS.has(host)
}

