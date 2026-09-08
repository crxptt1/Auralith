import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './styles.css';
import './materials.css';
import {AppMotionProvider} from './MotionPreferences';
import './motion.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><AppMotionProvider><App/></AppMotionProvider></React.StrictMode>);
