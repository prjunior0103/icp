# RUNBOOK — ICP em Docker

Guia prático para rodar, manter e migrar o **ICP** (Incentivo de Curto Prazo)
usando Docker. Escrito para quem entende de negócio e está aprendendo a parte
técnica — siga os passos na ordem.

---

## 1. O que é o sistema

O **ICP** é o sistema de gestão de performance e cálculo de bônus (Incentivo de
Curto Prazo). É uma aplicação web **Next.js 16** com banco **SQLite** (via
Prisma 7). Hoje ele roda como **um único processo Node** na porta **3003**.

A ideia desta migração é empacotar a app em um **container Docker**, para que
ela rode sempre igual (em qualquer máquina), seja fácil de atualizar e de fazer
backup, e fique protegida atrás do nginx com HTTPS.

### Como os dados funcionam

- O banco é um arquivo SQLite. Dentro do container ele fica em **`/data/app.db`**.
- Esse `/data` é um **volume nomeado do Docker** chamado `icp_data`. Ou seja:
  mesmo que você apague e recrie o container, **o banco continua salvo** no volume.
- O banco antigo de desenvolvimento (`dev.db`) **não é tocado** por esta migração.

---

## 2. Pré-requisitos

- Docker e Docker Compose instalados (`docker --version`, `docker compose version`).
- Estar no diretório da app: `/home/app/ICP/saas/app` (na VPS) ou
  `~/Projetos/ICP/saas/app` (local).

---

## 3. Rodar localmente com Docker

1. Crie o arquivo `.env` a partir do exemplo e ajuste os segredos:

   ```bash
   cp .env.example .env
   # edite o .env e troque AUTH_SECRET e AUTH_PASSWORD (ver seção de segurança)
   ```

2. Suba a aplicação (faz o build da imagem e roda):

   ```bash
   docker compose up -d --build
   ```

   - `-d` = roda em segundo plano (detached).
   - `--build` = reconstrói a imagem (use sempre que o código mudar).
   - Na primeira subida, o container aplica as **migrations do Prisma**
     automaticamente (cria as tabelas no banco do volume).

3. Acesse: <http://127.0.0.1:3003> (login padrão `admin` — **troque a senha!**).

4. Confira se está saudável:

   ```bash
   docker compose ps      # deve mostrar o serviço "icp" como running/healthy
   ```

---

## 4. Ver logs

```bash
docker compose logs -f icp      # acompanha em tempo real (Ctrl+C para sair)
docker compose logs --tail=100 icp   # últimas 100 linhas
```

---

## 5. Backup e Restore do banco

O banco vive no volume `icp_data`, em `/data/app.db`. Há duas formas práticas de
fazer backup. **Recomendado parar o container antes**, para garantir um arquivo
consistente.

### 5.1 Backup

```bash
# (opcional, mas recomendado) pausa a app para um snapshot consistente
docker compose stop icp

# copia o app.db de dentro do volume para um arquivo no host, com data no nome
docker run --rm -v icp_data:/data -v "$PWD":/backup alpine \
  sh -c "cp /data/app.db /backup/icp-backup-$(date +%Y%m%d-%H%M%S).db"

# volta a app
docker compose start icp
```

Resultado: um arquivo `icp-backup-AAAAMMDD-HHMMSS.db` no diretório atual.
Guarde esses backups em local seguro (fora da VPS, de preferência).

> Dica: agende esse backup num cron diário e copie o arquivo para outro lugar.

### 5.2 Restore (voltar um backup)

```bash
docker compose stop icp

# substitui o banco do volume pelo arquivo de backup escolhido
docker run --rm -v icp_data:/data -v "$PWD":/backup alpine \
  sh -c "cp /backup/icp-backup-AAAAMMDD-HHMMSS.db /data/app.db"

docker compose start icp
```

(Troque `AAAAMMDD-HHMMSS` pelo nome real do arquivo de backup.)

---

## 6. Deploy de uma nova versão (atualizar o código)

Quando houver código novo (após `git pull`):

```bash
git pull
docker compose up -d --build
```

Isso reconstrói a imagem com o código novo e troca o container em execução. As
migrations novas (se houver) são aplicadas automaticamente na subida.

> **Sempre faça um backup (seção 5.1) antes de um deploy que mexa no banco.**

Para reiniciar sem rebuild (ex: só trocou o `.env`):

```bash
docker compose up -d
```

---

## 7. Plano de migração na VPS — do systemd para o Docker

Hoje na VPS a app roda como serviço **systemd `icp.service`**, em
`/home/app/ICP/saas/app`, com `npm start` (NODE_ENV=production, PORT=3003).

