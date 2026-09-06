// Validação real de CPF (dígitos verificadores), não só "tem 11 números".
// Usado no cadastro de motorista pra recusar CPF inválido/inventado.
export function isValidCPF(cpf) {
  const digits = String(cpf).replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false; // ex: 11111111111

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i], 10) * (10 - i);
  let rev = 11 - (sum % 11);
  if (rev >= 10) rev = 0;
  if (rev !== parseInt(digits[9], 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i], 10) * (11 - i);
  rev = 11 - (sum % 11);
  if (rev >= 10) rev = 0;
  if (rev !== parseInt(digits[10], 10)) return false;

  return true;
}
