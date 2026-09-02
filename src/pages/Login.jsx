import React, { useState } from 'react';
import { supabase, cpfToInternalEmail, cleanCpf } from '../supabase';
import ThemeToggle from '../components/ThemeToggle.jsx';
import Brand from '../components/Brand.jsx';

export default function Login() {
  const [mode, setMode] = useState('cpf'); // 'cpf' (motorista) | 'email' (admin)
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const email = mode === 'cpf' ? cpfToInternalEmail(identifier) : identifier;
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (authError) {
      setError(mode === 'cpf' ? 'CPF ou senha inválidos.' : 'Email ou senha inválidos.');
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-theme-toggle"><ThemeToggle /></div>
        <Brand subtitle="Transportadora" />
        <p className="subtitle">Central de Operações — acompanhamento de viagens</p>

        <div className="mode-switch">
          <button
            type="button"
            className={mode === 'cpf' ? 'active' : ''}
            onClick={() => { setMode('cpf'); setIdentifier(''); setError(''); }}
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
          {mode === 'cpf' ? (
            <input
              type="text"
              inputMode="numeric"
              placeholder="CPF (somente números)"
              value={identifier}
              onChange={(e) => setIdentifier(cleanCpf(e.target.value))}
              maxLength={11}
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
