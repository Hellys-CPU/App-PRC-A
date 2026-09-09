import React from 'react';

export function SkeletonBlock({ width = '100%', height = 14, style }) {
  return <div className="skeleton-block" style={{ width, height, ...style }} />;
}

// Imita a forma de um card de Kanban enquanto os dados reais carregam.
export function SkeletonKanbanCard() {
  return (
    <div className="kanban-card skeleton-card">
      <SkeletonBlock width="55%" height={13} />
      <SkeletonBlock width="70%" height={10} style={{ marginTop: 10 }} />
      <SkeletonBlock width="40%" height={10} style={{ marginTop: 8 }} />
    </div>
  );
}

export function SkeletonTableRows({ rows = 3, cols = 5 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c}><SkeletonBlock height={12} width={c === 0 ? '70%' : '50%'} /></td>
          ))}
        </tr>
      ))}
    </>
  );
}
