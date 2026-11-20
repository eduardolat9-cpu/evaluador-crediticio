// Genera docs/index.html a partir de app.html (la misma página que se publica como artefacto).
// docs/ es la carpeta que publica GitHub Pages (y la que se sube a Netlify o Cloudflare Pages).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const app = readFileSync("app.html", "utf8");
const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Evaluación de crédito empresarial: indicadores NIIF, flujo de caja, capacidad de pago, CAPM y WACC.">
<style>body{margin:0;font-family:system-ui,sans-serif;font-size:14px}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
${app}
</body>
</html>
`;
mkdirSync("docs", { recursive: true });
writeFileSync("docs/index.html", html);
writeFileSync("docs/.nojekyll", ""); // GitHub Pages sirve el archivo tal cual, sin procesarlo
console.log("docs/index.html generado");
