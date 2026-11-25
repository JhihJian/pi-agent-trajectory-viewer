import { RiAddLine } from '@remixicon/react'

import { Button } from './ui/Button.jsx'

/** 清空会话回到空聊天。 */
export function NewChatButton() {
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => window.location.reload()}
    >
      <RiAddLine className="pi-chat-btn-icon-inline" />
      New Chat
    </Button>
  )
}
