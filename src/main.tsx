import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/dm-sans/wght.css';
import '@fontsource/silkscreen/latin-400.css';
import './styles.css';
import { App } from './App';
import { DataProvider } from './DataProvider';
import { ProfileProvider } from './profile';
import { SoundProvider } from './sound';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><DataProvider><ProfileProvider><SoundProvider><App /></SoundProvider></ProfileProvider></DataProvider></React.StrictMode>,
);
