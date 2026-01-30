# Debug Guide - RN Dependency Radar

## Problema: Extensão não aparece na status bar em produção

### Método 1: Script de Debug no Developer Tools

1. **Abra o VS Code**
2. **Abra o Developer Tools**:
   - `Cmd+Shift+P` (Mac) ou `Ctrl+Shift+P` (Windows/Linux)
   - Digite: `Developer: Toggle Developer Tools`
   - Ou: `Help` → `Toggle Developer Tools`

3. **Vá para a aba Console**

4. **Copie e cole o conteúdo de `debug-extension-simple.js`**

5. **Pressione Enter**

6. **Verifique os resultados**:
   - Se a extensão foi encontrada
   - Se está ativa
   - Se os comandos estão registrados
   - Se há erros

### Método 2: Verificar Output Panel

1. **Abra o Output Panel**:
   - `View` → `Output`
   - Ou: `Cmd+Shift+U` (Mac) / `Ctrl+Shift+U` (Windows/Linux)

2. **Selecione "RN Dependency Radar"** no dropdown

3. **Procure por logs**:
   - `[RN Dependency Radar] Extension activating...`
   - `[RN Dependency Radar] Status bar created. Extension is active.`
   - Qualquer erro

### Método 3: Verificar Extensão Manualmente

1. **Abra Command Palette**: `Cmd+Shift+P` / `Ctrl+Shift+P`

2. **Digite**: `Extensions: Show Installed Extensions`

3. **Procure por "RN Dependency Radar"**

4. **Verifique**:
   - Se está instalada
   - Se está habilitada (não desabilitada)
   - A versão instalada

### Método 4: Recarregar Janela

1. **Command Palette**: `Cmd+Shift+P` / `Ctrl+Shift+P`

2. **Digite**: `Developer: Reload Window`

3. **Aguarde o VS Code recarregar**

4. **Verifique se o status bar aparece**

### Método 5: Verificar Logs do Extension Host

1. **Command Palette**: `Cmd+Shift+P` / `Ctrl+Shift+P`

2. **Digite**: `Developer: Open Extension Host Log`

3. **Procure por erros relacionados a "RN Dependency Radar"**

### Método 6: Testar Comando Manualmente

1. **Command Palette**: `Cmd+Shift+P` / `Ctrl+Shift+P`

2. **Digite**: `RN Dependency Radar: Show Details`

3. **Se o comando aparecer e funcionar**, a extensão está ativa

4. **Se não aparecer**, a extensão não está sendo ativada

## Possíveis Causas

1. **Extensão não está sendo ativada**
   - Verifique `activationEvents` no `package.json`
   - Deve ser `"onStartupFinished"`

2. **Erro silencioso na ativação**
   - Verifique Output Panel
   - Verifique Extension Host Log

3. **Status bar não está sendo criado**
   - Verifique se há erros no console
   - Verifique se o comando está registrado antes do status bar

4. **Workspace não detectado**
   - A extensão deve funcionar mesmo sem workspace
   - Status bar deve aparecer com "No workspace"

## Informações para Reportar

Se ainda não funcionar, colete:

1. **Output do script de debug** (Método 1)
2. **Logs do Output Panel** (Método 2)
3. **Versão do VS Code**: `Help` → `About`
4. **Versão da extensão**: Ver em Extensions
5. **Sistema Operacional**
6. **Se há workspace aberto ou não**
