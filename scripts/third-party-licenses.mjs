// Writes public/THIRD_PARTY_LICENSES.txt (shipped with every build) from the production dependency tree.
// Run after changing dependencies: node scripts/third-party-licenses.mjs
import { execSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const tree = JSON.parse(execSync('npm ls --omit=dev --all --json', { encoding: 'utf8' }))
const seen = new Map()
const walk = (deps = {}) => {
  for (const [name, d] of Object.entries(deps)) {
    const key = `${name}@${d.version}`
    if (seen.has(key)) continue
    seen.set(key, name)
    walk(d.dependencies)
  }
}
walk(tree.dependencies)

const out = [
  'Frame includes the following open-source packages. Their licenses and notices follow.',
  '',
]
for (const [key, name] of [...seen].sort(([a], [b]) => a.localeCompare(b))) {
  const dir = join('node_modules', name)
  if (!existsSync(dir)) continue
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  const files = readdirSync(dir).filter((f) => /^(licen[cs]e|notice|copying)/i.test(f))
  out.push('='.repeat(78), `${key} (${pkg.license ?? 'see below'})`, pkg.homepage ?? pkg.repository?.url ?? '', '')
  for (const f of files) out.push(readFileSync(join(dir, f), 'utf8').trim(), '')
  if (!files.length) out.push(`License: ${pkg.license}`, '')
}
writeFileSync('public/THIRD_PARTY_LICENSES.txt', out.join('\n'))
console.log(`${seen.size} packages`)
