#!/usr/bin/env node
/**
 * smoke-init-bundle-dedup.mjs
 *
 * ADR-128 Phase 5: Three static assertions for init bundle integrity
 * - No filename collisions between init template and plugins
 * - SKILLS_MAP completeness (all named skills have SKILL.md)
 * - COMMANDS_MAP coverage (all command dirs have COMMANDS_MAP keys)
 *
 * Usage:
 *   node scripts/smoke-init-bundle-dedup.mjs [--verbose]
 *
 * Exit codes:
 *   0 - All assertions passed
 *   1 - Assertion failure
 *   2 - File read error
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const VERBOSE = process.argv.includes('--verbose');

// ============================================================================
// ASSERTION 1: No filename collision (within same type)
// ============================================================================

function assertion1_noCollision() {
  console.log('\n📋 Assertion 1: No filename collision (init template vs plugins, same type)');

  // Known acceptable collisions (init template vs plugin; deduplication in ADR-127 follow-up)
  const ACCEPTABLE_COLLISIONS = new Set([
    'swarm.md',    // init/commands/swarm vs plugin/ruflo-swarm/commands
    'neural.md',   // init/commands/memory vs plugin/ruflo-intelligence/commands
  ]);

  const types = ['agents', 'commands', 'skills'];
  let totalCollisions = 0;

  // Check collisions for each type separately
  types.forEach(type => {
    const initFiles = new Map(); // { basename: count }
    const pluginFiles = new Map(); // { basename: [pluginPaths] }

    // Collect init template files for this type
    const initDir = path.join(ROOT, `v3/@claude-flow/cli/.claude/${type}`);
    if (fs.existsSync(initDir)) {
      collectFiles(initDir, (file) => {
        // Skip SKILL.md files - they're expected in every skill directory
        if (path.basename(file) === 'SKILL.md') return;
        const basename = path.basename(file);
        initFiles.set(basename, (initFiles.get(basename) || 0) + 1);
      });
    }

    // Collect plugin files for this type
    const pluginsDir = path.join(ROOT, 'plugins');
    if (fs.existsSync(pluginsDir)) {
      fs.readdirSync(pluginsDir).forEach((pluginName) => {
        const pluginPath = path.join(pluginsDir, pluginName);
        const stat = fs.statSync(pluginPath);
        if (!stat.isDirectory()) return;

        const pluginTypeDir = path.join(pluginPath, type);
        if (fs.existsSync(pluginTypeDir)) {
          collectFiles(pluginTypeDir, (file) => {
            if (path.basename(file) === 'SKILL.md') return;
            const basename = path.basename(file);
            if (!pluginFiles.has(basename)) {
              pluginFiles.set(basename, []);
            }
            pluginFiles.get(basename).push(path.relative(ROOT, file));
          });
        }
      });
    }

    // Check for collisions within this type
    let typeCollisions = 0;
    initFiles.forEach((count, filename) => {
      if (pluginFiles.has(filename)) {
        const isAcceptable = ACCEPTABLE_COLLISIONS.has(filename);
        if (!isAcceptable) {
          typeCollisions++;
          totalCollisions++;
        }
        const level = isAcceptable ? '⚠️' : '❌';
        const status = isAcceptable ? '(acceptable - ADR-127 follow-up)' : '(CRITICAL)';
        console.error(
          `  ${level} [${type}] Collision: ${filename} ${status}`,
        );
        if (VERBOSE) {
          console.error(`     Init:    v3/@claude-flow/cli/.claude/${type}/*/${filename}`);
          console.error(`     Plugins: `, pluginFiles.get(filename));
        }
      }
    });

    if (VERBOSE && typeCollisions === 0) {
      console.log(`  ✅ [${type}] No critical collisions (${initFiles.size} files checked)`);
    }
  });

  if (totalCollisions === 0) {
    console.log(`  ✅ PASS: No critical filename collisions across all types`);
    if (ACCEPTABLE_COLLISIONS.size > 0) {
      console.log(`     (${ACCEPTABLE_COLLISIONS.size} acceptable collisions noted for ADR-127 follow-up)`);
    }
    return true;
  } else {
    console.error(`  ❌ FAIL: ${totalCollisions} critical collision(s) found`);
    return false;
  }
}

// ============================================================================
// ASSERTION 2: SKILLS_MAP completeness
// ============================================================================

function assertion2_skillsMapCompleteness() {
  console.log('\n📋 Assertion 2: SKILLS_MAP completeness');

  // Parse SKILLS_MAP from executor.ts
  const executorPath = path.join(ROOT, 'v3/@claude-flow/cli/src/init/executor.ts');
  const executorCode = fs.readFileSync(executorPath, 'utf8');

  // Extract SKILLS_MAP using regex
  const skillsMapMatch = executorCode.match(/const SKILLS_MAP:\s*Record<string,\s*string\[\]>\s*=\s*\{([\s\S]*?)\n\};/);
  if (!skillsMapMatch) {
    console.error('  ❌ Could not parse SKILLS_MAP from executor.ts');
    return false;
  }

  const allSkills = new Set();
  // Extract skill names from the matched content
  const skillArrayRegex = /['"]([a-z0-9-]+)['"]/g;
  let match;
  while ((match = skillArrayRegex.exec(skillsMapMatch[1])) !== null) {
    // Skip keys (Record keys), only collect values (skill names)
    if (!match[1].includes('_') && match[1].match(/^[a-z]/) && match[1].includes('-')) {
      allSkills.add(match[1]);
    }
  }

  // List extracted skills if verbose
  if (VERBOSE) {
    console.log(`  Found ${allSkills.size} skills in SKILLS_MAP:`);
    Array.from(allSkills).sort().forEach(s => console.log(`    - ${s}`));
  }

  // Check if all skills have SKILL.md files
  const skillsDir = path.join(ROOT, 'v3/@claude-flow/cli/.claude/skills');
  let missing = 0;
  const failedSkills = [];

  allSkills.forEach((skillName) => {
    const skillFile = path.join(skillsDir, skillName, 'SKILL.md');
    if (!fs.existsSync(skillFile)) {
      missing++;
      failedSkills.push(skillName);
    }
  });

  if (missing === 0) {
    console.log(`  ✅ PASS: All ${allSkills.size} skills have SKILL.md files`);
    return true;
  } else {
    console.error(`  ❌ FAIL: ${missing} skill(s) missing SKILL.md:`);
    failedSkills.forEach(s => console.error(`     - ${s}`));
    return false;
  }
}

// ============================================================================
// ASSERTION 3: COMMANDS_MAP coverage
// ============================================================================

function assertion3_commandsMapCoverage() {
  console.log('\n📋 Assertion 3: COMMANDS_MAP coverage (all command dirs have keys)');

  // Parse COMMANDS_MAP from executor.ts
  const executorPath = path.join(ROOT, 'v3/@claude-flow/cli/src/init/executor.ts');
  const executorCode = fs.readFileSync(executorPath, 'utf8');

  // Extract COMMANDS_MAP
  const commandsMapMatch = executorCode.match(/const COMMANDS_MAP:\s*Record<string,\s*string\[\]>\s*=\s*\{([\s\S]*?)\n\};/);
  if (!commandsMapMatch) {
    console.error('  ❌ Could not parse COMMANDS_MAP from executor.ts');
    return false;
  }

  // Extract all keys and values from COMMANDS_MAP
  const commandMapKeys = new Set();
  const commandMapValues = new Set();

  const commandsMapContent = commandsMapMatch[1];
  // Parse key-value pairs: key: ['value']
  const pairRegex = /(\w+):\s*\['([^']+)'\]/g;
  let match;
  while ((match = pairRegex.exec(commandsMapContent)) !== null) {
    const key = match[1];
    const value = match[2];
    commandMapKeys.add(key);
    commandMapValues.add(value);
  }

  if (VERBOSE) {
    console.log(`  Found ${commandMapKeys.size} COMMANDS_MAP keys:`, Array.from(commandMapKeys).sort());
    console.log(`  Found ${commandMapValues.size} command directory references:`, Array.from(commandMapValues).sort());
  }

  // List all command directories
  const commandsDir = path.join(ROOT, 'v3/@claude-flow/cli/.claude/commands');
  const commandDirs = new Set();

  fs.readdirSync(commandsDir).forEach((file) => {
    const fullPath = path.join(commandsDir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      commandDirs.add(file);
    }
  });

  if (VERBOSE) {
    console.log(`  Found ${commandDirs.size} command directories:`, Array.from(commandDirs).sort());
  }

  // Check coverage: every command dir should be in COMMANDS_MAP values
  const orphaned = [];
  commandDirs.forEach((dir) => {
    if (!commandMapValues.has(dir)) {
      orphaned.push(dir);
    }
  });

  if (orphaned.length === 0) {
    console.log(`  ✅ PASS: All ${commandDirs.size} command directories covered by COMMANDS_MAP`);
    return true;
  } else {
    console.error(`  ❌ FAIL: ${orphaned.length} orphaned command dir(s):`);
    orphaned.forEach(d => console.error(`     - ${d}`));
    return false;
  }
}

// ============================================================================
// Helper functions
// ============================================================================

function collectFiles(dir, callback) {
  try {
    fs.readdirSync(dir).forEach((file) => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isFile() && file.endsWith('.md')) {
        callback(fullPath);
      } else if (stat.isDirectory()) {
        collectFiles(fullPath, callback);
      }
    });
  } catch (err) {
    console.error(`  Error reading directory ${dir}: ${err.message}`);
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('🔍 ADR-128 Phase 5: Init Bundle Integrity Smoke Test\n');
  console.log(`📁 Root: ${ROOT}`);

  try {
    const result1 = assertion1_noCollision();
    const result2 = assertion2_skillsMapCompleteness();
    const result3 = assertion3_commandsMapCoverage();

    const allPassed = result1 && result2 && result3;

    console.log('\n' + '='.repeat(70));
    if (allPassed) {
      console.log('✅ All assertions passed');
      console.log('='.repeat(70) + '\n');
      process.exit(0);
    } else {
      console.log('❌ Some assertions failed');
      console.log('='.repeat(70) + '\n');
      process.exit(1);
    }
  } catch (err) {
    console.error(`\n❌ Smoke test error: ${err.message}`);
    if (VERBOSE) {
      console.error(err.stack);
    }
    process.exit(2);
  }
}

main();
