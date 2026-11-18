// Monta o app a partir de src/ e public/.
// Saída em dist/:
//   index.html             app para o site e o APK (fontes e leitor de código em arquivos separados)
//   intervalo-offline.html tudo num arquivo só, para abrir direto no celular sem internet
// Uso: node build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const src = (...p) => path.join(root, 'src', ...p);
const dist = path.join(root, 'dist');
const text = p => fs.readFileSync(p, 'utf8');
const list = dir => fs.readdirSync(dir).filter(f => !f.startsWith('.')).sort();

const css = list(src('css')).map(f => text(src('css', f))).join('\n');
const js = list(src('js')).map(f => text(src('js', f))).join('\n');
const taco = JSON.stringify(JSON.parse(text(src('data', 'taco.json'))));
const zxing = text(src('vendor', 'zxing.min.js'));
const license = text(src('vendor', 'zxing-LICENSE.txt'));
const font = name => fs.readFileSync(src('fonts', name)).toString('base64');

const faces = inline => {
  const url = name => (inline ? `data:font/ttf;base64,${font(name)}` : `fonts/${name}`);
  return `@font-face{font-family:Nunito;src:url(${url('nunito.ttf')}) format('truetype');font-weight:200 1000;font-display:swap}\n` +
    `@font-face{font-family:Lora;src:url(${url('lora.ttf')}) format('truetype');font-weight:700;font-style:normal;font-display:swap}\n`;
};

function page(single) {
  let html = text(src('index.html'));
  const put = (marker, value) => {
    if (!html.includes(marker)) throw new Error('Marcador ausente: ' + marker);
    html = html.replace(marker, () => value);
  };
  put('<!--@preload-->', single ? '' :
    '<link rel="preload" href="fonts/nunito.ttf" as="font" type="font/ttf" crossorigin>' +
    '<link rel="preload" href="fonts/lora.ttf" as="font" type="font/ttf" crossorigin>');
  put('/*@css*/', faces(single) + css);
  put('<!--@zxing-->', single ? `<script>${zxing}</script>` : '');
  put('/*@js*/', js.replace('/*@taco*/[]', () => taco));
  put('<!--@zxing-license-->', `<script type="text/plain" id="zxingLicense">${license}</script>`);
  return html;
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'fonts'), { recursive: true });
fs.mkdirSync(path.join(dist, 'vendor'), { recursive: true });
fs.writeFileSync(path.join(dist, 'index.html'), page(false));
fs.writeFileSync(path.join(dist, 'intervalo-offline.html'), page(true));
for (const f of list(src('fonts'))) fs.copyFileSync(src('fonts', f), path.join(dist, 'fonts', f));
fs.copyFileSync(src('vendor', 'zxing.min.js'), path.join(dist, 'vendor', 'zxing.min.js'));
fs.copyFileSync(src('vendor', 'zxing-LICENSE.txt'), path.join(dist, 'vendor', 'zxing-LICENSE.txt'));
for (const f of list(path.join(root, 'public'))) fs.copyFileSync(path.join(root, 'public', f), path.join(dist, f));

const kb = f => (fs.statSync(path.join(dist, f)).size / 1024).toFixed(0) + ' KB';
console.log('dist/index.html', kb('index.html'), '| fontes', kb('fonts/nunito.ttf'), '+', kb('fonts/lora.ttf'), '| leitor', kb('vendor/zxing.min.js'));
console.log('dist/intervalo-offline.html', kb('intervalo-offline.html'));
