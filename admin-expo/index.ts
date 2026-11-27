import {registerRootComponent} from 'expo';
import App from './src/App';
import './src/web.css';

document.documentElement.lang = 'th';
document.querySelector('meta[name="viewport"]')?.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');
registerRootComponent(App);
