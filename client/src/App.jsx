import React, { useEffect, useState } from 'react';
import Console from './Console.jsx';
import CaseView from './CaseView.jsx';

const parse = () => {
  const m = window.location.hash.match(/^#\/case\/([a-z0-9]+)/i);
  return m ? { page: 'case', id: m[1] } : { page: 'home' };
};

export default function App() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  if (route.page === 'case') return <CaseView key={route.id} id={route.id} goHome={() => { window.location.hash = '#/'; }} />;
  return <Console open={(id) => { window.location.hash = `#/case/${id}`; }} />;
}
