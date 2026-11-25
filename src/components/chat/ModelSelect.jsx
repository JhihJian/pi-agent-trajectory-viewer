import { MODELS } from './models.js'

/**
 * @param {{ models?: import('./models.js').GatewayModel[], value: string, onValueChange: (value: string) => void }} props
 */
export function ModelSelect({ models = MODELS, value, onValueChange }) {
  return (
    <select
      className="pi-chat-model-select"
      aria-label="Model"
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
    >
      {models.map((model) => (
        <option key={model.id} value={model.id}>
          {model.name}
        </option>
      ))}
    </select>
  )
}
