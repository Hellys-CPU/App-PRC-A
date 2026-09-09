import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import AdminNav from '../components/AdminNav.jsx';
import { useToast } from '../components/Toast.jsx';

export default function AdminMySecurity() {
  const [factors, setFactors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState(null);
  const [factorId, setFactorId] = useState(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const toast = useToast();

  useEffect(() => { loadFactors(); }, []);

  async function loadFactors() {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (!error) setFactors(data?.totp || []);
    setLoading(false);
  }

  async function startEnroll() {
    setEnrolling(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    setEnrolling(false);

    if (error) {
      toast('Erro ao iniciar 2FA: ' + error.message, 'error');
      return;
    }
    setQrCode(data.totp.qr_code);
    setFactorId(data.id);
  }

  async function confirmEnroll() {
    if (verifyCode.length !== 6) {
      toast('Digite o código de 6 dígitos do seu app autenticador.', 'error');
      return;
    }
    setVerifying(true);

    const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeErr) {
      setVerifying(false);
      toast('Erro: ' + challengeErr.message, 'error');
      return;
    }

    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code: verifyCode,
    });

    setVerifying(false);

    if (verifyErr) {
      toast('Código inválido — confira o app autenticador e tente de novo.', 'error');
      return;
    }

    toast('2FA ativado com sucesso!', 'success');
    setQrCode(null);
    setFactorId(null);
    setVerifyCode('');
    loadFactors();
  }

  async function removeFactor(id) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) {
      toast('Erro ao remover: ' + error.message, 'error');
      return;
    }
    toast('2FA removido.', 'success');
    loadFactors();
  }

  return (
    <div className="admin-container">
      <AdminNav />
      <h1 className="page-title">Segurança da Minha Conta</h1>
      <p className="subtitle" style={{ textAlign: 'left', marginBottom: 24 }}>
        Autenticação em duas etapas — exige um código do celular além da senha pra entrar.
      </p>

      {loading && <p className="empty-state">Carregando...</p>}

      {!loading && factors.length > 0 && (
        <div className="motorista-form" style={{ maxWidth: 480 }}>
          <p style={{ color: 'var(--route)', fontWeight: 600 }}>✓ 2FA ativado nesta conta</p>
          <button className="secondary-button" onClick={() => removeFactor(factors[0].id)}>
            Desativar 2FA
          </button>
        </div>
      )}

      {!loading && factors.length === 0 && !qrCode && (
        <div className="motorista-form" style={{ maxWidth: 480 }}>
          <p className="subtitle" style={{ textAlign: 'left', marginBottom: 12 }}>
            Use um app tipo Google Authenticator ou Microsoft Authenticator no celular.
          </p>
          <button className="primary-button" onClick={startEnroll} disabled={enrolling}>
            {enrolling ? 'Gerando...' : 'Ativar 2FA'}
          </button>
        </div>
      )}

      {qrCode && (
        <div className="motorista-form" style={{ maxWidth: 480 }}>
          <p className="subtitle" style={{ textAlign: 'left', marginBottom: 12 }}>
            Escaneie esse QR code no app autenticador, depois digite o código de 6 dígitos gerado.
          </p>
          <div style={{ background: '#fff', padding: 16, marginBottom: 16, display: 'inline-block' }}
               dangerouslySetInnerHTML={{ __html: qrCode }} />
          <label>Código de 6 dígitos</label>
          <input
            type="text"
            maxLength={6}
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
          />
          <button className="primary-button" style={{ marginTop: 12 }} onClick={confirmEnroll} disabled={verifying}>
            {verifying ? 'Confirmando...' : 'Confirmar e Ativar'}
          </button>
        </div>
      )}
    </div>
  );
}
