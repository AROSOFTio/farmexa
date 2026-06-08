const PLATFORM_HOSTS = new Set(['myfarm.arosoftlabs.com', 'farm.arosoftlabs.com', 'arosoftlabs.com', 'localhost', '127.0.0.1'])

/** Returns true when the current host is a known platform/registration host. */
export function isPlatformRegistrationHost(hostname = window.location.hostname) {
  const host = hostname.toLowerCase()
  return PLATFORM_HOSTS.has(host)
}

/**
 * Returns true when the current host is a tenant workspace domain
 * (i.e. NOT one of the central platform hosts).
 * Tenant domains only show the login page and authenticated app — no
 * public marketing pages, registration, affiliates, or pricing.
 */
export function isTenantHost(hostname = window.location.hostname) {
  return !isPlatformRegistrationHost(hostname)
}
