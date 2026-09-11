import { useEffect, useRef } from 'react';
import { initArena } from '../services/arena.js';

export default function ArenaShell() {
  const rootRef = useRef(null);
  useEffect(() => {
    if (!rootRef.current) return;
    const body = document.body;
    const children = Array.from(body.children).filter((el) => el !== rootRef.current && el.tagName !== 'SCRIPT');
    // The arena HTML is already in index.html; initialize its behavior once.
    initArena();
    return () => {
      // arena uses document-level listeners; Vite HMR can otherwise duplicate them.
      // A full reload is preferable for the contest runtime.
    };
  }, []);
  return <div ref={rootRef} aria-hidden="true" style={{display:'none'}} />;
}
