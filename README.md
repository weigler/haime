# Haimë — caderno de hábitos

*Haimë* (Quenya: "hábito") — caderno pessoal de hábitos (construir ou
abandonar), com Firebase Firestore como banco de dados por usuário e
login por e-mail/senha. Site estático, feito para rodar no
GitHub Pages.

## O que ele faz

- Quantos hábitos você quiser, cada um com nome, ícone e cor próprios.
- Dois objetivos por hábito: **construir** (ex.: beber água, ler) ou
  **abandonar** (ex.: fumar, redes sociais) — a sequência (streak) é
  calculada de forma invertida para hábitos a abandonar (dias limpos
  em vez de dias marcados).
- Dois tipos de marcação: **check diário** (sim/não) ou **contagem**
  (várias vezes por dia, com meta diária opcional).
- Três visões por hábito: **Semana**, **Mês** (matriz rolante das
  últimas 4 semanas) e **Semestral** (matriz de 24 semanas, um
  quadradinho por dia — estilo "contribuições").
- **Timer**: sessão de foco com predefinições (5/15/25/45/60 min)
  ou minutos personalizados, opcionalmente vinculada a um hábito
  (ao terminar, marca o hábito automaticamente). Toca um som e
  tenta mostrar uma notificação ao final, e guarda um histórico das
  últimas sessões concluídas.
- **Metas**: objetivos de longo prazo, separados dos hábitos do
  dia a dia — título, descrição opcional, prazo opcional, e uma
  barra de progresso manual (0–100%). Pode vincular a meta a um
  hábito só como referência visual.
- **Privacidade dos nomes**: os nomes de hábitos, tarefas (incluindo
  sub-itens) e metas (título e descrição) ficam cifrados no
  Firestore — quem abrir o documento direto no console vê só um
  texto sem sentido tipo `encv1:Jp5V...`, não o conteúdo real. A
  chave é derivada automaticamente do UID de cada pessoa, sem pedir
  senha nenhuma — funciona sozinho, sem risco de perder acesso, e
  não muda se a pessoa trocar o nome de exibição. **Importante**:
  isso protege contra ver o conteúdo por acidente ao navegar pelos
  dados — não é uma defesa contra um ataque deliberado por alguém
  com acesso ao código-fonte e ao banco ao mesmo tempo. Números,
  datas e progresso continuam em texto normal (não são muito
  reveladores sozinhos, e cifrá-los quebraria ordenação/filtros).
  Dados criados antes dessa proteção existir ficam em texto livre
  até serem editados — ou até você clicar em "Cifrar dados
  existentes" em Configurações → Privacidade, que cifra tudo que
  ainda estiver pendente.
- **Perfil**: em Configurações, defina um nome de exibição (usado no
  topo do app e no chip de usuário) e uma foto opcional. O e-mail
  aparece só como referência, sem opção de trocar por aqui — trocar
  e-mail de login é uma operação sensível do Firebase Auth e fica de
  fora por segurança; para isso, oriento a criar uma conta nova.
  Sem Firebase Storage configurado, a foto é comprimida no navegador
  (até ~160×160px) e guardada como texto no próprio documento do
  usuário no Firestore — funciona bem para uma foto de perfil, mas
  não é o ideal para imagens grandes.
- **Restaurar backup**: em Configurações → Backup no Firestore, cada
  backup salvo (automático ou manual) aparece numa lista com data e
  quantidade de hábitos, com um botão "Restaurar". A restauração
  regrava os hábitos e todo o histórico exatamente como estavam
  naquele backup, mas não apaga hábitos criados depois — é um
  "mesclar de volta", não uma substituição total, para reduzir risco
  de perda por engano.
- **Tarefas com prazo e prioridade**: cada tarefa pode ter uma
  data de vencimento e uma prioridade (Alta/Média/Baixa), editáveis
  pelo ícone 🗓 na linha da tarefa. A lista se reordena sozinha:
  prioridade mais alta e prazo mais próximo primeiro, concluídas no
  fim. Tarefas atrasadas ganham destaque vermelho e disparam o
  aviso "N tarefas atrasadas" na aba Hoje.
- **Quadrados maiores e consistentes**: nas visões Mês e Semestral
  (tanto por hábito quanto na Visão geral), a grade agora ocupa
  sempre a largura total disponível — os quadrados crescem ou
  encolhem para caber, sem precisar de rolagem lateral. Hábitos de
  contagem mostram o multiplicador (ex.: "2x") direto no quadrado,
  igual à visão semanal.
