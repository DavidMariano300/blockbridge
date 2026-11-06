#!/usr/bin/env bash
# Genera pdf/*.pdf a partir de los 0*.md: marked + mermaid desde CDN, impresión con Chrome headless.
# Uso: ./generar-pdf.sh   (requiere google-chrome, python3 e internet)
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p pdf
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

for md in 0*.md; do
  name=${md%.md}
  python3 - "$md" > "$tmp/$name.html" <<'PY'
import json, sys
md = open(sys.argv[1], encoding="utf-8").read()
print("""<!doctype html><html lang="es"><head><meta charset="utf-8">
<style>
  @page { size: A4; margin: 18mm 16mm; }
  body { font: 10.5pt/1.5 "Segoe UI", Roboto, "Noto Sans", sans-serif; color: #1a1a1a; }
  h1 { font-size: 20pt; border-bottom: 2px solid #1f4e79; padding-bottom: 4px; color: #1f4e79; }
  h2 { font-size: 15pt; color: #1f4e79; margin-top: 1.6em; }
  h3 { font-size: 12pt; margin-top: 1.4em; }
  h1, h2, h3 { break-after: avoid; }
  table { border-collapse: collapse; width: 100%; margin: .6em 0; font-size: 9.5pt; }
  th, td { border: 1px solid #b8c4d0; padding: 4px 6px; vertical-align: top; text-align: left; }
  th { background: #e8eef5; }
  thead:has(th:empty) { display: none; }
  tr, .mermaid, pre, blockquote { break-inside: avoid; }
  code { font: 9pt "DejaVu Sans Mono", monospace; background: #f2f4f7; padding: 0 3px; border-radius: 3px; }
  pre { background: #f2f4f7; padding: 8px; overflow-wrap: anywhere; white-space: pre-wrap; }
  pre code { padding: 0; }
  blockquote { border-left: 4px solid #1f4e79; margin: .8em 0; padding: .2em .8em; background: #f5f8fb; }
  .mermaid { text-align: center; margin: 1em 0; }
  .mermaid svg { max-width: 100%; height: auto; }
  hr { border: 0; border-top: 1px solid #ccc; margin: 1.5em 0; }
</style></head><body><main id="doc"></main>
<script src="https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js"></script>
<script>
  const doc = document.getElementById("doc");
  doc.innerHTML = marked.parse(__MD__);
  doc.querySelectorAll("code.language-mermaid").forEach(c => {
    const d = document.createElement("div");
    d.className = "mermaid";
    d.textContent = c.textContent;
    c.parentElement.replaceWith(d);
  });
  mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "strict" });
  mermaid.run();
</script></body></html>""".replace("__MD__", json.dumps(md)))
PY
  google-chrome --headless=new --disable-gpu --no-pdf-header-footer \
    --user-data-dir="$tmp/perfil" --virtual-time-budget=30000 \
    --print-to-pdf="pdf/$name.pdf" "file://$tmp/$name.html" 2>/dev/null
  echo "pdf/$name.pdf"
done
