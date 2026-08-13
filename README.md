# Haimë — caderno de hábitos

*Haimë* (Quenya: "hábito") — caderno pessoal de hábitos (construir ou
abandonar), com Firebase Firestore como banco de dados por usuário e
login por e-mail/senha ou Google. Site estático, feito para rodar no
GitHub Pages.

## O que ele faz

- Quantos hábitos você quiser, cada um com nome, ícone e cor próprios.
- Dois objetivos por hábito: **construir** (ex.: beber água, ler) ou
  **abandonar** (ex.: fumar, redes sociais) — a sequência (streak) é
  calculada de forma invertida para hábitos a abandonar (dias limpos
  em vez de dias marcados).
- Dois tipos de marcação: **check diário** (sim/não) ou **contagem**
  (várias vezes por dia, com meta diária opcional).
- Três visões: **Semana**, **Mês** e **Heatmap de 6 meses** (estilo
  "contribuições", semanas × dias da semana).
- **Visão geral**: uma aba separada (acima da lista de hábitos)
  mostrando **todos os hábitos juntos**, lado a lado, em três
  formatos: **Semana**, **4 semanas** e **Semestral** (26 semanas
  agregadas). Dá pra marcar o dia direto por ali também.
- **Configurações** (ícone de engrenagem no topo): escolha entre
  tema **claro** ou **escuro**, e 6 opções de **cor de fundo**
  (Ardósia, Marfim, Bruma, Musgo, Ameixa, Carvão). A preferência
  fica salva no navegador do aparelho.
- **Backup**: automático (no máximo 1x a cada 24h, silencioso, grava
  por cima do mesmo documento no Firestore) e manual (grava um
  documento novo no Firestore **e** baixa um `.json` no aparelho).
- **Exportar em PDF**: gera um relatório visual com nome, sequência
  atual e um mini-heatmap de ~12 semanas de cada hábito.
- Multiusuário: cada pessoa que criar conta (e-mail/senha ou Google)
  tem seus próprios hábitos, isolados pelas regras do Firestore.
- Funciona como PWA (pode "instalar" no celular/computador).

## 1. Criar o projeto no Firebase

1. Acesse [console.firebase.google.com](https://console.firebase.google.com)
   e crie um projeto novo (pode desativar o Google Analytics, não é
   necessário).
2. Em **Build → Authentication → Sign-in method**, ative:
   - **E-mail/senha**
   - **Google**
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

## 3. Ícones do PWA (opcional)

O `manifest.json` espera dois arquivos em `icons/`:
`icon-192.png` (192×192) e `icon-512.png` (512×512). Eles já vêm
prontos neste projeto — só troque se quiser um ícone diferente.

## Solução de problemas: login/cadastro não funciona

Se "Criar conta" ou "Continuar com Google" não fizer nada visível
ou der erro, siga esta ordem (o app agora mostra o **código do erro**
embaixo do formulário — ele diz exatamente qual desses itens é):

1. **Abriu o arquivo direto do computador?** Se a barra de endereço
   mostra `file:///...`, o Firebase Auth não funciona assim — o app
   já mostra um aviso amarelo na tela de login nesse caso. Teste
   pelo link do GitHub Pages, ou sirva localmente
   (`npx serve .` na pasta do projeto e abra `http://localhost:3000`).
2. **E-mail/senha e Google estão ativados?** Firebase Console →
   **Authentication → Sign-in method** → confira se os dois
   provedores aparecem como "Ativado". Se não, é isso — erro
   `auth/operation-not-allowed` ou `auth/configuration-not-found`.
3. **O domínio está autorizado?** Firebase Console →
   **Authentication → Settings → Authorized domains** → precisa
   conter `SEU-USUARIO.github.io` (e `localhost`, se for testar
   local). Sem isso o erro é `auth/unauthorized-domain`.
4. **Pop-up bloqueado?** O botão do Google abre uma janela pop-up;
   se o navegador bloquear, aparece `auth/popup-blocked` — libere
   pop-ups para o site e tente de novo.
5. **Conta criada mas apareceu erro mesmo assim?** Isso costuma
   significar que o login funcionou, mas a gravação do perfil no
   Firestore falhou — normalmente porque as regras de
   `firestore.rules` ainda não foram publicadas (passo 4 da seção
   "Criar o projeto no Firebase" acima), ou porque o banco de dados
   do Firestore ainda não foi criado.
6. Se nada disso resolver, abra o **console do navegador** (F12 →
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
  name, email

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
```

Um dia "não marcado" simplesmente não tem documento em `logs` — é
por isso que hábitos a **abandonar** funcionam de forma invertida:
ausência de registro = dia limpo.

## Estrutura de arquivos

```
index.html              tela de login + app
css/style.css           todo o visual
js/firebase-config.js   suas credenciais do Firebase (edite este arquivo)
js/auth.js              login/cadastro por e-mail e por Google
js/db.js                leitura/escrita no Firestore
js/toast.js             notificação flutuante curta (usada por backup/PDF)
js/settings.js          tema (claro/escuro) e paleta de cor de fundo
js/panel-router.js      controla qual painel principal está visível
js/overview.js          aba "Visão geral" (todos os hábitos juntos)
js/calendar.js          cálculo de datas, streak e renderização das 3 visões
js/habits.js            lista de hábitos, modal de criar/editar, seleção
js/backup.js            backup automático (24h) e manual no Firestore
js/pdfexport.js         relatório visual em PDF (usa jsPDF via CDN)
js/data-tools.js        liga os botões de backup/PDF em Configurações
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
