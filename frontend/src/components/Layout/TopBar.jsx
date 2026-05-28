import { Plus } from 'lucide-react';

export function TopBar({ title, onNewWorkflow }) {
  return (
    <header className="topbar">
      <div className="topbar__left">
        <h1 className="topbar__title">{title || 'Dashboard'}</h1>
      </div>
      <div className="topbar__right">
        {onNewWorkflow && (
          <button className="btn btn-primary" onClick={onNewWorkflow}>
            <Plus size={16} />
            New Workflow
          </button>
        )}
      </div>
    </header>
  );
}

export default TopBar;
