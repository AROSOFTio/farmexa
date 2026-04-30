const PLATFORM_HOSTS = new Set(['farmexa.arosoft.io', 'localhost', '127.0.0.1'])

export function isPlatformRegistrationHost(hostname = window.location.hostname) {
  const host = hostname.toLowerCase()
  return PLATFORM_HOSTS.has(host)
}
