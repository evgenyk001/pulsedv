// Static GitHub Pages review only. The production entry always uses RuntimeGate.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {App} from '../main';
import {InstallGate} from './InstallGate';
if(import.meta.env.VITE_PWA_PREVIEW!=='true')throw new Error('Preview entry cannot run in production');
createRoot(document.getElementById('root')!).render(<React.StrictMode><InstallGate><App/></InstallGate></React.StrictMode>);
