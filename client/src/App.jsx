
import React, { useEffect, useState } from 'react';
import Console from './Console.jsx';
import CaseView from './CaseView.jsx';
import DemoIntro from './tour/DemoIntro.jsx';
import DemoPage from './tour/DemoPage.jsx';
import DemoSummary from './tour/DemoSummary.jsx';
import HomeTour, { tourStore } from './tour/HomeTour.jsx';

const parse = () => {
  const h = window.location.hash;

  let m = h.match(/^#\/case\/([a-z0-9]+)/i);
  if (m) return { page: 'case', id: m[1] };

  m = h.match(/^#\/demo\/([a-z0-9]+)\/summary/i);
  if (m) return { page: 'summary', id: m[1] };

  m = h.match(/^#\/demo\/([a-z0-9]+)(?:\?at=([a-z0-9-]+))?/i);
  if (m) return { page: 'demo', id: m[1], at: m[2] };

  if (/^#\/demo\/?$/.test(h)) return { page: 'intro' };

  return { page: 'home' };
};

const go = (hash) => {
  window.location.hash = hash;
};

export default function App() {
  const [route, setRoute] = useState(parse);
  const [tour, setTour] = useState(() => tourStore.get());

  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const nav = {
    goHome: () => go('#/'),
    goIntro: () => go('#/demo'),
    goDemo: (id, at) => go(`#/demo/${id}${at ? `?at=${at}` : ''}`),
    goSummary: (id) => go(`#/demo/${id}/summary`),
    goNormal: () => {
      go('#/');
      setTimeout(
        () => document.getElementById('start-a-shift')?.scrollIntoView({ block: 'start' }),
        60
      );
    },
  };

  let page;

  if (route.page === 'case') {
    page = <CaseView key={route.id} id={route.id} goHome={nav.goHome} />;
  } else if (route.page === 'intro') {
    page = <DemoIntro {...nav} />;
  } else if (route.page === 'demo') {
    page = (
      <DemoPage
        key={`${route.id}:${route.at || ''}`}
        id={route.id}
        startAt={route.at}
        {...nav}
      />
    );
  } else if (route.page === 'summary') {
    page = <DemoSummary key={route.id} id={route.id} {...nav} />;
  } else {
    page = (
      <Console
        open={(id) => go(`#/case/${id}`)}
        startTour={() => setTour(0)}
        openDemo={nav.goIntro}
      />
    );
  }

  return (
    <>
      {page}
      {tour !== null && (
        <HomeTour initial={tour} onClose={() => setTour(null)} />
      )}
    </>
  );
}
