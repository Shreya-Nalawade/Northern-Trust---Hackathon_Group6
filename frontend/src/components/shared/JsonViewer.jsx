import { useState } from 'react';
import { ChevronRight, ChevronDown, Copy, Check } from 'lucide-react';

export function JsonViewer({ data, label, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);

  if (data === null || data === undefined) {
    return (
      <div className="json-viewer">
        {label && <div className="json-viewer-label">{label}</div>}
        <div className="json-viewer-empty">No data</div>
      </div>
    );
  }

  const jsonString = JSON.stringify(data, null, 2);

  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard may not be available
    }
  };

  return (
    <div className="json-viewer">
      <button
        className="json-viewer-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="json-viewer-chevron">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <span className="json-viewer-label">{label || 'JSON'}</span>
        <span className="json-viewer-preview">
          {!expanded && (
            <span className="text-[var(--text-muted)] text-xs truncate max-w-[200px] inline-block">
              {jsonString.substring(0, 60)}…
            </span>
          )}
        </span>
        <button className="json-viewer-copy" onClick={handleCopy} title="Copy JSON">
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      </button>
      {expanded && (
        <pre className="json-viewer-content">
          <code>{jsonString}</code>
        </pre>
      )}
    </div>
  );
}

export default JsonViewer;
