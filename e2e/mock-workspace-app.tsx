import { createRoot } from 'react-dom/client';
import Home from '../app/routes/home';
import '../src/ui-refresh.css';
import '../src/app.css';

const query = new URLSearchParams(window.location.search);
query.set('mock', '1');
query.set('mockReset', '1');
window.history.replaceState(null, '', `${window.location.pathname}?${query}`);

const root = document.getElementById('root');
if (!root) throw new Error('E2E root element is missing.');

createRoot(root).render(<Home />);
