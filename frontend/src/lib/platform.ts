const PLATFORM_HOSTS = new Set(['myfarm.arosoftlabs.com', 'farm.arosoftlabs.com', 'arosoftlabs.com', 'localhost', '127.0.0.1'])

export function isPlatformRegistrationHost(hostname = window.location.hostname) {
  const host = hostname.toLowerCase()
  return PLATFORM_HOSTS.has(host)
}
