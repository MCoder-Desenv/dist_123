export const buscarCEP = async (cep: string) => {
  const cepOnly = String(cep).replace(/\D/g, '');
  if (cepOnly.length !== 8) {
    throw new Error('CEP inválido (deve conter 8 dígitos).');
  }

  const url = `https://viacep.com.br/ws/${cepOnly}/json/`;
  // ViaCEP: https://viacep.com.br/
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`Erro na requisição (status ${res.status})`);
    }
    const data = await res.json();
    if (data?.erro) {
      throw new Error('CEP não encontrado');
    }
    return data;
  } catch (err) {
    console.error('Erro ao buscar o CEP:', err);
    throw err;
  }
};