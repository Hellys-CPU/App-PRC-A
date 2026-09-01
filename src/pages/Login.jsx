import React, { useState } from 'react';
import { supabase, phoneToInternalEmail, cleanPhone } from '../supabase';

export default function Login() {
  const [mode, setMode] = useState('phone'); // 'phone' (motorista) | 'email' (admin)
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const email = mode === 'phone' ? phoneToInternalEmail(identifier) : identifier;
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (authError) {
      setError(mode === 'phone' ? 'Telefone ou senha inválidos.' : 'Email ou senha inválidos.');
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>PRC App</h1>
        <p className="subtitle">Controle de Viagens</p>

        <div className="mode-switch">
          <button
            type="button"
            className={mode === 'phone' ? 'active' : ''}
            onClick={() => { setMode('phone'); setIdentifier(''); setError(''); }}
          >
            Sou Motorista
          </button>
          <button
            type="button"
            className={mode === 'email' ? 'active' : ''}
            onClick={() => { setMode('email'); setIdentifier(''); setError(''); }}
          >
            Sou Administrador
          </button>
        </div>

        <form onSubmit={handleLogin}>
          {mode === 'phone' ? (
            <input
              type="tel"
              placeholder="Telefone (ex: 11999998888)"
              value={identifier}
              onChange={(e) => setIdentifier(cleanPhone(e.target.value))}
              required
            />
          ) : (
            <input
              type="email"
              placeholder="Email"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          )}
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="error-text">{error}</p>}
          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
