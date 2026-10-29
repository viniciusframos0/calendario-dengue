# Calendário de Prioridade da Dengue

Site interativo que aplica os métodos **ELECTRE III** e **ELECTRE IV** a dados semanais do [InfoDengue](https://info.dengue.mat.br) e indica em quais meses priorizar ações de prevenção e controle da dengue.

Abra o site em: **https://viniciusframos0.github.io/calendario-dengue/**

## O que o site faz

- Agrega as semanas epidemiológicas em 12 alternativas mensais (média semanal de cada critério).
- Critérios: casos estimados, Rt, umidade média e temperatura média, todos de maximização.
- ELECTRE III com pesos ajustáveis (padrão 0,40 · 0,30 · 0,15 · 0,15); ELECTRE IV sem pesos.
- Limiares q, p e v como frações da amplitude de cada critério (padrão 10 %, 30 % e 70 %).
- Destilações descendente e ascendente com s(λ) = 0,30 − 0,15λ e pré-ordem final.
- Dados embutidos: Belém (2015 até a semana 40 de 2026), Manaus e Macapá (2015–2025).
- Aceita o CSV de qualquer município baixado do endpoint `alertcity` do InfoDengue. O arquivo é lido apenas no navegador.

## Estrutura

| Arquivo | Conteúdo |
|---|---|
| `index.html` | Site pronto, gerado por `build.py` (um único arquivo, sem dependências além das fontes) |
| `src/engine.js` | Motor ELECTRE III/IV, tradução dos scripts Python do estudo |
| `src/app.js` | Interface e gráficos |
| `src/index.src.html` | Estrutura e estilos da página |
| `src/data.json` | Séries semanais das três capitais (InfoDengue) |

Para regerar o `index.html` depois de editar algo em `src/`:

```bash
python build.py
```

## Validação

O motor em JavaScript foi comparado com a implementação Python original em 17 combinações de cidade e período. Matrizes de decisão, concordâncias, credibilidades, destilações e pré-ordens finais saíram idênticas.

## Fontes

- InfoDengue — Sistema de Alerta de Arboviroses (Fiocruz e parceiros).
- B. Roy (1978). ELECTRE III: un algorithme de classement fondé sur une représentation floue des préférences. *Cahiers du CERO* 20(1).
- B. Roy e J. C. Hugonnier (1982). Classement des prolongements de lignes de métro en banlieue parisienne. *Cahiers du CERO*.
