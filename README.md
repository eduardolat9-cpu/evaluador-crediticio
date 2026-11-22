# Evaluador Crediticio — aplicación web

Evaluación de crédito empresarial (NIIF, US$, Ecuador): indicadores comentados, flujo de caja,
flujo proyectado, capacidad de pago, CAPM, WACC y dictamen.

Desde el veredicto (arriba) o el Paso 5 se descarga una **presentación de PowerPoint** de 12
diapositivas con los números reales del análisis. Si el modelo recomienda el crédito, se arma como
propuesta ("Por qué otorgar el crédito"); si no lo recomienda, como evaluación con lo que tendría
que cambiar. No inventa argumentos que los números no respalden.

## Versión gratuita (recomendada para empezar)

Todo el análisis corre en el navegador de cada usuario: no hay servidor, no hay base de datos y
los estados financieros que se cargan **no salen de la computadora** de quien los usa.

La página publicada es la carpeta `docs/` (un único archivo `index.html`).

### Publicar en GitHub Pages (gratis)

1. Sube este proyecto a un repositorio **público** de GitHub.
2. En el repositorio: *Settings → Pages → Build and deployment → Source: Deploy from a branch*,
   rama `main`, carpeta `/docs` → *Save*.
3. En uno o dos minutos la app queda en `https://TU-USUARIO.github.io/NOMBRE-DEL-REPOSITORIO/`.
4. Para actualizarla: edita `app.html`, ejecuta `node build.mjs` y sube los cambios.

### Alternativas: Netlify o Cloudflare Pages (también gratis)

- Netlify: entra a https://app.netlify.com/drop y arrastra la carpeta `docs`.
- Cloudflare Pages: *Workers & Pages → Create → Pages → Upload assets* y sube la carpeta `docs`.

## Cómo modificar la aplicación

- La página está en `app.html`. Es la misma que se publica como artefacto en claude.ai.
- Después de editarla, genera `docs/index.html` con:

  ```
  node build.mjs
  ```

## IA gratuita con Google Gemini

La app puede usar Gemini para leer PDF escaneados, clasificar formatos desconocidos y redactar el
dictamen. No necesita servidor: cada usuario pega su propia clave en el paso 1 y la app llama a
Google directamente desde su navegador. La clave se guarda solo en ese navegador.

1. Entra a https://aistudio.google.com/apikey con una cuenta de Google y crea una clave (gratis).
2. En la app, paso 1, pégala y pulsa **Activar**. La app elige sola el modelo Flash más reciente.

**Usar la IA en otro navegador o computador sin volver a pegar la clave:** con la IA activa, pulsa
**Copiar mi enlace personal** y guarda ese enlace (gestor de contraseñas, nota privada). Al abrirlo,
la página guarda la clave en ese navegador y borra el enlace de la barra de direcciones. El enlace
contiene tu clave: no lo compartas. Si se filtra, elimina la clave en Google AI Studio y crea otra.

Límites del plan gratuito de Google: hay un número máximo de solicitudes por minuto y por día; si
se alcanza, la app avisa y basta con esperar.

**Privacidad:** en el plan gratuito, Google puede usar el contenido enviado para mejorar sus
productos. Para estados financieros confidenciales de clientes, activa la facturación en el
proyecto de Google Cloud de esa clave (plan de pago, donde el contenido no se usa para eso) o no
uses las funciones de IA. Los cálculos de la app no usan IA y no salen del navegador.

## Opcional (con costo): funciones con Claude

Leer PDF escaneados, clasificar cuentas de formatos desconocidos y redactar el dictamen requieren
la API de Anthropic, que se cobra por uso (centavos de dólar por análisis). Para activarlas:

1. Crea una clave en https://console.anthropic.com (requiere agregar un medio de pago).
2. Publica el proyecto completo (no solo `docs/`) en un servicio que ejecute funciones de
   servidor. `api/claude.js` está escrito para Vercel; configura las variables
   `ANTHROPIC_API_KEY` y `APP_ACCESS_CODE` (código que deben escribir los usuarios para usar
   Claude, para que nadie más gaste tu saldo).
3. Ten en cuenta que el plan gratuito de Vercel (Hobby) es solo para uso no comercial; para una
   empresa corresponde el plan Pro.

Sin la clave, la aplicación funciona igual en su versión gratuita.
