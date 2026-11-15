// Preview uses public data and leaves account routes protected.
import {mountApp} from '../main';

if(import.meta.env.VITE_PWA_PREVIEW!=='true')throw new Error('Preview entry cannot run in production');
mountApp();
