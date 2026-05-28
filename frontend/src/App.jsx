import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './hooks/useTheme';
import Sidebar from './components/Layout/Sidebar';
import WorkflowList from './pages/WorkflowList';
import WorkflowDetail from './pages/WorkflowDetail';
import HumanTaskQueue from './pages/HumanTaskQueue';

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <div className="app-layout">
          <Sidebar />
          <main className="app-main">
            <Routes>
              <Route path="/" element={<WorkflowList />} />
              <Route path="/workflow/:id" element={<WorkflowDetail />} />
              <Route path="/approvals" element={<HumanTaskQueue />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
