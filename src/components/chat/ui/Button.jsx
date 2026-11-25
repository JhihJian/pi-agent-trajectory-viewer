import React from 'react'

/**
 * @typedef {'default' | 'outline' | 'secondary' | 'ghost' | 'destructive'} ButtonVariant
 * @typedef {'md' | 'sm' | 'icon' | 'icon-sm'} ButtonSize
 */

const VARIANT_CLASS = /** @type {Record<ButtonVariant, string>} */ ({
  default: 'pi-chat-btn-primary',
  outline: 'pi-chat-btn-outline',
  secondary: 'pi-chat-btn-secondary',
  ghost: 'pi-chat-btn-ghost',
  destructive: 'pi-chat-btn-danger',
})

/**
 * @param {import('react').ComponentProps<'button'> & {
 *   variant?: ButtonVariant
 *   size?: ButtonSize
 * }} props
 */
export function Button({ variant = 'default', size = 'md', className, ...props }) {
  const cls = [
    'pi-chat-btn',
    VARIANT_CLASS[variant],
    size === 'sm' ? 'pi-chat-btn-sm' : '',
    size === 'icon' ? 'pi-chat-btn-icon' : '',
    size === 'icon-sm' ? 'pi-chat-btn-icon pi-chat-btn-icon-sm' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return <button className={cls} {...props} />
}
