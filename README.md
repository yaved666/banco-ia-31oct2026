# Banco de pruebas IA: Claude, ChatGPT y Gemini con el mismo encargo

Material completo del video "Puse a Claude, ChatGPT y Gemini a competir en 4 pruebas (y un filtro paró a Claude)"
de @soyvictormaican. Está aquí para que cualquiera pueda abrirlo, jugarlo y comprobarlo.

**Verlo en el navegador (páginas, juegos y habitaciones 3D):** https://yaved666.github.io/banco-ia-31oct2026/

## Cómo se hizo (31 de octubre de 2026)

- Modelos: Claude Opus 5.5 (Claude Code), GPT-6.1 Sol (Codex) y Gemini 4 Argon (Antigravity). Cada uno en su plan de
  20 dólares y con esfuerzo medio, en modo autónomo.
- Los tres en la misma máquina virtual Ubuntu, cada uno con su usuario cerrado, sin memorias, ajustes ni
  herramientas extra. Internet sí; la red de casa no.
- El mismo encargo, palabra por palabra, para los tres: está en `ENCARGO.txt` de cada ronda.
- Lo que hay en cada carpeta es lo que dejó cada modelo, sin retocar. Sus explicaciones están en `NOTAS.md`
  (rondas 1-3) e `INFORME_SEGURIDAD.md` (ronda 4).

## Las cuatro rondas

| Ronda | Encargo | Carpeta |
|---|---|---|
| 1 | Página web de una ferretería de barrio, sin librerías externas | `ronda1_pagina_web/` |
| 2 | Videojuego 2D original (no una copia), teclado y táctil | `ronda2_juego_2d/` |
| 3 | Habitación amueblada en 3D que se recorre en primera persona | `ronda3_habitacion_3d/` |
| 4 | Auditar y arreglar una tienda online con 11 fallos de seguridad escondidos | `ronda4_seguridad/` |

Tiempos aproximados (primer archivo a notas finales):

| Ronda | Claude Opus 5.5 | GPT-6.1 Sol (Codex) | Gemini 4 Argon |
|---|---|---|---|
| 1 Web | 9 min | 6 min | 8 min |
| 2 Juego 2D | 36 min | 15 min | 11 min |
| 3 Habitación 3D | 35 min | 10 min | 30 min |
| 4 Seguridad | parado por un filtro | 8 min | 9 min |

Las opiniones sobre qué ronda ganó cada uno son de Victor y están en el video. Aquí no hay puntuación: juzga tú.

## Ronda 4: seguridad, con verificación automática

`ronda4_seguridad/tienda_original/` es la tienda "Brisa Outdoor" (Flask + SQLite) con 11 fallos plantados a
propósito. La lista de fallos (`verificacion/CLAVE_FALLOS.md`) nunca entró en la máquina de los modelos.

`verificacion/verificar_fallos.py` ataca de verdad cada uno de los 11 fallos contra la tienda que le indiques, en
local, y dice ARREGLADO o VULNERABLE. Resultados guardados en `verificacion/resultados/`:

| Modelo | Fallos abiertos tras su arreglo | Tests de uso originales (9) |
|---|---|---|
| GPT-6.1 Sol (Codex) | 0 de 11 en la tienda (ver nota) | 2 de 9: añadió protección CSRF y quitó los usuarios de ejemplo |
| Gemini 4 Argon | 0 de 11 | 9 de 9 |
| Claude Opus 5.5 | 11 de 11 (no tocó nada) | 9 de 9 (es la tienda original) |

- Nota sobre Codex: `codex.json` marca el fallo 5 (secretos en el código) como VULNERABLE porque la clave antigua
  aparece en los tests de ataque que escribió Codex, que comprueban precisamente que esa clave ya no sirve. En la
  aplicación ya no está.
- Claude: a los pocos segundos, un filtro automático de seguridad de Anthropic marcó la sesión como ciberseguridad
  y la paró, ofreciendo seguir con Opus 4.8. No fue el modelo razonando una negativa. Se dejó así para no cambiar de
  modelo a mitad de la prueba. Pantalla final en `verificacion/resultados/claude_pantalla_final.txt`.

### Comprobarlo tú mismo

El verificador importa y ejecuta el código de cada carpeta (lo escribieron los modelos). Hazlo dentro de una
máquina virtual o un contenedor, como hicimos nosotros, no en tu ordenador de diario.

```bash
cd ronda4_seguridad
python3 -m venv .venv && .venv/bin/pip install flask pytest
.venv/bin/python verificacion/verificar_fallos.py tienda_original   # 11 de 11 abiertos
.venv/bin/python verificacion/verificar_fallos.py gemini            # la versión de Gemini
.venv/bin/python -m pytest tienda_original/tests                    # tests de uso
```

## Aviso importante

La tienda de la ronda 4 (`tienda_original/` y la carpeta `claude/`, que es la misma tienda sin tocar) es
**vulnerable a propósito**, como material de práctica. Ejecútala solo en tu propio ordenador (127.0.0.1) y nunca la
publiques en internet. Los correos, contraseñas y "claves" que aparecen son inventados para la prueba.

## Licencias

- El código lo generaron los modelos para esta prueba; se publica con licencia MIT (ver `LICENSE`).
- Three.js (incluido por algunos modelos en la ronda 3) es de sus autores, con su propia licencia MIT.
