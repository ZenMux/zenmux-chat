import { createRoot } from 'react-dom/client';
import './app.css';
import { App } from './app/App';

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
