import { createRoot } from 'react-dom/client';
import ArenaShell from './components/ArenaShell.jsx';
import './styles.css';

createRoot(document.getElementById('root') || document.body.appendChild(document.createElement('div'))).render(
  <ArenaShell />
);
