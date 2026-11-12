"use client";
// Entrar no console (login do gestor). Erro no campo, sem apagar o usuário. Depois volta para onde a pessoa ia.
import { LogIn } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { api, definirToken, ErroAPI } from "@/providers/api";
import { useAppState } from "@/state/AppState";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { CampoTexto } from "@/ui/CampoTexto";
import { Painel } from "@/ui/Vidro";

/** Só volta para telas do console (evita mandar a pessoa para fora do app). */
const destinoSeguro = (v: string | null) => (v && v.startsWith("/gestao") && !v.startsWith("/gestao/entrar") ? v : "/gestao");

export function Entrar() {
  const params = useSearchParams();
  const router = useRouter();
  const { despachar } = useAppState();
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erros, setErros] = useState<{ usuario?: string; senha?: string; geral?: string }>({});
  const [enviando, setEnviando] = useState(false);
  const expirou = params.get("expirou") !== null;

  // Veio de uma sessão que expirou (401): apaga a sessão velha deste aparelho.
  useEffect(() => { if (expirou) { definirToken(null); despachar({ tipo: "logout" }); } }, [expirou, despachar]);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    const faltando = { usuario: usuario.trim() ? undefined : "Digite seu usuário.", senha: senha ? undefined : "Digite sua senha." };
    if (faltando.usuario || faltando.senha) { setErros(faltando); return; }
    setEnviando(true);
    setErros({});
    try {
      const sessao = await api.login(usuario.trim(), senha);
      definirToken(sessao.token); // já vale para a primeira busca da próxima tela
      despachar({ tipo: "login", sessao });
      router.replace(destinoSeguro(params.get("volta")));
    } catch (err) {
      const e2 = err instanceof ErroAPI ? err : null;
      if (e2?.tipo === "login") setErros({ senha: "Usuário ou senha incorretos." });
      else setErros({ geral: e2?.mensagem ?? "Não conseguimos entrar agora. Tente de novo." });
      setSenha("");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Painel as="div" className="mx-auto mt-4 grid w-full max-w-md gap-5">
      <div className="grid gap-1">
        <h1 className="text-[26px] leading-8 font-medium tracking-[-0.03em]">Entrar no console</h1>
        <p className="text-ink-muted">Para servidores públicos que tratam as ocorrências.</p>
      </div>
      {expirou && (
        <Aviso tipo="info" titulo="Sua sessão terminou">Entre de novo para continuar de onde parou.</Aviso>
      )}
      {erros.geral && <Aviso tipo="danger" titulo="Não deu para entrar">{erros.geral}</Aviso>}
      <form onSubmit={enviar} noValidate className="grid gap-4">
        <CampoTexto id="usuario" rotulo="Usuário" autoComplete="username" value={usuario} erro={erros.usuario}
          onChange={(e) => setUsuario(e.target.value)} autoCapitalize="none" spellCheck={false} />
        <CampoTexto id="senha" rotulo="Senha" type="password" autoComplete="current-password" value={senha} erro={erros.senha}
          onChange={(e) => setSenha(e.target.value)} />
        <Botao type="submit" icone={LogIn} bloco aria-busy={enviando || undefined}>{enviando ? "Entrando…" : "Entrar"}</Botao>
      </form>
      <div className="rounded-card bg-info-soft px-4 py-3 text-base hc:border-2 hc:border-line-strong">
        <p className="font-semibold text-info">Login de demonstração</p>
        <p><strong>marina</strong> / demo-123 (Subprefeitura) ou <strong>joao</strong> / demo-123 (Sabesp)</p>
      </div>
    </Painel>
  );
}
