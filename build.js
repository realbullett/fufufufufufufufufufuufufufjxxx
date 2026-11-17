const path = require('path');
const fs = require('fs');

const Root = (() => {
  let Dir = __dirname;
  for (;;) {
    if (fs.existsSync(path.join(Dir, 'app', 'node_modules', 'esbuild'))) return Dir;
    const Up = path.dirname(Dir);
    if (Up === Dir) throw new Error('vulner repo root not found (app/node_modules/esbuild)');
    Dir = Up;
  }
})();
const App = path.join(Root, 'app');
const Src = path.join(App, 'renderer');
const Out = path.join(__dirname, 'dist');

const esbuild = require(path.join(App, 'node_modules', 'esbuild'));

fs.rmSync(Out, { recursive: true, force: true });
fs.mkdirSync(Out, { recursive: true });

const Started = Date.now();
const Result = esbuild.buildSync({
  entryPoints: [path.join(Src, 'src', 'main.jsx')],
  bundle: true,
  outfile: path.join(Out, 'renderer.js'),
  platform: 'browser',
  format: 'iife',
  target: ['chrome110', 'safari16', 'firefox115'],
  jsx: 'automatic',
  minify: true,
  sourcemap: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
});

const Copy = (From, To) => {
  const Target = path.join(Out, To || From);
  fs.mkdirSync(path.dirname(Target), { recursive: true });
  fs.cpSync(path.join(Src, From), Target, { recursive: true });
};

for (const Name of ['style.css']) Copy(Name);
for (const Dir of ['fonts']) Copy(Dir);
for (const Name of ['index.html', 'landing.html', 'start.html', 'download.html', 'bridge.js']) fs.copyFileSync(path.join(__dirname, Name), path.join(Out, Name));
fs.copyFileSync(path.join(Root, 'app', 'renderer', 'icon.ico'), path.join(Out, 'icon.ico'));

const Ver = String(Date.now());
const IndexPath = path.join(Out, 'index.html');
let IndexHtml = fs.readFileSync(IndexPath, 'utf8');
IndexHtml = IndexHtml
  .replace('src="renderer.js"', `src="renderer.js?v=${Ver}"`)
  .replace('href="style.css"', `href="style.css?v=${Ver}"`)
  .replace('src="bridge.js"', `src="bridge.js?v=${Ver}"`);
fs.writeFileSync(IndexPath, IndexHtml);

if (Result.errors && Result.errors.length) {
  console.error(Result.errors);
  process.exit(1);
}

const Size = (P) => {
  try { return (fs.statSync(P).size / 1024).toFixed(0) + ' KB'; } catch { return '?'; }
};

console.log(`built web/dist in ${Date.now() - Started}ms`);
console.log(`  renderer.js ${Size(path.join(Out, 'renderer.js'))}`);
console.log(`  style.css   ${Size(path.join(Out, 'style.css'))}`);