- **Hoje**: uma tela inicial estilo painel — círculo com a data,
  faixa da semana (toque num dia pra ver/marcar aquele dia), lista
  rápida dos hábitos do dia (check, "+", ou distintivo de sequência
  limpa pra hábitos a abandonar) e das tarefas pendentes. É a
  primeira tela ao entrar, igual ao app de referência (sem os
  blocos de "Bonus Quest" e "PRO").
- **Barra de abas no celular/tablet**: em telas estreitas (até
  900px), a barra lateral vira uma barra de abas fixa embaixo —
  Hoje, Hábitos, Tarefas e Mais (que abre Visão geral, Configurações
  e Sair). No desktop, a navegação continua pela barra lateral.
- **Arquivar hábitos**: no menu de editar um hábito (ícone ✎), o
  botão "Arquivar" tira o hábito das listas principais sem apagar o
  histórico. Hábitos arquivados ficam numa seção recolhível
  "Arquivados" no fim da barra lateral, com um botão "↺" para
  desarquivar a qualquer momento.
- **Tarefas**: uma aba simples de lista de afazeres, abaixo de
  "Visão geral". Cada tarefa pode ficar sozinha (um check) ou virar
  um mini-checklist com sub-itens (ex.: uma tarefa "Mercado" com
  "leite", "pão", "ovos" dentro, cada um com seu próprio check).
- Mais de 70 ícones para escolher ao criar um hábito, agrupando
  saúde, leitura, filmes/séries, caminhada/exercício, casa,
  hobbies, natureza e mais.
- **Visão geral**: uma aba separada (acima da lista de hábitos)
  mostrando **todos os hábitos juntos**, cada um com seu próprio
  mini-calendário, em três formatos: **Semana** (tira de 7 dias),
  **Mensal** (semanas do mês corrente em colunas, 7 dias em linha)
  e **Semestral** (24 semanas em colunas, 7 dias em linha). Dá pra
  marcar o dia direto por ali também.
- **Configurações** (ícone de engrenagem no topo): escolha entre
  tema **claro** ou **escuro**, e 6 opções de **cor de fundo**
  (Ardósia, Marfim, Bruma, Musgo, Ameixa, Carvão). A preferência
  fica salva no navegador do aparelho.
- **Backup**: automático (no máximo 1x a cada 24h, silencioso, grava
  por cima do mesmo documento no Firestore) e manual (grava um
  documento novo no Firestore **e** baixa um `.json` no aparelho).
- **Exportar em PDF**: gera um relatório visual com nome, sequência
  atual e um mini-heatmap de ~12 semanas de cada hábito.
- Login só por e-mail/senha, com uma lista de autorização opcional
  (allowlist) para controlar quem pode criar conta — ver seção 3.
  Multiusuário: cada conta tem seus próprios hábitos, isolados
  pelas regras do Firestore.
- Funciona como PWA (pode "instalar" no celular/computador).

## 1. Criar o projeto no Firebase

