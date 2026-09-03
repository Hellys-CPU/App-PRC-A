import React from 'react';
import AdminNav from '../components/AdminNav.jsx';
import { CHANGELOG } from '../changelog.js';

export default function AdminChangelog() {
  return (
    <div className="admin-container">
      <AdminNav />
      <h1 className="page-title">Novidades</h1>
      <p className="subtitle" style={{ textAlign: 'left', marginBottom: 24 }}>
        Histórico do que foi adicionado e corrigido no sistema.
      </p>

      <div className="changelog-list">
        {CHANGELOG.map((entry) => (
          <div key={entry.version} className="changelog-entry">
            <div className="changelog-entry-header">
              <span className="changelog-version">v{entry.version}</span>
              <span className="changelog-date">{entry.date}</span>
            </div>
            <ul className="changelog-items">
              {entry.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
