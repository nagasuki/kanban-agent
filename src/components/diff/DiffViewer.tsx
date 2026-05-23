interface DiffViewerProps {
  value: string;
}

export const DiffViewer = ({ value }: DiffViewerProps) => {
  if (!value.trim()) {
    return <p className="helper-text">No patch saved yet.</p>;
  }

  return (
    <pre className="diff-viewer">
      {value.split("\n").map((line, index) => (
        <span className={classNameForLine(line)} key={`${index}-${line.slice(0, 20)}`}>
          {line || " "}
          {"\n"}
        </span>
      ))}
    </pre>
  );
};

const classNameForLine = (line: string): string => {
  if (line.startsWith("+++ ") || line.startsWith("--- ") || line.startsWith("diff --git")) {
    return "diff-meta";
  }

  if (line.startsWith("+")) {
    return "diff-add";
  }

  if (line.startsWith("-")) {
    return "diff-remove";
  }

  if (line.startsWith("@@")) {
    return "diff-hunk";
  }

  return "diff-context";
};
