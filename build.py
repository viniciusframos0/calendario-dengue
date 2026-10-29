from pathlib import Path
s = Path("src")
html = (s / "index.src.html").read_text(encoding="utf-8")
for k, f in (("/*ENGINE*/", "engine.js"), ("/*DATA*/", "data.json"), ("/*APP*/", "app.js")):
    html = html.replace(k, (s / f).read_text(encoding="utf-8").replace("</script", "<\\/script"), 1)
Path("dist").mkdir(exist_ok=True)
Path("dist/calendario-dengue.html").write_text(html, encoding="utf-8")
print(len(html.encode()), "bytes (artifact)")

# Versão completa para o GitHub Pages: o artifact recebe o esqueleto na publicação; aqui ele vai no arquivo.
pagina = """<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Priorização mensal do combate à dengue com ELECTRE III e IV a partir de dados do InfoDengue.">
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
""" + html + """
</body>
</html>
"""
Path("index.html").write_text(pagina, encoding="utf-8")
print(len(pagina.encode()), "bytes (index.html)")
