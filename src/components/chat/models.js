// 从 ursi-flow chat-web 迁移：模型清单仅供模型选择器展示，
// 宿主可传自己的 GatewayModel 列表（须与服务端网关模型一致）。

/**
 * @typedef {Object} GatewayModel
 * @property {string} id
 * @property {string} name
 */

/** @type {GatewayModel[]} */
export const MODELS = [
  { id: 'anthropic/claude-sonnet-5', name: 'Claude Sonnet 5' },
  { id: 'openai/gpt-5.6-terra', name: 'GPT 5.6 Terra' },
]
