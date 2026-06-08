interface SwitchProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  id?: string;
}

/** Interrupteur on/off accessible. */
export function Switch({ checked, onChange, id }: SwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      className={`switch ${checked ? "on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="knob" />
    </button>
  );
}
