import {
  RiCheckboxCircleLine,
  RiErrorWarningLine,
  RiLoader4Line,
} from '@remixicon/react'

/** @param {{ status?: 'running' | 'error' }} props */
export function StatusIcon({ status }) {
  if (status === 'running') {
    return <RiLoader4Line className="pi-chat-spin" />
  }

  if (status === 'error') {
    return <RiErrorWarningLine />
  }

  return <RiCheckboxCircleLine />
}
