# Plano da F2: segurança, assistente, voz e OuviAí

> Versão **0.1** · 11/11/2026 · Ian · **Para aprovar antes de codar.**
> Base: `PLANO-FRONT.md` (3.1, 7, 8 e 11), `CONTRATOS.md` v0.6 (B, G, H, J, L) e o que ficou pronto na F1.
> Assistente (RAG) e voz são do parceiro: o front é feito agora contra os **mocks** da API e passa a usar o módulo real sem mudar nada, só trocando o provider.

## 1. Objetivo

Fechar o app do cidadão. Ao fim da F2, o app tem estas quatro partes:

1. **Emergência completa.** Funciona no reporte, no chat e na voz. Tem saída rápida e discreta para violência doméstica.
2. **Tirar dúvida.** Chat com o assistente, que mostra as fontes, diz "não sei" quando não tem base e pergunta "Isso ajudou?".
3. **Falar.** A pessoa aperta, fala e ouve a resposta. A tela mostra a transcrição e quanto tempo a resposta levou.
4. **Alerta OuviAí.** Um aviso visual com vibração quando o celular do IoT ouve uma sirene ou uma buzina.

Cada parte cobre uma matéria:

| Parte | Matéria |
|---|---|
| Emergência | Governança/GenAI (guardrail) |
| Chat | GenAI/RAG |
| Voz | PLN |
| Alerta | IoT |

No barema do Front, a F2 completa a acessibilidade (voz e alerta para surdos) e o HITL no chat.

## 2. Telas

| # | Tela | O que aparece | Chamadas | Componentes |
|---|---|---|---|---|
| 1 | **Emergência (completa)** | Tudo o que já existe na F1, mais o que está listado abaixo da tabela | `POST /guardrail/nao-e-emergencia` | `TelaEmergencia` (sai de `features/reportar` e vira reutilizável), `SaidaRapida` (novo), `BotaoEmergencia` |
| 2 | **Tirar dúvida** (`/assistente`) | Vazio: 4 perguntas de exemplo para tocar. Conversa: balões da pessoa e do assistente. Cada resposta tem as **fontes citadas** (título, link e trecho que abre e fecha), "Ouvir" e "Isso ajudou?". `sem_fonte`: aviso "Não achei isso nas fontes oficiais" + 156. `fora_do_tema`: recusa educada. Botões "Limpar conversa" e "Quer reportar um problema? Reportar" | `POST /assistente/perguntar` (com histórico), `POST /feedback` | `Conversa` e `Balao` (novos), `FontesCitadas` (novo), `Feedback`, `useFala` |
| 3 | **Falar** (na mesma tela do chat, botão de microfone grande) | Na primeira vez, um **aviso de consentimento**: "seu áudio vai para o servidor, é transcrito e apagado". Depois: tocar para falar, contador até 60 s, tocar para enviar. A transcrição aparece como balão da pessoa, a resposta como balão do assistente e o áudio toca sozinho (ou a voz do navegador, se vier sem áudio). Cada resposta mostra uma linha pequena "respondeu em 3,4 s" | `POST /voz/conversar` | `BotaoGravar` (novo), `useGravador` (novo, MediaRecorder) |
| 4 | **Alerta OuviAí** (em qualquer tela do cidadão) | Faixa no topo: ícone + "Sirene por perto" + hora, cor de atenção, **vibração**, lida pelo leitor de tela. Botões "Entendi" e "Desligar avisos". Some sozinha depois de 60 s | `GET /iot/eventos?limite=5` a cada 5 s, só com a aba visível | `AlertaSom` (novo), estado `avisosSom` |

O que a emergência completa ganha em relação à F1:
- Aparece **também no chat e na voz**, e não só no reporte.
- Quando `saida_rapida` (violência doméstica), aparece o botão fixo **"Sair rápido"**, que também funciona com a tecla Esc. Ele faz três coisas:
  - abre uma página neutra no lugar do app, sem deixar o app no "voltar";
  - apaga o rascunho e a conversa;
  - não toca som nenhum.
- O texto da tela vem do `docs/design-system/componentes` (emergência).

Mudanças pequenas na tela inicial e no topo:
- **"Falar"** na tela inicial abre o Falar (conversa por voz), e não mais o ditado do reporte. O microfone do reporte continua lá para ditar a descrição.
- A barra do topo ganha o botão **"Avisos de som"** (liga e desliga), ao lado dos temas.

## 3. Falhas e validação

