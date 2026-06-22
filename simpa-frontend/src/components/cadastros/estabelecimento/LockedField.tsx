interface LockedFieldProps {
  label: string;
  value: string;
}

export function LockedField({ label, value }: LockedFieldProps) {
  return (
    <label className="cadastro-field cadastro-field-locked">
      <span>
        {label} <span aria-hidden="true">🔒</span>
      </span>
      <input
        type="text"
        disabled
        readOnly
        value={value}
        title="Sincronizado do SIA — somente leitura"
        data-testid={`locked-field-${label.toLowerCase().replace(/\s+/g, '-')}`}
      />
    </label>
  );
}
