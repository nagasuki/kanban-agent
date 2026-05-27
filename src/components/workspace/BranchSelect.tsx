import { GitBranch, Search } from "lucide-react";
import { useId, useMemo, useState } from "react";

interface BranchSelectProps {
  branches: string[];
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (branch: string) => void;
}

export const BranchSelect = ({
  branches,
  disabled = false,
  label = "Branch",
  placeholder = "Search branches",
  value,
  onChange
}: BranchSelectProps) => {
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const options = useMemo(
    () => [value, ...branches].filter((branch, index, list) => branch && list.indexOf(branch) === index),
    [branches, value]
  );
  const filteredOptions = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    return cleanQuery ? options.filter((branch) => branch.toLowerCase().includes(cleanQuery)) : options;
  }, [options, query]);

  const selectedLabel = value || "No branch detected";

  const selectBranch = (branch: string) => {
    onChange(branch);
    setQuery("");
    setOpen(false);
  };

  return (
    <div
      className="branch-select"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
          setQuery("");
        }
      }}
    >
      <label htmlFor={inputId}>{label}</label>
      <div className="branch-combobox">
        <GitBranch className="branch-combobox-icon" size={14} />
        <input
          aria-autocomplete="list"
          aria-expanded={open}
          aria-label={label}
          disabled={disabled || options.length === 0}
          id={inputId}
          role="combobox"
          type="search"
          value={open ? query : selectedLabel}
          placeholder={placeholder}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setQuery("");
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              setQuery("");
              event.currentTarget.blur();
            }
            if (event.key === "Enter" && filteredOptions[0]) {
              event.preventDefault();
              selectBranch(filteredOptions[0]);
            }
          }}
        />
        <Search className="branch-search-icon" size={14} />

        {open && !disabled ? (
          <div className="branch-options" role="listbox">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((branch) => (
                <button
                  className={branch === value ? "active" : ""}
                  key={branch}
                  role="option"
                  type="button"
                  aria-selected={branch === value}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectBranch(branch)}
                >
                  {branch}
                </button>
              ))
            ) : (
              <span>No matching branches</span>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};
