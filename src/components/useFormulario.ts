import { useState, useCallback } from 'react';

/**
 * Estado simples para formulários em modal.
 * `abrir(valores)` define os valores iniciais (novo ou edição) e abre o modal.
 */
export function useFormulario<T extends object>(vazio: () => T) {
  const [valores, setValores] = useState<T>(vazio);
  const [aberto, setAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const abrir = useCallback(
    (inicial?: Partial<T> & { id?: string }) => {
      const { id, ...resto } = (inicial ?? {}) as Partial<T> & { id?: string };
      setValores({ ...vazio(), ...(resto as Partial<T>) });
      setEditandoId(id ?? null);
      setAberto(true);
    },
    [vazio],
  );

  const fechar = useCallback(() => setAberto(false), []);

  const campo = useCallback(
    <K extends keyof T>(chave: K) => ({
      value: (valores[chave] ?? '') as unknown as string | number,
      onChange: (e: { target: { value: string; type?: string } }) => {
        const bruto = e.target.value;
        const atual = valores[chave];
        const valor = typeof atual === 'number' || e.target.type === 'number' ? (bruto === '' ? 0 : Number(bruto)) : bruto;
        setValores((v) => ({ ...v, [chave]: valor }));
      },
    }),
    [valores],
  );

  const definir = useCallback(<K extends keyof T>(chave: K, valor: T[K]) => {
    setValores((v) => ({ ...v, [chave]: valor }));
  }, []);

  return { valores, aberto, editandoId, abrir, fechar, campo, definir, setValores };
}
