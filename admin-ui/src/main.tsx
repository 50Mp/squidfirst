import {createRoot} from 'react-dom/client';import App from './App';import './theme.css';import './styles.css';import './light.css';import './workspace.css';
import {lockTouchZoom} from './touch-viewport';
lockTouchZoom();
createRoot(document.getElementById('root')!).render(<App/>);
