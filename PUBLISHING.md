# Guia de Publicação - RN Dependency Radar

## Checklist antes de publicar

### 1. Configurações do package.json
- [x] ✅ `name`: `rn-dependency-radar` (já configurado)
- [ ] ⚠️ `publisher`: Atualizar de `"your-publisher-id"` para seu Publisher ID do Azure DevOps
- [x] ✅ `version`: `0.1.0` (já configurado)
- [x] ✅ `displayName`, `description`, `icon`: já configurados
- [x] ✅ `engines.vscode`: `^1.80.0` (já configurado)

### 2. Arquivos essenciais
- [x] ✅ `.gitignore` criado
- [x] ✅ `.vscodeignore` criado (para excluir arquivos do .vsix)
- [x] ✅ `LICENSE` criado (MIT)
- [x] ✅ `README.md` atualizado
- [x] ✅ `images/icon.png` presente (128x128)

### 3. Build e testes
- [ ] ⚠️ Testar a extensão em um projeto React Native real
- [ ] ⚠️ Verificar se todas as funcionalidades estão funcionando
- [ ] ⚠️ Testar em diferentes versões do VS Code (se possível)

### 4. Preparação para publicação

#### Passo 1: Criar Publisher no Azure DevOps
1. Acesse: https://marketplace.visualstudio.com/manage
2. Faça login com sua conta Microsoft/GitHub
3. Clique em "Create Publisher"
4. Preencha:
   - **Publisher ID**: (ex: `luisreis` ou `luisreiskeys`)
   - **Display Name**: (ex: "Luis Reis")
   - **Description**: Breve descrição
5. Salve o Publisher ID

#### Passo 2: Atualizar package.json
```json
{
  "publisher": "seu-publisher-id-aqui"
}
```

#### Passo 3: Instalar vsce (se ainda não tiver)
```bash
npm install -g @vscode/vsce
```

#### Passo 4: Criar Personal Access Token (PAT)
1. Acesse: https://dev.azure.com/[seu-org]/_usersSettings/tokens
2. Clique em "New Token"
3. Configure:
   - **Name**: "VS Code Extension Publishing"
   - **Organization**: All accessible organizations
   - **Expiration**: (escolha uma data)
   - **Scopes**: Marketplace → Manage
4. Copie o token (você só verá uma vez!)

#### Passo 5: Login no vsce
```bash
vsce login seu-publisher-id
# Vai pedir o Personal Access Token
```

#### Passo 6: Validar antes de publicar
```bash
vsce package
# Isso cria um .vsix sem publicar
# Teste instalando: code --install-extension rn-dependency-radar-0.1.0.vsix
```

#### Passo 7: Publicar
```bash
vsce publish
# Para versão patch: vsce publish patch
# Para versão minor: vsce publish minor
# Para versão major: vsce publish major
```

### 5. Após publicação
- [ ] Atualizar README.md com link do Marketplace
- [ ] Criar release no GitHub (opcional)
- [ ] Compartilhar nas redes sociais/comunidades

## Estrutura de commits sugerida

### Commit 1: Initial commit
```bash
git add .
git commit -m "Initial commit: RN Dependency Radar extension

- Core dependency analysis with npm metadata
- Risk assessment engine with configurable thresholds
- Dashboard with charts and detailed dependency table
- Status bar integration and notifications
- Support for React Native and Expo projects"
```

### Commit 2: Documentation
```bash
git add README.md LICENSE .gitignore .vscodeignore
git commit -m "docs: Add README, LICENSE and ignore files"
```

### Commit 3: Prepare for publishing (quando tiver o publisher ID)
```bash
# Atualizar package.json com publisher ID
git add package.json
git commit -m "chore: Update publisher ID for marketplace"
```

## Estrutura do repositório GitHub

```
rn-dependency-radar/
├── .gitignore
├── .vscodeignore
├── LICENSE
├── README.md
├── PUBLISHING.md (este arquivo)
├── package.json
├── package-lock.json
├── tsconfig.json
├── images/
│   └── icon.png
├── rules/
│   └── rn-default-rules.json
└── src/
    ├── extension.ts
    ├── core/
    ├── models/
    ├── providers/
    └── utils/
```

## Notas importantes

- ⚠️ **NÃO commitar**: `node_modules/`, `dist/`, `.vsix`
- ✅ **Sempre commitar**: código fonte (`src/`), configurações, README, LICENSE
- 📦 O build (`dist/`) será gerado automaticamente durante a publicação
- 🔒 Mantenha o Personal Access Token seguro (não commitar!)