| Situação | O que acontece |
|---|---|
| Pergunta com menos de 3 letras | Erro no campo, sem desabilitar o botão |
| API fora do ar no chat | O balão da pessoa fica com "Não enviada · Tentar de novo" e o texto não se perde. O aviso indica o 156 |
| Navegador sem microfone ou permissão negada | O botão explica como liberar e oferece digitar (não some) |
| Áudio com mais de 60 s | Para sozinho aos 60 s e envia |
| Voz falha | "Não entendi o áudio. Tente de novo ou digite." |
| Resposta sem áudio | Usa a voz do navegador (`useFala`) |
| Guardrail nível 1 ou 2 no chat ou na voz | Abre a `TelaEmergencia` no lugar da resposta. A conversa não guarda essa mensagem |
| OuviAí sem resposta | Fica em silêncio (não atrapalha o resto do app). A consulta pausa quando a aba sai de vista |

## 4. Estado

- **Conversa** (já existe na F0): passa a ser usada de verdade. Guarda as últimas 20 mensagens e manda o histórico em cada pergunta. É apagada na saída rápida e em "Limpar conversa".
- **Consentimento de voz** e **avisos de som (liga/desliga)** ficam no estado central e salvos no aparelho.
- **Último alerta visto** fica em memória, para não repetir o mesmo aviso.

## 5. Componentes novos (reutilizáveis)

| Componente | Reaproveitado em |
|---|---|
| `TelaEmergencia` + `SaidaRapida` | Reporte, chat, voz |
| `Conversa` / `Balao` / `FontesCitadas` | Chat e voz. Na F3, o "porquê" da IA no console |
| `BotaoGravar` + `useGravador` | Voz. Também serviria para o OuviAí no navegador, se um dia precisar |
| `AlertaSom` | App do cidadão. Na F3, uma faixa igual no console |

## 6. Como vou testar

- Playwright com microfone falso do Chromium. Os caminhos testados são:
  - chat com fonte;
  - chat sem fonte;
  - chat fora do ar;
  - emergência pelo chat;
  - violência doméstica com "Sair rápido";
  - voz com o mock;
  - voz com permissão negada;
  - alerta OuviAí disparado por um `POST /iot/eventos`.
- Tudo nos 3 temas, no celular e no desktop. Os prints vão para `docs/evidencias/f2/`.
- Acrescento os casos do chat e da voz em `CASOS-TESTE-IA.md`.
- `npm run build`, `npm run lint`, `tsc` e os testes da API passando.

## 7. Para o Ian decidir

1. **Contrato v0.7, com duas adições que não quebram nada.**
   - (a) A resposta do assistente e da voz ganha o campo `guardrail` (igual ao do reporte). Hoje, quando o chat detecta uma emergência, a API devolve só um texto, e o front não tem como mostrar o botão de ligar nem a saída rápida.
   - (b) A voz passa a aceitar `audio/mp4`, que é o formato que o **iPhone** grava. Sem isso, a voz não funciona no Safari.
   - Os dois mexem no router que é comum ao parceiro, mas não mudam o que ele faz no RAG e na voz.
   - **Recomendo sim.**
2. **O "Falar" da tela inicial** abre a conversa por voz (PLN) e não mais o ditado do reporte. **Recomendo sim**: a matéria de PLN precisa da conversa por voz aparecendo, e o ditado continua no reporte.
3. **Destino do "Sair rápido"**: uma busca neutra do Google ("previsão do tempo"), abrindo no lugar do app. **Recomendo isso**, porque é o padrão usado por serviços de apoio a vítimas. A alternativa seria uma página falsa dentro do app, mas ela continuaria no histórico.
4. **Avisos do OuviAí** vêm **ligados** por padrão, com "Desligar avisos" na própria faixa. **Recomendo ligados**: é o que aparece no vídeo, e quem precisa do aviso (surdos) não deveria ter que procurar onde ligar.

## 8. Prazo

11 e 12/11. A ordem é:
1. Contrato v0.7 na API.
2. Emergência completa.
3. Chat.
4. Voz.
5. OuviAí.
6. Testes e prints.

## 9. Observações

- A pasta agora se chama `Quem_resolve` e já tem um repositório Git apontando para `GS-Citizen-Tech/quem-resolve`. Posso trabalhar direto nele, com uma branch e um pull request por fase, se você quiser. Até lá, continuo copiando os arquivos para a pasta.
- A reserva multimodal (v0.6) já está no front pela thread de VC: `FotoComDeteccoes` mostra a descrição quando a detecção não tem caixa. A F2 não mexe nisso.
