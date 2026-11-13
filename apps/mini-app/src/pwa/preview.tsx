// Preview uses public data and leaves account routes protected.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {App} from '../main';
import {RuntimeGate} from '../components/RuntimeGate';
import {InstallGate} from './InstallGate';
if(import.meta.env.VITE_PWA_PREVIEW!=='true')throw new Error('Preview entry cannot run in production');
createRoot(document.getElementById('root')!).render(<React.StrictMode><InstallGate><RuntimeGate><App/></RuntimeGate></InstallGate></React.StrictMode>);
