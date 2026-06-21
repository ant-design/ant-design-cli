#!/usr/bin/env node

/**
 * Validate data/*.json files for common data quality issues.
 *
 * Usage:
 *   npx tsx scripts/validate-data.ts          # print issues, exit 0/1
 *   npx tsx scripts/validate-data.ts --quiet   # only print summary
 */

import fs from 'node:fs';
import path from 'node:path';
import type { PropData, MetadataStore } from '../src/types.js';

const DATA_DIR = path.join(import.meta.dirname, '..', 'data');
const quiet = process.argv.includes('--quiet');

interface Issue {
  file: string;
  component: string;
  prop: string;
  field: string;
  value: string;
  rule: string;
}

function checkProps(props: PropData[], file: string, component: string, issues: Issue[]): void {
  for (const prop of props) {
    const prefix = `${file}:${component}.${prop.name}`;

    // Rule 1: Type or default ends with trailing backslash (pipe-split remnant)
    if ((prop.type || '').endsWith('\\')) {
      issues.push({ file, component, prop: prop.name, field: 'type', value: prop.type!, rule: 'trailing-backslash' });
    }
    if ((prop.default || '').endsWith('\\')) {
      issues.push({ file, component, prop: prop.name, field: 'default', value: prop.default!, rule: 'trailing-backslash' });
    }

    // Rule 2: HTML entities in type/default/description
    for (const field of ['type', 'default', 'description', 'descriptionZh'] as const) {
      const val = prop[field];
      if (typeof val === 'string' && /&lt;|&gt;|&amp;/.test(val)) {
        issues.push({ file, component, prop: prop.name, field, value: val.substring(0, 80), rule: 'html-entity' });
      }
    }

    // Rule 3: Markdown escape remnants in type/default
    for (const field of ['type', 'default'] as const) {
      const val = prop[field];
      if (typeof val === 'string' && /\\[\[\]<>]/.test(val)) {
        issues.push({ file, component, prop: prop.name, field, value: val.substring(0, 80), rule: 'escape-remnant' });
      }
    }

    // Rule 4: Since field contains non-version content (upstream data issue, warning only)
    // Not included in exit code — these are from antd source docs
  }
}

/** Check for components with API docs but no extracted props (extraction gap) */
interface SnapshotIssue {
  file: string;
  component: string;
  rule: string;
}

function checkEmptyPropsWithApi(files: string[]): SnapshotIssue[] {
  const issues: SnapshotIssue[] = [];
  const majorStores = new Map<string, MetadataStore>();

  // Pass 1: load all major version stores first (e.g. v4.json, v5.json, v6.json)
  // so they're available when checking snapshots
  for (const file of files) {
    if (!file.replace(/\.json$/, '').includes('.')) {
      const filePath = path.join(DATA_DIR, file);
      const store: MetadataStore = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      majorStores.set(store.majorVersion, store);
    }
  }

  // Pass 2: check all files
  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    const store: MetadataStore = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const majorKey = store.majorVersion;
    const majorStore = majorStores.get(majorKey);

    for (const comp of store.components || []) {
      if (comp.props.length === 0 && comp.doc?.includes('## API')) {
        // Check if the major version has props for this component
        const majorComp = majorStore?.components.find(c => c.name === comp.name);
        const majorHasProps = majorComp && majorComp.props.length > 0;
        issues.push({
          file,
          component: comp.name,
          rule: majorHasProps ? 'empty-props-vs-major' : 'empty-props-with-api',
        });
      }
    }
  }

  return issues;
}

function main() {
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => /^v\d+.*\.json$/.test(f))
    .sort();

  const issues: Issue[] = [];
  const ruleCounts = new Map<string, number>();

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    const store: MetadataStore = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    for (const component of store.components || []) {
      if (component.props) {
        checkProps(component.props, file, component.name, issues);
      }
      if (component.subComponentProps) {
        for (const [key, subProps] of Object.entries(component.subComponentProps)) {
          checkProps(subProps as PropData[], file, `${component.name}.${key}`, issues);
        }
      }
    }
  }

  for (const issue of issues) {
    ruleCounts.set(issue.rule, (ruleCounts.get(issue.rule) || 0) + 1);
  }

  const errorRules = ['trailing-backslash', 'html-entity', 'escape-remnant'];
  let errorCount = issues.filter(i => errorRules.includes(i.rule)).length;
  let warnCount = issues.length - errorCount;

  if (!quiet) {
    for (const issue of issues) {
      const level = errorRules.includes(issue.rule) ? 'ERROR' : 'WARN';
      console.log(`[${level}] [${issue.rule}] ${issue.file}:${issue.component}.${issue.prop} ${issue.field}=${JSON.stringify(issue.value)}`);
    }
  }

  // Check for empty props with API docs (extraction gap detection)
  const snapshotIssues = checkEmptyPropsWithApi(files);
  for (const si of snapshotIssues) {
    const level = 'WARN';
    if (!quiet) {
      console.log(`[${level}] [${si.rule}] ${si.file}:${si.component} has 0 props but API docs exist${si.rule === 'empty-props-vs-major' ? ' (major version has props)' : ''}`);
    }
    ruleCounts.set(si.rule, (ruleCounts.get(si.rule) || 0) + 1);
    warnCount++;
  }

  console.log(`\nSummary:`);
  for (const [rule, count] of [...ruleCounts.entries()].sort()) {
    console.log(`  ${rule}: ${count}`);
  }
  console.log(`  Errors: ${errorCount}, Warnings: ${warnCount}`);

  if (errorCount > 0) {
    console.log(`\nFound ${errorCount} critical data quality issue(s).`);
    process.exit(1);
  } else if (warnCount > 0) {
    console.log(`\nNo critical issues. ${warnCount} upstream warning(s) (antd source data).`);
  } else {
    console.log('\nAll data files passed validation.');
  }
}

main();
