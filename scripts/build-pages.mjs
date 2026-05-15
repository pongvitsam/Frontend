import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const srcDir = path.join(root, 'src');
const docsDir = path.join(root, 'docs');
const clientDir = path.join(root, 'client');
const deployConfig = JSON.parse(fs.readFileSync(path.join(root, 'deploy.config.json'), 'utf8'));

const PAGES_BASE = 'https://pongvitsam.github.io/Frontend';
const GAS_EXEC = deployConfig.productionUrl;
const GAS_BRIDGE = GAS_EXEC + (GAS_EXEC.includes('?') ? '&' : '?') + 'page=bridge';
const ASSET_V = deployConfig.assetVersion || '5';

const instantBoot = fs
  .readFileSync(path.join(__dirname, 'instant-boot.template.html'), 'utf8')
  .replace(/__GAS_EXEC_URL__/g, GAS_EXEC);

function readAppClientSource() {
  const clientPath = path.join(clientDir, 'app.client.js');
  if (!fs.existsSync(clientPath)) {
    throw new Error('Missing client/app.client.js');
  }
  return fs.readFileSync(clientPath, 'utf8');
}

function extractStyleCss(stylesHtml) {
  const m = stylesHtml.match(/<style[^>]*>([\s\S]*)<\/style>/i);
  return m ? m[1].trim() : stylesHtml.trim();
}

function extractBodyHtml(indexHtml) {
  const bodyMatch = indexHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!bodyMatch) throw new Error('No <body> in Index.html');
  return bodyMatch[1]
    .replace(/<script[^>]*src=[^>]*><\/script>/gi, '')
    .replace(/<script>[\s\S]*?<\/script>/gi, '')
    .replace(/<\?!= include\('Client'\); \?>/gi, '')
    .trim();
}

function extractHeadThemeScript(indexHtml) {
  const m = indexHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  if (!m) return '';
  const theme = m[1].match(/<script>[\s\S]*?localStorage\.theme[\s\S]*?<\/script>/i);
  return theme ? theme[0] : '';
}

const stylesHtml = fs.readFileSync(path.join(srcDir, 'Styles.html'), 'utf8');
const indexHtml = fs.readFileSync(path.join(srcDir, 'Index.html'), 'utf8');
const bodyHtml = extractBodyHtml(indexHtml);
const appSource = readAppClientSource();
const appJs = appSource.replace(/\bgoogle\.script\.run\b/g, 'gasRun()');
const clientHtml = `<script>\n${appSource.replace(/\bgasRun\(\)/g, 'google.script.run')}\n</script>\n`;
const themeScript = extractHeadThemeScript(indexHtml);

fs.mkdirSync(docsDir, { recursive: true });
fs.writeFileSync(path.join(docsDir, 'styles.css'), extractStyleCss(stylesHtml));
fs.writeFileSync(path.join(srcDir, 'Client.html'), clientHtml);

fs.writeFileSync(
  path.join(docsDir, 'config.js'),
  `window.APP_CONFIG = ${JSON.stringify(
    {
      pagesBase: PAGES_BASE,
      gasExecUrl: GAS_EXEC,
      gasBridgeUrl: GAS_BRIDGE,
      bridgeOrigins: ['https://pongvitsam.github.io'],
      assetVersion: ASSET_V,
    },
    null,
    2
  )};\n`
);

const swTemplate = fs.readFileSync(path.join(__dirname, 'sw.template.js'), 'utf8');
fs.writeFileSync(
  path.join(docsDir, 'sw.js'),
  swTemplate.replace(/__ASSET_V__/g, ASSET_V)
);

const gasClient = fs.readFileSync(path.join(__dirname, 'gas-client.template.js'), 'utf8');
fs.writeFileSync(path.join(docsDir, 'gas-client.js'), gasClient);
fs.writeFileSync(path.join(docsDir, 'app.js'), appJs + '\n');

const pagesIndex = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>กองบริการธุรกิจจัดการพลังงาน</title>
  ${themeScript}
${instantBoot}
  <link rel="stylesheet" href="styles.css?v=${ASSET_V}">
  <link rel="preconnect" href="https://cdnjs.cloudflare.com" crossorigin>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
</head>
<body class="min-h-screen flex flex-col transition-all duration-500">
${bodyHtml}
  <script src="config.js?v=${ASSET_V}"></script>
  <script src="gas-client.js?v=${ASSET_V}"></script>
  <iframe id="gas-bridge-frame" src="${GAS_BRIDGE}" style="position:absolute;width:0;height:0;border:0;visibility:hidden" title="GAS Bridge"></iframe>
  <script src="app.js?v=${ASSET_V}"></script>
</body>
</html>
`;
fs.writeFileSync(path.join(docsDir, 'index.html'), pagesIndex);

const gasIndex = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>กองบริการธุรกิจจัดการพลังงาน</title>
  ${themeScript}
${instantBoot}
  <?!= include('Styles'); ?>
  <link rel="preconnect" href="https://cdnjs.cloudflare.com" crossorigin>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
</head>
<body class="min-h-screen flex flex-col transition-all duration-500">
${bodyHtml}
<?!= include('Client'); ?>
</body>
</html>
`;
fs.writeFileSync(path.join(srcDir, 'Index.html'), gasIndex);

console.log('Built docs/, src/Client.html, and src/Index.html');
