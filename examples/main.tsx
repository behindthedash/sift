import React from 'react';
import { createRoot } from 'react-dom/client';
import DemoPage from './demo-page';
import '../src/styles.css';
createRoot(document.getElementById('root')!).render(<DemoPage />);