A migração abaixo é **segura e reversível**: mantemos o `icp.service`
**parado, porém disponível** para voltar a qualquer momento (rollback).

### Passo a passo

1. **Backup do banco atual (systemd).** Antes de tudo, copie o `dev.db`/banco de
   produção atual para um lugar seguro:

   ```bash
   cp /home/app/ICP/saas/app/dev.db ~/icp-prod-backup-$(date +%Y%m%d-%H%M%S).db
   ```

2. **Pegar o código mais novo** (com os assets Docker):

   ```bash
   cd /home/app/ICP/saas/app
   git pull
   ```

3. **Criar o `.env`** de produção a partir do exemplo e **trocar os segredos**
   (ver seção 8):

   ```bash
   cp .env.example .env
   nano .env
   ```

4. **Importar o banco atual para o volume do Docker.** O Docker começa com um
   `/data/app.db` vazio; para não perder os dados de produção, copie o banco
   antigo para dentro do volume **antes** de subir (o container vai apenas
   aplicar migrations que faltarem):

   ```bash
   # cria o volume sem subir a app ainda
   docker volume create icp_data

   # copia o banco de produção atual para dentro do volume como /data/app.db
   docker run --rm -v icp_data:/data -v /home/app/ICP/saas/app:/src alpine \
     sh -c "cp /src/dev.db /data/app.db"
   ```

5. **Parar o serviço systemd** (libera a porta 3003), mas **deixar habilitado/
   disponível** para rollback:

   ```bash
   sudo systemctl stop icp.service
   # NÃO rode `disable` — queremos poder voltar rápido se necessário.
   ```

6. **Subir o Docker:**

   ```bash
   docker compose up -d --build
   docker compose ps          # confirmar "healthy"
   docker compose logs -f icp # confirmar que subiu sem erro
   ```

7. **Configurar o nginx** para o subdomínio (ver `deploy/nginx-icp.conf`):

   ```bash
   sudo cp deploy/nginx-icp.conf /etc/nginx/sites-available/icp
   sudo ln -s /etc/nginx/sites-available/icp /etc/nginx/sites-enabled/icp
   sudo nginx -t && sudo systemctl reload nginx
   ```

8. **Ativar o HTTPS (cadeado)** com Let's Encrypt:

   ```bash
   sudo certbot --nginx -d icp.spanlytics.com
   ```

9. **Validar** acessando <https://icp.spanlytics.com> e testando login + uma
   tela de cálculo. Confira os logs por alguns minutos.

### Rollback (voltar ao systemd)

Se algo der errado com o Docker:

```bash
docker compose down            # para o container Docker (dados ficam no volume)
sudo systemctl start icp.service   # volta a versão antiga rodando na porta 3003
```

> Como o `icp.service` nunca foi desabilitado e o `dev.db` antigo não foi
> alterado, o sistema volta exatamente como estava. Só desabilite o
> `icp.service` (`sudo systemctl disable icp.service`) **depois** de alguns dias
> rodando estável no Docker.

---

## 8. Segurança — leia antes de expor na internet

- **TROQUE o `AUTH_PASSWORD`.** O padrão é `admin`/senha-fraca. Antes de colocar
  no ar, defina uma senha forte no `.env`. O mesmo vale para `AUTH_USERNAME` se
  fizer sentido.
- **TROQUE o `AUTH_SECRET`** por um valor aleatório forte:
  `openssl rand -base64 32`.
- **Nunca** versione o `.env` real (ele tem segredos). Só o `.env.example` é
  versionado.
- O acesso externo seguro depende do **subdomínio `icp.spanlytics.com` com
  cadeado (HTTPS via Let's Encrypt)**. A app em si fica publicada **só no
  loopback** (`127.0.0.1:3003`) — quem fala com a internet é o nginx.

---

## 9. Notas técnicas (para o engenheiro)

- O `next.config.ts` **não** usa `output: 'standalone'`. Por isso a imagem usa
  o caminho clássico `npm run build` + `npm start`. **Recomendação futura:**
  adicionar `output: 'standalone'` ao `next.config.ts` deixaria a imagem bem
  menor e mais rápida (copiando só `.next/standalone`). Não foi feito aqui para
  não tocar no código da aplicação.
- O Prisma usa o **adapter libsql**, que tem binário nativo por plataforma. Por
  isso o `.dockerignore` ignora `node_modules` do host (macOS) e a imagem
  **reinstala as dependências dentro do container** (Linux) — garante o binário
  certo. Não copie `node_modules` do host para dentro da imagem.
- O entrypoint roda `prisma migrate deploy` (existem migrations versionadas).
  Se um dia o projeto deixar de ter migrations, troque por `prisma db push` no
  `docker-entrypoint.sh`.
