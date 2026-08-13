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
`icon-192.png` (192×192) e `icon-512.png` (512×512). Gere-os a
partir de qualquer imagem quadrada (ex.: em
[realfavicongenerator.net](https://realfavicongenerator.net)) e
coloque na pasta `icons/`. Sem eles o app funciona normalmente no
navegador — só não terá ícone customizado ao instalar.

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
js/calendar.js          cálculo de datas, streak e renderização das 3 visões
js/habits.js            lista de hábitos, modal de criar/editar, seleção
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