1. Acesse [console.firebase.google.com](https://console.firebase.google.com)
   e crie um projeto novo (pode desativar o Google Analytics, não é
   necessário).
2. Em **Build → Authentication → Sign-in method**, ative
   **E-mail/senha**.
3. Em **Build → Firestore Database**, clique em **Criar banco de
   dados** (modo produção, escolha a região mais próxima, ex.:
   `southamerica-east1`).
4. Em **Firestore Database → Regras**, apague o conteúdo padrão e
   cole o conteúdo do arquivo `firestore.rules` deste projeto.
   Clique em **Publicar**.
5. Em **Configurações do projeto (ícone de engrenagem) → Geral**,
   role até "Seus apps" e clique no ícone `</>` para adicionar um
   app da Web. Dê um nome (ex.: "diario-web") e **não** marque
   Firebase Hosting (vamos usar o GitHub Pages).
6. O Firebase vai mostrar um objeto `firebaseConfig`. Copie os
   valores para dentro de `js/firebase-config.js`, substituindo os
   textos `COLE_AQUI_SUA_API_KEY` etc.
7. Em **Authentication → Settings → Authorized domains**, adicione o
   domínio que o GitHub Pages vai usar, por exemplo:
   `weigler.github.io` (sem `https://` e sem barra no final).

## 2. Publicar no GitHub Pages

1. Crie um repositório novo no GitHub (ex.: `habit-tracker`) e suba
   todos os arquivos desta pasta para a raiz do repositório
   (`index.html` deve ficar na raiz, ou em `/docs` se preferir — só
   ajuste a configuração do Pages de acordo).
2. No repositório, vá em **Settings → Pages**, escolha a branch
   `main` e a pasta (`/` ou `/docs`), salve.
3. Em alguns minutos o app estará em
   `https://SEU-USUARIO.github.io/habit-tracker/`.

## 3. Controlar quem pode criar conta (allowlist)

Por padrão, "Criar conta" fica aberto para qualquer pessoa que
tenha o link do app — não existe aprovação manual embutida no
Firebase Auth para isso. O Haimë já vem com um sistema simples de
lista de autorização, mas ele só passa a valer quando você o
configura:

1. No Firebase Console, vá em **Firestore Database → Dados**.
2. Crie uma coleção chamada `config`.
3. Dentro dela, crie um documento com o ID exatamente `allowlist`.
4. Nesse documento, adicione um campo `emails` do tipo **array**,
   e coloque os e-mails autorizados (minúsculo, ex.:
   `["voce@gmail.com", "outrapessoa@gmail.com"]`).
5. Salve.

A partir daí, toda tentativa de cadastro ou login com um e-mail
fora dessa lista é barrada automaticamente: a conta chega a ser
criada no Firebase Auth, mas o app desloga na hora e mostra o
aviso "este e-mail ainda não foi autorizado". Isso vale tanto para
quem está se cadastrando agora quanto para uma sessão antiga que
volta a abrir o app depois — a checagem roda em toda entrada, não
só no clique de "Criar conta".
**Enquanto o documento `config/allowlist` não existir, o acesso
fica livre** — é assim que o app funciona hoje, então crie esse
documento assim que quiser fechar o cadastro.

Para adicionar alguém depois, é só abrir o documento no console e
acrescentar o e-mail no array `emails`. Para tirar o acesso de
alguém, é só remover o e-mail do array — na próxima vez que essa
pessoa abrir o app (ou recarregar a página), ela é desconectada.

> **Importante:** a allowlist é uma trava no nível do aplicativo,
> não uma regra do Firestore. Ou seja, ela impede o uso do app,
> mas não é uma camada extra de segurança dos dados em si — quem
> já está autenticado só acessa os próprios dados de qualquer
> forma, graças às regras em `firestore.rules`.

### O Firebase avisa a pessoa por e-mail quando ela é autorizada?

Não automaticamente — a lista de autorização é só uma checagem no
seu código, o Firebase não sabe que ela existe, então não dispara
e-mail nenhum sozinho. Duas formas de resolver isso:

- **Mais simples (sem custo, sem configurar nada extra):** crie a
  conta da pessoa você mesmo, direto no Firebase Console
  (**Authentication → Users → Add user**, com um e-mail e uma senha
  provisória), adicione o e-mail dela na allowlist, e avise por
  fora (WhatsApp, etc.) que a conta já existe. Ou, se preferir que
  o próprio Firebase mande um e-mail, use a opção **"Reset
  password"** ao lado do usuário criado — o Firebase envia um
  e-mail de verdade com um link para a pessoa definir a própria
  senha, que funciona como um "convite" automático.
- **Mais elaborado (exige o plano Blaze e um provedor de e-mail
  próprio, tipo SendGrid):** instalar a extensão oficial "Trigger
  Email" do Firebase, que observa uma coleção do Firestore e manda
  um e-mail customizado sempre que um documento novo é criado —
  daria pra disparar automaticamente ao adicionar alguém na
  allowlist. É mais trabalho de configuração pra um app pessoal
  como este, mas existe se um dia fizer sentido.

## 4. Ícones do PWA (opcional)

O `manifest.json` espera dois arquivos em `icons/`:
`icon-192.png` (192×192) e `icon-512.png` (512×512). Eles já vêm
prontos neste projeto — só troque se quiser um ícone diferente.

## Correções recentes

- **Sequência de abandono com recaída retroativa**: bug real, achado
  a partir de um caso real reportado (registrar consumo de dias
  passados, antes mesmo de o hábito existir no app). A trava de "não
  recua antes da criação" agora também considera o registro mais
  antigo já feito, não só a data de criação — então marcar uma
  recaída antiga não trava mais a contagem de dias limpos antes da
  hora. 13 cenários testados, incluindo esse exato caso.
- **Recorte de foto de perfil**: agora, ao escolher uma foto, abre um
  recortador — arraste pra posicionar, use o zoom pra ajustar, veja
  exatamente o que vai ser salvo dentro do círculo antes de
  confirmar. Corrige o problema de fotos retangulares (principalmente
  tiradas na horizontal) salvando esticadas/no formato errado.

- **Sequência (streak) não contava os dias**: bug real, confirmado com
  14 testes automatizados. A trava que impedia a sequência de recuar
  antes da criação do hábito estava cortando um dia cedo demais —
  inclusive excluindo o próprio dia em que o hábito foi criado, mesmo
  com marcação válida nele. Como a maioria dos hábitos é recente,
  isso afetava quase todo mundo. Corrigido: a trava agora só se aplica
  a hábitos de abandonar (onde é realmente necessária), e compara
  datas de calendário em vez de horários exatos.
- **Perfil "trava" em Salvando…**: não consegui reproduzir isso nos
  meus testes (salva em menos de 1s), mas adicionei um limite de 15s
  de qualquer forma — se a gravação demorar mais que isso (rede ruim,
  falha silenciosa), agora aparece um aviso claro em vez de ficar
  preso pra sempre.
- **Quadrados do Mês no iPhone**: retestei do zero, na largura exata
  do iPhone, com o código atual — continua renderizando correto
  (quadrados pequenos, rótulos D/S/T/Q/Q/S/S bem espaçados). Se ainda
  estiver aparecendo errado depois de um recarregamento forçado, é
  bem provável que a versão nova não tenha chegado ainda no
  aparelho — veja "Solução de problemas" abaixo.
- **Rótulos do Mês**: em telas estreitas, os rótulos de dia da semana
  (Dom/Seg/Ter...) vazavam por cima da coluna vizinha quando o
  quadrado ficava pequeno. Agora usam uma letra só (D S T Q Q S S),
  igual ao Semestral.
- **Toque e segure**: hábitos de contagem agora aceitam "toque e
  segure" (~500ms) pra tirar uma marcação, além do clique direito no
  desktop — antes só funcionava com mouse.
- **Timer em segundo plano**: o app tenta impedir a tela de travar
  sozinha enquanto uma sessão está rodando (Wake Lock API, quando o
  navegador suporta), e o cálculo do tempo restante se autocorrige
  ao reabrir o app, mesmo se o navegador tiver pausado a contagem.
  Isso não elimina 100% a limitação — nenhum site roda com a tela
  travada — mas reduz bastante o problema.
- **Cache mais confiável**: o service worker agora busca a versão
  mais nova na rede primeiro, e só usa a cópia salva se estiver
  offline (antes era o contrário, o que causava a sensação de
  "atualizei mas não mudou nada").

## Solução de problemas: login/cadastro não funciona

Se "Criar conta" não fizer nada visível ou der erro, siga esta
ordem (o app agora mostra o **código do erro** embaixo do
formulário — ele diz exatamente qual desses itens é):

1. **Abriu o arquivo direto do computador?** Se a barra de endereço
   mostra `file:///...`, o Firebase Auth não funciona assim — o app
   já mostra um aviso amarelo na tela de login nesse caso. Teste
   pelo link do GitHub Pages, ou sirva localmente
   (`npx serve .` na pasta do projeto e abra `http://localhost:3000`).
2. **E-mail/senha está ativado?** Firebase Console →
   **Authentication → Sign-in method** → confira se aparece como
   "Ativado". Se não, é isso — erro `auth/operation-not-allowed`
   ou `auth/configuration-not-found`.
3. **O domínio está autorizado?** Firebase Console →
   **Authentication → Settings → Authorized domains** → precisa
   conter `SEU-USUARIO.github.io` (e `localhost`, se for testar
   local). Sem isso o erro é `auth/unauthorized-domain`.
4. **Conta criada mas apareceu erro mesmo assim?** Isso costuma
   significar que o login funcionou, mas a gravação do perfil no
   Firestore falhou — normalmente porque as regras de
   `firestore.rules` ainda não foram publicadas (passo 4 da seção
   "Criar o projeto no Firebase" acima), ou porque o banco de dados
   do Firestore ainda não foi criado.
5. Se nada disso resolver, abra o **console do navegador** (F12 →
   aba Console) e veja a linha que começa com `[Haimë auth]` — ela
   traz o erro completo do Firebase.

## Limites do Firestore no plano gratuito (Spark)

Só pra referência, ao usar o app no dia a dia: o Firestore free
tier permite **1 GiB de dados armazenados**, **50 mil leituras**,
**20 mil escritas** e **20 mil exclusões por dia**, e até **10 GiB**
de tráfego de saída por mês. Cada documento individual tem um
limite de 1 MiB. Um app pessoal como este — poucos hábitos, algumas
marcações por dia — fica muito longe desses limites; mesmo o backup
completo (hábitos + todo o histórico) normalmente não passa de
algumas dezenas ou centenas de KB. Se um dia isso mudar, os valores
atualizados estão sempre em
[firebase.google.com/pricing](https://firebase.google.com/pricing).

## Estrutura dos dados no Firestore

```
users/{uid}
  name         string (nome de exibição)
  email        string
  photoURL     string (data URL da foto comprimida) ou ausente
  lastBackupAt timestamp

users/{uid}/habits/{habitId}
  name        string
  icon        string (emoji)
  color       string (hex)
  goal        "build" | "quit"
  type        "check" | "count"
  target      number | null   (meta diária, só para type "count")
  archived    bool
  createdAt   timestamp

users/{uid}/habits/{habitId}/logs/{YYYY-MM-DD}
  value       number   (1 para check marcado; contagem do dia para "count")
  updatedAt   timestamp

users/{uid}/backups/{backupId}
  generatedAt  string (ISO)
  habits       objeto com uma "foto" de cada hábito + seus logs
  (backupId é "auto-latest" para o backup automático diário, ou
  "manual-<data>" para cada backup manual)

users/{uid}/tasks/{taskId}
  title       string
  done        bool     (usado só quando a tarefa NÃO tem sub-itens)
  items       array de { id, text, done }  (sub-itens, ex.: mercado)
  dueDate     string "YYYY-MM-DD" ou null
  priority    "high" | "medium" | "low" | null
  createdAt   timestamp

config/allowlist
  emails      array de strings (e-mails autorizados, minúsculo)
  (documento único, editado manualmente pelo console — ver seção 3)

users/{uid}/goals/{goalId}
  title          string
  description    string ou null
  targetDate     string "YYYY-MM-DD" ou null
  linkedHabitId  string (id do hábito) ou null
  progress       number (0–100)
  done           bool
  createdAt      timestamp

users/{uid}/focusSessions/{sessionId}
  minutes      number
  habitId      string ou null
  habitName    string ou null
  completedAt  timestamp
```

Um dia "não marcado" simplesmente não tem documento em `logs` — é
por isso que hábitos a **abandonar** funcionam de forma invertida:
ausência de registro = dia limpo.

## Estrutura de arquivos

```
index.html              tela de login + app
css/style.css           todo o visual
js/firebase-config.js   suas credenciais do Firebase (edite este arquivo)
js/auth.js              login/cadastro por e-mail e checagem da allowlist
js/db.js                leitura/escrita no Firestore
js/toast.js             notificação flutuante curta (usada por backup/PDF)
js/settings.js          tema (claro/escuro) e paleta de cor de fundo
js/panel-router.js      controla qual painel principal está visível
js/overview.js          aba "Visão geral" (todos os hábitos juntos)
js/tasks.js             aba "Tarefas" (to-do list com sub-itens)
js/today.js             aba "Hoje" (painel do dia: hábitos + tarefas)
js/timer.js             aba "Timer" (sessão de foco + histórico)
js/goals.js             aba "Metas" (objetivos de longo prazo)
js/mobile-nav.js        barra de abas fixa e menu "Mais" (celular/tablet)
js/calendar.js          cálculo de datas, streak e renderização das 3 visões
js/habits.js            lista de hábitos, modal de criar/editar, seleção
js/backup.js            backup automático (24h) e manual no Firestore
js/pdfexport.js         relatório visual em PDF (usa jsPDF via CDN)
js/data-tools.js        liga os botões de backup/PDF em Configurações
js/profile.js           perfil: nome, e-mail (só leitura) e avatar
js/crypto-fields.js      cifra/decifra nomes de hábitos/tarefas/metas (AES-GCM)
js/app.js               liga tudo: autenticação → tela do app
manifest.json, sw.js    PWA (instalação e cache básico offline)
firestore.rules         regras de segurança (cole no console do Firebase)
```

## Extensões possíveis

- Reordenar hábitos por arraste (o campo `order` já está previsto,
  falta a UI).
- Arquivar hábitos em vez de excluir (o campo `archived` já existe).
- Notas por dia (ex.: por que pulou o hábito).
- Exportar histórico em CSV.
