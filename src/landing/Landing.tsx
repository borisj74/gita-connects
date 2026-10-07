import { useEffect, useRef } from 'react';
import '@fontsource/cormorant-garamond/400-italic.css';
import markup from './landing.html?raw';
import { startLanding } from './landing.js';
import { countLandingVisit } from '../analytics.js';
import './landing.css';

/**
 * The landing page at /. Its content is static, so it lives as plain markup
 * in landing.html, written once and never re-rendered; landing.ts brings the
 * hero window, the tour and the shaders to life.
 */
export default function Landing() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    countLandingVisit();
    return startLanding(ref.current as HTMLDivElement);
  }, []);

  return <div ref={ref} className="landing" dangerouslySetInnerHTML={{ __html: markup }} />;
}
