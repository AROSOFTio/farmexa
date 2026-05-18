import { isAxiosError } from 'axios'

function stringifyDetail(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || null
  }

  if (Array.isArray(value)) {
    const messages = value
      .map((item) => stringifyDetail(item))
      .filter((message): message is string => Boolean(message))
    return messages.length ? messages.join(', ') : null
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (typeof record.msg === 'string') return record.msg
    if (typeof record.message === 'string') return record.message
    if ('detail' in record) return stringifyDetail(record.detail)
  }

  return null
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const responseDetail = stringifyDetail(error.response?.data)
    if (responseDetail) return responseDetail
    if (!error.response && error.message) return error.message
    if (error.response?.status) return `${fallback} Server returned HTTP ${error.response.status}.`
  }

  const directMessage = stringifyDetail(error)
  if (directMessage) return directMessage

  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallback
}
