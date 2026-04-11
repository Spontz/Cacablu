import 'dockview-core/dist/styles/dockview.css';
import './styles/theme.css';
import './styles/app.css';

import { bootstrapApp } from './app/bootstrap';

const root = document.querySelector<HTMLDivElement>('#app');

if (!root) {
  throw new Error('Application root element "#app" was not found.');
}

bootstrapApp(root);
