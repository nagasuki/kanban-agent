import { FilePlus2, FolderTree } from "lucide-react";
import type { FileTreeNode } from "../../domain/types";

interface FileTreePickerProps {
  nodes: FileTreeNode[];
  onAttachFile: (path: string) => void;
}

export const FileTreePicker = ({ nodes, onAttachFile }: FileTreePickerProps) => {
  if (nodes.length === 0) {
    return <p className="helper-text">No repo files loaded yet.</p>;
  }

  return (
    <div className="file-tree">
      {nodes.map((node) => (
        <FileTreeNodeView key={node.path} node={node} onAttachFile={onAttachFile} />
      ))}
    </div>
  );
};

const FileTreeNodeView = ({ node, onAttachFile }: { node: FileTreeNode; onAttachFile: (path: string) => void }) => {
  return (
    <div className={`file-tree-node ${node.blocked ? "blocked" : ""}`}>
      <div className="file-tree-row">
        <span>
          {node.type === "directory" ? <FolderTree size={14} /> : <FilePlus2 size={14} />}
          {node.name}
        </span>
        {node.type === "file" && !node.blocked ? (
          <button type="button" onClick={() => onAttachFile(node.path)}>
            Attach
          </button>
        ) : null}
      </div>
      {node.children?.length ? (
        <div className="file-tree-children">
          {node.children.map((child) => (
            <FileTreeNodeView key={child.path} node={child} onAttachFile={onAttachFile} />
          ))}
        </div>
      ) : null}
    </div>
  );
};
