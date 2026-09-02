import React, { useState } from 'react';
import { getTheme, toggleTheme } from '../theme';

export default function ThemeToggle() {
  const [theme, setTheme] = useState(getTheme());

  function handleToggle() {
    const next = toggleTheme();
    setTheme(next);
  }

  return (
    <button className="theme-toggle" onClick={handleToggle} title="Alternar modo claro/escuro">
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
