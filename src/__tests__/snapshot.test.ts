import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const CLI = join(__dirname, '..', '..', 'dist', 'index.js');

function run(...args: string[]): string {
  return execFileSync('node', [CLI, ...args], {
    encoding: 'utf-8',
    timeout: 10000,
  }).trim();
}

function runStderr(...args: string[]): string {
  try {
    execFileSync('node', [CLI, ...args], {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return '';
  } catch (err: any) {
    return (err.stderr || '').trim();
  }
}

// ─── Stable commands only (bundled data, no env dependency) ─────────────

const formats = ['text', 'json', 'markdown'] as const;
const langs = ['en', 'zh'] as const;

// ─── help ───────────────────────────────────────────────────────────────

describe('help', () => {
  it('--help', () => {
    expect(run('--help')).toMatchSnapshot();
  });
});

// ─── list ───────────────────────────────────────────────────────────────

describe('list', () => {
  for (const format of formats) {
    for (const lang of langs) {
      it(`list --format ${format} --lang ${lang}`, () => {
        expect(run('list', '--format', format, '--lang', lang)).toMatchSnapshot();
      });
    }
  }
});

// ─── info ───────────────────────────────────────────────────────────────

describe('info', () => {
  for (const format of formats) {
    for (const lang of langs) {
      it(`info Button --format ${format} --lang ${lang}`, () => {
        expect(run('info', 'Button', '--format', format, '--lang', lang)).toMatchSnapshot();
      });
    }
  }

  for (const format of formats) {
    it(`info Button --detail --format ${format}`, () => {
      expect(run('info', 'Button', '--detail', '--format', format)).toMatchSnapshot();
    });
  }

  // case-insensitive
  it('info button (lowercase)', () => {
    expect(run('info', 'button')).toMatchSnapshot();
  });

  // error: typo
  it('info Btn (typo)', () => {
    expect(runStderr('info', 'Btn')).toMatchSnapshot();
  });

  it('info Btn --format json (typo, json)', () => {
    expect(runStderr('info', 'Btn', '--format', 'json')).toMatchSnapshot();
  });

  // error: not found
  it('info NonExistent', () => {
    expect(runStderr('info', 'NonExistent')).toMatchSnapshot();
  });

  it('info NonExistent --format json', () => {
    expect(runStderr('info', 'NonExistent', '--format', 'json')).toMatchSnapshot();
  });
});

// ─── doc ────────────────────────────────────────────────────────────────

describe('doc', () => {
  for (const format of formats) {
    for (const lang of langs) {
      it(`doc Button --format ${format} --lang ${lang}`, () => {
        expect(run('doc', 'Button', '--format', format, '--lang', lang)).toMatchSnapshot();
      });
    }
  }

  it('doc NonExistent', () => {
    expect(runStderr('doc', 'NonExistent')).toMatchSnapshot();
  });

  it('doc Btn (typo)', () => {
    expect(runStderr('doc', 'Btn')).toMatchSnapshot();
  });
});

// ─── demo ───────────────────────────────────────────────────────────────

describe('demo', () => {
  // list demos for a component
  for (const format of formats) {
    for (const lang of langs) {
      it(`demo Button --format ${format} --lang ${lang}`, () => {
        expect(run('demo', 'Button', '--format', format, '--lang', lang)).toMatchSnapshot();
      });
    }
  }

  // specific demo
  for (const format of formats) {
    it(`demo Button basic --format ${format}`, () => {
      expect(run('demo', 'Button', 'basic', '--format', format)).toMatchSnapshot();
    });
  }

  // error: demo not found
  it('demo Button nonexistent', () => {
    expect(runStderr('demo', 'Button', 'nonexistent')).toMatchSnapshot();
  });

  it('demo Button nonexistent --format json', () => {
    expect(runStderr('demo', 'Button', 'nonexistent', '--format', 'json')).toMatchSnapshot();
  });

  // error: component not found
  it('demo NonExistent', () => {
    expect(runStderr('demo', 'NonExistent')).toMatchSnapshot();
  });
});

// ─── token ──────────────────────────────────────────────────────────────

describe('token', () => {
  // global tokens
  for (const format of formats) {
    it(`token --format ${format} (global)`, () => {
      expect(run('token', '--format', format)).toMatchSnapshot();
    });
  }

  // component tokens
  for (const format of formats) {
    for (const lang of langs) {
      it(`token Button --format ${format} --lang ${lang}`, () => {
        expect(run('token', 'Button', '--format', format, '--lang', lang)).toMatchSnapshot();
      });
    }
  }

  // error
  it('token NonExistent', () => {
    expect(runStderr('token', 'NonExistent')).toMatchSnapshot();
  });
});

// ─── semantic ───────────────────────────────────────────────────────────

describe('semantic', () => {
  for (const format of formats) {
    for (const lang of langs) {
      it(`semantic Drawer --format ${format} --lang ${lang}`, () => {
        expect(run('semantic', 'Drawer', '--format', format, '--lang', lang)).toMatchSnapshot();
      });
    }
  }

  it('semantic NonExistent', () => {
    expect(runStderr('semantic', 'NonExistent')).toMatchSnapshot();
  });
});

// ─── changelog ──────────────────────────────────────────────────────────

describe('changelog', () => {
  // single version
  for (const format of formats) {
    it(`changelog 5.21.0 --format ${format}`, () => {
      expect(run('changelog', '5.21.0', '--format', format)).toMatchSnapshot();
    });
  }

  // range (using .. syntax)
  for (const format of formats) {
    it(`changelog 5.20.0..5.22.0 --format ${format}`, () => {
      expect(run('changelog', '5.20.0..5.22.0', '--format', format)).toMatchSnapshot();
    });
  }

  // diff mode (two args)
  for (const format of formats) {
    it(`changelog 5.20.0 5.22.0 --format ${format}`, () => {
      expect(run('changelog', '5.20.0', '5.22.0', '--format', format)).toMatchSnapshot();
    });
  }

  // error: version not found
  it('changelog 5.99.99', () => {
    expect(runStderr('changelog', '5.99.99')).toMatchSnapshot();
  });

  // error: from > to
  it('changelog 5.5.0 5.1.0 (from > to)', () => {
    expect(runStderr('changelog', '5.5.0', '5.1.0')).toMatchSnapshot();
  });
});

// ─── migrate ────────────────────────────────────────────────────────────

describe('migrate', () => {
  // v4 → v5
  for (const format of formats) {
    it(`migrate 4 5 --format ${format}`, () => {
      expect(run('migrate', '4', '5', '--format', format)).toMatchSnapshot();
    });
  }

  // v5 → v6
  for (const format of formats) {
    it(`migrate 5 6 --format ${format}`, () => {
      expect(run('migrate', '5', '6', '--format', format)).toMatchSnapshot();
    });
  }

  // --component filter
  it('migrate 4 5 --component Select', () => {
    expect(run('migrate', '4', '5', '--component', 'Select')).toMatchSnapshot();
  });

  it('migrate 4 5 --component Select --format json', () => {
    expect(run('migrate', '4', '5', '--component', 'Select', '--format', 'json')).toMatchSnapshot();
  });

  // --apply
  it('migrate 4 5 --apply /tmp', () => {
    expect(run('migrate', '4', '5', '--apply', '/tmp')).toMatchSnapshot();
  });

  it('migrate 4 5 --apply /tmp --format json', () => {
    expect(run('migrate', '4', '5', '--apply', '/tmp', '--format', 'json')).toMatchSnapshot();
  });

  // error: invalid path
  it('migrate 3 6 (invalid)', () => {
    expect(runStderr('migrate', '3', '6')).toMatchSnapshot();
  });
});

// ─── bug ────────────────────────────────────────────────────────────────

describe('bug', () => {
  for (const format of formats) {
    it(`bug --title Test --format ${format}`, () => {
      expect(run('bug', '--title', 'Test', '--format', format)).toMatchSnapshot();
    });
  }

  it('bug --title Test --steps "Click" --expected "OK" --actual "Crash"', () => {
    expect(
      run('bug', '--title', 'Test', '--steps', 'Click', '--expected', 'OK', '--actual', 'Crash'),
    ).toMatchSnapshot();
  });

  // error: no title
  it('bug (no title)', () => {
    expect(runStderr('bug')).toMatchSnapshot();
  });

  it('bug --format json (no title)', () => {
    expect(runStderr('bug', '--format', 'json')).toMatchSnapshot();
  });
});

// ─── bug-cli ────────────────────────────────────────────────────────────

describe('bug-cli', () => {
  for (const format of formats) {
    it(`bug-cli --title Test --format ${format}`, () => {
      expect(run('bug-cli', '--title', 'Test', '--format', format)).toMatchSnapshot();
    });
  }

  it('bug-cli --title Test --description "Info crashes"', () => {
    expect(
      run('bug-cli', '--title', 'Test', '--description', 'Info crashes'),
    ).toMatchSnapshot();
  });
});
